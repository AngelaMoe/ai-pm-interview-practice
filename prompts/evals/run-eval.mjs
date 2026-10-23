// prompts/evals/run-eval.mjs
// Runs the Learn graders over the eval set and measures them against labels.
//
//   node prompts/evals/run-eval.mjs [options]
//     --set iteration|held-out   default iteration. held-out is locked until
//                                labels.angela.json exists (Angela's blind labels).
//     --cases id1,id2            only these cases (must belong to --set)
//     --reps N                   runs per case, default 3 (consistency needs >= 2)
//     --voice-models a,b         default sonnet-4-6,sonnet-5-5
//     --fix-models a,b           default haiku-4-5
//     --step fix|voice|all       default all
//     --fix-version v1 --voice-version v1
//     --tag name                 added to the output folder name
//
// Writes prompts/evals/runs/<time>-<set>[-tag]/ with results.jsonl, summary.json
// and summary.md, records measured spend in spend-ledger.json, and regenerates
// spend.md. Refuses to start (or stops mid-run) if spend would pass the $30 cap.

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import { getLesson } from '../../learn/content.js';
import { gradeFix, gradeVoice, MODELS } from '../../learn/grading/grader.js';
import { detectInjection } from '../../lib/sanitize.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
dotenv.config({ path: join(root, '.env'), override: true });

const BUDGET_CAP = 30;
const EST_COST = { 'haiku-4-5': 0.003, 'sonnet-4-6': 0.015, 'sonnet-5-5': 0.015 }; // per call, deliberately high
const CONCURRENCY = 4;

// ===== Options =====
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i === -1 ? fallback : args[i + 1]; };
const set = opt('set', 'iteration');
const reps = Number(opt('reps', '3'));
const voiceModels = opt('voice-models', 'sonnet-4-6,sonnet-5-5').split(',');
const fixModels = opt('fix-models', 'haiku-4-5').split(',');
const stepFilter = opt('step', 'all');
const versions = { fix: opt('fix-version', 'v1'), voice: opt('voice-version', 'v1') };
const tag = opt('tag', '');
const onlyCases = opt('cases', null)?.split(',');

const fail = msg => { console.error(`Stopped: ${msg}`); process.exit(1); };
if (!['iteration', 'held-out'].includes(set)) fail('--set must be iteration or held-out');
if (!Number.isInteger(reps) || reps < 1) fail('--reps must be a positive integer');
for (const m of voiceModels) if (!MODELS[m] || m === 'haiku-4-5') fail(`unknown voice model ${m}`);
for (const m of fixModels) if (!MODELS[m]) fail(`unknown fix model ${m}`);
if (!['fix', 'voice', 'all'].includes(stepFilter)) fail('--step must be fix, voice or all');

// ===== Cases and labels =====
const readJson = f => JSON.parse(readFileSync(join(here, f), 'utf8'));
const { cases } = readJson('cases.json');
const split = readJson('split.json');
const ANGELA_LABELS = join(here, 'labels.angela.json');

let labels;
if (set === 'held-out') {
  if (!existsSync(ANGELA_LABELS)) fail('the held-out set is locked until Angela\'s blind labels exist (prompts/evals/labels.angela.json).');
  labels = JSON.parse(readFileSync(ANGELA_LABELS, 'utf8')).labels;
} else {
  labels = readJson('labels.claude.json').labels;
  const reviewFile = join(here, 'labels.review.json'); // Angela's answers from review-sheet.csv, if any
  if (existsSync(reviewFile)) {
    for (const [id, override] of Object.entries(JSON.parse(readFileSync(reviewFile, 'utf8')).labels)) {
      labels[id] = { ...labels[id], ...override, items: { ...labels[id].items, ...override.items }, uncertain: [] };
    }
  }
}
const allowed = new Set(set === 'held-out' ? split.heldOut : split.iteration);
if (onlyCases) {
  const outside = onlyCases.filter(id => !allowed.has(id));
  if (outside.length) fail(`${outside.length} of the requested case(s) aren't in the ${set} set.`); // never name them
}
const runCases = cases.filter(c => allowed.has(c.id) && (!onlyCases || onlyCases.includes(c.id)) && (stepFilter === 'all' || c.step === stepFilter));
if (!runCases.length) fail('no cases selected');

// One job per case x model x rep
const jobs = [];
for (const c of runCases) {
  const models = c.step === 'fix' ? fixModels : voiceModels;
  for (const modelKey of models) for (let rep = 1; rep <= reps; rep++) jobs.push({ c, modelKey, rep });
}

// ===== Budget =====
const LEDGER = join(here, 'spend-ledger.json');
const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'));
const spentBefore = ledger.entries.reduce((n, e) => n + e.cost, 0);
const estimate = jobs.reduce((n, j) => n + EST_COST[j.modelKey] * 1.3, 0); // 1.3: allowance for retries
console.log(`Set: ${set} | step: ${stepFilter} | cases: ${runCases.length} | reps: ${reps} | calls: ${jobs.length} | fix models: ${fixModels.join(', ')} | voice models: ${voiceModels.join(', ')}`);
console.log(`Spent so far: $${spentBefore.toFixed(2)} of $${BUDGET_CAP} | this run, estimated up to: $${estimate.toFixed(2)}`);
if (spentBefore + estimate > BUDGET_CAP) fail(`this run could take spend past the $${BUDGET_CAP} cap. Ask Angela before raising it.`);

// ===== Run =====
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const outDir = join(here, 'runs', `${stamp}-${set}${tag ? `-${tag}` : ''}`);
mkdirSync(outDir, { recursive: true });
const resultsFile = join(outDir, 'results.jsonl');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

let runCost = 0;
let stopped = false;
const results = [];
async function runJob({ c, modelKey, rep }) {
  if (stopped) return;
  const lesson = getLesson(c.lessonId);
  const r = c.step === 'fix'
    ? await gradeFix({ client, lesson, answer: c.text, modelKey, version: versions.fix })
    : await gradeVoice({ client, lesson, transcript: c.text, modelKey, version: versions.voice });
  const cost = r.attempts.reduce((n, a) => n + (a.cost || 0), 0);
  runCost += cost;
  const row = { caseId: c.id, step: c.step, lessonId: c.lessonId, kind: c.kind, modelKey, rep, promptId: r.promptId, ok: r.ok, error: r.error, attempts: r.attempts, grade: r.grade, rawGrade: r.rawGrade, evidenceRejected: r.evidenceRejected || [], detectedInjection: detectInjection(c.text), cost };
  results.push(row);
  appendFileSync(resultsFile, JSON.stringify(row) + '\n');
  if (spentBefore + runCost > BUDGET_CAP && !stopped) {
    stopped = true;
    console.error(`Stopping: measured spend reached $${(spentBefore + runCost).toFixed(2)}, past the $${BUDGET_CAP} cap.`);
  }
}
// Warm each voice model's prompt cache with one call before going parallel; otherwise
// concurrent first calls all write the cache and none read it, unlike real traffic
const queue = [...jobs];
for (const group of [...new Set(queue.map(j => `${j.c.step}|${j.modelKey}`))]) {
  if (group.endsWith('|haiku-4-5')) continue; // prompt below Haiku's cache minimum: nothing to warm
  const i = queue.findIndex(j => `${j.c.step}|${j.modelKey}` === group);
  if (i !== -1 && !stopped) await runJob(queue.splice(i, 1)[0]);
}
await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (queue.length && !stopped) await runJob(queue.shift()); }));

// ===== Metrics =====
const itemsOf = (row, which = 'grade') => {
  const g = row[which];
  if (!g) return null;
  const list = row.step === 'fix' ? g.checklist : g.conceptChecks;
  return Object.fromEntries(list.map(i => [row.step === 'fix' ? i.id : i.conceptId, i.met]));
};
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const p95 = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)]; };

function summarize(rows) {
  const ok = rows.filter(r => r.ok);
  const conf = { tp: 0, fp: 0, fn: 0, tn: 0 };
  const byKind = {};
  let uncertainSkipped = 0;
  const confExcl = { agree: 0, total: 0 };
  for (const r of ok) {
    const label = labels[r.caseId];
    const got = itemsOf(r);
    for (const [item, want] of Object.entries(label.items)) {
      const met = got[item] === true;
      conf[met ? (want ? 'tp' : 'fp') : (want ? 'fn' : 'tn')]++;
      byKind[r.kind] ??= { agree: 0, total: 0 };
      byKind[r.kind].total++;
      if (met === want) byKind[r.kind].agree++;
      if ((label.uncertain || []).includes(item)) uncertainSkipped++;
      else { confExcl.total++; if (met === want) confExcl.agree++; }
    }
  }
  // A failed grade (no usable output after the retry) counts as wrong on every
  // item in the agreement metrics, so failures can't flatter them. The false
  // met / not met rates stay over graded items; failures are reported separately.
  let failedItems = 0;
  for (const r of rows.filter(r => !r.ok)) {
    const label = labels[r.caseId];
    for (const item of Object.keys(label.items)) {
      failedItems++;
      byKind[r.kind] ??= { agree: 0, total: 0 };
      byKind[r.kind].total++;
      if (!(label.uncertain || []).includes(item)) confExcl.total++;
    }
  }
  const items = conf.tp + conf.fp + conf.fn + conf.tn;
  const clear = ['strong', 'weak'].reduce((m, k) => ({ agree: m.agree + (byKind[k]?.agree || 0), total: m.total + (byKind[k]?.total || 0) }), { agree: 0, total: 0 });

  // Voice score
  const voice = ok.filter(r => r.step === 'voice');
  const diffs = voice.map(r => r.grade.score - labels[r.caseId].score);
  // Ordering, checked against the labels' own order: per lesson, for each pair
  // of case kinds whose mean label scores differ (e.g. strong 4.5 > borderline 3),
  // the grader's mean scores must be ordered the same way. Pairs the labels
  // rank equal are skipped, since the rubric can rate a "weak" answer fair.
  const ordering = [];
  const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  for (const lessonId of [...new Set(voice.map(r => r.lessonId))]) {
    const of = kind => voice.filter(r => r.lessonId === lessonId && r.kind === kind);
    for (const [hi, lo] of [['strong', 'borderline'], ['borderline', 'weak'], ['strong', 'weak']]) {
      const [a, b] = [of(hi), of(lo)];
      if (!a.length || !b.length) continue;
      const labelA = avg(a.map(r => labels[r.caseId].score)), labelB = avg(b.map(r => labels[r.caseId].score));
      if (labelA === labelB) continue;
      const gradeA = avg(a.map(r => r.grade.score)), gradeB = avg(b.map(r => r.grade.score));
      ordering.push({ lessonId, pair: `${hi}>${lo}`, ok: Math.sign(gradeA - gradeB) === Math.sign(labelA - labelB), label: [labelA, labelB], grade: [gradeA, gradeB] });
    }
  }
  // Known negatives: cases whose labels have nothing met
  const negatives = ok.filter(r => Object.values(labels[r.caseId].items).every(v => !v));
  const negPass = negatives.filter(r => Object.values(itemsOf(r)).every(v => !v));
  // Designed flags
  const flagChecks = [];
  for (const r of ok) for (const [flag, want] of Object.entries(labels[r.caseId].flags || {})) flagChecks.push(r.grade.flags[flag] === want);
  const injectionCases = ok.filter(r => labels[r.caseId].flags?.injection_attempt);
  // Consistency: (case, model, item) answered differently across reps
  const groups = new Map();
  for (const r of ok) { const k = `${r.caseId}|${r.modelKey}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(itemsOf(r)); }
  let flips = 0, comparable = 0;
  for (const runs of groups.values()) {
    if (runs.length < 2) continue;
    for (const item of Object.keys(runs[0])) { comparable++; if (new Set(runs.map(x => x[item])).size > 1) flips++; }
  }
  // Evidence: of raw "met", how many quotes were verified
  let rawMet = 0, rejected = 0;
  for (const r of ok) { rawMet += Object.values(itemsOf(r, 'rawGrade')).filter(Boolean).length; rejected += r.evidenceRejected.length; }
  // Perf
  const finalAttempts = ok.map(r => r.attempts.at(-1));
  const usage = rows.flatMap(r => r.attempts).filter(a => a.usage).map(a => a.usage);
  const sum = k => usage.reduce((n, u) => n + (u[k] || 0), 0);
  const inputAll = sum('input_tokens') + sum('cache_read_input_tokens') + sum('cache_creation_input_tokens');

  return {
    calls: rows.length,
    schemaValidAfterRetry: pct(ok.length, rows.length),
    retries: rows.filter(r => r.attempts.length > 1).length,
    retryReasons: rows.flatMap(r => r.attempts.filter(a => a.error).map(a => (a.validationErrors || [a.error]).join('; ').replace(/\(got \d+\)/, '').trim())).reduce((m, k) => ({ ...m, [k]: (m[k] || 0) + 1 }), {}),
    errors: Object.fromEntries(Object.entries(rows.filter(r => !r.ok).reduce((m, r) => ({ ...m, [r.error]: (m[r.error] || 0) + 1 }), {}))),
    items: { total: items, ...conf },
    falseMetRate: pct(conf.fp, conf.fp + conf.tn),
    falseNotMetRate: pct(conf.fn, conf.fn + conf.tp),
    failedItems,
    agreementOverall: pct(conf.tp + conf.tn, items + failedItems),
    agreementClearCut: pct(clear.agree, clear.total),
    agreementByKind: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, pct(v.agree, v.total)])),
    agreementExcludingUncertain: pct(confExcl.agree, confExcl.total),
    uncertainItemsGraded: uncertainSkipped,
    voiceScore: voice.length ? {
      exact: pct(diffs.filter(d => d === 0).length, diffs.length),
      withinOne: pct(diffs.filter(d => Math.abs(d) <= 1).length, diffs.length),
      meanAbsError: Math.round((diffs.reduce((n, d) => n + Math.abs(d), 0) / diffs.length) * 100) / 100,
      meanSignedError: Math.round((diffs.reduce((n, d) => n + d, 0) / diffs.length) * 100) / 100
    } : null,
    ordering: ordering.length ? { pairs: ordering.length, correct: ordering.filter(o => o.ok).length, detail: ordering } : null,
    knownNegatives: { cases: negatives.length, nothingMet: negPass.length },
    designedFlags: { checks: flagChecks.length, correct: flagChecks.filter(Boolean).length },
    injectionFlagged: { cases: injectionCases.length, flagged: injectionCases.filter(r => r.grade.flags.injection_attempt).length },
    consistency: { comparableItems: comparable, flipped: flips, flipRate: pct(flips, comparable) },
    evidence: { rawMet, rejected, verifiedRate: pct(rawMet - rejected, rawMet) },
    cost: { total: Math.round(rows.reduce((n, r) => n + r.cost, 0) * 10000) / 10000, perCall: rows.length ? Math.round((rows.reduce((n, r) => n + r.cost, 0) / rows.length) * 10000) / 10000 : null },
    latencyMs: { median: median(finalAttempts.map(a => a.latencyMs)), p95: p95(finalAttempts.map(a => a.latencyMs)) },
    tokens: { input: sum('input_tokens'), cacheRead: sum('cache_read_input_tokens'), cacheWrite: sum('cache_creation_input_tokens'), output: sum('output_tokens'), cacheReadShare: pct(sum('cache_read_input_tokens'), inputAll) }
  };
}

const groupsOut = {};
for (const key of [...new Set(results.map(r => `${r.step}/${r.modelKey}`))].sort()) {
  groupsOut[key] = summarize(results.filter(r => `${r.step}/${r.modelKey}` === key));
}
const summary = {
  set, stamp, reps, versions, step: stepFilter, fixModels, voiceModels, cases: runCases.length, calls: results.length, stoppedForBudget: stopped,
  labelSource: set === 'held-out' ? 'labels.angela.json' : `labels.claude.json${existsSync(join(here, 'labels.review.json')) ? ' + labels.review.json' : ' (uncertain items not yet reviewed)'}`,
  groups: groupsOut
};
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');

// Targets from docs/grading-plan.md
const T = (v, ok) => (v === null || v === undefined ? 'n/a' : `${v}${ok ? '' : ' ✗'}`);
const md = [`# Eval run ${stamp} (${set})`, '', `Cases ${runCases.length} · reps ${reps} · calls ${results.length} · prompts fix ${versions.fix} / voice ${versions.voice} · labels: ${summary.labelSource}${stopped ? ' · **stopped at budget cap**' : ''}`, ''];
md.push('| Metric (target) | ' + Object.keys(groupsOut).join(' | ') + ' |', '|---|' + Object.keys(groupsOut).map(() => '---').join('|') + '|');
const rowOf = (label, f) => md.push(`| ${label} | ` + Object.values(groupsOut).map(f).join(' | ') + ' |');
rowOf('False "met" rate (≤ 5%)', g => T(g.falseMetRate, g.falseMetRate <= 5));
rowOf('False "not met" rate (≤ 10%)', g => T(g.falseNotMetRate, g.falseNotMetRate <= 10));
rowOf('Agreement, clear-cut (≥ 95%)', g => T(g.agreementClearCut, g.agreementClearCut >= 95));
rowOf('Agreement, overall, failures count as wrong (≥ 90%)', g => T(g.agreementOverall, g.agreementOverall >= 90));
rowOf('Agreement, borderline (reported)', g => T(g.agreementByKind.borderline, true));
rowOf('Agreement, adversarial (reported)', g => T(g.agreementByKind.adversarial, true));
rowOf('Voice score within ±1 (≥ 90%)', g => (g.voiceScore ? T(g.voiceScore.withinOne, g.voiceScore.withinOne >= 90) : 'n/a'));
rowOf('Voice score exact (≥ 60%)', g => (g.voiceScore ? T(g.voiceScore.exact, g.voiceScore.exact >= 60) : 'n/a'));
rowOf('Voice score mean abs error (≤ 0.6)', g => (g.voiceScore ? T(g.voiceScore.meanAbsError, g.voiceScore.meanAbsError <= 0.6) : 'n/a'));
rowOf('Ordering matches labels, kind pairs (100%)', g => (g.ordering ? T(`${g.ordering.correct}/${g.ordering.pairs}`, g.ordering.correct === g.ordering.pairs) : 'n/a'));
rowOf('Known negatives: nothing met (100%)', g => T(`${g.knownNegatives.nothingMet}/${g.knownNegatives.cases}`, g.knownNegatives.nothingMet === g.knownNegatives.cases));
rowOf('Designed flags correct (100%)', g => T(`${g.designedFlags.correct}/${g.designedFlags.checks}`, g.designedFlags.correct === g.designedFlags.checks));
rowOf('Consistency: items flipped (≤ 5%)', g => T(g.consistency.flipRate, g.consistency.flipRate === null || g.consistency.flipRate <= 5));
rowOf('Evidence verified (≥ 98%)', g => T(g.evidence.verifiedRate, g.evidence.verifiedRate === null || g.evidence.verifiedRate >= 98));
rowOf('Schema-valid after retry (100%)', g => T(g.schemaValidAfterRetry, g.schemaValidAfterRetry === 100));
rowOf('Retries (reasons in summary.json)', g => String(g.retries));
rowOf('Cost per call', g => `$${g.cost.perCall}`);
rowOf('Latency median / p95 (ms)', g => `${g.latencyMs.median} / ${g.latencyMs.p95}`);
rowOf('Cache read share of input', g => `${g.tokens.cacheReadShare}%`);
md.push('', `Measured cost this run: $${runCost.toFixed(4)}. ✗ marks a missed target.`);
writeFileSync(join(outDir, 'summary.md'), md.join('\n') + '\n');

// ===== Spend =====
ledger.entries.push({ date: new Date().toISOString().slice(0, 10), what: `eval run ${stamp} (${set}, ${runCases.length} cases × ${reps} reps)`, calls: results.reduce((n, r) => n + r.attempts.length, 0), cost: Math.round(runCost * 10000) / 10000, basis: 'measured' });
writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + '\n');
const total = ledger.entries.reduce((n, e) => n + e.cost, 0);
writeFileSync(join(here, 'spend.md'), [
  '# Grading phase API spend', '',
  `**Budget: $${BUDGET_CAP}.** Stop and ask before going over it. Generated from \`spend-ledger.json\` by the eval runner; costs are from each response's \`usage\` × the model's rates unless marked estimate.`, '',
  '| Date | What | API calls | Cost | Basis |', '|---|---|---|---|---|',
  ...ledger.entries.map(e => `| ${e.date} | ${e.what} | ${e.calls} | $${e.cost.toFixed(4)} | ${e.basis} |`),
  `| | **Running total** | | **$${total.toFixed(2)}** | |`, ''
].join('\n'));

console.log(`\nWrote ${outDir.replace(root + '/', '')}/ (results.jsonl, summary.json, summary.md)`);
console.log(`Measured cost this run: $${runCost.toFixed(4)} · total spent: $${total.toFixed(2)} of $${BUDGET_CAP}`);
if (set === 'iteration') console.log('\n' + md.join('\n'));
else console.log('Held-out summary written to the run folder (not printed).');
