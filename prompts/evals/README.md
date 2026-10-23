# Grading eval set

The method, targets and budget are in `docs/grading-plan.md`.

| File | What it is |
|---|---|
| `cases.json` | 77 grader inputs: 38 fix rewrites and 39 voice transcripts. Inputs only, no labels. |
| `labels.claude.json` | Claude's labels for every case. **Don't open it until you've finished the labeling sheet.** |
| `split.json` | Iteration set (54 cases) and held-out set (23 cases), drawn with a fixed seed and stratified by step × kind. It also maps the sheet's neutral ids (H01–H23) to case ids, which name each case's kind, so **don't open it until you've finished the labeling sheet** either. |
| `labeling-sheet.csv` | The 23 held-out cases with neutral ids (H01–H23) and no labels. This was the blind input for the independent labeler. |
| `labels.fable.json` | Blind labels for the held-out set from Claude Fable 5.1 (fresh context, no file access), keyed by sheet id |
| `labels.angela.json` | **Final held-out labels.** Independent-model labels, with disagreements adjudicated by Angela. There were 0 disagreements with Claude's intended labels, so these are the agreed labels. The runner's held-out lock opens when this file exists. |
| `review-sheet.csv` | Claude's 9 uncertain calls in the iteration set |
| `labels.review.json` | Angela's decisions on those 9 calls (she agreed with all of them). The runner applies them over `labels.claude.json`. |
| `build-split.mjs` | Validates cases and labels against the lesson content and regenerates the split and both sheets. Run `node prompts/evals/build-split.mjs`. |
| `run-eval.mjs` | The eval runner. Example: `node prompts/evals/run-eval.mjs --reps 3` (iteration set). The held-out set is locked until `labels.angela.json` exists. It refuses to run, or stops mid-run, if spend would pass $30. |
| `runs/` | One folder per run: `results.jsonl` (every grade), `summary.json`, `summary.md` |
| `spend-ledger.json` | Every API spend, measured from `usage` where possible. The runner appends to it and regenerates `spend.md`. |
| `spend.md` | API spend log (budget $30), generated from the ledger |

## How to label (labeling-sheet.csv)

Open the file in Numbers, Excel or Google Sheets. There's one case per row, split into **session 1** (rows 1–12) and **session 2** (rows 13–23).

For each row:
1. **Read the interview question and the answer.** Voice answers are raw speech-to-text, so read past fillers, missing punctuation and misheard words.
2. **For each item (`item_1` … `item_4`), enter `Y` or `N` in the `_met` column next to it.**
   - **Y** only if the answer itself clearly does what the criterion says. Partly doing it, hinting at it, or just naming the topic is **N**.
   - **Examples in a criterion are illustrations** ("such as …" doesn't have to match).
   - **Substance over vocabulary:** framework words with no real content is **N**, and a correct idea in plain words is **Y**.
   - Cells marked `n/a` need nothing.
3. **Voice rows only:** enter a score from 1 to 5 using the rubric in that row (5 excellent, 4 good, 3 fair, 1–2 poor).
   - Use 2 when there's some relevant content, and 1 when there's almost nothing usable.
   - If the answer is far too short for 60 seconds (roughly under 40 words of substance), the score is at most 2, even if some items are met.
4. **`notes`** is optional. Use it for anything that felt ambiguous.

Label from the sheet alone. The point is to measure the grader against your independent judgment, so don't look at the grader's output or `labels.claude.json` first.

## How to review (review-sheet.csv)

These are 9 iteration-set calls Claude wasn't sure about. Each row shows the criterion (or rubric), Claude's label and why. In the last column, write `agree` or the label you'd give. Your answer becomes the label for that case.
