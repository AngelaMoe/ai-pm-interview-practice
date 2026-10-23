# Proposal: lesson 5 voice rubric, content v2

**Status:** proposal, **not applied**. `learn/metrics-unit.json` is still at content version 1.
**Raised:** 2026-10-23, from the held-out spot-check of the locked grader.
**Decision needed from:** Angela.

---

## Problem

Lesson 5's voice rubric ("Task completion rate for your AI customer-support chatbot fell from 70% to 58% this month. How would you investigate?") assumes every answer starts with TROPIC. An answer that investigates through **AI quality signals instead** fits no band cleanly:

| Band | Current wording |
|---|---|
| 5 excellent | Rules out boring causes with TROPIC, adds the AI layer without being prompted, separates model-layer from application-layer causes, confirms with a before-and-after comparison, and checks quality, latency and cost signals |
| 4 good | Adds the AI layer and checks quality signals, but doesn't separate model from application layer, or skips latency and cost |
| **3 fair** | **Standard TROPIC checks only, with no AI layer** |
| 1–2 poor | Jumps to a fix, such as retraining or replacing the model, with no investigation |

**Evidence:** one held-out answer split task completion by question type ("if we started getting harder questions the rate drops even if nothing broke"), and checked re-query rate and requests for a human agent. That's real, systematic investigation, but with no TROPIC checks and no AI layer.
- **The labels** (Claude, and independently Fable 5.1) scored it **3**: more than "jumps to a fix".
- **The locked grader** scored it **2** on all 3 runs. It read band 3 literally ("TROPIC checks") and found no TROPIC.
- **The concept checks were all correct**, so mastery was unaffected. Only the 1–5 score is in question.

This is a rubric gap, not a grader error: both readings follow the words.

## Proposed change (band 3 only)

| Band | Proposed wording |
|---|---|
| 3 fair | **Some systematic investigation (TROPIC checks, or AI quality signals such as re-query rate or a split by question type), but no AI layer** |

Bands 5, 4 and 1–2 are unchanged.

**Why only band 3:** band 4 already requires the AI layer, and band 1–2 already covers "no investigation". Band 3 is the one place where an investigation with no AI layer has nowhere to go if it isn't TROPIC.

**Effect on existing labels:** none of the lesson 5 labels change.

| Case | Label | Under the proposed wording |
|---|---|---|
| "Standard TROPIC, no AI layer" (iteration) | 3 | still 3 (the TROPIC branch) |
| "Quality signals, no AI layer" (held-out) | 3 | still 3, now explicitly (the quality-signals branch) |
| Model-layer-only answer with cost and latency (iteration) | 3 | still 3. It has an AI layer but no quality signals, so it stays between bands 3 and 4, as Angela ruled in review 8 |

## Process if approved

This changes lesson content that the locked voice grader reads, so it can't be applied silently.
1. **Bump content:** `metrics-unit.json` `version` → 2, with the new band 3 text for lesson 5 only.
2. **Re-run the eval on the lesson 5 voice cases** with the locked prompts and model unchanged. Iteration cases first, then the held-out lesson 5 voice cases as a regression check.
   - **About reusing the held-out set:** it has already been run once, so this is a regression check for a content change, not tuning. If the scores move in a way that tempts further changes, write fresh lesson 5 cases instead of iterating on the held-out ones.
   - **Cost:** about $0.15 (lesson 5 voice cases only, Sonnet 5.5).
3. **Accept** if the held-out "quality signals, no AI layer" answer moves from 2 to 3 and no other lesson 5 score or concept check changes.
4. **Record:** an entry in `prompts/CHANGELOG.md` (content v2 is an input change, not a prompt change) and in the PRD.

## Not proposed

- **Changing the grader prompt:** the prompt correctly tells the grader to follow the question's rubric. The fix belongs in the rubric.
- **Changing other lessons' rubrics:** the spot-check found no similar gap elsewhere. The other lesson rubrics can be audited the same way before any future content version.
