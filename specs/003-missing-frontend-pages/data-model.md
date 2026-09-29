# Phase 1 Data Model: Missing Frontend Pages

This document is **the wire-shape view** — what the six new pages *consume* from the backend. It is not a database schema. Where backend collections already exist, only the fields the new pages actually use are listed.

All responses follow the project's existing envelope:

```json
{ "success": true, "data": <payload> }
{ "success": false, "errorType": "<TYPE>", "message": "<human readable>" }
```

The `__version` field referenced below is added by Phase 0 Decision 1 (optimistic concurrency).

---

## Dish

Used by: Page 1 (Menu Management), Page 4 (Dynamic Pricing), Page 3 (Demand Forecast — selector list).

```ts
{
  _id: string,
  name: string,
  description: string,
  category: string,                 // e.g. "Main", "Appetizer", "Dessert", "Beverage"
  price: number,                    // current price, server's authoritative value
  imageUrl: string | null,
  available: boolean,
  ingredients: Array<{
    ingredientId: string,
    quantity: number,
    unit: string                    // mirrors Ingredient.unit
  }>,
  priceHistory: Array<{             // newest first; capped (e.g. last 10) at the API
    price: number,
    changedAt: string,              // ISO 8601
    changedBy: string | null        // user id, optional
  }>,
  __version: number                 // optimistic concurrency token
}
```

**Validation rules visible to the page**:
- `name` non-empty
- `price ≥ 0`
- `category` from a known set (presented as dropdown — server is the source of truth for the set)
- `ingredients[]` may be empty (a dish without ingredient links is allowed but flagged in UI)
- `ingredients[].quantity > 0`

**State transitions**:
- `available: true ↔ false` via the menu page's availability toggle (PATCH; respects `__version`).

---

## Ingredient

Used by: Page 1 (ingredient linker selector), Page 6 (waste analytics, near-expiry list).

```ts
{
  _id: string,
  name: string,
  category: string,                 // e.g. "Protein", "Produce", "Dairy"
  quantity: number,
  unit: string,                     // "kg", "g", "L", "unit"
  minStock: number,
  costPerUnit: number,
  expiryDate: string | null,        // ISO 8601 date (no time)
  wasteQuantity: number,            // cumulative waste for this ingredient
  __version: number
}
```

**Used relationships**:
- `Dish.ingredients[].ingredientId` → `Ingredient._id`

---

## User

Used by: Page 2 (User & Staff Management).

```ts
{
  _id: string,
  name: string,
  email: string,
  role: 'admin' | 'staff' | 'customer',
  status: 'active' | 'pending' | 'inactive',
  createdAt: string,                // ISO 8601
  __version: number
}
```

**State transitions**:
- `pending → active` via approve action.
- `pending → inactive` via reject action (or simply hidden; depends on existing endpoint semantics).
- `active → inactive` via deactivate.
- `role: staff ↔ admin ↔ customer` via the role dropdown (PATCH).

**Display on the page**:
- Status badge color: `active` → green, `pending` → amber, `inactive` → red.

---

## Customer

Used by: Page 5 (Customer Management).

```ts
{
  _id: string,
  name: string,
  phone: string,
  email: string | null,
  totalOrders: number,              // lifetime
  totalSpend: number,               // lifetime, in restaurant's currency
  lastOrderAt: string | null,       // ISO 8601 or null if no orders
  favoritesCount: number,
  tags: Array<'Regular' | 'High Value' | 'At Risk'>,  // server-derived (Phase 0 Decision 8)
  __version: number
}
```

### CustomerDetail (extends Customer)

Returned by `GET /customers/:id`:

```ts
{
  ...Customer,
  orderHistory: Array<{
    orderId: string,
    placedAt: string,               // ISO 8601
    items: Array<{ dishId: string, dishName: string, quantity: number, price: number }>,
    total: number,
    status: string
  }>,
  favorites: Array<{
    dishId: string,
    dishName: string,
    orderCount: number              // how many times this customer ordered this dish
  }>
}
```

### CustomerRecommendations (separate endpoint)

Returned by `GET /recommend/:customerId` (existing endpoint):

```ts
{
  dishes: Array<{
    dishId: string,
    name: string,
    score: number,                  // 0..1
    reason: string                  // human-readable
  }>
}
```

**Note**: When the recommendation service is unavailable, this endpoint returns `success: false` with `errorType: 'AI_UNAVAILABLE'`. The customer detail panel renders only the recommendations region as `ErrorState` (Phase 0 Decision 3).

---

## ForecastResult

Used by: Page 3 (Demand Forecast).

Returned by `POST /api/ai/forecast` with body `{ dishId, daysAhead }` (where `daysAhead ∈ {7, 30}`):

```ts
{
  dishId: string,
  dishName: string,
  daysAhead: 7 | 30,
  generatedAt: string,              // ISO 8601
  historyStatus: 'sufficient' | 'insufficient',  // 'insufficient' if dish has < 14 days history
  forecast: Array<{
    date: string,                   // ISO 8601 date
    predictedQuantity: number,
    lowerBound: number,             // 95% confidence lower
    upperBound: number              // 95% confidence upper
  }>,
  trailingAverage: number,          // computed average daily quantity over the trailing 30-day window
  spikeAlert: null | {              // null when historyStatus === 'insufficient'
    triggered: boolean,
    peakDay: string,                // ISO 8601 date
    peakQuantity: number,
    baseline: number,               // 1.3 × trailingAverage
    ratio: number                   // peakQuantity / trailingAverage
  },
  staffingSuggestion: {
    busiestDay: string,             // ISO 8601 date
    forecastedOrders: number,
    suggestedAddedStaff: number     // 0 if forecastedOrders ≤ threshold
  }
}
```

---

## PricingRecommendation

Used by: Page 4 (Dynamic Pricing).

Returned by `POST /api/pricing/suggest` (existing endpoint) — returns one element per dish (or per requested dish):

```ts
{
  dishId: string,
  dishName: string,
  currentPrice: number,
  suggestedPrice: number,
  direction: 'up' | 'down' | 'none',
  multiplier: number,               // e.g. 1.20 means +20%
  demandScore: number,              // 0..1
  confidence: number,               // 0..1
  recentHistory: Array<{            // capped (e.g. last 5 changes); newest first
    price: number,
    changedAt: string
  }>,
  __version: number                 // version of the underlying Dish (used for apply concurrency)
}
```

`POST /api/pricing/apply` body: `{ dishIds: string[], __versions: { [dishId]: number } }` — versions are matched on the corresponding Dish document.

---

## WasteAggregate

Used by: Page 6 (Waste Management).

Returned by `GET /api/dashboard/admin` (existing endpoint, ETL-backed). Only the relevant fields are listed:

```ts
{
  waste: {
    summary: {
      monthTotalQuantity: number,
      monthTotalValue: number,        // currency
      previousMonthTotalValue: number,
      reductionPctVsLastMonth: number // negative means worse
    },
    byIngredient: Array<{ ingredientId: string, ingredientName: string, quantity: number, value: number }>,
    byCategory: Array<{ category: string, quantity: number, value: number }>,
    trend: Array<{ date: string, quantity: number, value: number }>  // daily, last 30 days
  }
}
```

If the backend response does not yet include the `waste` block, that is a backend gap surfaced by this feature; see "Backend additions and gaps" at the bottom.

---

## NearExpiryItem

Used by: Page 6 (Waste Management — `NearExpiryTable`).

Returned by `GET /api/inventory/near-expiry` (existing endpoint):

```ts
{
  _id: string,
  name: string,
  category: string,
  quantity: number,
  unit: string,
  expiryDate: string,               // ISO 8601 — within 3 days
  daysUntilExpiry: number           // 0..3
}
```

When the user clicks "Use in Recipe", the page calls `POST /api/ai/recipe` with body `{ ingredients: [{ name, quantity, unit }, ...] }`.

---

## ConcurrencyConflictResponse (shared)

Returned by any PATCH/DELETE on a versioned record when `__version` does not match:

```ts
HTTP 409
{
  "success": false,
  "errorType": "VERSION_CONFLICT",
  "message": "This record was changed by another admin. Please refresh to see the latest version.",
  "currentVersion": <number>
}
```

Pages render the spec's exact wording in a non-blocking toast and discard the in-progress edit (Phase 0 Decision 1).

---

## Backend additions and gaps

These backend-side items are **prerequisites** for this feature. They are listed here because the spec calls them out via FRs that no current endpoint satisfies.

| Item | Why | Where |
|---|---|---|
| `GET /api/auth/users` (admin-only, list all users) | Page 2 needs a list endpoint; only `PATCH /auth/users/:id/status` exists today | New route + controller method |
| `GET /api/customers` (list all customers with derived `tags`) | Page 5 list view; current `customer.routes.js` only has phone-based smart-flow endpoints | New route + controller method + service method |
| `GET /api/customers/:id` (single customer with `orderHistory` + `favorites`) | Page 5 detail drawer | New route + controller method + service method |
| `version` field on Dish, User, Customer, and any pricing record document | FR-035 concurrent-edit detection (Phase 0 Decision 1) | Mongoose model update + controller `$inc` on save |
| Forecast response shape extension (`spikeAlert`, `staffingSuggestion`, `historyStatus`, `trailingAverage`) | FR-008, FR-009 — page is a pure renderer per Phase 0 Decision 9 | `Server/ml_model_service` + `ai.service.js` extension |
| Customer tag derivation in customer list/detail responses | FR-023; population statistic must be computed server-side per Phase 0 Decision 8 | `customer.service.js` — depends on aggregation across all customers |
| Dashboard `waste` block (if not already present) | Page 6 charts and summary | `etl.service.js` aggregation extension |

These additions are intentionally *small and surgical*: no new collections, no new services, no new external dependencies — they extend existing routes/controllers/services.
