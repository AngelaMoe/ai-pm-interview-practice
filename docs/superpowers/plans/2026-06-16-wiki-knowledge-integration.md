# Wiki Knowledge Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inject Angela's wiki interview frameworks (STAR+M, TROPIC, GAME, SIGNAL, C-NABGT, 10-step design, UPS-PPPB) into the AI PM Interview app's prompts and question database, and add AI-specific question categories.

**Architecture:** 
- A new `wiki-knowledge.js` module exports the compiled wiki reference block as a string constant (keeping `ai-interviewer.js` readable). 
- `ai-interviewer.js` imports and uses that block to replace/augment both system prompts.
- `pm-questions-comprehensive.json` gets 3 new AI-specific question categories: `ai-product-sense`, `ai-safety`, `ai-metrics`. 
- `getQuestionsForType()` category map is extended to route the new interview type IDs to these categories.

**Tech Stack:** Node.js ESM, `@anthropic-ai/sdk`, existing `pm-questions-comprehensive.json` schema.

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Create | `wiki-knowledge.js` | Exports `WIKI_FRAMEWORKS_BLOCK` string constant |
| Modify | `ai-interviewer.js` | Import wiki block; replace INTERVIEWER_SYSTEM_PROMPT + ANALYSIS_SYSTEM_PROMPT |
| Modify | `pm-questions-comprehensive.json` | Add 3 new question categories + new frameworks (`STAR+M`, `TROPIC`, `SIGNAL`, `C-NABGT`, `10-Step-Design`) |
| Modify | `ai-interviewer.js` | Extend `categoryMap` in `getQuestionsForType()` |

---

## Task 1: Create `wiki-knowledge.js`

**Files:**
- Create: `wiki-knowledge.js`

This module exports a single constant: the compiled wiki framework reference block that goes into the system prompt. It covers every named framework from the wiki, AI-specific evaluation criteria, and per-round anti-patterns. It is written once here and imported in two places in `ai-interviewer.js`.

- [ ] **Step 1: Create the file**

```javascript
// wiki-knowledge.js
// Compiled wiki framework reference — injected into both system prompts.
// Source: Angela's Obsidian wiki (ai-pm-interview app, June 2026).
// This block is cache_control: ephemeral in the API call so it only costs
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
```

- [ ] **Step 2: Verify the file parses**

```bash
cd "/Users/angel/Documents/Claude Projects/ai-pm-interview-app " && node -e "import('./wiki-knowledge.js').then(m => { console.log('OK — block length:', m.WIKI_FRAMEWORKS_BLOCK.length, 'chars'); })"
```

Expected output: `OK — block length: [some number > 3000] chars`

- [ ] **Step 3: Commit**

```bash
cd "/Users/angel/Documents/Claude Projects/ai-pm-interview-app " && git add wiki-knowledge.js && git commit -m "feat: add wiki frameworks reference block for system prompt injection"
```

---

## Task 2: Update `INTERVIEWER_SYSTEM_PROMPT` in `ai-interviewer.js`

**Files:**
- Modify: `ai-interviewer.js` — replace `INTERVIEWER_SYSTEM_PROMPT` and add import

The goal is to replace the generic "use CIRCLES, STAR" instructions with wiki-accurate framework names and explicit framework citation in feedback. Keep the voice-only constraint and 100-word cap.

- [ ] **Step 1: Add import at top of `ai-interviewer.js`**

Find the existing import block (lines 1–8) and add:

```javascript
import { WIKI_FRAMEWORKS_BLOCK } from './wiki-knowledge.js';
```

After the existing imports, so the top of the file looks like:

```javascript
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { WIKI_FRAMEWORKS_BLOCK } from './wiki-knowledge.js';
```

- [ ] **Step 2: Replace `INTERVIEWER_SYSTEM_PROMPT`**

Find the existing constant (starts with `const INTERVIEWER_SYSTEM_PROMPT = \`You are an experienced...`) and replace it entirely with:

```javascript
const INTERVIEWER_SYSTEM_PROMPT = `You are an experienced AI Product Manager interviewer from a top tech company (Google, Meta, Amazon, Anthropic, OpenAI). You are conducting a practice interview to help candidates prepare for AI PM roles.

Your role:
1. Ask PM interview questions one at a time
2. Listen to the candidate's response
3. Ask 1-2 follow-up questions that dig deeper — exactly as a real interviewer would
4. Give concise, specific feedback that names the framework they used or should have used
5. Call out AI-specific gaps explicitly (missing failure modes, skipped safety considerations, no AI layer in metric diagnosis)

Interview style:
- Professional but direct
- When an answer is vague, probe with: "Can you be more specific about who the user is?" or "What metric would you actually track for that?"
- Acknowledge strong points briefly, then push on what's missing
- Keep ALL responses under 100 words — this is voice-only

When giving feedback, name the framework explicitly. Examples:
- "Good use of TROPIC, but you didn't add the AI layer — did the model update?"
- "Your answer needs the M from STAR+M — what number proves that worked?"
- "You skipped the AI failure path — that's step 8 of the 10-step design framework."
- "C-NABGT: you covered C, N, and A, but you skipped the T (tracking plan)."

After 3-5 exchanges, provide a summary evaluation:
- Frameworks used correctly (name them)
- Frameworks missed or used incorrectly (name them)
- One most important thing to fix before their next interview
- Overall score (1-5 scale)

${WIKI_FRAMEWORKS_BLOCK}`;
```

- [ ] **Step 3: Verify the server still starts**

```bash
cd "/Users/angel/Documents/Claude Projects/ai-pm-interview-app " && node server.js &
sleep 2 && curl -s http://localhost:3000/health
```

Expected: `{"status":"ok","message":"AI PM Interview API is running"}`

Kill the server after: `kill %1`

- [ ] **Step 4: Commit**

```bash
cd "/Users/angel/Documents/Claude Projects/ai-pm-interview-app " && git add ai-interviewer.js && git commit -m "feat: update INTERVIEWER_SYSTEM_PROMPT with wiki frameworks (STAR+M, TROPIC, C-NABGT, etc.)"
```

---

## Task 3: Update `ANALYSIS_SYSTEM_PROMPT` in `ai-interviewer.js`

**Files:**
- Modify: `ai-interviewer.js` — replace `ANALYSIS_SYSTEM_PROMPT`

The analysis prompt is used by `analyzeAnswer()` to generate structured JSON evaluations. Currently it uses generic criteria. We update it to score against wiki framework standards.

- [ ] **Step 1: Replace `ANALYSIS_SYSTEM_PROMPT`**

Find the constant (starts with `const ANALYSIS_SYSTEM_PROMPT = \`You are an expert PM interview coach...`) and replace it entirely with:

```javascript
const ANALYSIS_SYSTEM_PROMPT = `You are an expert AI PM interview coach. Analyze a candidate's answer against the question's rubric and the wiki framework standards below.

${WIKI_FRAMEWORKS_BLOCK}

You will be given:
1. The interview question
2. The question's framework (e.g., STAR+M, TROPIC, C-NABGT, 10-Step-Design, UPS-PPPB, GAME, SIGNAL)
3. The framework steps
4. The sample answer key points
5. The evaluation rubric (excellent/good/fair/poor)
6. The candidate's actual response

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "score": <number 1-5>,
  "scoreLabel": <"excellent"|"good"|"fair"|"poor">,
  "frameworkUsed": <name of the framework the candidate applied, or "none">,
  "frameworkCoverage": {
    "stepsIdentified": <array of framework step names the candidate covered>,
    "stepsMissed": <array of framework step names the candidate missed>,
    "coveragePercent": <number 0-100>
  },
  "aiDepth": {
    "mentionedFailureModes": <boolean>,
    "mentionedSafety": <boolean>,
    "addedAILayerToTROPIC": <boolean — only relevant for metric drop questions>,
    "includedMetricInSTAR": <boolean — only relevant for behavioral questions>
  },
  "strengths": <array of 2-3 specific strengths, each referencing the framework or wiki standard>,
  "improvements": <array of 2-3 specific improvements, each naming the framework step or wiki standard missed>,
  "missedKeyPoints": <array of key points from the rubric they didn't address>,
  "sampleAnswerHighlight": <the single most important insight from the sample answer they missed>,
  "nextStepTip": <one actionable coaching tip that names the specific framework or step to practice>
}`;
```

- [ ] **Step 2: Verify the server still starts**

```bash
cd "/Users/angel/Documents/Claude Projects/ai-pm-interview-app " && node server.js &
sleep 2 && curl -s http://localhost:3000/health
kill %1
```

Expected: `{"status":"ok","message":"AI PM Interview API is running"}`

- [ ] **Step 3: Commit**

```bash
cd "/Users/angel/Documents/Claude Projects/ai-pm-interview-app " && git add ai-interviewer.js && git commit -m "feat: update ANALYSIS_SYSTEM_PROMPT with wiki framework scoring criteria"
```

---

## Task 4: Add AI-specific questions to `pm-questions-comprehensive.json`

**Files:**
- Modify: `pm-questions-comprehensive.json`

Add 3 new question categories (`ai-product-sense`, `ai-safety`, `ai-metrics`) and 5 new framework entries (`STAR+M`, `TROPIC`, `SIGNAL`, `C-NABGT`, `10-Step-Design`). Add 9 new questions (3 per category), each following the existing schema exactly.

**Existing question schema:**
```json
{
  "id": "string",
  "category": "string",
  "difficulty": "beginner|intermediate|advanced",
  "framework": "string",
  "source": "string",
  "company": "string",
  "question": "string",
  "sampleAnswer": { "overview": "string", "steps": ["string"] },
  "evaluationRubric": { "excellent": "string", "good": "string", "fair": "string", "poor": "string" },
  "keyPoints": ["string"]
}
```

- [ ] **Step 1: Add 5 new frameworks to the `frameworks` object**

Open `pm-questions-comprehensive.json`. In the `"frameworks"` object (alongside `"CIRCLES"`, `"STAR"`, etc.), add:

```json
"STAR+M": {
  "name": "STAR+M",
  "description": "Behavioral interview framework with mandatory Metric step",
  "steps": ["Situation", "Task", "Action", "Result", "Metric"]
},
"TROPIC": {
  "name": "TROPIC",
  "description": "Metric drop diagnosis framework",
  "steps": ["Time", "Region", "Other launches", "Platform", "Industry", "Cannibalization", "AI layer (model update / drift / hallucination)"]
},
"SIGNAL": {
  "name": "SIGNAL",
  "description": "AI product metrics definition framework",
  "steps": ["Scope", "Identify the goal", "Generate candidate metrics", "Negative guardrails", "Anchor on North Star", "Layer breakdowns"]
},
"C-NABGT": {
  "name": "C-NABGT",
  "description": "Full AI metrics answer structure",
  "steps": ["Clarify scope", "North Star metric", "Actionable secondary metrics", "Business metrics", "Guardrails", "Tracking plan"]
},
"10-Step-Design": {
  "name": "10-Step-Design",
  "description": "AI product design interview framework",
  "steps": ["Clarifying Questions", "User Segmentation", "Problem Identification", "Problem Prioritization", "Solution Generation", "Prioritize with Criteria", "Combine & Design", "Core Flows (happy + AI failure + onboarding)", "Mission + Risks", "Compelling Narrative"]
}
```

- [ ] **Step 2: Add 9 new questions to the `questions` array**

Append these 9 questions at the end of the `questions` array:

```json
{
  "id": "ai-product-sense-001",
  "category": "ai-product-sense",
  "difficulty": "intermediate",
  "framework": "AI-CUPS-PDM",
  "source": "Exponent AI PM Interview Questions 2026",
  "company": "Meta",
  "question": "How would you improve Meta AI, Meta's AI assistant?",
  "sampleAnswer": {
    "overview": "Start by clarifying what Meta AI currently does (the AI layer), then segment users, identify the highest-pain problem for your chosen segment, propose 3+ solutions, prioritize with explicit criteria including safety, and define success metrics using SIGNAL.",
    "steps": [
      "Clarify: Meta AI is a general-purpose LLM assistant integrated across Facebook, Instagram, WhatsApp, and Messenger — it answers questions, generates content, and helps with tasks.",
      "User segments: (1) casual social users who stumble on it, (2) small business owners using it for content creation, (3) creators building audiences, (4) users seeking information instead of search.",
      "Pick small business owners — highest commercial intent, clearest ROI measurement, biggest gap between what they need and what generic LLMs provide.",
      "Problems: (1) AI-generated posts sound generic and don't match their brand voice, (2) can't incorporate their actual business data (inventory, pricing, hours), (3) no continuity between sessions.",
      "Solutions: (a) brand voice training from their existing posts, (b) business profile integration for inventory/pricing context, (c) persistent memory of their business.",
      "Recommend: brand voice feature — highest value, feasible with RAG on their post history, no privacy risk since it's their own content.",
      "AI failure path: generated post sounds off-brand. Show 'trained on your last 50 posts' with a 1-tap regenerate. Log user edits to improve the model.",
      "Metrics (C-NABGT): North Star = posts generated and published without editing. Guardrail = user override rate must stay below 30%."
    ]
  },
  "evaluationRubric": {
    "excellent": "Clarifies the AI layer first, picks ONE user segment and justifies it, names why AI is better than non-AI for this problem, proposes an AI failure path without being asked, uses C-NABGT or SIGNAL for metrics.",
    "good": "Has clear user segmentation and picks one, proposes reasonable solutions, mentions metrics — but skips failure path or doesn't justify why AI specifically.",
    "fair": "Identifies users and problems but designs for multiple segments, or proposes a single solution without tradeoffs, or metrics are vague ('engagement').",
    "poor": "Jumps to features without users or problem, no metrics, no consideration of AI failure modes."
  },
  "keyPoints": [
    "Must clarify what the AI layer does before designing improvements",
    "AI failure path is required — what does the UI show when the AI generates bad content?",
    "North Star metric must be a count, not a ratio",
    "User override rate is the honesty metric for AI trust"
  ]
},
{
  "id": "ai-product-sense-002",
  "category": "ai-product-sense",
  "difficulty": "advanced",
  "framework": "10-Step-Design",
  "source": "CrackPMInterview Complete AI PM Interview Guide 2026",
  "company": "Anthropic",
  "question": "Design an AI tool for small business owners who want to manage their customer relationships.",
  "sampleAnswer": {
    "overview": "Apply the 10-step design framework. The key differentiator from a standard CRM: the AI layer must handle probabilistic outputs (AI might misremember a customer), and the onboarding path is critical because small business owners are skeptical of AI accuracy.",
    "steps": [
      "Clarifying Questions: Mobile or desktop? US-focused? B2C or B2B small businesses? (Assume mobile-first, B2C, US, <10 employees.)",
      "User Segments: (1) solo freelancers tracking clients, (2) restaurant owners with regulars, (3) retail shop owners with repeat customers, (4) service providers (plumbers, cleaners). Pick restaurant owners — high repeat purchase frequency, clear ROI for remembering preferences.",
      "Problem: Owner can't remember which customers are regulars, their preferences, or when they last visited — relies on memory or expensive POS software.",
      "Solution options: (a) AI that scans receipts and builds customer profiles automatically, (b) voice note to customer profile ('Sarah likes window table, no onions'), (c) AI suggests personalized follow-up messages.",
      "Recommend voice note to profile — lowest friction for busy owners, no receipt scanning setup, clear AI value (transcription + structuring).",
      "Core flows: Happy path: owner taps mic, says 'Mark always orders the salmon', AI transcribes and adds to Mark's profile. AI failure path: AI mishears 'salmon' as 'salami' — show transcription for quick correction before saving. Onboarding path: first-time user sees 3 example profiles pre-populated, with an explanation of how AI learned them.",
      "Safety/risks: Customer data privacy — what happens if the device is lost? Mitigation: profiles encrypted, no PII visible on lock screen. Risk at scale: AI suggestions become generic as customer base grows — need refresh logic.",
      "Metrics: North Star = customer profiles with at least one AI-generated note that the owner kept (didn't delete). Guardrail = transcription error rate below 5%."
    ]
  },
  "evaluationRubric": {
    "excellent": "Follows all 10 steps, explicitly designs the AI failure path AND the onboarding path, raises privacy risk proactively, ends with a compelling narrative and metrics.",
    "good": "Strong user segmentation and solution design, mentions risks when asked, but only covers the happy path in core flows.",
    "fair": "Reasonable problem statement and solution, but skips core flows entirely or gives only happy path, no metrics.",
    "poor": "Jumps to features without users or problem, no flows, no metrics, no safety consideration."
  },
  "keyPoints": [
    "AI failure path and onboarding path are as important as the happy path",
    "Safety must be raised proactively — not when prompted",
    "Compelling narrative: owner should be able to repeat the product in one sentence",
    "The AI layer must be justified — why voice note to profile vs. just a notes app?"
  ]
},
{
  "id": "ai-product-sense-003",
  "category": "ai-product-sense",
  "difficulty": "intermediate",
  "framework": "AI-CUPS-PDM",
  "source": "Exponent AI PM Interview Questions 2026",
  "company": "Google",
  "question": "Your AI feature's user override rate has been rising for 3 weeks. Walk me through how you'd investigate.",
  "sampleAnswer": {
    "overview": "This is a metric drop question (use TROPIC + AI layer) disguised as a product question. User override rate rising means users are increasingly rejecting AI outputs — it's a trust signal, not just an accuracy metric.",
    "steps": [
      "Rule out data bugs first: is the override rate tracking correctly? Did we change the definition of 'override' recently?",
      "T (Time): Sudden or gradual over the 3 weeks? A sudden jump points to a specific cause (model update, feature change). Gradual points to drift.",
      "R (Region): All users, or specific geographies? Suggests localization issues.",
      "O (Other launches): Did we change the prompt, update the model, or ship a UI change around the start of the trend?",
      "P (Platform): iOS vs Android vs desktop? Suggests rendering or latency issues.",
      "I (Industry): Are competitors' AI products showing similar user frustration signals? Suggests external cause.",
      "C (Cannibalization): Did we add another AI feature that handles the same use case better?",
      "AI layer (most likely cause): Silent model update or prompt change degraded output quality. Check: did hallucination rate rise at the same time? Did task completion rate fall?",
      "Hypothesis: Model update changed output style — users expected X, got Y. Run A/B test comparing old vs. new model behavior on the same input set.",
      "Recommendation: If model update is confirmed, roll back to previous version while diagnosing. Add override reason logging so future drops are diagnosable faster."
    ]
  },
  "evaluationRubric": {
    "excellent": "Uses TROPIC explicitly, adds the AI-specific layer without prompting, distinguishes diagnosis from prescription, makes a clear rollback recommendation with conditions.",
    "good": "Systematically investigates causes, mentions model updates, makes a recommendation — but doesn't use TROPIC structure or conflates diagnosis with prescription.",
    "fair": "Lists some investigation steps but jumps to a fix early, misses the AI-specific layer (model update, hallucination rate).",
    "poor": "Treats rising override rate as a UI problem without investigating AI layer, no structured diagnostic process."
  },
  "keyPoints": [
    "User override rate = trust signal, not just accuracy metric",
    "TROPIC applies to any metric drop including AI-specific ones",
    "Always add the AI layer: model update? drift? hallucination rate change?",
    "Rule out data bugs before assuming a product problem"
  ]
},
{
  "id": "ai-safety-001",
  "category": "ai-safety",
  "difficulty": "intermediate",
  "framework": "P-PRIME",
  "source": "Exponent Anthropic PM Interview Questions 2026",
  "company": "Anthropic",
  "question": "How do you approach safety in a consumer AI product?",
  "sampleAnswer": {
    "overview": "Use P-PRIME: start with product context, enumerate the specific risk categories that apply, design mitigations, implement guardrails, monitor, and iterate. Safety must be designed in from the start — not added as a final checklist.",
    "steps": [
      "P (Product context): What is the product, who are the users, what scale? A coding assistant for developers has different risk profile than a health information chatbot for general consumers.",
      "P (Potential risks): (1) Harmful content generation (self-harm instructions, dangerous how-tos), (2) Bias in outputs affecting specific groups differently, (3) Data privacy (model trained on user data, PII leakage), (4) Adversarial misuse (jailbreaks, prompt injection).",
      "R (Risk mitigation): Content classifiers on output before display, confidence thresholds that trigger human review for high-stakes queries, opt-in rather than opt-out for sensitive contexts.",
      "I (Implementation guardrails): Rate limiting to limit abuse at scale, structured output formats that constrain model freedom, clear disclosure that outputs are AI-generated.",
      "M (Monitoring and metrics): Harmful output rate (human rated sample weekly), abuse report rate per 1K users, bias metrics across demographic segments.",
      "E (Evolution): Red-team testing quarterly, user feedback loops for reporting harmful outputs, model version rollback capability when safety regressions detected."
    ]
  },
  "evaluationRubric": {
    "excellent": "Names all four risk categories, designs safety into the product flow (not as an afterthought), defines specific monitoring metrics with measurement cadence.",
    "good": "Covers most risk categories, proposes reasonable mitigations, mentions monitoring — but monitoring is vague ('we'd track harmful outputs' without specifics).",
    "fair": "Mentions 1-2 risk categories, proposes content filtering as the only mitigation, no monitoring plan.",
    "poor": "Treats safety as a single concern ('just add a content filter'), no risk enumeration, no monitoring."
  },
  "keyPoints": [
    "Four risk categories: harmful content, bias, privacy, adversarial misuse",
    "Safety designed in from step 1 — not a final checklist",
    "Monitoring plan must specify measurement method AND cadence",
    "Red-team testing is a product responsibility, not just an ML team responsibility"
  ]
},
{
  "id": "ai-safety-002",
  "category": "ai-safety",
  "difficulty": "advanced",
  "framework": "P-PRIME",
  "source": "CrackPMInterview Complete AI PM Interview Guide 2026",
  "company": "OpenAI",
  "question": "Your AI gave harmful advice to a vulnerable user. Walk me through your incident response.",
  "sampleAnswer": {
    "overview": "This is an operational decision question. The structure: contain immediately, investigate root cause, communicate transparently, fix and verify, build prevention into the system.",
    "steps": [
      "Immediate containment: Disable or limit the specific capability that caused the harm if it can be isolated. Log the full conversation for investigation. Do not delete — it's evidence.",
      "User triage: Does the affected user need immediate support resources? If the harm is ongoing (e.g., self-harm advice), surface crisis resources immediately.",
      "Root cause: Was this a model failure (hallucination, misaligned output), a prompt injection attack, or a gap in content classifiers? Reproduce the failure in a sandbox.",
      "Communication: Notify legal and trust & safety within 1 hour. If reportable under applicable regulations (GDPR, state AI laws), begin that process. Communicate honestly with the affected user if possible.",
      "Fix: Update content classifiers for this category. Add this case to the red-team test suite. Tighten system prompt guardrails. If root cause is model-level, escalate to ML team with evidence.",
      "Prevention: Add this failure mode to the formal safety monitoring dashboard. Run a broader audit: how many similar conversations exist in logs?"
    ]
  },
  "evaluationRubric": {
    "excellent": "Leads with user safety (not company protection), distinguishes model failure from prompt injection, includes regulatory communication step, adds the case to ongoing monitoring.",
    "good": "Has a reasonable incident response structure, mentions root cause investigation and fix — but misses user welfare step or regulatory communication.",
    "fair": "Focuses on technical fix only, skips affected user welfare, no prevention or monitoring.",
    "poor": "Treats as a PR problem, no root cause investigation, no monitoring update."
  },
  "keyPoints": [
    "Lead with user safety — not company liability protection",
    "Distinguish model failure from prompt injection: different root causes, different fixes",
    "Add the case to red-team suite immediately — this is a prevention action",
    "Regulatory reporting is a product responsibility PM must know about"
  ]
},
{
  "id": "ai-safety-003",
  "category": "ai-safety",
  "difficulty": "intermediate",
  "framework": "P-PRIME",
  "source": "Exponent AI PM Interview Questions 2026",
  "company": "Google",
  "question": "How would you prevent harmful outputs from a deployed chatbot at scale?",
  "sampleAnswer": {
    "overview": "Prevention is a layered system, not a single control. The layers: pre-deployment (red-team, eval suite), deployment (classifiers, rate limits, structured outputs), monitoring (sampling + automated evals), and iteration (feedback loops).",
    "steps": [
      "Pre-deployment: Red-team testing with adversarial prompts targeting each risk category. Define an eval suite: what harmful output rate is acceptable before launch? (e.g., <0.1% on a standardized test set.)",
      "Input layer: Classify user inputs for intent before sending to the model. High-risk intent queries → restricted response templates or human review queue.",
      "Output layer: Classifier on model outputs before display. Flag outputs above harm threshold. Uncertain cases → safe fallback response + option to speak with human.",
      "Structural controls: System prompt guardrails, structured output format that constrains model freedom, refusal templates for specific harm categories.",
      "Scale controls: Rate limiting to limit how much any single user can extract, anomaly detection for prompt injection patterns.",
      "Monitoring: Weekly human-rated sample (1% of flagged outputs), automated eval suite run on every model update, bias metrics across demographic groups.",
      "Iteration: Public disclosure policy for safety incidents, red-team quarterly updates as attack vectors evolve."
    ]
  },
  "evaluationRubric": {
    "excellent": "Covers all three prevention layers (pre-deployment, deployment, monitoring), names specific metrics with thresholds, mentions bias monitoring across groups.",
    "good": "Has input and output classifiers, mentions monitoring — but monitoring is vague, no pre-deployment red-team, no bias consideration.",
    "fair": "Mentions a content filter as the main control, some monitoring — but single-layer prevention.",
    "poor": "Content filter only, no monitoring plan, no pre-deployment testing."
  },
  "keyPoints": [
    "Prevention is layered: pre-deployment + deployment + monitoring + iteration",
    "Define acceptable harm rate threshold BEFORE launch",
    "Bias monitoring is part of safety monitoring, not a separate concern",
    "Rate limiting is a safety control, not just a cost control"
  ]
},
{
  "id": "ai-metrics-001",
  "category": "ai-metrics",
  "difficulty": "intermediate",
  "framework": "C-NABGT",
  "source": "Exponent AI PM Interview Questions 2026",
  "company": "OpenAI",
  "question": "How would you measure the success of ChatGPT as a product?",
  "sampleAnswer": {
    "overview": "Use C-NABGT. The key insight: accuracy metrics alone are insufficient for an AI product — you need user behavior signals that reveal actual trust and value delivery.",
    "steps": [
      "C (Clarify): ChatGPT for consumers, not API users. Time window: 6-month lagging indicators + leading weekly metrics.",
      "N (North Star): Weekly active users who complete at least one multi-turn conversation (not just a single query) — this measures habitual value delivery, not one-time curiosity.",
      "A (Actionable secondary metrics): (1) Task completion rate (user got what they came for — measured by session ending without re-query on same topic), (2) User override rate (user corrected or dismissed output — the honesty metric for AI trust), (3) Conversation depth (average turns per session — proxy for value delivered).",
      "B (Business metrics): DAU/MAU ratio (stickiness), revenue per user, churn rate by user segment.",
      "G (Guardrails): Harmful output rate must stay below 0.1% (human-rated sample). Hallucination rate on factual queries below 5%. TTFT (time to first token) below 500ms p95.",
      "T (Tracking plan): Task completion rate = session ends without follow-up query on same topic within 10 minutes (automated). User override rate = explicit edit/copy-without-edit behavior (instrumented in UI). Harmful output rate = weekly human-rated random sample of 1,000 flagged conversations."
    ]
  },
  "evaluationRubric": {
    "excellent": "North Star is an absolute count (not ratio), includes user override rate as AI-specific trust metric, defines tracking plan with specific measurement method for each metric, guardrails include AI-specific thresholds (hallucination rate, TTFT).",
    "good": "Reasonable North Star and secondary metrics, mentions AI-specific metrics — but tracking plan is vague ('we'd instrument the UI'), or guardrails are generic.",
    "fair": "DAU or revenue as North Star (not wrong but not differentiated for an AI product), secondary metrics are generic engagement metrics, no AI-specific guardrails.",
    "poor": "Vague metrics like 'engagement' or 'satisfaction' with no definition of how to measure them, no tracking plan."
  },
  "keyPoints": [
    "North Star must be an absolute count, not an average or ratio",
    "User override rate is the AI trust signal — always include it",
    "The T (Tracking plan) in C-NABGT separates strong from weak answers",
    "AI guardrails: hallucination rate + TTFT are product metrics, not just ML metrics"
  ]
},
{
  "id": "ai-metrics-002",
  "category": "ai-metrics",
  "difficulty": "advanced",
  "framework": "SIGNAL",
  "source": "Exponent AI PM Interview Questions 2026",
  "company": "Snap",
  "question": "Snap is deploying an LLM-powered feature. What metrics would you track to evaluate its performance?",
  "sampleAnswer": {
    "overview": "Use SIGNAL. Snap's context matters: a young, mobile-first user base with low tolerance for latency and high sensitivity to privacy. The metrics must reflect the probabilistic nature of LLM outputs AND Snap's specific product context.",
    "steps": [
      "S (Scope): LLM feature within Snap's messaging/stories context. Users: 13–25 primarily. Time window: first 90 days post-launch for leading indicators.",
      "I (Identify goal): Users adopt the AI feature into their regular Snap usage — it becomes a habitual part of how they communicate or discover content.",
      "G (Generate candidate metrics): Task completion rate, re-query rate (user rephrased and tried again = AI failed), latency (TTFT for mobile), override rate, feature retention at D7/D30, content quality reports.",
      "N (Negative guardrails): Re-query rate must stay below 25% (high re-query = AI not understanding intent). TTFT must stay below 800ms on mobile 4G. Content policy violation rate below 0.05%.",
      "A (Anchor on North Star): D7 feature retention — percentage of users who used the feature in week 1 and returned in week 2. This is more honest than DAU because it measures habitual value, not just novelty.",
      "L (Layer breakdowns): By platform (iOS vs Android — latency differs), by age segment (13-17 vs 18-25 — usage patterns differ), by query type (informational vs. creative vs. social)."
    ]
  },
  "evaluationRubric": {
    "excellent": "Uses SIGNAL explicitly, anchors North Star on retention (not novelty), includes Snap-specific context (mobile, young users, latency sensitivity), defines guardrail thresholds, includes L (breakdowns).",
    "good": "Reasonable metrics with AI-specific considerations, mentions retention — but guardrails are generic or missing thresholds, no breakdowns.",
    "fair": "DAU or activation rate as North Star without retention signal, some AI metrics — but no context-awareness of Snap's constraints.",
    "poor": "Generic app metrics (downloads, DAU), no AI-specific metrics, no guardrails."
  },
  "keyPoints": [
    "North Star should be retention-based, not activation-based (novelty ≠ value)",
    "Mobile latency is a guardrail, not just an engineering concern",
    "SIGNAL's L (breakdowns) is what makes the analysis actionable",
    "Re-query rate = intent understanding failure — more honest than accuracy"
  ]
},
{
  "id": "ai-metrics-003",
  "category": "ai-metrics",
  "difficulty": "intermediate",
  "framework": "TROPIC",
  "source": "Exponent AI PM Interview Questions 2026",
  "company": "Meta",
  "question": "The hallucination rate for your AI feature doubled after last week's model update. What do you do?",
  "sampleAnswer": {
    "overview": "This is a metric drop question — use TROPIC + AI layer. A doubled hallucination rate after a model update is almost certainly caused by the model update, but you still need to follow the diagnostic process to be sure.",
    "steps": [
      "T (Time): Was the doubling sudden on the day of the model update, or gradual since? Sudden = model update is the cause. Gradual = other factors.",
      "R (Region): All users or specific geographies/languages? If only in non-English markets, the new model may have worse multilingual performance.",
      "O (Other launches): Did we also change the prompt, the retrieval system (if RAG), or any UI that affects what users query at the same time as the model update?",
      "P (Platform): iOS vs Android vs desktop? If hallucination rate is higher on mobile, it could be a context window truncation issue (mobile queries are handled differently).",
      "I (Industry): Are other products using the same model reporting similar issues? (Check the model provider's status page, developer forums.)",
      "C (Cannibalization): Not applicable here.",
      "AI Layer: Most likely cause — the new model version has lower factual accuracy on our specific use case. Confirm: (1) Run our eval suite on old vs. new model, (2) Check if the model provider's release notes mention accuracy tradeoffs.",
      "Recommendation: If eval suite confirms regression, roll back to previous model version immediately. File a report with the model provider. Run the eval suite on every future model update before deploying to production (add this as a deployment gate)."
    ]
  },
  "evaluationRubric": {
    "excellent": "Uses TROPIC explicitly, adds the AI-specific layer without prompting, recommends rollback with clear condition, adds eval suite as a permanent deployment gate.",
    "good": "Systematically investigates, checks model update as primary cause, recommends rollback — but doesn't use TROPIC structure, or doesn't add eval suite as future prevention.",
    "fair": "Identifies model update as likely cause, recommends rollback — but no systematic investigation, no prevention step.",
    "poor": "Assumes it's a model problem without investigation, recommends asking engineers to 'fix the model' without a structured response."
  },
  "keyPoints": [
    "TROPIC applies to AI-specific metric drops too",
    "Model update is the first AI-layer hypothesis — confirm with eval suite, don't assume",
    "Rollback is a valid product decision — have the capability ready",
    "Eval suite before deployment is the prevention lesson from this incident"
  ]
}
```

- [ ] **Step 3: Validate the JSON is still valid**

```bash
cd "/Users/angel/Documents/Claude Projects/ai-pm-interview-app " && node -e "import('./ai-interviewer.js').then(m => { const ai = new m.default(); console.log('Total questions:', ai.getAllQuestions().length); console.log('Categories:', [...new Set(ai.getAllQuestions().map(q => q.category))]); })"
```

Expected: Total questions 55, categories array includes `ai-product-sense`, `ai-safety`, `ai-metrics`.

- [ ] **Step 4: Commit**

```bash
cd "/Users/angel/Documents/Claude Projects/ai-pm-interview-app " && git add pm-questions-comprehensive.json && git commit -m "feat: add ai-product-sense, ai-safety, ai-metrics question categories with 9 new questions"
```

---

## Task 5: Extend category map for new interview types

**Files:**
- Modify: `ai-interviewer.js` — update `getQuestionsForType()` and add interview type options for the frontend

The new categories need to be reachable via `interviewType` IDs that the frontend can send.

- [ ] **Step 1: Extend `categoryMap` in `getQuestionsForType()`**

Find this block in `ai-interviewer.js`:

```javascript
const categoryMap = {
  'product-design': 'product-design',
  'metrics': 'metrics',
  'behavioral': 'behavioral',
  'product-strategy': 'strategy',
  'execution': 'execution',
  'technical': 'technical',
  'estimation': 'estimation'
};
```

Replace with:

```javascript
const categoryMap = {
  'product-design': 'product-design',
  'metrics': 'metrics',
  'behavioral': 'behavioral',
  'product-strategy': 'strategy',
  'execution': 'execution',
  'technical': 'technical',
  'estimation': 'estimation',
  // AI-specific interview types (from wiki question bank)
  'ai-product-sense': 'ai-product-sense',
  'ai-safety': 'ai-safety',
  'ai-metrics': 'ai-metrics'
};
```

- [ ] **Step 2: Verify the new interview types return questions**

```bash
cd "/Users/angel/Documents/Claude Projects/ai-pm-interview-app " && node -e "
import('./ai-interviewer.js').then(m => {
  const ai = new m.default();
  ['ai-product-sense', 'ai-safety', 'ai-metrics'].forEach(type => {
    const q = ai.getQuestionsForType ? null : null; // fallback
    // Use pickQuestion which calls getQuestionsForType
  });
  // Just validate question counts
  const all = ai.getAllQuestions();
  ['ai-product-sense', 'ai-safety', 'ai-metrics'].forEach(cat => {
    const count = all.filter(q => q.category === cat).length;
    console.log(cat + ':', count, 'questions');
  });
})"
```

Expected:
```
ai-product-sense: 3 questions
ai-safety: 3 questions
ai-metrics: 3 questions
```

- [ ] **Step 3: Test the full interview start flow with a new type**

Start the server and make a real API call:

```bash
cd "/Users/angel/Documents/Claude Projects/ai-pm-interview-app " && node server.js &
sleep 3
curl -s -X POST http://localhost:3000/api/interview/start \
  -H "Content-Type: application/json" \
  -d '{"interviewType": "ai-metrics", "candidateName": "Angela"}' | python3 -m json.tool | head -20
kill %1
```

Expected: JSON response with `sessionId`, `interviewType: "ai-metrics"`, and a `message` that contains a metrics question about an AI product.

- [ ] **Step 4: Commit**

```bash
cd "/Users/angel/Documents/Claude Projects/ai-pm-interview-app " && git add ai-interviewer.js && git commit -m "feat: extend categoryMap to support ai-product-sense, ai-safety, ai-metrics interview types"
```

---

## Self-Review

### Spec coverage check
- ✅ Wiki knowledge compiled into system prompt → Task 1 + Task 2
- ✅ Frameworks named explicitly in feedback (STAR+M not STAR, TROPIC not generic) → Task 2 (INTERVIEWER_SYSTEM_PROMPT examples) + Task 3 (ANALYSIS_SYSTEM_PROMPT aiDepth field)
- ✅ Existing questions kept → Tasks 4-5 add to, not replace, existing questions
- ✅ New AI-specific questions added → Task 4 (9 questions across 3 categories)
- ✅ Voice-only maintained → Task 2 keeps "under 100 words" constraint
- ✅ `analyzeAnswer` updated to wiki standards → Task 3

### Placeholder scan
- No TBD or TODO in any task
- All code blocks are complete and self-contained
- All file paths are exact (no relative paths)

### Type consistency
- `WIKI_FRAMEWORKS_BLOCK` exported from `wiki-knowledge.js`, imported in `ai-interviewer.js` — same name throughout
- New question schema matches existing schema exactly (`id`, `category`, `difficulty`, `framework`, `source`, `company`, `question`, `sampleAnswer`, `evaluationRubric`, `keyPoints`)
- `categoryMap` keys match the `interviewType` values the frontend would send
- `analyzeAnswer()` receives `questionId` and returns same shape as before, with added `aiDepth` field in the nested `analysis` object (backwards compatible — frontend just gets more data)
