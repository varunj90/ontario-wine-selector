# Upstream Ingestion Contracts

## Purpose

Define strict payload contracts for external ingestion sources so adapters can be implemented safely and validated consistently.

## LCBO catalog feed contract

- Endpoint shape expected by adapter:
  - `GET {LCBO_API_BASE_URL}/catalog`
- Response JSON:
  - `{ "items": CatalogFeedItem[] }`

### CatalogFeedItem

- `externalId`: string (stable upstream product identifier)
- `name`: string
- `producer`: string
- `type`: `"Red" | "White" | "Rose" | "Bubbly" | "Other"`
- `varietal`: string
- `country`: string
- `subRegion`: string
- `regionLabel`: string
- `lcboUrl`: string URL (optional)
- `vivinoUrl`: string URL (optional)
- `storeCode`: string
- `storeLabel`: string
- `listedPriceCents`: integer >= 0
- `inventoryQuantity`: integer >= 0
- `inStock`: boolean
- `sourceUpdatedAt`: ISO timestamp

## Vivino signals feed contract

- Endpoint shape expected by adapter:
  - `GET {VIVINO_API_BASE_URL}/signals`
- Optional auth header:
  - `Authorization: Bearer {VIVINO_API_KEY}`
- Response JSON:
  - `{ "signals": SignalFeedItem[] }`

### SignalFeedItem

- `externalId`: string (must map to `Wine.lcboProductId`)
- `source`: `"vivino"`
- `rating`: number in range 0-5
- `ratingCount`: integer >= 0
- `confidenceScore`: number in range 0-1
- `fetchedAt`: ISO timestamp

## Validation and dead-letter behavior

- Invalid items are not written.
- Invalid items are recorded in `IngestionDeadLetter`.
- Adapter-level response-shape issues are also recorded in dead-letter table.
- Ingestion run metadata stores rejected count.

## Health endpoint

- `GET /api/ingestion/health`
- Returns:
  - summary status
  - recent ingestion runs
  - recent dead letters
