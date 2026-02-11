# Today Sprint: Build Fast, Keep UX World-Class

## Bottom line

Run work in parallel, but treat UX quality as the release gate for every technical decision.

## Today's goal

By end of day, have a working mobile-first prototype path that can show top recommendations with explanation fields (even if some data is mocked), plus a clear backend/data contract.

## Parallel workstreams

## Stream A: UX and flow quality

- Finalize the core 3-screen user journey.
- Lock interaction details for:
  - intent chips
  - top-3 card layout
  - "why this pick" module
  - decision CTA state
- Define edge-state behavior:
  - no inventory
  - low confidence
  - slow response fallback

## Stream B: Recommendation API contract

- Define request payload:
  - location
  - budget
  - mood/pairing signals
  - novelty preference
- Define response payload per recommendation:
  - wine identity fields
  - price and store proximity
  - rating and confidence
  - explanation metadata

## Stream C: Data contracts

- Define canonical wine schema.
- Define market/inventory schema with timestamp.
- Define source quality metadata and staleness rules.

## Stream D: Product analytics

- Track events in core flow:
  - `intent_submitted`
  - `recommendations_viewed`
  - `why_opened`
  - `recommendation_chosen`
  - `recommendation_dismissed`
- Build one dashboard for:
  - decision time
  - acceptance rate
  - confidence vs choice behavior

## Decision rules to move fast

- If a decision improves speed and trust, prioritize it over feature breadth.
- If data quality is uncertain, show confidence and alternatives instead of pretending certainty.
- If a screen does not contribute to faster decisions, cut it.

## End-of-day deliverables

- UX flow locked with explicit edge-state behavior.
- API request/response contract locked.
- Data model draft locked.
- Event taxonomy locked.
- Next coding step list ready for immediate implementation.

## Immediate blocker

Node.js is currently missing on machine. Install Node.js LTS to unblock app scaffolding and local dev runtime.
