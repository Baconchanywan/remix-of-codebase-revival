# n8n automation

These workflows keep n8n out of the live scoring path. They read and write the
pipeline tables through the app's secure pipeline endpoint — n8n never connects
to the database directly.

## One credential

Create one n8n **Header Auth** credential named `UnRuggable pipeline`:

- Name: `Authorization`
- Value: `Bearer <PIPELINE_API_TOKEN>` (the token stored in the app's secrets)

Select it on every node marked "Uses the 'UnRuggable pipeline' Header Auth
credential". Other provider credentials stay in n8n:

- `BIRDEYE_API_KEY` — HTTP Header Auth credential, not a node value.
- `HELIUS_API_KEY` — HTTP Header Auth credential.
- Telegram — for W6 alerts.

The endpoint lives on the published app, so publish the app before enabling the
workflows.

## Endpoint

Base URL: `https://project--6ea691b4-6d72-4909-8327-9db061692868.lovable.app/api/public/pipeline`

Write endpoints accept one JSON object or an array of up to a few hundred.
List endpoints return a JSON array, which n8n splits into one item per row.

| Method | Path | Used by | Purpose |
| --- | --- | --- | --- |
| GET | `/ping` | setup | Check the credential works |
| POST | `/tokens` | W1 | Insert discovered tokens (existing mints are ignored) |
| GET | `/snapshots-due?limit=25` | W2 | Tokens whose one-hour snapshot is due |
| POST | `/snapshots` | W2 | Store snapshot (all model features required) and mark token snapshotted |
| GET | `/outcomes-due?limit=100` | W3 | Tokens ≥30 days old not yet labelled |
| POST | `/labels` | W3 | Upsert outcome label and mark token checked |
| POST | `/funders` | W4 input | Upsert `{ funder_address, rugged_creator_count }` |
| GET | `/known-bad-candidates?min_funder_count=2&before=<iso>` | W4 | Rugged creators + repeat funders |
| POST | `/known-bad` | W4 | Atomically replace the known-bad list |
| POST | `/watchlist` | — | Upsert `{ mint, trust, baseline_trust, liquidity_drop_pct }` |
| POST | `/watchlist-remove` | — | Remove `{ mint }` or `{ mints: [...] }` |
| GET | `/watchlist-alerts?trust_drop=20&liquidity_drop=50` | W6 | Watched tokens with material drops |
| GET | `/training-data` | GitHub Actions | Labelled rows as JSONL for `ml/train.py` |

Errors return JSON: `400` invalid input (with field details), `401` bad token,
`404` unknown operation, `422` unknown token mint.

## Import order

1. `w1-discover-new-tokens.json`
2. `w2-snapshot-at-one-hour.json`
3. `w3-label-outcomes.json`
4. `w4-build-known-bad.json`
5. `w6-watchlist-alerts.json`

W5 (training) is the GitHub Actions workflow in `.github/workflows/train-model.yml`.
It downloads `/training-data` using a `PIPELINE_API_TOKEN` GitHub secret.

The workflows are intentionally conservative:

- writes are idempotent on `mint`;
- API calls use small batches;
- no current holder or liquidity values are written into the creator-model
  feature row;
- the one-hour snapshot stores provider timestamps and `launch_time_source`;
- failures should be routed to an n8n Error Trigger workflow.

Before enabling production schedules, replace every `REPLACE_ME` value and
test each workflow with a single known mint.
