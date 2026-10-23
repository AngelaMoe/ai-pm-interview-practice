// learn/grading/grader.js
// One grading call: render the prompt, call Claude with the lesson's output
// schema (structured outputs), validate, retry once if the output is invalid,
// then enforce that every "met" quotes the learner's text.
// Shared by the eval runner and (later) the grading routes.

import Anthropic from '@anthropic-ai/sdk';
import { fixGradeSchema, voiceGradeSchema, validateFixGrade, validateVoiceGrade, enforceEvidence } from './schemas.js';
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

async function callGrader({ client, modelKey, system, user, schema, validate, maxTokens, cacheSystem }) {
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
      grade = JSON.parse(response.content.find(b => b.type === 'text')?.text ?? '');
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

export async function gradeFix({ client, lesson, answer, modelKey = 'haiku-4-5', version = 'v1' }) {
  const prompt = renderFixPrompt(lesson, answer, version);
  const checklist = lesson.fixWeakAnswer.checklist;
  const result = await callGrader({
    client, modelKey, system: prompt.system, user: prompt.user,
    schema: fixGradeSchema(checklist), validate: g => validateFixGrade(g, checklist),
    maxTokens: 1500, cacheSystem: false // below Haiku 4.5's 4,096-token cache minimum
  });
  if (!result.ok) return { ...result, promptId: prompt.promptId };
  const { items, rejected } = enforceEvidence(result.grade.checklist, prompt.learnerText, 'id');
  return { ...result, promptId: prompt.promptId, rawGrade: result.grade, grade: { ...result.grade, checklist: items }, evidenceRejected: rejected };
}

export async function gradeVoice({ client, lesson, transcript, modelKey = 'sonnet-4-6', version = 'v1' }) {
  const prompt = renderVoicePrompt(lesson, transcript, version);
  const voice = lesson.voice;
  const result = await callGrader({
    client, modelKey, system: prompt.system, user: prompt.user,
    schema: voiceGradeSchema(voice), validate: g => validateVoiceGrade(g, voice),
    maxTokens: 2500, cacheSystem: true
  });
  if (!result.ok) return { ...result, promptId: prompt.promptId };
  const { items, rejected } = enforceEvidence(result.grade.conceptChecks, prompt.learnerText, 'conceptId');
  return { ...result, promptId: prompt.promptId, rawGrade: result.grade, grade: { ...result.grade, conceptChecks: items }, evidenceRejected: rejected };
}
