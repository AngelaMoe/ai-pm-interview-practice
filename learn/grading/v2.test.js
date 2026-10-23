// learn/grading/v2.test.js
// v2 changes: keyed output, disfluency-tolerant evidence matching, and the
// too_short check done in code. Run with: npm test. No API calls.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import {
  fixGradeSchemaKeyed, voiceGradeSchemaKeyed, keyedFixToList, keyedVoiceToList, keyPointKey,
  evidenceFound, stripDisfluencies, normalizeForMatch, validateVoiceGrade
} from './schemas.js';
import { gradeFix, gradeVoice, substantiveWordCount, TOO_SHORT_WORDS } from './grader.js';
import { renderFixPrompt, renderVoicePrompt } from './prompts.js';
import { getLesson } from '../content.js';

const LESSONS = ['metrics-1', 'metrics-2', 'metrics-3', 'metrics-4', 'metrics-5'];
const caseText = id => JSON.parse(readFileSync(new URL('../../prompts/evals/cases.json', import.meta.url))).cases.find(c => c.id === id).text;

test('keyed schemas: one required property per item, structured-outputs compatible', () => {
  for (const id of LESSONS) {
    const l = getLesson(id);
    const fix = fixGradeSchemaKeyed(l.fixWeakAnswer.checklist).properties.checklist;
    assert.deepEqual(fix.required, l.fixWeakAnswer.checklist.map(c => c.id));
    assert.equal(fix.additionalProperties, false);
    assert.equal(fix.properties[l.fixWeakAnswer.checklist[0].id].description, l.fixWeakAnswer.checklist[0].criterion);
    const voice = voiceGradeSchemaKeyed(l.voice).properties;
    assert.deepEqual(voice.conceptChecks.required, l.voice.conceptChecks.map(c => c.conceptId));
    assert.deepEqual(voice.keyPointsCovered.required, l.voice.keyPoints.map((_, i) => keyPointKey(i)));
    assert.deepEqual(voice.flags.required, ['off_topic', 'injection_attempt'], 'no too_short from the model in v2');
    const order = Object.keys(voiceGradeSchemaKeyed(l.voice).properties);
    assert.ok(order.indexOf('conceptChecks') < order.indexOf('score'));
  }
});

test('keyed output converts to the list shape in lesson order', () => {
  const l = getLesson('metrics-2');
  const [a, b, c, d] = l.fixWeakAnswer.checklist.map(x => x.id);
  const keyed = { checklist: { [d]: { met: false, evidence: '', reason: 'r' }, [a]: { met: true, evidence: 'x', reason: 'r' }, [b]: { met: false, evidence: '', reason: 'r' }, [c]: { met: false, evidence: '', reason: 'r' } }, feedback: 'f', flags: {} };
  assert.deepEqual(keyedFixToList(keyed, l.fixWeakAnswer.checklist).checklist.map(i => i.id), [a, b, c, d]);
  const v = l.voice;
  const kv = { conceptChecks: Object.fromEntries(v.conceptChecks.map(cc => [cc.conceptId, { met: false, evidence: '', reason: 'r' }])), keyPointsCovered: Object.fromEntries(v.keyPoints.map((_, i) => [keyPointKey(i), i === 1])) };
  const list = keyedVoiceToList(kv, v);
  assert.deepEqual(list.keyPointsCovered.map(k => [k.index, k.covered]), v.keyPoints.map((_, i) => [i, i === 1]));
  delete kv.conceptChecks[v.conceptChecks[0].conceptId];
  assert.equal(keyedVoiceToList(kv, v).conceptChecks.length, v.conceptChecks.length - 1, 'a missing key stays missing for the validator');
});

test('evidence matching tolerates dropped fillers and stutters (baseline-run quotes)', () => {
  const transcript = caseText('voice-adv-disfluent');
  // Exactly what Sonnet 5.5 quoted in the baseline run (rejected by v1 matching)
  assert.equal(evidenceFound('the goal is to help people find new music they like enough to keep coming back', transcript), true);
  assert.equal(evidenceFound("they open the play list they play tracks and they save songs or follow the artist so I'd count weekly openers tracks played and songs saved from it", transcript), true);
  assert.equal(evidenceFound('the one that matters is songs saved because that means they want to here it again not just that it was on in the back round', transcript), true);
});

test('evidence matching still rejects paraphrase, reordering and partial words', () => {
  const transcript = caseText('voice-adv-disfluent');
  assert.equal(evidenceFound('the goal is helping people discover new music', transcript), false); // paraphrase
  assert.equal(evidenceFound('songs saved is the one that matters', transcript), false); // reordered
  assert.equal(evidenceFound('ong saved', transcript), false); // partial word
  assert.equal(stripDisfluencies(normalizeForMatch('so um the the goal is uh is to keep um to keep coming back')), 'so the goal is to keep coming back');
});

test('substantive word count: fillers and stutters do not count; eval cases land where expected', () => {
  assert.equal(substantiveWordCount('um uh the the goal'), 2);
  assert.ok(substantiveWordCount(caseText('voice-adv-short-correct')) < TOO_SHORT_WORDS);
  assert.ok(substantiveWordCount(caseText('voice-m5-weak-2')) < TOO_SHORT_WORDS);
  // The dense answers v1 wrongly judged too short
  assert.ok(substantiveWordCount(caseText('voice-m5-strong-2')) >= TOO_SHORT_WORDS);
  assert.ok(substantiveWordCount(caseText('voice-m1-border-1')) >= TOO_SHORT_WORDS);
});

test('v2 prompts render fully; voice v2 system prompt no longer mentions too_short; fix v2 has the multi-part rule', () => {
  for (const id of LESSONS) {
    const l = getLesson(id);
    for (const p of [renderFixPrompt(l, 'a', 'v2'), renderVoicePrompt(l, 't', 'v2')]) assert.equal(/\{\{\w+\}\}/.test(p.system + p.user), false);
  }
  assert.equal(renderVoicePrompt(getLesson('metrics-1'), 't', 'v2').system.includes('too_short'), false);
  assert.ok(renderFixPrompt(getLesson('metrics-1'), 'a', 'v2').system.includes('every part must be present'));
});

// ===== Grader with a fake client =====
const fakeClient = responses => ({ calls: [], messages: { create: async function (p) { this.calls ??= []; return responses.shift(); } } });
const usage = { input_tokens: 100, output_tokens: 50 };
const reply = obj => ({ stop_reason: 'end_turn', usage, content: [{ type: 'text', text: JSON.stringify(obj) }] });

test('gradeFix v2: keyed reply is converted, validated and evidence-checked', async () => {
  const l = getLesson('metrics-2');
  const ids = l.fixWeakAnswer.checklist.map(c => c.id);
  const keyed = { checklist: Object.fromEntries(ids.map((id, i) => [id, { met: i === 0, evidence: i === 0 ? 'weekly agents' : '', reason: 'r' }])), feedback: 'Add a guardrail.', flags: { off_topic: false, injection_attempt: false } };
  const r = await gradeFix({ client: fakeClient([reply(keyed)]), lesson: l, answer: 'Count weekly agents who send drafts.', version: 'v2' });
  assert.equal(r.ok, true);
  assert.equal(r.promptId, 'fix-grader.v2');
  assert.deepEqual(r.grade.checklist.map(c => c.met), [true, false, false, false]);
});

const voiceReply = (l, score) => reply({
  conceptChecks: Object.fromEntries(l.voice.conceptChecks.map((c, i) => [c.conceptId, { met: i === 0, evidence: i === 0 ? 'weekly users who act on a thread' : '', reason: 'r' }])),
  keyPointsCovered: Object.fromEntries(l.voice.keyPoints.map((_, i) => [keyPointKey(i), false])),
  score, scoreLabel: { 5: 'excellent', 4: 'good', 3: 'fair', 2: 'poor', 1: 'poor' }[score], strengths: [], improvement: 'Add a trust signal.',
  flags: { off_topic: false, injection_attempt: false }
});

test('gradeVoice v2: short answer gets too_short from code and its score capped at 2', async () => {
  const l = getLesson('metrics-2');
  const r = await gradeVoice({ client: fakeClient([voiceReply(l, 4)]), lesson: l, transcript: caseText('voice-adv-short-correct'), version: 'v2' });
  assert.equal(r.ok, true);
  assert.equal(r.grade.flags.too_short, true);
  assert.equal(r.grade.score, 2);
  assert.equal(r.grade.scoreLabel, 'poor');
  assert.equal(r.grade.scoreCappedFrom, 4);
  assert.equal(r.grade.conceptChecks[0].met, true, 'checks are still graded honestly');
});

test('gradeVoice v2: a dense 60+ word answer is not too_short and keeps its score', async () => {
  const l = getLesson('metrics-2');
  const transcript = 'I would count weekly users who act on a thread from the summary alone ' + caseText('voice-m2-border-2');
  const r = await gradeVoice({ client: fakeClient([voiceReply(l, 4)]), lesson: l, transcript, version: 'v2' });
  assert.equal(r.grade.flags.too_short, false);
  assert.equal(r.grade.score, 4);
  assert.equal(r.grade.scoreCappedFrom, undefined);
});

test('voice validator v2 does not require a too_short flag; v1 still does', () => {
  const l = getLesson('metrics-2');
  const g = keyedVoiceToList(JSON.parse(voiceReply(l, 3).content[0].text), l.voice);
  assert.equal(validateVoiceGrade(g, l.voice, { modelJudgesLength: false }).ok, true);
  assert.equal(validateVoiceGrade(g, l.voice).ok, false);
});

// ===== Improvement word cap (trim, never fail) =====
import { capWords, IMPROVEMENT_MAX_WORDS } from './schemas.js';
const words = s => s.trim().split(/\s+/).length;

test('capWords: leaves text at or under the cap untouched', () => {
  assert.deepEqual(capWords('Name one guardrail and what it protects.', 30), { text: 'Name one guardrail and what it protects.', trimmed: false });
});

test('capWords: trims an over-30-word improvement (held-out style) at the last clause break', () => {
  const long = "You skipped TROPIC's boring causes and the AI layer; check timing, region, platform, then silent model, prompt or retrieval changes, latency and cost, comparing before and after on the same test conversations.";
  assert.ok(words(long) > 30);
  const r = capWords(long, IMPROVEMENT_MAX_WORDS);
  assert.equal(r.trimmed, true);
  assert.ok(words(r.text) <= 30);
  assert.equal(r.text, "You skipped TROPIC's boring causes and the AI layer; check timing, region, platform, then silent model, prompt or retrieval changes, latency and cost.");
});

test('capWords: hard-cuts with an ellipsis when there is no sensible break', () => {
  const r = capWords(Array.from({ length: 40 }, (_, i) => `w${i}`).join(' '), 30);
  assert.equal(r.trimmed, true);
  assert.ok(r.text.endsWith('…'));
  assert.equal(words(r.text), 30);
});

test('gradeVoice: an over-long improvement is trimmed, not retried or failed', async () => {
  const l = getLesson('metrics-2');
  const reply37 = voiceReply(l, 3);
  const body = JSON.parse(reply37.content[0].text);
  body.improvement = 'You should add a user-behavior trust signal, such as how often people reopen the full thread right after the summary, and explain briefly why a count beats a ratio for the North Star metric here.';
  const client = fakeClient([{ ...reply37, content: [{ type: 'text', text: JSON.stringify(body) }] }]);
  const r = await gradeVoice({ client, lesson: l, transcript: caseText('voice-m2-border-2'), version: 'v2' });
  assert.equal(r.ok, true);
  assert.equal(r.attempts.length, 1, 'no retry');
  assert.ok(words(r.grade.improvement) <= 30);
  assert.equal(r.grade.improvementTrimmedFrom, body.improvement);
});
