# Prompt changelog

Each version records what changed, why, and its eval results. Versions are immutable: changes go in a new file (`*.v2.md`), not an edit to an evaluated version. Eval targets and method are in `docs/grading-plan.md`.

## fix-grader v2 / voice-grader v2 (2026-10-23)

**Status:** evaluated on the iteration set (run `20261023-085635-iteration-v2`, 54 cases × 3 runs). **Voice v2 meets every target on both Sonnets. Fix v2 on Haiku misses** (see below). Not yet run on the held-out set.

**Changes (approved by Angela after the v1 baseline):**
- **A1, keyed output:** checklist items, concept checks and key points are now one required property each, instead of list entries. A grader can no longer grade an item twice or skip one. (v1: Haiku duplicated an item in 7 of 81 fix grades, so they were lost.) Each property's description carries its criterion.
- **A2, evidence matching tolerates speech disfluencies:** filler sounds and stutters or restarts are removed from both the quote and the transcript before matching. Paraphrase, reordering and partial words are still rejected. (v1: 3 correct quotes were rejected because Sonnet 5.5 tidied "find find" to "find".)
- **A3, eval metrics:** failed grades now count as wrong in the agreement metrics, and ordering is checked against the labels' own order. (The v1 metric assumed strong > borderline > weak, but the rubric rates lesson 5's "weak" answer fair.)
- **B4, fix prompt:** new rule that every part of a multi-part criterion must be present ("says why", "how often", "separately", "for each").
- **B5, voice prompt:** `too_short` removed from the prompt and the model's output. Code now measures words of substance (fillers and stutters removed) and, under 40, sets the flag and caps the score at 2. (v1: both Sonnets judged dense 66–67-word answers "too short" while scoring them 3–4, and one grade was lost.)
- **Label decision:** a single boring-cause check meets "rules out boring causes", because the criterion uses "or". The label was unchanged.

**Eval results, iteration set (v1 → v2):**

| Target | Haiku fix | Sonnet 4.6 voice | Sonnet 5.5 voice |
|---|---|---|---|
| False "met" ≤ 5% | 5.9 → **10.9 ✗** | 2.2 → 0 | 0 → 0 |
| False "not met" ≤ 10% | 2.7 → 2.3 | 0 → 0 | 8.3 → 5.6 |
| Agreement overall ≥ 90% (v2 counts failures as wrong) | 95.3 → 92.6 | 98.8 → 100 | 96.3 → 97.5 |
| Agreement, borderline | 83.8 → 82.1 | 95.2 → 100 | 90.5 → 90.5 |
| Score exact ≥ 60% / within ±1 ≥ 90% | n/a | 81 → 70 / 100 | 64 → 69 / 100 |
| Known negatives, nothing met | 36/36 → **30/36 ✗** | 30/30 | 30/30 |
| Evidence verified ≥ 98% | 100 → 100 | 100 → 100 | 97.1 → 100 |
| Valid output after retry | 91.4 → 100 | 98.8 → 100 | 100 → 100 |
| Cost per call · median latency | $0.0035 · 3.9s | $0.0086 · 7.6s | $0.0073 · 4.5s |

**Why fix v2 misses on Haiku:** all of its errors are leniency, and the new multi-part rule didn't change them:
- **Pick with no reason:** "the second matters most" still accepted (3 of 3 runs).
- **Logging with no frequency:** still accepted as a tracking plan (3 of 3).
- **Bare "revenue":** accepted as a separate business metric in 3 answers.
- **New in v2, goals that aren't goals for the button:** "more people love the app" and "get people reading more", the second stated after the metrics, both accepted as goals.

On the same kinds of criteria in the voice step, both Sonnets made zero false "met" calls.

## fix-grader v1 / voice-grader v1 (2026-10-12)

**Status:** evaluated on the iteration set, 2026-10-23 (run `20261023-075119-iteration-v1-baseline`). Superseded by v2. Results are in the v2 table above.

**Summary:**
- **Structured outputs on every model**, using the schemas in `learn/grading/schemas.js`.
- **The voice schema puts concept checks and key points before the score**, so the model decides those first and scores afterwards. (Fields are generated in schema order.)
- **`met` requires a verbatim quote** (`evidence`), which the server verifies, with a separate free-text `reason`. Based on the step 1 probe, where models paraphrased quotes whenever evidence and explanation shared a field.

**Grading rules (both prompts):**
- **Literal criteria:** partly doing something isn't met.
- **Examples are illustrations:** "such as …" in a criterion isn't a requirement.
- **Substance over vocabulary:** framework words without the idea earn nothing.
- **Length earns nothing.**
- **Unchanged weak answer:** nothing met.
- **Empty, "I don't know", or answering a different question:** nothing met.

**Voice only:**
- **Transcription errors are forgiven, missing content isn't:** fillers, missing punctuation and misheard words are read past, but content must actually be there.
- **60-second expectations:** judged against what a strong answer can cover in about 120–170 words.
- **Score 2 vs 1:** 2 for some relevant content, 1 for almost nothing usable.
- **`too_short`:** set when there's under about 40 words of substance. Concept checks and key points are still graded honestly, with evidence, because a short answer can meet checks. The score is capped at 2, and `validateVoiceGrade()` rejects a `too_short` grade scoring above 2. An eval case covers a short but correct answer.

**Security:**
- **Learner text is wrapped in `<user_input>`** and treated as data.
- **Embedded instructions are ignored** and flagged as `injection_attempt`.
- **Code strips `<user_input>` tags** from learner text before rendering, so it can't break out of the wrapper.

**Caching:**
- **Voice:** the system prompt (rules + wiki block) is identical for every lesson and cached.
- **Fix:** not cached, because the prompt is under Haiku 4.5's 4,096-token minimum.

**Eval results:** pending (grading plan step 7).
