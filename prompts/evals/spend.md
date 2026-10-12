# Grading phase API spend

**Budget: $30.** Stop and ask before going over it.

Costs come from each response's `usage` block × the model's rates (Haiku 4.5 $1/$5, Sonnet 4.6 $3/$15, Sonnet 5.5 $2/$10 per million input/output tokens; cache writes ×1.25, cache reads ×0.1). Rows marked *estimate* are calls that went through Practice endpoints, which don't return `usage`.

| Date | Step | Calls | Cost | Basis |
|---|---|---|---|---|
| 2026-10-09 | 1: Practice smoke test (guided start ×2, respond, mock start, analyze-answer; Sonnet 4.6) | 5 | ~$0.08 | estimate (~2.5k in / ~300 out per call) |
| 2026-10-09 | 1: structured-output probe (Haiku 4.5, Sonnet 4.6 ×2, Sonnet 5.5 ×2) | 5 | $0.0063 | measured |
| | **Running total** | | **~$0.09** | |
