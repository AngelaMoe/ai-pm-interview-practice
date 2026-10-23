// lib/sanitize.js
// Prepares learner text for a Claude prompt.
//
// The text is graded, so it is NOT rewritten to remove suspicious phrases: the
// grader has to see what the learner actually wrote. Instead:
// - tags that could close or fake a prompt section are removed, so text inside
//   <user_input> can't break out of it;
// - control characters are removed and length is capped;
// - detectInjection() reports likely injection attempts for logging. The prompt
//   tells the grader to ignore embedded instructions and set a flag.

// Any tag with one of these names, opening or closing, is stripped
const PROMPT_TAGS = [
  'user_input', 'system', 'assistant', 'instructions', 'interview_question', 'weak_answer',
  'task_given_to_learner', 'checklist', 'lesson', 'rubric', 'key_points', 'concept_checks'
];
// Control characters (except tab, newline, carriage return) and zero-width / line-separator characters
const INVISIBLE_CHARS = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F\\u200B-\\u200F\\u2028\\u2029\\uFEFF]', 'g');
const TAG_PATTERN = new RegExp(`<\\s*/?\\s*(${PROMPT_TAGS.join('|')})\\b[^>]*>`, 'gi');

export function sanitizeLearnerText(text, maxChars) {
  if (typeof text !== 'string') return '';
  return text
    .normalize('NFKC')
    .replace(INVISIBLE_CHARS, '') // control and invisible characters
    .replace(TAG_PATTERN, '')
    .replace(/[ \t]{3,}/g, '  ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxChars);
}

const INJECTION_PATTERNS = [
  /\bignore (all |any |the )?(previous|prior|above|earlier) (instructions|prompts?|rules)\b/i,
  /\b(system|developer) (note|message|instruction)s?\b/i, // not 'prompt': 'the system prompt changed' is a normal answer
  /\byou are now\b/i,
  /\b(mark|grade|score|rate) (every|all|each)\b.*\b(met|correct|pass(ed)?|5)\b/i,
  /\b(give|assign) (this|me|the answer)\b.*\bscore of\b/i,
  /\bnote to (the )?grader\b/i
];

export function detectInjection(text) {
  return typeof text === 'string' && INJECTION_PATTERNS.some(p => p.test(text));
}
