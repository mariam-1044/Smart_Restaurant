# Feature Specification: Polish & Complete All Stubs

**Feature Branch**: `005-polish-complete-stubs`
**Created**: 2026-04-30
**Status**: Draft
**Input**: User description: "P4 — Polish & Complete All Stubs (read from smart_restaurant_speckit_plan.md)"

## Summary

Four user-facing affordances in the application currently look real but do nothing useful: the **Export PDF** button on the report page pops an `alert("Exporting report as PDF…")`; the **Dark Mode** toggle in Settings flips a checkbox but no styles change; the **Profile / Password** form in Settings posts to endpoints that landed in feature 002 but the success/error toast and the post-save propagation to `AuthContext` are not wired so the navbar continues to show the old name; and the **Export CSV** button on the inventory page already calls a real endpoint but its column set hasn't been validated against the master plan and one of the planned columns (`category`) does not exist on the `Ingredient` model. This feature replaces every such stub with a working, demonstrable implementation, verifies the one piece that already works, and is purely additive — no API changes, no DB schema changes, no new infrastructure.

## Clarifications

### Session 2026-04-30

- Q: Should the PDF be a true text PDF (selectable text, small file) or an image-of-the-report PDF (rasterized via html2canvas, larger file)? → A: Image-of-the-report. The master plan prescribes `jspdf + html2canvas`, the report contains charts and styled cards that don't translate cleanly to a text-only PDF, and the simpler client-side rasterization keeps the implementation a single file change. Searchable-text PDF is a P5 enhancement.
- Q: Should Dark Mode auto-follow the OS / `prefers-color-scheme` setting, or strictly obey the in-app toggle? → A: Strictly obey the in-app toggle, persisted in `localStorage` under key `theme`. On first load, default to `light`. OS auto-detection is out of scope.
- Q: After a successful profile update, how does the navbar reflect the new name without a full page reload? → A: The Settings form merges the response payload into `AuthContext` directly; no second round trip to `/auth/me`. (The PATCH endpoint already returns the updated user.)
- Q: After a successful password change, should the user be forced to re-log-in? → A: No. The existing endpoint changes the password and increments `tokenVersion` (per feature 002); the existing token remains valid for the rest of the session. The form shows a success toast and clears the password fields. Forced re-login is a P5 hardening.
- Q: The master plan lists `category` as a CSV column, but the `Ingredient` model has no `category` field. What should the export do? → A: Drop `category` from the export column set for this iteration and document the omission in the assumptions section. Adding a `category` field to `Ingredient` is out of scope; doing it here would silently change the CSV shape every consumer downstream depends on.
- Q: Where is the dark-mode CSS source of truth — Tailwind's `dark:` modifier or a CSS-variables override? → A: CSS variables (`Client/src/styles/variables.css`) plus a `[data-theme="dark"] { … }` block. The existing pages already consume the same variables for their primary color tokens; flipping the attribute on `<html>` re-themes everything in one move. Tailwind's `dark:` modifier would require touching every page's class list and is rejected as too invasive for a polish pass.

### Session 2026-05-03

- Q: How are "success toast" / "error toast" implemented given that `Client/package.json` has no toast library and FR-025 forbids new client dependencies beyond `jspdf` and `html2canvas`? → A: Build a small custom `Toast` component plus a `ToastContext` provider mounted at the application root (top-right, auto-dismiss ~4s, stackable, ~50 LOC). Zero new dependencies, satisfies FR-025, and is reusable across PDF errors (FR-006), profile updates (FR-013), and password changes (FR-015–FR-017). The existing inline `setError`/`setSuccess` banners in `Setting.jsx` are removed in favor of `useToast()` calls.
- Q: Which fields are editable on the Settings profile form, given that today's form posts an `address` field the `User` model does not define and omits the `avatar` field that the model does define? → A: Editable set is **`name`, `phone`, `avatar`** (URL string). `address` is removed from the form (no schema change — FR-022). `email` is **not** editable in this iteration (uniqueness collision and re-verification flow are out of scope for a polish pass; a future feature can add a dedicated email-change flow). `password` continues to be changed through the separate password-change flow.
- Q: How is the password change collected, given that today's `Setting.jsx` uses `window.prompt()` and the spec's acceptance scenarios (preserve new-password field on wrong-current-password error, render structured policy violations) are unenforceable through `prompt()`? → A: Replace the two `prompt()` calls with an **in-page password form embedded inside the existing Security card** in `Setting.jsx`. Three fields (`currentPassword`, `newPassword`, `confirmNewPassword`), a submit button, and toast feedback via the new `useToast()` hook. No modal, no overlay, no new route. Confirm-password mismatch is validated client-side before the API call. On success, all three fields clear; on `current_password_incorrect`, only the current-password field clears.
- Q: At what `html2canvas` scale should the report be rasterized, given that default `scale: 1` produces blurry text when a reviewer zooms into the PDF? → A: **`scale: 2`** ("retina" quality). Sharp text and chart labels on zoom, file size typically 2–3 MB for a one-page report, and stays well under SC-002's 5-second budget on a typical machine. OS auto-detection of `devicePixelRatio` is rejected as inconsistent across reviewer machines.
- Q: When the Inventory page has an active search/filter or pagination, does the CSV export return the full inventory or the current filtered view? → A: **Both, on the same route via a query param.** `GET /api/inventory/export` (no params) returns the full inventory; `GET /api/inventory/export?filtered=true` plus the active search/filter query params returns the current filtered view. No new route is introduced (FR-023 preserved). The Inventory page MUST surface this as two affordances: an **Export** button for the full set and an **Export Filtered** button (rendered only when a filter or search term is active) for the current view. **This supersedes the 2026-04-30 edge-case clarification that said the export always ignores filters.**

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Exports a Real PDF From the Report Page (Priority: P1)

An administrator opens the Report page, reviews the figures, charts, and tables on screen, and clicks **Export PDF**. Today the click pops a stubbed alert that says the report is exporting; nothing else happens. After this feature ships, the click produces a downloaded `.pdf` file containing a faithful, multi-page snapshot of the report content as it appeared on screen, named `restaurant-report-YYYY-MM-DD.pdf`.

**Why this priority**: This is the most visibly broken feature in the entire application — the click responds with an `alert` dialog, which immediately breaks the illusion that the rest of the application is real. For a graduation demonstration where "professional reporting" is part of the value pitch, a working export is non-negotiable.

**Independent Test**: An admin opens `/report`, lets the data load, clicks **Export PDF**, and a real PDF file downloads to the browser. Opening the file shows the same content the page displayed, including charts.

**Acceptance Scenarios**:

1. **Given** the Report page has rendered with data, **When** the admin clicks **Export PDF**, **Then** a `.pdf` file downloads whose name follows `restaurant-report-YYYY-MM-DD.pdf` and whose contents visibly match the report area.
2. **Given** the Report page is still loading data, **When** the admin clicks **Export PDF**, **Then** the export does not produce a half-rendered PDF; it either waits, disables, or surfaces an inline error rather than exporting blank cards.
3. **Given** the report contains charts and styled cards, **When** the admin opens the downloaded PDF, **Then** the charts are visible (rasterized) and the layout reflects the on-screen layout — not a blank page or a single-line text dump.
4. **Given** the report content is taller than one A4 page, **When** the export runs, **Then** the resulting PDF is sized so the full content is captured (taller PDF page or multi-page output — implementation detail), with no content cut off mid-row.
5. **Given** an admin is on a slow machine and the export operation takes more than 1 second, **When** the export is running, **Then** the **Export PDF** button shows a "Generating…" state and is disabled, preventing duplicate clicks that would each produce a separate file.

---

### User Story 2 - Dark Mode Toggle Actually Re-themes the Application (Priority: P2)

A staff member or administrator opens **Settings** and flips the **Dark Mode** switch. Today the toggle changes its own visual state but no other styling changes — the rest of the application stays light. After this feature ships, flipping the toggle immediately re-themes every page (background, surface, text, borders, navbar, sidebar, dashboard cards) to a dark palette, the preference is remembered across reloads, and flipping it back returns to the original light palette.

**Why this priority**: A toggle that visibly does nothing is a credibility hit at a demonstration. Dark mode also affects every page in the application, so the fix is high-leverage.

**Independent Test**: A user signs in, opens **Settings**, flips **Dark Mode** on, and watches every visible surface re-theme without a reload. They navigate to Dashboard, Inventory, Orders, and Reports and confirm each is themed. They reload the browser; the dark palette persists. They flip the toggle off; everything returns to light.

**Acceptance Scenarios**:

1. **Given** the user is on **Settings** and the application is currently in light mode, **When** they flip the **Dark Mode** toggle on, **Then** every visible surface re-themes within one frame (no page reload, no flash of unstyled content).
2. **Given** the user has enabled dark mode, **When** they reload the browser, **Then** the dark theme is applied immediately on first paint (no light-flash before re-theming).
3. **Given** the user has enabled dark mode, **When** they navigate between Dashboard / Inventory / Orders / Reports / Menu / Customers, **Then** every page renders in the dark palette consistently — there is no page that "missed" the theme.
4. **Given** the user is in dark mode, **When** they flip the toggle off, **Then** the application returns to the original light palette and `localStorage.theme` is set to `light`.
5. **Given** a brand-new user signing in for the first time, **When** the application loads, **Then** the default theme is light (no OS auto-detection).

---

### User Story 3 - Settings Profile and Password Changes Land End-to-End (Priority: P2)

A signed-in user opens **Settings**, edits any of `name`, `phone`, or `avatar` (URL string), clicks **Save**, and sees a success toast. The new name (and avatar, if changed) appears immediately in the navbar and any other surface that reads from `AuthContext`. Separately, the user can change their password — entering current and new passwords, clicking **Save**, and seeing a success toast — with the existing session continuing to work. `email` and `address` are **not** editable in this iteration.

**Why this priority**: The endpoints already exist (added in feature 002), the form already submits to them, but the success/error toast plumbing and the `AuthContext` propagation are incomplete. This means a successful profile update returns a 200 but the navbar still shows the old name until a full reload — a confusing user experience that damages trust in every other CRUD-style flow.

**Independent Test**: A user signs in, opens **Settings**, changes their name from "Alice" to "Alicia", clicks **Save**, sees a green success toast, and sees "Alicia" in the navbar within one frame without reloading. Separately, they change their password, see a green success toast, and confirm the next API call (e.g. opening the Dashboard) still succeeds with the existing token.

**Acceptance Scenarios**:

1. **Given** the user is on **Settings**, **When** they change their name and click **Save**, **Then** a success toast appears AND the navbar's user-name display updates within one frame without a page reload.
2. **Given** the user submits a profile update with an invalid email format, **When** the request fails with a 400, **Then** an error toast appears with the server's message and no navbar update happens.
3. **Given** the user is on **Settings**, **When** they fill in current password + new password and click **Change Password**, **Then** a success toast appears, the password fields are cleared, and the user can continue to use the application without re-logging in.
4. **Given** the user enters an incorrect current password, **When** they click **Change Password**, **Then** an error toast appears with a "current password is incorrect" message and the new-password field is **not** cleared (so the user can correct the current-password entry without re-typing the new one).
5. **Given** the user submits a new password that fails the password policy (too short, no digit, no letter, etc.), **When** the request fails with a 400, **Then** an error toast lists the specific policy violations.

---

### User Story 4 - Inventory CSV Export Returns the Right Columns (Priority: P3)

An administrator clicks **Export** on the Inventory page and a `.csv` file downloads. This affordance already wires the frontend to the backend `GET /api/inventory/export`. This story is a verification-and-correction pass: the column set must match the master plan's prescription minus the documented `category` omission, the file name must include a date or timestamp, and the export must respect any active search/filter state (when feasible).

**Why this priority**: The flow already works at a basic level (frontend downloads, backend serves), so the user is unblocked. Verifying and tightening the column contract is housekeeping that protects future reporting consumers without delivering visible new value to the demo.

**Independent Test**: An admin clicks **Export** on `/inventory` and the downloaded CSV opens cleanly in any spreadsheet tool. The header row reads `name,quantity,unit,minStock,costPerUnit,expiryDate,wasteQuantity`. The data rows match what the page shows.

**Acceptance Scenarios**:

1. **Given** the inventory contains at least one ingredient, **When** the admin clicks **Export**, **Then** a `.csv` file downloads, opens in Excel/LibreOffice/Numbers without warnings, and contains a header row plus one row per ingredient.
2. **Given** the export is opened in a spreadsheet tool, **When** the columns are inspected, **Then** they read exactly `name,quantity,unit,minStock,costPerUnit,expiryDate,wasteQuantity` in that order.
3. **Given** an ingredient has special characters (commas, quotes, newlines) in its `name`, **When** the export is generated, **Then** the CSV escapes those characters per RFC 4180 — no row is broken into two by an unescaped comma.
4. **Given** the inventory has zero ingredients, **When** the admin clicks **Export**, **Then** a CSV with the header row only is downloaded (not an error, not an empty file).

---

### Edge Cases

- The Report page's content area exceeds one viewport height. The PDF must capture the full content, not just what is visible. The implementation must scroll or measure the full element, not the viewport.
- The user clicks **Export PDF** twice in quick succession. The system must produce one file (or at most one in-flight job) — not two overlapping html2canvas runs that crash the page.
- The user is signed in on two browser tabs simultaneously, flips dark mode in one tab, and switches to the other. The other tab does NOT auto-update; the theme propagates only on next reload of that tab. (Cross-tab `storage` event sync is a P5 enhancement.)
- The user is on a custom-zoomed browser (>200% zoom). html2canvas may render at the wrong size. Acceptable for the graduation scope; the export still produces a file.
- The user submits a profile update where `email` is unchanged and only `name` differs. The backend's existing email-equality check must allow the call (this was already correct in feature 002 — verify).
- The dark-mode toggle is flipped while a modal or drawer is open. The modal must re-theme along with the rest of the page; no half-themed overlays.
- The CSV export is requested while a search filter is applied on the inventory page. The page exposes two affordances — **Export** (full inventory, ignores filter) and **Export Filtered** (current filtered/searched view, rendered only when a filter/search is active). The endpoint is the same `/api/inventory/export`; the filtered variant passes `?filtered=true` plus the active query params. Pagination is ignored in both modes — `Export Filtered` returns every row matching the filter, not just the current page.
- The user has the Settings page open in a tab that has been in the background for several hours. They edit their name and click **Save**. The token may have expired in the meantime. The 401 response must surface as an error toast, not a silent failure (the existing `axios` interceptor handles redirect-to-login for token errors — verify).
- A localStorage write fails (private browsing mode, full storage quota). The dark-mode toggle still applies in-memory; on reload, the theme reverts to the default. The toggle does not crash.

## Requirements *(mandatory)*

### Functional Requirements

**PDF Export (US1)**

- **FR-001**: System MUST replace `alert("Exporting report as PDF…")` in `Report.jsx` with a real PDF download produced from the rendered report content.
- **FR-002**: System MUST wrap the report's printable region in a stable DOM anchor (e.g. `<div id="report-content">`) so the export captures only the report area, not the surrounding navbar, sidebar, or header.
- **FR-003**: System MUST name the downloaded file `restaurant-report-YYYY-MM-DD.pdf` using the user's local date.
- **FR-004**: System MUST disable the **Export PDF** button and show a "Generating…" state while the export is in progress, preventing duplicate clicks from producing duplicate files.
- **FR-005**: System MUST capture the full height of the report area, not only the viewport-visible portion. The capture MUST use `html2canvas` `scale: 2` so chart labels and table figures remain sharp when the PDF is zoomed in a viewer.
- **FR-006**: System MUST never silently fail. A capture or save error MUST surface as a user-visible error message (toast or inline) rather than a console-only log.

**Dark Mode (US2)**

- **FR-007**: System MUST persist the user's theme preference in `localStorage` under the key `theme`, with values `'light'` or `'dark'`.
- **FR-008**: System MUST apply the saved theme on first paint by setting `document.documentElement.dataset.theme` before the React tree mounts (no flash-of-unthemed-content).
- **FR-009**: System MUST expose a single, application-wide `toggleTheme` action that flips the attribute on `<html>`, updates `localStorage`, and updates any reactive state that needs to re-render.
- **FR-010**: System MUST define the dark-mode color tokens in `Client/src/styles/variables.css` under a `[data-theme="dark"] { … }` selector. Light is the default and lives under `:root { … }`.
- **FR-011**: System MUST not introduce per-page Tailwind `dark:` modifiers; pages MUST consume CSS variables from `variables.css` so adding new pages later inherits the theme automatically.
- **FR-012**: System MUST default to `light` for new users / first-time loads. OS-preference auto-detection MUST NOT be implemented in this iteration.

**Settings Profile and Password Wiring (US3)**

- **FR-013**: System MUST show a success toast when `PATCH /api/auth/update-profile` returns 200, and an error toast (with the server's message) when it returns 4xx. The Settings profile form MUST submit only the editable field set — `name`, `phone`, `avatar` — and MUST NOT submit `email` or `address`. The `address` form field MUST be removed; the `avatar` form field MUST be added.
- **FR-014**: System MUST merge the updated user payload returned by the profile-update endpoint into `AuthContext` so that all components reading `useAuth().user` (including `Navbar.jsx`'s name display) re-render with the new values without a page reload.
- **FR-015**: System MUST replace the existing `window.prompt()` calls in `Setting.jsx` with an in-page password form embedded in the Security card containing three fields (`currentPassword`, `newPassword`, `confirmNewPassword`) and a submit button. On a 200 response from `PATCH /api/auth/update-password`, the system MUST show a success toast, clear all three password fields, and leave the existing session active. The user MUST NOT be forced to re-log-in in this iteration. Client-side validation MUST reject submission when `newPassword !== confirmNewPassword` without making the API call.
- **FR-016**: System MUST show an error toast with the server's message when the password change fails. When the failure is `current_password_incorrect`, only the **current password** field is cleared; the **new password** and **confirm new password** fields MUST be preserved so the user can correct the current-password entry without re-typing the new one.
- **FR-017**: System MUST display backend password-policy violations (`min_length`, `missing_letter`, `missing_digit`, `same_as_current`) in human-readable form in the error toast.

**Inventory CSV Export Verification (US4)**

- **FR-018**: System MUST verify that `GET /api/inventory/export` returns a CSV whose header row reads exactly `name,quantity,unit,minStock,costPerUnit,expiryDate,wasteQuantity`. If it does not, the controller MUST be corrected to produce that header. The same header MUST be returned in both the full and filtered modes (see FR-027).
- **FR-019**: System MUST escape values containing commas, quotes, or newlines per RFC 4180 (double-quote the field, double-double-quote internal quotes). The implementing model MAY use the existing CSV helper in the project if one exists.
- **FR-020**: System MUST set the `Content-Disposition` header to `attachment; filename="inventory-YYYY-MM-DD.csv"` so the download appears with a date-stamped name regardless of how the client triggers it.
- **FR-021**: System MUST return only a header row (no error, no empty body) when the inventory is empty. The same applies to the filtered mode when no rows match the active filter.
- **FR-027**: System MUST extend `GET /api/inventory/export` to accept `?filtered=true` plus the same search/filter query params the Inventory listing endpoint accepts. When `filtered=true`, the response body MUST contain only rows matching those filters; when absent or `false`, the response MUST contain the full inventory. No new route is introduced. The Inventory page MUST render an **Export** button (always) and an **Export Filtered** button (only when a filter/search term is active). Pagination MUST be ignored in both modes — the export returns every matching row, not the current page.

**Cross-Cutting**

- **FR-022**: System MUST NOT introduce backend schema changes. No new fields on `Ingredient`, `User`, `Dish`, `Order`, `Customer`, or any other model. The `category` column documented in the master plan is dropped from this iteration's CSV (see Assumptions).
- **FR-023**: System MUST NOT introduce new API routes. Every endpoint touched by this feature already exists.
- **FR-024**: System MUST NOT regress any existing feature. After this work ships, the existing Sidebar, NavBar, Login flow, Order flow, AI flow, Notification bell (feature 004), and admin pages (feature 003) all continue to function with no behavioral change other than the theme variables now responding to `data-theme="dark"`.
- **FR-025**: System MUST install only `jspdf` and `html2canvas` as new client dependencies. No new server dependencies. No font, theme, or icon packages.
- **FR-026**: System MUST implement toasts as a small in-app component (`Toast` + `ToastContext`) rendered at the application root, auto-dismissing after approximately 4 seconds, supporting stacked notifications, and exposing a `useToast()` hook. No third-party toast library MAY be added. Existing inline banner state (`setError`/`setSuccess`) in `Settings.jsx` MUST be replaced by `useToast()` calls. Variants required: `success`, `error` (info/warning are out of scope for this iteration).

### Key Entities *(include if feature involves data)*

- **Theme Preference**: A single string in `localStorage` under key `theme`, value `'light'` or `'dark'`. Read on application boot, written on every toggle. Not stored server-side; not synchronized across devices in this iteration.
- **Report PDF (transient)**: A client-side artifact. Generated on demand from the rendered DOM of the report area; never persisted server-side; not retrievable later.
- **Inventory CSV (transient)**: A server-rendered artifact derived from the `Ingredient` collection at the time of the request. Not persisted; not cached.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0% of polished features still surface a stub. After this feature ships, no `alert(...)` call remains as the sole effect of any user-facing button on the Report, Inventory, or Settings page.
- **SC-002**: An admin clicking **Export PDF** receives a downloaded file in under 5 seconds on a typical broadband connection in 95% of cases.
- **SC-003**: The downloaded PDF visibly contains the report's headline numbers and at least one chart when opened in a standard PDF viewer.
- **SC-004**: A user toggling dark mode sees every page (Dashboard, Inventory, Orders, Reports, Menu, Customers, Waste, Settings, Login) re-themed within one frame, verified by manual walkthrough.
- **SC-005**: A user reloading the browser with `localStorage.theme === 'dark'` sees no light-mode flash on first paint.
- **SC-006**: A user updating their name on the Settings page sees the navbar's name display update within one second, without a page reload, verified by changing the name and watching the top-right of the screen.
- **SC-007**: A user changing their password successfully sees a green toast and continues to make authenticated API calls without reauthenticating, verified by navigating to the dashboard immediately after the change.
- **SC-008**: 100% of profile / password failure modes (invalid email, wrong current password, weak new password, network 401, 500) surface as a visible toast — not a console-only error — verified by inducing each failure.
- **SC-009**: An exported inventory CSV opens cleanly in Excel, LibreOffice Calc, and Numbers without escape-character warnings, verified by hand on a row containing a comma in the ingredient name.
- **SC-010**: No new server route, no schema change, and no new server dependency exists in the diff. `git diff main -- Server/package.json Server/src/routes Server/src/domain/models` shows zero net additions for this feature, verified by inspection.

## Assumptions

- The PDF export is a rasterized snapshot of the rendered report DOM. Searchable-text PDFs, embedded fonts, and ATS-friendly text extraction are out of scope. A future feature can introduce a `@react-pdf/renderer` or server-side `puppeteer` pipeline if a richer PDF is needed.
- Dark mode follows a single CSS-variables source of truth in `Client/src/styles/variables.css`. Pages already consume the same tokens for primary surfaces; pages that hard-coded color values (if any) will need a one-line cleanup as the implementing model encounters them — that cleanup is part of this feature.
- The Settings password change endpoint already increments `tokenVersion` server-side per feature 002, so the existing token continues to verify until logout. Forcing a global re-login on password change is a P5 hardening.
- The `category` column documented in the master plan for the CSV export is dropped from this iteration because the `Ingredient` model has no `category` field. Adding a `category` field would silently change every downstream consumer's expected shape and is out of scope for a polish pass; a future feature can add the field and the column together.
- The CSV export honors in-page search/filter state via the `?filtered=true` query param mode (see FR-027), in addition to the default full-inventory mode. Both modes share the same route and header row. (Originally deferred to P5 in the 2026-04-30 session; pulled into scope in the 2026-05-03 session.)
- Dark-mode color choices (exact palette) are a presentation detail, not a contractual one — the implementing model picks reasonable values consistent with the existing brand color (the blue used on primary buttons stays as the accent in dark mode; backgrounds become `#0f172a` / `#1e293b` family; text becomes a near-white).
- The existing `axios` response interceptor handles 401 redirect-to-login for expired tokens; this feature does not re-implement that. It only ensures profile/password failures other than 401 surface as toasts.
- `jspdf` and `html2canvas` are the only new dependencies. They are already named in the master plan and are the standard pair for client-side PDF rasterization.
- Internationalization, currency localization, and right-to-left layouts remain out of scope, consistent with features 003 and 004.
- Accessibility (high-contrast mode, screen-reader announcements for theme changes) is out of scope for this iteration; the `prefers-reduced-motion` and `prefers-contrast` media queries are P5.
