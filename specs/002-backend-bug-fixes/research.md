# Phase 0 Research — Backend Bug Fixes & Missing Endpoints

**Feature**: 002-backend-bug-fixes
**Date**: 2026-04-27

This document captures the small set of "decision moments" raised by
the implementation plan that warrant explicit reasoning before code
lands. Everything else is a pattern-match against existing modules in
the codebase (inventory / order / customer / auth) and needs no
research.

---

## R-01 — CSV emission strategy: in-house helper vs. `json2csv`

**Question**: Should the inventory export endpoint use the
`json2csv` library (suggested by the original `smart_restaurant_speckit_plan.md`)
or a small in-house RFC-4180 escape helper?

**Decision**: **In-house ~30-LOC helper.**

**Rationale**:
- The exported column set is fixed (8 columns) and the pilot-scale
  envelope (≤ ~200 ingredients per restaurant; the catalog is
  bounded by spec Assumption) makes a buffered response trivial.
- Adding `json2csv` adds a runtime dependency and a transitive
  dependency tree for behavior that fits in 30 lines: emit the
  header row, then for each row emit each field with RFC-4180
  escaping (wrap in double quotes if the field contains `,`, `"`,
  `\r`, or `\n`; double any embedded `"`).
- The escape contract (FR-007) is testable directly against the
  helper without involving Express, which yields cleaner unit tests
  than mocking `json2csv` would.
- Streaming is not required at pilot scale.
- This decision is consistent with the project's preference for
  minimizing dependency surface where the in-house equivalent is
  small and audit-friendly.

**Rejected alternatives**:
- `json2csv` — adds dependency, no measurable benefit at pilot
  scale, indirect-dependency tree, less direct test contract.
- `papaparse` — primarily a parser; emit path is undermaintained
  for our use case.
- Streaming with `csv-stringify` — not justified at ≤ 200 rows.

**Consequence**: A new file `Server/src/infrastructure/csv/rfc4180.js`
exports `toCsv(headers, rows)` and is the only CSV-emit code path
in the codebase.

---

## R-02 — Order-create validation pipeline shape

**Question**: How should the four-level order-create validation
(shape → dish existence → customer existence → stock fulfillability)
be structured in code?

**Decision**: **A chain of three Express middlewares**, applied in
order on the create-order route:

1. `validate(orderSchema)` — existing `validate.middleware.js`
   pattern, runs the new `order.validation.js` Joi schema (level a:
   shape).
2. `verifyOrderExistence` — new
   `Server/src/middlewares/order-existence.middleware.js` —
   resolves dishes (level b) and the optional customer (level c).
   Reads each dish via `menuService.getById` (after US6 lands; uses
   `menuService.getById` directly) and the customer via
   `customerService.getById`.
3. `verifyStockFulfillability` — same middleware file, exported
   second function. Computes per-ingredient required quantity
   from the resolved dishes and verifies against current
   ingredient stock via `inventoryService.getStock` (a thin reader
   that the existing service already supports through
   `getAllIngredients` filtered by id).

**Rationale**:
- Each level is a separate function → independently unit-testable
  with `mongodb-memory-server`.
- Short-circuit semantics fall out naturally from the
  `next(err)` pattern: each middleware returns a 400 with a
  per-level `cause` tag (`shape` / `dish` / `customer` / `stock`).
- The controller stays thin — it sees only requests that have
  already passed every level — matching the existing
  `validate.middleware.js → controller` pattern.
- No new Joi extension is required for the existence/stock
  checks; they're DB-touching, not schema-validatable.

**Rejected alternatives**:
- Putting all four levels in `order.service.create` — would force
  the controller to translate generic exceptions into per-cause
  400s and would couple validation to side-effecting code, hurting
  test isolation.
- A single mega-middleware running all four levels — same code,
  but harder to unit-test the levels independently and harder to
  reason about timing/cost.

**Consequence**: The `order.routes.js` create-route mounts three
middlewares in order before `orderController.create`. Each
middleware is independently tested in
`__tests__/services/order.validation-pipeline.test.js`.

---

## R-03 — Stock-fulfillability computation under concurrency

**Question**: Two valid orders submitted concurrently might each be
individually fulfillable but together exceed available stock. Should
the new validator pipeline introduce a transactional locking layer?

**Decision**: **No.** The pipeline performs a *check-only* read
against current stock; the actual deduction happens inside the
existing `order.service.create` path under whatever transactional
behavior that path already provides. If two concurrent valid orders
would together overrun stock, the *second* one fails at the existing
deduction step (the same behavior as today, just now caught earlier
at validation for non-concurrent cases).

**Rationale**:
- Spec edge case explicitly says "this spec does NOT authorize a
  new locking mechanism" for the concurrent case.
- The pilot envelope (≤ 500 orders/day) makes the concurrent-overrun
  case rare and operationally acceptable.
- Introducing a transactional lock here would change the behavior
  contract of an endpoint outside the bug-fix scope and conflict
  with FR-025 (no breaking changes).

**Consequence**: The validator pipeline is the *primary* line of
defense for stock-out errors and rejects the overwhelming majority
at validation time. The existing service-layer deduction remains
the *secondary* line that handles the concurrency edge.

---

## R-04 — Email-change rejection precondition

**Question**: Where in the request lifecycle should the
profile-update endpoint reject an email-change attempt?

**Decision**: **In the controller, before any service call.**
Implemented as:

```javascript
exports.updateProfile = async (req, res) => {
  const { email, ...rest } = req.body;
  if (email !== undefined) {
    const current = (req.user.email || '').trim().toLowerCase();
    const incoming = String(email).trim().toLowerCase();
    if (incoming !== current) {
      return res.status(400).json({
        success: false,
        message: 'email changes require the email-verification flow (not yet available)'
      });
    }
  }
  const updated = await userService.updateProfile(req.user.id, rest);
  res.status(200).json({ success: true, data: updated });
};
```

**Rationale**:
- FR-011a requires atomicity: when email is rejected, no other
  field is persisted. A controller-level early-return achieves
  this without needing to wrap the service call in a transaction.
- Case-insensitive trimmed comparison matches the spec edge case
  about `Foo@x.com` vs. `foo@x.com`.
- The service receives only `name`, `phone`, `avatar` — clean
  contract.

**Rejected alternatives**:
- Joi schema with a custom rule comparing to current email — Joi
  has no access to `req.user`, so this would either need a Joi
  extension or two passes; both more code than the controller-side
  early-return.
- Service-layer check — would force the service to be aware of
  the difference between "current email" and "incoming email",
  bleeding HTTP context into the service.

**Consequence**: No code reaches the user model unless the request
already passed the email-equality test. The acceptance scenario in
US4 (`SC-005a`) verifies this with a before/after document hash.

---

## R-05 — Password-change policy: where to enforce each rule

**Question**: The change policy has four rules — length, letter,
digit, and "differs from current." Should every rule be a Joi rule,
or should "differs from current" live in the service?

**Decision**: **Three Joi rules + one service-layer rule.**

- Joi (`changePasswordSchema` in `auth.validation.js`):
  - `currentPassword: required string`
  - `newPassword: required string min(8) pattern(/[A-Za-z]/) pattern(/[0-9]/)`
- Service (`userService.updatePassword`):
  - After bcrypt-compare succeeds on `currentPassword`, compare
    `newPassword !== currentPassword` *as plaintext* (the only
    moment both are in-process); reject with
    `{ code: 'same_as_current' }` if equal.

**Rationale**:
- Joi cannot reach the stored password hash, so it cannot enforce
  the "differs from current" rule.
- Joi *can* enforce the three composition rules (length + letter +
  digit) cleanly using two `pattern()` calls.
- Splitting along the can-Joi-see-it / cannot boundary makes each
  rule testable without elaborate mocking.

**Rejected alternatives**:
- Bcrypt-compare the new password against the stored hash to
  detect equality — would unnecessarily expose timing variability
  and double the bcrypt cost; plaintext-equality is fine because
  both values exist in process at that moment.
- Frontend-only enforcement — out of scope and untrustworthy
  (FR-012a binds the server).

**Consequence**: `changePasswordSchema` is added next to
`registerSchema` / `loginSchema`. The service throws a tagged
domain error on same-as-current, mapped to 400 by the controller.

---

## R-06 — Inventory export query routing

**Question**: When the export receives both `lowStock=true` and
`category=Produce`, which existing service method drives the
result?

**Decision**: **Route to the most specific service method; apply
remaining filters as in-memory predicates on its result.**

Routing table:

| Query                                                  | Service call                               | Post-filter |
|-------------------------------------------------------|-------------------------------------------|-------------|
| (no params)                                            | `getAllIngredients()`                      | none        |
| `search=X`                                             | `getAllIngredients({ search: X })`         | none        |
| `category=X`                                           | `getAllIngredients({ category: X })`       | none        |
| `search=X&category=Y`                                  | `getAllIngredients({ search: X, category: Y })` | none |
| `lowStock=true`                                        | `getLowStockIngredients()`                 | none        |
| `nearExpiry=true` (optional `days=N`)                  | `getNearExpiryIngredients(N)`              | none        |
| `lowStock=true` + (search/category)                    | `getLowStockIngredients()`                 | apply search/category |
| `nearExpiry=true` + (search/category)                  | `getNearExpiryIngredients(N)`              | apply search/category |
| `lowStock=true&nearExpiry=true`                        | `getLowStockIngredients()`                 | filter to also be near-expiry |

**Rationale**:
- The `lowStock` and `nearExpiry` service methods already exist and
  contain the canonical predicates; calling them directly preserves
  consistency with the corresponding inventory views.
- For combined filters, in-memory post-filtering is acceptable at
  pilot scale (the worst case is ≤ ~200 rows × O(1) string
  comparisons per row).
- This avoids duplicating the low-stock / near-expiry predicate
  logic in the controller.

**Rejected alternatives**:
- Build a new composite service method handling every filter
  combination — unnecessary surface area; the in-memory post-filter
  is one branch of code.
- Express the filters as a Mongo aggregation pipeline — premature
  optimization at pilot scale.

**Consequence**: The export controller has a small routing function
plus, for combined cases, an in-memory predicate compose step. The
SC-008a set-equality test exercises every routing arm.

---

## R-07 — AI config CI grep guard implementation

**Question**: How should the "no hardcoded ML host literals" rule
(FR-023, SC-012) be enforced in CI without inventing a new tooling
stack?

**Decision**: **A Jest test that shells out to ripgrep (or a
JS-only equivalent if `rg` is unavailable on the CI image) and
asserts zero matches.**

```javascript
// __tests__/static/ml-host-literals.test.js
test('no hardcoded ML host literals outside config', () => {
  const matches = grepRecursive(
    /\b(localhost:5002|:5002|:8000)\b/,
    'Server/src',
    { exclude: ['infrastructure/config/ai.js'] }
  );
  expect(matches).toEqual([]);
});
```

**Rationale**:
- Reuses the project's existing test runner — no new CI stage,
  no new dependency.
- Surfaces the violation as a normal test failure with a clickable
  file:line in the message.
- Same pattern is recommended by the project's "real intelligence"
  no-mocks guard for the AI service (precedent in
  `001-real-ai-ml-engine`).

**Rejected alternatives**:
- A standalone shell script in `Server/scripts/` invoked by a CI
  yaml — would require adding the call to CI separately and
  wouldn't fail locally on `npm test`.
- An ESLint rule — would work but requires authoring a custom
  rule, more code than the test.

**Consequence**: One new file in `__tests__/static/` and one new
npm script (`check:ml-host-literals`) wrapping the same logic for
ad-hoc local invocation. No CI yaml changes required.
