// learn/grading/prompts.js
// Loads the versioned grader prompts from /prompts and renders them for one
// request, following each file's "Input handling" notes.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { WIKI_FRAMEWORKS_BLOCK } from '../../wiki-knowledge.js';
import { sanitizeLearnerText } from '../../lib/sanitize.js';

const PROMPTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../prompts');
export const MAX_CHARS = { fix: 600, voice: 2000 };

const cache = new Map();

// A prompt file has a ```text block under "## System prompt" and another under
// "## User message template".
export function loadPrompt(name, version) {
  const key = `${name}.${version}`;
  if (!cache.has(key)) {
    const md = readFileSync(join(PROMPTS_DIR, `${name}.${version}.md`), 'utf8');
    const block = heading => {
      const section = md.split(`## ${heading}`)[1];
      const match = section?.match(/```text\n([\s\S]*?)\n```/);
      if (!match) throw new Error(`${key}: missing "${heading}" text block`);
      return match[1];
    };
    cache.set(key, { name, version, system: block('System prompt'), user: block('User message template') });
  }
  return cache.get(key);
}

function fill(template, values, label) {
  const out = template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in values)) throw new Error(`${label}: no value for {{${k}}}`);
    return values[k];
  });
  return out;
}

export function renderFixPrompt(lesson, learnerText, version = 'v1') {
  const p = loadPrompt('fix-grader', version);
  const fix = lesson.fixWeakAnswer;
  const learnerAnswer = sanitizeLearnerText(learnerText, MAX_CHARS.fix);
  return {
    promptId: `fix-grader.${version}`,
    system: p.system,
    user: fill(p.user, {
      question: fix.question,
      weakAnswer: fix.weakAnswer,
      instructions: fix.instructions,
      checklist: fix.checklist.map(c => `- ${c.id}: ${c.criterion}`).join('\n'),
      learnerAnswer
    }, p.name),
    learnerText: learnerAnswer // the evidence check runs against exactly what the grader saw
  };
}

export function renderVoicePrompt(lesson, transcriptText, version = 'v1') {
  const p = loadPrompt('voice-grader', version);
  const voice = lesson.voice;
  const r = voice.evaluationRubric;
  const transcript = sanitizeLearnerText(transcriptText, MAX_CHARS.voice);
  return {
    promptId: `voice-grader.${version}`,
    system: fill(p.system, { wikiFrameworks: WIKI_FRAMEWORKS_BLOCK.trim() }, p.name),
    user: fill(p.user, {
      framework: lesson.framework,
      lessonTitle: lesson.title,
      question: voice.question,
      rubric: [`5 excellent: ${r.excellent}`, `4 good: ${r.good}`, `3 fair: ${r.fair}`, `1-2 poor: ${r.poor}`].join('\n'),
      keyPoints: voice.keyPoints.map((k, i) => `${i}. ${k}`).join('\n'),
      conceptChecks: voice.conceptChecks.map(c => `- ${c.conceptId}: ${c.criterion}`).join('\n'),
      transcript
    }, p.name),
    learnerText: transcript
  };
}
