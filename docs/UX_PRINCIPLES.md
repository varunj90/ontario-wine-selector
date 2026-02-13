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

---

## Visual design system (v2)

Inspired by Josh Puckett's "Interface Craft" philosophy: _design with uncommon care, reduce until it's clear, refine until it's right._

### Typography

- **Single font family**: Geist Sans everywhere — headings, body, chips, inputs, buttons. No serif fonts. Consistency over personality.
- **Hierarchy via weight and size only**: Headings use `font-semibold` at 20–26px with tight tracking (`-0.02em`). Body at 13–14px `font-normal`. Section labels at 11px uppercase with wide tracking.
- **Chips/pills**: 13px `font-normal` (400 weight) — matches body text feel exactly. Compact padding (`px-2.5 py-[5px]`).

### Color palette

- **Warm stone base**: Backgrounds are cream (`#faf8f5`) in light, deep stone (`#0c0a09`) in dark. No cold zinc/gray.
- **Adaptive accent system**: UI accent colors shift based on selected wine type:
  - **Red wine** → burgundy/rose tones (`bg-rose-500/15`, `text-rose-300`)
  - **White wine** → warm amber (`bg-amber-500/15`, `text-amber-300`)
  - **Rosé** → soft pink (`bg-pink-400/15`, `text-pink-300`)
  - **Bubbly** → champagne gold with floating bubble dots (`bg-yellow-400/15`, `text-yellow-300`)
  - **Default (no selection)** → amber/white accent
- Accents are defined as `AccentTheme` objects in `theme.ts` with tokens for glow, border, chips, slider track, rank badge, star fill, and page gradient tint.

### Surface and depth

- **Glass cards**: `backdrop-blur-xl` with layered `box-shadow` (inset highlight + ambient + elevation). Defined as `.glass-card` / `.glass-card-light` CSS classes.
- **Page gradient**: In dark mode, a subtle radial gradient tinted by the current accent bleeds from the top-left corner.
- **Noise texture**: Ultra-subtle SVG fractal noise overlay (`opacity: 0.02`, `mix-blend-mode: overlay`) at `z-index: 0` with `pointer-events: none`.

### Motion

- **Spring easing**: `cubic-bezier(0.34, 1.56, 0.64, 1)` for interactive elements (chips, buttons, cards).
- **Expo ease-out**: `cubic-bezier(0.16, 1, 0.3, 1)` for entrance animations.
- **Fade-up entrance**: Cards and panels animate in with `translateY(14px) → 0` + opacity.
- **Expand/collapse**: Uses CSS `grid-template-rows: 0fr → 1fr` for smooth height transitions on "Why this pick" panels.
- **Active scale**: All interactive elements use `active:scale-95` for tactile press feedback.

### Spacing and sizing

- **Implicit 8px grid**: Radii at 16px (inputs) / 24px (cards). Input heights at 44–48px. Touch targets 44px+.
- **Compact chips**: Reduced from original bloated sizing. Gap `1.5` (6px) between chips.
- **Section spacing**: `space-y-4` or `space-y-5` between filter groups.

### Component-level decisions

| Component | Key decisions |
|---|---|
| **ChipGroup** | `font-normal`, compact padding, muted unselected state, accent-colored selected state |
| **WineCard** | Glass surface, rank circle with accent `bg`, 3-column stats grid, Vivino stat gets accent glow treatment |
| **BottomBar** | Morphing pill (empty → selected), glass blur, spring animation between states |
| **PriceRangeSlider** | Borderless (seamless), accent-colored active track, custom thumb with hover/grab states |
| **StoreSelector** | Two-column grid (postal code + dropdown), 44px height inputs |
| **SearchInput** | Removed from UI in current version (functionality incomplete) |

### What we intentionally avoided

- Serif fonts (tried Instrument Serif — created inconsistency, removed)
- Heavy borders on containers (dated feel)
- Cold gray palette (zinc, slate)
- Overly thick font weights on small text
- Large chip padding that makes pills look like buttons

---

## Release gate checklist

Ship only when all are true:

- Median decision time <= 90 seconds.
- Recommendation acceptance >= 35% in alpha cohort.
- Inventory validity >= 90% for surfaced picks.
- Test users understand "Why this pick" within 5 seconds.
- Core flow has zero dead-end states.
