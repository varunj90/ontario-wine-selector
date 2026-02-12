# Backend Roadmap (From Mock to Production)

## Current status

- UI is connected to a structured recommendation API contract.
- Recommendation logic is routed through `RecommendationService`.
- Data providers support mock and DB mode (`RECOMMENDATION_PROVIDER=mock|db`).
- Prisma is installed and schema is defined in `prisma/schema.prisma`.
- Ingestion job skeletons are runnable:
  - `npm run sync:lcbo`
  - `npm run sync:vivino`
  - `npm run sync:all`
- Ingestion health endpoint is available:
  - `GET /api/ingestion/health`
- Upstream contracts and fixtures are documented:
  - `docs/UPSTREAM_CONTRACTS.md`
  - `docs/fixtures/lcbo-catalog.sample.json`
  - `docs/fixtures/vivino-signals.sample.json`
- Resilience policy is documented:
  - `docs/RESILIENCE_POLICY.md`

## Architecture boundaries now in place

- `src/app/api/recommendations/route.ts`:
  - API transport layer only.
  - Normalizes request, calls service, returns JSON.
- `src/lib/server/recommendations/service.ts`:
  - Recommendation policy and ranking orchestration.
  - Provider-agnostic service boundary for future live integrations.
- `src/lib/server/recommendations/providers.ts`:
  - Interfaces for data source providers.
- `src/lib/server/recommendations/mockData.ts`:
  - Temporary seed dataset.

## Next implementation milestones

1. **Database bootstrap**
   - Bring up Postgres.
   - Set `DATABASE_URL`.
   - Set `RECOMMENDATION_PROVIDER=db`.
   - Run `npm run prisma:generate`.
   - Run `npm run prisma:migrate`.
   - Run `npm run db:seed:mock` for initial smoke test data.

2. **Provider replacement (LCBO)**
   - Replace mock feed in `sync:lcbo` with real LCBO source fetch.
   - Keep `syncLcboCatalog()` as persistence boundary.
   - Persist products, stores, and store inventory snapshots.
   - Track freshness timestamps and failed sync retries.

3. **Provider replacement (Vivino signals)**
   - Replace mock feed in `sync:vivino` with real Vivino signal fetch.
   - Keep `syncVivinoSignals()` as persistence boundary.
   - Normalize rating and review count to canonical wine entities.
   - Add confidence score and source-level recency metadata.

4. **Canonical matching**
   - Add deterministic + fuzzy matching for LCBO product to canonical wine.
   - Resolve vintage/label variants into stable wine entities.

5. **Ranking hardening**
   - Keep hard filter `rating >= 4.0`.
   - Add ranking diagnostics and recommendation logs.
   - Build observability around low-coverage and stale-source scenarios.

6. **Production platform**
   - Add auth, user profiles, and tasting memory loop.
   - Add analytics and error tracking.
   - Add caching for hot recommendation queries.

## Critical risks to manage

- Source reliability and legal/data access constraints.
- Canonical wine matching quality.
- Inventory staleness causing trust breakdown.
- Live-link quality for LCBO product pages.
