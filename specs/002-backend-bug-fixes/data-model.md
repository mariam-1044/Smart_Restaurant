# Phase 1 Data Model — Backend Bug Fixes & Missing Endpoints

**Feature**: 002-backend-bug-fixes
**Date**: 2026-04-27

This phase makes **one** schema-touching change and **zero** new
collections. Everything else is pure code (validators, services,
middlewares, route mounts, controllers). This document is short by
design; the spec's *Key Entities* section is the authoritative
behavioral description.

---

## 1. Order — `status` default value correction (US1, FR-001, SC-001)

**File**: `Server/src/domain/models/Order.js`
**Line**: 14
**Change**:

```diff
 status: {
     type: String,
     enum: ['pending', 'preparing', 'completed', 'cancelled'],
-    default: 'competed'
+    default: 'pending'
 },
```

**Why this is not a schema migration**:
- The `enum` set is unchanged; `'competed'` was never one of the
  allowed values, so Mongoose was already rejecting any explicit
  attempt to *write* that string. The default was the only path
  that ever produced a `'competed'` document.
- Existing documents already in the DB carrying the legacy value
  are surfaced via the new `GET /api/orders/integrity-report`
  endpoint and remediated manually (see § 3 below).

**Indexes**: unchanged — `{ status: 1, createdAt: -1 }` is preserved.

**Behavioral impact**:
- Every newly created order without an explicit `status` is now
  born `pending`, eligible for the existing `pending → preparing →
  completed` and `pending → cancelled` transitions.
- This corrects SC-001 (100% of new orders status = `pending`).

---

## 2. Validation schemas (no DB shape change, but they are the
authoritative server-side input contract)

### 2.1 Order create (US1, FR-002, FR-003)

**File**: `Server/src/application/validations/order.validation.js`
**Library**: Joi 18 (already in deps)

**Shape contract** (level (a) of the four-level pipeline):

```javascript
const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const orderSchema = Joi.object({
  items: Joi.array().min(1).items(
    Joi.object({
      dish: objectId.required(),
      quantity: Joi.number().integer().min(1).required()
    })
  ).required(),
  source: Joi.string().valid('POS', 'Online', 'POS_SIMULATOR').required(),
  paymentMethod: Joi.string().valid('Cash', 'Card', 'Online', 'Wallet').required(),
  customer: objectId.optional(),
  user: objectId.optional()
});
```

**Note**: the schema mirrors the Mongoose enums exactly. The
existence-and-stock checks (levels b/c/d) live in
`order-existence.middleware.js` (see plan § Project Structure) and
are not part of this Joi schema — Joi cannot reach the DB.

### 2.2 Menu create / update (US6, FR-016, FR-017)

**File**: `Server/src/application/validations/menu.validation.js`
**Library**: Joi 18

**Shape contract**:

```javascript
const dishSchema = Joi.object({
  name: Joi.string().required().trim(),
  description: Joi.string().allow('').optional(),
  price: Joi.number().min(0).required(),
  category: Joi.string().valid(
    'Pizza', 'Grills', 'Drinks', 'Desserts',
    'Sides', 'Burgers', 'Pasta', 'Main'
  ).required(),
  imageUrl: Joi.string().optional(),
  ingredients: Joi.array().items(
    Joi.object({
      ingredient: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
      quantity: Joi.number().min(0).required()
    })
  ).optional(),
  isAvailable: Joi.boolean().optional()
});
```

**Note**: the `category` enum mirrors `Dish.js` exactly. If the Dish
model's enum changes in a later phase, this schema must move with
it (caught by an integration test).

### 2.3 Auth — change-password (US4, FR-012a)

**File**: `Server/src/application/validations/auth.validation.js`
(addition; existing `registerSchema` and `loginSchema` are
unchanged)

```javascript
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(/[A-Za-z]/, 'must contain a letter')
    .pattern(/[0-9]/, 'must contain a digit')
    .required()
});
```

The "must differ from current password" rule is **NOT** here — it
is enforced in the service layer because Joi cannot read the
stored hash. (See research.md R-05.)

### 2.4 Auth — update-profile (US4, FR-011, FR-011a)

**File**: `Server/src/application/validations/auth.validation.js`
(addition)

```javascript
const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional(),
  phone: Joi.string().optional(),
  avatar: Joi.string().uri().optional(),
  email: Joi.string().email().optional()  // accepted-but-checked against current; see controller
}).min(1);  // at least one field present
```

The `email` field is accepted by the schema (so a same-value
no-op is HTTP 200) but the controller short-circuits with HTTP 400
if the value differs from `req.user.email` (see research.md R-04).

---

## 3. Order Integrity Report (US1, FR-004, SC-002c)

This is **not** a new collection or model — it is a query against
the existing `Order` collection.

**Endpoint**: `GET /api/orders/integrity-report`
**Auth**: `protect` + `restrictTo('admin')`
**Service-layer query** (in `order.service`):

```javascript
async getIntegrityReport() {
  // Mongoose enum validation prevents writing 'competed' going
  // forward; this query only finds pre-existing legacy documents.
  // We bypass the schema enum by querying the underlying raw value.
  const legacy = await Order.find({ status: 'competed' }).select('_id').lean();
  return {
    count: legacy.length,
    orderIds: legacy.map(o => String(o._id))
  };
}
```

**Idempotency**: the query is read-only; no side effects.

**Index reuse**: the existing `{ status: 1, createdAt: -1 }`
compound index serves this query — no new index needed. (Note: at
pilot scale ≤ 500 orders/day × 30 days < 15k documents, even a
collection scan would meet SC-002c implicitly.)

---

## 4. Inventory CSV Export — derived view, no schema change (US5)

**Endpoint**: `GET /api/inventory/export`
**Source**: `Ingredient` collection (existing).
**Columns** (per FR-006, in this order):

| Column        | Source field                                     |
|---------------|--------------------------------------------------|
| name          | `Ingredient.name`                                 |
| category      | (Ingredient has no `category`; emit empty string — see ⚠ below) |
| quantity      | `Ingredient.quantity`                             |
| unit          | `Ingredient.unit`                                 |
| minStock      | `Ingredient.minStock`                             |
| costPerUnit   | `Ingredient.costPerUnit`                          |
| expiryDate    | `Ingredient.expiryDate` (ISO 8601 yyyy-mm-dd)     |
| wasteQuantity | `Ingredient.wasteQuantity`                        |

**⚠ Schema mismatch flagged for the implementation phase**: The
spec's `column set` (FR-006) lists `category`, but the current
`Ingredient.js` model has **no `category` field**. The
implementation must either:
(a) add `category` to `Ingredient.js` (out of scope per FR-025 — no
    breaking schema changes),
(b) emit an empty string for `category` and document this in
    `quickstart.md`,
(c) or open a follow-up to align the spec column set with the
    actual model.

**Decision for this plan**: option (b) — emit empty string for
`category`. The implementation must update `quickstart.md` to
document the gap, and a follow-up issue should track adding
`category` to the Ingredient model in a separate phase. SC-008
(escape correctness) and SC-008a (filter equivalence) are unaffected
by this gap.

---

## 5. No other schema changes

For clarity on what is **explicitly NOT** changing:

- `User.js` — **schema edit required**. `User.js` currently has
  `name`, `email`, `password`, `role`, `status`, `tokenVersion`
  and no `phone` or `avatar`. To support `update-profile` for those
  fields (FR-011), two **optional** fields must be added:

  ```javascript
  phone: { type: String, trim: true },
  avatar: { type: String, trim: true }
  ```

  This is non-breaking (Mongoose treats new optional fields as
  null on existing documents; no migration required). The plan
  owns this small extension — it would otherwise force the
  validation schema in `update-profile` to reject `phone`/`avatar`
  silently when persisted, defeating FR-011.
- `Dish.js` — no schema edit. `menu.validation.js` mirrors the
  existing model enums.
- `Customer.js` — no schema edit; existence check in the order
  pipeline reads the existing document shape.
- No new collections, no new indexes, no new triggers.

---

## 6. Spec-implementation gap log (raised during data-model design)

These items are spec-level claims that the data-model review found
to be inconsistent with the current code. None of them are
blocking — they're recorded here so the implementation phase can
either close the gap (with the user's approval) or document the
divergence.

| # | Spec claim                                       | Current code                                  | Plan resolution                                         |
|---|--------------------------------------------------|----------------------------------------------|--------------------------------------------------------|
| 1 | CSV `category` column (FR-006)                   | `Ingredient.js` has no `category` field       | Emit empty string; raise follow-up to add the field    |
| 2 | Profile update: `phone`, `avatar` (FR-011)        | `User.js` lacks both fields (verified)        | Add as optional fields on the User schema (non-breaking, no migration) — included in this plan as a small data-model extension |
| 3 | `customer` field on Order optional (FR-002)       | `Order.js` has both `customer` and `user`     | Aligned — pipeline allows both, requires neither       |
