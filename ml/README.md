# Creator-model pipeline

The pipeline intentionally keeps raw provider responses under `ml/data/`, which
is ignored by git. API credentials belong in environment variables, never in
the repository.

1. Collect launch-time records and delayed outcome history from Birdeye,
   Helius, DexScreener, and RugCheck.
2. Run `python ml/label.py raw.jsonl labelled.jsonl`.
3. Split labelled records by launch time, build lists from the training split,
   then train and export `src/lib/model/model-weights.json`.

The collector must persist `launch_time_source`, decision time (`launch + 1h`),
provider response timestamps, and exclusion reasons. Only features in
`FEATURE_ORDER` may enter the creator model. Current holder/liquidity signals
remain heuristic-only until historical snapshots exist.
