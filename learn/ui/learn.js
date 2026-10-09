// learn/ui/learn.js
// Learn mode UI: lesson map and the 4 lesson steps (cards, quiz, fix, speak).
// The fix and speak steps are placeholders until answer grading is built.
// All text goes into the DOM via textContent, never innerHTML.

import { isValidAnswer, gradeQuizItem } from '/learn/mastery.js';
import {
  getOrCreateAnonId, lessonMastery, nextLesson,
  shuffledRights, emptyMatching, selectMatching, pairNumber, isMatchingComplete
} from '/learn/learn-logic.js';

const API = '/api/learn';
const STEPS = ['Cards', 'Quiz', 'Fix', 'Speak'];

const app = document.getElementById('app');
const bannerEl = document.getElementById('banner');
const liveEl = document.getElementById('live');

const state = {
  anonId: null,
  persistent: true,
  unit: null,
  progressOk: true,
  statusById: new Map(),
  scoreById: new Map(),
  lesson: null,
  step: 0,          // index into STEPS
  cardIndex: 0,
  quizIndex: 0,
  quiz: null,       // per-item UI state
  beforeScores: null,
  saveFailed: false
};

// ===== DOM + API helpers =====

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'disabled') node.disabled = Boolean(value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

// Replace the screen and move focus to its heading, so keyboard and screen
// reader users land on the new content.
function show(...nodes) {
  // Skip optional parts (null/false); replaceChildren would print them as text
  app.replaceChildren(...nodes.flat().filter(n => n !== null && n !== undefined && n !== false));
  const heading = app.querySelector('[data-focus]');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus();
  }
  window.scrollTo({ top: 0 });
}

function announce(text) {
  liveEl.textContent = '';
  setTimeout(() => { liveEl.textContent = text; }, 50);
}

async function api(path, body) {
  try {
    const res = await fetch(`${API}${path}`, body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anonId: state.anonId, ...body }) }
      : undefined);
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

function renderBanners() {
  const banners = [];
  if (!state.progressOk) {
    banners.push(el('p', { class: 'banner banner-warn', role: 'status', text: "Couldn't load your progress. You can still do lessons, but they may not save." }));
  }
  if (!state.persistent) {
    banners.push(el('p', { class: 'banner banner-warn', text: "This browser isn't keeping site data, so your progress won't be kept after you close this page." }));
  }
  bannerEl.replaceChildren(...banners);
}

const conceptName = id => state.unit.concepts.find(c => c.id === id)?.name || id;
const lessonById = id => state.unit.lessons.find(l => l.id === id);

// ===== Startup =====

async function init() {
  // Even reading window.localStorage can throw when site data is blocked
  let storage;
  try { storage = window.localStorage; } catch { storage = null; }
  const anon = getOrCreateAnonId(storage ?? { getItem() { throw new Error('storage unavailable'); } });
  state.anonId = anon.id;
  state.persistent = anon.persistent;
  await loadData();
}

async function loadData() {
  show(el('h2', { 'data-focus': true, text: 'Lessons' }), renderSkeleton());
  const [unitRes, progressRes] = await Promise.all([
    api('/unit/metrics'),
    api(`/progress?anonId=${encodeURIComponent(state.anonId)}`)
  ]);

  if (!unitRes.ok || !unitRes.data?.lessons) {
    renderBanners();
    show(
      el('h2', { 'data-focus': true, text: "Lessons couldn't load" }),
      el('p', { class: 'banner banner-error', role: 'alert', text: 'Something went wrong loading the lessons. Check your connection and try again.' }),
      el('div', { class: 'actions' }, el('button', { class: 'btn-primary', onclick: loadData, text: 'Try again' }))
    );
    return;
  }

  state.unit = unitRes.data;
  state.progressOk = progressRes.ok;
  if (progressRes.ok) {
    state.statusById = new Map(progressRes.data.lessons.map(l => [l.id, l.status]));
    state.scoreById = new Map(progressRes.data.concepts.map(c => [c.id, c.score]));
  }
  renderBanners();
  renderMap();
}

function renderSkeleton() {
  return el('div', {},
    el('p', { class: 'muted', role: 'status', text: 'Loading your progress…' }),
    el('ul', { class: 'lesson-list', 'aria-hidden': 'true' },
      [1, 2, 3, 4, 5].map(() => el('li', { class: 'skeleton-row' })))
  );
}

// ===== Lesson map =====

function statusLabel(status) {
  if (status === 'completed') return el('span', { class: 'status-complete', text: 'Complete ✓' });
  if (status === 'started') return el('span', { class: 'status-started', text: 'In progress …' });
  return el('span', { text: 'Not started' });
}

function renderMap() {
  const { lessons } = state.unit;
  const next = nextLesson(lessons, state.statusById);
  const nodes = [
    el('h2', { 'data-focus': true, text: 'Metrics unit' }),
    el('p', { class: 'muted map-intro', text: '5 lessons. Each one has concept cards, a quick quiz, and two practice steps.' })
  ];

  if (next) {
    const started = state.statusById.get(next.id) === 'started';
    nodes.push(el('button', {
      class: 'btn-primary',
      onclick: () => openLesson(next.id),
      text: `${started ? 'Continue' : 'Start'} lesson ${next.number}: ${next.title}`
    }));
  } else {
    nodes.push(renderUnitComplete());
  }

  nodes.push(el('ol', { class: 'lesson-list', 'aria-label': 'Lessons' }, lessons.map(lesson => {
    const status = state.statusById.get(lesson.id) || 'not_started';
    const mastery = lessonMastery(state.scoreById, lesson);
    return el('li', {},
      el('button', { class: `lesson-row${next && next.id === lesson.id ? ' is-next' : ''}`, onclick: () => openLesson(lesson.id) },
        el('span', { class: 'lesson-num', 'aria-hidden': 'true', text: lesson.number }),
        el('span', { class: 'lesson-title' }, el('span', { class: 'sr-only', text: `Lesson ${lesson.number}: ` }), lesson.title),
        el('span', { class: 'lesson-meta' },
          el('span', { class: 'badge', text: lesson.framework }),
          statusLabel(status)),
        el('span', { class: 'mastery' },
          el('span', { class: 'mastery-bar', 'aria-hidden': 'true' },
            el('span', { class: 'mastery-fill', style: `width:${mastery}%` })),
          el('span', { text: `Mastery ${mastery}%` }))
      )
    );
  })));

  nodes.push(el('p', { class: 'map-note', text: 'Quiz answers can raise a concept to 69%. Reaching mastery (70%+) needs the written and spoken practice steps, which will be scored once feedback on those answers is live.' }));
  show(...nodes);
}

function renderUnitComplete() {
  const weak = state.unit.concepts
    .map(c => ({ ...c, score: state.scoreById.get(c.id) || 0 }))
    .filter(c => c.score < 70)
    .sort((a, b) => a.score - b.score);
  const shown = weak.slice(0, 5);

  return el('section', { class: 'unit-complete', 'aria-labelledby': 'unit-done' },
    el('h3', { id: 'unit-done', text: 'Metrics unit complete ✓' }),
    el('p', { text: 'You finished all 5 lessons.' }),
    weak.length ? el('p', { class: 'muted', text: 'Concepts to strengthen:' }) : null,
    weak.length ? el('ul', { class: 'weak-list' }, shown.map(c => el('li', {},
      el('span', { text: `${c.name} (${c.score}%)` }),
      el('button', { class: 'btn-ghost', onclick: () => openLesson(c.lessonId), text: `Review lesson ${lessonById(c.lessonId).number}` })
    ))) : null,
    weak.length > shown.length ? el('p', { class: 'muted', text: `…and ${weak.length - shown.length} more.` }) : null,
    el('div', { class: 'actions' }, el('a', { class: 'btn-ghost', href: '/', text: 'Go to Practice' }))
  );
}

// ===== Lesson =====

async function openLesson(lessonId) {
  state.lesson = lessonById(lessonId);
  state.step = 0;
  state.cardIndex = 0;
  state.quizIndex = 0;
  state.quiz = null;
  state.saveFailed = false;
  state.beforeScores = new Map(state.lesson.conceptIds.map(id => [id, state.scoreById.get(id) || 0]));
  renderLessonStep();

  const res = await api('/lesson/start', { lessonId });
  if (res.ok) {
    if (state.statusById.get(lessonId) !== 'completed') state.statusById.set(lessonId, 'started');
  } else {
    state.saveFailed = true;
    const note = app.querySelector('.save-slot');
    if (note) note.replaceChildren(saveNote());
  }
}

const saveNote = () => el('p', { class: 'save-note', role: 'status', text: 'Progress not saved. You can keep going.' });

function lessonChrome(...content) {
  const lesson = state.lesson;
  return [
    el('div', { class: 'lesson-top' },
      el('button', { class: 'btn-ghost', onclick: renderMap, text: '← Back to map' }),
      el('span', { class: 'lesson-name', text: `Lesson ${lesson.number}: ${lesson.title}` })),
    el('ol', { class: 'steps', 'aria-label': 'Lesson steps' }, STEPS.map((name, i) => el('li', {
      class: i < state.step ? 'done' : '',
      'aria-current': i === state.step ? 'step' : null,
      text: name
    }))),
    el('p', { class: 'step-label', text: `Step ${state.step + 1} of 4: ${STEPS[state.step]}` }),
    ...content,
    el('div', { class: 'save-slot' }, state.saveFailed ? saveNote() : null)
  ];
}

function renderLessonStep() {
  [renderCard, renderQuizItem, renderFix, renderSpeak][state.step]();
}

function goToStep(step) {
  state.step = step;
  renderLessonStep();
}

// ----- Step 1: concept cards -----

function renderCard() {
  const { cards } = state.lesson;
  const card = cards[state.cardIndex];
  const last = state.cardIndex === cards.length - 1;
  show(...lessonChrome(
    el('p', { class: 'muted', text: `Card ${state.cardIndex + 1} of ${cards.length}` }),
    el('h3', { 'data-focus': true, text: card.title }),
    el('p', { class: 'card-body', text: card.body }),
    el('div', { class: 'callout' }, el('span', { class: 'callout-label', text: 'Example' }), card.example),
    el('div', { class: 'actions' },
      state.cardIndex > 0 ? el('button', { class: 'btn-ghost', onclick: () => { state.cardIndex--; renderCard(); }, text: 'Back' }) : null,
      el('button', {
        class: 'btn-primary',
        onclick: () => { if (last) goToStep(1); else { state.cardIndex++; renderCard(); } },
        text: last ? 'Start quiz' : 'Next'
      }))
  ));
}

// ----- Step 2: quiz -----

function freshQuizState(item) {
  return {
    answer: null,
    checked: false,
    correct: null,
    saveFailed: false,
    matching: emptyMatching(),
    rights: item.type === 'matching' ? shuffledRights(item.pairs) : null
  };
}

function currentAnswer(item, q) {
  return item.type === 'matching' ? q.matching.pairs : q.answer;
}

function renderQuizItem() {
  const { quiz } = state.lesson;
  const item = quiz[state.quizIndex];
  if (!state.quiz) state.quiz = freshQuizState(item);
  const q = state.quiz;
  const answer = currentAnswer(item, q);
  const ready = item.type === 'matching' ? isMatchingComplete(q.matching, item) : isValidAnswer(item, answer);
  const last = state.quizIndex === quiz.length - 1;

  const heading = item.type === 'true-false'
    ? [el('p', { class: 'tf-label', text: 'True or false?' }), el('h3', { 'data-focus': true, text: item.statement })]
    : [el('h3', { 'data-focus': true, text: item.prompt })];

  show(...lessonChrome(
    el('p', { class: 'muted', text: `Question ${state.quizIndex + 1} of ${quiz.length}` }),
    ...heading,
    renderAnswerControls(item, q),
    q.checked ? renderFeedback(item, q) : null,
    q.saveFailed ? el('p', { class: 'save-note', text: 'Result not saved. You can keep going.' }) : null,
    el('div', { class: 'actions' },
      q.checked
        ? el('button', { class: 'btn-primary', onclick: () => nextQuizItem(last), text: last ? 'Continue to the Fix step' : 'Continue' })
        : el('button', { class: 'btn-primary', disabled: !ready, onclick: () => checkAnswer(item), text: 'Check' }))
  ));

  // Keep focus on the feedback after checking, rather than jumping to the heading
  if (q.checked) app.querySelector('.actions .btn-primary')?.focus();
}

function renderAnswerControls(item, q) {
  if (item.type === 'matching') return renderMatching(item, q);

  const choices = item.type === 'true-false'
    ? [{ value: true, label: 'True' }, { value: false, label: 'False' }]
    : item.options.map((label, i) => ({ value: i, label }));
  const rightValue = item.type === 'true-false' ? item.answer : item.answerIndex;

  return el('div', { class: `options${item.type === 'true-false' ? ' tf' : ''}`, role: 'group', 'aria-label': 'Answer choices' },
    choices.map(choice => {
      const selected = q.answer === choice.value;
      let cls = 'option';
      let mark = null;
      if (q.checked && choice.value === rightValue) { cls += ' is-correct'; mark = '✓ Correct answer'; }
      else if (q.checked && selected) { cls += ' is-wrong'; mark = '✗ Your answer'; }
      return el('button', {
        class: cls,
        'aria-pressed': String(selected),
        disabled: q.checked,
        onclick: () => { q.answer = choice.value; renderQuizItem(); focusSelected(); }
      }, choice.label, mark ? el('span', { class: 'option-mark', text: mark }) : null);
    }));
}

// After re-rendering on a selection, keep keyboard focus on the chosen control
function focusSelected() {
  app.querySelector('[aria-pressed="true"]')?.focus();
}

function renderMatching(item, q) {
  const m = q.matching;
  const lefts = item.pairs.map(p => p.left);
  const column = (side, values, label) => el('div', { class: 'match-col', role: 'group', 'aria-label': label },
    el('span', { class: 'match-col-label', 'aria-hidden': 'true', text: label }),
    values.map(value => {
      const n = pairNumber(m, side, value);
      const selected = m.selected && m.selected.side === side && m.selected.value === value;
      return el('div', { class: 'match-item' },
        el('span', { class: `pair-badge${n ? '' : ' empty'}`, 'aria-hidden': 'true', text: n || '' }),
        el('button', {
          class: 'option',
          'aria-pressed': String(Boolean(selected)),
          'data-side': side,
          'data-value': value,
          disabled: q.checked,
          onclick: () => {
            q.matching = selectMatching(m, side, value);
            renderQuizItem();
            app.querySelector(`[data-side="${side}"][data-value="${CSS.escape(value)}"]`)?.focus();
          }
        }, value, n ? el('span', { class: 'sr-only', text: ` (pair ${n})` }) : null));
    }));

  return el('div', {},
    el('p', { class: 'match-help', text: 'Select an item on the left, then its match on the right. Select a paired item to undo it.' }),
    el('div', { class: 'match-cols' },
      column('left', lefts, 'Items'),
      column('right', q.rights, 'Matches')));
}

async function checkAnswer(item) {
  const q = state.quiz;
  const answer = currentAnswer(item, q);
  if (!isValidAnswer(item, answer)) return;
  q.checked = true;
  q.correct = gradeQuizItem(item, answer); // same rules the server grades with
  announce(`${q.correct ? 'Correct.' : 'Not quite.'} ${item.explanation}`);
  renderQuizItem();

  const res = await api('/quiz-result', { lessonId: state.lesson.id, answers: [{ itemId: item.id, answer }] });
  if (res.ok) {
    for (const c of res.data.concepts) state.scoreById.set(c.id, c.score); // server scores are the ones kept
  } else if (state.quiz === q) {
    q.saveFailed = true;
    renderQuizItem();
  }
}

function renderFeedback(item, q) {
  let rightAnswer = null;
  if (!q.correct) {
    if (item.type === 'multiple-choice') rightAnswer = el('p', { text: `Right answer: ${item.options[item.answerIndex]}` });
    if (item.type === 'true-false') rightAnswer = el('p', { text: `Right answer: ${item.answer ? 'True' : 'False'}` });
    if (item.type === 'matching') rightAnswer = el('div', {}, el('p', { text: 'Right pairs:' }),
      el('ul', {}, item.pairs.map(p => el('li', { text: `${p.left} → ${p.right}` }))));
  }
  return el('div', { class: `feedback ${q.correct ? 'correct' : 'wrong'}` },
    el('p', { class: 'feedback-title', text: q.correct ? '✓ Correct' : '✗ Not quite' }),
    rightAnswer,
    el('p', { text: item.explanation }));
}

function nextQuizItem(last) {
  state.quiz = null;
  if (last) goToStep(2);
  else { state.quizIndex++; renderQuizItem(); }
}

// ----- Step 3: fix a weak answer (placeholder until grading is built) -----

function renderFix() {
  const fix = state.lesson.fixWeakAnswer;
  show(...lessonChrome(
    el('h3', { 'data-focus': true, text: 'Fix a weak answer' }),
    el('span', { class: 'field-label', text: 'Interview question' }),
    el('p', { class: 'question-text', text: fix.question }),
    el('span', { class: 'field-label', text: 'A weak answer' }),
    el('blockquote', { class: 'weak-answer', text: fix.weakAnswer }),
    el('p', { class: 'muted', style: 'margin-top:12px', text: fix.instructions }),
    el('p', { class: 'coming-soon', role: 'note', text: "Feedback on rewrites is coming soon. For now, think about how you'd fix it, then continue." }),
    el('div', { class: 'actions' },
      el('button', { class: 'btn-ghost', onclick: () => { state.quizIndex = state.lesson.quiz.length - 1; goToStep(1); }, text: 'Back' }),
      el('button', { class: 'btn-primary', onclick: () => goToStep(3), text: 'Continue' }))
  ));
}

// ----- Step 4: 60-second spoken answer (placeholder until grading is built) -----

function renderSpeak() {
  const voice = state.lesson.voice;
  show(...lessonChrome(
    el('h3', { 'data-focus': true, text: '60-second answer' }),
    el('span', { class: 'field-label', text: 'Interview question' }),
    el('p', { class: 'question-text', text: voice.question }),
    el('p', { class: 'muted', style: 'margin-top:12px', text: `In an interview, you'd answer this out loud in about ${voice.timeLimitSec} seconds, using what this lesson covered.` }),
    el('p', { class: 'coming-soon', role: 'note', text: 'Spoken-answer feedback is coming soon.' }),
    el('div', { class: 'actions' },
      el('button', { class: 'btn-ghost', onclick: () => goToStep(2), text: 'Back' }),
      el('button', { class: 'btn-primary', onclick: finishLesson, text: 'Finish lesson' }))
  ));
}

// ----- Lesson complete -----

async function finishLesson() {
  const lesson = state.lesson;
  show(el('h3', { 'data-focus': true, text: 'Saving your progress…' }), el('p', { class: 'muted', role: 'status', text: 'One moment.' }));
  const res = await api('/lesson/complete', { lessonId: lesson.id });
  const saved = res.ok;
  if (saved) state.statusById.set(lesson.id, 'completed');

  const next = nextLesson(state.unit.lessons, state.statusById);
  const nextAfterThis = state.unit.lessons.find(l => l.number === lesson.number + 1);
  const target = nextAfterThis && state.statusById.get(nextAfterThis.id) !== 'completed' ? nextAfterThis : next;

  show(
    el('h2', { 'data-focus': true, text: 'Lesson complete ✓' }),
    el('p', { class: 'muted', text: `Lesson ${lesson.number}: ${lesson.title}` }),
    lesson.takeaway ? el('p', { class: 'takeaway' }, el('span', { class: 'callout-label', text: 'Takeaway' }), lesson.takeaway) : null,
    el('h3', { class: 'scores-heading', text: 'Your concept scores' }),
    el('ul', { class: 'score-list' }, lesson.conceptIds.map(id => {
      const before = state.beforeScores.get(id) || 0;
      const after = state.scoreById.get(id) || 0;
      return el('li', {},
        el('span', { text: conceptName(id) }),
        el('span', { class: 'score-change', text: `${before}% → ${after}%` }));
    })),
    saved ? null : el('p', { class: 'save-note', role: 'status', text: "This lesson's completion wasn't saved. You can keep going." }),
    el('div', { class: 'actions' },
      el('button', { class: 'btn-ghost', onclick: renderMap, text: 'Back to map' }),
      target
        ? el('button', { class: 'btn-primary', onclick: () => openLesson(target.id), text: `Next: lesson ${target.number}` })
        : el('button', { class: 'btn-primary', onclick: renderMap, text: 'See your unit results' }))
  );
}

init();
