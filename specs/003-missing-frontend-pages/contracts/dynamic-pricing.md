# Contract: Dynamic Pricing Page (`/ai/pricing`)

**Spec mapping**: User Story 3, FR-011 through FR-015, FR-035.
**Access**: `admin` only.

## Page → API calls

| Trigger | Method | Path | Request body | Response shape | Failure modes |
|---|---|---|---|---|---|
| Page mount | `POST` | `/api/pricing/suggest` | `{}` (or `{ dishIds: 'all' }`) | `PricingRecommendation[]` | 503 / `AI_UNAVAILABLE` → page-level `ErrorState` |
| Apply single | `POST` | `/api/pricing/apply` | `{ dishIds: [id], __versions: { [id]: version } }` | `{ applied: [...], conflicts: [...] }` | Per-item conflicts list; show toasts |
| Apply all (filtered) | `POST` | `/api/pricing/apply` | `{ dishIds: visibleIds, __versions: {...} }` | Same as above | Same |
| Revert | `POST` | `/api/pricing/revert` | `{ dishId, __version }` | updated dish | 409 → conflict toast |
| Pricing history (per card) | `GET` | `/api/pricing/history/:dishId` | — | `Array<{price, changedAt}>` | Inline error in the card |

## Filter and bulk apply (Phase 0 Decision 7)

```
allRecommendations  : PricingRecommendation[]   // from /pricing/suggest
filter              : 'all' | 'increase' | 'decrease' | 'none'
visibleRecommendations : PricingRecommendation[]   // derived
```

`visibleRecommendations` is the **single source of truth** for what bulk apply targets. The confirmation modal renders:
> "Apply {visibleRecommendations.length} suggested {filter} to currently displayed dishes? Projected revenue impact: {sum of (suggestedPrice − currentPrice) × forecastedDailyOrders}"

The `dishIds` array sent to `/api/pricing/apply` is exactly `visibleRecommendations.map(r => r.dishId)`.

## State machine

```
'loading'         → during /pricing/suggest
'ai-unavailable'  → if /pricing/suggest fails with AI_UNAVAILABLE
'error'           → other 5xx
'empty'           → no recommendations returned
'ready'           → recommendations present
'applying'        → during /pricing/apply (bulk or single)
```

## Apply response handling

`POST /api/pricing/apply` response:

```ts
{
  applied: Array<{ dishId: string, oldPrice: number, newPrice: number }>,
  conflicts: Array<{ dishId: string, currentVersion: number, message: string }>,
  failed: Array<{ dishId: string, errorType: string, message: string }>
}
```

The page must report each bucket separately (FR-015):
- All applied: success toast with count.
- Some applied, some not: results modal listing each item with a clear status.
- All conflicts: toast prompting refresh; auto-refetch suggestions.

## Acceptance contract

- **AS3.1** (each card shows all fields) → card renders current price, suggested price, direction icon, demand score bar, confidence percent.
- **AS3.2** (single apply with confirmation + history bump) → after apply, the dish's `recentHistory` shows the new price entry as the most recent.
- **AS3.3** (filtered bulk apply) → filter pill set; `visibleRecommendations` count and filter name appear in the confirmation modal; only those dishes are sent to `/pricing/apply`; recommendations excluded by the filter retain their old prices verifiably.
- **AS3.4** (filter pill behavior) → pills are mutually exclusive; clicking the active pill clears it (resets to `'all'`).
- **AS3.5** (low confidence badge) → cards with `confidence < 0.5` show an amber badge; `< 0.3` shows a red badge.

## Failure-mode renders

| Failure | What the user sees |
|---|---|
| `AI_UNAVAILABLE` on suggest | Page-level `ErrorState`: "AI pricing service unavailable. Try again later." with Retry. No fabricated suggestions. |
| 409 on a single apply | Conflict toast for that dish; refetch its recommendation; other dishes unaffected. |
| Partial apply | Results modal listing applied / conflicts / failed; admin acknowledges before page returns to `'ready'`. |
| Empty recommendations | `EmptyState`: "No pricing changes recommended right now." |
