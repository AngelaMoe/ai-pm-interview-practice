# Eval run 20261023-085635 (iteration)

Cases 54 · reps 3 · calls 243 · prompts fix v2 / voice v2 · labels: labels.claude.json + labels.review.json

| Metric (target) | fix/haiku-4-5 | voice/sonnet-4-6 | voice/sonnet-5-5 |
|---|---|---|---|
| False "met" rate (≤ 5%) | 10.9 ✗ | 0 | 0 |
| False "not met" rate (≤ 10%) | 2.3 | 0 | 5.6 |
| Agreement, clear-cut (≥ 95%) | 96.4 | 100 | 100 |
| Agreement, overall, failures count as wrong (≥ 90%) | 92.6 | 100 | 97.5 |
| Agreement, borderline (reported) | 82.1 | 100 | 90.5 |
| Agreement, adversarial (reported) | 95.8 | 100 | 100 |
| Voice score within ±1 (≥ 90%) | n/a | 100 | 100 |
| Voice score exact (≥ 60%) | n/a | 70.4 | 69.1 |
| Voice score mean abs error (≤ 0.6) | n/a | 0.3 | 0.31 |
| Ordering matches labels, kind pairs (100%) | n/a | 11/11 | 11/11 |
| Known negatives: nothing met (100%) | 30/36 ✗ | 30/30 | 30/30 |
| Designed flags correct (100%) | 3/3 | 9/9 | 9/9 |
| Consistency: items flipped (≤ 5%) | 3.7 | 0 | 0 |
| Evidence verified (≥ 98%) | 100 | 100 | 100 |
| Schema-valid after retry (100%) | 100 | 100 | 100 |
| Retries (reasons in summary.json) | 0 | 0 | 0 |
| Cost per call | $0.0035 | $0.0086 | $0.0073 |
| Latency median / p95 (ms) | 3894 / 8353 | 7589 / 13671 | 4450 / 11266 |
| Cache read share of input | 0% | 75.3% | 80.5% |

Measured cost this run: $1.5758. ✗ marks a missed target.
