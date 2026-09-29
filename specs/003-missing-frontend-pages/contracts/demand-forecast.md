# Contract: Demand Forecast Page (`/ai/forecast`)

**Spec mapping**: User Story 2, FR-006 through FR-010.
**Access**: `admin` only.

## Page → API calls

| Trigger | Method | Path | Request body | Response shape | Failure modes |
|---|---|---|---|---|---|
| Page mount | `GET` | `/api/menu` | — | `Dish[]` (for the dish selector) | Standard |
| Dish selected OR period toggled | `POST` | `/api/ai/forecast` | `{ dishId, daysAhead: 7 \| 30 }` | `ForecastResult` (see data-model.md) | 503 / `errorType: 'AI_UNAVAILABLE'` → page-level `ErrorState` with retry, **no fabricated data** |
| Click "Export CSV" | (no API call — generated client-side from local state per Phase 0 Decision 5) | | | | |

## State machine

The forecast page has *two* state values composed:
- **Selector state**: `'no-selection' | 'loading-list' | 'list-error'` — for the dish picker.
- **Forecast state**: `'idle' | 'loading' | 'error' | 'ai-unavailable' | 'insufficient-history' | 'ready'` — for the chart/table region.

Initial render: selector is `loading-list`, forecast region is `idle`. After a dish is selected and period is set, forecast moves to `loading` then `ready` / `error` / `ai-unavailable` / `insufficient-history`.

## CSV export format

Filename: `forecast-{dishName}-{daysAhead}d-{YYYYMMDD}.csv`

Columns:
```
date,predictedQuantity,lowerBound,upperBound
2026-04-29,42,35,49
2026-04-30,47,40,55
...
```

Generated entirely from the in-memory `ForecastResult.forecast` array.

## Acceptance contract

- **AS2.1** (chart with confidence band) → `<ComposedChart>` renders a `Line` for `predictedQuantity` and an `Area` (or stacked `Area`s) for `lowerBound`..`upperBound`.
- **AS2.2** (period toggle refresh) → period change re-runs `POST /api/ai/forecast` without page reload; only the chart/table region shows `loading` while the request is in flight.
- **AS2.3** (spike alert banner) → renders if and only if `response.spikeAlert?.triggered === true`. Banner copy uses `dishName`, `peakDay`, and `ratio`.
- **AS2.4** (staffing card) → reads `response.staffingSuggestion` directly; card hidden if `suggestedAddedStaff === 0`.
- **AS2.5** (no fabricated numbers on AI failure) → `ai-unavailable` state renders the shared `ErrorState` with retry; no chart, no table, no zero-fill.

## Failure-mode renders

| Failure | What the user sees |
|---|---|
| `historyStatus: 'insufficient'` | Banner: "Insufficient history for spike detection (this dish has fewer than 14 days of order history)." Chart still renders with available data; spike banner suppressed. |
| `errorType: 'AI_UNAVAILABLE'` (5xx or `success: false` from forecast endpoint) | Forecast region shows `ErrorState` with "AI forecast service unavailable. Try again later." and a Retry button. |
| Empty `forecast` array | `EmptyState` for the forecast region: "No forecast data available for this selection." |
