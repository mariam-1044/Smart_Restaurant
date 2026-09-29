# Contract: Waste Management Page (`/waste`)

**Spec mapping**: User Story 6, FR-026 through FR-029.
**Access**: `admin` only.

## Page → API calls

| Trigger | Method | Path | Request body | Response shape | Failure modes |
|---|---|---|---|---|---|
| Page mount | `GET` | `/api/dashboard/admin` | — | object containing `WasteAggregate` block (see data-model.md) | Standard |
| Page mount (parallel) | `GET` | `/api/inventory/near-expiry` | — | `NearExpiryItem[]` | Standard |
| "Use in Recipe" → submit | `POST` | `/api/ai/recipe` | `{ ingredients: [{ name, quantity, unit }, ...] }` | `{ name, description, steps[], ingredients[], estimatedCost, suggestedPrice }` | `AI_UNAVAILABLE` → modal shows `ErrorState` only inside the modal, page stays usable |

**Backend gap**: The dashboard response must include the `waste` block described in `data-model.md`. If `etl.service.js`'s `getDashboardAnalytics()` does not yet return that block, this is a backend prerequisite for Page 6.

## Visualization regions

Each chart is an independent region with its own state machine, all sourced from the single dashboard response:

```
1. Summary cards         (4 KPIs)            — needs waste.summary
2. By-ingredient chart   (BarChart)          — needs waste.byIngredient
3. Trend chart           (LineChart)         — needs waste.trend
4. By-category chart     (PieChart)          — needs waste.byCategory
5. Near-expiry table     (independent fetch) — needs /inventory/near-expiry
```

If any region's source field is missing (e.g. `waste.byCategory` is `undefined` or `[]`), that region renders `EmptyState` rather than failing the whole page.

## "Use in Recipe" flow

1. User clicks the action on a near-expiry row.
2. Page opens a confirmation modal listing the ingredient(s) that will be used (modal can preselect just the clicked row, or allow multi-select if a future enhancement enables it).
3. On confirm, page calls `POST /api/ai/recipe`.
4. Modal switches to `'loading'`, then either:
   - `'ready'`: shows generated recipe (name, ingredients, steps, estimated cost), with a "Save to menu" CTA (out of scope for this iteration — can simply be a "Done" close).
   - `'ai-unavailable'`: shows error inside the modal with retry; the page remains usable behind the modal.

## State machine (page-level)

```
'loading' → during initial dual fetch
'error'   → if /dashboard/admin fails (whole page)
'empty'   → all data sources successful but every waste.* sub-array is empty AND no near-expiry items
'ready'   → otherwise (some regions may individually be empty)
```

## Acceptance contract

- **AS6.1** (summary cards) → renders total waste, value, and reduction % vs last month.
- **AS6.2** (breakdown charts) → ingredient bar / category pie / trend line all render when their source arrays are populated.
- **AS6.3** (near-expiry list with action) → table renders one row per near-expiry ingredient with a "Use in Recipe" button.
- **AS6.4** (recipe generated) → on success, modal shows recipe name, ingredients (highlighting the near-expiry ones), and steps.

## Failure-mode renders

| Failure | What the user sees |
|---|---|
| 5xx on `/dashboard/admin` | Page `ErrorState` with retry. |
| 5xx on `/inventory/near-expiry` | Near-expiry table shows `ErrorState`; other regions still populated. |
| `AI_UNAVAILABLE` on `/ai/recipe` | Modal shows `ErrorState`; rest of the page stays usable. |
| Missing `waste.*` sub-fields | Affected regions show `EmptyState` ("No data yet"); other regions still populated. |
