# Eval run 20261023-090654 (iteration)

Cases 27 · reps 3 · calls 162 · prompts fix v2 / voice v1 · labels: labels.claude.json + labels.review.json

| Metric (target) | fix/sonnet-4-6 | fix/sonnet-5-5 |
|---|---|---|
| False "met" rate (≤ 5%) | 5.7 ✗ | 0 |
| False "not met" rate (≤ 10%) | 0.8 | 1.5 |
| Agreement, clear-cut (≥ 95%) | 99.4 | 98.8 |
| Agreement, overall, failures count as wrong (≥ 90%) | 96.3 | 99.4 |
| Agreement, borderline (reported) | 86.9 | 100 |
| Agreement, adversarial (reported) | 100 | 100 |
| Voice score within ±1 (≥ 90%) | n/a | n/a |
| Voice score exact (≥ 60%) | n/a | n/a |
| Voice score mean abs error (≤ 0.6) | n/a | n/a |
| Ordering matches labels, kind pairs (100%) | n/a | n/a |
| Known negatives: nothing met (100%) | 36/36 | 36/36 |
| Designed flags correct (100%) | 3/3 | 3/3 |
| Consistency: items flipped (≤ 5%) | 1.9 | 0.9 |
| Evidence verified (≥ 98%) | 100 | 100 |
| Schema-valid after retry (100%) | 100 | 100 |
| Retries (reasons in summary.json) | 0 | 0 |
| Cost per call | $0.0058 | $0.0053 |
| Latency median / p95 (ms) | 5760 / 6964 | 3451 / 5326 |
| Cache read share of input | 76.4% | 78% |

Measured cost this run: $0.8933. ✗ marks a missed target.
