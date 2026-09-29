# Feature Specification: Fix All Backend Bugs & Missing Endpoints

**Feature Branch**: `002-backend-bug-fixes`
**Created**: 2026-04-27
**Status**: Draft
**Input**: User description: "Read smart_restaurant_speckit_plan.md file and create specification for P1 — Fix All Backend Bugs & Missing Endpoints"

## Clarifications

### Session 2026-04-27

- Q: Password-change policy for `PATCH /api/auth/update-password` (FR-012, FR-013, US4)? → A: **Stronger than the existing register policy.** The new password MUST be at least 8 characters AND contain at least one letter AND at least one digit AND differ from the current password. The register-flow policy (`min 8` only) remains unchanged for account creation; the stricter rule applies only to password *changes*. Server-side bcrypt hashing of the new value is unconditional.
- Q: Email-change semantics on `PATCH /api/auth/update-profile` (FR-011, FR-014, US4)? → A: **Email changes are deferred** to a separate email-verification flow that is out of scope for this phase. The profile-update endpoint accepts direct writes for `name`, `phone`, and `avatar` only. A request that includes an `email` value different from the authenticated user's current email MUST be rejected with HTTP 400 and a clear "email changes require the email-verification flow (not yet available)" message. Email-uniqueness enforcement is consequently NOT exercised inside this phase, but the endpoint MUST NOT silently accept and discard the field — the request fails so the client knows the change did not happen.
- Q: Validation depth for the order-create schema (FR-002, FR-003, US1)? → A: **Shape + existence + stock fulfillability.** Validation runs as a pipeline before the controller and rejects, at the validation boundary: (i) any payload that fails shape validation (ObjectId format, enum values, required fields); (ii) any `items.dish` that does not resolve to a real, available Dish; (iii) any optional `customer` that does not resolve to a real Customer when supplied; (iv) any order whose ingredient requirements (computed from each dish's `ingredients[]` × item `quantity`) cannot be fulfilled from current ingredient stock. Stock-out orders MUST be rejected at validation time — never after a partial deduction.
- Q: Should `GET /api/inventory/export` respect query filters (FR-006, US5)? → A: **Yes, fully.** The export MUST respect the same `search` and `category` filters as `GET /api/inventory`, AND additionally accept `?lowStock=true` and `?nearExpiry=true` flags that route to the existing inventory service methods (`getLowStockIngredients`, `getNearExpiryIngredients`). With no filters, the response is the full inventory; with filters, it is the matching subset — "export what I was just looking at" semantics. Filters compose: `?category=Produce&lowStock=true` returns produce items currently below their minimum stock.
- Q: Delivery mechanism for the legacy `'competed'` order integrity report (FR-004, US1)? → A: **A new admin-only endpoint**: `GET /api/orders/integrity-report`. Returns `{ count, orderIds[] }` for orders whose persisted `status` is the legacy typo value. Read-only; no automatic remediation, no destructive actions. Protected by the existing `protect` + `restrictTo('admin')` middleware (same gating as `PATCH /api/auth/users/:id/status`). Calling the endpoint repeatedly is safe and idempotent.

## User Scenarios & Testing *(mandatory)*

<!--
  Each user story below is an INDEPENDENTLY TESTABLE slice of the bug-fix
  feature. P1 stories are crash-class or silently-broken-feature defects
  that cause user-visible failures today; P2 stories are integrity gaps
  that allow corrupt data to enter the system; P3 stories are
  architectural / configuration cleanup whose user-visible impact is
  smaller but whose absence weakens the maintainability of the product.
-->

### User Story 1 - Trustworthy Order Lifecycle (Priority: P1)

A staff member or POS terminal creates a new order and expects that order to
appear on the kitchen pipeline as **pending**, then progress through
*preparing → completed* (or be **cancelled**). Today, every newly created
order is born with an invalid status string that is not part of the allowed
status set, which corrupts the kitchen workflow and the sales reports built
on top of order status. In the same lifecycle, when an order is submitted
without required fields (no items, missing payment method, malformed
identifiers), the system silently persists an unusable record. Both gaps
must be closed so that "the order I just placed" is always a well-formed
record in a known state.

**Why this priority**: Order data is the spine of the restaurant — it
drives the kitchen queue, inventory deduction, sales analytics, ETL
pipelines, and forecasting models. A wrong default and an absent input
contract together corrupt every downstream report and break the
status-flow UI. This must land first.

**Independent Test**: Place a valid POS order with at least one item via
the orders API and confirm the persisted record has `status = "pending"`
and is visible on the kitchen pipeline. Separately, submit a malformed
order (missing items, unknown payment method, invalid customer reference,
non-existent dish, or stock-out fulfillment) and confirm each is rejected
with a clear validation error before any DB write or ingredient
deduction. Finally, as an admin, call `GET /api/orders/integrity-report`
and confirm the returned shape is `{ count, orderIds[] }`.

**Acceptance Scenarios**:

1. **Given** the orders API is reachable and a valid item set is supplied,
   **When** a new order is created without explicitly specifying status,
   **Then** the persisted order has `status = "pending"` (one of the
   model's allowed enum values), appears on the kitchen pipeline, and is
   eligible for the *preparing → completed* transitions.
2. **Given** a request to create an order omits the items array (or
   submits an empty array),
   **When** the request is validated,
   **Then** the API rejects the request with HTTP 400 and a clear message
   identifying the missing/invalid field; no order document is written.
3. **Given** a request to create an order specifies an unknown
   `paymentMethod` or `source` value (one not in the allowed enum),
   **When** the request is validated,
   **Then** the API rejects the request with HTTP 400 and a per-field
   validation error.
4. **Given** a request to create an order specifies a `customerId` that
   is not a valid identifier,
   **When** the request is validated,
   **Then** the API rejects the request with HTTP 400 before any DB write.
5. **Given** a request to create an order references a `dish` id that
   has valid ObjectId shape but does not resolve to any Dish record (or
   resolves to a Dish with `isAvailable: false`),
   **When** the request is validated,
   **Then** the API rejects with HTTP 400 and a "dish not found / not
   available" message; no order document is written.
6. **Given** a request to create an order whose item quantities require
   more of an ingredient than is currently in stock,
   **When** the request is validated,
   **Then** the API rejects with HTTP 400 and an "insufficient stock"
   message identifying which ingredient is short; no ingredient
   deduction occurs and no order document is written.
7. **Given** orders that already exist in the database with the legacy
   typo'd default status (`'competed'`),
   **When** an admin calls `GET /api/orders/integrity-report`,
   **Then** the response is `{ count, orderIds[] }` listing every such
   order, and the underlying records are NOT modified or rewritten.
8. **Given** a non-admin caller (staff or customer),
   **When** they call `GET /api/orders/integrity-report`,
   **Then** the request is rejected with HTTP 403 (admin-only surface).

---

### User Story 2 - Inventory Detail Page That Doesn't Crash (Priority: P1)

A manager opens an ingredient's detail view (or any caller hits
`GET /api/inventory/:id`) and expects to see the ingredient's data —
quantity on hand, unit, minimum stock, expiry, cost per unit. Today this
endpoint throws a server error every time because the controller
references an undefined identifier. Any UI that drills into a single
ingredient is therefore unusable.

**Why this priority**: This is a hard 500-class crash on a basic CRUD
read endpoint. It blocks every workflow that needs to inspect or edit a
single ingredient (the inventory edit modal, the reorder review screen,
any deep link).

**Independent Test**: Authenticate as admin or staff, request
`GET /api/inventory/:id` with a known-valid ingredient id, and confirm
HTTP 200 with the full ingredient record. Repeat with an unknown id and
confirm HTTP 404 with a clear "not found" message — never HTTP 500.

**Acceptance Scenarios**:

1. **Given** an authenticated admin or staff user and a valid ingredient
   id,
   **When** the user requests the ingredient detail endpoint,
   **Then** the system returns HTTP 200 with the complete ingredient
   record within 500 ms.
2. **Given** an authenticated admin or staff user and an unknown
   ingredient id,
   **When** the user requests the ingredient detail endpoint,
   **Then** the system returns HTTP 404 with `success: false` and a
   "not found" message — not a 500 ReferenceError.
3. **Given** an unauthenticated request,
   **When** the user requests the ingredient detail endpoint,
   **Then** the system returns HTTP 401 (preserving existing route
   protection — no regression).

---

### User Story 3 - Restore ETL & POS API Surfaces (Priority: P1)

The data team and the POS subsystem rely on dedicated API surfaces:
`/api/etl/*` for the analytics pipeline triggers and `/api/pos/*` for
the in-house simulator that drives demo data. Today, both route mounts
are commented out at the server entry point, so every call to either
namespace returns 404. The dashboard's deeper analytics never refresh,
and the POS demo cannot drive synthetic orders for the graduation walk-
through.

**Why this priority**: Two production-relevant feature areas are
silently disabled at the wiring layer. The implementation already
exists; the surfaces just are not mounted. Flipping these on restores
two complete subsystems for negligible risk.

**Independent Test**: Authenticate as the appropriate role and call any
endpoint under `/api/etl` and any endpoint under `/api/pos`. Confirm a
non-404 response and the documented response shape. Confirm that no
other route surface regressed.

**Acceptance Scenarios**:

1. **Given** the server starts cleanly,
   **When** an authorized request is made to any `/api/etl/*` endpoint,
   **Then** the request reaches the ETL handler (no 404), executes the
   pipeline action, and returns the documented response shape.
2. **Given** the server starts cleanly,
   **When** an authorized request is made to any `/api/pos/*` endpoint,
   **Then** the request reaches the POS simulator handler (no 404) and
   returns the documented response shape.
3. **Given** the previously mounted route surfaces (auth, menu, orders,
   inventory, dashboard, AI, sales, customers, recommendations,
   endorsements, pricing),
   **When** a smoke check is run after the change,
   **Then** every previously mounted surface continues to respond as
   before (no path-mounting regression).

---

### User Story 4 - Settings Page That Actually Saves (Priority: P1)

A signed-in user opens the Settings page and updates their profile
fields (name, phone, avatar) or their password. The page submits the
change and shows a success toast — but today the API endpoints behind
both forms do not exist. The frontend silently 404s, the user believes
the change was saved, and the next page reload reveals it was not. This
is a high-trust surface (the password form must be exactly correct) and
the silent failure is corrosive. **Email changes are explicitly out of
scope** for this phase: a separate email-verification flow will own
that path. Until that flow ships, the profile-update endpoint MUST
reject any attempt to change `email` so the client knows it cannot be
silently saved.

**Why this priority**: Authentication and account-management is a
critical-trust workflow. A silent-fail password change would be a
serious user-facing defect on any product, and the Settings page is one
of the only personalization touchpoints in the app today.

**Independent Test**: As any authenticated user, submit a profile
update with a new name (and optionally phone/avatar). Confirm HTTP 200,
the persisted user record reflects the new values, and the auth context
returns the new values on the next `/auth/me` call. Submit a profile
update that *includes* an email different from the user's current
email and confirm the request is rejected with HTTP 400 and a clear
"email-verification flow not yet available" message. Separately,
submit a password update with the correct current password and a valid
new password meeting the change policy (≥ 8 chars, ≥ 1 letter, ≥ 1
digit, different from current). Confirm HTTP 200 and that the user can
subsequently log in only with the new password (and not with the old
one).

**Acceptance Scenarios**:

1. **Given** an authenticated user,
   **When** they submit a profile update with a valid `name` (and
   optionally `phone` and/or `avatar`) — and **no** `email` field, or
   an `email` field equal to their current email,
   **Then** the server persists the supplied fields, returns HTTP 200
   with the updated user record, and subsequent calls to `/auth/me`
   reflect the new values.
2. **Given** an authenticated user submits a profile update whose
   `email` value differs from their current email,
   **When** the update is validated,
   **Then** the server rejects with HTTP 400 and a clear
   "email changes require the email-verification flow (not yet
   available)" message; no fields — including `name`, `phone`,
   `avatar` — are persisted.
3. **Given** an authenticated user submits a password change,
   **When** the supplied `currentPassword` does not match the stored
   hash,
   **Then** the server rejects the request with HTTP 401 and a clear
   "current password incorrect" message; no password change happens.
4. **Given** an authenticated user submits a password change with the
   correct current password but a new password that fails the change
   policy (shorter than 8 chars, missing a letter, missing a digit, or
   equal to the current password),
   **When** the request is validated,
   **Then** the server rejects with HTTP 400 and a per-rule violation
   message; no password change happens.
5. **Given** an authenticated user submits a password change with the
   correct current password and a new password meeting the change
   policy (≥ 8 chars, ≥ 1 letter, ≥ 1 digit, different from current),
   **When** the request is processed,
   **Then** the new password is hashed via bcrypt (never stored in
   plaintext, never echoed in any response, never logged), the record
   is updated, the server returns HTTP 200, and a fresh login succeeds
   only with the new password.
6. **Given** an unauthenticated request,
   **When** either profile-update or password-update is invoked,
   **Then** the server rejects with HTTP 401 — these endpoints MUST be
   behind the same `protect` middleware as `/auth/me`.

---

### User Story 5 - Inventory CSV Export for Operations & Audit (Priority: P1)

A manager clicks "Export" on the Inventory page expecting a CSV download
they can open in Excel for a quick stock review, an auditor handoff, or
a supplier reorder draft. Today this button calls a backend endpoint
that does not exist, so it returns 404 and the user sees nothing —
another silent-failure UI button.

**Why this priority**: Inventory export is a real operational deliverable
(audit-trail evidence; supplier order prep) and the button already exists
on the frontend. Connecting an existing UI button to a missing endpoint
is a small surface-area fix with high visible value.

**Independent Test**: As an admin or staff user, call the inventory
export endpoint with no filters and confirm the response is a CSV
covering every ingredient. Repeat with `?search=tomato`,
`?category=Produce`, `?lowStock=true`, `?nearExpiry=true`, and a
combination (e.g., `?category=Produce&lowStock=true`). Each call MUST
return only the matching subset, mirroring the corresponding existing
inventory views. Confirm correct CSV escaping for names/categories
containing commas, quotes, or newlines.

**Acceptance Scenarios**:

1. **Given** the inventory contains at least one ingredient,
   **When** an authorized user calls the inventory export endpoint
   with no query filters,
   **Then** the response has Content-Type `text/csv`, a
   `Content-Disposition` filename hint, and a body containing a header
   row plus one row per ingredient with the documented columns: name,
   category, quantity, unit, minStock, costPerUnit, expiryDate,
   wasteQuantity.
2. **Given** the inventory contains a mix of categories and stock
   levels,
   **When** an authorized user calls the export with `?search=tomato`,
   **Then** the response includes only ingredients whose name matches
   the search (same case-insensitive regex behavior as
   `GET /api/inventory`).
3. **Given** the inventory contains a mix of categories,
   **When** an authorized user calls the export with `?category=Produce`,
   **Then** the response includes only ingredients in that category.
4. **Given** some ingredients are below their `minStock`,
   **When** an authorized user calls the export with `?lowStock=true`,
   **Then** the response is exactly the set returned by the existing
   `getLowStockIngredients` service method, in the same column shape.
5. **Given** some ingredients have an `expiryDate` within the
   default expiry window,
   **When** an authorized user calls the export with `?nearExpiry=true`
   (with optional `?days=N` honored if supported by the existing
   service),
   **Then** the response is exactly the set returned by the existing
   `getNearExpiryIngredients` service method, in the same column shape.
6. **Given** filters compose,
   **When** an authorized user calls the export with
   `?category=Produce&lowStock=true`,
   **Then** the response includes only Produce ingredients currently
   below their minimum stock.
7. **Given** an ingredient name or category contains commas, quotes, or
   newlines,
   **When** the inventory is exported (with or without filters),
   **Then** the offending fields are CSV-escaped per RFC 4180 so the
   output opens cleanly in Excel and Google Sheets without column
   misalignment.
8. **Given** the inventory is empty (or the filtered subset is empty),
   **When** the export is called,
   **Then** the response is a CSV with only the header row and HTTP 200
   (not a 204 or an error).
9. **Given** an unauthenticated or insufficiently authorized request,
   **When** the export endpoint is called,
   **Then** the request is rejected with HTTP 401/403 — the export
   surface MUST inherit the same role gating as the other inventory
   read endpoints (admin and staff only).

---

### User Story 6 - Menu Module Data Integrity & Architecture (Priority: P2)

A manager creates or edits a dish (name, description, category, price,
ingredients with quantities). Today the menu controller talks directly
to the Dish model with no input validation: a request missing `name`,
specifying a negative price, or with malformed ingredient references can
write a corrupt dish. The controller also bypasses the project-wide
service-layer pattern that every other module follows, which makes it
impossible to test menu logic without spinning up Express and Mongo. Both
gaps are closed in this slice: (a) menu inputs are validated against a
schema before the controller runs, and (b) all dish DB operations are
moved into a `menu.service.js` so the controller becomes a thin HTTP
adapter, matching the inventory/order/customer pattern.

**Why this priority**: Menu corruption is operationally damaging but
slower-burn than the P1 crashes — invalid prices and missing names show
up downstream rather than at submission time. The architectural fix is
prerequisite work for P5 (the test suite), since an untestable
controller can't meet coverage targets.

**Independent Test**: Submit a malformed menu create request (missing
name, negative price, or malformed ingredient list) and confirm HTTP 400
with a per-field validation error before any DB write. Submit a
well-formed request and confirm the dish is created. Separately, run
the menu service's unit tests against an in-memory database and confirm
they pass without any HTTP layer, demonstrating that the service layer
is independently testable.

**Acceptance Scenarios**:

1. **Given** a request to create a dish with a missing or empty `name`,
   **When** the request is validated,
   **Then** the API rejects with HTTP 400 and a clear "name is required"
   message; no dish document is written.
2. **Given** a request to create a dish with a negative or non-numeric
   `price`,
   **When** the request is validated,
   **Then** the API rejects with HTTP 400 and a clear "price must be a
   non-negative number" message.
3. **Given** a request to create a dish with an `ingredients` array
   whose elements are missing the required `{ ingredient, quantity }`
   shape,
   **When** the request is validated,
   **Then** the API rejects with HTTP 400 and a per-element validation
   error.
4. **Given** the menu module's CRUD handlers exist,
   **When** the controller is inspected,
   **Then** none of the HTTP handlers calls the Dish model directly —
   every database read or write is routed through the menu service —
   matching the pattern used by inventory, order, and customer modules.
5. **Given** a unit-test runner is pointed at the menu service,
   **When** create / read / update / delete tests are executed,
   **Then** every test passes against an in-memory database without
   booting Express or any HTTP layer.

---

### User Story 7 - Centralized AI Service Configuration (Priority: P3)

A developer configuring the deployment changes a single environment
variable to point the API server at a different ML inference host (for
staging vs. local vs. demo) and expects every AI/ML caller in the API
server to honor the new host. The AI service config module exists for
exactly this purpose. The expected outcome of this slice is that the
`infrastructure/config/ai.js` module is the single source of truth for
the ML base URL and timeout, that every Node-side ML caller goes through
that config (directly or via `ml-client.js`), and that no ML host or
port is hardcoded anywhere else in the API server.

**Why this priority**: This is internal cleanup. Misconfiguration would
cause a noticeable error to operators but does not corrupt data or crash
the user-facing app. It earns its place in this phase because re-running
the inventory/menu fixes without it leaves a known-broken configuration
story unresolved going into later phases.

**Independent Test**: Change the `ML_SERVICE_URL` environment variable
and restart the API server. Confirm every Node-side ML caller honors
the new URL (e.g., by intercepting outbound HTTP from the API server
during a triggered ML call). Grep the API-server source tree for any
hardcoded `5002`, `8000`, or `localhost:5002` strings outside the
config module — none MUST exist.

**Acceptance Scenarios**:

1. **Given** the `ML_SERVICE_URL` environment variable is set to a
   non-default value,
   **When** the API server starts and any AI endpoint is called,
   **Then** the outbound HTTP request goes to the configured URL — not
   to a hardcoded fallback.
2. **Given** the API-server source tree,
   **When** it is statically scanned for hardcoded ML host or port
   literals (`5002`, `8000`, `localhost:5002`, etc.) outside the
   `infrastructure/config/ai.js` module and the `.env.example` file,
   **Then** zero matches are found.
3. **Given** the `ai.js` config module is missing or malformed,
   **When** the API server starts,
   **Then** startup fails with a clear configuration error — not a
   silent fallback to a wrong port.

---

### Edge Cases

- A new order request omits both `items` and `totalPrice` → rejected
  with a per-field validation error before any DB write.
- A new order request specifies a `customer` that does not exist (valid
  ObjectId shape, no matching record) → the order is rejected with HTTP
  400 with a "customer not found" message; no orphaned order is written.
- A new order request references a `dish` whose ObjectId is well-formed
  but does not match any Dish (or matches a Dish with
  `isAvailable: false`) → rejected at level (b) with a "dish not
  found / not available" message before any DB write or ingredient
  deduction.
- A new order request would consume more of an ingredient than is
  currently in stock (computed as the sum of dish-ingredient
  requirements × item quantities) → rejected at level (d) with an
  "insufficient stock" message identifying the short ingredient; no
  partial ingredient deduction is performed.
- Two valid orders are submitted concurrently and each, in isolation,
  is fulfillable but together exceed available stock → at least one
  MUST fail when its stock check runs against the post-deduction state
  of the other. This spec does NOT authorize a new locking mechanism;
  the existing transactional behavior of the order service governs.
- A profile update arrives with no fields besides an `email` equal to
  the user's current email → the request is treated as a no-op on the
  email field; if `name`/`phone`/`avatar` are also supplied, they are
  persisted; otherwise HTTP 200 idempotently with no change.
- A profile update arrives with `email` equal to the current user's
  email but spelled with different casing (e.g., `Foo@x.com` vs.
  `foo@x.com`) → treated as equal (case-insensitive comparison), no
  rejection.
- A password-change request supplies a new password that satisfies
  every rule in the change policy except that it equals the current
  password → rejected with HTTP 400 and a "must be different from
  current password" message.
- A password-change request supplies a new password matching length
  but consisting of all letters or all digits → rejected with HTTP
  400 and a per-rule message identifying the missing character class.
- A status-update request attempts to move an order from `cancelled` to
  `preparing` → rejected as an invalid transition, separate from the
  status-default fix (transition rules are existing behavior; nothing in
  this spec authorizes their removal).
- The legacy typo'd default value (`'competed'`) appears in pre-existing
  records → those records are surfaced via the new admin-only
  `GET /api/orders/integrity-report` endpoint and remediated manually
  (e.g., by a one-off DB script the operator runs after reviewing the
  report); this spec does NOT authorize automatic mass rewrites.
- A profile update is sent with no writable fields changed (e.g., only
  fields equal to their existing values, or an empty body) → returns
  HTTP 200 idempotently; no audit-log churn beyond a single update
  entry.
- Inventory export is called while a long-running ingestion job holds a
  write lock → the export reads from the same database snapshot and
  succeeds; this spec does NOT authorize new locking behavior.
- The CSV export contains a numeric field that exceeds Excel's text-
  format heuristics (e.g., a long phone-like cost code) → the field is
  emitted as quoted text per RFC 4180 to prevent silent re-formatting.
- A menu create request omits the `ingredients` field entirely → if
  ingredients are required by the existing schema, the request is
  rejected; if optional, the dish is created with an empty ingredient
  list — the validation schema MUST mirror whatever the existing Dish
  model already enforces, not redefine domain rules.
- A request to a re-enabled `/api/etl/*` or `/api/pos/*` endpoint that
  hits an internal handler-level failure → returns the existing handler's
  error response (this fix does not silence handler-level errors; it
  only re-mounts the surface).
- The ML inference service is unreachable → AI endpoints already return
  an explicit error (see 001-real-ai-ml-engine spec); the centralized
  config change MUST NOT alter that contract.

## Requirements *(mandatory)*

### Functional Requirements

#### Order Lifecycle Integrity (US1)

- **FR-001**: The Order model MUST set `status = "pending"` as the
  default for any newly created order whose status is not explicitly
  supplied. The default value MUST be one of the model's allowed enum
  values (`pending`, `preparing`, `completed`, `cancelled`).
- **FR-002**: The orders API MUST validate every incoming order-create
  request through a pipeline before any database write or ingredient
  deduction. The pipeline MUST cover four levels in sequence:
  (a) **Shape** — non-empty `items` array, each item having a valid
  ObjectId-shaped `dish` and a positive integer `quantity`; a `source`
  value in the allowed enum; a `paymentMethod` value in the allowed
  enum; optional `customer` and `user` having valid ObjectId shape
  when supplied.
  (b) **Dish existence and availability** — every `items.dish` MUST
  resolve to a real Dish record AND that Dish MUST have
  `isAvailable: true`.
  (c) **Customer existence** — when `customer` is supplied, it MUST
  resolve to a real Customer record.
  (d) **Stock fulfillability** — for the proposed order, the system
  MUST compute the required quantity per ingredient (each dish's
  `ingredients[].quantity` × that item's `quantity`, summed across
  items) and MUST verify each required quantity is ≤ the
  corresponding ingredient's current `quantity`. Any shortfall MUST
  fail validation.
- **FR-003**: When any level of order-create validation fails, the API
  MUST return HTTP 400 with a per-field (or per-cause) error payload
  identifying which level failed (shape / dish / customer / stock) and
  MUST NOT write a partial or invalid order document and MUST NOT
  perform any ingredient deduction.
- **FR-004**: A new admin-only endpoint, `GET /api/orders/integrity-report`,
  MUST be added. It MUST return a JSON payload of the form
  `{ count: <number>, orderIds: [<id>...] }` listing every Order whose
  persisted `status` is the legacy typo value (`'competed'`). The
  endpoint MUST be read-only (no mutation, no automatic remediation),
  MUST be protected by the existing `protect` + `restrictTo('admin')`
  middleware, and MUST be safely repeatable (idempotent reads).

#### Inventory Detail & Export (US2, US5)

- **FR-005**: `GET /api/inventory/:id` MUST resolve the requested
  ingredient via the inventory service and MUST NOT depend on any
  identifier that is not imported in the controller. A request for an
  unknown id MUST return HTTP 404 with a "not found" message; no
  request MUST ever surface as a ReferenceError.
- **FR-006**: A new endpoint, `GET /api/inventory/export`, MUST be
  added behind the same role gating as the other inventory read
  endpoints (admin and staff). The response MUST be CSV, content type
  `text/csv`, with a `Content-Disposition` filename hint and the
  documented column set: name, category, quantity, unit, minStock,
  costPerUnit, expiryDate, wasteQuantity. The endpoint MUST honor the
  following query parameters, composing them with AND semantics:
  (i) `search` — case-insensitive name regex, identical to
  `GET /api/inventory?search=...`;
  (ii) `category` — exact category match, identical to
  `GET /api/inventory?category=...`;
  (iii) `lowStock=true` — routes through the existing
  `getLowStockIngredients` service method;
  (iv) `nearExpiry=true` — routes through the existing
  `getNearExpiryIngredients` service method (honoring an optional
  `days` parameter if the existing method supports one).
  With no query parameters, the response is the full inventory.
- **FR-007**: The CSV export MUST escape commas, quotes, and newlines
  per RFC 4180 so the output opens correctly in Excel and Google
  Sheets without column misalignment.
- **FR-008**: When the inventory is empty, the CSV export MUST return
  a header-only response with HTTP 200 (not 204, not an error).

#### Restored API Surfaces (US3)

- **FR-009**: The server entry point MUST mount the ETL routes at
  `/api/etl` and the POS routes at `/api/pos` so that requests to
  these namespaces are routed to their existing handlers instead of
  returning 404.
- **FR-010**: Re-mounting these surfaces MUST NOT regress any
  currently-mounted route surface (auth, menu, orders, inventory,
  dashboard, AI, sales, customers, recommendations, endorsements,
  pricing).

#### Settings Page Wiring (US4)

- **FR-011**: A new endpoint MUST be added: `PATCH /api/auth/update-profile`,
  protected by the existing auth middleware. It MUST accept partial
  updates of the authenticated user's profile across the writable field
  set: `name`, `phone`, `avatar`. It MUST persist only the fields
  supplied. Unrecognized fields MUST be ignored.
- **FR-011a**: The profile-update endpoint MUST reject any request
  whose `email` field is supplied with a value different from the
  authenticated user's current email, with HTTP 400 and a clear
  "email changes require the email-verification flow (not yet
  available)" message. A request that omits `email` entirely, or
  supplies `email` equal to the user's current email, MUST be
  accepted (treated as a no-op for the email field). When this
  rejection fires, NO supplied field — including `name`, `phone`,
  `avatar` — MUST be persisted; the request MUST fail atomically.
- **FR-012**: A new endpoint MUST be added: `PATCH /api/auth/update-password`,
  protected by the existing auth middleware. It MUST require both
  `currentPassword` and `newPassword` in the request body. The
  `currentPassword` MUST be verified against the stored bcrypt hash; on
  mismatch, the API MUST return HTTP 401 and MUST NOT update the
  password.
- **FR-012a**: The `newPassword` MUST satisfy the password-change
  policy: (i) length ≥ 8 characters, (ii) at least one letter
  (`[A-Za-z]`), (iii) at least one digit (`[0-9]`), (iv) MUST NOT
  equal the current password. Any rule violation MUST cause an HTTP
  400 rejection with a per-rule error message and MUST NOT update the
  password. The existing register-flow policy (`min 8` only) is
  unchanged for account creation; the stricter policy applies only to
  password changes.
- **FR-013**: When the password update succeeds, the new password MUST
  be hashed (bcrypt) and stored — the plaintext password MUST never
  be persisted, logged, or returned in any response payload.
- **FR-014**: Within this phase, the profile-update endpoint does NOT
  enforce email-uniqueness because email changes are deferred (see
  FR-011a). When the email-verification flow is built in a later
  phase, that flow MUST own the uniqueness check at the verified-write
  boundary; this spec explicitly does not authorize partial
  enforcement.
- **FR-015**: Both new endpoints MUST be unreachable without a valid
  authenticated session (HTTP 401 otherwise), matching the protection
  level of `/api/auth/me`.

#### Menu Module Validation & Architecture (US6)

- **FR-016**: A menu validation schema MUST be created and applied to
  the create and update routes, validating: `name` (required, non-empty
  string), `price` (required, non-negative number), `category`
  (required), `ingredients` (when present, an array of
  `{ ingredient, quantity }` shaped objects with a valid id and
  positive quantity).
- **FR-017**: When a menu create or update request fails validation,
  the API MUST return HTTP 400 with a per-field error payload and MUST
  NOT write a partial or invalid dish document.
- **FR-018**: A `menu.service.js` MUST be added in the application
  services layer and MUST own every database read and write currently
  performed directly by the menu controller (find, findById,
  findByIdAndUpdate, findByIdAndDelete, populate). The controller MUST
  call the service for every database interaction — no direct Dish
  model access from the controller.
- **FR-019**: The menu service MUST be unit-testable in isolation
  against an in-memory database without booting Express or the HTTP
  layer.
- **FR-020**: Existing menu API behavior (response shapes, status
  codes, role gating) MUST be preserved by the refactor; the service
  extraction MUST be behavior-preserving for the contract clients
  already use.

#### AI Service Configuration (US7)

- **FR-021**: The `infrastructure/config/ai.js` module MUST be the
  single source of truth in the API server for the ML service base
  URL and timeout. Every API-server caller of an ML endpoint MUST
  obtain the URL via this config (directly or via the
  `ml-client.js` axios instance built on top of it) — no hardcoded
  ML host or port string MUST appear anywhere else in the API-server
  source tree.
- **FR-022**: When `ML_SERVICE_URL` is set in the environment, the
  API server MUST honor it for every outbound ML call. When it is
  absent, the documented fallback (per `.env.example`) MUST be used.
- **FR-023**: A static check (grep or equivalent) for hardcoded ML
  host literals (`5002`, `8000`, `localhost:5002`) outside the
  `infrastructure/config/ai.js` module and the `.env.example` file
  MUST yield zero matches.

#### Cross-Cutting

- **FR-024**: Every new endpoint added by this spec
  (`PATCH /api/auth/update-profile`, `PATCH /api/auth/update-password`,
  `GET /api/inventory/export`) MUST be protected by the same auth and
  role-gating middleware patterns used by the surrounding endpoints in
  its module — this spec does NOT authorize introducing a new
  authentication or authorization mechanism.
- **FR-025**: Every fix in this spec MUST preserve the existing
  request/response contract of every endpoint it does not explicitly
  add or modify; no breaking changes to public API shapes are
  authorized by this work.

### Key Entities

- **Order**: Domain record for a customer order. The default value of
  its `status` field is corrected from the typo'd value to a valid
  enum member; no schema-shape change beyond that, and no rewrite of
  pre-existing records.
- **Order Validation Pipeline**: A new server-side, four-level
  validation pipeline that runs before the create-order controller —
  shape (Joi), dish existence and availability, customer existence
  (when supplied), and stock fulfillability against current ingredient
  quantities — rejecting at the first failing level.
- **Order Integrity Report**: The behavior layer behind the new
  admin-only `GET /api/orders/integrity-report` endpoint — a
  read-only count and id-list of Order records whose persisted
  `status` is the legacy typo value (`'competed'`).
- **Menu Validation Schema**: A new server-side input contract
  validating the create- and update-dish payloads — name, price,
  category, ingredients shape — applied as a middleware before the
  menu controller runs.
- **Menu Service**: A new application-layer service module that owns
  every database read and write for dishes, mirroring the inventory /
  order / customer service pattern. The menu controller becomes a thin
  HTTP adapter over this service.
- **User Profile Update**: The behavior layer behind the
  `PATCH /api/auth/update-profile` endpoint — partial update of the
  authenticated user's `name`, `phone`, and `avatar` fields. Within
  this phase, any attempted email change is rejected; the dedicated
  email-verification flow that will own that path is out of scope.
- **User Password Update**: The behavior layer behind the
  `PATCH /api/auth/update-password` endpoint — current-password
  verification, change-policy enforcement (≥ 8 chars, ≥ 1 letter,
  ≥ 1 digit, must differ from current), and a bcrypt-hashed write of
  the new password, never returning or logging plaintext.
- **Inventory CSV Export**: The behavior layer behind the
  `GET /api/inventory/export` endpoint — a buffered CSV rendering
  of the ingredient collection (or a query-filtered subset of it),
  with RFC 4180 escaping and the documented column set. Supports
  `search`, `category`, `lowStock`, and `nearExpiry` filters
  composing with AND semantics.
- **AI Service Config**: The single source of truth for the ML
  service base URL and timeout; every ML caller in the API server is
  routed through this config.
- **Mounted Route Surface**: The set of route namespaces mounted at
  the server entry point. The ETL and POS namespaces, currently
  commented out, are restored to the mounted set.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of newly created orders that omit an explicit status
  are persisted with `status = "pending"` (verified by automated test
  on every CI run).
- **SC-002**: 100% of order-create requests that violate any level of
  the validation pipeline are rejected with HTTP 400, and zero such
  requests result in a partial or invalid order document being written
  or in any ingredient deduction occurring (verified by automated test
  covering each level: shape, dish existence, customer existence, and
  stock fulfillability).
- **SC-002a**: An order-create request that references a non-existent
  or unavailable dish is rejected at validation time in 100% of test
  scenarios; no order document is written and no ingredient is
  deducted (verified by automated test).
- **SC-002b**: An order-create request whose ingredient requirements
  exceed current stock is rejected at validation time in 100% of
  test scenarios; the per-cause error payload identifies the short
  ingredient (verified by automated test).
- **SC-002c**: `GET /api/orders/integrity-report` is reachable only
  for admin role and returns the documented `{ count, orderIds }`
  shape; non-admin callers receive HTTP 403; the underlying Order
  records are never modified by calling the endpoint (verified by
  automated test plus before/after document hash comparison).
- **SC-003**: 0 calls to `GET /api/inventory/:id` return HTTP 500 in
  smoke-test scenarios for both valid and invalid identifiers; valid
  ids return 200 with the full record, unknown ids return 404
  (verified by automated test).
- **SC-004**: After deployment, calls to any endpoint under `/api/etl/*`
  and `/api/pos/*` no longer return 404 from the routing layer; their
  documented response shapes are returned (verified by smoke test).
- **SC-005**: 100% of profile-update requests that supply only valid
  writable fields (any subset of `name`, `phone`, `avatar`) persist
  the change such that a subsequent `/api/auth/me` call reflects the
  new values within one request cycle (verified by automated test).
- **SC-005a**: 100% of profile-update requests that supply an `email`
  value different from the user's current email are rejected with
  HTTP 400; in those rejection cases, 0 fields (including
  `name`/`phone`/`avatar`) are persisted (verified by automated test
  with before/after document comparison).
- **SC-006**: 100% of password-update requests with an incorrect
  current password are rejected with HTTP 401, no password write
  occurs, and the user can still log in with their existing password
  (verified by automated test).
- **SC-006a**: 100% of password-update requests that fail any rule of
  the change policy (length ≥ 8, ≥ 1 letter, ≥ 1 digit, differs from
  current) are rejected with HTTP 400 and a per-rule violation
  message; no password is written (verified by automated test that
  exercises each violation independently).
- **SC-007**: 100% of password-update requests that succeed result in
  a fresh login succeeding only with the new password and not with the
  old one; 0 plaintext passwords appear in logs, response payloads, or
  database documents (verified by automated test plus a log scan).
- **SC-008**: `GET /api/inventory/export` returns a CSV that opens in
  Excel and Google Sheets with correct column alignment for ingredients
  whose names or categories include commas, quotes, or newlines
  (verified by automated parse-roundtrip test).
- **SC-008a**: `GET /api/inventory/export` honors `search`, `category`,
  `lowStock`, and `nearExpiry` query filters with AND-composition
  semantics: the exported row set MUST exactly match the row set
  returned by the corresponding `GET /api/inventory` call (or the
  corresponding low-stock / near-expiry service method) for every
  filter combination tested (verified by automated set-equality test
  on at least 6 filter combinations including the unfiltered case).
- **SC-009**: 100% of menu-create and menu-update requests that violate
  the new schema are rejected with HTTP 400 and zero such requests
  result in a partial or invalid dish document being written (verified
  by automated test).
- **SC-010**: The menu controller contains 0 direct calls to the Dish
  model; every database interaction is delegated to the menu service
  (verified by static analysis or code review checklist).
- **SC-011**: A unit-test suite targeting the menu service achieves at
  least 80% line and branch coverage and runs without booting Express
  or the HTTP layer (verified by coverage report).
- **SC-012**: 0 hardcoded ML host or port literals (`5002`, `8000`,
  `localhost:5002`) appear anywhere in the API-server source tree
  outside `infrastructure/config/ai.js` and `.env.example` (verified
  by an automated grep check on every CI run).
- **SC-013**: Every endpoint that existed and worked before this
  feature continues to return the same response shape and status code
  for the same inputs after this feature ships (verified by an API
  contract regression test).

## Assumptions

- The codebase already provides:
  - `bcrypt` (or equivalent) for password hashing and comparison
    (used by the existing register/login flow).
  - `Joi` (or an equivalent validation library) used by the existing
    `auth.validation.js` and `inventory.validation.js` schemas.
  - `protect` and `restrictTo` middleware factories already in use
    across modules; this spec reuses them and does NOT introduce a
    new auth mechanism.
  - The `inventoryService`, existing `userService` (or equivalent),
    and existing controller patterns from inventory / order /
    customer modules — the menu service extraction matches that
    pattern.
- The existing Dish, Order, User, and Ingredient model schemas remain
  authoritative for domain shape. This spec adds *server-side input
  validation in front of the controllers*; it does NOT redefine the
  domain rules already enforced by Mongoose.
- The frontend already calls the missing endpoints
  (`PATCH /auth/update-profile`, `PATCH /auth/update-password`,
  `GET /inventory/export`) with the expected request bodies; this
  feature delivers the matching server endpoints. Any frontend-side
  wiring corrections are scoped to the P4 polish phase, not this one.
- The legacy typo'd order status value (`'competed'`) is rare enough
  in the production database that a manual remediation pass is
  acceptable — automated mass rewrites are explicitly NOT in scope
  because they would conflict with audit-trail expectations from
  001-real-ai-ml-engine.
- The CSV export is a one-shot synchronous response. Streaming /
  pagination of very large inventories is out of scope at the
  pilot-scale envelope (≤ 200 dishes implies an ingredient catalog
  small enough for a buffered response).
- The "centralize AI service configuration" cleanup applies only to
  the API server (Node side). The Python ML service has its own
  configuration story owned by the 001-real-ai-ml-engine feature and
  is unaffected by this spec.
- This phase strictly delivers backend bug fixes and missing
  endpoints. New frontend pages, the notification system, the test
  suite buildout, and the polish/stub work are scoped to P2, P3, P4,
  and P5 respectively and are out of scope here.

## Dependencies

- The `protect` and `restrictTo` middleware factories used across the
  existing API surface MUST remain available unchanged. This spec
  reuses them on the new endpoints.
- The User model MUST already expose a bcrypt-hashed password field
  and a `comparePassword`-style method (or be amenable to comparison
  via the bcrypt library directly), as used by the existing login
  flow.
- The Dish, Order, Ingredient, and User model schemas as currently
  defined are the authority on domain shape; the new validation
  schemas mirror those models, not redefine them.
- The existing inventory, order, customer, and auth services
  establish the pattern that the new menu service follows; that
  pattern MUST remain consistent across modules after this feature
  lands.
- A CSV-emit utility (e.g., `json2csv` or an equivalent library, or a
  small in-house helper) MUST be available for the inventory export.
  Choice of library is an implementation detail; the contract is the
  RFC-4180 escaping requirement (FR-007).
- The 001-real-ai-ml-engine feature's AI service contracts MUST
  remain unchanged by the configuration centralization in US7 — that
  spec's behavior is the authoritative description of AI endpoint
  behavior.
