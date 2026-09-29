---
description: "Task list for Fix All Backend Bugs & Missing Endpoints (Phase P1)"
---

# Tasks: Fix All Backend Bugs & Missing Endpoints

**Input**: Design documents from `/specs/002-backend-bug-fixes/`
**Prerequisites**: `plan.md` ✅, `spec.md` ✅, `research.md` ✅, `data-model.md` ✅, `contracts/` ✅, `quickstart.md` ✅

**Tests**: Test tasks ARE included. The plan's Constitution Check (Principle IV) mandates tests-first with ≥ 80% coverage on services and routes touched by this phase; the spec's success criteria (SC-001…SC-013) are all "verified by automated test" or "verified by static check." Each user-story phase begins with its tests.

**Organization**: Tasks are grouped by user story (US1 → US7) per `spec.md`. Each story is independently implementable and independently testable. P1 stories are the MVP slice and may be merged in any order; P2/P3 stories layer on top of them without touching the same files.

## Format: `[ID] [P?] [Story] Description`

- `[P]` = task touches only its own file(s) and has no dependency on other unfinished tasks in the same phase → safe to parallelize.
- `[USn]` = task belongs to user story n (omitted for Setup / Foundational / Polish).
- Every task gives an absolute repo-relative file path. Exact symbol names, function signatures, npm scripts, and library calls are stated where they reduce ambiguity.

## Path Conventions (repo-relative, all paths from repo root)

- Node.js backend lives under `Server/`.
- Existing middleware location for cross-cutting Express middlewares: `Server/src/middlewares/` (next to `auth.middleware.js`, `validate.middleware.js`, `error.middleware.js`). New middlewares introduced by this phase go here.
- Existing service location: `Server/src/application/services/`. New services introduced by this phase go here.
- Existing validations location: `Server/src/application/validations/` (auth.validation.js, inventory.validation.js, …). New Joi schemas go here.
- Tests live under `Server/__tests__/` (Jest) — already wired by 001-real-ai-ml-engine.
- The React client under `Client/` is **not touched in this phase** (per spec Assumption).
- The Python ML service under `Server/ml_model_service/` is **not touched** by this phase.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the test infra to host this phase's new test files. The Jest harness is already configured by 001-real-ai-ml-engine (see `Server/jest.config.js`), so this phase is intentionally short.

- [x] T001 Verify `Server/jest.config.js` already includes the new test directories used by this phase. Confirm `testMatch: ['**/__tests__/**/*.test.js']` will pick up files added under `Server/__tests__/api/`, `Server/__tests__/services/`, `Server/__tests__/domain/`, `Server/__tests__/static/`, and `Server/__tests__/regression/`. If `collectCoverageFrom` excludes any module touched by this phase (`menu.service.js`, `order-existence.middleware.js`, `csv/rfc4180.js`), broaden the glob.
- [x] T002 [P] Add three npm scripts to `Server/package.json`: `"check:ml-host-literals": "node scripts/check-ml-host-literals.js"`, `"test:regression": "jest __tests__/regression"`, `"test:static": "jest __tests__/static"`. The first two scripts simply wrap Jest invocations targeting the corresponding directory; they exist so CI can fail early on a contract regression or static-rule violation without running the full suite.
- [x] T003 [P] Create empty placeholder directories with `.gitkeep` so test files added later land in tracked locations: `Server/__tests__/static/.gitkeep`, `Server/__tests__/regression/.gitkeep`, `Server/__tests__/domain/.gitkeep`.

**Checkpoint**: `npm test` runs cleanly against the existing 001 test set; the three new directories exist and are tracked.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Two small extensions used by exactly one user story each but called out as foundational because they MUST land before the dependent story's first test can pass.

**⚠️ CRITICAL**: T004 blocks US4. T005–T006 block US5. Stories whose blockers haven't landed must be skipped until the blocker is in place.

- [x] T004 Extend `Server/src/domain/models/User.js` with two **optional** fields directly under `tokenVersion`:

  ```javascript
  phone:  { type: String, trim: true },
  avatar: { type: String, trim: true }
  ```

  Per `data-model.md` § 5, this is non-breaking (existing documents read these as `undefined`). No migration required. Do NOT change any other field; the password `select: false` and bcrypt `pre('save')` hook MUST remain untouched. **Blocks**: US4 T034, T036, T040.

- [x] T005 [P] Create `Server/src/infrastructure/csv/rfc4180.js` exporting `toCsv(headers, rows)` per `research.md` R-01: emit one header row from `headers` (an array of strings) and one row per item in `rows` (each item is an array of values aligned to `headers`). Escape rule: if a field contains `,`, `"`, `\r`, or `\n`, wrap it in double quotes; double any embedded `"`. Empty/`undefined`/`null` becomes the empty string. Line terminator is `\r\n` per RFC 4180. Total ≤ 30 lines of code. **Blocks**: US5 T046, T049.

- [x] T006 [P] Create `Server/__tests__/services/csv.rfc4180.test.js` with at least these cases (all asserting equality on the exact bytes emitted):
  - empty `rows` → header row only ending in `\r\n`.
  - field containing a comma → wrapped in quotes.
  - field containing a literal `"` → wrapped in quotes with `""` escape.
  - field containing `\n` → wrapped in quotes (Excel must keep the row intact).
  - `null` and `undefined` → empty string in the output, no `null` literal leaking.
  - mixed numeric/string rows → numbers stringified without quotes (unless they contain a special char, which numbers cannot).
  - **Round-trip**: feed the output back through a `parseCsv` helper (defined inline in the test) and assert deep-equal against the input rows. **Blocks**: US5 T046.

**Checkpoint**: `npm test -- csv.rfc4180` passes; User.js loads with phone/avatar visible in `User.schema.paths`.

---

## Phase 3: User Story 1 — Trustworthy Order Lifecycle (Priority: P1) 🎯 MVP

**Goal**: Every newly created order is born `pending` (correct enum default). Every order-create request passes a four-level validation pipeline (shape → dish existence/availability → customer existence → stock fulfillability) before any DB write or ingredient deduction. Admin-only `GET /api/orders/integrity-report` surfaces legacy `'competed'` records for manual remediation.

**Independent Test**: Per `quickstart.md` US1 — POST a clean order and observe `status: "pending"`; submit four invalidation cases and observe per-cause 400 rejections; insert a legacy-typo doc via `mongosh` and observe it appear in the admin integrity report.

### Tests for User Story 1 (write FIRST, ensure they FAIL before implementation)

- [x] T007 [P] [US1] Create `Server/__tests__/domain/order-default-status.test.js` (uses `mongodb-memory-server`): assert `new Order({ items:[{ dish: <id>, quantity: 1, priceAtTime: 5 }], totalPrice: 5, source:'POS', paymentMethod:'Cash' }).status === 'pending'`. Loads the live `Order` model — fails today because the default is `'competed'`. Verifies SC-001.

- [x] T008 [P] [US1] Create `Server/__tests__/services/order.validation-pipeline.test.js` covering each of the four pipeline levels in isolation:
  - **Level a (shape)**: empty `items[]` → 400 with `cause: 'shape'`.
  - **Level a**: unknown `paymentMethod` → 400 with `cause: 'shape'`.
  - **Level a**: malformed `customer` ObjectId → 400 with `cause: 'shape'`.
  - **Level b (dish)**: well-formed `items.dish` ObjectId not in DB → 400 with `cause: 'dish'`.
  - **Level b**: `items.dish` exists but `isAvailable: false` → 400 with `cause: 'dish'`.
  - **Level c (customer)**: well-formed `customer` ObjectId not in DB → 400 with `cause: 'customer'`.
  - **Level d (stock)**: order quantities exceed ingredient stock → 400 with `cause: 'stock'` and an `errors[].field` naming the short ingredient.

- [x] T009 [P] [US1] Create `Server/__tests__/api/orders.integrity-report.test.js` (uses `supertest`):
  - Admin token + 0 legacy docs → 200 with `{ count: 0, orderIds: [] }`.
  - Admin token + 3 legacy docs (inserted bypassing schema via `Order.collection.insertOne({ status: 'competed', … })`) → 200 with `count: 3` and the three IDs in any order.
  - Calling endpoint twice in a row → identical response (idempotency).
  - Before/after: snapshot all Order documents' `_id+status+updatedAt` before the call and after; assert deep equality (read-only proof for SC-002c).
  - Staff token → 403; customer token → 403; no token → 401.

### Implementation for User Story 1

- [x] T010 [US1] In `Server/src/domain/models/Order.js`, change line 14 default from `'competed'` to `'pending'`. **Do not modify** the enum, the index definitions, or any other field. This single one-line edit closes Bug 1; T007 should now pass.

- [x] T011 [P] [US1] Create `Server/src/application/validations/order.validation.js` exporting `orderSchema` (the level-a Joi schema in `data-model.md` § 2.1) and `module.exports = { orderSchema }`. Mirrors the Mongoose enums for `source` (`POS`, `Online`, `POS_SIMULATOR`) and `paymentMethod` (`Cash`, `Card`, `Online`, `Wallet`).

- [x] T012 [US1] Create `Server/src/middlewares/order-existence.middleware.js` exporting two functions:
  - `verifyOrderExistence(req, res, next)` — resolves every `req.body.items[i].dish` via `Dish.find({ _id: { $in: [...] }, isAvailable: true })`; if any id fails to resolve, return 400 with `{ success:false, cause:'dish', errors:[{ field:'items[i].dish', message:'dish not found or not available' }] }`. Then, if `req.body.customer` is supplied, look up via `Customer.findById`; on miss return 400 `cause:'customer'`. Stash the resolved Dish documents on `res.locals.resolvedDishes` for reuse by the next middleware.
  - `verifyStockFulfillability(req, res, next)` — using `res.locals.resolvedDishes` and each item's `quantity`, build a Map `requiredByIngredientId → totalQty`, then `Ingredient.find({ _id: { $in: [...required] } }).select('name quantity')`. If any ingredient has `quantity < required`, return 400 with `{ success:false, cause:'stock', errors:[{ field:'<ingredient.name>', required, available }] }`. On success: call `next()` — do NOT mutate ingredient documents (deduction stays in the existing service).

  Per `research.md` R-02 each middleware is independently unit-testable; T008 exercises both.

- [x] T013 [US1] In `Server/src/routes/order.routes.js`, apply the validation pipeline to the create-order route in this exact middleware order: `validate(orderSchema)` → `verifyOrderExistence` → `verifyStockFulfillability` → `orderController.create`. Use the existing `validate.middleware.js` factory (`Server/src/middlewares/validate.middleware.js`). Do NOT change the role guard on the route — preserve whatever authorization was previously in effect.

- [x] T014 [P] [US1] In `Server/src/application/services/order.service.js`, add `async getIntegrityReport()` per `data-model.md` § 3:

  ```javascript
  async getIntegrityReport() {
    const legacy = await Order.find({ status: 'competed' }).select('_id').lean();
    return { count: legacy.length, orderIds: legacy.map(o => String(o._id)) };
  }
  ```

  Mongoose `.find()` does not enforce the schema enum on reads, so the legacy `'competed'` documents inserted before T010 are still discoverable. Read-only.

- [x] T015 [US1] In `Server/src/interfaces/controllers/order.controller.js`, add `exports.integrityReport = async (req, res) => { … }` that calls `orderService.getIntegrityReport()` and responds 200 `{ success:true, data:<result> }`. Follow the `try/catch + logger.error + 500 fallback` pattern used by every existing handler in `inventory.controller.js`.

- [x] T016 [US1] In `Server/src/routes/order.routes.js`, add `router.get('/integrity-report', protect, restrictTo('admin'), orderController.integrityReport)` immediately after `router.use(protect)` (or however the existing module declares its top-level guard). The role guard is identical to `auth.routes.js`'s `users/:id/status` admin-only line.

**Checkpoint**: `npm test -- order` passes (T007, T008, T009 all green); `quickstart.md` US1 smoke commands all return the expected status codes and bodies.

---

## Phase 4: User Story 2 — Inventory Detail Page That Doesn't Crash (Priority: P1)

**Goal**: `GET /api/inventory/:id` returns 200 with the full ingredient for a valid id and 404 for an unknown id — never 500.

**Independent Test**: Per `quickstart.md` US2 — known id → 200; unknown id → 404; verifies SC-003.

### Tests for User Story 2 (write FIRST)

- [x] T017 [P] [US2] Create `Server/__tests__/services/inventory.service.getById.test.js`:
  - Seed an ingredient via `mongodb-memory-server`; call `inventoryService.getById(id)`; assert returns the document.
  - Call `inventoryService.getById('000000000000000000000000')`; assert returns `null` (not throw).
  - Call `inventoryService.getById('not-an-objectid')`; assert returns `null` (controller will translate to 404).

- [x] T018 [P] [US2] Create `Server/__tests__/api/inventory.getById.test.js`:
  - Admin token + valid id → 200, `data._id === id`, latency < 500 ms.
  - Admin token + valid-shape but unknown id → 404 with `{ success:false, message:'Ingredient not found' }`.
  - Staff token + valid id → 200 (existing role guard).
  - No token → 401.

### Implementation for User Story 2

- [x] T019 [P] [US2] In `Server/src/application/services/inventory.service.js`, add inside the `InventoryService` class:

  ```javascript
  async getById(id) {
    return await Ingredient.findById(id);
  }
  ```

  Place it next to `getAllIngredients`. The existing `Ingredient` import at the top of the file is reused — no new imports needed.

- [x] T020 [US2] In `Server/src/interfaces/controllers/inventory.controller.js`, replace the buggy line 16 (`const ingredient = await Ingredient.findById(req.params.id);`) with `const ingredient = await inventoryService.getById(req.params.id);`. Keep the surrounding 404-check, 200-response, and try/catch unchanged. This is the explicit fix for Bug 2.

**Checkpoint**: `npm test -- inventory.getById` passes; `curl /api/inventory/<bad-id>` returns 404, never 500.

---

## Phase 5: User Story 3 — Restore ETL & POS API Surfaces (Priority: P1)

**Goal**: Re-mount the existing `etlRoutes` and `posRoutes` modules at `/api/etl` and `/api/pos` so requests to those namespaces reach their handlers instead of falling through to 404.

**Independent Test**: Per `quickstart.md` US3 — `GET /api/etl/report` and `POST /api/pos/transaction` return non-404 (SC-004).

### Tests for User Story 3 (write FIRST)

- [x] T021 [P] [US3] Create `Server/__tests__/api/etl.smoke.test.js`:
  - Admin token + `GET /api/etl/report` → status code is **not** 404 (could be 200, 401, 500 from the existing handler — the contract here is reachability only).
  - Admin token + `GET /api/etl/export` → status code is **not** 404.

- [x] T022 [P] [US3] Create `Server/__tests__/api/pos.smoke.test.js`:
  - Admin token + `POST /api/pos/transaction` with empty body → status code is **not** 404.
  - Admin token + `POST /api/pos/seed` → status code is **not** 404.

- [x] T023 [P] [US3] Create `Server/__tests__/regression/route-mount.test.js` asserting that every previously mounted namespace is still mounted (`/api/auth`, `/api/customer`, `/api/menu`, `/api/orders`, `/api/inventory`, `/api/dashboard`, `/api/v1/ai`, `/api/v1/ai/pricing`, `/api/v1/recommendations`, `/api/v1/dishes`, `/api/sales`). Each namespace probed with one shape-only request whose expected status is **not** 404 — mirrors FR-010 and SC-013 for this slice.

### Implementation for User Story 3

- [x] T024 [US3] In `Server/src/index.js`, lines 30–31, uncomment the two import-and-mount lines:

  ```javascript
  const etlRoutes = require('./routes/etl.routes');
  const posRoutes = require('./routes/pos.routes');
  …
  app.use('/api/etl', etlRoutes);
  app.use('/api/pos', posRoutes);
  ```

  Place the mount calls in the same block as the other `app.use` lines, in any order; the existing modules already declare their own `protect`+`restrictTo` guards so no further wiring is needed (verified during research).

**Checkpoint**: All three regression/smoke tests pass; manual `curl http://localhost:5000/api/etl/report` returns the existing handler's response (not 404).

---

## Phase 6: User Story 4 — Settings Page That Actually Saves (Priority: P1)

**Goal**: Two new endpoints behind the existing `protect` middleware. `PATCH /api/auth/update-profile` accepts partial updates of `name`, `phone`, `avatar` and rejects email-change attempts atomically. `PATCH /api/auth/update-password` enforces the change policy (≥ 8 chars, ≥ 1 letter, ≥ 1 digit, must differ from current) and writes a bcrypt hash; never logs or returns plaintext.

**Independent Test**: Per `quickstart.md` US4 — happy paths persist; email-change attempt is atomically rejected; each policy violation returns its `violations[]` tag; old password no longer logs in.

### Tests for User Story 4 (write FIRST)

- [x] T025 [P] [US4] Create `Server/__tests__/api/auth.update-profile.test.js` covering all six contract examples in `contracts/auth-update-profile.http`:
  - Valid `{ name }` → 200, `/auth/me` reflects the new name within one cycle (SC-005).
  - Valid `{ name, phone, avatar }` → 200, all three persisted.
  - Email field equal to current (case-insensitive, e.g., `EMAIL@X.com` vs. `email@x.com`) + `name` change → 200, `name` persisted, email unchanged.
  - Email field different from current + `name` change → 400 with the exact "email-verification flow not yet available" message; `name` MUST NOT be persisted (snapshot user document before/after — SC-005a).
  - Empty body `{}` → 400 (Joi `.min(1)`).
  - No `Authorization` header → 401.

- [x] T026 [P] [US4] Create `Server/__tests__/api/auth.update-password.test.js` covering all seven contract examples in `contracts/auth-update-password.http`:
  - Correct current + valid new password → 200; subsequent login with old password → 401; with new password → 200 (SC-007).
  - Wrong current password → 401, password hash unchanged in DB (SC-006).
  - For each policy violation (`min_length`, `missing_letter`, `missing_digit`, `same_as_current`), submit a distinct request and assert 400 with the violation tag in `violations[]` (SC-006a).
  - No `Authorization` header → 401.
  - Snapshot the request log lines for the entire test file and assert no plaintext password value appears (SC-007 log scan).

- [x] T027 [P] [US4] Create `Server/__tests__/services/auth.service.updateProfile.test.js` (unit-level, no Express):
  - `userService.updateProfile(userId, { name: 'New' })` → returns updated User document with new name; `phone`/`avatar` unchanged.
  - `userService.updateProfile(userId, { phone: '+1', avatar: 'https://x' })` → both fields persisted.
  - Service does NOT receive an `email` field — that is the controller's responsibility (R-04).

- [x] T028 [P] [US4] Create `Server/__tests__/services/auth.service.updatePassword.test.js`:
  - Wrong current password → throws `{ code: 'current_password_incorrect' }`; bcrypt hash in DB unchanged.
  - Correct current + new password equal to current → throws `{ code: 'same_as_current' }`.
  - Correct current + new password meeting policy → User document's `password` hash differs from before; `bcrypt.compare(new, hash)` returns `true`.
  - Plaintext new password value never appears in any object returned by the service.

### Implementation for User Story 4 — Joi schemas first

- [x] T029 [P] [US4] In `Server/src/application/validations/auth.validation.js`, add `updateProfileSchema` per `data-model.md` § 2.4 (`name` 2–50, `phone` string, `avatar` uri, `email` email — all optional; schema requires `.min(1)`). Export it alongside the existing `registerSchema`/`loginSchema`.

- [x] T030 [P] [US4] In the same file, add `changePasswordSchema` per `data-model.md` § 2.3 (`currentPassword` required string, `newPassword` required string with `.min(8).pattern(/[A-Za-z]/, 'must contain a letter').pattern(/[0-9]/, 'must contain a digit')`). Each Joi pattern message becomes a violation tag at the controller level. Export it.

### Implementation for User Story 4 — service layer

- [x] T031 [US4] **(Decide service location.)** Search `Server/src/application/services/` for an existing `auth.service.js` or `user.service.js`. If neither exists, create `Server/src/application/services/auth.service.js`. Add two methods:

  ```javascript
  async updateProfile(userId, fields) { /* see T032 */ }
  async updatePassword(userId, currentPassword, newPassword) { /* see T033 */ }
  ```

  Document the choice in a comment at the top of the file referencing this task ID.

- [x] T032 [US4] Implement `auth.service.updateProfile(userId, fields)`. Allowed keys in `fields`: `name`, `phone`, `avatar` (any other key is silently ignored — defensive, matches FR-011 "Unrecognized fields MUST be ignored"). Use `User.findByIdAndUpdate(userId, { $set: pickedFields }, { new: true, runValidators: true }).select('-password')`. Return the updated document. Depends on T004.

- [x] T033 [US4] Implement `auth.service.updatePassword(userId, currentPassword, newPassword)`:
  1. `const user = await User.findById(userId).select('+password')` (the existing `select: false` requires the explicit `+password`).
  2. If not found → throw `{ code: 'user_not_found' }`.
  3. `const ok = await user.correctPassword(currentPassword, user.password)` (the User method already exists at line 54). If `!ok` → throw `{ code: 'current_password_incorrect' }`.
  4. If `currentPassword === newPassword` (plaintext compare per R-05) → throw `{ code: 'same_as_current' }`.
  5. `user.password = newPassword`; `await user.save()` — the existing pre-save hook bcrypts. Do NOT call `bcrypt.hash` directly (would double-hash).
  6. Return `{ success: true }`. Never include the password value in the return object.

### Implementation for User Story 4 — controllers

- [x] T034 [US4] In `Server/src/interfaces/controllers/auth.controller.js`, add `exports.updateProfile = async (req, res, next) => { … }` per `research.md` R-04 — exact code:

  ```javascript
  exports.updateProfile = async (req, res) => {
    try {
      const { email, ...rest } = req.body;
      if (email !== undefined) {
        const current  = String(req.user.email || '').trim().toLowerCase();
        const incoming = String(email).trim().toLowerCase();
        if (incoming !== current) {
          return res.status(400).json({
            success: false,
            message: 'email changes require the email-verification flow (not yet available)'
          });
        }
      }
      const updated = await authService.updateProfile(req.user._id, rest);
      return res.status(200).json({ success: true, data: updated });
    } catch (err) {
      logger.error(`updateProfile Error: ${err.message}`);
      return res.status(500).json({ success: false, message: 'Error updating profile' });
    }
  };
  ```

  Note: the email-equality check runs BEFORE the service call, so SC-005a's atomic-rejection invariant holds.

- [x] T035 [US4] In the same controller file, add `exports.updatePassword`. Catch the three tagged service errors and map them:
  - `current_password_incorrect` → 401 `{ success:false, message:'current password incorrect' }`.
  - `same_as_current` → 400 `{ success:false, message:'password policy violation', violations:['same_as_current'] }`.
  - `user_not_found` → 401 (deny-on-uncertainty rather than leaking existence).
  - default → 500 with the standard `logger.error` line. **Never** include `req.body` in any log line (would print plaintext passwords).

### Implementation for User Story 4 — routes

- [x] T036 [US4] In `Server/src/routes/auth.routes.js`, immediately after the existing `router.get('/me', authController.getMe)` line, add:

  ```javascript
  router.patch('/update-profile',  validate(updateProfileSchema),  authController.updateProfile);
  router.patch('/update-password', validate(changePasswordSchema), authController.updatePassword);
  ```

  Update the destructuring import at the top of the file:
  ```javascript
  const { registerSchema, loginSchema, updateProfileSchema, changePasswordSchema } = require('../application/validations/auth.validation');
  ```

  Both new endpoints inherit the `router.use(protect)` line above (same gate as `/me`). Do NOT add them above `router.use(protect)`.

- [x] T037 [US4] **Cross-check**: in the same file, confirm the validation message format from `validate.middleware.js` (which joins `error.details.map(detail => detail.message)` with `', '`) is compatible with the test in T026 expecting a `violations[]` array. If incompatible, either (a) extend `validate.middleware.js` to also emit a `violations` array of message keys (but that risks regressing other endpoints — FR-025), OR (b) inline a small validation block in the controller for the change-password schema specifically. Pick (b) to keep the existing middleware behavior unchanged; document the choice in a comment on T035.

**Checkpoint**: `npm test -- auth.update-profile auth.update-password auth.service.update` all pass; `quickstart.md` US4 smoke commands all behave per the contract files.

---

## Phase 7: User Story 5 — Inventory CSV Export (Priority: P1)

**Goal**: `GET /api/inventory/export` returns a CSV (RFC 4180) of the ingredient collection, honoring `search`, `category`, `lowStock`, and `nearExpiry` filters with AND-composition. Behind `restrictTo('admin', 'staff')`.

**Independent Test**: Per `quickstart.md` US5 — six filter combinations each return the same row set as the corresponding inventory view; SC-008 (escape correctness) and SC-008a (set equality) verified.

### Tests for User Story 5 (write FIRST)

- [x] T038 [P] [US5] Create `Server/__tests__/api/inventory.export.test.js` covering all eleven `.http` examples in `contracts/inventory-export.http`. Critical assertions:
  - `Content-Type: text/csv; charset=utf-8` and `Content-Disposition: attachment; filename="inventory-<yyyymmdd>.csv"`.
  - For each filter combination, parse the CSV body via the round-trip helper from T006 and assert the resulting set of `name` values equals the set returned by calling the corresponding inventory service method directly (SC-008a set-equality).
  - Empty inventory + no filters → header-only body (FR-008).
  - Ingredients with names containing `,`, `"`, `\n` → present and intact in the round-tripped output (SC-008).
  - Customer token → 403; no token → 401.

### Implementation for User Story 5

- [x] T039 [P] [US5] In `Server/src/application/services/inventory.service.js`, add `async exportRows(query)` returning the array of ingredient documents for the export, applying the routing table in `research.md` R-06:

  ```javascript
  async exportRows({ search, category, lowStock, nearExpiry, days }) {
    let rows;
    if (lowStock === 'true' || lowStock === true) {
      rows = await this.getLowStockIngredients();
    } else if (nearExpiry === 'true' || nearExpiry === true) {
      rows = await this.getNearExpiryIngredients(days ? Number(days) : 7);
    } else {
      rows = await this.getAllIngredients({ search, category });
    }
    if (search && (lowStock || nearExpiry)) {
      const re = new RegExp(search, 'i');
      rows = rows.filter(r => re.test(r.name));
    }
    if (category && (lowStock || nearExpiry)) {
      rows = rows.filter(r => r.category === category);  // empty until model gets `category`
    }
    return rows;
  }
  ```

  The `category` post-filter remains inert until the Ingredient model gains a `category` field (data-model.md gap log #1).

- [x] T040 [US5] In `Server/src/interfaces/controllers/inventory.controller.js`, add `exports.exportCsv = async (req, res) => { … }`:
  - Call `inventoryService.exportRows(req.query)`.
  - Build column-aligned rows via the helper from T005:
    ```javascript
    const headers = ['name','category','quantity','unit','minStock','costPerUnit','expiryDate','wasteQuantity'];
    const rows = items.map(i => [
      i.name,
      i.category || '',                       // empty string per data-model.md § 4
      i.quantity,
      i.unit,
      i.minStock,
      i.costPerUnit,
      i.expiryDate ? new Date(i.expiryDate).toISOString().slice(0, 10) : '',
      i.wasteQuantity
    ]);
    const body = toCsv(headers, rows);
    ```
  - Set `Content-Type: text/csv; charset=utf-8`.
  - Set `Content-Disposition: attachment; filename="inventory-<yyyymmdd>.csv"` using a local date computation (no library).
  - `res.status(200).send(body)`.
  - Wrap in the standard try/catch + `logger.error` + 500 fallback.

- [x] T041 [US5] In `Server/src/routes/inventory.routes.js`, add **before** the `/:id` route (so `/export` is not interpreted as an id) and after the other read endpoints:

  ```javascript
  router.get('/export', restrictTo('admin', 'staff'), inventoryController.exportCsv);
  ```

  The `/export` route MUST appear in the route table BEFORE `/:id`, otherwise Express will match `:id = 'export'` first and route to `getOne`. Verify by adding a comment above the line: `// MUST stay above /:id`.

**Checkpoint**: `npm test -- inventory.export` passes; manual `curl http://localhost:5000/api/inventory/export -H "Authorization: Bearer <admin>"` returns a valid CSV that opens in Excel.

---

## Phase 8: User Story 6 — Menu Module Validation & Architecture (Priority: P2)

**Goal**: A Joi schema rejects malformed dish payloads at the validation boundary. A new `menu.service.js` owns every Dish DB call; the menu controller becomes a thin HTTP adapter, restoring Layered Service Architecture compliance and making the module unit-testable without booting Express.

**Independent Test**: Per `quickstart.md` US6 — malformed payloads → 400 per-field; `npx jest __tests__/services/menu.service.test.js --coverage` passes ≥ 80% without Express; `grep -E "require.*models/Dish" src/interfaces/controllers/menu.controller.js` returns zero matches.

### Tests for User Story 6 (write FIRST)

- [x] T042 [P] [US6] Create `Server/__tests__/api/menu.validation.test.js`:
  - `POST /api/menu` with missing `name` → 400.
  - `POST /api/menu` with `price: -5` → 400 with a `price` field error.
  - `POST /api/menu` with `category: 'NotARealCategory'` → 400 (category enum).
  - `POST /api/menu` with `ingredients: [{ ingredient: 'not-objectid', quantity: -1 }]` → 400.
  - `PATCH /api/menu/:id` with the same violations → 400.
  - Valid payload → 201/200 per the existing controller's contract (preserved per FR-020).

- [x] T043 [P] [US6] Create `Server/__tests__/services/menu.service.test.js` exercising every method of the new service against `mongodb-memory-server` (no Express, no supertest):
  - `getAll({ search, category })` returns matching dishes; populate is honored.
  - `getById(id)` returns the document or null.
  - `create(data)` returns the created Dish; verifies the `populate('ingredients.ingredient')` rehydration.
  - `update(id, data)` returns the updated Dish; uses `runValidators: true`.
  - `remove(id)` returns the deleted Dish.
  - Aim for ≥ 80% line/branch coverage on `menu.service.js` (SC-011).

- [x] T044 [P] [US6] Create `Server/__tests__/static/menu.controller-no-mongoose.test.js` asserting that `Server/src/interfaces/controllers/menu.controller.js` contains zero matches for the regex `/require.*['"].*models\/Dish['"]/` and zero matches for `/Dish\./` (i.e., the controller no longer references the Dish model at all). Verifies SC-010.

### Implementation for User Story 6

- [x] T045 [P] [US6] Create `Server/src/application/validations/menu.validation.js` exporting `dishSchema` per `data-model.md` § 2.2. Mirror the Dish model's category enum exactly.

- [x] T046 [US6] Create `Server/src/application/services/menu.service.js` exporting an instance class with these methods (signatures and bodies derived from the existing controller; behavior-preserving per FR-020):

  ```javascript
  class MenuService {
    async getAll({ search, category } = {}) {
      const filter = {};
      if (search)   filter.name     = { $regex: search, $options: 'i' };
      if (category) filter.category = category;
      return Dish.find(filter).populate('ingredients.ingredient');
    }
    async getById(id)        { return Dish.findById(id).populate('ingredients.ingredient'); }
    async create(data)       { return Dish.create(data); }
    async update(id, data)   { return Dish.findByIdAndUpdate(id, data, { new: true, runValidators: true }); }
    async remove(id)         { return Dish.findByIdAndDelete(id); }
  }
  module.exports = new MenuService();
  ```

  This is the file that closes Bug 9.

- [x] T047 [US6] Refactor `Server/src/interfaces/controllers/menu.controller.js` to delegate every DB call to the service. Remove the `Dish` import. Each handler becomes a small wrapper around `menuService.<method>` with the existing role-check, error-handling, and response shape preserved (FR-020 / FR-025). The controller MUST contain zero references to `Dish` after this task.

- [x] T048 [US6] In `Server/src/routes/menu.routes.js`, apply `validate(dishSchema)` to both write routes:

  ```javascript
  router.post('/',     validate(dishSchema), menuController.add);
  router.patch('/:id', validate(dishSchema), menuController.update);
  ```

  Update the import at the top: `const { dishSchema } = require('../application/validations/menu.validation');`. Public read routes are unchanged.

**Checkpoint**: T042–T044 all pass; coverage report shows ≥ 80% on `menu.service.js`; the static check confirms the controller no longer imports Dish.

---

## Phase 9: User Story 7 — Centralized AI Service Configuration (Priority: P3)

**Goal**: Enforce that `Server/src/infrastructure/config/ai.js` is the only place where the ML host URL appears as a literal. A CI-blocking Jest test fails the build if any other source file under `Server/src/` contains `5002`, `8000`, or `localhost:5002`.

**Independent Test**: Per `quickstart.md` US7 — `npm run check:ml-host-literals` returns exit 0 on a clean tree; injecting a violation flips it to exit 1 with the offending line printed.

### Tests for User Story 7 (write FIRST)

- [x] T049 [P] [US7] Create `Server/__tests__/static/ml-host-literals.test.js` per `research.md` R-07. Implementation outline:

  ```javascript
  const fs = require('fs');
  const path = require('path');

  function* walkJs(dir, exclude) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (exclude.some(e => full.endsWith(e))) continue;
      if (entry.isDirectory()) yield* walkJs(full, exclude);
      else if (entry.name.endsWith('.js')) yield full;
    }
  }

  test('no hardcoded ML host literals outside config', () => {
    const root    = path.join(__dirname, '..', '..', 'src');
    const exclude = ['infrastructure/config/ai.js'];
    const re      = /\b(localhost:5002|:5002|:8000)\b/;
    const offenders = [];
    for (const file of walkJs(root, exclude)) {
      const txt = fs.readFileSync(file, 'utf8');
      txt.split('\n').forEach((line, i) => {
        if (re.test(line)) offenders.push(`${file}:${i + 1}  ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
  ```

  No production code change is needed for this test to pass today (verified in plan Phase 0); it is purely a regression-prevention guard.

### Implementation for User Story 7

- [x] T050 [P] [US7] Create `Server/scripts/check-ml-host-literals.js` — a thin CLI wrapper around the same logic as T049, designed for direct invocation outside Jest. Exit code 0 if no offenders; exit 1 with `console.error(offenders.join('\n'))` otherwise. The npm script registered in T002 (`check:ml-host-literals`) calls this file.

- [x] T051 [US7] In `Server/src/infrastructure/config/ai.js`, harden against silent fallback per FR-021/FR-022. Current file is already correct — extend it to throw at import time if `module.exports.baseUrl` is empty after env resolution. Suggested:

  ```javascript
  const baseUrl = process.env.ML_SERVICE_URL || 'http://localhost:5002/v1';
  if (!baseUrl) throw new Error('ML_SERVICE_URL is not configured');
  module.exports = { baseUrl, timeoutMs: 3000 };
  ```

  (The `||` already prevents the empty case in practice; the explicit check turns a misconfigured deploy into a startup error rather than a runtime 500.)

**Checkpoint**: `npm run check:ml-host-literals` returns 0; `npm test -- ml-host-literals` passes; injecting `const url = "localhost:5002/test"` into any controller flips both red.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Coverage gate and the SC-013 contract-regression test, both of which are easier to land last because they exercise the union of every other user story.

- [x] T052 [P] Run `npm run test:coverage` from `Server/` and confirm ≥ 80% line and branch coverage on every module touched by this phase: `inventory.controller`, `inventory.service` (new methods), `inventory.routes`, `auth.controller`, `auth.routes`, `auth.validation`, `auth.service` (new), `order.controller`, `order.service` (new method), `order.routes`, `order.validation` (new), `order-existence.middleware` (new), `menu.controller`, `menu.routes`, `menu.validation` (new), `menu.service` (new), `index.js` (route mounts), `infrastructure/csv/rfc4180.js` (new). If any falls short, identify the uncovered branches in the coverage report and add targeted tests.

- [x] T053 Create `Server/__tests__/regression/api-contracts.test.js` per SC-013. Approach: a single test file containing a hand-curated set of `[method, path, expectedStatus, expectedShape]` tuples covering every previously mounted endpoint that this phase did not introduce or refactor. For each tuple, supertest hits the endpoint with a valid token and asserts the response status and a Joi-shape-validation against the expected shape. The point is not to retest behavior — it is to flag any unintentional contract drift introduced by the bug fixes.

- [x] T054 [P] Update `Server/README.md` (if present) and `Server/.env.example` to reflect:
  - The two new optional `User` fields (`phone`, `avatar`).
  - The four new endpoints (`PATCH /api/auth/update-profile`, `PATCH /api/auth/update-password`, `GET /api/inventory/export`, `GET /api/orders/integrity-report`).
  - The two newly mounted route surfaces (`/api/etl/*`, `/api/pos/*`) and what each requires for auth.
  - The `npm run check:ml-host-literals` static guard.

- [x] T055 Run `quickstart.md` end-to-end (every smoke command for US1 → US7) on a freshly seeded local DB. Any command whose actual output differs from the documented expectation is a bug — file it and resolve before merge.

- [x] T056 Final spec verification: open `spec.md` and tick off every Success Criterion (SC-001 through SC-013, plus SC-002a/b/c, SC-005a, SC-006a, SC-008a) by linking to the test ID(s) that verify it. Add a small `## Verification` block at the top of `tasks.md` recording the SC → T### map. This is the audit trail for the phase.

**Checkpoint**: Coverage gate green; regression test green; quickstart green end-to-end; every spec SC ↔ T### link recorded.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Setup complete. T004 BLOCKS US4. T005–T006 BLOCK US5.
- **US1, US2, US3**: Depend only on Setup; can start in parallel after Phase 1.
- **US4**: Depends on Foundational T004 (User schema extension). Otherwise independent of US1/US2/US3.
- **US5**: Depends on Foundational T005–T006 (CSV helper). Otherwise independent of US1/US2/US3/US4.
- **US6**: Depends only on Setup; independent of every other story.
- **US7**: Depends only on Setup; independent of every other story (the static guard runs against the post-merge tree regardless of which stories shipped).
- **Polish (Phase 10)**: Depends on every desired user story being complete. T052 measures coverage; T053 sweeps the unchanged contract surface.

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Constitution Principle IV).
- Validations before service before controller before route table.
- For US6 specifically: the validator (T045) lands first, then the service (T046), then the controller refactor (T047), then the route wiring (T048) — keeps each diff reviewable.

### Parallel Opportunities (key examples)

- All four [P] tasks in Phase 1 can run in parallel.
- T004 (User schema), T005 (CSV helper), T006 (CSV tests) are all [P] — three independent files.
- Across stories: with the foundational blockers landed, US1 / US2 / US3 / US4 / US5 / US6 / US7 are pairwise independent and can be staffed in parallel by up to seven developers.
- Within US1: T007, T008, T009 are all [P]; T011 ([P]) and T014 ([P]) are independent of T010/T012/T013.
- Within US4: T025–T028 (four test files) are all [P]; T029, T030 (validation schemas) are [P]; T032 vs. T033 (service methods) are independent functions on the same file — sequential but in either order.

### Single-File Conflicts to Watch

- `Server/src/index.js` — touched by US3 only (T024). Other stories MUST NOT modify this file.
- `Server/src/interfaces/controllers/auth.controller.js` — US4 only.
- `Server/src/interfaces/controllers/inventory.controller.js` — US2 (T020) AND US5 (T040) both add functions; sequence US2 first to settle the import block, then US5 adds the export handler.
- `Server/src/interfaces/controllers/menu.controller.js` — US6 only (full refactor).
- `Server/src/application/validations/auth.validation.js` — US4 only.
- `Server/src/routes/inventory.routes.js` — US5 only (T041), but watch the route order: `/export` MUST appear before `/:id`.
- `Server/src/domain/models/Order.js` — US1 only (T010, one-line change).

---

## Parallel Example: Phase 2 Foundational

```bash
# Three independent files, three developers, one ticket.
Task: "Extend Server/src/domain/models/User.js with optional phone/avatar fields (T004)"
Task: "Create Server/src/infrastructure/csv/rfc4180.js — RFC 4180 CSV emit helper (T005)"
Task: "Create Server/__tests__/services/csv.rfc4180.test.js — round-trip + escape cases (T006)"
```

## Parallel Example: User Story 4 Tests-First

```bash
# Four developers, four independent test files; all should FAIL before implementation lands.
Task: "Write API tests for PATCH /api/auth/update-profile (T025)"
Task: "Write API tests for PATCH /api/auth/update-password (T026)"
Task: "Write service tests for auth.service.updateProfile (T027)"
Task: "Write service tests for auth.service.updatePassword (T028)"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 Setup (T001–T003).
2. Phase 3 US1 (T007–T016).
3. **STOP and VALIDATE**: run `quickstart.md` US1 smoke commands; merge.
4. Deploy to staging; observe one operational day.

### Incremental Delivery (recommended)

1. **Sprint 1** — Setup + Foundational + US1 + US2 + US3. Three of the five P1 stories ship in the first cut.
2. **Sprint 2** — US4 + US5. Completes the P1 slice. Settings and inventory export both go live.
3. **Sprint 3** — US6. Architecture cleanup; menu validation tightens up data integrity.
4. **Sprint 4** — US7 + Polish. Static guard lands; coverage and regression gates close out the phase.

### Parallel Team Strategy

After Phase 1 + Phase 2:

- Developer A: US1 (heaviest — pipeline + integrity report).
- Developer B: US4 (heaviest — two endpoints, change-policy, atomicity).
- Developer C: US5 + US6 (medium each, related — both touch `inventory.routes` / `menu.routes`).
- Developer D: US2 + US3 + US7 (small each — quick singles).

Each developer ships their story as a self-contained PR; no cross-story merge conflicts.

---

## Notes

- `[P]` tasks = different files, no dependencies in the same phase.
- `[Story]` label maps each task to its user story for traceability.
- Each user story is independently completable and testable; the polish phase verifies the seams.
- Verify tests fail before implementing — that is what proves the test exercises real behavior.
- Commit after each task or logical group; conventional-commits with the task ID in the trailer.
- Stop at any checkpoint to validate the story independently.
- Avoid: vague tasks, same-file conflicts (see "Single-File Conflicts to Watch"), cross-story dependencies that break independence, and any change outside this spec's named files (FR-025 binds the diff scope).
