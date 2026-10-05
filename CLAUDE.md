# AI PM Interview Simulator — CLAUDE.md

## Quick start

```bash
cd ~/Documents/Personal/Claude\ Projects/ai-interview-simulator
node server.js        # port 3000
# open http://localhost:3000
```

ESM project (`"type": "module"`). Uses `@anthropic-ai/sdk`. Requires `ANTHROPIC_API_KEY` in `.env`.

---

## What is built

### App structure
| File | Purpose |
|------|---------|
| `server.js` | Express API — session management, all `/api/interview/*` endpoints |
| `ai-interviewer.js` | Claude integration — system prompts, question picking, guided mode |
| `wiki-knowledge.js` | Compiled Obsidian framework reference block injected into system prompt |
| `pm-questions-comprehensive.json` | Question bank — 55 questions across 9 categories with rubrics and sample answers |
| `voice-interface.html` | Single-page frontend — all UI screens, voice logic, quiz logic |

---

## Feature inventory (as of 2026-07-28)

### Landing screen — 3-step progression
1. **Study Frameworks** — 8 collapsible round-type cards (Behavioral, Product Design, Product Sense, Metrics & Analytics, Product Strategy, Execution, Vibe Coding, AI Safety & Ethics). Each card shows framework steps, anti-patterns, and a "Try a question" button that routes to the matching deconstruction question.
2. **Question Deconstruction** — 6 questions (metrics, behavioral, product-design, strategy, product-sense, ai-safety). Each question has 3 stages: (1) recognize question type, (2) pick the right framework, (3) identify the hidden test. Reveals how to open the answer after all 3 stages.
3. **Mock Interview** — voice-only practice with AI feedback. Two modes (see below).

### Interview modes (setup screen toggle)
- **Guided coaching** (default) — AI coaches step by step through the active framework. A progress tracker shows which framework steps are done / current / pending. AI responses include `[STEP:X]` markers parsed by the frontend to update the tracker.
- **Full simulation** — standard mock interview, no step prompts. AI gives feedback after each answer.

### Interview types (8 total)
Product Sense · Product Design · Product Strategy · Metrics & Analytics · Behavioral · Product Execution · Technical PM · AI Safety

Each type maps to a framework in `FRAMEWORK_STEPS_MAP` (in `ai-interviewer.js`) and a question category in `pm-questions-comprehensive.json`.

### Wiki framework injection
`wiki-knowledge.js` exports `WIKI_FRAMEWORKS_BLOCK` — a compiled string of all 8 frameworks (STAR+M, TROPIC, GAME, SIGNAL, C-NABGT, AI-CUPS-PDM, 10-Step Design, UPS-PPPB) injected into `INTERVIEWER_SYSTEM_PROMPT` with prompt caching enabled.

### Sample answers
After responding to a question, "One strong approach" button appears. Fetches `/api/interview/question/:id/sample` and shows key points + walkthrough. Gated behind `hasResponded` flag so candidates can't peek before answering.

### Demo mode
When `ANTHROPIC_API_KEY` is not set, demo mode activates — 2 free uses per IP, then returns 402 with instructions to get their own key.

---

## Frameworks by interview type

| Interview type | Framework | Guided mode steps |
|---|---|---|
| Metrics & Analytics | TROPIC | T→R→O→P→I→C |
| Behavioral | STAR+M | S→T→A→R→+M |
| Product Design | 10-Step Design | 1→2-3→4-5→6-7→8→9-10 |
| Product Strategy | SIGNAL | S→I→G→N→A→L |
| Product Execution | TROPIC (execution variant) | T→R→O→P→I→C |
| Technical PM | System Design | 1→2→3→4→5 |
| Product Sense | AI-CUPS-PDM | C→U→P→S→P→D→M |
| AI Safety | AI-CUPS-PDM | C→U→P→S→P→D→M |

---

## Known limitations / not yet built
- **Obsidian sync** — `wiki-knowledge.js` was compiled once from Obsidian notes. New clipped articles do not auto-sync. To update: edit `wiki-knowledge.js` manually and restart the server. (A file-watcher approach was discussed but not built.)
- **No persistence** — sessions are in-memory. Restarting the server clears all active sessions.
- **No user accounts** — no login, no history saved across sessions.
- **Vibe Coding round** — card exists in Study mode but no deconstruction question or interview type in the dropdown yet.

---

## Session handoff — 2026-07-28

**Last completed:** Added Product Sense and AI Safety interview types to dropdown, framework cards, and deconstruction quiz. Fixed all 6 deconstruction questions to use consistent answer options including the new round types.

**All features working:** Landing 3-step flow, Study framework cards (8 rounds), Question Deconstruction (6 questions), Guided voice mode with progress tracker, Full simulation mode, Sample answer panel, Repeat/Next question buttons.

**Next steps (suggested):**
- Add Vibe Coding as an interview type in the dropdown + deconstruction question
- Build Obsidian vault file-watcher so new clipped notes auto-sync into the app
- Push to GitHub and deploy to Vercel (currently running local only)
