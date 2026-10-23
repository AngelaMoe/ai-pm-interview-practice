// learn/grading/grader.js
// One grading call: render the prompt, call Claude with the lesson's output
// schema (structured outputs), validate, retry once if the output is invalid,
// then enforce that every "met" quotes the learner's text.
// Shared by the eval runner and (later) the grading routes.

import Anthropic from '@anthropic-ai/sdk';
import {
  fixGradeSchema, voiceGradeSchema, fixGradeSchemaKeyed, voiceGradeSchemaKeyed, keyedFixToList, keyedVoiceToList,
  validateFixGrade, validateVoiceGrade, enforceEvidence, normalizeForMatch, stripDisfluencies, SCORE_LABELS,
  capWords, IMPROVEMENT_MAX_WORDS
} from './schemas.js';
import { renderFixPrompt, renderVoicePrompt } from './prompts.js';

// $ per million tokens: [input, output]. Cache writes cost 1.25x input, reads 0.1x.
export const MODELS = {
  'haiku-4-5': { id: 'claude-haiku-4-5-20251001', rates: [1, 5] },
  'sonnet-4-6': { id: 'claude-sonnet-4-6', rates: [3, 15] },
  'sonnet-5-5': { id: 'claude-sonnet-5-5', rates: [2, 10], effort: 'low' } // thinking can't be disabled on 5.5
};

export function costOf(modelKey, usage) {
  const [input, output] = MODELS[modelKey].rates;
  const tokens = (usage.input_tokens || 0) * input
    + (usage.cache_creation_input_tokens || 0) * input * 1.25
    + (usage.cache_read_input_tokens || 0) * input * 0.1
    + (usage.output_tokens || 0) * output;
  return tokens / 1e6;
}

const MAX_ATTEMPTS = 2; // first try + one retry on invalid output

// What each prompt version expects. v1: list-shaped output and the model judges
// length. v2: keyed output (each item exactly once) and length measured in code.
export const PROMPT_PROFILES = {
  'fix-grader.v1': { shape: 'list' },
  'fix-grader.v2': { shape: 'keyed' },
  'voice-grader.v1': { shape: 'list', modelJudgesLength: true },
  'voice-grader.v2': { shape: 'keyed', modelJudgesLength: false }
};
const profileOf = id => { const p = PROMPT_PROFILES[id]; if (!p) throw new Error(`no profile for prompt ${id}`); return p; };

// Voice v2: an answer is too short for a 60-second answer below this many
// words of substance (fillers and stutters removed). The score is capped at 2.
// LOCKED grading configuration (2026-10-23, prompts/CHANGELOG.md): the model and
// prompt versions validated by the eval. Routes use these defaults; change them only
// with a new prompt version and a new eval run.
export const GRADING_CONFIG = Object.freeze({
  fix: Object.freeze({ modelKey: 'sonnet-5-5', version: 'v2' }),
  voice: Object.freeze({ modelKey: 'sonnet-5-5', version: 'v2' })
});

export const TOO_SHORT_WORDS = 40;
export function substantiveWordCount(text) {
  const t = stripDisfluencies(normalizeForMatch(text || ''));
  return t ? t.split(' ').length : 0;
}

async function callGrader({ client, modelKey, system, user, schema, validate, maxTokens, cacheSystem, normalize = g => g }) {
  const model = MODELS[modelKey];
  const attempts = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const started = Date.now();
    let response;
    try {
      response = await client.messages.create({
        model: model.id,
        max_tokens: maxTokens,
        system: cacheSystem ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }] : system,
        messages: [{ role: 'user', content: user }],
        output_config: { format: { type: 'json_schema', schema }, ...(model.effort ? { effort: model.effort } : {}) }
      });
    } catch (err) {
      // The SDK already retried rate limits and server errors; anything here is final
      const status = err instanceof Anthropic.APIError ? err.status : null;
      attempts.push({ attempt, error: `api_error${status ? `_${status}` : ''}`, message: err.message?.slice(0, 200) });
      return { ok: false, error: 'api_error', attempts };
    }
    const latencyMs = Date.now() - started;
    const record = { attempt, latencyMs, usage: response.usage, cost: costOf(modelKey, response.usage), stopReason: response.stop_reason };
    attempts.push(record);

    if (response.stop_reason === 'refusal') {
      record.error = 'refusal';
      return { ok: false, error: 'refusal', attempts };
    }
    let grade;
    try {
      grade = normalize(JSON.parse(response.content.find(b => b.type === 'text')?.text ?? ''));
    } catch {
      record.error = response.stop_reason === 'max_tokens' ? 'truncated' : 'invalid_json';
      continue;
    }
    const check = validate(grade);
    if (!check.ok) {
      record.error = 'invalid_grade';
      record.validationErrors = check.errors;
      continue;
    }
    return { ok: true, grade, attempts, latencyMs };
  }
  return { ok: false, error: 'invalid_after_retry', attempts };
}

export async function gradeFix({ client, lesson, answer, modelKey = GRADING_CONFIG.fix.modelKey, version = GRADING_CONFIG.fix.version }) {
  const prompt = renderFixPrompt(lesson, answer, version);
  const profile = profileOf(prompt.promptId);
  const checklist = lesson.fixWeakAnswer.checklist;
  const keyed = profile.shape === 'keyed';
  const result = await callGrader({
    client, modelKey, system: prompt.system, user: prompt.user,
    schema: keyed ? fixGradeSchemaKeyed(checklist) : fixGradeSchema(checklist),
    normalize: keyed ? g => keyedFixToList(g, checklist) : undefined,
    validate: g => validateFixGrade(g, checklist),
    // Haiku 4.5 needs 4,096+ tokens to cache, and this prompt is ~600. Other models
    // get the marker; it is a no-op wherever the prompt is under their minimum.
    maxTokens: 1500, cacheSystem: modelKey !== 'haiku-4-5'
  });
  if (!result.ok) return { ...result, promptId: prompt.promptId };
  const { items, rejected } = enforceEvidence(result.grade.checklist, prompt.learnerText, 'id');
  return { ...result, promptId: prompt.promptId, rawGrade: result.grade, grade: { ...result.grade, checklist: items }, evidenceRejected: rejected };
}

export async function gradeVoice({ client, lesson, transcript, modelKey = GRADING_CONFIG.voice.modelKey, version = GRADING_CONFIG.voice.version }) {
  const prompt = renderVoicePrompt(lesson, transcript, version);
  const profile = profileOf(prompt.promptId);
  const voice = lesson.voice;
  const keyed = profile.shape === 'keyed';
  const result = await callGrader({
    client, modelKey, system: prompt.system, user: prompt.user,
    schema: keyed ? voiceGradeSchemaKeyed(voice) : voiceGradeSchema(voice),
    normalize: keyed ? g => keyedVoiceToList(g, voice) : undefined,
    validate: g => validateVoiceGrade(g, voice, { modelJudgesLength: profile.modelJudgesLength }),
    maxTokens: 2500, cacheSystem: true
  });
  if (!result.ok) return { ...result, promptId: prompt.promptId };
  const { items, rejected } = enforceEvidence(result.grade.conceptChecks, prompt.learnerText, 'conceptId');
  let grade = { ...result.grade, conceptChecks: items };
  const improvement = capWords(grade.improvement, IMPROVEMENT_MAX_WORDS);
  if (improvement.trimmed) grade = { ...grade, improvement: improvement.text, improvementTrimmedFrom: result.grade.improvement };
  if (!profile.modelJudgesLength) {
    // Length is measured, not judged: flag short answers and cap their score
    const words = substantiveWordCount(prompt.learnerText);
    const tooShort = words < TOO_SHORT_WORDS;
    grade = { ...grade, flags: { ...grade.flags, too_short: tooShort }, substantiveWords: words };
    if (tooShort && grade.score > 2) grade = { ...grade, score: 2, scoreLabel: SCORE_LABELS[2], scoreCappedFrom: result.grade.score };
  }
  return { ...result, promptId: prompt.promptId, rawGrade: result.grade, grade, evidenceRejected: rejected };
}
