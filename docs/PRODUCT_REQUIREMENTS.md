# Ontario Wine Selector - Product Requirements

## Purpose

Define the current product requirements and UX decisions so multiple agents can build consistently without re-litigating scope.

## Product goal

Help a user pick a wine they can buy near them now, quickly and confidently, on mobile.

## Core success criteria

- Time to decision target: under 90 seconds in typical flows.
- Recommendation quality: prioritize trusted Vivino quality signals.
- Inventory trust: store-specific availability should reflect LCBO inventory reality.
- UX trust: no dead-end flows; always offer alternatives.

## Primary user story

"I know roughly what I want (or I can search by name), and I want a good bottle available at a nearby LCBO without doing research in multiple apps."

## Functional requirements (current)

1. **As-you-type search**
   - Search input filters by wine name, producer, varietal, and region text.
   - Recommendations refresh automatically while typing.

2. **Filter model**
   - Multi-select filters for:
     - wine type (`Red`, `White`, `Rose`, `Bubbly`, `Other`)
     - varietal
     - country
     - sub-region
   - All filters are optional.

3. **Budget control**
   - Dual-handle min/max slider.
   - Supported range: `$10` to `$500`.

4. **Location and store selection**
   - User enters postal prefix/area code.
   - App suggests nearby LCBO stores.
   - Store selection is optional (`Any LCBO` default).

5. **Inventory-aware recommendations**
   - If a store is selected, app should prefer in-stock wines for that store.
   - If selected store has no matches, app shows fallback nearby availability with explicit note.

6. **Quality and ranking policy**
   - Step 1: trusted Vivino-matched wines with rating `>= 4.0`.
   - Step 2: unmatched wines are allowed only as "search-only Vivino fallback".
   - Ranking order emphasizes in-stock confidence and then Vivino quality.

7. **Link behavior**
   - LCBO links should use direct product URLs when available, else search fallback.
   - Vivino links should open direct wine URLs when confidence is high; otherwise open search.

8. **Favorites UX**
   - User can save favorites in-session.
   - Favorite rows show name, rating, and price.

9. **Display behavior**
   - Mobile-first layout with overflow-safe store labels.
   - Dark mode supported.
   - Loading and empty states must be explicit and actionable.

## Explicit product decisions

- Pairing filters are removed for MVP.
- "Mood" taxonomy is replaced by wine type.
- Region selection model is country + sub-region.
- Search + quality + inventory trust is prioritized over social/community features.
- App can show unmatched Vivino fallback entries, but must label them clearly.

## Non-goals for current MVP

- Checkout or payment.
- Full user account/auth journey.
- Personalized long-term taste graph.
- Deep analytics dashboard for end users.

## Open product risks to monitor

- Vivino matching precision for similarly named wines.
- User trust if LCBO inventory freshness lags.
- Regional coverage quality under API volatility.

## Source-of-truth implementation references

- UI and filter behavior: `src/app/page.tsx`
- Recommendation contract and metadata: `src/lib/server/recommendations/types.ts`
- Ranking and fallback policy: `src/lib/server/recommendations/service.ts`
- Recommendations API: `src/app/api/recommendations/route.ts`
