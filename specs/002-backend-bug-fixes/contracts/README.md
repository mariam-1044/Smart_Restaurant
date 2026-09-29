# Contracts — Backend Bug Fixes & Missing Endpoints

These `.http` files are executable request/response examples (REST
Client / IntelliJ HTTP-Client format) covering the four new
endpoints introduced by this feature. Each example doubles as a
fixture for the corresponding Jest+supertest test in
`Server/__tests__/api/`.

## Endpoints in this contract surface

| Endpoint                                              | Auth                       | Story | Test fixture                                           |
|-------------------------------------------------------|----------------------------|-------|--------------------------------------------------------|
| `PATCH /api/auth/update-profile`                      | `protect` (any user)       | US4   | `__tests__/api/auth.update-profile.test.js`            |
| `PATCH /api/auth/update-password`                     | `protect` (any user)       | US4   | `__tests__/api/auth.update-password.test.js`           |
| `GET /api/inventory/export`                           | `protect` + `restrictTo('admin','staff')` | US5 | `__tests__/api/inventory.export.test.js`               |
| `GET /api/orders/integrity-report`                    | `protect` + `restrictTo('admin')` | US1 | `__tests__/api/orders.integrity-report.test.js`        |

## Error-shape convention

All endpoints follow the existing project convention (visible in
`Server/src/interfaces/controllers/inventory.controller.js`):

```json
{ "success": false, "message": "<human-readable summary>" }
```

For order-create validation rejections (touching the existing
endpoint, contract not in this folder), the per-cause tag is added
under a `cause` field:

```json
{
  "success": false,
  "message": "validation failed",
  "cause": "shape" | "dish" | "customer" | "stock",
  "errors": [{ "field": "...", "message": "..." }]
}
```

For password-policy rejections (per FR-012a), the violation list:

```json
{
  "success": false,
  "message": "password policy violation",
  "violations": ["min_length", "missing_letter", "missing_digit", "same_as_current"]
}
```

## Bearer token convention

`{{token}}` placeholders are resolved by the test harness to a fresh
JWT signed with the project's existing `jsonwebtoken` flow. Each
test file logs in (or seeds a token directly via the same secret)
in its `beforeAll`.

## CSV response handling (inventory export)

Tests assert:
1. `Content-Type: text/csv; charset=utf-8`
2. `Content-Disposition: attachment; filename="inventory-<yyyymmdd>.csv"`
3. The body parses round-trip via the same RFC-4180 helper used for
   emit (proving escape correctness — SC-008).

## Status code matrix (cross-cutting)

| Scenario                                | Expected status |
|-----------------------------------------|-----------------|
| No `Authorization` header               | 401             |
| Wrong role for the endpoint             | 403             |
| Validation failure (shape / policy)     | 400             |
| Success                                 | 200             |
| Success on resource creation            | 201 (n/a here — no creates added) |
| Resource not found                      | 404             |
| Server-side bug (must never happen)     | 500             |
