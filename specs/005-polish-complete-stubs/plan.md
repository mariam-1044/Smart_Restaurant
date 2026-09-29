# Implementation Plan: Polish & Complete All Stubs

**Branch**: `005-polish-complete-stubs` | **Date**: 2026-05-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-polish-complete-stubs/spec.md`

## Summary

Replace four user-facing stubs with working implementations on the existing React 19 + Vite 7 + Express + MongoDB stack: (1) the `alert("Exporting report as PDF…")` stub on the Report page becomes a real `jspdf + html2canvas` rasterized export at `scale: 2`; (2) the inert Dark Mode toggle in Settings becomes a real CSS-variables–driven theme flip via `data-theme="dark"` on `<html>`, persisted in `localStorage`, applied before React mounts to avoid a flash of unthemed content; (3) the Settings profile and password forms get their toast/AuthContext propagation wired (using a new tiny in-app `Toast` + `ToastContext` component since FR-025 forbids new client deps), the editable field set is locked to `name/phone/avatar`, and the `window.prompt()` password flow becomes a proper three-field in-page form; (4) the Inventory CSV export is corrected (drop the `category` column that the model doesn't support, fix filename format, ignore pagination but honor an optional `?filtered=true` query mode) without introducing a new route. The work is purely additive at the frontend, modifies one existing controller, and introduces zero new server routes, dependencies, or schema changes.

## Technical Context

**Language/Version**: JavaScript (ES2022), React 19.1, Node 18+ tooling
**Primary Dependencies**:
- Existing client: React 19, React Router 7, TailwindCSS 4, Recharts 3, Axios 1, react-icons 5
- Existing server: Express, Mongoose, bcryptjs, jsonwebtoken, winston (logger), `infrastructure/csv/rfc4180` helper
- **New client (only)**: `jspdf` (~50 KB gz), `html2canvas` (~45 KB gz)
- **New server**: none

**Storage**: REST API to existing Express + MongoDB; client-side state via React hooks; auth token in `localStorage`; theme preference in `localStorage` under key `theme`
**Testing**: Manual verification per `quickstart.md`. Automated frontend tests remain P5 (consistent with feature 003 plan)
**Target Platform**: Modern desktop and tablet browsers (Chrome, Edge, Firefox, Safari current)
**Project Type**: Web application (existing `Client/` + `Server/` monorepo)
**Performance Goals**: PDF export ≤ 5 s on typical broadband (SC-002); profile-update navbar refresh ≤ 1 s without reload (SC-006); dark-mode flip within one frame (SC-004); no light-mode flash on dark-mode reload (SC-005)
**Constraints**:
- FR-022: no DB schema changes
- FR-023: no new API routes
- FR-024: no regression in Sidebar, NavBar, Login, Order, AI, Notification, or feature-003 admin pages
- FR-025: only `jspdf` and `html2canvas` may be added as client deps; no new server deps; no font, theme, or icon packages
- FR-026: toasts implemented as a small in-app `Toast` + `ToastContext`; no third-party toast library
- The single existing server change is the `inventory.controller.js` `exportCsv` handler (drop `category`, fix filename, accept `?filtered=true`)

**Scale/Scope**: 4 user stories; ~3 new client components (`Toast`, `ToastContext`, dark-mode bootstrap script); ~4 modified client files (`Report.jsx`, `Setting.jsx`, `App.jsx`, `index.html` or `main.jsx`); 1 modified server file (`inventory.controller.js`); 1 modified style file (`Client/src/styles/variables.css`); graduation-scale demo (single restaurant, < 500 ingredients, < 50 users)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project's `.specify/memory/constitution.md` is the unfilled template — no concrete principles are defined. With no enforceable principles in place, this gate uses the same minimal default gates established in feature 003's plan:

- **No new infrastructure unless required**: Pass — no new services, no new databases, no new external dependencies beyond the two client-side libs explicitly authorized by FR-025.
- **No bypass of existing security**: Pass — all touched endpoints retain their existing auth middleware; password change still requires the current password; the `axios` 401 redirect interceptor is left intact.
- **No fabricated data on dependency failure**: Pass — PDF capture failures surface as toast errors (FR-006), not silent successes; CSV export errors surface a 5xx, not an empty file masquerading as success.
- **Reuse over reinvent**: Pass — DashboardLayout, AuthContext, Navbar, axios instance, and the existing `infrastructure/csv/rfc4180` helper are reused; the only new shared component is the small `Toast` family which is itself a one-time investment used across three of the four user stories.

Re-check after Phase 1 design: same gates re-evaluated against `data-model.md`, `contracts/`, and `quickstart.md` — all gates remain Pass; no Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/005-polish-complete-stubs/
├── plan.md              # This file
├── research.md          # Phase 0 output — design decisions per stub
├── data-model.md        # Phase 1 output — entity & payload shapes
├── quickstart.md        # Phase 1 output — manual verification steps per US
├── contracts/           # Phase 1 output — endpoint contracts touched
│   ├── update-profile.md
│   ├── update-password.md
│   └── inventory-export.md
└── tasks.md             # Phase 2 output (NOT created here; produced by /speckit.tasks)
```

### Source Code (repository root)

```text
Client/                                                # Existing frontend (React 19 + Vite 7)
├── index.html                                         # MODIFIED — inline <script> reads localStorage.theme,
│                                                     #   sets document.documentElement.dataset.theme before
│                                                     #   React mounts (FR-008, SC-005)
├── package.json                                       # MODIFIED — add jspdf, html2canvas only (FR-025)
├── src/
│   ├── components/
│   │   ├── toast/                                     # NEW — single-purpose toast subtree
│   │   │   ├── Toast.jsx                              # NEW — visual component (success/error variants)
│   │   │   ├── ToastContext.jsx                       # NEW — provider + useToast() hook (FR-026)
│   │   │   └── ToastContainer.jsx                     # NEW — top-right stacked container, mounted at App root
│   │   ├── Navbar.jsx                                 # UNCHANGED at the surface — already reads useAuth().user;
│   │   │                                              #   benefits implicitly from FR-014 AuthContext propagation
│   │   └── ...
│   ├── context/
│   │   ├── AuthContext.jsx                            # UNCHANGED — already exposes setUser used by FR-014
│   │   └── ThemeContext.jsx                           # NEW (small) — exposes theme + toggleTheme (FR-009)
│   ├── pages/
│   │   ├── Report.jsx                                 # MODIFIED — replace alert() with jspdf+html2canvas
│   │   │                                              #   handler; wrap printable region in
│   │   │                                              #   <div id="report-content"> (FR-001, FR-002, FR-005)
│   │   ├── Setting.jsx                                # MODIFIED — drop address field, add avatar field;
│   │   │                                              #   replace prompt() password flow with embedded
│   │   │                                              #   3-field form; replace inline banners with
│   │   │                                              #   useToast(); wire darkMode state to ThemeContext
│   │   │                                              #   (FR-013, FR-015, FR-016, FR-017)
│   │   └── ...
│   ├── styles/
│   │   ├── variables.css                              # MODIFIED — add [data-theme="dark"] { … } block
│   │   │                                              #   with surface/text/border tokens (FR-010, FR-011)
│   │   └── ...
│   ├── App.jsx                                        # MODIFIED — wrap tree in <ThemeProvider> +
│   │                                                  #   <ToastProvider>; mount <ToastContainer />
│   │                                                  #   at root
│   └── main.jsx                                       # UNCHANGED
└── ...

Server/                                                # Existing backend (Express + MongoDB)
├── src/
│   ├── interfaces/
│   │   └── controllers/
│   │       └── inventory.controller.js                # MODIFIED — exportCsv handler:
│   │                                                  #   - drop 'category' from headers and rows (FR-018)
│   │                                                  #   - filename: inventory-YYYY-MM-DD.csv with dashes
│   │                                                  #     (FR-020 — current code emits YYYYMMDD)
│   │                                                  #   - branch on req.query.filtered === 'true' to choose
│   │                                                  #     full vs filtered service call (FR-027)
│   ├── application/
│   │   └── services/
│   │       └── inventory.service.js                   # POSSIBLY MODIFIED — verify exportRows() honors
│   │                                                  #   the listing query params (search/filter); if not,
│   │                                                  #   add a thin filtered branch. No new public method.
│   ├── routes/
│   │   └── inventory.routes.js                        # UNCHANGED — same /export route, just new query param
│   └── domain/models/                                 # UNCHANGED — no schema changes (FR-022)
└── package.json                                       # UNCHANGED — no new server deps (FR-025)
```

**Structure Decision**: Web-application monorepo (existing `Client/` + `Server/`). The plan reuses the structure established by features 002–004; nothing new at the directory level. The single new subtree is `Client/src/components/toast/`, scoped to one feature concern.

## Complexity Tracking

> No Constitution Check violations. This section is intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none)    |            |                                     |
