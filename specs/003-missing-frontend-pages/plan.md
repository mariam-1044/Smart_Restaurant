# Implementation Plan: Missing Frontend Pages

**Branch**: `003-missing-frontend-pages` | **Date**: 2026-04-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-missing-frontend-pages/spec.md`

## Summary

Build six new top-level admin/staff pages on the existing React 19 + Vite 7 + TailwindCSS 4 + Recharts 3 frontend, wired to the existing Express + MongoDB backend (with a small set of additive endpoints). The pages — Menu Management, User & Staff Management, AI Demand Forecast, AI Dynamic Pricing, Customer Management, and Waste Management — surface capabilities the backend already supports (or will after P1 backend bug fixes) but that have no user interface today. All pages reuse the existing `DashboardLayout`, `ProtectedRoute`, `AuthContext`, and `axios` instance; each pulls data from REST endpoints under `/api/*` and degrades cleanly when AI services are unavailable. The technical approach is "compose, don't reinvent" — this feature adds pages and a handful of new shared components, not new infrastructure.

## Technical Context

**Language/Version**: JavaScript (ES2022), React 19.1, Node 18+ tooling
**Primary Dependencies**: React 19, React Router 7, TailwindCSS 4, Recharts 3, Axios 1, react-icons 5
**Storage**: REST API to existing Express + MongoDB backend; client-side state via React hooks; auth token in `localStorage`
**Testing**: Manual verification per quickstart for this feature (automated frontend tests are P5 scope per `smart_restaurant_speckit_plan.md`)
**Target Platform**: Modern desktop and tablet browsers (Chrome, Edge, Firefox, Safari current); no mobile-phone-first layouts (out of scope per spec assumptions)
**Project Type**: Web application (existing `Client/` frontend + `Server/` backend monorepo)
**Performance Goals**: Each page reaches a usable state (visible content, empty/loading/error state) in <3 seconds on a typical broadband connection in 95% of loads (SC-002)
**Constraints**: Must reuse existing visual design system (Tailwind tokens, layout CSS in `Client/src/styles/`); must enforce RBAC at route level via `ProtectedRoute`; must never display fabricated values when AI dependencies fail (FR-032); must detect concurrent-edit conflicts and reject the second save (FR-035)
**Scale/Scope**: 6 new pages + ~12 new shared components + ~3 to 5 new/extended backend endpoints; graduation-scale demo (single restaurant, < 100 dishes, < 10 admins/staff, < 10k customers)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project's `.specify/memory/constitution.md` is the unfilled template — no concrete principles are defined. With no enforceable principles in place, this gate uses these minimal default gates:

- **No new infrastructure unless required**: Pass — this feature adds no new services, no new databases, no new external dependencies. It composes against the existing stack.
- **No bypass of existing security**: Pass — every restricted page is wrapped in `ProtectedRoute` and (where role-restricted) checks `useAuth().user.role` before rendering or calling restricted endpoints; backend endpoints retain their existing `restrictTo`/`requireRole` middleware.
- **No fabricated data on dependency failure**: Pass — explicitly captured as FR-010, FR-025, FR-032 and re-asserted in Phase 1 contracts.
- **Reuse over reinvent**: Pass — DashboardLayout, AuthContext, axios instance, role-aware Sidebar, and existing CSS tokens are reused unchanged.

Re-check after Phase 1 design: same gates re-evaluated against `data-model.md`, `contracts/`, and `quickstart.md` — all gates remain Pass; no Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/003-missing-frontend-pages/
├── plan.md              # This file
├── research.md          # Phase 0 output — design decisions for shared concerns
├── data-model.md        # Phase 1 output — entity shapes consumed by these pages
├── quickstart.md        # Phase 1 output — manual verification steps per page
├── contracts/           # Phase 1 output — UI ↔ backend contract per page
│   ├── menu-management.md
│   ├── user-management.md
│   ├── demand-forecast.md
│   ├── dynamic-pricing.md
│   ├── customer-management.md
│   └── waste-management.md
├── checklists/
│   └── requirements.md  # Existing — populated by /speckit.specify
└── tasks.md             # Phase 2 output (NOT created here; produced by /speckit.tasks)
```

### Source Code (repository root)

```text
Client/                                                # Existing frontend (React 19 + Vite 7)
├── src/
│   ├── pages/
│   │   ├── admin/                                     # NEW — admin-scoped pages
│   │   │   ├── MenuManagement.jsx                     # NEW (Page 1)
│   │   │   └── UserManagement.jsx                     # NEW (Page 2)
│   │   ├── ai/                                        # NEW — AI workspace pages
│   │   │   ├── DemandForecast.jsx                     # NEW (Page 3)
│   │   │   └── DynamicPricing.jsx                     # NEW (Page 4)
│   │   ├── CustomerManagement.jsx                     # NEW (Page 5)
│   │   ├── WasteManagement.jsx                        # NEW (Page 6)
│   │   ├── Dashboard.jsx                              # Existing — style reference
│   │   ├── Inventory.jsx                              # Existing — style reference
│   │   ├── OrderingSystem.jsx                         # Existing — buried admin logic to remove (post-P2)
│   │   └── ...                                        # Other existing pages unchanged
│   ├── components/
│   │   ├── shared/                                    # NEW — cross-page primitives
│   │   │   ├── ConfirmationModal.jsx                  # NEW — used by pricing apply, delete, status change
│   │   │   ├── DetailDrawer.jsx                       # NEW — slide-in panel (Customer detail)
│   │   │   ├── FilterPills.jsx                        # NEW — pill filter bar (categories, statuses)
│   │   │   ├── EmptyState.jsx                         # NEW — shared empty-state visual
│   │   │   ├── ErrorState.jsx                         # NEW — shared error-state visual
│   │   │   └── LoadingState.jsx                       # NEW — shared loading-state visual
│   │   ├── menu/
│   │   │   ├── DishFormModal.jsx                      # NEW — Page 1
│   │   │   ├── PricingHistoryChart.jsx                # NEW — Page 1, Page 4
│   │   │   └── IngredientLinker.jsx                   # NEW — Page 1
│   │   ├── users/
│   │   │   ├── StatusBadge.jsx                        # NEW — Page 2
│   │   │   └── RoleDropdown.jsx                       # NEW — Page 2
│   │   ├── ai/
│   │   │   ├── ForecastChart.jsx                      # NEW — Page 3 (Recharts ComposedChart)
│   │   │   ├── DemandAlertBanner.jsx                  # NEW — Page 3
│   │   │   ├── StaffingSuggestionCard.jsx             # NEW — Page 3
│   │   │   └── PricingCard.jsx                        # NEW — Page 4
│   │   ├── customers/
│   │   │   └── CustomerTagBadges.jsx                  # NEW — Page 5
│   │   ├── waste/
│   │   │   ├── WasteSummaryCards.jsx                  # NEW — Page 6
│   │   │   ├── WasteByIngredientChart.jsx             # NEW — Page 6
│   │   │   ├── WasteTrendChart.jsx                    # NEW — Page 6
│   │   │   ├── WasteByCategoryChart.jsx               # NEW — Page 6
│   │   │   └── NearExpiryTable.jsx                    # NEW — Page 6
│   │   ├── Sidebar.jsx                                # MODIFIED — add 6 new nav links with role filters
│   │   ├── Navbar.jsx                                 # Existing — unchanged
│   │   └── Data.jsx                                   # MODIFIED — add 6 new SidebarData entries
│   ├── routes/
│   │   └── ProtectedRoute.jsx                         # MODIFIED — accept optional `roles` prop for role guard
│   ├── api/
│   │   └── axios.js                                   # Existing — unchanged
│   ├── context/
│   │   └── AuthContext.jsx                            # Existing — unchanged
│   ├── layouts/
│   │   └── DashboardLayout.jsx                        # Existing — unchanged (already used by all internal pages)
│   ├── App.jsx                                        # MODIFIED — register 6 new routes
│   └── styles/
│       └── pages-p2.css                               # NEW (only if Tailwind utilities are insufficient)

Server/                                                # Existing backend — small additive changes
└── src/
    ├── routes/
    │   ├── auth.routes.js                             # MODIFIED — add `GET /auth/users` (admin-only list)
    │   ├── customer.routes.js                         # MODIFIED — add `GET /customers` and `GET /customers/:id`
    │   ├── menu.routes.js                             # Existing — used as-is
    │   ├── inventory.routes.js                        # Existing — used as-is
    │   ├── ai.routes.js                               # Existing — used as-is (forecast, recipe)
    │   ├── pricing.routes.js                          # Existing — used as-is (suggest, apply, history)
    │   └── recommendation.routes.js                   # Existing — used as-is
    ├── interfaces/controllers/
    │   ├── auth.controller.js                         # MODIFIED — add `listUsers` handler
    │   └── customer.controller.js                     # MODIFIED — add `listAll` and `getById` handlers
    ├── application/services/
    │   ├── customer.service.js                        # MODIFIED — add list/get methods
    │   └── menu.service.js                            # Already added in P1; supports concurrent-edit version field (added here)
    └── domain/models/
        ├── Dish.js                                    # MODIFIED — add `version` field for optimistic concurrency (FR-035)
        ├── User.js                                    # MODIFIED — add `version` field
        ├── Customer.js                                # MODIFIED — add `version` field
        └── Pricing*.js                                # MODIFIED if a separate model exists for pricing recommendations
```

**Structure Decision**: This is an existing **web application** monorepo (`Client/` + `Server/`). The feature adds pages and shared components inside the existing `Client/src/` tree following the project's current conventions (page files at `Client/src/pages/<Name>.jsx`, components at `Client/src/components/<group>/<Name>.jsx`). New `pages/admin/` and `pages/ai/` subdirectories group the role-scoped pages so admin/staff routing intent is visible from the file tree alone. Backend changes are additive: three new endpoints (`GET /auth/users`, `GET /customers`, `GET /customers/:id`) and a `version` field on four models to support concurrent-edit conflict detection (FR-035). No new services, no new databases, no new external dependencies.

## Complexity Tracking

> No Constitution Check violations to justify; the constitution file is the unfilled template, and the minimal default gates above all pass. This section intentionally left empty.

## Phase 0: Research Output

See [research.md](./research.md). Resolved decisions cover: shared loading/empty/error pattern, concurrent-edit conflict detection via optimistic-version field + `If-Match`-style header, CSV export reuse pattern, Recharts component selection per chart type, drawer/modal patterns, filter-aware bulk apply pattern, customer tag derivation location (server vs client), and the "fabricated data on failure" defense.

## Phase 1: Design & Contracts

Outputs:
- [data-model.md](./data-model.md) — entity shapes the new pages consume (Dish, User, Customer, ForecastResult, PricingRecommendation, WasteAggregate, NearExpiryItem)
- [contracts/](./contracts/) — six UI ↔ backend contract documents, one per page; each lists every request the page makes, the expected response shape, and the failure modes
- [quickstart.md](./quickstart.md) — step-by-step manual verification per page

Agent context update: this plan is referenced via the SPECKIT markers in `.github/copilot-instructions.md` (note: file may not exist if the project uses a different agent context file — see step 3 of the agent script).

Re-evaluation of Constitution Check after Phase 1: gates re-checked against final contracts and data model — all four default gates still Pass.
