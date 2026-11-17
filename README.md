# AI PM Interview Practice

A web app for preparing for AI product manager interviews, with two modes: **Learn** (short lessons on how to answer metrics questions) and **Practice** (a spoken mock interview with Claude as the interviewer).

---

## Learn mode

Learn mode is at `/learn`. It has one unit, **Metrics**, with 5 lessons:

| # | Lesson | Framework |
|---|---|---|
| 1 | Define success | GAME |
| 2 | North Star and guardrails | SIGNAL |
| 3 | The full metrics answer | C-NABGT |
| 4 | Diagnose a metric drop | TROPIC |
| 5 | The AI layer | TROPIC + AI metrics |

Each lesson has 4 steps:

1. **Concept cards:** 4–5 short cards, each with one idea and an example.
2. **Quiz:** 8 questions per lesson (multiple choice, true/false and matching). Answers are checked on the server, and each answer shows the right answer and an explanation.
3. **Fix a weak answer:** shows an interview question and a weak answer to improve.
4. **60-second answer:** shows an interview question to answer out loud.

**Steps 3 and 4 currently show the exercise with a "feedback is coming soon" note.** The AI grading for them is built and tested (see [How grading was tested](#how-grading-was-tested)), but it isn't connected to the app yet.

**Skill levels:** each lesson tracks 3 concepts (15 in total), and each concept has a score from 0 to 100%.
- A correct quiz answer adds 20 points and a wrong one subtracts 10, with a floor of 0.
- **A concept counts as mastered at 70%.** Quiz answers alone can raise a concept to 69%. The rest has to come from the graded fix and spoken steps, so mastery can't be reached until AI grading is connected.
- The lesson map shows each lesson's status and mastery, and every lesson is open from the start.

---

## Practice mode

Practice mode is a spoken mock interview in the browser.

- **Interview types:** 8 in the setup menu: Product Sense, Product Design, Product Strategy, Metrics & Analytics, Behavioral, Product Execution, Technical PM and AI Safety.
- **Two modes:**
  - **Guided coaching:** Claude coaches you through one framework step by step, and a tracker shows which steps you've covered.
  - **Full simulation:** a standard interview.
- **Voice in and out:** you answer by speaking; the browser turns your speech into text, and Claude's replies are read aloud.
- **During the interview:** framework hints you can show or hide; repeat-question and next-question buttons; and, after you've answered, a sample answer ("One strong approach") with key points.
- **At the end:** a final evaluation, which includes an overall score out of 5.
- **Question bank:** 55 questions across 10 categories, each with a rubric and a sample answer (`pm-questions-comprehensive.json`).
- **Extra screens on the landing page:** **Study Frameworks** (cards for 8 interview round types, with framework steps and common mistakes) and **Question Deconstruction** (6 questions where you identify the question type, the framework and what the interviewer is testing).

---

## How grading was tested

The AI grading for Learn's fix and spoken steps was tested before being connected to the app. The method is in [`docs/grading-plan.md`](docs/grading-plan.md) and every version's results are in [`prompts/CHANGELOG.md`](prompts/CHANGELOG.md).

**How the grader works:**
- For each checklist item or concept, the grader decides met or not met.
- **Every "met" needs evidence:** an exact quote from the learner's answer. The server checks that the quote really appears in the answer, and changes the item to "not met" if it doesn't.
- For spoken answers, the grader also gives a 1–5 score against the question's rubric.

**Eval set:** 77 test answers (38 written, 39 spoken).
- **Kinds:** strong, weak and borderline answers for every lesson, plus 17 adversarial and edge cases, such as empty answers, copied answers, keyword stuffing and an attempt to instruct the grader.
- **The split:** 54 cases were used to improve the prompts, and 23 were held back for one final test.
- **How the held-out cases were labeled:** blind, by a separate model (Claude Fable 5.1) that saw only the answers and the criteria. Its labels were compared with the intended labels, and they matched on all 80 checklist items and all 12 spoken-answer scores.

**Model choice:** Claude Haiku 4.5 and Claude Sonnet 4.6 were tried for written answers. They wrongly marked items as met on 10.9% and 5.7% of items, against a target of 5% or less. Claude Sonnet 5.5 was chosen for both steps.

**Held-out results** (the locked prompts on Claude Sonnet 5.5; 23 cases, each graded 3 times):

| Measure | Target | Written answers | Spoken answers |
|---|---|---|---|
| Items wrongly marked met | ≤ 5% | 0% | 0% |
| Items wrongly marked not met | ≤ 10% | 0% | 0% |
| Item agreement with labels | ≥ 90% | 100% | 100% |
| Spoken score exactly right / within 1 point | ≥ 60% / ≥ 90% | n/a | 83.3% / 100% |
| Same result on all 3 runs | ≥ 95% of items | 100% | 100% |
| Measured cost per grade | | $0.0062 | $0.0083 |
| Median time per grade | | 3.7 s | 3.7 s |

The 2 spoken answers that missed were both scored 1 point below their label. The whole grading eval cost $4.97 in API usage (`prompts/evals/spend.md`). These results come from a small, deliberately constructed test set, not from real learners.

---

## Privacy and safety

**Learn mode:**
- **Anonymous ID:** each browser gets a random ID, stored in `localStorage`. There are no accounts.
- **What's stored:** Supabase holds only that ID, lesson status, concept scores and timestamps. **No names, emails, IP addresses or answer text are stored.** Quiz answers are checked and then discarded.
- **Database access:** only the server reads and writes the database, using a key that never reaches the browser. Row-level security is on, and the public database roles have no access to the tables.

**Practice mode:**
- **Speech:** speech recognition runs in the browser, and only the text transcript is sent to the server.
- **Storage:** transcripts are sent to the Anthropic API to generate replies. The conversation is kept in server memory only, and is cleared when the server restarts or after an hour. Nothing is written to disk.

**Learn routes:**
- **Rate limits:** 120 reads and 60 writes per minute per IP address.
- **Errors and requests:** errors return generic messages without internal details, and request bodies are limited to 20 KB.

**Server files:** the server only serves the app's own page files, never the project folder.

**Not yet in place:** rate limits on the Practice routes, and protection against forged client IP addresses. Both are listed under "Before deploy" in [`docs/learn-mode-prd.md`](docs/learn-mode-prd.md).

---

## Tech stack

- **Server:** Node.js, Express (ES modules)
- **Frontend:** plain HTML, CSS and JavaScript, with no build step
- **Database:** Supabase (Postgres), used for Learn progress only
- **AI:**
  - `@anthropic-ai/sdk`. Practice uses `claude-sonnet-4-6`.
  - Learn grading (`learn/grading/`) is set to `claude-sonnet-5-5`. It's used by the eval scripts, and isn't yet connected to the app.
- **Speech:** the browser's Web Speech API for speech recognition (`en-US`) and `speechSynthesis` for reading replies aloud. This needs Chrome or Edge.
- **Tests:** `npm test` runs 60 tests with Node's built-in test runner.

---

## Quick start

```bash
git clone https://github.com/AngelaMoe/ai-pm-interview-practice.git
cd ai-pm-interview-practice
git checkout feature/learn-mode
npm install
cp .env.example .env    # then fill in the values below
npm start
```

Open `http://localhost:3000` in Chrome or Edge. Practice is on the landing page, and Learn is at `http://localhost:3000/learn`.

Use port 3000: the Practice page calls the API at `http://localhost:3000/api`.

### Environment variables

| Variable | Needed for | What it is |
|---|---|---|
| `ANTHROPIC_API_KEY` | Practice | Your Claude API key, from [console.anthropic.com](https://console.anthropic.com/). |
| `PORT` | Optional | Server port. Defaults to 3000. A value in `.env` overrides the shell. |
| `SUPABASE_URL` | Learn progress | Your Supabase project URL (Project Settings → Data API). |
| `SUPABASE_SERVICE_ROLE_KEY` | Learn progress | The Supabase **secret** key (`sb_secret_…` or legacy `service_role`). It's used by the server only and never sent to the browser. Don't use the publishable/anon key. |

Without the Supabase variables, Learn lessons still load but progress isn't saved. To set up the database, run [`supabase/schema.sql`](supabase/schema.sql) once in the Supabase SQL Editor.

`.env` is gitignored. Never commit it.

---

## Project structure

```
server.js                        Express server, Practice API (/api/interview/*), serves the page files
ai-interviewer.js                Practice: Claude prompts, guided coaching, answer analysis
wiki-knowledge.js                Framework reference text used in the Claude prompts
pm-questions-comprehensive.json  Question bank (55 questions, rubrics, sample answers)
voice-interface.html             Landing page and Practice mode
learn/
  metrics-unit.json              Learn content: 5 lessons, 15 concepts
  routes.js                      Learn API (/api/learn/*): content, progress, quiz
  mastery.js, content.js         Quiz checking and mastery rules; content lookups
  ui/                            Learn pages (index.html, learn.css, learn.js, learn-logic.js)
  grading/                       AI grading for the fix and spoken steps (tested, not yet connected)
prompts/                         Versioned grading prompts, CHANGELOG, and the eval (prompts/evals/)
lib/                             Safe errors, rate limiting, input sanitizing
supabase/schema.sql              Database tables, constraints and access rules
docs/                            Learn mode PRD, grading plan, proposals
```

---

## License

MIT, see [LICENSE](LICENSE).
