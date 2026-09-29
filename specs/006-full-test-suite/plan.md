# Implementation Plan: Full Test Suite (Production-Grade Coverage)

**Branch**: `006-full-test-suite` | **Date**: 2026-05-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-full-test-suite/spec.md`

## Summary

Stand up a production-grade automated test suite spanning all three layers of the existing monorepo: (1) **Backend Jest + Supertest** — extend the existing `Server/__tests__/` (~14 service files, ~13 API files, plus regression / static / security trees) to cover *every* service, controller, route, validator, and Mongoose model in `Server/src/`, gated at ≥80% lines/branches/functions/statements globally; replace the `X-Test-User` header bypass currently used by some integration tests with real-JWT-through-real-auth-middleware via a new `Server/__tests__/helpers/` toolkit; mock OpenAI and the Python ML service at every boundary; (2) **Frontend Vitest + React Testing Library** — green-field a `Client/__tests__/` suite (today: zero tests, no Vitest config, no RTL) covering every page (18 files including admin/ai sub-trees) and every cross-cutting component (`Sidebar`, `Navbar`, `NotificationBell`, `Toast` family, `ProtectedRoute`, `ThemeContext`, `AuthContext`), gated at ≥75% global / ≥80% for `pages/` and `components/`; mock `Client/src/api/axios.js` (the project's wrapper) at the wrapper path; (3) **End-to-end Playwright** — green-field a top-level `e2e/` Playwright project at the **repository root** (not under `Client/`) covering the master plan's six critical flows plus six new-page smokes from feature 003, authenticating via `storageState` written by `globalSetup`; (4) **One-command CI** — a `.github/workflows/test.yml` that runs Jest → Vitest → Playwright in sequence, caches `node_modules` and the `mongodb-memory-server` binary, uploads coverage reports as artifacts, and keeps median CI wall-clock under 10 minutes. The work introduces only test-time devDependencies; no runtime dependencies, no schema changes, no new API routes.

## Technical Context

**Language/Version**: JavaScript / Node 18+ (CommonJS for `Server/`, ES Modules for `Client/`); TypeScript only inside `e2e/` specs (Playwright's default project template). The existing `Server/jest.config.js` is CommonJS and will stay CommonJS — no ESM migration.

**Primary Dependencies**:
- **Already in `Server/devDependencies`** (reused, not re-added): `jest@29`, `@jest/globals@29`, `mongodb-memory-server@9`, `supertest@6`, `nodemon`
- **New `Server/devDependencies`** (small additions): `nock` (or `jest-fetch-mock`) for outbound-HTTP mocking of the ML-service boundary; `cross-env` for cross-platform env var injection in the `test:coverage` script (Windows-friendly)
- **New `Client/devDependencies`**: `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `@vitejs/plugin-react` (already installed — confirmed)
- **New top-level `devDependencies`** (in a newly-created repo-root `package.json`): `@playwright/test`, `@types/node` (Playwright TS types), `dotenv` (for E2E env loading)
- **Runtime dependencies (production code)**: zero net additions. FR-029 forbids it.

**Storage**:
- Backend tests: in-memory MongoDB via `mongodb-memory-server`, lifecycle managed per test file (started in `beforeAll`, stopped in `afterAll`, all collections dropped in `afterEach`).
- Frontend tests: no real storage. `localStorage` and `sessionStorage` are reset by `Client/src/test/setup.js` between tests.
- E2E tests: real MongoDB at `mongodb://localhost:27017/smart_restaurant_e2e` (separate database name from dev) seeded by `Server/scripts/seed-e2e.js`; reset between Playwright runs via the seed script's idempotency contract.
- Auth: backend tests mint real JWTs with the test `JWT_SECRET` (already injected by `Server/jest.setup.js` as `'test-jwt-secret'`); E2E specs consume `auth.json` written once by `playwright.config.ts` `globalSetup`.

**Testing**:
- **Backend**: Jest + Supertest + mongodb-memory-server. Coverage via Jest's built-in v8 coverage. Reports at `Server/coverage/lcov-report/`.
- **Frontend**: Vitest + RTL + jsdom. Coverage via `@vitest/coverage-v8`. Reports at `Client/coverage/`.
- **E2E**: Playwright Test against `chromium` headlessly (no firefox/webkit matrix). Reports at `playwright-report/` and `test-results/`.

**Target Platform**: Test execution must work on Windows 11 (the user's primary OS), macOS, and Linux (CI). All test helpers MUST use `path.join` for filesystem paths; no POSIX-only path literals.

**Project Type**: Web application — existing `Client/` + `Server/` monorepo, plus a new top-level `e2e/` project for cross-stack browser automation.

**Performance Goals**:
- SC-001: `Server/` Jest suite green in **< 120 s** on a typical laptop.
- SC-002: `Client/` Vitest suite green in **< 60 s**.
- SC-003: Playwright suite (12 specs) green in **< 5 min**.
- SC-010: Median CI wall-clock **< 10 min** end-to-end.
- Each individual Jest test file should run in **< 5 s**; Vitest test file in **< 2 s**.

**Constraints**:
- FR-001: backend tests MUST NOT require a running MongoDB process.
- FR-006/FR-007: no real network calls to OpenAI or the Python ML service in any backend test.
- FR-015: no Vitest test may rely on a live backend; the `axios` wrapper at `Client/src/api/axios.js` is mocked.
- FR-022a: Playwright auth via `storageState` from `globalSetup`, **not** UI-login-per-spec or per-spec token injection.
- FR-023: Playwright selectors MUST use accessible role/name; CSS-class-keyed and pixel-keyed selectors are forbidden.
- FR-028: zero external API keys, SMTP credentials, or ML-service ports required.
- FR-029: no new application-runtime dependencies. Test-time `devDependencies` only.
- FR-030: production code may only be refactored for testability via *non-invasive* dependency injection that preserves the existing public contract.

**Scale/Scope**:
- 4 user stories.
- ~30 functional requirements.
- **Backend**: ~15 service files, ~14 controllers, ~14 route groups, ~15+ Mongoose models — every one needs at least one test file (some already have one and just need extension).
- **Frontend**: 18 page files (`Client/src/pages/**/*.jsx`), 8+ shared components — every one needs at least one test file.
- **E2E**: 12 specs total (6 critical + 6 page smokes).
- Estimated test files at completion: ~80 backend (services + api + helpers + models + middleware + validations + audit + cron), ~30 frontend, 12 E2E.
- New shared infrastructure: `Server/__tests__/helpers/` (5 files), `Client/src/test/setup.js`, `e2e/fixtures/`, `e2e/global-setup.ts`, `playwright.config.ts`, `.github/workflows/test.yml`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is the unfilled placeholder (no concrete principles ratified). With no enforceable principles in place, this gate uses the same minimal default gates established in features 003–005:

- **No new infrastructure unless required**: Pass — no new application services, no new databases, no new external dependencies in production code. The new `mongodb-memory-server` is **already** a Server devDependency; the only newly-added libraries are test-time only (`@vitest/coverage-v8`, RTL family, Playwright, `nock`).
- **No bypass of existing security**: Pass — production auth middleware is unchanged. The existing `X-Test-User` bypass in `__tests__/helpers/test-app.js` is *replaced* by real JWT verification through the real `auth.middleware`, *raising* the security bar the tests exercise. No production endpoint loses an auth check.
- **No fabricated data on dependency failure**: Pass — every test mock asserts the *failure* path explicitly (e.g. OpenAI throws → user-facing error wrapped, no silent fallback; ML service unreachable → 5xx with clear message, no random-number fallback). The suite catches the very anti-pattern this gate forbids.
- **Reuse over reinvent**: Pass — existing `mongodb-memory-server`, `jest`, `supertest`, `@jest/globals` are reused; the existing 14 service tests and 13 API tests are *extended*, not deleted. The single new shared abstraction is the helpers toolkit (`withInMemoryMongo`, `seedUser`, `mintToken`, `authedRequest`) which exists precisely to *eliminate* the bespoke per-file lifecycle code currently duplicated.
- **Test pyramid balance**: Pass — Unit (services in isolation, ~50 files) > Integration (Supertest API + real DB, ~25 files) > E2E (browser, 12 files). Counts respect the standard 70/20/10 ratio guidance; the gate keeps E2E from ballooning.

Re-check after Phase 1 design: same gates re-evaluated against `data-model.md`, `contracts/`, and `quickstart.md` — all gates remain Pass; no Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/006-full-test-suite/
├── plan.md              # This file
├── research.md          # Phase 0 output — design decisions per layer
├── data-model.md        # Phase 1 output — test-fixture entity shapes
├── quickstart.md        # Phase 1 output — clone-to-green walkthrough per US
├── contracts/           # Phase 1 output — test-helper API contracts
│   ├── test-helpers.md             # withInMemoryMongo / seedUser / mintToken / authedRequest
│   ├── vitest-axios-mock.md        # Client/src/test/setup.js axios mock contract
│   └── playwright-globalsetup.md   # storageState contract + seed-e2e.js idempotency
└── tasks.md             # Phase 2 output (NOT created here; produced by /speckit.tasks)
```

### Source Code (repository root)

```text
SmartRestaurant_Final(1)/
├── package.json                                       # NEW (top-level) — only devDependencies for E2E:
│                                                     #   @playwright/test, @types/node, dotenv.
│                                                     #   Holds `npm run test:all` script (FR-025).
├── playwright.config.ts                               # NEW — chromium headless, baseURL=http://localhost:5173,
│                                                     #   globalSetup=./e2e/global-setup.ts,
│                                                     #   use: { storageState: 'auth.json' } (FR-020, FR-022a)
├── .github/
│   └── workflows/
│       └── test.yml                                   # NEW — CI matrix:
│                                                     #   - cache node_modules (Server, Client)
│                                                     #   - cache mongodb-memory-server binary
│                                                     #   - run Server Jest, Client Vitest, then Playwright
│                                                     #   - upload coverage + Playwright HTML report (FR-026)
├── e2e/                                               # NEW — Playwright test project (repo-root, NOT under Client/)
│   ├── global-setup.ts                                # NEW — programmatic POST /api/auth/login → write auth.json
│   ├── fixtures/
│   │   └── users.ts                                   # NEW — seed-user constants (admin / staff / customer creds)
│   ├── auth.spec.ts                                   # NEW — UI form login (the ONE spec that doesn't use storageState)
│   ├── ordering.spec.ts                               # NEW — create order → assert ingredient deduction
│   ├── ai.spec.ts                                     # NEW — recipe generation flow
│   ├── users.spec.ts                                  # NEW — admin approve pending staff
│   ├── inventory.spec.ts                              # NEW — CSV export download event
│   ├── notifications.spec.ts                          # NEW — low-stock notification appears
│   └── smoke/                                         # NEW — six page-smoke specs (one nav-and-no-error per new page)
│       ├── customers.spec.ts
│       ├── waste.spec.ts
│       ├── menu-admin.spec.ts
│       ├── users-admin.spec.ts
│       ├── forecast.spec.ts
│       └── pricing.spec.ts
│
├── Server/                                            # EXISTING backend (Express + MongoDB)
│   ├── jest.config.js                                 # MODIFIED — collectCoverageFrom expanded to cover all of
│   │                                                  #   src/application/services/, src/interfaces/controllers/,
│   │                                                  #   src/routes/, src/middlewares/, src/application/validations/,
│   │                                                  #   src/domain/models/, src/infrastructure/csv/.
│   │                                                  #   coverageThreshold.global = { lines:80, branches:80,
│   │                                                  #   functions:80, statements:80 }. (FR-002, FR-003)
│   ├── jest.setup.js                                  # UNCHANGED — already injects test env vars
│   ├── package.json                                   # MODIFIED — add nock + cross-env to devDependencies;
│   │                                                  #   add `test:coverage` script (FR-029)
│   ├── scripts/
│   │   └── seed-e2e.js                                # NEW — idempotent seed for E2E:
│   │                                                  #   admin, staff, pending-staff, customers, ingredients
│   │                                                  #   (some near-expiry, some near-minStock), dishes, orders.
│   │                                                  #   Drops + re-inserts via known _ids (FR-022)
│   └── __tests__/
│       ├── helpers/                                   # MODIFIED — extend existing helpers/test-app.js with:
│       │   ├── test-app.js                            # KEPT — but augmented to optionally mount the real auth
│       │   │                                          #   middleware path (X-Test-User remains for legacy specs)
│       │   ├── inMemoryMongo.js                       # NEW — withInMemoryMongo() lifecycle hooks
│       │   ├── seedUser.js                            # NEW — seedUser({ role, email?, password? })
│       │   ├── mintToken.js                           # NEW — mintToken(user) signs JWT with test JWT_SECRET
│       │   ├── authedRequest.js                       # NEW — authedRequest(app, user) → Supertest agent
│       │   └── mockOpenAI.js                          # NEW — jest.mock('openai') stub factory
│       ├── services/                                  # MODIFIED — extend coverage to every service file:
│       │   ├── (existing 14 files kept)
│       │   ├── notification.service.test.js           # NEW
│       │   ├── customer.service.test.js               # NEW
│       │   ├── sales.service.test.js                  # NEW
│       │   ├── etl.service.test.js                    # NEW
│       │   ├── pos.service.test.js                    # NEW
│       │   ├── inventory.service.full.test.js         # NEW — full coverage beyond getById
│       │   ├── order.service.full.test.js             # NEW — full coverage beyond integrity
│       │   └── auth.service.full.test.js              # NEW — full coverage of register/login/me/update*
│       ├── api/                                       # MODIFIED — extend coverage to every route group:
│       │   ├── (existing 13 files kept)
│       │   ├── notifications.test.js                  # NEW (CRUD, unread count, role gates)
│       │   ├── customers.test.js                      # NEW
│       │   ├── sales.test.js                          # NEW
│       │   ├── dashboard.test.js                      # NEW
│       │   ├── etl.test.js                            # NEW (extend etl.smoke)
│       │   ├── recommendation.full.test.js            # NEW
│       │   ├── endorsement.test.js                    # NEW
│       │   ├── menu.crud.test.js                      # NEW (admin-only restriction matrix)
│       │   ├── orders.full.test.js                    # NEW (CRUD + side effects + cancellation return)
│       │   └── inventory.full.test.js                 # NEW (CRUD, low-stock, expiry, export)
│       ├── models/                                    # NEW directory — domain model tests:
│       │   ├── User.test.js                           # NEW — password hash hook, role enum, email format
│       │   ├── Order.test.js                          # NEW — status enum (pending default), totals virtual
│       │   ├── Ingredient.test.js                     # NEW — minStock validator, costPerUnit nonneg
│       │   ├── Dish.test.js                           # NEW — price validator, ingredients ref shape
│       │   ├── Customer.test.js                       # NEW — orderHistory shape, favorites
│       │   └── Notification.test.js                   # NEW — createAlert factory, markRead, getUnread
│       ├── middleware/                                # NEW directory:
│       │   ├── auth.test.js                           # NEW — token verify, role guard
│       │   ├── validate.test.js                       # NEW — Joi schema rejection on bad body
│       │   └── order-existence.test.js                # KEPT — existing
│       ├── validations/                               # NEW directory:
│       │   ├── auth.validation.test.js                # NEW
│       │   ├── order.validation.test.js               # MODIFIED — extend existing pipeline test
│       │   └── menu.validation.test.js                # KEPT — existing
│       ├── cron/                                      # MODIFIED — extend existing cron tests:
│       │   └── spoilage.cron.handler.test.js          # NEW — handler function only, never spawns timer
│       ├── audit/                                     # KEPT — existing
│       ├── regression/                                # KEPT — existing
│       ├── security/                                  # KEPT — existing
│       └── static/                                    # KEPT — existing
│
└── Client/                                            # EXISTING frontend (React 19 + Vite 7)
    ├── package.json                                   # MODIFIED — add vitest, @vitest/coverage-v8, RTL family,
    │                                                  #   jsdom; add `test`, `test:coverage`, `test:ui` scripts
    ├── vitest.config.js                               # NEW — separate from vite.config.js for clarity:
    │                                                  #   environment=jsdom, globals=true,
    │                                                  #   setupFiles=./src/test/setup.js,
    │                                                  #   coverage v8 thresholds (FR-012)
    └── src/
        ├── test/
        │   ├── setup.js                               # NEW — imports @testing-library/jest-dom; registers
        │   │                                          #   vi.mock('../api/axios'); resets storage between tests
        │   ├── render.jsx                             # NEW — custom render wrapping <MemoryRouter>, <AuthProvider>,
        │   │                                          #   <ThemeProvider>, <ToastProvider> for component tests
        │   └── fixtures.js                            # NEW — mock payloads (users, orders, ingredients, etc.)
        └── __tests__/                                 # NEW — Vitest test root
            ├── pages/
            │   ├── auth/
            │   │   ├── Login.test.jsx                 # NEW
            │   │   └── Register.test.jsx              # NEW
            │   ├── admin/
            │   │   ├── MenuManagement.test.jsx        # NEW
            │   │   └── UserManagement.test.jsx        # NEW
            │   ├── ai/
            │   │   ├── DemandForecast.test.jsx        # NEW
            │   │   └── DynamicPricing.test.jsx        # NEW
            │   ├── Dashboard.test.jsx                 # NEW
            │   ├── Inventory.test.jsx                 # NEW
            │   ├── InventoryDetail.test.jsx           # NEW
            │   ├── OrderingSystem.test.jsx            # NEW
            │   ├── OrderDetail.test.jsx               # NEW
            │   ├── Sales.test.jsx                     # NEW
            │   ├── Report.test.jsx                    # NEW
            │   ├── Setting.test.jsx                   # NEW
            │   ├── Recipes.test.jsx                   # NEW
            │   ├── Recommendation.test.jsx            # NEW
            │   ├── CustomerManagement.test.jsx        # NEW
            │   └── WasteManagement.test.jsx           # NEW
            ├── components/
            │   ├── Sidebar.test.jsx                   # NEW
            │   ├── Navbar.test.jsx                    # NEW
            │   ├── notifications/
            │   │   └── NotificationBell.test.jsx      # NEW
            │   ├── toast/
            │   │   ├── Toast.test.jsx                 # NEW
            │   │   └── ToastContext.test.jsx          # NEW
            │   └── shared/
            │       └── (per-component tests as discovered)
            ├── context/
            │   ├── AuthContext.test.jsx               # NEW
            │   └── ThemeContext.test.jsx              # NEW
            └── routes/
                └── ProtectedRoute.test.jsx            # NEW — unauth → /login; staff → admin blocked; admin allowed
```

**Structure Decision**: Web-application monorepo with a third top-level project for E2E. Three test runners — one per stack layer — kept in their natural homes:
- `Server/__tests__/` (Jest, CommonJS) extends what exists.
- `Client/src/__tests__/` (Vitest, ESM) is green-field.
- `e2e/` (Playwright, TypeScript) is green-field at the **repository root**, not nested under `Client/`. The repo-root location is binding (per 2026-05-03 clarification) because the E2E suite drives both backend lifecycle and frontend browser automation; co-locating with `Client/` would couple it to Vite tooling and complicate seed-script invocation.

The new top-level `package.json` exists *only* for Playwright devDependencies and the `npm run test:all` aggregate script. It does not duplicate any runtime dependency from `Client/` or `Server/`.

## Complexity Tracking

> No Constitution Check violations. This section is intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none)    |            |                                     |
