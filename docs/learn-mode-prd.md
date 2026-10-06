# Learn Mode: PRD and UI Spec

**Status:** Draft, agreed scope. No Learn mode code yet.
**Branch:** `feature/learn-mode`
**Date:** 2026-10-05

---

## Part 1: PRD

### Problem

PM candidates preparing for interviews can already *practice* in this app (voice mock interviews with AI feedback), but practice only helps once you know the frameworks. Candidates who don't yet know how to structure a metrics answer get feedback like "you skipped the guardrails" without ever having been taught what a guardrail metric is.

The app already holds the teaching material: the Study Frameworks cards, the Question Deconstruction quiz, and the compiled framework notes in `wiki-knowledge.js`. That material is currently passive (read a card, take one quiz). Learn mode turns it into short, active lessons that build the knowledge Practice mode then tests.

### Users

PM candidates preparing for interviews, especially AI PM roles. Typical user: knows what a PM does, has heard of frameworks, but can't yet produce a structured metrics answer under time pressure.

### Success metrics

| Metric | Definition | MVP target (proposed) |
|---|---|---|
| **Unit completion rate** | Anonymous users who complete all 5 lessons ÷ anonymous users who start lesson 1 | ≥ 30% |
| Lesson 1 drop-off (diagnostic) | Users who start lesson 1 but don't finish it | Tracked, no target. Used to find where the lesson loses people. |
| **Practice score improvement** | Practice score after the lessons vs. before | **Deferred to v2** (see v2 direction). Practice mode doesn't store a structured score today, and v1 doesn't change Practice. |

All metrics come from the Supabase `lesson_progress` table (see Data model). There is no separate analytics tool in v1.

### Scope: v1 (MVP)

- **One unit: Metrics.** 5 lessons (see Lesson outline).
- **Each lesson has 4 steps, in order:**
  1. Concept cards: short teaching cards, one idea per card
  2. Quiz: multiple choice, matching, and true/false
  3. Fix a weak answer: the user rewrites a flawed answer, and Claude grades it
  4. 60-second voice answer: the user answers a real interview question aloud, and Claude grades it
- **Progress without accounts:** an anonymous ID (UUID) is generated in the browser and kept in `localStorage`. Mastery per concept is saved in Supabase against that ID.
- **Built on existing content:** concept cards come from `wiki-knowledge.js`; quiz questions reuse and extend the Question Deconstruction format; voice prompts and rubrics come from `pm-questions-comprehensive.json`.
- **Framework unification (one-time content fix):** see below.

### Non-goals (v1)

| Not building | Why |
|---|---|
| User accounts or login | Anonymous ID is enough to prove the lesson format works. Accounts add auth flows and support cost. |
| Streaks, XP, leagues, hearts | Gamification is a v2 question, and only worth it once completion data shows whether people come back. |
| Units other than Metrics | Validate the format on one unit first. Metrics has the best existing content: 4 frameworks and 10 questions. |
| Changes to Practice mode behavior | Practice is working and stays as-is. The only Practice-side change is the text fix below. |
| Practice score tracking | Needed for success metric 2, so deferred to v2 together with it. |
| Cross-device progress | Progress lives with one browser's anonymous ID. Clearing site data resets it. Accepted for v1. |

### Framework unification (one-time content fix)

The Metrics frameworks are defined two different ways in the codebase. Lessons will teach the **wiki definitions**, which `wiki-knowledge.js` and `pm-questions-comprehensive.json` already agree on and which the AI grader is already given:

| Framework | Canonical (wiki) definition |
|---|---|
| TROPIC | **T**ime · **R**egion · **O**ther launches · **P**latform · **I**ndustry · **C**annibalization, plus the AI layer (model update, latency, hallucination) |
| C-NABGT | **C**larify scope · **N**orth Star · **A**ctionable secondary metrics · **B**usiness metrics · **G**uardrails · **T**racking plan |
| GAME | **G**oals · **A**ctions · **M**etrics · **E**valuations |
| SIGNAL (metrics) | **S**cope · **I**dentify goal · **G**enerate metrics · **N**egative guardrails · **A**nchor on North Star · **L**ayer breakdowns |

To match, align these copies to the wiki text. This changes **only text**, not behavior:
- `voice-interface.html`: the Metrics & Analytics Study card (GAME, TROPIC and C-NABGT rows, plus an "AI layer" row as the wiki says to always add it) and the reveal text on the ChatGPT DAU deconstruction question. There is no separate frontend copy of the guided steps: guided mode receives its steps from the server, so the `ai-interviewer.js` change below covers it.
- `ai-interviewer.js`: `FRAMEWORK_STEPS_MAP['Metrics & Analytics']` (the guided-mode tracker steps)

`FRAMEWORK_STEPS_MAP['Product Execution']` stays as it is. It's a deliberately different execution variant that only reuses the TROPIC letters.

**Note:** this is the one place v1 touches Practice-mode files. Guided-mode Metrics sessions will show the wiki step names instead of the old ones. The `[STEP:X]` letters (T, R, O, P, I, C) don't change, so the tracker parsing is unaffected.

### Lesson outline (Metrics unit)

| # | Lesson | Framework | Core concepts (mastery tracked per concept) | Voice question (from the question bank) |
|---|---|---|---|---|
| 1 | Define success | GAME | `goals-before-metrics`, `actions-to-metrics`, `evaluate-and-pick` | Lesson-specific: Spotify Discover Weekly success (`met002` was dropped, see open items) |
| 2 | North Star and guardrails | SIGNAL | `north-star-absolute-count`, `guardrail-metrics`, `override-rate-trust` | Lesson-specific: AI email-thread summaries (`ai-metrics-002` was dropped, see open items) |
| 3 | The full metrics answer | C-NABGT | `clarify-scope`, `secondary-vs-business`, `tracking-plan` | Lesson-specific: AI trip planner success (`ai-metrics-001` was dropped, see open items) |
| 4 | Diagnose a metric drop | TROPIC | `rule-out-boring-causes`, `segment-the-drop`, `cannibalization` | `met005`: LinkedIn DAU/MAU drop |
| 5 | The AI layer | TROPIC + AI metrics | `ai-layer-in-tropic`, `ai-quality-metrics`, `cost-and-latency` | `ai-metrics-003`: hallucination rate doubled |

15 concepts in total. Lesson content (cards, quiz items, weak answers) is authored as static JSON, not generated at runtime, so content is reviewable and costs nothing per view.

### Lesson flow and mastery

**Step 1, Concept cards (3–5 per lesson):** one idea per card, at most about 60 words, with a concrete example. Each card is tagged with one concept ID. Viewing cards doesn't change mastery.

**Step 2, Quiz (6–8 items):** a mix of multiple choice, matching (for example, match a TROPIC letter to its meaning), and true/false. Each item is tagged with a concept ID. Feedback is immediate: right or wrong, plus a one-line explanation. A wrong answer doesn't block progress.

**Step 3, Fix a weak answer (1 item):** the user sees a flawed answer, for example a metrics answer with no guardrail. They rewrite the weak part in a text box (at most 600 characters). Claude Haiku grades it against a 3–4 item checklist for the lesson's concepts. The weak parts are **not marked before the first attempt**: spotting what's wrong is part of the exercise. The markers appear with the first grading result.

**Step 4, 60-second voice answer:** the user answers the lesson's voice question aloud. The timer is a soft limit: recording stops at 60 seconds. The transcript is graded by Claude Sonnet using the existing `analyzeAnswer` rubric flow. The rubric comes from the question bank when `voice.questionId` is set, or from the lesson's own `evaluationRubric` and `keyPoints` when it's `null`. Mastery comes from the lesson's `conceptChecks`, not from the rubric's key points, because question-bank key points aren't written against Learn concepts.

**Mastery model (per concept, 0–100):**
- Each graded item tagged with a concept updates that concept's score:
  - Quiz: correct +20, wrong −10 (score never goes below 0)
  - Fix-the-answer checklist item: met +25
  - Voice answer key point covered: +25
- Capped at 100. A concept is **mastered** at ≥ 70.
- **Applied-skill gate on mastery:** a concept can only reach 70 or above once the user has met it in the fix step or the voice step (a met checklist item or a covered key point for that concept). Until then its score is capped at 69, however many quiz answers are correct. Recognizing the right answer isn't the same as producing one.
- A lesson is **complete** when the user finishes all 4 steps. Completion doesn't depend on mastery (no gates).
- The lesson map shows mastery so users can see their weak concepts. Nothing is locked.

### Architecture

**Layer ownership**
| Layer | Owns |
|---|---|
| Browser | Anonymous ID (`localStorage`, key `learn_anon_id`), lesson UI state, speech-to-text (same Web Speech API as Practice) |
| Express server | Lesson content serving, grading calls to Claude, all Supabase reads and writes, rate limiting, input validation |
| Supabase | `learners`, `concept_mastery`, `lesson_progress` tables |
| Static JSON | Lesson content: `learn/metrics-unit.json` (cards, quiz, weak answers, concept tags). Schema below. |

**Secrets:** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are **server-only**. The browser never talks to Supabase directly, so the service-role key never ships to the client. Both must be added to `.env.example` and the README. New dependency: `@supabase/supabase-js`.

**Anonymous ID trust:** the anonymous ID is a client-generated UUID, so anyone can make one up. That's acceptable because it only identifies lesson progress, not a person or anything sensitive. The server validates the UUID format on every request.

**New API routes** (all under `/api/learn/*`, separate from `/api/interview/*`):

| Route | Input | Output | Claude? |
|---|---|---|---|
| `GET /api/learn/unit/metrics` | — | Lesson list with card, quiz and weak-answer content (quiz answers included; the quiz is graded client-side because it isn't sensitive) | No |
| `GET /api/learn/progress?anonId=` | UUID | `{ lessons: [{id, status}], concepts: [{id, mastery}] }` | No |
| `POST /api/learn/quiz-result` | `{ anonId, lessonId, results: [{itemId, correct}] }` | Updated mastery for the affected concepts | No |
| `POST /api/learn/grade-fix` | `{ anonId, lessonId, answer }` (at most 600 characters) | `{ checklist: [{concept, met, note}], feedback }` | Haiku |
| `POST /api/learn/grade-voice` | `{ anonId, lessonId, transcript }` (at most 2,000 characters) | Existing `analyzeAnswer` JSON shape plus `conceptChecks` results and mastery updates | Sonnet |
| `POST /api/learn/complete` | `{ anonId, lessonId }` | `{ unitComplete: boolean }` | No |

**Validation:** `anonId` must be a UUID v4. `lessonId` must be one of the 5 known IDs. `itemId` must exist in the lesson content. Free text is length-capped, run through an injection-pattern sanitizer, and wrapped in `<user_input>…</user_input>` before it reaches a prompt. **The sanitizer doesn't exist yet and is new work.**

**Rate limiting:** both grading routes are limited per IP and per `anonId` (proposed: 20 grading calls per hour per anonymous ID, 40 per hour per IP). **No rate limiter exists in the app today.** The only limit is the demo-mode counter, so this is new work. Demo mode applies the same way as in Practice when `ANTHROPIC_API_KEY` is missing.

**Errors:** all `/api/learn/*` routes use a new `safeError()` helper (none exists yet). Status codes: 400 validation, 404 unknown lesson, 429 rate limit, 500 generic. If Supabase is unreachable, lessons still work and progress shows a "not saved" warning. Grading failures let the user retry or skip the step.

**Before deploy: Practice routes need the same protection.** The existing `/api/interview/*` routes that call Claude (`start`, `respond`, `evaluate`, `analyze-answer`) have no rate limiter, `safeError()` or sanitizer either. The same three helpers built for Learn mode must be applied to those routes before the app is deployed. This is a protection-only change: it doesn't alter Practice behavior for normal use, so it's compatible with the "no Practice changes" non-goal.

**Model and cost:**
- Fix-a-weak-answer uses `claude-haiku-4-5-20251001` (short checklist, high volume).
- Voice grading uses `claude-sonnet-4-6`, the same model and rubric as Practice analysis.
- Both system prompts use prompt caching (the wiki framework block is over 500 tokens).

**Prompts:** the grading prompts and their exact JSON output contracts are written and tested on 3–5 sample answers **before** the route code, and stored under `/prompts/` with a `CHANGELOG.md`.

### Lesson content schema (`learn/metrics-unit.json`)

```
unit:     { unitId, title, version, concepts[], lessons[] }
concept:  { id, lessonId, name }
lesson:   { id, number, title, framework, conceptIds[], cards[], quiz[], fixWeakAnswer, voice }

card:     { id, conceptId, title, body, example, source }
quiz item (all): { id, type, conceptId, explanation }
  multiple-choice: + { prompt, options[], answerIndex }
  true-false:      + { statement, answer: boolean }
  matching:        + { prompt, pairs[{ left, right }] }
fixWeakAnswer: { id, question, weakAnswer, weakParts[], instructions, maxChars, checklist[] }
  weakPart:      { text, label }
  checklist item:{ id, conceptId, criterion }
voice:    { questionId | null, question, timeLimitSec, evaluationRubric?, keyPoints?, conceptChecks[] }
  conceptCheck:  { conceptId, criterion }
```

Field notes:
- **`source`** (card): where the card's claim comes from in `wiki-knowledge.js`, for example `"wiki: GAME (E); evaluation criterion 5"`. It's for content review and isn't shown to users.
- **`weakParts`** (fix step): exact substrings of `weakAnswer`, each with a short label explaining the flaw. They're hidden until after the first attempt (see Lesson flow).
- **`maxChars`** (fix step): the character limit for the rewrite, 600. The server enforces the same limit.
- **`conceptChecks`** (voice step): one GAME-style check per lesson concept. These, not the rubric, drive mastery updates.
- **`evaluationRubric` and `keyPoints`** (voice step): required when `questionId` is `null`, and in the same shape as `pm-questions-comprehensive.json` so the `analyzeAnswer` flow can grade them. When `questionId` is set, they come from the question bank.

Validation rules (checked before committing content): unique IDs; every `conceptId` exists in `concepts`; `answerIndex` is in range; every `weakParts[].text` appears in `weakAnswer`; 3–5 cards of at most about 60 words each (body plus example); 6–8 quiz items.

### Data model (Supabase)

```sql
learners          (anon_id uuid primary key, created_at timestamptz default now())

concept_mastery   (anon_id uuid references learners, concept_id text, score int check (score between 0 and 100),
                   updated_at timestamptz, primary key (anon_id, concept_id))

lesson_progress   (anon_id uuid references learners, lesson_id text,
                   status text check (status in ('started','completed')),
                   started_at timestamptz, completed_at timestamptz,
                   primary key (anon_id, lesson_id))
```

Row-level security is enabled, with no public policies. Only the server's service role reads and writes.

**Unit completion rate query:** count of `anon_id` with 5 completed lessons ÷ count of `anon_id` with lesson 1 started.

### Build phases

Each phase ends with the server starting cleanly and the phase verified in the browser.

1. **Content and framework unification:** fix the framework text, then write `learn/metrics-unit.json` for all 5 lessons.
2. **Prompts:** write and test the fix-answer and voice grading prompts in `/prompts/`.
3. **Learn UI with static content only:** lesson map, cards, and quiz, with no backend progress.
4. **Supabase and progress routes:** anonymous ID, mastery, and lesson status.
5. **Grading routes:** sanitizer, `safeError()`, and rate limiter first, then the fix-a-weak-answer and voice answer routes and their error states.

### Risks and open items

- **Lesson content quality is the product.** Authoring 5 lessons of cards, quiz items and weak answers is the largest piece of work, and it needs a review pass before Phase 3.
- **Speech recognition** uses the Web Speech API (Chrome and Edge only), the same limitation as Practice. Learn shows a text fallback for step 4 in unsupported browsers.
- **Anonymous ID loss:** clearing site data resets progress. This is accepted and stated in the UI.
- **Practice routes are unprotected:** see "Before deploy" under Architecture. This blocks deployment, not the Learn mode build.
- **Question bank North Stars are weaker than what lesson 2 teaches:** lesson 2 teaches "prefer a count for the North Star, because a ratio can rise when its denominator shrinks (for example, users leaving)". It also says ratios are fine as supporting metrics. Several question-bank sample answers use a ratio North Star **with no count alongside it and no caveat**. That makes them weaker answers than lesson 2 teaches, not wrong ones:
  - `met002` (Facebook Stories): "daily story viewers / DAU". It was dropped as lesson 1's voice question, which now uses its own question.
  - `met001` (Amazon Prime): "12-month retention rate".
  - `met004` (Google Maps): "navigations completed per DAU".
  - `ai-metrics-002` (Snap LLM feature): "D7 feature retention, the percentage of users who…". It was dropped as lesson 2's voice question, which now uses its own question.
- **`ai-metrics-001` (ChatGPT) conflicts with lessons 1–2.** It was dropped as lesson 3's voice question, which now uses its own question. Its North Star (a count) and guardrails are fine. The problems:
  - **Override rate is defined wrongly:** the tracking plan defines it as "explicit edit/copy-without-edit behavior". Copying without editing is acceptance, not an override. Lesson 2 defines override rate as correcting or dismissing the output.
  - **The rubric uses the strict ratio rule:** the "excellent" level requires "absolute count (not ratio)", and a key point says the North Star "must be an absolute count, not an average or ratio". Lesson 2 teaches the softer "prefer a count".
  - **No stated goal:** the Clarify step covers users and time window, but not what ChatGPT is trying to achieve, which lesson 1 puts first.

  Fixing these is a Practice content change (the sample answer and rubric are used in Practice grading), so it's tracked here, not done in v1.

  Practice users who open the "One strong approach" panel on these questions see a ratio North Star with no caveat. Adding a count or a one-line caveat to those sample answers is a Practice content change, so it's tracked here, not done in v1.

### v2 direction (not in MVP)

v2 connects Practice and Learn so each one feeds the other:

1. **Practice stores structured scores per concept.** Practice answers are graded into the same concept IDs Learn uses (for example `guardrail-metrics`, `rule-out-boring-causes`) and saved in Supabase against the anonymous ID. This needs a structured score from Practice in place of today's free-text "score out of 5".
2. **A planner recommends Learn lessons from weak Practice answers.** When a Practice answer scores low on a concept, the planner points the user to the lesson that teaches it, for example "Your guardrails were thin. Try lesson 2: North Star and guardrails."
3. **Score improvement is tracked.** Per-concept Practice scores before and after the related lesson give success metric 2, "Practice scores improve after a lesson", which v1 defers.

Before building, v2 needs its own PRD, since it changes Practice mode behavior, which v1 rules out.

**v2 open items:**
- **Framework mismatch between Practice and Learn:** Practice's "Show Framework Hints" panel (the `FRAMEWORKS` map in `voice-interface.html`) teaches **DIGS** for Metrics, and every `met*` question in `pm-questions-comprehensive.json` is tagged `DIGS`. Learn teaches TROPIC and C-NABGT. Align the frameworks and the question-bank tags **before building the v2 planner**, because the planner maps weak Practice answers to Learn concepts and needs both modes to use the same framework names.

---

## Part 2: UI Spec

### Entry point

The landing screen gets a mode choice above the existing 3-step progression:

- **Learn** (new) opens the Metrics lesson map. This is the **primary** button, since new users need to learn first.
- **Practice** opens the existing mock interview setup. This is a **secondary** (ghost) button.

The existing Study Frameworks and Question Deconstruction screens stay reachable as they are today. Learn mode reuses their content, and the screens themselves aren't removed.

### Screens

#### 1. Lesson map

**Layout:** a vertical list of 5 lesson rows in the existing card style. Each row shows the lesson number, title, framework badge, status, and a mastery bar (average of the lesson's 3 concepts).

**Primary action:** "Start" or "Continue" on the next lesson that isn't complete. Every lesson row stays tappable (no gates).

**States:**
| State | What shows |
|---|---|
| Loading | Skeleton rows with "Loading your progress…" |
| Empty (new learner) | All lessons "Not started", lesson 1 highlighted, plus the line "Progress is saved in this browser" |
| Progress loaded | Status labels **"Not started" / "In progress" / "Complete ✓"** (text and icon, not color alone) and mastery bars with a numeric % label |
| Progress unavailable | Lessons still listed, plus the banner "Couldn't load your progress. You can still do lessons, but they may not save." |
| Unit complete | A completion card: "Metrics unit complete", a list of weak concepts (under 70) with links to their lessons, and a secondary link to Practice |

#### 2. Lesson: concept cards

**Layout:** one card at a time, centered, about 60 words maximum, with a concrete example in a callout. A step indicator at the top reads "Cards · Quiz · Fix · Speak" with the current step named in text.

**Primary action:** "Next" (on the last card: "Start quiz"). "Back" is a ghost button.

**States:** loading (skeleton card), content.

#### 3. Lesson: quiz

**Layout:** one question at a time with item-type-specific controls:
- **Multiple choice:** 3–4 full-width option buttons
- **True/false:** two large buttons
- **Matching:** a two-column list. Tap a left item, then a right item, to pair them. Each pair shows a number badge so pairing isn't conveyed by color alone. Fully keyboard operable with Tab plus Enter or Space.

**Primary action:** "Check", then after feedback "Continue".

**States:**
| State | What shows |
|---|---|
| Unanswered | "Check" disabled until a selection is made |
| Correct | "✓ Correct" plus a one-line explanation |
| Incorrect | "✗ Not quite" plus the correct answer and the explanation |
| Saving error | Quiz continues, plus the inline note "Result not saved" |

#### 4. Lesson: fix a weak answer

**Layout:** a labeled panel holding the weak answer, shown **unmarked** before the first attempt. Below it, a labeled textarea "Your improved version" with a character count (600 maximum). After the first grading result, each `weakParts` span is visually marked in the panel with its text label (for example "Weak part: No pick, no reason"), so color isn't the only signal. The markers stay visible on any retry.

**Primary action:** "Get feedback". There is also a ghost "Skip" link.

**States:**
| State | What shows |
|---|---|
| Empty | Button disabled until at least 20 characters are entered |
| Grading | Button shows "Grading your answer…" with a spinner. The textarea is read-only. |
| Result | The weak-part markers appear in the answer panel. Below them: a checklist with ✓ or ✗ plus a note per concept, and 1–2 sentences of feedback. Buttons: "Continue" (primary) and "Try again" (ghost). |
| Rate limited | "You've hit the practice limit for now. Try again in a bit, or skip this step." |
| Error | "Something went wrong grading that. Try again or skip." |

#### 5. Lesson: 60-second voice answer

**Layout:** the question in large text, a circular 60-second countdown, and a mic button (at least 44×44 px). A live transcript appears below as the user speaks.

**Primary action:** "Start speaking". While recording it becomes "Stop". Recording stops automatically at 0:00.

**States:**
| State | What shows |
|---|---|
| Ready | The question, "You have 60 seconds", and the mic button |
| Recording | The countdown, the live transcript, the "Recording" label with a red dot (text, not color alone), and the Stop button |
| Too short | If the transcript is under 15 words: "That was a bit short. Want to try again?" |
| Grading | "Scoring your answer against the rubric…" |
| Result | Score (1–5) with its label, key points covered or missed, and one improvement tip. Buttons: "Finish lesson" (primary) and "Try again" (ghost). |
| No mic or unsupported browser | A text fallback: "Type your answer instead", using the same grading |
| Rate limited or error | Same copy pattern as the fix-a-weak-answer step |

#### 6. Lesson complete

**Layout:** the lesson title, concepts with before → after mastery, and a one-line takeaway.

**Primary action:** "Next lesson". "Back to map" is a ghost button.

### Visual and interaction rules

- Reuse the existing `voice-interface.html` styles (card radius, colors, type scale). No new design system.
- One primary action per screen, as listed above. Every other action is ghost or secondary.
- Every async action shows a labeled loading state. There are no blank screens.
- Tap targets are at least 44×44 px.
- Accessibility: semantic `<button>`, `<label>` and `<main>` elements; focus moves to each new card or question heading; correct and incorrect states always pair color with icon and text; full keyboard operation for matching.

### Files expected to change (for planning)

| File | Change |
|---|---|
| `voice-interface.html` | Learn entry point, the Learn screens, and the framework text unification |
| `ai-interviewer.js` | Framework text unification. The grading helpers reuse `analyzeAnswer`. |
| `server.js` | New `/api/learn/*` routes, rate limiter, `safeError()`, sanitizer, Supabase client (lazy singleton) |
| `learn/metrics-unit.json` (new) | Static lesson content |
| `prompts/` (new) | Grading prompts plus `CHANGELOG.md` |
| `.env.example`, `README.md` | Supabase environment variables |
| `package.json` | `@supabase/supabase-js` |
