# Ontario Wine Selector

## Bottom line

Build a mobile-first decision engine that helps users choose an in-stock wine near them in under 90 seconds, with clear confidence and direct action links.

## What this repo is for

- Product build for Ontario wine selection MVP.
- UX-first execution with recommendation quality and data reliability.
- Hands-on AI product-sense learning through a real shipped experience.

## Core promise

- User can answer: "What should I buy near me right now?" quickly and confidently.

## UX north-star metrics

- Median time-to-decision: <= 90 seconds.
- Recommendation acceptance rate: >= 35% in alpha.
- Nearby inventory validity on surfaced recommendations: >= 90%.

## Project structure (initial)

- `docs/UX_PRINCIPLES.md`: experience quality bar and interaction standards.
- `docs/TODAY_SPRINT.md`: parallel build streams and immediate task plan.

## Documentation index (agent handoff)

- `docs/PRODUCT_REQUIREMENTS.md`
  - Current functional scope, UX requirements, explicit product decisions, non-goals.
- `docs/TECHNICAL_DECISIONS.md`
  - Architecture, ingestion strategy, reliability policy, deployment requirements, decision log.
- `docs/RESILIENCE_POLICY.md`
  - Health thresholds, failure behavior, runbook-level resilience expectations.
- `docs/UPSTREAM_CONTRACTS.md`
  - Source contract expectations and validation boundaries.
- `docs/UX_PRINCIPLES.md`
  - Experience quality standards and release-gate framing.
- `docs/TODAY_SPRINT.md`
  - Historical sprint planning context (not the current source-of-truth for scope).

## Quick start

1. `cd /Users/varun/Documents/ontario-wine-selector`
2. `npm run dev`
3. Open `http://localhost:3000`

Then continue with the UX and delivery plan in `docs/TODAY_SPRINT.md`.

## Beta operations

- **Automated ingestion:** `vercel.json` schedules `/api/cron/sync` every 6 hours.
- **Manual trigger:** call `GET /api/cron/sync` locally or in production.
- **Health check:** `GET /api/ingestion/health` for freshness/dead-letter status.
- **Security:** set `CRON_SECRET` to require `Authorization: Bearer <secret>` on cron endpoint.
- **Alerting:** set `ALERT_WEBHOOK_URL` to receive degraded/unhealthy ingestion alerts.
