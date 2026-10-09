# AI PM Interview Simulator — CLAUDE.md

## Quick start

```bash
cd ~/Documents/Personal/Claude\ Projects/ai-interview-simulator
node server.js        # port 3000 (PORT in .env wins over the shell: dotenv uses override: true)
# open http://localhost:3000
npm test              # Learn mode mastery/content tests (node:test, no extra deps)
```

ESM project (`"type": "module"`). Uses `@anthropic-ai/sdk` and `@supabase/supabase-js`. Env vars are listed in README → "Environment variables". The Supabase ones are optional: without them, Learn progress routes return 503.

---

## Product direction — two modes

| Mode | What it is | Status |
|------|-----------|--------|
| **Practice** | The existing voice mock interview (guided coaching + full simulation). | Built. **Do not change** while building Learn mode. |
| **Learn** | Duolingo-style lessons that teach PM interview knowledge. Built on top of the existing Study Frameworks cards and Question Deconstruction quiz, reusing their content rather than replacing them. | In progress on branch `feature/learn-mode`. PRD: `docs/learn-mode-prd.md`. Content, the progress API and the UI (`/learn`) are built. Grading of the fix and speak steps is not (they're placeholders). |

**Stack:** Node/Express, same as the rest of the app. No new framework for Learn mode.

**Ground rules for Learn mode work:**
- Keep changes small. Add to existing files rather than restructuring them.
- Practice mode endpoints (`/api/interview/*`) and their behavior stay as they are.
- Every changed file gets a short explanation of why it was touched.

---

## What is built

### App structure
| File | Purpose |
|------|---------|
| `server.js` | Express API — session management, all `/api/interview/*` endpoints |
| `ai-interviewer.js` | Claude integration — system prompts, question picking, guided mode |
| `wiki-knowledge.js` | Compiled Obsidian framework reference block injected into system prompt |
| `pm-questions-comprehensive.json` | Question bank — 55 questions across 9 categories with rubrics and sample answers |
| `voice-interface.html` | Single-page frontend — all UI screens, voice logic, quiz logic. The only file the server serves. |
| `learn/metrics-unit.json` | Learn mode content: 5 Metrics lessons, 15 concepts, one `takeaway` each (schema in the PRD) |
| `learn/ui/` | Learn UI at `/learn`: `index.html`, `learn.css`, `learn.js` (screens, `textContent` only), `learn-logic.js` (pure helpers + tests). Each file is served by name in `server.js` (`LEARN_UI_FILES`). |
| `learn/routes.js` | `/api/learn/*`: unit content, progress, lesson start/complete, server-graded quiz |
| `learn/content.js`, `learn/mastery.js` | Content lookups (strips `source`), quiz grading and mastery rules (+20/−10, 69 cap until applied) |
| `learn/supabase-client.js` | Lazy server-only Supabase client (secret key). Returns null when not configured. |
| `lib/safe-error.js`, `lib/rate-limit.js` | Safe client errors; in-memory per-IP rate limiter (+ `getClientIp`) |
| `supabase/schema.sql` | Tables, constraints, RLS, grants to `service_role` only. Run once in the SQL Editor. |

**Gotchas:**
- **Root-owned files:** `node_modules` and `package-lock.json` were root-owned from an old `sudo npm install` (fixed 2026-10-07). Never use `sudo` with npm.
- **No DELETE for the server:** `service_role` has no DELETE on the Learn tables (by design). Remove test rows in the SQL Editor.
- **Test learner IDs:** they use the prefix `00000000-0000-4000-8000-…` so they're easy to find and delete.

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

**Since then (2026-10-05):** Committed the above to `main`, created `feature/learn-mode`, and added `mode` validation to `/api/interview/start` (only `guided` or `mock`, otherwise 400).

## Session handoff — 2026-10-07

**Last completed:**
- **PRD phase 4 (Supabase + progress routes):** built and checked against the live project. 15/15 API checks passed. Directly in the database, the 69 cap is enforced, DELETE is denied, and the first completion time is kept.
- **Security fixes:**
  - removed `express.static(__dirname)`, which served `env.txt` (it held an API key), `server.js` and more
  - deleted `env.txt` and `.env.txt`
- **Earlier:** the PRD, the framework text fix, and all 5 Metrics lessons.
- **RLS check passed** in the SQL Editor (2026-10-07): `set role anon; select * from learners;` returned "permission denied".
- **Test learners deleted:** the 2 test learners (`00000000-0000-4000-8000-…000001` and `…000002`) were removed from Supabase. To clean up future test rows, use `delete from learners where anon_id in (...)` in the SQL Editor. The cascade removes their other rows.
- **The old Anthropic key is gone:** the key from the deleted `env.txt` no longer exists (confirmed 2026-10-09).

## Session handoff — 2026-10-09

**Last completed: PRD phase 3, the Learn UI**, in `learn/ui/`:
- **Built:** the landing mode choice in `voice-interface.html` (additive only, 23 lines, nothing removed), the lesson map, cards, quiz (all 3 types, saved per item), the fix and speak placeholders, and lesson complete with a takeaway.
- **Checked:**
  - 19 unit tests
  - 61 headless-Chrome checks: a keyboard-only run of lesson 1, persistence, simulated 503s, 375px width, no stray text and no JS errors
  - 11 landing checks

**How the browser tests work:** they drive the system Chrome directly through the DevTools protocol, using Node's built-in WebSocket and no dependencies. They live in the session scratchpad and aren't committed. Rebuild them from the same approach if you need them.

**Open:**
- **Test learners:** test learners `…000003`, `…000004` and `…000005` are in Supabase. Delete them in the SQL Editor:
  `delete from learners where anon_id in ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005');`

**Next step:** PRD phase 2 is the grading prompts in `/prompts/` (fix-a-weak-answer with Haiku, voice with Sonnet), tested on 3–5 sample answers before any route code. Then phase 5, the grading routes, which replace the placeholders and set `applied_met`.

**Before deploy:** see the PRD → Architecture → "Before deploy" (5 items).

**Other suggestions (from 2026-07-28):**
- Add Vibe Coding as an interview type in the dropdown + deconstruction question
- Build Obsidian vault file-watcher so new clipped notes auto-sync into the app
- Push to GitHub and deploy to Vercel (currently running local only)
