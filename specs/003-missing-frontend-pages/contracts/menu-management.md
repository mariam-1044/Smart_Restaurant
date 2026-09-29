# Contract: Menu Management Page (`/admin/menu`)

**Spec mapping**: User Story 1, FR-001 through FR-005, FR-035.
**Access**: `admin` only (route guard via `<ProtectedRoute roles={['admin']}>`).

## Page → API calls

| Trigger | Method | Path | Request body | Response shape | Failure modes |
|---|---|---|---|---|---|
| Page mount | `GET` | `/api/menu` | — | `Dish[]` | 401 → redirect to `/`; network/5xx → page-level `ErrorState` with retry |
| Page mount (parallel) | `GET` | `/api/inventory` | — | `Ingredient[]` | Same as above |
| Click "New dish" → submit | `POST` | `/api/menu` | `Dish` (without `_id`, `priceHistory`, `__version`) | created `Dish` with `__version: 0` | 400 → form-level field errors; 401 → redirect; 5xx → toast |
| Edit row → submit | `PATCH` | `/api/menu/:id` | partial `Dish` + `__version` | updated `Dish` with bumped `__version` | 400 → field errors; 409 → "record changed by another admin" toast + discard edit (FR-035); 5xx → toast |
| Toggle availability | `PATCH` | `/api/menu/:id` | `{ available: boolean, __version }` | updated `Dish` | Same as edit |
| Delete row → confirm | `DELETE` | `/api/menu/:id` | `{ __version }` (in body or query) | `{ success: true }` | 409 → "record changed by another admin"; 5xx → toast |
| View pricing history | (no extra call — `priceHistory` is on the `Dish` payload) | | | | |

## State machine

```
'loading' → on initial fetch
'error'   → if either GET fails on mount
'empty'   → if both fetches succeed but `dishes.length === 0`
'ready'   → otherwise
```

Modal states are independent of the page state machine.

## Acceptance contract (mapped to spec)

- **AS1.1** (full list visible) → `dishes` rendered as sortable table with name, category, price, availability toggle, ingredient count.
- **AS1.2** (create flow) → New dish appears in table after `POST /api/menu` resolves.
- **AS1.3** (edit price + history) → After `PATCH`, the dish's `priceHistory` is replaced by the bumped server response.
- **AS1.4** (availability off → not orderable in POS) → Backend filtering already excludes `available: false` from POS queries; this page just toggles the flag.
- **AS1.5** (non-admin denied) → `<ProtectedRoute roles={['admin']}>` redirects before page mounts.

## Failure-mode renders

| Failure | What the user sees |
|---|---|
| 401 from any call | Existing axios interceptor logs out and redirects to `/`. |
| 5xx on mount | Page-level `ErrorState` with "Retry" button that re-runs both fetches. |
| 409 on save | Toast: "This record was changed by another admin. Please refresh to see the latest version." Modal closes, in-progress edits discarded. |
| 400 on save | Inline field errors next to the offending fields; modal stays open. |
| Network error on save | Toast with retry; modal stays open. |
