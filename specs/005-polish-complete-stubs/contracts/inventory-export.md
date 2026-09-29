# Contract: GET /api/inventory/export

**Feature**: 005-polish-complete-stubs
**Status**: Existing route (no new route — FR-023). The handler at `Server/src/interfaces/controllers/inventory.controller.js` `exportCsv` is **modified** in three ways: drop the `category` column, fix the filename hyphenation, and accept an optional `?filtered=true` query mode (FR-018, FR-020, FR-027).

## Route

```
GET /api/inventory/export[?filtered=true&...listing-query-params]
```

## Auth

- Requires a valid JWT in the `Authorization: Bearer <token>` header.
- The existing `axios` interceptor handles 401.
- Same authorization scope as the listing endpoint `GET /api/inventory` — verify the existing role guard in `inventory.routes.js`.

## Query parameters

| Param | Type | Default | Effect |
|-------|------|---------|--------|
| `filtered` | `"true"` \| absent | absent (full mode) | When `"true"`, the export honors the listing endpoint's filter/search query params. When absent or `"false"`, the export returns the full inventory. |
| `q` (search) | string | — | Honored only when `filtered=true`. Substring match against `Ingredient.name`. |
| `unit` (filter) | string | — | Honored only when `filtered=true`, if the listing service supports it. |
| `lowStock`, `expired`, `nearExpiry` (filter flags) | boolean | — | Honored only when `filtered=true`, if the listing service supports them. |
| `page`, `limit` (pagination) | number | — | **Always ignored.** The export returns every matching row, never a single page. |

The set of honored filter params is whatever `inventoryService.getAllIngredients(req.query)` already supports — this contract does not introduce any new filter dimension.

## Response

**Status**: 200 (always, when the request is authorized — including the empty-set case per FR-021)

**Headers**:
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="inventory-YYYY-MM-DD.csv"
```

**Note**: The filename uses **hyphens** between year/month/day (e.g., `inventory-2026-05-03.csv`). The current code emits `YYYYMMDD` without hyphens — this is corrected per FR-020.

**Body**: RFC 4180 CSV, produced by the existing `Server/src/infrastructure/csv/rfc4180.toCsv(headers, dataRows)` helper.

**Header row (exactly, in this order — FR-018)**:
```
name,quantity,unit,minStock,costPerUnit,expiryDate,wasteQuantity
```

7 columns. The `category` column from the current handler is **dropped** (the `Ingredient` model has no `category` field; emitting an empty string for a column every consumer must skip is a misleading contract — per the 2026-04-30 clarification, no schema change is in scope, so the column goes away rather than the field being added).

**Data row projection per `Ingredient` document**:
| CSV column | Source | Format |
|------------|--------|--------|
| `name` | `i.name` | string, RFC 4180-escaped |
| `quantity` | `i.quantity` | number |
| `unit` | `i.unit` | string |
| `minStock` | `i.minStock` | number |
| `costPerUnit` | `i.costPerUnit` | number |
| `expiryDate` | `i.expiryDate` | `YYYY-MM-DD` (ISO date, no time) — empty string if null |
| `wasteQuantity` | `i.wasteQuantity` | number |

**Empty-set behavior (FR-021)**: When the inventory has zero ingredients (full mode) or no rows match the filter (filtered mode), the response is **header-only**:
```
name,quantity,unit,minStock,costPerUnit,expiryDate,wasteQuantity
```
This is a 200, not a 4xx, and not an empty body.

## Frontend usage

The `Inventory.jsx` page surfaces **two** affordances:

| Button | Visibility | Request |
|--------|------------|---------|
| **Export** | Always visible | `GET /api/inventory/export` (no query params) |
| **Export Filtered** | Rendered **only** when a search term or filter is active | `GET /api/inventory/export?filtered=true&q=...&unit=...` (with whatever listing-query-state is currently active) |

Pagination state (`page`, `limit`) is **not** propagated — the export is full or filter-full, never paginated.

## Error responses

| Status | Body | Cause |
|--------|------|-------|
| 401 | (handled by `axios` interceptor) | Expired/invalid token |
| 403 | `{ success: false, message: "..." }` | User lacks role (verify existing route guard) |
| 5xx | `{ success: false, message: "Error exporting inventory", error: "..." }` | Database / service-layer error |

## Implementation notes

The existing handler structure (illustrative of the change, not the implementation):

```javascript
exports.exportCsv = async (req, res) => {
  try {
    const isFiltered = req.query.filtered === 'true';
    const items = isFiltered
      ? await inventoryService.getAllIngredients(req.query) // honors filter; verify pagination is ignored or strip page/limit before passing
      : await inventoryService.exportRows({}); // full inventory

    const headers = [
      'name', 'quantity', 'unit', 'minStock',
      'costPerUnit', 'expiryDate', 'wasteQuantity'
      // 'category' removed — FR-018
    ];
    const dataRows = items.map(i => [
      i.name,
      i.quantity,
      i.unit,
      i.minStock,
      i.costPerUnit,
      i.expiryDate ? new Date(i.expiryDate).toISOString().slice(0, 10) : '',
      i.wasteQuantity
    ]);
    const csvBody = toCsv(headers, dataRows);
    const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD with hyphens — FR-020
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="inventory-${dateStr}.csv"`);
    res.status(200).send(csvBody);
  } catch (error) {
    logger.error(`Inventory exportCsv Error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Error exporting inventory', error: error.message });
  }
};
```

- If `inventoryService.getAllIngredients` honors `page`/`limit`, the controller MUST strip those keys from `req.query` before passing (or pass an explicit subset of allowed filter params) — otherwise the filtered export silently truncates to one page.
- No new public service method is required if `getAllIngredients` already honors the filter dimensions. If not, a thin `inventoryService.getFilteredForExport(query)` MAY be added that mirrors the listing filter logic minus pagination.
- No new route is added (FR-023 preserved). No new schema change (FR-022 preserved). No new server dependency (FR-025 preserved).
