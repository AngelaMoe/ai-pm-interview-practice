// prompts/evals/build-split.mjs
// Validates the eval cases and Claude's labels against the lesson content,
// draws the iteration / held-out split, and writes the two sheets for Angela.
// Run with: node prompts/evals/build-split.mjs
// Deterministic: the same seed and cases always give the same split.

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getLesson } from '../../learn/content.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = f => JSON.parse(readFileSync(join(here, f), 'utf8'));
const { cases } = read('cases.json');
const { labels } = read('labels.claude.json');

const SEED = 20261012;
const HELD_OUT_FRACTION = 1 / 3;
const MAX_CHARS = { fix: 600, voice: 2000 };

// ===== Validate =====
const errors = [];
const ids = new Set();
const itemsFor = c => {
  const lesson = getLesson(c.lessonId);
  return c.step === 'fix'
    ? lesson.fixWeakAnswer.checklist.map(i => ({ id: i.id, criterion: i.criterion }))
    : lesson.voice.conceptChecks.map(i => ({ id: i.conceptId, criterion: i.criterion }));
};
for (const c of cases) {
  if (ids.has(c.id)) errors.push(`duplicate case id ${c.id}`);
  ids.add(c.id);
  if (!getLesson(c.lessonId)) { errors.push(`${c.id}: unknown lesson ${c.lessonId}`); continue; }
  if (!['fix', 'voice'].includes(c.step)) errors.push(`${c.id}: bad step`);
  if (!['strong', 'weak', 'borderline', 'adversarial'].includes(c.kind)) errors.push(`${c.id}: bad kind`);
  if (c.text.length > MAX_CHARS[c.step]) errors.push(`${c.id}: ${c.text.length} chars, over ${MAX_CHARS[c.step]}`);
  const label = labels[c.id];
  if (!label) { errors.push(`${c.id}: no label`); continue; }
  const expected = itemsFor(c).map(i => i.id).sort();
  const got = Object.keys(label.items).sort();
  if (JSON.stringify(expected) !== JSON.stringify(got)) errors.push(`${c.id}: label items ${got} don't match lesson items ${expected}`);
  if (Object.values(label.items).some(v => typeof v !== 'boolean')) errors.push(`${c.id}: item labels must be booleans`);
  if (c.step === 'voice' && ![1, 2, 3, 4, 5].includes(label.score)) errors.push(`${c.id}: voice label needs a score 1-5`);
  if (c.step === 'fix' && label.score !== undefined) errors.push(`${c.id}: fix labels have no score`);
  if (label.flags?.too_short && label.score > 2) errors.push(`${c.id}: too_short label scores above 2`);
  for (const u of label.uncertain || []) if (u !== 'score' && !(u in label.items)) errors.push(`${c.id}: uncertain '${u}' isn't an item`);
}
for (const id of Object.keys(labels)) if (!ids.has(id)) errors.push(`label for unknown case ${id}`);
if (errors.length) { console.error('Validation failed:\n- ' + errors.join('\n- ')); process.exit(1); }

// ===== Split (seeded, stratified by step × kind) =====
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const random = mulberry32(SEED);
const strata = new Map();
for (const c of [...cases].sort((a, b) => a.id.localeCompare(b.id))) {
  const key = `${c.step}/${c.kind}`;
  if (!strata.has(key)) strata.set(key, []);
  strata.get(key).push(c);
}
const heldOut = [];
for (const [, group] of [...strata].sort(([a], [b]) => a.localeCompare(b))) {
  const shuffled = [...group];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  heldOut.push(...shuffled.slice(0, Math.floor(group.length * HELD_OUT_FRACTION)).map(c => c.id));
}
const heldOutSet = new Set(heldOut);
const iteration = cases.map(c => c.id).filter(id => !heldOutSet.has(id));

// ===== Sheets =====
const csv = rows => '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n') + '\r\n';
const caseById = new Map(cases.map(c => [c.id, c]));
const questionFor = c => { const l = getLesson(c.lessonId); return c.step === 'fix' ? l.fixWeakAnswer.question : l.voice.question; };
const rubricFor = c => {
  if (c.step !== 'voice') return 'n/a';
  const r = getLesson(c.lessonId).voice.evaluationRubric;
  return `5 excellent: ${r.excellent}\n4 good: ${r.good}\n3 fair: ${r.fair}\n1-2 poor: ${r.poor}`;
};

// Blind labeling sheet: held-out cases only, no labels, shuffled order, 2 sessions
const sheetOrder = [...heldOut].sort((a, b) => a.localeCompare(b));
for (let i = sheetOrder.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [sheetOrder[i], sheetOrder[j]] = [sheetOrder[j], sheetOrder[i]]; }
// Neutral sheet ids (H01…) so the case id (which names its kind, e.g. "weak") can't bias the labeler
const sheetIdOf = new Map(sheetOrder.map((id, i) => [id, `H${String(i + 1).padStart(2, '0')}`]));
writeFileSync(join(here, 'split.json'), JSON.stringify({
  seed: SEED,
  method: 'Seeded shuffle within each step × kind stratum; floor(1/3) of each stratum held out.',
  heldOut: [...heldOut].sort(),
  iteration: [...iteration].sort(),
  labelingSheetIds: Object.fromEntries([...sheetIdOf].map(([id, sid]) => [sid, id]).sort())
}, null, 2) + '\n');
const header = ['session', 'row', 'sheet_id', 'step', 'interview_question', 'answer', 'item_1', 'item_1_met (Y/N)', 'item_2', 'item_2_met (Y/N)', 'item_3', 'item_3_met (Y/N)', 'item_4', 'item_4_met (Y/N)', 'rubric (voice only)', 'score_1_to_5 (voice only)', 'notes (optional)'];
const sheet = [header, ...sheetOrder.map((id, i) => {
  const c = caseById.get(id);
  const items = itemsFor(c);
  const itemCells = [0, 1, 2, 3].flatMap(k => (items[k] ? [`${items[k].id}: ${items[k].criterion}`, ''] : ['n/a', 'n/a']));
  return [i < Math.ceil(sheetOrder.length / 2) ? 1 : 2, i + 1, sheetIdOf.get(id), c.step, questionFor(c), c.text === '' ? '(empty answer)' : c.text, ...itemCells, rubricFor(c), c.step === 'voice' ? '' : 'n/a', ''];
})];
writeFileSync(join(here, 'labeling-sheet.csv'), csv(sheet));

// Review sheet: iteration cases Claude flagged as uncertain (shows Claude's label)
const review = [['case_id', 'step', 'interview_question', 'answer', 'uncertain_about', 'criterion_or_rubric', 'claude_label', 'claude_note', 'your_call (agree / change to ...)']];
for (const id of iteration) {
  const c = caseById.get(id);
  const label = labels[id];
  for (const u of label.uncertain || []) {
    const item = itemsFor(c).find(i => i.id === u);
    review.push([id, c.step, questionFor(c), c.text, u, u === 'score' ? rubricFor(c) : item.criterion, u === 'score' ? label.score : (label.items[u] ? 'met' : 'not met'), label.note || '', '']);
  }
}
writeFileSync(join(here, 'review-sheet.csv'), csv(review));

// ===== Summary =====
const marks = id => { const c = caseById.get(id); return itemsFor(c).length + (c.step === 'voice' ? 1 : 0); };
const countBy = list => list.reduce((m, id) => { const c = caseById.get(id); const k = `${c.step}/${c.kind}`; m[k] = (m[k] || 0) + 1; return m; }, {});
console.log(`Validated ${cases.length} cases and labels: OK`);
console.log(`Iteration: ${iteration.length} cases | Held-out: ${heldOut.length} cases`);
console.log('Held-out by stratum:', countBy(heldOut));
const s1 = sheetOrder.slice(0, Math.ceil(sheetOrder.length / 2)), s2 = sheetOrder.slice(Math.ceil(sheetOrder.length / 2));
console.log(`Labeling sheet: ${sheetOrder.length} rows, ${heldOut.reduce((n, id) => n + marks(id), 0)} marks (session 1: ${s1.length} rows / ${s1.reduce((n, id) => n + marks(id), 0)} marks, session 2: ${s2.length} rows / ${s2.reduce((n, id) => n + marks(id), 0)} marks)`);
console.log(`Review sheet: ${review.length - 1} uncertain calls in the iteration set`);
const heldOutUncertain = heldOut.filter(id => (labels[id].uncertain || []).length);
console.log(`Held-out cases Claude was unsure about (Angela labels these blind anyway): ${heldOutUncertain.length}`);
