# Quickstart — Backend Bug Fixes & Missing Endpoints

**Feature**: 002-backend-bug-fixes
**Date**: 2026-04-27

This guide walks through verifying every user story locally on a
fresh checkout, in dependency order. Each story has a prerequisite
"environment ready" check, a happy-path command, and a smoke
assertion you can copy-paste into a terminal.

## Prerequisites

- Node 20.x (project's existing requirement).
- A local MongoDB at `mongodb://localhost:27017/smart_restaurant`
  (or any URI; pass via `MONGODB_URI`).
- An IDE with HTTP-Client support OR `curl` for the contract files.
- The Server's `.env` populated from `.env.example` (the existing
  `JWT_SECRET`, `MONGODB_URI`, `ML_SERVICE_URL`, plus whatever
  001-real-ai-ml-engine added).

```bash
cd Server
npm install
npm run seed         # seeds users/dishes/ingredients for testing
npm run dev          # starts the API on port 5000
```

In a second terminal you'll run the smoke commands below.

---

## US1 — Trustworthy Order Lifecycle (P1)

**What you're verifying**: SC-001, SC-002, SC-002a/b/c.

### Smoke: order is born `pending`

```bash
# Login as admin
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@smart.local","password":"admin123"}' \
  | jq -r '.data.token')

# Place a valid POS order — note: no explicit status field
DISH=$(curl -s http://localhost:5000/api/menu | jq -r '.data[0]._id')
ORDER=$(curl -s -X POST http://localhost:5000/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"items\":[{\"dish\":\"$DISH\",\"quantity\":1}],\"source\":\"POS\",\"paymentMethod\":\"Cash\"}")

# Assert: status is 'pending', not 'competed'
echo "$ORDER" | jq '.data.status'
# expected: "pending"
```

### Smoke: validation pipeline rejects each level

```bash
# Level a (shape): empty items
curl -s -X POST http://localhost:5000/api/orders \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"items":[],"source":"POS","paymentMethod":"Cash"}' | jq '.cause'
# expected: "shape"

# Level b (dish): unknown dish id
curl -s -X POST http://localhost:5000/api/orders \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"items":[{"dish":"000000000000000000000000","quantity":1}],"source":"POS","paymentMethod":"Cash"}' | jq '.cause'
# expected: "dish"

# Level d (stock): order quantity exceeds stock — exact ingredient depends on seed
# (use a dish whose ingredients require more than the seeded quantity)
curl -s -X POST http://localhost:5000/api/orders \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"items\":[{\"dish\":\"$DISH\",\"quantity\":99999}],\"source\":\"POS\",\"paymentMethod\":\"Cash\"}" | jq '.cause'
# expected: "stock"
```

### Smoke: integrity-report endpoint

```bash
# Insert a legacy 'competed' record bypassing schema (test setup only)
mongosh smart_restaurant --eval \
  'db.orders.insertOne({ items:[], totalPrice:0, status:"competed", source:"POS", paymentMethod:"Cash" })'

curl -s http://localhost:5000/api/orders/integrity-report \
  -H "Authorization: Bearer $TOKEN" | jq '.data'
# expected: { count: >=1, orderIds: [...] }

# Non-admin gets 403 — replace TOKEN with a staff or customer token to verify
```

---

## US2 — Inventory Detail Page That Doesn't Crash (P1)

**What you're verifying**: SC-003.

```bash
INGREDIENT=$(curl -s http://localhost:5000/api/inventory \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[0]._id')

# Valid ID → 200 with full record
curl -s -o /dev/null -w "%{http_code}\n" \
  http://localhost:5000/api/inventory/$INGREDIENT \
  -H "Authorization: Bearer $TOKEN"
# expected: 200

# Unknown ID → 404 (NOT 500)
curl -s -o /dev/null -w "%{http_code}\n" \
  http://localhost:5000/api/inventory/000000000000000000000000 \
  -H "Authorization: Bearer $TOKEN"
# expected: 404
```

---

## US3 — Restore ETL & POS API Surfaces (P1)

**What you're verifying**: SC-004.

```bash
# Before this feature: both return 404. After: non-404.
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5000/api/etl/report \
  -H "Authorization: Bearer $TOKEN"
# expected: 200 (or 500 from the existing handler — the point is not 404)

curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5000/api/pos/transaction \
  -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{}'
# expected: 400/422 (validation from the existing handler) — the point is not 404
```

---

## US4 — Settings Page That Actually Saves (P1)

**What you're verifying**: SC-005, SC-005a, SC-006, SC-006a, SC-007.

### Profile update — happy path

```bash
curl -s -X PATCH http://localhost:5000/api/auth/update-profile \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Renamed","phone":"+201001112222"}' | jq '.data | {name, phone}'
# expected: { "name": "Renamed", "phone": "+201001112222" }

# Verify /auth/me reflects it
curl -s http://localhost:5000/api/auth/me -H "Authorization: Bearer $TOKEN" | jq '.data.name'
# expected: "Renamed"
```

### Profile update — email change rejection (atomic)

```bash
# Capture current name
BEFORE=$(curl -s http://localhost:5000/api/auth/me -H "Authorization: Bearer $TOKEN" | jq -r '.data.name')

# Attempt: change name + change email — MUST be rejected, name MUST NOT persist
curl -s -X PATCH http://localhost:5000/api/auth/update-profile \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"ShouldNotPersist","email":"newaddress@example.com"}' | jq '.message'
# expected: "email changes require the email-verification flow (not yet available)"

AFTER=$(curl -s http://localhost:5000/api/auth/me -H "Authorization: Bearer $TOKEN" | jq -r '.data.name')
[ "$BEFORE" = "$AFTER" ] && echo "OK: atomic rejection" || echo "FAIL: name persisted"
```

### Password update — happy path + each policy violation

```bash
# Each of these MUST be rejected at validation; the password MUST NOT change.
for newpw in "abc" "abcdefghi" "12345678" "$(curl -s ... | jq -r .currentPassword)"; do
  curl -s -X PATCH http://localhost:5000/api/auth/update-password \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"currentPassword\":\"admin123\",\"newPassword\":\"$newpw\"}" | jq '.violations'
done

# Happy path
curl -s -X PATCH http://localhost:5000/api/auth/update-password \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"currentPassword":"admin123","newPassword":"newPass2"}' | jq '.success'
# expected: true

# Old password no longer works
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@smart.local","password":"admin123"}'
# expected: 401

# New password works
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@smart.local","password":"newPass2"}'
# expected: 200
```

---

## US5 — Inventory CSV Export (P1)

**What you're verifying**: SC-008, SC-008a.

```bash
# Unfiltered: full inventory
curl -s -D - http://localhost:5000/api/inventory/export \
  -H "Authorization: Bearer $TOKEN" | head -3
# expected headers:
#   HTTP/1.1 200 OK
#   Content-Type: text/csv; charset=utf-8
#   Content-Disposition: attachment; filename="inventory-..."

# Each filter combination
for q in "" "?search=tomato" "?category=Produce" "?lowStock=true" "?nearExpiry=true" "?lowStock=true&category=Produce"; do
  echo "--- q=$q ---"
  curl -s "http://localhost:5000/api/inventory/export$q" \
    -H "Authorization: Bearer $TOKEN" | wc -l
done

# RFC 4180 escape correctness — round-trip
curl -s http://localhost:5000/api/inventory/export -H "Authorization: Bearer $TOKEN" \
  | node -e 'const csv=require("fs").readFileSync(0,"utf-8"); /* helper round-trip */'
```

> **Note**: as documented in `data-model.md § 4`, the `category`
> column is currently empty for all rows because `Ingredient.js`
> has no `category` field. The export contract still emits the
> column header so the schema is stable for when the field is
> added in a future phase.

---

## US6 — Menu Module (P2)

**What you're verifying**: SC-009, SC-010, SC-011.

```bash
# Validation rejects malformed input
curl -s -X POST http://localhost:5000/api/menu \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"price":-1}' | jq '.errors'
# expected: per-field errors for missing 'name', missing 'category', and negative 'price'

# Run the new isolated unit tests for the menu service (no Express)
cd Server
npx jest __tests__/services/menu.service.test.js --coverage
# expected: pass; coverage on menu.service.js >= 80%

# Static check: controller no longer imports Dish directly
grep -E "require.*models/Dish" src/interfaces/controllers/menu.controller.js
# expected: no output (zero matches)
```

---

## US7 — Centralized AI Service Configuration (P3)

**What you're verifying**: SC-012.

```bash
cd Server

# Run the static guard test
npx jest __tests__/static/ml-host-literals.test.js
# expected: pass

# Or invoke the npm script
npm run check:ml-host-literals
# expected: exit 0, "no hardcoded ML host literals found"

# To see what would fail: temporarily inject a violation
echo '// const url = "http://localhost:5002/test"' >> src/interfaces/controllers/ai.controller.js
npm run check:ml-host-literals
# expected: exit 1 with the offending line printed
git checkout -- src/interfaces/controllers/ai.controller.js  # revert

# Override ML_SERVICE_URL and confirm the API server honors it
ML_SERVICE_URL=http://example-ml.local:5050 npm start &
sleep 3
# Trigger any AI endpoint and observe outbound URL via tcpdump / proxy
```

---

## Coverage gate

```bash
cd Server
npm run test:coverage

# Pass thresholds: ≥ 80% lines/branches on every module touched by this phase:
#   inventory.controller, inventory.service, inventory.routes
#   auth.controller, auth.routes, auth.validation
#   order.controller, order.service, order.routes, order.validation, order-existence.middleware
#   menu.controller, menu.routes, menu.validation, menu.service
#   index.js (route mounts)
#
# These are the slices of the codebase governed by SC-002, SC-005, SC-006a,
# SC-008, SC-009, SC-011 and the cross-cutting SC-013 regression test.
```

## API-contract regression (SC-013)

```bash
# Before merging any US into master:
npx jest __tests__/regression/api-contracts.test.js

# This test replays a recorded set of pre-feature responses against the
# post-feature server and asserts shape equality on every previously
# mounted endpoint (auth, menu, orders, inventory, dashboard, AI, sales,
# customers, recommendations, endorsements, pricing). A failure here
# indicates an unintentional breaking change.
```
