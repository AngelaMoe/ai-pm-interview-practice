# Prompt changelog

Each version records what changed, why, and its eval results. Versions are immutable: changes go in a new file (`*.v2.md`), not an edit to an evaluated version. Eval targets and method are in `docs/grading-plan.md`.

## fix-grader v1 / voice-grader v1 (2026-10-12)

**Status:** draft. Not yet evaluated.

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
