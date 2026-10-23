# Eval run 20261023-091545 (held-out)

Cases 23 · reps 3 · calls 69 · prompts fix v2 / voice v2 · labels: labels.angela.json

| Metric (target) | fix/sonnet-5-5 | voice/sonnet-5-5 |
|---|---|---|
| False "met" rate (≤ 5%) | 0 | 0 |
| False "not met" rate (≤ 10%) | 0 | 0 |
| Agreement, clear-cut (≥ 95%) | 100 | 100 |
| Agreement, overall, failures count as wrong (≥ 90%) | 100 | 100 |
| Agreement, borderline (reported) | 100 | 100 |
| Agreement, adversarial (reported) | 100 | 100 |
| Voice score within ±1 (≥ 90%) | n/a | 100 |
| Voice score exact (≥ 60%) | n/a | 83.3 |
| Voice score mean abs error (≤ 0.6) | n/a | 0.17 |
| Ordering matches labels, kind pairs (100%) | n/a | 3/3 |
| Known negatives: nothing met (100%) | 15/15 | 18/18 |
| Designed flags correct (100%) | 3/3 | 9/9 |
| Consistency: items flipped (≤ 5%) | 0 | 0 |
| Evidence verified (≥ 98%) | 100 | 100 |
| Schema-valid after retry (100%) | 100 | 100 |
| Retries (reasons in summary.json) | 0 | 0 |
| Cost per call | $0.0062 | $0.0083 |
| Latency median / p95 (ms) | 3671 / 4540 | 3669 / 4847 |
| Cache read share of input | 63.9% | 71.2% |

Measured cost this run: $0.5038. ✗ marks a missed target.
