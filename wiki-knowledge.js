// wiki-knowledge.js
// Compiled wiki framework reference — injected into both system prompts.
// Source: Angela's Obsidian wiki (ai-pm-interview app, June 2026).
// This block is used with cache_control: ephemeral in the API call so it only costs
// full tokens on the first request of a session.

export const WIKI_FRAMEWORKS_BLOCK = `
## AI PM Interview Frameworks Reference

### STAR+M — Behavioral questions
Every behavioral answer must include a **Metric (M)**:
S = Situation (scene), T = Task (your specific role), A = Action (what YOU did — never "we"), R = Result, M = Metric that proves the result (number, %, latency, revenue impact, etc.).
Answers without an M are incomplete. Push candidates to quantify.
Anti-patterns: starting with "we did X" (should be "I did X"), ending without a measurable outcome, no self-reflection.

### TROPIC — Metric drop diagnosis
Rule out boring causes BEFORE assuming a product problem:
T = Time (sudden vs. gradual?), R = Region (global or one market?), O = Other launches (something else ship at the same time?), P = Platform (iOS vs Android vs desktop?), I = Industry (affecting competitors too?), C = Cannibalization (internal product absorbed traffic?).
**AI-specific layer (always add this):** Did the model update silently? Did inference latency spike? Did hallucination/error rate rise causing users to disengage?
Anti-patterns: jumping to a product hypothesis without ruling out data pipeline errors or seasonal effects first.

### GAME — Standard metrics definition
G = Goals (what is the product trying to accomplish?), A = Actions (what can users do?), M = Metrics (what can you count for each action?), E = Evaluations (which metrics matter most, and why?).

### SIGNAL — AI metrics definition (extends GAME)
S = Scope (product, users, time window), I = Identify the goal, G = Generate candidate metrics, N = Negative guardrails (what must NOT fall?), A = Anchor on North Star, L = Layer breakdowns (by user type, query type, confidence score).
North Star must be an **absolute count** (e.g., weekly active users completing AI tasks), never an average or ratio alone.
Key AI metrics: task completion rate, user override rate, hallucination rate, re-query rate, time-to-first-token, cost-per-query.
User override rate (how often users correct/dismiss AI outputs) is a more honest trust signal than accuracy metrics.

### C-NABGT — Full AI metrics answer structure
C = Clarify scope, N = North Star metric, A = Actionable secondary metrics (2-3), B = Business metrics (revenue, cost, unit economics), G = Guardrails, T = Tracking plan (how are these actually collected — human raters? automated evals? what cadence?).
The T step separates strong from weak answers. "We'd track engagement" is unacceptable; a data scientist must be able to write the SQL query immediately.

### AI-CUPS-PDM — AI product sense / improvement
AI = Clarify the AI layer (what does the model actually do?), C = Clarify scope, U = User segmentation (3-4 distinct types), P = Problems (top 3-5 for chosen segment), S = Solutions (at least 3), P = Prioritize, D = Design (user-experience level description), M = Metrics.
Anti-patterns: skipping clarification of what the AI actually does, designing for "all users", proposing AI without justifying why AI is better than a non-AI solution.

### 10-Step Design Framework — AI product design
1. Clarifying Questions (2-4), 2. User Segmentation (name 3-4 types, pick 1 — say why), 3. Problem Identification, 4. Problem Prioritization, 5. Creative Solution Generation (3+ options), 6. Prioritization with Criteria (user value, feasibility, safety, business value), 7. Combine & Design, 8. Core Flows: **happy path + AI failure path + onboarding path** (most candidates only do happy path — push them on the other two), 9. Mission Connection + Risks (raise proactively, not when asked), 10. Compelling Narrative (2-3 sentences a non-technical exec can repeat).
Anti-patterns: #2 from list = "feature soup" (10 features, shallow depth); #4 = no safety mention; #5 = not explaining WHY AI; #7 = no narrative at the end.

### UPS-PPPB — Vibe coding / live prototyping
U = User (name them specifically), P = Problem (specific, not generic), S = Simplest solution, P = PRD (3-sentence done definition), P = Prompt (quality of AI input determines quality of output), P = Parallel (run components simultaneously), B = Backend (think data flow before it breaks).
During loading/generation: narrate production readiness considerations, what you'd build next, latency/token tradeoffs.

## Evaluation criteria to apply across ALL question types
1. Structure — is a framework being used? (name it explicitly in feedback: "You applied TROPIC well but skipped the AI-specific layer")
2. User focus — specific user named, not "everyone"
3. Business acumen — metrics mentioned, tradeoffs acknowledged
4. AI depth — failure modes, trust-building, model vs. application layer distinction
5. Recommendation clarity — landed somewhere specific, not "it depends"
6. Quantification — rough math beats no math

## What strong candidates do that weak ones don't
- Raise AI failure paths and safety risks WITHOUT being asked
- Include the M in STAR+M (the metric that proves the result)
- Say "I" not "we" in behavioral answers
- Add the AI layer in TROPIC (model update? drift? hallucination spike?)
- Distinguish between model layer and application layer when proposing fixes
- End every answer with a crisp recommendation
`;
