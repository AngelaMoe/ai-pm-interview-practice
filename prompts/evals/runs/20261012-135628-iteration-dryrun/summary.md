# Eval run 20261012-135628 (iteration)

Cases 5 · reps 2 · calls 16 · prompts fix v1 / voice v1 · labels: labels.claude.json (uncertain items not yet reviewed)

| Metric (target) | fix/haiku-4-5 | voice/sonnet-4-6 | voice/sonnet-5-5 |
|---|---|---|---|
| False "met" rate (≤ 5%) | 0 | 0 | 0 |
| False "not met" rate (≤ 10%) | 0 | 0 | 0 |
| Agreement, clear-cut (≥ 95%) | 100 | n/a | n/a |
| Agreement, overall (≥ 90%) | 100 | 100 | 100 |
| Agreement, borderline (reported) | 100 | 100 | 100 |
| Agreement, adversarial (reported) | n/a | 100 | 100 |
| Voice score within ±1 (≥ 90%) | n/a | 100 | 100 |
| Voice score exact (≥ 60%) | n/a | 100 | 100 |
| Voice score mean abs error (≤ 0.6) | n/a | 0 | 0 |
| Ordering strong > borderline > weak (100%) | n/a | n/a | n/a |
| Known negatives: nothing met (100%) | 0/0 | 2/2 | 2/2 |
| Designed flags correct (100%) | 0/0 | 4/4 | 4/4 |
| Consistency: items flipped (≤ 5%) | 0 | 0 | 0 |
| Evidence verified (≥ 98%) | 100 | 100 | 100 |
| Schema-valid after retry (100%) | 100 | 100 | 100 |
| Cost per call | $0.0029 | $0.0155 | $0.0169 |
| Latency median / p95 (ms) | 6082 / 6086 | 10223 / 10667 | 4569 / 5071 |
| Cache read share of input | 0% | 14.8% | 12.6% |

Measured cost this run: $0.2065. ✗ marks a missed target.
