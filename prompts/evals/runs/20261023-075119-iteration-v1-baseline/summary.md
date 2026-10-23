# Eval run 20261023-075119 (iteration)

Cases 54 · reps 3 · calls 243 · prompts fix v1 / voice v1 · labels: labels.claude.json + labels.review.json

| Metric (target) | fix/haiku-4-5 | voice/sonnet-4-6 | voice/sonnet-5-5 |
|---|---|---|---|
| False "met" rate (≤ 5%) | 5.9 ✗ | 2.2 | 0 |
| False "not met" rate (≤ 10%) | 2.7 | 0 | 8.3 |
| Agreement, clear-cut (≥ 95%) | 100 | 100 | 100 |
| Agreement, overall (≥ 90%) | 95.3 | 98.8 | 96.3 |
| Agreement, borderline (reported) | 83.8 | 95.2 | 90.5 |
| Agreement, adversarial (reported) | 95.8 | 100 | 94.4 |
| Voice score within ±1 (≥ 90%) | n/a | 100 | 100 |
| Voice score exact (≥ 60%) | n/a | 81.3 | 64.2 |
| Voice score mean abs error (≤ 0.6) | n/a | 0.19 | 0.36 |
| Ordering strong > borderline > weak (100%) | n/a | 3/4 ✗ | 3/4 ✗ |
| Known negatives: nothing met (100%) | 36/36 | 30/30 | 30/30 |
| Designed flags correct (100%) | 3/3 | 9/9 | 9/9 |
| Consistency: items flipped (≤ 5%) | 1 | 0 | 3.7 |
| Evidence verified (≥ 98%) | 100 | 100 | 97.1 ✗ |
| Schema-valid after retry (100%) | 91.4 ✗ | 98.8 ✗ | 100 |
| Retries (reasons in summary.json) | 11 | 3 | 0 |
| Cost per call | $0.0033 | $0.009 | $0.0071 |
| Latency median / p95 (ms) | 3759 / 5712 | 7566 / 11122 | 3928 / 6097 |
| Cache read share of input | 0% | 73.4% | 81.4% |

Measured cost this run: $1.5722. ✗ marks a missed target.
