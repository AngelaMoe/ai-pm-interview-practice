# 🎤 AI PM Interview Practice

Voice-powered mock interview app for Product Manager candidates. Ask real PM questions, answer out loud, and get instant AI feedback — right in your browser.

Built with Node.js + Express, the Anthropic Claude API, and the browser's native Web Speech API (no installs, no plugins).

---

## Features

- **Voice-only interface** — speak your answers naturally, just like a real interview
- **6 interview types** — Product Design, Strategy, Metrics, Behavioral, Execution, Technical PM
- **46 real questions** sourced from *Cracking the PM Interview*, *Decode and Conquer*, *The Product Manager Interview*, and *Swipe to Unlock*
- **Framework hints toggle** — show/hide CIRCLES, STAR, DIGS, RICE, SWOT step-by-step guides mid-interview
- **Instant AI feedback** — Claude evaluates your answer, scores it 1–5, and asks follow-up questions
- **Answer analysis** — framework coverage %, specific strengths, missed points, and a coaching tip
- **Demo mode** — 2 free tries with no setup; add your own API key for unlimited practice (~$0.08/session)

---

## Quick Start

```bash
git clone https://github.com/AngelaMoe/ai-pm-interview-app.git
cd ai-pm-interview-app
npm install
cp .env.example .env
# Add your API key to .env
npm start
# Open http://localhost:3000/voice-interface.html in Chrome
```

---

## Setup

### 1. Get an Anthropic API key

Sign up at [console.anthropic.com](https://console.anthropic.com) — free tier available.

### 2. Configure your environment

```bash
cp .env.example .env
```

Edit `.env`:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 3. Run

```bash
npm start       # production
npm run dev     # auto-reload with nodemon
```

Open `http://localhost:3000/voice-interface.html` in **Chrome or Edge** (required for Web Speech API).

---

## Demo Mode

If no `ANTHROPIC_API_KEY` is set, the app allows **2 free interview sessions per IP address**. After that, users see a prompt to add their own key.

This makes it easy to deploy as a public demo without exposing your key or running up API costs.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/interview/start` | Start a new session |
| `POST` | `/api/interview/respond` | Submit a voice answer |
| `POST` | `/api/interview/evaluate` | Get final session feedback |
| `POST` | `/api/interview/analyze-answer` | Score answer against rubric |
| `GET`  | `/api/interview/questions` | List all questions (filterable) |
| `GET`  | `/api/interview/types` | List interview types |
| `POST` | `/api/interview/end` | End session |

---

## Tech Stack

- **Backend:** Node.js, Express
- **AI:** Anthropic Claude (`claude-sonnet-4-6`)
- **Voice:** Web Speech API (browser-native, no third-party)
- **Frontend:** Vanilla HTML/CSS/JS — zero build step, zero dependencies

---

## Project Structure

```
├── server.js                       # Express server + API endpoints + demo gate
├── ai-interviewer.js               # Claude integration + answer analysis
├── pm-questions-comprehensive.json # 46 questions with rubrics + sample answers
├── voice-interface.html            # Frontend (single file)
├── .env.example                    # Environment template
└── package.json
```

---

## Cost

Roughly **$0.08 per full interview** (5 questions × ~1,000 tokens each at Sonnet pricing).

---

## License

MIT — see [LICENSE](LICENSE)
