# Ingestion Resilience Policy

## Goal

Serve stable recommendations from database snapshots even when upstream sources are flaky, slow, or temporarily unavailable.

## Non-negotiables

- User-facing recommendation API must never depend on live upstream calls.
- Upstream failures must degrade data freshness, not core app availability.
- Invalid upstream payloads must be isolated via dead-letter records.

## Health thresholds

- `INGESTION_LCBO_STALE_MINUTES` (default `1440`)
- `INGESTION_VIVINO_STALE_MINUTES` (default `1440`)
- `INGESTION_MAX_FAILED_SAMPLE_RUNS` (default `1`)
- `INGESTION_MAX_DEAD_LETTERS_24H` (default `25`)

## Status policy

- `healthy`
  - No failing-run spike and freshness within threshold.
- `degraded`
  - One or more signals crossing soft threshold.
- `unhealthy`
  - No successful run for source or severe stale/dead-letter condition.

## Fallback behavior

- Continue serving latest known-good DB snapshot.
- Show freshness confidence in diagnostics.
- Trigger alerts when stale/dead-letter thresholds are breached.

## Operational flow

1. Run `sync:lcbo` and `sync:vivino` jobs on schedule.
2. Validate each payload row before persistence.
3. Route invalid rows to `IngestionDeadLetter`.
4. Track each run in `IngestionRun`.
5. Monitor via `GET /api/ingestion/health`.

## Manual recovery checklist

1. Confirm upstream endpoint health.
2. Inspect latest dead letters for schema drift.
3. Patch adapter mapping or contracts.
4. Re-run sync jobs.
5. Confirm health endpoint returns `healthy`.
