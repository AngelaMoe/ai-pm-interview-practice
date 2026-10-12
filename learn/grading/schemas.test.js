// learn/grading/schemas.test.js
// Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fixGradeSchema, voiceGradeSchema, validateFixGrade, validateVoiceGrade,
  evidenceFound, enforceEvidence, normalizeForMatch
} from './schemas.js';
import { getLesson } from '../content.js';

const lesson = getLesson('metrics-2');
const checklist = lesson.fixWeakAnswer.checklist;
const voice = lesson.voice;

// Structured outputs require additionalProperties:false and full `required` on every object
function assertStrictObjects(schema, path = 'root') {
  if (schema.type === 'object') {
    assert.equal(schema.additionalProperties, false, `${path}: additionalProperties must be false`);
    assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort(), `${path}: every property required`);
    for (const [k, v] of Object.entries(schema.properties)) assertStrictObjects(v, `${path}.${k}`);
  }
  if (schema.type === 'array') assertStrictObjects(schema.items, `${path}[]`);
  for (const banned of ['minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'maxItems']) {
    assert.equal(banned in schema, false, `${path}: ${banned} isn't supported by structured outputs`);
  }
}

test('schemas are structured-outputs compatible for every lesson', () => {
  for (const id of ['metrics-1', 'metrics-2', 'metrics-3', 'metrics-4', 'metrics-5']) {
    const l = getLesson(id);
    assertStrictObjects(fixGradeSchema(l.fixWeakAnswer.checklist));
    assertStrictObjects(voiceGradeSchema(l.voice));
  }
});

test('voice schema puts evidence-based fields before the score (generation order)', () => {
  const order = Object.keys(voiceGradeSchema(voice).properties);
  assert.ok(order.indexOf('conceptChecks') < order.indexOf('score'));
  assert.ok(order.indexOf('keyPointsCovered') < order.indexOf('score'));
  assert.deepEqual(voiceGradeSchema(voice).required, order);
  const fixOrder = Object.keys(fixGradeSchema(checklist).properties);
  assert.ok(fixOrder.indexOf('checklist') < fixOrder.indexOf('feedback'));
});

test('schemas restrict ids to the lesson\'s own items', () => {
  assert.deepEqual(fixGradeSchema(checklist).properties.checklist.items.properties.id.enum, checklist.map(c => c.id));
  assert.deepEqual(voiceGradeSchema(voice).properties.conceptChecks.items.properties.conceptId.enum, voice.conceptChecks.map(c => c.conceptId));
});

const goodFix = () => ({
  checklist: checklist.map(c => ({ id: c.id, met: false, evidence: '', reason: 'Not addressed.' })),
  feedback: 'Anchor on a count of agents using drafts, then add a guardrail.',
  flags: { off_topic: false, injection_attempt: false }
});

test('validateFixGrade: a well-formed grade passes', () => {
  assert.deepEqual(validateFixGrade(goodFix(), checklist), { ok: true, errors: [] });
});

test('validateFixGrade: missing, duplicate or foreign items fail', () => {
  const missing = goodFix(); missing.checklist.pop();
  assert.equal(validateFixGrade(missing, checklist).ok, false);
  const dup = goodFix(); dup.checklist[1] = { ...dup.checklist[0] };
  assert.equal(validateFixGrade(dup, checklist).ok, false);
  const foreign = goodFix(); foreign.checklist[0].id = 'm1-fix-goal';
  assert.equal(validateFixGrade(foreign, checklist).ok, false);
});

test('validateFixGrade: empty or overlong feedback and bad flags fail', () => {
  const empty = goodFix(); empty.feedback = ' ';
  assert.equal(validateFixGrade(empty, checklist).ok, false);
  const long = goodFix(); long.feedback = 'word '.repeat(61);
  assert.equal(validateFixGrade(long, checklist).ok, false);
  const flags = goodFix(); delete flags.flags.injection_attempt;
  assert.equal(validateFixGrade(flags, checklist).ok, false);
  assert.equal(validateFixGrade(null, checklist).ok, false);
});

const goodVoice = () => ({
  score: 4,
  scoreLabel: 'good',
  conceptChecks: voice.conceptChecks.map(c => ({ conceptId: c.conceptId, met: false, evidence: '', reason: 'Not addressed.' })),
  keyPointsCovered: voice.keyPoints.map((_, i) => ({ index: i, covered: false })),
  strengths: ['Clear North Star.'],
  improvement: 'Name one guardrail and what it protects.',
  flags: { off_topic: false, injection_attempt: false, too_short: false }
});

test('validateVoiceGrade: a well-formed grade passes', () => {
  assert.deepEqual(validateVoiceGrade(goodVoice(), voice), { ok: true, errors: [] });
});

test('validateVoiceGrade: score/label mismatch, missing key point, 3 strengths fail', () => {
  const mismatch = goodVoice(); mismatch.scoreLabel = 'excellent';
  assert.equal(validateVoiceGrade(mismatch, voice).ok, false);
  const twoIsPoor = goodVoice(); twoIsPoor.score = 2; twoIsPoor.scoreLabel = 'poor';
  assert.equal(validateVoiceGrade(twoIsPoor, voice).ok, true);
  const kp = goodVoice(); kp.keyPointsCovered.pop();
  assert.equal(validateVoiceGrade(kp, voice).ok, false);
  const strengths = goodVoice(); strengths.strengths = ['a', 'b', 'c'];
  assert.equal(validateVoiceGrade(strengths, voice).ok, false);
  const tooShort = goodVoice(); delete tooShort.flags.too_short;
  assert.equal(validateVoiceGrade(tooShort, voice).ok, false);
});

test('validateVoiceGrade: too_short caps the score at 2 but allows met checks', () => {
  const capped = goodVoice();
  capped.flags.too_short = true;
  capped.conceptChecks[0] = { ...capped.conceptChecks[0], met: true, evidence: 'weekly users', reason: 'Count-based.' };
  assert.equal(validateVoiceGrade(capped, voice).ok, false, 'score 4 with too_short must fail');
  capped.score = 2; capped.scoreLabel = 'poor';
  assert.deepEqual(validateVoiceGrade(capped, voice), { ok: true, errors: [] });
});

test('evidence matching ignores case, punctuation and spacing (speech transcripts)', () => {
  const transcript = 'so um the north star would be weekly users who act on a thread after reading only the summary';
  assert.equal(evidenceFound('Weekly users who act on a thread, after reading only the summary.', transcript), true);
  assert.equal(evidenceFound('“weekly users who act on a thread”', transcript), true);
  assert.equal(normalizeForMatch("agents’  edit-rate"), 'agents edit rate');
});

test('evidence matching rejects paraphrase, commentary and empty quotes', () => {
  const text = 'Our North Star is weekly agents who send an AI-drafted reply.';
  assert.equal(evidenceFound('The North Star is stated as a count of agents', text), false); // paraphrase
  assert.equal(evidenceFound('The answer says "weekly agents who send an AI-drafted reply"', text), false); // commentary
  assert.equal(evidenceFound('', text), false);
  assert.equal(evidenceFound('...', text), false);
});

test('enforceEvidence downgrades unsupported "met" items and reports them', () => {
  const text = 'We would guard hallucination rate and cost per query.';
  const items = [
    { id: 'a', met: true, evidence: 'guard hallucination rate', reason: '' },
    { id: 'b', met: true, evidence: 'track override rate', reason: '' },
    { id: 'c', met: false, evidence: '', reason: '' }
  ];
  const { items: out, rejected } = enforceEvidence(items, text, 'id');
  assert.deepEqual(rejected, ['b']);
  assert.deepEqual(out.map(i => i.met), [true, false, false]);
  assert.equal(out[1].evidenceRejected, true);
  assert.equal(items[1].met, true, 'input not mutated');
});
