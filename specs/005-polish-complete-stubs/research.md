# Research: Polish & Complete All Stubs

**Feature**: 005-polish-complete-stubs
**Date**: 2026-05-03
**Phase**: 0 (Outline & Research)

This document captures the design decisions behind each stub fix. Most "unknowns" were resolved in the spec's Clarifications sessions on 2026-04-30 and 2026-05-03; this file consolidates those into actionable design notes for the implementing model.

---

## R1 — PDF Export: jspdf + html2canvas at scale: 2

**Decision**: Client-side rasterized PDF. The Report page wraps its printable region in `<div id="report-content">`. The handler:
1. Calls `html2canvas(element, { scale: 2, useCORS: true, backgroundColor: getComputedStyle … })` to produce a `<canvas>`.
2. Reads `canvas.toDataURL("image/png")`.
3. Constructs a `jsPDF` instance sized to the canvas's pixel dimensions converted to A4 width preserving aspect ratio (taller-than-A4 page is acceptable per FR-005 and User Story 1 Acceptance Scenario 4).
4. Calls `pdf.addImage(...)` once.
5. Calls `pdf.save("restaurant-report-YYYY-MM-DD.pdf")`.

**Rationale**:
- `scale: 2` (Q4 clarification, 2026-05-03) keeps chart axis labels and table figures sharp on zoom; file size 2–3 MB; well inside the SC-002 5-second budget.
- `useCORS: true` is required because Recharts SVG and any remote-loaded images would otherwise taint the canvas and silently produce a blank image.
- Setting `backgroundColor` to the resolved CSS variable (light or dark) avoids transparent PDF backgrounds that read as black in most viewers.
- The "taller PDF page" approach is simpler than multi-page slicing and matches Acceptance Scenario 4's "implementation detail" allowance. Multi-page slicing is a P5 enhancement.

**Alternatives considered**:
- **`@react-pdf/renderer`** — produces searchable-text PDFs but requires re-authoring the report layout in its component DSL. Rejected; would more than double the scope.
- **Server-side `puppeteer`** — produces the highest-fidelity output but adds a heavy server dependency, headless-chromium binary, and a new endpoint. Rejected; violates FR-023 and FR-025 server-side.
- **`window.print()` to PDF** — relies on the user's print dialog, doesn't produce a downloaded file, and can't satisfy the named-file requirement (FR-003). Rejected.

**Operational notes**:
- The PDF button uses local component state (`isExporting`) to disable itself during a run, satisfying FR-004 and Acceptance Scenario 5. No global lock needed — duplicate-click protection is per-button-instance.
- Errors from `html2canvas` (rare; usually CORS-tainted images) and `jsPDF.save` (very rare; OOM on huge canvases) are caught and surfaced through `useToast().error(...)` per FR-006.

---

## R2 — Dark Mode: CSS variables + `data-theme` attribute, FOUC-free bootstrap

**Decision**: One CSS-variables source of truth in `Client/src/styles/variables.css`. Light tokens under `:root { … }`; dark tokens under `[data-theme="dark"] { … }`. A single `<script>` block in `Client/index.html` (synchronous, before the React bundle loads) reads `localStorage.theme` and sets `document.documentElement.dataset.theme` so the very first paint already has the correct theme.

**Rationale**:
- The existing pages already consume CSS variables for primary surface colors. Flipping the attribute on `<html>` re-themes everything in one move (Q6 clarification, 2026-04-30).
- The inline `<script>` in `index.html` runs before the React bundle parses, eliminating the flash-of-light-content on a dark-mode reload (SC-005). React-driven application would be one tick too late.
- A small `ThemeContext` (`theme: 'light' | 'dark'`, `toggleTheme()`) exposes the in-app toggle to Settings without re-implementing localStorage I/O at the call site.

**Inline bootstrap script** (illustrative, exact code is the implementing model's call):
```html
<script>
  try {
    var t = localStorage.getItem('theme');
    if (t === 'dark') document.documentElement.dataset.theme = 'dark';
  } catch (e) {} // private browsing or storage disabled — fall back to light
</script>
```

**Alternatives considered**:
- **Tailwind's `dark:` modifier** — would require adding `dark:` variants to every existing page's class list. Rejected per Q6 clarification as too invasive for a polish pass.
- **OS `prefers-color-scheme` auto-detection** — explicitly out of scope per Q2 clarification (2026-04-30). Default is light, period.
- **React-only theme application (no inline script)** — produces a visible light-flash on every dark-mode reload, violating SC-005.
- **Cross-tab `storage` event sync** — explicitly P5 per the Edge Cases section; not implemented.

**Operational notes**:
- A `localStorage.setItem('theme', …)` failure in private-browsing mode is caught silently; the in-memory toggle still works, the preference just won't persist.
- The `Setting.jsx` toggle's `useState(false)` initialization is replaced by a `useTheme()` hook reading the current attribute. The toggle's checked state is the source of truth for the user, but `localStorage` is the source of truth across reloads.

---

## R3 — Toast component: in-app, ~50 LOC, zero new deps

**Decision**: Build `Toast`, `ToastContext`, `ToastContainer` under `Client/src/components/toast/`. The provider holds an array of `{ id, variant: 'success' | 'error', message }`. `useToast()` exposes `success(msg)` and `error(msg)`. Each toast auto-dismisses after ~4 s via `setTimeout`. The container renders fixed top-right and stacks vertically. The whole thing fits in ~50–80 LOC across three files.

**Rationale**:
- FR-025 forbids new dependencies beyond `jspdf` + `html2canvas`, so a third-party toast library (`react-hot-toast`, `sonner`) is rejected even though either would be ~3–5 KB gz.
- The current `Setting.jsx` uses inline colored banners tied to local state — functional but not stackable, not auto-dismissing, and not reusable from PDF/inventory flows. Promoting to a real toast component is a one-time cost that pays back in three of four user stories.
- Variants are scoped to `success` and `error` only (FR-026). `info`/`warning` are deferred — adding them later costs three lines.

**Alternatives considered**:
- **Keep inline banners, polish them** (Option A in Q1) — visibly inferior; doesn't meet "professional polish" framing of the feature.
- **Add `react-hot-toast` (~3 KB)** (Option C in Q1) — cleanest API but breaks FR-025; rejected.
- **Use `window.alert()` for errors** (Option D in Q1) — even worse than the stub it's replacing; rejected.

**Operational notes**:
- `ToastContainer` is mounted once at the App root inside `<ToastProvider>`. There is no portal; CSS `position: fixed; top: 1rem; right: 1rem; z-index: 9999;` on the container is sufficient and avoids React 19 portal API complexity.
- The component must consume CSS variables for its own surface and text so it themes correctly under `data-theme="dark"` (R2 dependency).
- Toast IDs are generated locally (e.g., `Date.now() + Math.random()`); no UUID dep.

---

## R4 — Settings refactor: editable field set, password form, AuthContext propagation

**Decision**: `Setting.jsx` is restructured (single file change) so that:
- The Profile card's editable inputs are **`name`, `phone`, `avatar`** (URL string). The current `email` and `address` inputs are removed (Q2 clarification, 2026-05-03). `email` may be displayed read-only for context but is not part of the form submission.
- The submit handler `PATCH /api/auth/update-profile` with the three-field payload, then on 200 **merges the response payload into AuthContext via `setUser(profileResponse.data.data.user)`** (FR-014).
- Toasts replace the inline `setError` / `setSuccess` banners.
- The Security card embeds an in-page password form: three controlled inputs (`currentPassword`, `newPassword`, `confirmNewPassword`) and a Submit button. Client-side validation rejects submission when `newPassword !== confirmNewPassword`. On 200, all three fields clear; on `current_password_incorrect`, only the current-password field clears (FR-015, FR-016).

**Rationale**:
- The current `address` input posts a field the User schema doesn't define — Mongoose silently drops it but the form is misleading. Removing closes the drift.
- The User model has `avatar`; the spec's stated intent (US3 narrative) was always `name + phone + avatar`. The form aligns with both.
- `email` editing is a separate, security-sensitive flow (uniqueness collision, re-verification). Excluding it here keeps this feature's blast radius limited to the four named stubs.
- `window.prompt()` for password collection (today's code) cannot satisfy the spec's acceptance scenarios about preserving the new-password field on a wrong-current-password error or rendering structured policy violations. The embedded form does both naturally.

**Alternatives considered**:
- **Modal-based password form** (Option C in Q3) — nicer UX but adds focus-trap and overlay scope; rejected as out of proportion for a polish pass.
- **Separate `/settings/security` route** (Option D in Q3) — over-engineered.
- **Allow `email` editing** (Option C in Q2) — adds uniqueness-collision and re-verification handling that this feature is not budgeted for.

**Operational notes**:
- The existing `axios` 401 interceptor handles expired tokens — the Settings flow does not need to re-implement that. The error toast for non-401 failures uses the server's `message` field (which the existing controllers already populate).
- Password policy violations (`min_length`, `missing_letter`, `missing_digit`, `same_as_current`) are mapped by the controller into a single `message` string; FR-017 only requires that string render in the toast — no client-side i18n table.
- AuthContext already exposes `setUser`; no changes to `AuthContext.jsx` itself.

---

## R5 — Inventory CSV export: drop `category`, fix filename, add `?filtered=true`

**Decision**: `Server/src/interfaces/controllers/inventory.controller.js` `exportCsv` handler is corrected:
1. Drop `category` from `headers` and from the `dataRows` projection (Q5 clarification, 2026-04-30).
2. Filename format becomes `inventory-YYYY-MM-DD.csv` with hyphens (current code emits `inventory-YYYYMMDD.csv` without hyphens — FR-020 mandates hyphens).
3. When `req.query.filtered === 'true'`, the handler passes the same query params the listing endpoint accepts to the service layer; otherwise it exports the full inventory (FR-027). Pagination params (`page`, `limit`) are explicitly ignored in both modes — the export returns every matching row.
4. The Inventory page UI gets two buttons: **Export** (always visible) and **Export Filtered** (rendered only when a filter or search term is active). Both call the same endpoint with different query strings.

**Rationale**:
- The existing `Ingredient` model has no `category` field (FR-022 forbids adding one). The current code outputs `''` as a placeholder, producing a column every consumer must skip. Dropping the column is the cleaner contract; a future feature can add the field and the column together.
- The filename hyphenation is a 1-line fix; current `YYYYMMDD` parses unambiguously but offends the contract in FR-020 and Acceptance Scenario about date-stamped files.
- `req.query` is already passed through to `inventoryService.exportRows(req.query)` — the service layer may or may not currently honor filter params. The implementing model verifies; if it doesn't, it threads the same filter projection used by `inventoryService.getAllIngredients(req.query)` (already filter-aware per `exports.getAll`).
- Same route + query-param mode preserves FR-023 (no new routes).

**Alternatives considered**:
- **Always full export** (Option A in Q5) — overridden by the user on 2026-05-03; the filtered mode was pulled into scope.
- **Two routes** (Option D as initially understood) — would violate FR-023; reinterpreted as a query-param mode.
- **Stream/chunk for >1000 rows** — over-engineered for restaurant-scale data; not adopted.

**Operational notes**:
- The existing `infrastructure/csv/rfc4180.toCsv(headers, dataRows)` helper already handles RFC 4180 escaping (FR-019), so no new escape logic is needed.
- The empty-inventory case (FR-021) is naturally handled by `toCsv(headers, [])` returning a single header line.
- An empty filtered result (no rows match) returns the same single header line — no special-casing needed.

---

## Cross-cutting decisions

- **No backend schema migrations**, **no new server routes**, **no new server dependencies**. The single server file changed is `inventory.controller.js`; everything else is frontend.
- **Test strategy**: manual verification per `quickstart.md` (consistent with feature 003 plan). Automated frontend tests remain a P5 line item.
- **Constitutional gates** all pass at Phase 0 and re-pass at Phase 1.

## Open items (none blocking)

- Verify whether `inventoryService.exportRows()` currently honors filter query params — confirmable in `Server/src/application/services/inventory.service.js`. If yes, the `?filtered=true` mode is a 2-line change in the controller. If no, the service grows a thin `getFilteredForExport(query)` method that mirrors `getAllIngredients(query)` minus pagination.
- Confirm the existing `Inventory.jsx` page surfaces a search/filter UI in feature 003. If it does, the **Export Filtered** affordance plugs into the same query-state hooks. If filtering hasn't shipped yet on the page, the second button is no-op until that work lands and can be hidden behind a feature check — but per the spec, the button "MUST be rendered only when a filter or search term is active", which itself is the feature check.
