// learn/routes.js
// Learn mode API: lesson content and anonymous progress. No Claude calls here;
// the grading routes come in a later phase.
// Mounted at /api/learn in server.js, before the global JSON parser, so this
// router's smaller body limit applies.

import express, { Router } from 'express';
import { getPublicUnit, isKnownUnit, getLesson, getUnitForLesson, getQuizItem } from './content.js';
import { isValidAnswer, gradeQuizItem, applyDelta, isMastered, QUIZ_CORRECT, QUIZ_WRONG } from './mastery.js';
import { getSupabase } from './supabase-client.js';
import { safeError, badRequest, notFound, progressUnavailable } from '../lib/safe-error.js';
import { createRateLimiter } from '../lib/rate-limit.js';

const router = Router();
router.use(express.json({ limit: '20kb' }));

const readLimit = createRateLimiter({ windowMs: 60 * 1000, max: 120 });
const writeLimit = createRateLimiter({ windowMs: 60 * 1000, max: 60 });

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ===== Helpers =====

function handle(context, fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      safeError(res, err, context);
    }
  };
}

function requireAnonId(value) {
  if (typeof value !== 'string' || !UUID_V4.test(value)) throw badRequest('Invalid anonId');
  return value.toLowerCase();
}

function requireLesson(value) {
  const lesson = typeof value === 'string' ? getLesson(value) : null;
  if (!lesson) throw badRequest('Unknown lessonId');
  return lesson;
}

function requireSupabase() {
  const supabase = getSupabase();
  if (!supabase) throw progressUnavailable();
  return supabase;
}

// Unwraps a Supabase result. Postgres errors (5-character SQLSTATE codes) are
// bugs and become a generic 500; anything else (network, paused project,
// bad credentials) means progress is unavailable, so 503.
function unwrap({ data, error }, context) {
  if (!error) return data;
  if (typeof error.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code)) throw error;
  console.error(`Supabase unavailable in ${context}:`, error);
  throw progressUnavailable();
}

async function touchLearner(supabase, anonId) {
  unwrap(await supabase
    .from('learners')
    .upsert({ anon_id: anonId, last_seen_at: new Date().toISOString() }, { onConflict: 'anon_id' }),
  'touchLearner');
}

// Records a lesson as started; never downgrades a completed lesson.
async function ensureStarted(supabase, anonId, lessonId) {
  unwrap(await supabase
    .from('lesson_progress')
    .upsert({ anon_id: anonId, lesson_id: lessonId, status: 'started' },
      { onConflict: 'anon_id,lesson_id', ignoreDuplicates: true }),
  'ensureStarted');
}

// ===== Routes =====

router.get('/unit/:unitId', readLimit, handle('learn unit', async (req, res) => {
  if (!isKnownUnit(req.params.unitId)) throw notFound('Unit not found');
  res.json(getPublicUnit(req.params.unitId));
}));

router.get('/progress', readLimit, handle('learn progress', async (req, res) => {
  const anonId = requireAnonId(req.query.anonId);
  const supabase = requireSupabase();

  const [concepts, lessons] = await Promise.all([
    supabase.from('concept_mastery').select('concept_id, score').eq('anon_id', anonId),
    supabase.from('lesson_progress').select('lesson_id, status').eq('anon_id', anonId)
  ]);
  const scoreById = new Map(unwrap(concepts, 'progress concepts').map(r => [r.concept_id, r.score]));
  const statusById = new Map(unwrap(lessons, 'progress lessons').map(r => [r.lesson_id, r.status]));

  const unit = getPublicUnit('metrics');
  res.json({
    lessons: unit.lessons.map(l => ({ id: l.id, status: statusById.get(l.id) || 'not_started' })),
    concepts: unit.concepts.map(c => {
      const score = scoreById.get(c.id) || 0;
      return { id: c.id, score, mastered: isMastered(score) };
    })
  });
}));

router.post('/lesson/start', writeLimit, handle('learn lesson start', async (req, res) => {
  const anonId = requireAnonId(req.body?.anonId);
  const lesson = requireLesson(req.body?.lessonId);
  const supabase = requireSupabase();

  await touchLearner(supabase, anonId);
  await ensureStarted(supabase, anonId, lesson.id);

  const row = unwrap(await supabase
    .from('lesson_progress').select('status')
    .eq('anon_id', anonId).eq('lesson_id', lesson.id).single(),
  'lesson start status');
  res.json({ lessonId: lesson.id, status: row.status });
}));

router.post('/quiz-result', writeLimit, handle('learn quiz result', async (req, res) => {
  const anonId = requireAnonId(req.body?.anonId);
  const lesson = requireLesson(req.body?.lessonId);
  const answers = req.body?.answers;

  if (!Array.isArray(answers) || answers.length === 0 || answers.length > lesson.quiz.length) {
    throw badRequest('answers must be a non-empty array, one entry per quiz item');
  }
  const seen = new Set();
  const graded = answers.map(entry => {
    const item = typeof entry?.itemId === 'string' ? getQuizItem(lesson, entry.itemId) : null;
    if (!item) throw badRequest('Unknown itemId for this lesson');
    if (seen.has(item.id)) throw badRequest('Each itemId may appear only once');
    seen.add(item.id);
    if (!isValidAnswer(item, entry.answer)) throw badRequest(`Invalid answer for ${item.id}`);
    return { item, correct: gradeQuizItem(item, entry.answer) };
  });

  const supabase = requireSupabase();
  await touchLearner(supabase, anonId);
  await ensureStarted(supabase, anonId, lesson.id);

  const existing = unwrap(await supabase
    .from('concept_mastery').select('concept_id, score, applied_met')
    .eq('anon_id', anonId).in('concept_id', lesson.conceptIds),
  'quiz mastery read');

  // Read-modify-write: fine for one learner in one browser tab.
  const state = new Map(lesson.conceptIds.map(id => [id, { score: 0, applied_met: false }]));
  for (const row of existing) state.set(row.concept_id, { score: row.score, applied_met: row.applied_met });

  for (const { item, correct } of graded) {
    const concept = state.get(item.conceptId);
    concept.score = applyDelta(concept.score, correct ? QUIZ_CORRECT : QUIZ_WRONG, concept.applied_met);
  }

  const touched = [...new Set(graded.map(g => g.item.conceptId))];
  const now = new Date().toISOString();
  unwrap(await supabase.from('concept_mastery').upsert(
    touched.map(id => ({ anon_id: anonId, concept_id: id, score: state.get(id).score, applied_met: state.get(id).applied_met, updated_at: now })),
    { onConflict: 'anon_id,concept_id' }
  ), 'quiz mastery write');

  res.json({
    results: graded.map(({ item, correct }) => ({ itemId: item.id, correct, explanation: item.explanation })),
    concepts: lesson.conceptIds.map(id => ({ id, score: state.get(id).score, mastered: isMastered(state.get(id).score) }))
  });
}));

router.post('/lesson/complete', writeLimit, handle('learn lesson complete', async (req, res) => {
  const anonId = requireAnonId(req.body?.anonId);
  const lesson = requireLesson(req.body?.lessonId);
  const supabase = requireSupabase();

  await touchLearner(supabase, anonId);
  const current = unwrap(await supabase
    .from('lesson_progress').select('status')
    .eq('anon_id', anonId).eq('lesson_id', lesson.id).maybeSingle(),
  'lesson complete read');

  // Keep the first completion time if the lesson is completed again
  if (current?.status !== 'completed') {
    unwrap(await supabase.from('lesson_progress').upsert(
      { anon_id: anonId, lesson_id: lesson.id, status: 'completed', completed_at: new Date().toISOString() },
      { onConflict: 'anon_id,lesson_id' }
    ), 'lesson complete write');
  }

  const unitLessonIds = getUnitForLesson(lesson.id).lessons.map(l => l.id);
  const completed = unwrap(await supabase
    .from('lesson_progress').select('lesson_id')
    .eq('anon_id', anonId).eq('status', 'completed').in('lesson_id', unitLessonIds),
  'unit completion read');

  res.json({ lessonId: lesson.id, status: 'completed', unitComplete: completed.length === unitLessonIds.length });
}));

// Malformed or oversized JSON bodies: safe messages, never Express's default error page
router.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must be valid JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large' });
  return safeError(res, err, 'learn router');
});

export default router;
