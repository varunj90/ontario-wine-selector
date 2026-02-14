# Ontario Wine Selector - Technical Decisions and Requirements

## Purpose

Capture current architecture, operational requirements, and key trade-off decisions for reliable handoff across agents.

## Stack and platform

- Frontend: Next.js App Router + TypeScript + Tailwind + shadcn/ui primitives.
- Backend: Next.js API routes (server runtime).
- Database: Postgres (Neon) via Prisma.
- Hosting: Vercel.
- Scheduling: Vercel Cron hitting `/api/cron/sync`.

## Data model requirements

- Canonical wines are persisted in `Wine`.
- Store entities persisted in `Store`.
- Store-level market rows persisted in `WineMarketData`.
- Quality signals persisted in `WineQualitySignal`.
- Sync observability persisted in `IngestionRun` and `IngestionDeadLetter`.

Schema reference: `prisma/schema.prisma`

## Ingestion strategy (current)

### LCBO catalog and inventory

- Source: LCBO public GraphQL endpoint (`https://api.lcbo.dev/graphql` by default).
- Catalog ingestion pulls wine products and sampled inventory rows.
- Catalog-only fallback rows are created when inventory edges are unavailable, so catalog coverage is still retained.
- Sync cap is configurable via `LCBO_SYNC_MAX_PRODUCTS`:
  - `0` means full uncapped catalog ingestion.

Adapter reference: `src/lib/server/ingestion/adapters/lcboAdapter.ts`

### Vivino signal strategy

- No official public Vivino API is assumed by default.
- Primary current strategy: snapshot CSV matching against LCBO wines.
- Matching uses token overlap + producer overlap + confidence floor.
- Unmatched wines are not given fake confidence; UI shows search-only fallback link.

Adapter reference: `src/lib/server/ingestion/adapters/vivinoAdapter.ts`

## Recommendation service decisions

1. API never depends on live upstream fetch for normal recommendation responses.
2. Candidate retrieval comes from provider boundary (`mock` or `db`).
3. Ranking uses two-step policy:
   - trusted Vivino match and `rating >= 4.0`
   - then search-only fallback
4. Selected-store strict filtering requires in-stock confidence.
5. If strict selected-store results are empty, fallback to wider nearby in-stock results with an explicit note.
6. MVP recommendation API does not currently include free-text `search` filtering.
7. MVP UI does not currently render expandable "Why this pick" explanation sections.

Service reference: `src/lib/server/recommendations/service.ts`

## Critical inventory decision (newest)

To fix sparse store coverage (e.g., Dundas & Bloor), selected-store recommendation flows now run a **live store inventory enrichment** call:

- For selected store only, fetch all in-stock inventory pages directly from LCBO store inventories.
- Cache per store in memory (short TTL) to reduce repeated calls.
- Merge this live signal with DB candidate mapping by SKU.

This materially improves parity with what users see on LCBO store pages.

Implementation: `src/lib/server/recommendations/liveLcboStoreInventory.ts` and `src/lib/server/recommendations/prismaProvider.ts`

## Reliability and resilience requirements

- If upstream fetch fails, preserve last-known-good data by skipping writes (no synthetic fallback in sync scripts).
- Validate payloads before writes.
- Persist validation/adapter failures to dead-letter table.
- Expose system health via `/api/ingestion/health`.
- Optional alert webhook for degraded/unhealthy status.

References:
- `docs/RESILIENCE_POLICY.md`
- `src/app/api/ingestion/health/route.ts`
- `src/app/api/cron/sync/route.ts`

## Environment requirements

Primary runtime variables are documented in `.env.example`:

- DB and provider selection (`DATABASE_URL`, `RECOMMENDATION_PROVIDER`)
- LCBO ingestion scope and inventory sampling
- Live selected-store enrichment limits
- Vivino snapshot/API options
- Health thresholds and cron secret
- Alert webhook

Reference: `.env.example`

## Deployment requirements

- Vercel project connected to this repo and branch.
- Production env vars set to match `.env.example`.
- `RECOMMENDATION_PROVIDER=db` in production.
- `DATABASE_URL` points to Neon pooled connection.
- Cron endpoint secret configured if endpoint should be protected.

Cron schedule reference: `vercel.json`

## Known limitations and decisions

1. Vivino is best-effort matching, not guaranteed canonical bottle-level truth for all wines.
2. Store-level "perfect parity" depends on LCBO endpoint health and latency.
3. Live selected-store enrichment increases request cost/latency but was accepted as necessary for trust.
4. In-memory cache is instance-local; cross-instance cache coherence is not guaranteed.

## Decision log (high-impact)

- Chose low-cost stack: Vercel + Neon.
- Moved from mock-first UX to DB-backed and source-ingested architecture.
- Enforced no-random-mock fallback for ingestion failures.
- Added dead-letter and ingestion-run observability.
- Added two-step Vivino policy (trusted match + search fallback).
- Added selected-store live LCBO enrichment to close inventory trust gap.

## Source-of-truth implementation map

- Recs API: `src/app/api/recommendations/route.ts`
- Store lookup API: `src/app/api/stores/route.ts`
- Cron sync API: `src/app/api/cron/sync/route.ts`
- Catalog sync: `src/lib/server/ingestion/lcboSync.ts`
- Vivino sync: `src/lib/server/ingestion/vivinoSync.ts`
- Sync scripts: `scripts/sync-lcbo.ts`, `scripts/sync-vivino.ts`, `scripts/sync-all.ts`
