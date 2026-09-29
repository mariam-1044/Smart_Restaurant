# Quickstart: Manual Verification — Polish & Complete All Stubs

**Feature**: 005-polish-complete-stubs
**Date**: 2026-05-03
**Phase**: 1 (Design & Contracts)

This document covers manual verification steps for each user story. Automated frontend tests remain P5 scope.

## Prerequisites

1. Backend running locally (`cd Server && npm start`).
2. Frontend running locally (`cd Client && npm run dev`). After this feature ships, `npm install` will pull in `jspdf` and `html2canvas`.
3. A signed-in user with `role: "admin"` (so all four pages are reachable).
4. Inventory has at least one ingredient with a comma in its `name` (seed if needed) — used for CSV escape verification.
5. Browser developer tools open (Application → Local Storage to inspect `theme`).

---

## US1 — PDF Export from Report page

1. Navigate to `/report`. Wait for charts and tables to fully render.
2. Click **Export PDF**.
   - **Expected**: Button label changes to "Generating…" and is disabled (FR-004, AS5).
   - **Expected**: A `.pdf` file named `restaurant-report-YYYY-MM-DD.pdf` (today's local date) downloads within ~5 seconds.
3. Open the downloaded PDF in a viewer.
   - **Expected**: The full report area is captured — figures, charts, styled cards (AS3).
   - **Expected**: Content extending below the initial viewport is included (AS4, FR-005).
   - **Expected**: Zooming in shows crisp text and chart axis labels (Q4 clarification — `scale: 2`).
4. While **Export PDF** is generating, click it again rapidly.
   - **Expected**: Only one file downloads. The disabled state prevents the duplicate (AS5).
5. **Failure path**: Open `/report` and immediately click **Export PDF** before data finishes loading.
   - **Expected**: The export either waits, is disabled, or surfaces an inline/toast error — it does **not** produce a half-rendered blank PDF (AS2).
6. **Failure path (induce a `html2canvas` error)**: load a remote image into the report page that doesn't allow CORS, then click Export.
   - **Expected**: A toast error appears (FR-006). The button re-enables. No silent console-only failure.

---

## US2 — Dark Mode toggle re-themes the application

1. Navigate to `/settings`.
2. Locate the **Dark Mode** toggle in the Localization card.
3. Flip the toggle on.
   - **Expected**: Within one frame, every visible surface re-themes (background, surface cards, text, borders, navbar, sidebar, dashboard cards) (AS1, SC-004).
   - **Expected**: `localStorage.theme === "dark"` (verify in DevTools).
   - **Expected**: `<html data-theme="dark">` (verify in DevTools Elements panel).
4. Navigate through every page: Dashboard, Inventory, Orders, Reports, Menu, Customers, Waste, Settings.
   - **Expected**: Every page renders in the dark palette consistently (AS3).
5. Reload the browser (full hard reload).
   - **Expected**: The dark theme is applied immediately on first paint — **no light-mode flash** (AS2, SC-005). This works because the inline `<script>` in `index.html` reads `localStorage.theme` and sets `data-theme="dark"` before React mounts.
6. Open a modal or drawer (e.g., a confirmation dialog from another page) and flip the toggle while it's open.
   - **Expected**: The modal also re-themes; no half-themed overlay (Edge Case).
7. Flip the toggle off.
   - **Expected**: Application returns to light palette; `localStorage.theme === "light"` (AS4).
8. Sign out, sign back in as a brand-new user (or clear `localStorage`).
   - **Expected**: Default is light mode; OS preference is **not** auto-detected (AS5, FR-012).
9. **Failure path (private browsing / disabled storage)**: open the app in a Chrome Incognito window, flip dark mode on, then reload.
   - **Expected**: Dark mode applies in the original session. After reload, the theme reverts to light (because `localStorage.setItem` failed silently). The toggle does **not** crash (Edge Case).
10. **Two-tab non-sync behavior**: open the app in two tabs, flip dark mode on in tab A, switch to tab B without reloading.
    - **Expected**: Tab B remains in light mode. (Cross-tab sync is explicitly P5.)

---

## US3 — Settings Profile and Password changes land end-to-end

### Profile update

1. Navigate to `/settings`. Note the navbar's user-name display (top-right).
2. In the User Profile card, change the **Full Name** value (e.g., from "Alice" to "Alicia").
3. Verify the form contains: `Full Name`, `Phone Number`, `Avatar URL` (or similar) — and **does not** contain `Email Address` (read-only display only is OK) or `Address` (Q2 clarification, 2026-05-03).
4. Click **Save**.
   - **Expected**: A green success toast appears top-right (FR-013).
   - **Expected**: The navbar's name display updates within one frame (no page reload) — verify by watching the top-right (AS1, SC-006).
5. **Failure path (server validation error)**: induce a 400 by, e.g., setting an invalid avatar URL the controller rejects.
   - **Expected**: A red error toast appears with the server's message (AS2). The navbar does **not** update.
6. **Failure path (network 401 — token expired)**: in DevTools, manually clear the `token` from `localStorage`, then click Save.
   - **Expected**: The existing `axios` interceptor redirects to login (no toast at the form — the redirect is the user feedback).

### Password change

1. In the Security card, the form contains three fields: `Current Password`, `New Password`, `Confirm New Password`. (No `window.prompt()` dialogs — Q3 clarification.)
2. Enter the correct current password, a valid new password (e.g., `Test1234`), and the same new password in confirm. Click **Submit / Change Password**.
   - **Expected**: A green success toast appears.
   - **Expected**: All three password fields clear (FR-015).
   - **Expected**: Navigate to Dashboard — the next API call succeeds with the existing token (no forced re-login) (AS3, SC-007).
3. **Mismatch path**: enter different values in `New Password` and `Confirm New Password`. Click Submit.
   - **Expected**: Submission is rejected client-side; no API call is made (verify in Network tab); a toast indicates the mismatch.
4. **Wrong current password**: enter an incorrect current password; valid + matching new and confirm. Click Submit.
   - **Expected**: Red error toast: "Current password is incorrect".
   - **Expected**: Only the `Current Password` field clears; **`New Password` and `Confirm New Password` are preserved** so the user does not retype them (AS4, FR-016).
5. **Policy violation**: enter a too-short or letters-only new password. Click Submit.
   - **Expected**: Red error toast lists the specific policy violations (e.g., "Password must contain at least one digit"; "Password must be at least 8 characters") (AS5, FR-017).
   - **Expected**: All three fields are preserved.

---

## US4 — Inventory CSV Export

### Full export

1. Navigate to `/inventory`. Confirm the page lists ingredients.
2. Click **Export** (the always-visible button).
   - **Expected**: A file named `inventory-YYYY-MM-DD.csv` (with hyphens — FR-020) downloads.
3. Open the file in Excel, LibreOffice Calc, or Numbers.
   - **Expected**: No escape-character warnings (SC-009).
   - **Expected**: Header row reads exactly `name,quantity,unit,minStock,costPerUnit,expiryDate,wasteQuantity` — 7 columns, **no `category` column** (AS2, FR-018).
   - **Expected**: One row per ingredient. The data matches what the page shows.
4. Verify a row whose `name` contains a comma (e.g., "Salt, fine"): the field is double-quoted in the raw CSV; the spreadsheet shows the comma intact and does not split the row (AS3, FR-019).

### Filtered export (Q5 clarification, 2026-05-03)

1. On `/inventory`, type a search term that matches a subset of ingredients (e.g., `oil`).
2. Verify a second button **Export Filtered** is now rendered (FR-027).
3. Click **Export Filtered**.
   - **Expected**: A `.csv` file downloads whose data rows include only ingredients matching the search term — not the full inventory.
   - **Expected**: Same header row as the full export.
4. Clear the search term.
   - **Expected**: The **Export Filtered** button disappears; only **Export** remains.

### Empty-set cases

1. **Empty inventory** (clear or seed with zero ingredients): click **Export**.
   - **Expected**: The download contains only the header row — no error, no empty file (AS4, FR-021).
2. **Empty filter result** (search for a term matching no ingredient): click **Export Filtered**.
   - **Expected**: Same — header row only.

---

## Cross-cutting verification

1. **No regressions in Sidebar, NavBar, Login, Order, AI, Notification, or feature-003 admin pages** (FR-024). Quick walkthrough each page; nothing should look or behave differently except for picking up the dark-mode tokens.
2. **No new server route**: `git diff master -- Server/src/routes` should show zero net additions for this feature (SC-010).
3. **No new server dependency**: `git diff master -- Server/package.json` shows zero `dependencies` additions (SC-010).
4. **No schema change**: `git diff master -- Server/src/domain/models` shows zero changes (SC-010, FR-022).
5. **Only the authorized client deps were added**: `git diff master -- Client/package.json` shows `jspdf` and `html2canvas` added — and **nothing else** (FR-025). No toast library, no theme library, no font/icon package.
6. **No `alert(...)` remains as a sole effect** of any user-facing button on Report, Inventory, or Settings (SC-001). `grep -r 'alert(' Client/src/pages/Report.jsx Client/src/pages/Inventory.jsx Client/src/pages/Setting.jsx` should return nothing.

## Sign-off checklist

- [ ] PDF export downloads a real, sharp file under 5 s
- [ ] Dark mode re-themes everything, no FOUC on reload
- [ ] Profile name change reflects in navbar within one frame, no reload
- [ ] Password change works, three-field form, correct field-clearing semantics
- [ ] CSV export has 7 columns, no `category`, hyphens in filename
- [ ] **Export Filtered** appears only when filtering is active
- [ ] No regressions in unrelated pages
- [ ] No unauthorized new dependencies
- [ ] No new server route, no schema change
- [ ] No `alert(...)` remains as a stub on any touched page
