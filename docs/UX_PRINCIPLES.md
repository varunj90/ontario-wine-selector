# UX Principles: Ontario Wine Selector

## The promise

The product succeeds only if a user can pick a nearby in-stock wine quickly, with confidence, on a phone.

## Non-negotiable experience standards

1. **Three-screen flow max**
   - Screen 1: Intent capture (mood, budget, pairing, location).
   - Screen 2: Top 3 recommendations.
   - Screen 3: Decision details and action.

2. **Under-90-second outcome**
   - Interaction is optimized for Friday-evening urgency.
   - Every UI element must reduce decision friction.

3. **Trust at first glance**
   - Every recommendation shows:
     - Match confidence
     - In-stock confidence
     - Why this pick in plain language

4. **One-thumb mobile-first design**
   - Large tap targets, bottom-sheet interactions, quick chips.
   - Minimal typing and no deep menus in the core flow.

5. **Graceful degradation**
   - If inventory confidence is weak, user sees nearby alternatives immediately.
   - Never show dead-end states.

6. **Clarity over cleverness**
   - Recommendation logic can be simple in v1.
   - Explanation and confidence communication must be excellent.

## Core interaction patterns

- Fast chips for mood and budget.
- Top-3 card stack with immediate reasons.
- Expandable "Why this pick" panel.
- "Safe" vs "Try new" slider for novelty preference.
- Optional "Surprise me" only after confidence baseline is met.

## Writing and tone in product copy

- Clear, human, and direct.
- No wine jargon without plain-language translation.
- Avoid generic confidence labels; always explain confidence source.

## Release gate checklist

Ship only when all are true:

- Median decision time <= 90 seconds.
- Recommendation acceptance >= 35% in alpha cohort.
- Inventory validity >= 90% for surfaced picks.
- Test users understand "Why this pick" within 5 seconds.
- Core flow has zero dead-end states.
