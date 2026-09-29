# Contract: Customer Management Page (`/customers`)

**Spec mapping**: User Story 5, FR-021 through FR-025.
**Access**: `admin` and `staff`.

## Page → API calls

| Trigger | Method | Path | Request body | Response shape | Failure modes |
|---|---|---|---|---|---|
| Page mount | `GET` | `/api/customers` | — | `Customer[]` (with derived `tags`) | Standard |
| Open detail drawer | `GET` | `/api/customers/:id` | — | `CustomerDetail` | Standard |
| Detail drawer (independent) | `GET` | `/api/recommend/:customerId` | — | `CustomerRecommendations` | `AI_UNAVAILABLE` → recommendations region only shows `ErrorState` (FR-025) |

**Backend gap**: `GET /api/customers` and `GET /api/customers/:id` do not currently exist. The existing `customer.routes.js` has `POST /customer/profile` (phone-based smart flow), `POST /customer/order`, and `GET /customer/recommendations/:phone`. New routes/handlers required (see `data-model.md` → Backend additions).

## Detail drawer composition

The drawer composes three independent regions, each with its own state machine:

```
1. Header / tags        — from /customers/:id   (always rendered first)
2. Order history        — from /customers/:id   (always rendered with header)
3. Favorites            — from /customers/:id   (always rendered with header)
4. AI recommendations   — from /recommend/:id   (independent; degrades alone)
```

Region 4's state machine: `'loading' | 'ai-unavailable' | 'error' | 'empty' | 'ready'`. Regions 1–3 share a single `'loading' | 'error' | 'ready'` state because they come from the same response.

Per FR-025, regions 1–3 must remain visible even when region 4 is in `ai-unavailable`.

## Tag derivation (Phase 0 Decision 8)

The page does not compute tags; it reads `customer.tags` directly from the response. The badges component renders one badge per entry in the array. Tag color tokens:
- `Regular` → blue
- `High Value` → green
- `At Risk` → amber

A customer can carry multiple tags simultaneously (FR-023).

## State machine (page-level table)

```
'loading' → on mount
'error'   → if /api/customers fails
'empty'   → if `customers.length === 0`
'ready'   → otherwise
```

## Acceptance contract

- **AS5.1** (table columns) → name/phone, order count, total spend, last-order-date, favorites count.
- **AS5.2** (detail panel renders order history + favorites + recommendations + tags) → drawer composes four regions; all populated when all three calls succeed.
- **AS5.3** (At Risk tag rule) → relies on server-side derivation; the page just displays whatever `tags` says.
- **AS5.4** (recommendations unavailable, history still visible) → recommendations region shows `ErrorState`; regions 1–3 remain populated.

## Failure-mode renders

| Failure | What the user sees |
|---|---|
| 5xx on `/customers` | Page `ErrorState` with retry. |
| 5xx on `/customers/:id` | Drawer shows `ErrorState`; other rows in the table remain interactive. |
| `AI_UNAVAILABLE` on `/recommend/:id` | Drawer's recommendation region shows "Recommendations unavailable" with retry; other regions still populated. |
| Empty customer list | `EmptyState`: "No customers yet." |
| Customer with zero orders (cold-start) | Detail drawer renders header + tags (likely empty array); order history region shows `EmptyState`; recommendations region shows a cold-start message. |
