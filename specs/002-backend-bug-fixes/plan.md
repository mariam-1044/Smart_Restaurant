# Implementation Plan: Fix All Backend Bugs & Missing Endpoints

**Branch**: `002-backend-bug-fixes` | **Date**: 2026-04-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-backend-bug-fixes/spec.md`

## Summary

Close nine confirmed defects and add three missing surfaces in the
existing Node.js / Express / Mongoose backend. Crash-class and
silent-failure defects (US1–US5) are P1 and ship first: fix the Order
status default typo, add a four-level order-create validation pipeline
(shape → dish existence → customer existence → stock fulfillability),
add an admin-only `GET /api/orders/integrity-report` for legacy
`'competed'` records, restore the `getById` path on
`GET /api/inventory/:id`, add a query-filter-aware
`GET /api/inventory/export` (CSV, RFC 4180), un-comment the
`/api/etl/*` and `/api/pos/*` route mounts, and ship
`PATCH /api/auth/update-profile` (name/phone/avatar only — email
changes deferred) and `PATCH /api/auth/update-password` (stricter
change policy: ≥ 8 chars + ≥ 1 letter + ≥ 1 digit + must differ from
current). P2 closes the menu module's data-integrity and architecture
gaps with a Joi schema and a new `menu.service.js` extracting all DB
access from the controller. P3 enforces single-source AI service
configuration in the API server. No changes to the React client, the
Python ML service, or the existing AI/ML contracts.

## Technical Context

**Language/Version**:
- Node.js 20.x LTS (existing API server — no runtime change required).

**Primary Dependencies** (all already in `Server/package.json`):
- `express` 4.18 — routing & middleware.
- `mongoose` 8.x — ORM and schema-level domain rules (authoritative on
  Order, Dish, User, Ingredient shape).
- `joi` 18.x — request validation; pattern matches existing
  `auth.validation.js`, `inventory.validation.js`,
  `recommendation.validation.js`, `pricing.validation.js`,
  `ai.validation.js`.
- `bcryptjs` 2.x — password hashing (already used by login/register).
- `jsonwebtoken` 9.x — auth, via existing `protect`/`restrictTo`
  middleware factories.
- `axios` 1.x — already used by `Server/src/infrastructure/ml/ml-client.js`
  for ML service calls (touched by US7 only).
- **No new runtime dependency required.** CSV export uses a small
  in-house RFC-4180 escape helper (~30 LOC) — choosing this over
  `json2csv` keeps the dependency surface minimal and the escaping
  contract testable directly. (See research.md decision log.)

**Storage**: MongoDB (existing). **No schema changes** to existing
collections; the only modifications to a Mongoose model are correcting
the typo in `Order.js` line 14 (`'competed'` → `'pending'`) and
nothing else. No new collections are introduced by this phase.

**Testing**:
- Jest + supertest + `mongodb-memory-server` — already in
  `Server/package.json` devDependencies and already wired
  (`jest.config.js`, `jest.setup.js` exist; coverage script
  `npm run test:coverage` is registered).
- Coverage gate ≥ 80% lines/branches on the modules touched by this
  phase: `inventory.controller`, `inventory.service`,
  `inventory.routes`, `auth.controller`, `auth.routes`,
  `auth.validation`, `order.controller`, `order.service`,
  `order.routes`, `order.validation` (new), `menu.controller`,
  `menu.routes`, `menu.validation` (new), `menu.service` (new),
  `index.js` route-mount block.
- Static checks: a CI grep guard for hardcoded ML host literals
  (`5002`, `8000`, `localhost:5002`) outside `infrastructure/config/ai.js`
  and `.env.example` (per FR-023 / SC-012).

**Target Platform**: Linux server in production; cross-platform
(Windows, macOS, Linux) for development. No new runtime processes.

**Project Type**: Web application — backend-only patch slice. The
React client (`Client/`) and Python ML service
(`Server/ml_model_service/`) are intentionally untouched in this
phase.

**Performance Goals** (from spec SC-003 and the implicit baseline of
existing endpoints):
- `GET /api/inventory/:id` p95 ≤ 500 ms (FR-005, US2 acceptance #1).
- `GET /api/inventory/export` returns the full pilot-scale inventory
  (≤ 200 ingredients) within ≤ 1 s; filtered subsets correspondingly
  faster.
- Order-create validation pipeline overhead ≤ 100 ms additional p95
  beyond the existing controller path (the dish/customer/stock checks
  add at most ~3 small queries per request at pilot scale).
- No regression to any other endpoint's latency profile (SC-013).

**Constraints**:
- **No new public endpoints beyond the spec**: only the three new
  endpoints in the spec
  (`PATCH /api/auth/update-profile`,
  `PATCH /api/auth/update-password`,
  `GET /api/inventory/export`,
  `GET /api/orders/integrity-report`).
  No additional surface area.
- **Non-breaking**: every endpoint that already worked continues to
  return the same response shape and status code (FR-025, SC-013).
- **Atomic email rejection** (FR-011a): a profile-update request
  with a changed `email` field MUST persist zero fields, including
  `name`/`phone`/`avatar` — implemented as a pre-write check before
  any DB call.
- **Pipeline early-exit on order validation** (FR-002, FR-003): the
  validation pipeline rejects at the first failing level and reports
  *which* level failed, so the client can surface a meaningful error
  without engineering having to unpack a generic 400.
- **Append-only history is preserved** for AI/ML records (FR-021–023
  apply only to the API server's config; nothing in this phase
  touches the `price_history` or `ai_inference_audit` collections
  delivered by 001-real-ai-ml-engine).
- **Bcrypt invariants** (FR-013): every password write uses bcrypt;
  no plaintext on the wire, in the DB, or in any log line. The
  password-update test plan includes a log scan to enforce this.

**Scale/Scope**: Single-restaurant pilot (per 001 spec
Clarifications): ≤ 200 dishes, ≤ 5,000 customers, ≤ 500 orders/day.
Backend code added: 1 new validation file (`order.validation.js`),
1 new validation file (`menu.validation.js`), 1 new service file
(`menu.service.js`), 1 new service method (`inventoryService.getById`),
1 new export-CSV controller method + helper, 4 new auth-controller
methods (`updateProfile`, `updatePassword`, plus the
`integrity-report` controller method on the orders side), and ~8
total route-table edits. Total estimate: ≤ 600 LOC of production
code + ~1,200 LOC of tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The repository's `.specify/memory/constitution.md` is the placeholder
template (un-amended). This plan applies the **same set of seven
substantive principles** invoked by `001-real-ai-ml-engine/plan.md`,
which is the de-facto constitution governing this codebase:

| Principle | Compliance Plan | Status |
|-----------|----------------|--------|
| **I. Three-AI Spec-Driven Workflow** (NON-NEGOTIABLE) | This plan IS the Opus-stage spec for Kimi to implement. Each of the seven user stories maps to a small, independently shippable PR; each PR is reviewed under the third Claude pass before merge. | ✅ Pass |
| **II. Layered Service Architecture** | Bug 9 (US6) is the explicit fix for an existing violation — extracting `menu.service.js` so the controller stops calling `Dish` directly. Bug 2 (US2) requires adding `inventoryService.getById` so the controller stops referencing an un-imported model. Every new endpoint added by this phase (`updateProfile`, `updatePassword`, `export`, `integrity-report`) delegates to a service method; controllers remain thin HTTP adapters. Every write endpoint added by this phase has a Joi validator. | ✅ Pass |
| **III. Real Intelligence — Zero AI Mocks** (NON-NEGOTIABLE) | This phase makes no change to AI inference behavior. US7 is internal cleanup of the ML host configuration source-of-truth and explicitly preserves the existing `ai.service.js` + `ml-client.js` contracts (per FR-021 and the cross-reference to 001's contracts). The CI grep guard is *additive* enforcement — it never weakens the no-mocks invariant. | ✅ Pass |
| **IV. Test-First Discipline & Coverage Gates** | For each user story, a Jest/supertest test file is added BEFORE the production code change. Coverage gate ≥ 80% lines/branches on every module touched. The validation tests include negative cases for every level of the order-create pipeline and every rule of the password-change policy. | ✅ Pass |
| **V. Role-Based Security & Boundary Validation** | Every new endpoint declares its role guard at the route-table level using the existing `protect` + `restrictTo` factories. `update-profile` / `update-password` reuse `protect` (any authenticated user). `export` reuses `restrictTo('admin', 'staff')` to match the surrounding inventory read endpoints. `integrity-report` uses `restrictTo('admin')` to match the existing `users/:id/status` admin gate. Every write endpoint added by this phase has a Joi validator. No new auth mechanism. | ✅ Pass |
| **VI. Observable & Persisted Operational Signals** | Every new endpoint logs success and failure through the existing Winston `logger` (the project-wide pattern visible in `inventory.controller.js`). The order-validation pipeline logs at the level of the failing rule so operators can diagnose a 400 from a single log entry. No new persisted-alert surface is introduced — this phase is silent on the spoilage notification path that 001 already owns. | ✅ Pass |
| **VII. GitHub Trunk-Based Delivery Workflow** | One PR per user story (seven total) on `feature/p1-*` branches with conventional-commits, each linked to its US in the spec. The architectural extraction (US6) ships as two PRs (validator first, service extraction second) to keep each diff reviewable. | ✅ Pass |

**Gate result**: PASS, no conditionals. Complexity Tracking is empty —
this phase introduces no new architectural complexity; on the contrary,
it *reduces* complexity by removing the menu-module Mongoose-direct
violation and centralizing the AI host config.

## Project Structure

### Documentation (this feature)

```text
specs/002-backend-bug-fixes/
├── spec.md                    # Feature specification (clarified)
├── plan.md                    # This file
├── research.md                # Phase 0 — library / dependency / pattern decisions
├── data-model.md              # Phase 1 — Order typo correction; no schema changes
├── quickstart.md              # Phase 1 — local smoke-test walkthrough per user story
├── contracts/                 # Phase 1 — REST contracts for new endpoints
│   ├── auth-update-profile.http
│   ├── auth-update-password.http
│   ├── inventory-export.http
│   ├── orders-integrity-report.http
│   └── README.md              # Contract conventions, error-shape summary
└── tasks.md                   # Phase 2 output (NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
Server/
├── src/
│   ├── domain/
│   │   └── models/
│   │       └── Order.js                              # FIX — line 14: 'competed' → 'pending'
│   ├── application/
│   │   ├── services/
│   │   │   ├── inventory.service.js                  # ADD — getById() + exportToCsv() helper
│   │   │   ├── menu.service.js                      # NEW — owns Dish DB access (US6)
│   │   │   ├── order.service.js                     # MODIFY — accept pre-validated payload; defer existence/stock check to validator pipeline
│   │   │   └── auth.service.js (or user.service.js) # ADD — updateProfile() + updatePassword() (location follows existing service pattern)
│   │   └── validations/
│   │       ├── order.validation.js                  # NEW — Joi shape schema for order-create (US1 level a)
│   │       └── menu.validation.js                   # NEW — Joi schema for dish create/update (US6)
│   ├── infrastructure/
│   │   └── config/
│   │       └── ai.js                                # GUARD — already correct; add CI grep enforcement (US7)
│   ├── interfaces/
│   │   └── controllers/
│   │       ├── inventory.controller.js              # FIX — getOne() routes through inventoryService.getById; ADD — exportCsv()
│   │       ├── menu.controller.js                   # REFACTOR — delegate to menu.service (US6)
│   │       ├── order.controller.js                  # ADD — wire integrity-report; ensure validation pipeline middleware order
│   │       └── auth.controller.js                   # ADD — updateProfile, updatePassword
│   ├── middlewares/
│   │   └── order-existence.middleware.js            # NEW — pipeline levels (b) dish + (c) customer + (d) stock
│   ├── routes/
│   │   ├── auth.routes.js                           # ADD — PATCH /update-profile, /update-password
│   │   ├── inventory.routes.js                      # ADD — GET /export
│   │   ├── menu.routes.js                           # MODIFY — apply validate(menuSchema) middleware
│   │   ├── order.routes.js                          # MODIFY — apply validate(orderSchema) + existence-pipeline middleware; ADD — GET /integrity-report
│   │   └── (no changes to others)
│   └── index.js                                     # FIX — uncomment etlRoutes + posRoutes mounts (US3)
└── __tests__/
    ├── api/
    │   ├── auth.update-profile.test.js              # NEW — US4 contract tests
    │   ├── auth.update-password.test.js             # NEW — US4 contract tests
    │   ├── inventory.export.test.js                 # NEW — US5 contract + filter tests
    │   ├── inventory.getById.test.js                # NEW — US2 contract + 404 test
    │   ├── etl.smoke.test.js                        # NEW — US3 reachability smoke
    │   ├── pos.smoke.test.js                        # NEW — US3 reachability smoke
    │   ├── menu.validation.test.js                  # NEW — US6 schema rejection cases
    │   └── orders.integrity-report.test.js          # NEW — US1 admin-only + shape test
    ├── services/
    │   ├── menu.service.test.js                     # NEW — US6 isolated unit tests
    │   ├── inventory.service.getById.test.js        # NEW — US2 unit test
    │   └── order.validation-pipeline.test.js        # NEW — US1 levels a/b/c/d unit tests
    └── domain/
        └── order-default-status.test.js             # NEW — US1 SC-001 default value
```

**Structure Decision**: Single-process Node.js backend, no new
deployable units. The slot under `Server/src/middlewares/` for the
order-existence pipeline is a deliberate choice over jamming the
checks into `order.service` — it keeps each pipeline level
independently testable as middleware, gives a clean rejection point
that fires *before* the controller, and matches the project's
existing `validate.middleware.js` pattern. The CSV export uses an
in-house ~30-LOC RFC-4180 escape helper rather than adding `json2csv`
to `package.json`; that decision is captured in `research.md`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No entries.* This phase introduces no new architectural complexity.
On the contrary:

- **US6 reduces complexity** by removing the menu module's direct
  Mongoose access (existing Constitution Principle II violation).
- **US7 reduces complexity** by enforcing a single source of truth
  for ML service configuration (a CI grep guard is additive
  enforcement, not new architecture).
- **No new runtime dependencies** are added (CSV escaping is
  in-house; everything else reuses libraries already in
  `Server/package.json`).
- **No new processes** are deployed.
- **No schema changes** to existing collections (the Order typo
  correction is a default-value fix, not a shape change).

---

## Phase 0 — Outline & Research

See [research.md](./research.md). Summary of decisions resolved there:

- **CSV emission strategy**: in-house RFC-4180 helper (~30 LOC) over
  the `json2csv` library. Rationale: dependency surface minimization,
  testable escape contract, no streaming requirement at pilot scale.
- **Order-validation pipeline shape**: a chain of three middlewares
  (`validate(orderSchema)` for shape, `verifyOrderExistence` for
  dish + customer existence, `verifyStockFulfillability` for level
  d). Each middleware is independently unit-testable and short-circuits
  on failure with a per-level error tag in the 400 response payload.
- **Stock-fulfillability computation**: synchronous in-process
  computation per request (no transactions needed at pilot scale; see
  spec edge case for concurrent-orders behavior). The ingredient set
  is fetched in one query (`Ingredient.find({ _id: { $in: [...] } })`)
  with a derivation of required quantity from each dish's
  `ingredients[]` × item `quantity`.
- **Email-change rejection mechanism**: case-insensitive comparison
  in the `updateProfile` controller before any service call;
  comparison uses the trimmed/lowercased value to avoid false
  positives on whitespace or casing differences (per the edge cases
  in spec).
- **Password-change policy enforcement**: a Joi schema in
  `auth.validation.js` adding `changePasswordSchema` next to the
  existing `loginSchema` / `registerSchema`. The "must differ from
  current" rule is a service-layer check (after bcrypt compare),
  not a Joi rule, because Joi cannot reach the stored hash.
- **Inventory export query routing**: when `lowStock=true` is
  present, route to `inventoryService.getLowStockIngredients()`;
  when `nearExpiry=true` is present, route to
  `getNearExpiryIngredients()`; both filters can compose with
  `search` and `category` by post-filtering the service result. The
  unfiltered path reuses `getAllIngredients()`.
- **Integrity-report endpoint location**: under `order.controller`
  + `order.routes` (not a new module) — matches the colocation
  pattern of `auth.controller.updateUserStatus` living next to
  `auth.controller.login`.
- **AI config CI grep guard**: a small npm script
  (`npm run check:ml-host-literals`) that scans `Server/src/**/*.js`
  excluding `infrastructure/config/ai.js`, executed in the existing
  Jest test runner via a `__tests__/static/ml-host-literals.test.js`
  that asserts the grep returns zero matches.

---

## Phase 1 — Design & Contracts

See:
- [data-model.md](./data-model.md) — the only domain change is the
  Order `status` default value correction; no other schema edits;
  no new collections; the integrity-report query semantics are
  documented.
- [contracts/auth-update-profile.http](./contracts/auth-update-profile.http)
  — request/response examples for accepted, no-op, and
  email-rejection cases.
- [contracts/auth-update-password.http](./contracts/auth-update-password.http)
  — request/response examples for success, wrong-current-password,
  and each policy-violation case.
- [contracts/inventory-export.http](./contracts/inventory-export.http)
  — examples for unfiltered, `search`, `category`, `lowStock`,
  `nearExpiry`, and combined filters.
- [contracts/orders-integrity-report.http](./contracts/orders-integrity-report.http)
  — admin success and non-admin 403.
- [contracts/README.md](./contracts/README.md) — error-shape
  conventions reused from the existing `success: false, message`
  pattern.
- [quickstart.md](./quickstart.md) — local smoke-test walkthrough
  per user story.

### Post-design Constitution re-check

Re-evaluated after data-model and contracts:

- Principle II — confirmed: every new endpoint has a controller →
  service → model path; the menu refactor closes the existing
  violation; the inventory `getById` addition closes the implied
  violation in the buggy controller.
- Principle III — confirmed: contracts include no AI/ML
  request/response shapes; US7 contract surface is internal
  (`ai.js` config module), and the CI grep guard is an *additive*
  enforcement test (Phase 1 contract `__tests__/static/ml-host-literals.test.js`).
- Principle IV — every contract example is paired with a Jest fixture
  in `__tests__/api/*.test.js` and at least one negative case.
- Principle V — every operation in the four `.http` contract files
  declares a role-guard expectation in the request comment header
  matching the route-table guard.
- Principle VI — every endpoint emits a Winston `logger.info` /
  `logger.error` line at success / failure following the existing
  `inventory.controller.js` pattern.

**Re-check verdict**: PASS. No new violations introduced by Phase 1
design. Complexity Tracking remains empty.

---

## Phase 2 — Task Generation

Out of scope for `/speckit-plan`. The next command (`/speckit-tasks`)
will read this plan + spec + data-model + contracts and produce
`tasks.md` — dependency-ordered, story-grouped, [P]-marked.

Suggested task grouping anticipated by this plan:

1. **Setup & Foundational** — confirm Jest/supertest infra is wired
   for new test files; add the CI grep guard test stub for US7.
2. **US1 (P1) — Order Lifecycle** — Order.js typo fix (test-first
   for SC-001); `order.validation.js` shape schema; new
   `order-existence.middleware.js` for levels b/c/d; wire into
   `order.routes.js`; `integrity-report` endpoint + admin-only test.
3. **US2 (P1) — Inventory `getById`** — add
   `inventoryService.getById`; rewrite controller `getOne` to call
   it; `__tests__/api/inventory.getById.test.js` for valid/404/401.
4. **US3 (P1) — Restore ETL & POS mounts** — uncomment in
   `index.js`; smoke tests asserting non-404 reachability.
5. **US4 (P1) — Settings page wiring** — add routes; add
   `auth.controller.updateProfile` (with email-rejection
   precondition) and `updatePassword` (with bcrypt compare + change
   policy); add `changePasswordSchema` to `auth.validation.js`;
   tests covering every acceptance scenario.
6. **US5 (P1) — Inventory CSV export** — RFC-4180 escape helper +
   tests; `inventory.controller.exportCsv` routing query filters
   to the right service method; route added behind
   `restrictTo('admin', 'staff')`; tests covering every filter
   combination plus the empty-inventory header-only case.
7. **US6 (P2) — Menu module** — `menu.validation.js` first
   (smaller, behavior-preserving); then `menu.service.js`
   extraction with the controller becoming a thin HTTP adapter;
   `__tests__/services/menu.service.test.js` proving HTTP-free
   testability and ≥ 80% coverage.
8. **US7 (P3) — AI config centralization** —
   `__tests__/static/ml-host-literals.test.js` greps for hardcoded
   host literals; an npm script (`check:ml-host-literals`) wraps
   the same logic for CI; `ai.js` config gets a clear startup-error
   path on missing `baseUrl`.
9. **Polish** — coverage report ≥ 80% on every touched module;
   API-contract regression test (SC-013) replays a recorded set of
   pre-feature responses against the post-feature server and
   asserts shape equality on every previously mounted endpoint.
