# Phase 0 Research: Missing Frontend Pages

This document resolves the cross-cutting design questions that are common to multiple of the six pages, so each page contract in Phase 1 can reference one canonical decision instead of restating it.

The spec's clarification session (`spec.md` §Clarifications) already locked in the user-facing decisions (concurrent-edit UX, customer tag rules, bulk apply scope under filter, forecast spike comparison window, CSV export format). This research file resolves the *technical* approach for delivering those decisions and the other shared concerns.

---

## Decision 1 — Concurrent-edit conflict detection (FR-035)

**Decision**: Add an integer `version` field to the four affected MongoDB documents (`Dish`, `User`, `Customer`, and the pricing record model). Increment it on every successful save. The frontend always sends the version it last saw, embedded in the request body as `__version`. The backend rejects any save where the submitted `__version` ≠ the current document's `version`, returning HTTP `409 Conflict` with body `{ success: false, errorType: "VERSION_CONFLICT", currentVersion, message }`. The page catches `409` and shows the "this record was changed by another admin — refresh to see the latest version" message defined by the spec, then discards the in-progress edit.

**Rationale**:
- Optimistic concurrency is sufficient for graduation-scale (< 10 admins, infrequent simultaneous edits) and avoids the operational complexity of pessimistic locks.
- A numeric `version` field is the smallest possible change to existing models and validation schemas.
- The `__version` payload field works on `PATCH` and `DELETE` without needing custom HTTP headers (which would require an axios interceptor change for every page).
- Returning a structured `errorType` lets the existing axios response interceptor in `Client/src/api/axios.js` distinguish this from auth errors without parsing message strings.

**Alternatives considered**:
- *Last-write-wins* (no detection) — rejected; spec FR-035 forbids silent overwrite.
- *ETag + `If-Match` header* — works but requires changing the axios layer to surface response headers and changing every PATCH endpoint to read/write the header. More moving parts than the body-field approach for the same outcome.
- *Pessimistic locking* (record marked "in-edit by user X") — heavy; needs lock release on tab close/timeout; not justified at this scale.
- *Diff/merge UI* (the spec's Option C) — rejected during clarification; spec answer was Option B.

**Implications**:
- Each affected model gets `version: { type: Number, default: 0 }` (or equivalent).
- Each `PATCH` controller increments `version` atomically using `$inc` and matches on `_id` + previous `version` in the query filter.
- Each affected page passes `record.version` through its form state so the value sent on save matches the value the page loaded with.

---

## Decision 2 — Shared loading / empty / error states (FR-031, FR-032)

**Decision**: Three small shared components live at `Client/src/components/shared/`: `LoadingState.jsx`, `EmptyState.jsx`, `ErrorState.jsx`. Each takes minimal props (`message`, `onRetry?`, `icon?`) and uses the project's existing Tailwind tokens. Pages render exactly one of `LoadingState`, `EmptyState`, `ErrorState`, or the populated content based on a single state machine: `'loading' | 'empty' | 'error' | 'ready'`.

**Rationale**:
- Spec mandates four states (loading, empty, populated, error) on every page (FR-031, SC-011). Sharing the visual prevents drift between pages.
- A single state-machine value is easier to reason about and test than juggling separate `loading`, `error`, `data` flags as the existing `Inventory.jsx` does.

**Alternatives considered**:
- *Per-page inline JSX* (matches current `Inventory.jsx` style) — rejected; six pages would diverge visually within weeks.
- *Suspense + ErrorBoundary* — overkill given the project does not yet use these elsewhere; would add cognitive load for the maintaining engineer.

---

## Decision 3 — "Fabricated data on failure" defense (FR-010, FR-025, FR-032)

**Decision**: AI-dependent calls (forecast, pricing suggest, customer recommendations, recipe generation from near-expiry) wrap the axios call in a thin helper that maps any 5xx, network error, or `success: false` response from the AI route to a typed error object `{ kind: 'ai_unavailable', service: '<name>' }`. Pages render `ErrorState` for the AI region only — never zero-fill, never show last-known-good cached values, and never substitute random or default values. Order history and favorites on the customer page remain visible because they come from non-AI endpoints; only the recommendations region degrades.

**Rationale**:
- Spec is explicit: "MUST NOT display fabricated values in place of real data" (FR-032). The cleanest defense is to never have a code path that returns synthesized data.
- Region-level error states (FR-025: "page MUST keep order history and favorites visible") require treating each data source independently rather than falling the whole page into a single error mode.

**Alternatives considered**:
- *Whole-page error mode on any AI failure* — rejected; FR-025 explicitly requires partial degradation on the customer page.
- *Cached last-known-good values* — risky; the user has no way to know the data is stale, which is the same UX problem as fabricated values.

---

## Decision 4 — Recharts component selection per visualization

**Decision**:

| Page | Visualization | Recharts component |
|---|---|---|
| 1 — Menu Management | Pricing history per dish | `LineChart` |
| 3 — Demand Forecast | Predicted quantity + confidence band | `ComposedChart` (Line + Area for the band) |
| 4 — Dynamic Pricing | (No primary chart; `PricingHistoryPanel` reuses Page 1's `LineChart`) | reused |
| 6 — Waste Management | Waste by ingredient | `BarChart` |
| 6 — Waste Management | Waste over time (daily/weekly) | `LineChart` |
| 6 — Waste Management | Waste distribution by category | `PieChart` |

**Rationale**: Recharts 3 is already a dependency. `ComposedChart` is the idiomatic way to render a forecast line with a confidence-interval band (Area component with `dataKey={['yhatLower','yhatUpper']}` — actually two Area components or a single Area with stacked offsets). Each page consumes its data shape directly without a transformation layer.

**Alternatives considered**:
- *Chart.js* — adds a second charting library; the project already standardized on Recharts (used in `Dashboard.jsx`, `Sales.jsx`).
- *Pure SVG* — too low-level for the team's velocity target; Recharts already covers every chart needed.

---

## Decision 5 — CSV export pattern (forecast — FR-007)

**Decision**: Generate the CSV **client-side** from the already-fetched forecast data. The forecast page holds the table data in component state; the export button serializes it to CSV (header row + one row per day with `date, predictedQuantity, lowerBound, upperBound`), wraps it in a `Blob`, and triggers download via `URL.createObjectURL`. Same pattern as inventory export's *frontend handler*, but the data source is local state instead of a backend endpoint.

**Rationale**:
- The data is already in the browser; round-tripping through a backend CSV endpoint adds a network call without value.
- Keeps the CSV format trivially auditable (the frontend code is the single source of truth for the export schema).
- Inventory CSV export differs because that data is large and lives only on the server; for forecast, the dataset is small (≤ 30 rows) and already loaded.

**Alternatives considered**:
- *Backend `/ai/forecast/export` endpoint* — rejected; introduces a second AI route call path with no functional benefit.
- *XLSX export* — rejected during clarification; spec answer was CSV.

---

## Decision 6 — Drawer / modal / confirmation patterns

**Decision**:
- **`ConfirmationModal`** (shared) — used by: pricing apply (single + bulk), pricing revert, dish delete, user role change, user reject, ingredient delete from waste page. Props: `title`, `body`, `confirmLabel`, `confirmVariant ('danger' | 'primary')`, `onConfirm`, `onCancel`. For bulk pricing apply, the body includes the count, the active filter name, and the projected revenue impact (per FR-013).
- **`DishFormModal`** (menu-specific) — full create/edit modal including the ingredient linker.
- **`DetailDrawer`** (shared) — slide-in side panel used by Customer Management to show order history + favorites + recommendations; can be reused later for other entity detail views. Props: `isOpen`, `onClose`, `title`, `children`.
- All overlays use `position: fixed` with a backdrop, trap focus (basic — not a full focus trap library), close on `Esc`, close on backdrop click.

**Rationale**: The project has no existing modal/drawer abstraction — each page that uses one rolls its own (e.g. `Inventory.jsx`'s inline modal). Building three small reusable components costs little and keeps the six new pages visually consistent.

**Alternatives considered**:
- *Headless UI / Radix* — adds a dependency; current project has none of these. Skip until justified.
- *Inline per-page modals* — rejected; would diverge visually and behaviorally.

---

## Decision 7 — Filter-aware bulk apply (FR-013)

**Decision**: The pricing page keeps the *currently displayed* recommendations in a derived state value `visibleRecommendations` (computed from `allRecommendations` and the active filter). The "apply all" button, the bulk-apply confirmation modal, and the apply request body all operate on `visibleRecommendations` only. The confirmation modal renders a sentence of the form "Apply 12 suggested increases to currently displayed dishes?" derived from `visibleRecommendations.length` and the filter name.

**Rationale**: Single source of truth for "what is being acted on" — the same array drives the UI count, the confirmation copy, and the request payload. There is no code path where the user could see one count on screen and a different count get applied.

**Alternatives considered**:
- *Apply against backend filter* — rejected; the filter is a frontend concern and the backend should apply exactly what it is told.
- *Two buttons (Apply visible / Apply all)* — rejected during clarification.

---

## Decision 8 — Customer tag derivation location (FR-023)

**Decision**: Compute the three customer tags (`Regular`, `High Value`, `At Risk`) **server-side** in the customer list and detail endpoints, returning each customer with a `tags: string[]` field. The "top 20% lifetime spend" cutoff requires a population-level percentile that the frontend cannot compute without fetching every customer.

**Rationale**:
- "Top 20%" is a population statistic; computing it client-side requires the full customer list, which defeats pagination later and double-fetches today.
- Order count windows and last-order-date are simple enough to compute either side, but co-locating with the percentile rule keeps tag logic in one place.
- The server can also cache the top-20% spend cutoff per request rather than recomputing per customer.

**Alternatives considered**:
- *Frontend computation* — rejected per population-statistic argument above.
- *Materialized tags stored on the customer document* — premature; tags are fast to compute and would require recomputation cron infrastructure.

**Implication for the backend**: `GET /customers` and `GET /customers/:id` populate `tags` in the response. The endpoint must (1) fetch all customers' lifetime spend totals or pull from a sales aggregation, (2) compute the 80th-percentile cutoff once, (3) tag each customer in the response.

---

## Decision 9 — Forecast spike threshold (FR-008)

**Decision**: Computation is **server-side** in the forecast response. The `POST /api/ai/forecast` response includes a per-day `historicalAverage` field and a top-level `spikeAlert: { triggered, dishName, peakDay, peakQuantity, baseline } | null` field. The page renders the alert banner if `spikeAlert.triggered === true` without doing any threshold math itself. If the dish has fewer than 14 days of history, the response sets `spikeAlert: null` and includes `historyStatus: 'insufficient'` so the page can show the "insufficient history for spike detection" note.

**Rationale**: Putting the threshold in one place (the AI service) means the rule cannot drift between the alert and the chart. The frontend is then a pure renderer.

**Alternatives considered**:
- *Frontend computation* — risks the chart and the alert disagreeing if the trailing-30-day window is computed differently in two places.

---

## Decision 10 — Sidebar navigation registration (FR-034)

**Decision**: Add six new entries to `Client/src/components/Data.jsx` (the `SidebarData` array). The existing `Sidebar.jsx` already filters entries by `roles`, so adding role-scoped entries is the only change needed.

| Heading | Path | Roles |
|---|---|---|
| Menu | `/admin/menu` | `["admin"]` |
| Users | `/admin/users` | `["admin"]` |
| Forecast | `/ai/forecast` | `["admin"]` |
| Pricing | `/ai/pricing` | `["admin"]` |
| Customers | `/customers` | `["admin", "staff"]` |
| Waste | `/waste` | `["admin"]` |

**Rationale**: Reuses the project's already-working pattern; no Sidebar logic changes required.

**Alternatives considered**:
- *New "Admin" submenu group* — visually nicer but the Sidebar component does not yet support nested groups; out of scope for this feature.

---

## Decision 11 — Role-aware route guards (FR-005, FR-020, FR-030)

**Decision**: Extend `Client/src/routes/ProtectedRoute.jsx` to accept an optional `roles?: string[]` prop. When `roles` is provided, the component checks `user.role` against it and `<Navigate to="/dashboard" />` redirects unauthorized users (instead of `<Navigate to="/" />`, which is for unauthenticated users). Existing call sites that pass no `roles` keep their current behavior.

**Rationale**: Centralizes RBAC at the route boundary, satisfying FR-030's "redirected before any page content is fetched or rendered" requirement. One-line change to `ProtectedRoute`; six route-registration call sites pass `roles={['admin']}` (or `['admin','staff']` for Customers).

**Alternatives considered**:
- *Per-page role check inside each component* — rejected; partial render before redirect violates FR-030.
- *Separate `<AdminRoute>` and `<StaffRoute>` components* — rejected; more files for the same outcome.

---

## Decision 12 — Manual verification rather than automated tests

**Decision**: This feature delivers the six pages with **manual** acceptance verification per `quickstart.md`. Automated frontend test infrastructure (Vitest + React Testing Library) is the explicit scope of P5 in `smart_restaurant_speckit_plan.md`.

**Rationale**: Per the source plan, P5 introduces frontend testing as a dedicated phase. Pulling that work into this feature would expand scope significantly (config, mocks for axios, jsdom setup) without changing the user-facing outcome. The spec's success criteria (SC-001 through SC-011) are all behaviors observable through manual verification.

**Implication**: The manual quickstart must be complete and executable; reviewers can re-run it. Backend additive endpoints (`GET /auth/users`, `GET /customers`, `GET /customers/:id`) should ideally get supertest coverage as part of P5's API-test sweep.

---

## Resolved unknowns

| Original unknown | Resolution |
|---|---|
| How to detect concurrent edits without changing axios | Decision 1 (numeric `version` field in body) |
| Where loading/empty/error visuals live | Decision 2 (shared components) |
| How to keep partial page rendering when AI fails | Decision 3 (region-level error mapping) |
| Which Recharts components per chart | Decision 4 (table) |
| Where CSV is generated for forecast export | Decision 5 (client-side from local state) |
| Modal / drawer abstraction | Decision 6 (three shared components) |
| Bulk apply scope under filter | Decision 7 (single derived `visibleRecommendations` array) |
| Where customer tags get computed | Decision 8 (server-side; needs population statistic) |
| Where forecast spike threshold is evaluated | Decision 9 (server-side, in forecast response) |
| Sidebar registration | Decision 10 (six new `SidebarData` entries) |
| Where RBAC enforcement lives | Decision 11 (ProtectedRoute roles prop) |
| Frontend test approach for this feature | Decision 12 (manual; automated is P5) |

No NEEDS CLARIFICATION remain.
