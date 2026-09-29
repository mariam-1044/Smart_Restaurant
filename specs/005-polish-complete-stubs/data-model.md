# Data Model: Polish & Complete All Stubs

**Feature**: 005-polish-complete-stubs
**Date**: 2026-05-03
**Phase**: 1 (Design & Contracts)

This feature introduces no persistent entities and no DB schema changes (FR-022). The entities below are either (a) transient client-side or (b) projections of existing models that are surfaced through this feature's flows.

---

## Transient entities

### Theme Preference

A single string in the user's browser `localStorage`.

| Field | Type | Allowed values | Notes |
|-------|------|----------------|-------|
| `theme` | string | `"light"` \| `"dark"` | Stored under literal key `"theme"`. Default (when key absent) is `"light"`. Read on every page load by the inline bootstrap script in `index.html`. |

- **Lifecycle**: created the first time the user flips the toggle to dark; updated on every subsequent toggle; cleared if the user clears site data.
- **Persistence**: client-side only. Not synchronized server-side, not synchronized cross-device, not synchronized cross-tab in this iteration.
- **Failure mode**: `localStorage.setItem` may throw in private-browsing mode or when storage quota is exceeded. The toggle still applies in-memory; the preference reverts to default on next reload (silently, no user-visible error).

### Report PDF (transient artifact)

A client-side PDF blob produced on demand from the Report page DOM.

| Field | Type | Source |
|-------|------|--------|
| `filename` | string | `restaurant-report-${YYYY-MM-DD}.pdf` using the user's local date |
| `content` | binary (PDF) | `html2canvas(element, { scale: 2 }).toDataURL("image/png")` → `jsPDF.addImage(...)` → `pdf.output("blob")` |
| `dimensions` | A4 width × N (auto height) | One PDF page sized to capture the full report content area |

- **Lifecycle**: generated synchronously on Export PDF click; downloaded by the browser; never persisted server-side; not retrievable later.
- **Failure mode**: a `html2canvas` rejection (rare; usually CORS-tainted images) or a `jsPDF` failure (very rare) surfaces as a toast error per FR-006. The button re-enables.

### Inventory CSV (transient artifact)

A server-rendered CSV stream derived from the `Ingredient` collection at request time.

| Field | Type | Notes |
|-------|------|-------|
| `filename` | string | `inventory-${YYYY-MM-DD}.csv` (with hyphens — FR-020) |
| `headers` | string array | `["name", "quantity", "unit", "minStock", "costPerUnit", "expiryDate", "wasteQuantity"]` (7 columns; `category` is dropped per FR-018 and the 2026-04-30 clarification) |
| `body` | RFC 4180 CSV text | Produced by the existing `infrastructure/csv/rfc4180.toCsv(headers, dataRows)` helper |
| `mode` | `"full"` \| `"filtered"` | Selected by `req.query.filtered === "true"` (FR-027) |

- **Lifecycle**: generated synchronously per request; sent as `text/csv; charset=utf-8`; never cached.
- **Empty-set behavior**: returns header-only body — never an error and never an empty body (FR-021).

---

## Settings profile editable field set

The Settings profile form submits a strict subset of the existing `User` schema. No schema change is involved; this is a contract on the form and the controller's accepted payload.

| Field | Type | Editable here? | Source/sink |
|-------|------|----------------|-------------|
| `name` | string (required, trimmed) | Yes | `User.name` |
| `email` | string (lowercased, unique) | **No** in this iteration (Q2 clarification, 2026-05-03) | `User.email` — display read-only |
| `phone` | string (trimmed, optional) | Yes | `User.phone` |
| `avatar` | string (URL, optional) | Yes | `User.avatar` |
| `address` | — | **No** — field does not exist on `User` (Q2 clarification) | removed from form |
| `password` | — | Via separate password-change flow only | `User.password` (hashed via `bcryptjs` pre-save hook) |
| `role` | — | No (admin-only via separate user-management flow from feature 003) | `User.role` |
| `status` | — | No (admin-only) | `User.status` |
| `tokenVersion` | — | Server-managed (incremented on password change) | `User.tokenVersion` |

**Frontend payload submitted to `PATCH /api/auth/update-profile`**:
```json
{ "name": "...", "phone": "...", "avatar": "..." }
```
Fields are conditionally included only if changed (or always — implementation choice). The controller's existing handler accepts the partial payload; unknown fields are silently dropped by Mongoose schema validation.

---

## Password change form fields

Three controlled inputs in the Security card on Settings. None of these are persisted on the client beyond the lifetime of the form state.

| Field | Type | Validation | Purpose |
|-------|------|------------|---------|
| `currentPassword` | string | non-empty | Verified server-side against the stored bcrypt hash |
| `newPassword` | string | non-empty client-side; full policy server-side (`min_length`, `missing_letter`, `missing_digit`, `same_as_current`) | The proposed new password |
| `confirmNewPassword` | string | non-empty AND `=== newPassword` (client-side gate) | Belt-and-braces check; if mismatched, submission is rejected without an API call |

**Field-clearing behavior**:

| Outcome | `currentPassword` | `newPassword` | `confirmNewPassword` |
|---------|-------------------|---------------|----------------------|
| 200 success | clear | clear | clear |
| `current_password_incorrect` (FR-016) | clear | **preserve** | **preserve** |
| Password-policy 400 (FR-017) | preserve | preserve | preserve |
| Network 401 / 5xx | preserve | preserve | preserve |

**Frontend payload submitted to `PATCH /api/auth/update-password`**:
```json
{ "currentPassword": "...", "newPassword": "..." }
```
`confirmNewPassword` is **not** sent to the server — it is a client-side gate only.

---

## Inventory listing query parameters honored by `?filtered=true` export

When `GET /api/inventory/export?filtered=true` is called, the export reuses the same query-param contract that the listing endpoint accepts (per the `exports.getAll` flow: `inventoryService.getAllIngredients(req.query)`). Pagination params are explicitly ignored — the export returns every matching row, not a single page.

| Param | Type | Honored in `filtered=true` mode? | Notes |
|-------|------|----------------------------------|-------|
| `q` (search) | string | Yes | Substring match against `name` (verify against existing service implementation) |
| `unit` (filter) | string | Yes | If the listing surface supports it |
| `lowStock`, `expired`, `nearExpiry` (filter flags) | boolean | Yes | If the listing surface supports them |
| `page`, `limit` (pagination) | number | **No** — ignored | Export always returns all matching rows |

The implementing model verifies which params the existing service actually honors; absent params are inert. The export does not introduce any new filter dimension that isn't already on the listing endpoint.

---

## Existing entities referenced (no changes)

These are existing schemas the feature reads from but does not modify. Documented here for grounding only.

### `User` (existing — `Server/src/domain/models/User.js`)

Reads `name`, `email`, `phone`, `avatar`, `password` (write-only), `tokenVersion`. No schema changes.

### `Ingredient` (existing — `Server/src/domain/models/Ingredient.js`)

Reads `name`, `quantity`, `unit`, `minStock`, `costPerUnit`, `expiryDate`, `wasteQuantity` for CSV projection. **`category` is referenced by the current code but does not exist on the model** — this feature corrects that drift by removing the reference. No schema changes.

---

## State transitions

This feature has no state machines worth diagramming. The closest things are:

- **Theme**: light ⇄ dark (toggle).
- **PDF export button**: idle → generating → idle (resets after success or error).
- **Password form**: idle → submitting → (success: cleared, idle) | (error: partially preserved, idle).

All are trivial two-state transitions and do not warrant separate diagrams.
