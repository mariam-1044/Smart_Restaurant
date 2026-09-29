# Feature Specification: Full Test Suite (Production-Grade Coverage)

**Feature Branch**: `006-full-test-suite`
**Created**: 2026-05-03
**Status**: Draft
**Input**: User description: "P5 — Full Test Suite (0% → Production-Grade) — read from smart_restaurant_speckit_plan.md"

## Summary

The Smart Restaurant codebase has grown across five prior phases (P0–P4) and the test situation is now uneven: the backend has roughly two dozen Jest + Supertest tests scattered across `Server/__tests__/` (mostly covering AI/ML, pricing, recommendation, menu validation, CSV escaping, and a handful of newer endpoints from features 002–005), while the frontend has **zero** automated tests, no Vitest configuration, no React Testing Library setup, and no Playwright project. The master plan's claim of "0% → production-grade" is therefore inaccurate today on the server side and accurate on the client side. This feature closes the gap on both sides: it raises backend coverage to a global ≥80% lines/branches gate spanning **every** service, controller, and route added through P0–P4 (including notification, customer, sales, ETL, POS, dashboard, endorsement, and audit, which have partial or no tests today); it stands up a complete Vitest + React Testing Library suite for every page and every cross-cutting component (Sidebar, Navbar, NotificationBell, Toast, ProtectedRoute, ThemeContext); and it stands up a Playwright E2E project covering the six critical user flows from the master plan plus a smoke flow for each new page built in feature 003. The result is a production-grade, CI-runnable test suite that makes regressions visible before they ship.

## Clarifications

### Session 2026-05-03

- Q: Where should Playwright live — repository root or under `Client/`? → A: **Repository root.** A top-level `package.json` (created if absent) carries Playwright as a devDependency and the specs live under `/e2e/`. The E2E suite drives both backend (precondition seeds, lifecycle) and frontend (browser automation), so co-locating it at the root simplifies cross-stack invocation. The master plan's literal `npm init playwright@latest` from `Client/` is deliberately overridden.
- Q: What is the E2E spec scope for this feature? → A: **6 critical flows + 6 new-page smokes.** The six critical flows (auth, ordering, ai, users, inventory, notifications) cover the master plan's acceptance bar. The six smokes (CustomerManagement, WasteManagement, MenuManagement-admin, UserManagement-admin, DemandForecast, DynamicPricing) are one navigation-and-no-error test per new page from feature 003 — cheap insurance that those pages don't silently rot. Cross-browser matrices (firefox, webkit) are explicitly out of scope.
- Q: What coverage thresholds should the gate enforce? → A: **Backend 80%, frontend 75% (lines + branches + functions + statements).** Backend hits the master plan's stated bar globally; frontend gets a 75% global floor with `src/pages/**` and `src/components/**` individually held to 80% so chart-heavy presentation surfaces don't hide rotting logic. 90% / mutation testing is a P6 hardening concern.
- Q: Which CI provider should the workflow target? → A: **GitHub Actions.** The repo already carries `.github/copilot-instructions.md`; GitHub is the implied platform. FR-026 stays as-is: `.github/workflows/test.yml` runs Jest → Vitest → Playwright with `node_modules` and `mongodb-memory-server` binary caching.
- Q: How should Playwright specs authenticate? → A: **`storageState` written by `globalSetup`.** A single programmatic login in `playwright.config.ts`'s `globalSetup` writes `auth.json`; every spec loads it via `use: { storageState: 'auth.json' }`. The login UI itself is still exercised by `e2e/auth.spec.ts` driving the form (so the form is provably tested once). UI-login-per-spec is rejected (~36s of redundant overhead on 12 specs); direct token-injection is rejected (couples specs to the login endpoint shape).
- Q: Should `Server/src/domain/models/` be part of the backend coverage gate? → A: **Yes.** Mongoose models in this project carry custom validators (`User.email` format, `Order.status` enum), pre-save hooks (password hashing on `User`), virtuals, and static methods (`Notification.createAlert`). Including the models directory in `collectCoverageFrom` forces those behaviors to have explicit tests; treating models as untested data classes would let validator and hook bugs slip through to production.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Backend Service & API Coverage Reaches Production-Grade (Priority: P1)

A maintainer (the user, a graduating student, or a future contributor) runs `npm test` inside `Server/` and watches every service and every API route exercise its contract under an in-memory MongoDB. The run completes in well under two minutes, prints a coverage report whose global lines and branches both meet or exceed 80%, and fails the build if any single covered file drops below the gate. The suite covers each service's happy path, each documented edge case, each authorization rule (no token → 401, wrong role → 403, valid token + correct role → 200/201), and the side effects that are unique to this domain (ingredient deduction on order create, ingredient return on order cancel, low-stock alert creation when stock crosses minStock, RFC 4180 escaping in inventory CSV).

**Why this priority**: This is the largest, most demonstrable test artifact for a graduation review. The backend is where the business logic, the AI integration, and the data integrity all live; reviewers will weigh the test report. It is also where existing tests already exist — finishing the job is more efficient than starting elsewhere from scratch.

**Independent Test**: A reviewer clones the repo, runs `cd Server && npm install && npm test --coverage`, and sees a green run with a coverage table whose global `Lines` and `Branches` columns are both ≥80%. The reviewer can then open `Server/coverage/lcov-report/index.html` and confirm each service file is individually green.

**Acceptance Scenarios**:

1. **Given** a fresh clone of the repository, **When** a maintainer runs `npm test` in `Server/`, **Then** every test file under `Server/__tests__/` executes against `mongodb-memory-server` with no requirement for a real MongoDB instance and the run completes in under 120 seconds on a typical laptop.
2. **Given** the test suite has finished, **When** the maintainer runs `npm run test:coverage`, **Then** Jest prints a coverage table whose global `Lines` and `Branches` are both ≥80%, and the run exits non-zero if either falls below.
3. **Given** the inventory service's `recordWaste()` is called with a quantity larger than the on-hand stock, **When** the corresponding test runs, **Then** the test asserts the service rejects with a descriptive error and the ingredient document is unchanged.
4. **Given** an order is created via `POST /api/orders` with two items, **When** the corresponding integration test runs, **Then** the test asserts the order is persisted, the response status is 201, the linked ingredients have their `quantity` reduced by the recipe's deduction amount, and a `low_stock` notification is created when any deducted ingredient falls below `minStock`.
5. **Given** an order is cancelled via `PATCH /api/orders/:id/cancel`, **When** the corresponding test runs, **Then** the test asserts the deducted ingredient quantities are returned to inventory and the order's status is `cancelled`.
6. **Given** an unauthenticated client calls any protected route (e.g. `GET /api/inventory`), **When** the request is made with no `Authorization` header, **Then** the test asserts a 401 response with no leakage of internal state.
7. **Given** a `staff`-role token calls an admin-only route (e.g. `POST /api/menu`), **When** the request is made, **Then** the test asserts a 403 response.
8. **Given** the AI service's `generateRecipe()` is called and the OpenAI client throws, **When** the test runs, **Then** the test asserts a wrapped, user-facing error is thrown and the OpenAI call was retried zero times (no silent retry loop).
9. **Given** the Python ML service is not running, **When** an integration test calls `POST /api/ai/forecast`, **Then** the test asserts the API surfaces a clear "ML service unavailable" error to the client (no random-number fallback).
10. **Given** a CSV export is requested with one ingredient whose `name` contains a comma and a quote, **When** the test runs, **Then** the test asserts the row is escaped per RFC 4180 (whole field double-quoted, internal quotes doubled).

---

### User Story 2 - Frontend Component & Page Coverage From Zero (Priority: P1)

A frontend developer runs `npm test` inside `Client/` and the full Vitest + React Testing Library suite executes against `jsdom`, mocking network calls so no backend is required. Every page (Login, Register, Dashboard, Inventory, InventoryDetail, OrderingSystem, OrderDetail, Sales, Report, Setting, Recipes, Recommendation, CustomerManagement, WasteManagement, admin/MenuManagement, admin/UserManagement, ai/DemandForecast, ai/DynamicPricing) exercises its render path, its loading state, its error state, its primary user action, and its role-gated affordance. Every cross-cutting component (Sidebar, Navbar, NotificationBell, Toast, ProtectedRoute, ThemeContext) exercises its key behaviors. The suite produces a Vitest coverage report whose global `Lines` and `Branches` are both ≥75%, with `src/pages/` and `src/components/` individually ≥80%.

**Why this priority**: The frontend has zero tests today and is where reviewers will see (and click) the most. Visible UI bugs at the demo are the highest-impact regression class; a real RTL suite catches the majority of them automatically and keeps the new pages built in feature 003 from rotting.

**Independent Test**: A reviewer runs `cd Client && npm install && npm test`, sees a green run, then runs `npm run test:coverage` and confirms the coverage thresholds. The reviewer opens any test file (e.g. `src/__tests__/pages/Login.test.jsx`) and reads it as a documented contract for the page's behavior.

**Acceptance Scenarios**:

1. **Given** a fresh clone of the repository, **When** the developer runs `cd Client && npm install && npm test`, **Then** Vitest discovers and runs every test under `Client/src/__tests__/` against `jsdom`, all `axios` calls are mocked through a single `src/test/setup.js`, and the run completes in under 60 seconds.
2. **Given** the test suite has finished, **When** the developer runs `npm run test:coverage`, **Then** the global `Lines` and `Branches` are both ≥75% and `src/pages/` and `src/components/` directories are individually ≥80%.
3. **Given** the Login page renders, **When** the user fills in valid credentials and clicks submit, **Then** the test asserts the mocked `POST /auth/login` was called with the form values, the auth context was updated, and the user is redirected to `/dashboard`.
4. **Given** the Login page renders, **When** the API returns a 401 with a "wrong credentials" message, **Then** the test asserts the error message is visible in the DOM and the form is not cleared.
5. **Given** the Dashboard page mounts with mocked successful API responses, **When** the page renders, **Then** the test asserts every stat card displays the value from the mocked payload and at least one chart is present in the DOM.
6. **Given** the Inventory page mounts, **When** the user types in the search box, **Then** the test asserts the visible row count narrows to only matches and the export button remains visible and enabled.
7. **Given** the Recipes page mounts, **When** the user clicks **Generate**, **Then** the test asserts the mocked `POST /ai/recipe` is called and a recipe card appears in the DOM with the returned name and ingredient list.
8. **Given** the NotificationBell component is mounted with a mocked unread count of 3, **When** the user clicks the bell, **Then** the test asserts the dropdown opens and three notification rows render.
9. **Given** the Toast provider is mounted, **When** a child calls `useToast().error("Boom")`, **Then** the test asserts a toast with role `alert` (or accessible equivalent) appears, contains the text "Boom", and auto-dismisses after the configured timeout (using fake timers).
10. **Given** a test asserts the dark-mode toggle in Settings, **When** the toggle is flipped, **Then** the test asserts `document.documentElement.dataset.theme === 'dark'` and `localStorage.getItem('theme') === 'dark'`.
11. **Given** a `staff`-role user navigates to `/admin/users`, **When** ProtectedRoute resolves, **Then** the test asserts the user is redirected away from the admin page and the UserManagement page is **not** rendered.

---

### User Story 3 - End-to-End Smoke Of The Six Critical Flows (Priority: P2)

A reviewer runs `npx playwright test` from the repository root and watches an end-to-end suite drive a real browser against a real (locally running) backend and frontend. The suite covers the six flows the master plan called out — staff login → dashboard, create order → inventory deducted, AI recipe generation, admin approve staff, inventory export, low-stock alert notification — plus a single smoke test for each new page added in feature 003 (CustomerManagement, WasteManagement, MenuManagement, UserManagement, DemandForecast, DynamicPricing) that asserts the page reaches an interactive state without throwing. The suite uses fixture seed data, runs against `chromium` headlessly by default, and produces a Playwright HTML report.

**Why this priority**: E2E adds confidence that integration seams work but is slower to run and brittle under refactor. Backend and frontend unit-level suites catch most regressions; E2E exists to catch the ones the unit suites can't see (cross-stack contract drift). It is therefore P2 — important but second.

**Independent Test**: With `Server/` and `Client/` running locally and the seed script applied, the reviewer runs `npx playwright test`, watches all 12 specs (6 critical + 6 page smokes) pass, and opens the HTML report at `playwright-report/index.html`.

**Acceptance Scenarios**:

1. **Given** the dev stack is running locally with seeded data, **When** the reviewer runs `npx playwright test`, **Then** every spec in `e2e/` runs in `chromium` headlessly and the suite passes.
2. **Given** the staff-login spec runs, **When** the test fills the form with the seed-staff credentials and submits, **Then** the test asserts redirect to `/dashboard` and that at least one stat card is rendered.
3. **Given** the create-order spec runs, **When** the test adds a dish to the cart, checks out, and reads the inventory page, **Then** the test asserts the deducted ingredient's quantity decreased by exactly the recipe quantity.
4. **Given** the AI-recipe spec runs, **When** the test clicks **Generate** on the Recipes page, **Then** the test asserts a recipe card appears within the configured timeout and contains a `name`, an `ingredients` list, and a `steps` list.
5. **Given** the admin-approve-staff spec runs, **When** an admin clicks **Approve** on a pending user, **Then** the test asserts that user's status badge changes to `Active` without a page reload.
6. **Given** the inventory-export spec runs, **When** the test clicks **Export**, **Then** the test asserts a download event is observed and the downloaded payload starts with the expected CSV header.
7. **Given** the low-stock-alert spec runs, **When** the test seeds an ingredient at `quantity = minStock + 1`, places an order that deducts 2 units, and waits for the next notification poll, **Then** the test asserts the bell badge increments by at least 1 and the dropdown contains a `low_stock` row.
8. **Given** any of the six new-page smoke specs runs, **When** the test navigates to the page, **Then** the test asserts the page reaches an interactive state with no `console.error`, no unhandled-promise-rejection event, and no React error boundary fallback rendered.

---

### User Story 4 - One-Command CI Run And Coverage Gate (Priority: P3)

A maintainer adds a single GitHub Actions workflow (or equivalent CI runner config) that, on every push and PR, executes the full backend Jest suite, the full Client Vitest suite, and the Playwright suite against an ephemeral stack, fails the build if any test fails, and uploads coverage artifacts. The workflow caches `node_modules` for both projects to keep total CI time under 10 minutes.

**Why this priority**: A test suite that nobody runs decays. CI is what makes the gate enforceable. It is P3 because the suites themselves (US1–US3) are the load-bearing artifact for the graduation review; CI is a multiplier, not a prerequisite, and can ship after US1–US3 land.

**Independent Test**: A maintainer pushes a commit that intentionally breaks one assertion (e.g. changes the CSV header). CI fails on that commit and the job log clearly identifies the failing test.

**Acceptance Scenarios**:

1. **Given** a push to any branch, **When** the CI workflow runs, **Then** it executes `Server` Jest, `Client` Vitest, and Playwright in that order and fails fast on the first non-zero exit.
2. **Given** a PR is opened, **When** CI completes, **Then** the run's status appears on the PR and a coverage summary is uploaded as an artifact.
3. **Given** a developer breaks a test, **When** they push, **Then** CI fails within 10 minutes and the failing test's name and assertion appear in the workflow log.

---

### Edge Cases

- A test inadvertently writes to the real MongoDB instance because a service module cached a Mongoose connection from a prior test file. Each test suite must isolate the in-memory MongoDB lifecycle — start in `beforeAll`, stop in `afterAll`, drop collections in `afterEach` — and the service modules under test must connect through the test-injected URI, not a hardcoded `process.env.MONGODB_URI`.
- A test relies on a deterministic `Date.now()` (e.g. forecast-window math) and breaks when run on a different day. Tests that depend on the current date must freeze time using `jest.useFakeTimers({ now: new Date('2026-05-03') })` or equivalent.
- A frontend test relies on real `axios` reaching `localhost:5000` and hangs waiting for a connection refused. Every Vitest test file must `vi.mock('../../api/axios')` (or the project's axios wrapper module) and stub each call explicitly.
- The OpenAI SDK is invoked from a backend test; this would consume real API credits. Every test that touches `ai.service.js` must mock the OpenAI client (`jest.mock('openai')`) and assert behavior against the stub.
- A coverage gate fails because a newly added file is not yet referenced by any test, yet that file is under the `collectCoverageFrom` glob. The maintainer must either author tests for the new file before merging or explicitly exclude it via `coveragePathIgnorePatterns` with a one-line justification comment.
- Playwright runs in CI on Linux, but the developer wrote selectors that depend on font metrics. Tests must use accessible role/name selectors (`getByRole`, `getByLabel`) over visual selectors (pixel positions, screenshot diffs).
- A flaky test due to async timing causes intermittent CI failures. Tests must use `findBy*` (RTL) or `await expect(...).toPass(...)` (Playwright) over `setTimeout`-based polling, and a flaky test that cannot be stabilized in two attempts must be quarantined under `it.skip` with a tracking note rather than disabled silently.
- A test asserts a specific JSON shape that the controller can vary by user role. Tests must run each role variant explicitly rather than asserting a union shape.
- A Playwright spec downloads the inventory CSV; the file lands in the OS download directory and pollutes future runs. The spec must use Playwright's `page.waitForEvent('download')` API and read the payload directly without persisting to disk.
- A backend test creates a JWT directly using `jsonwebtoken` to bypass the login flow for speed. The helper that mints test tokens must use the same `JWT_SECRET` as `Server/.env.test` (or an injected test secret) so the produced token verifies through the real auth middleware path.
- A snapshot test on a page using charts fluctuates because Recharts emits SVG `id` attributes that include random suffixes. Tests must assert behavior (text content, role presence) rather than full DOM snapshots.

## Requirements *(mandatory)*

### Functional Requirements

**Backend Test Infrastructure (US1)**

- **FR-001**: System MUST run the Server test suite against `mongodb-memory-server` for all tests that touch a Mongoose model. No test MAY require a running MongoDB process. Each test file MUST start a fresh `MongoMemoryServer` instance in `beforeAll` and stop it in `afterAll`, and MUST drop all collections in `afterEach` so test order does not affect outcomes.
- **FR-002**: System MUST replace the current `Server/jest.config.js` `collectCoverageFrom` allowlist with a project-wide pattern that covers every file under `src/application/services/`, `src/interfaces/controllers/`, `src/routes/`, `src/middlewares/`, `src/application/validations/`, `src/domain/models/`, and `src/infrastructure/csv/`. The `src/domain/models/` directory is included in the gate (per 2026-05-03 clarification) — Mongoose validators, pre-save hooks (e.g. `User` password hashing), virtuals, and static methods (e.g. `Notification.createAlert`) MUST be explicitly tested. Any file deliberately excluded MUST be listed in `coveragePathIgnorePatterns` with a one-line comment explaining why.
- **FR-003**: System MUST set `coverageThreshold.global` to `{ lines: 80, branches: 80, functions: 80, statements: 80 }` so a single regressed file fails CI. Per-file thresholds MAY be added for the AI/ML core (≥85%) but MUST NOT lower the global gate.
- **FR-004**: System MUST add Jest test files for every service that does not have one today, including but not limited to `notification.service.js`, `customer.service.js`, `sales.service.js`, `etl.service.js`, `pos.service.js`, `inventory.service.js` (full coverage, not just `getById`), and `order.service.js` (full coverage, not just integrity checks). Each new file MUST cover at minimum: the happy path, each documented branch, each error path, and each side effect (DB write, notification creation, ingredient deduction, etc.).
- **FR-005**: System MUST add Supertest API tests for every route group that does not have one today, including but not limited to `notification.routes.js`, `customer.routes.js`, `sales.routes.js`, `dashboard.routes.js`, `etl.routes.js`, `recommendation.routes.js`, and `endorsement.routes.js`. Each route file MUST cover the full CRUD/RPC surface, the `no token → 401` case, and the `wrong role → 403` case.
- **FR-006**: System MUST mock the OpenAI client in any test that imports `ai.service.js`. No test MAY perform a real network call to `api.openai.com`. The mock MUST be installed via `jest.mock('openai')` at module level and MUST stub the `chat.completions.create` method.
- **FR-007**: System MUST stub or mock outbound HTTP calls to the Python ML service (`ML_SERVICE_URL`) in every backend test. Tests MAY use `nock` or a hand-rolled fetch/axios mock; they MUST NOT require port 5002 to be listening.
- **FR-008**: System MUST provide a single `Server/__tests__/helpers/` toolkit exposing: `withInMemoryMongo()` (lifecycle hooks), `seedUser({ role })` (returns user document), `mintToken(user)` (returns a JWT signed with the same secret the server middleware uses), and `authedRequest(app, user)` (returns a Supertest agent with the `Authorization` header pre-set). All new tests MUST use these helpers; bespoke per-file lifecycle code MUST NOT be added.
- **FR-009**: System MUST set the order-side-effect tests so that creating an order through the API results in a measurable `Ingredient.quantity` decrement and that cancelling that order results in the inverse increment. The test MUST query the database directly (not through the API) to confirm the side effect.
- **FR-010**: System MUST set a low-stock-notification test that places an order driving an ingredient below `minStock` and asserts a `low_stock` notification document is created via `notification.service.createAlert(...)`.

**Frontend Test Infrastructure (US2)**

- **FR-011**: System MUST install Vitest, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, and `jsdom` as `Client/` devDependencies. No alternative runners (Jest, Mocha) MAY be added.
- **FR-012**: System MUST add a `test` block to `Client/vite.config.js` (or a co-located `vitest.config.js`) that sets `globals: true`, `environment: 'jsdom'`, `setupFiles: './src/test/setup.js'`, and a `coverage` block enabling `v8` reporter with thresholds `lines: 75, branches: 75` global, `lines: 80, branches: 80` for `src/pages/**` and `src/components/**`.
- **FR-013**: System MUST create `Client/src/test/setup.js` that imports `@testing-library/jest-dom`, registers a global `axios` mock (so any unmocked call surfaces a clear error, not a silent network attempt), and resets `localStorage` / `sessionStorage` between tests.
- **FR-014**: System MUST add a Vitest test file for every page under `Client/src/pages/` and for every cross-cutting component under `Client/src/components/`. The minimum-required cases per page/component are: render without throwing, loading state, error state, primary user action, and (for protected pages) role-gated rendering.
- **FR-015**: System MUST mock the project's axios wrapper (`src/api/axios.js` or equivalent) in every test file via `vi.mock(...)`. No test MAY rely on a live backend.
- **FR-016**: System MUST add tests for `ProtectedRoute` covering: unauthenticated user redirected to `/login`, authenticated `staff` user blocked from admin routes, and authenticated `admin` user allowed through. The matrix MUST run for at least two protected paths.
- **FR-017**: System MUST add tests for the `Toast` system (built in feature 005) covering: success variant renders with the green styling, error variant renders with the red styling, multiple toasts stack, and a toast auto-dismisses after the configured timeout (using fake timers).
- **FR-018**: System MUST add tests for the `ThemeContext` (built in feature 005) covering: default theme is `light`, calling `toggleTheme` flips `document.documentElement.dataset.theme` and writes `localStorage.theme`, and a fresh mount with `localStorage.theme === 'dark'` applies the dark theme on first render with no light flash.
- **FR-019**: System MUST add tests for `NotificationBell` covering: initial badge displays the unread count from the mocked endpoint, clicking the bell renders the dropdown with one row per notification, clicking **Mark all read** calls the mocked PATCH endpoint and zeroes the badge.

**End-to-End Test Infrastructure (US3)**

- **FR-020**: System MUST install Playwright at the **repository root** (not under `Client/` — per 2026-05-03 clarification). A top-level `package.json` is created if absent and carries Playwright as a devDependency. The committed `playwright.config.ts` MUST be configured to run against `chromium` headlessly by default, with a `reuseExistingServer` option pointing at `http://localhost:5173` (Vite) and `http://localhost:5000` (Express). The cross-browser matrix (firefox, webkit) is explicitly out of scope for this iteration.
- **FR-021**: System MUST add the six critical-flow specs documented in the master plan (`e2e/auth.spec.ts`, `e2e/ordering.spec.ts`, `e2e/ai.spec.ts`, `e2e/users.spec.ts`, `e2e/inventory.spec.ts`, `e2e/notifications.spec.ts`) and one smoke spec per new page from feature 003 (`e2e/smoke/customers.spec.ts`, `e2e/smoke/waste.spec.ts`, `e2e/smoke/menu-admin.spec.ts`, `e2e/smoke/users-admin.spec.ts`, `e2e/smoke/forecast.spec.ts`, `e2e/smoke/pricing.spec.ts`).
- **FR-022**: System MUST seed test data through a deterministic script (`Server/scripts/seed-e2e.js` or equivalent) invoked from Playwright's `globalSetup`. The script MUST be idempotent — running it twice MUST leave the database in the same state.
- **FR-022a**: System MUST authenticate Playwright specs via a Playwright **`storageState`** written by `globalSetup` (per 2026-05-03 clarification). `globalSetup` MUST perform one programmatic login (e.g. via `request.post('/api/auth/login', ...)`), persist the resulting cookies / `localStorage` to `auth.json`, and every spec MUST consume it via `use: { storageState: 'auth.json' }`. The login UI itself is exercised exactly once by `e2e/auth.spec.ts` driving the actual form. Specs MUST NOT log in via the UI for every test (rejected for ~36s of redundant overhead on 12 specs) and MUST NOT inject JWTs directly into `localStorage` outside `globalSetup` (rejected for coupling specs to the login response shape).
- **FR-023**: System MUST select DOM nodes by accessible role/name in Playwright specs (`page.getByRole('button', { name: 'Export' })`). Selectors keyed to CSS class names, pixel offsets, or auto-generated IDs are forbidden because they are refactor-fragile.
- **FR-024**: System MUST handle Playwright file downloads via `page.waitForEvent('download')` and read the payload from the resulting `Download` object. Specs MUST NOT write to a hard-coded filesystem path.

**Cross-Cutting (US4)**

- **FR-025**: System MUST add an `npm run test:all` script at the repository root (in a top-level `package.json`, or as a Makefile target / shell script) that runs `Server` Jest, `Client` Vitest, and Playwright in sequence and exits non-zero on the first failure.
- **FR-026**: System MUST add a CI workflow file (e.g. `.github/workflows/test.yml`) that, on every push and PR, runs `npm ci` in both `Server/` and `Client/`, executes the full backend → frontend → E2E sequence, caches `node_modules` for both projects keyed on the lockfile hashes, and uploads the Jest, Vitest, and Playwright reports as build artifacts.
- **FR-027**: System MUST keep total CI wall-clock time under 10 minutes in the median case. If a single suite (most likely Playwright) drives total time above 10 minutes, the workflow MUST run the suites in parallel jobs.
- **FR-028**: System MUST keep test runs hermetic — no test MAY require an external API key (OpenAI, SMTP, payment provider) to pass. Any test that did require one MUST be replaced by a test that mocks the boundary.
- **FR-029**: System MUST NOT introduce new application-runtime dependencies. The only additions allowed are `devDependencies` for testing (Vitest, RTL family, Playwright, optional `nock`, optional `@vitest/coverage-v8`).
- **FR-030**: System MUST NOT change any production code path solely for testability when a non-invasive change exists. Any production code that is genuinely untestable as written (e.g. a service that hardcodes `process.env.MONGODB_URI` and connects on import) MAY be refactored to accept dependency injection, but the refactor MUST preserve the existing public contract and MUST be covered by its own test in the same commit.

### Key Entities *(include if feature involves data)*

- **In-Memory MongoDB Instance (transient)**: Spawned by `mongodb-memory-server` per backend test file. Lives in RAM, is dropped after the file completes. Holds seed users, ingredients, dishes, orders, notifications, and customers.
- **Test User (seed)**: A `User` document created via the `seedUser({ role })` helper. Carries a known role (`admin` / `staff` / `customer`), a deterministic `_id`, and a known password hash so `mintToken` can return a verifiable JWT.
- **Test JWT**: A short-lived JSON Web Token signed with the same `JWT_SECRET` the server middleware verifies against. Used to drive Supertest requests through the real auth pipeline.
- **Vitest Mock Module Registry**: A per-test module registry where `vi.mock('../../api/axios')` substitutes the real axios wrapper with a stub. Each test file MUST reset this registry between cases to prevent leakage.
- **Playwright Storage State (transient)**: A JSON file written by Playwright's `globalSetup` after a programmatic login. Subsequent specs `use` this state to skip re-logging-in for every test. Discarded after each CI run.
- **Coverage Report (artifact)**: The `Server/coverage/` and `Client/coverage/` directories produced by Jest and Vitest respectively. Uploaded as CI artifacts; not committed to the repository.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Running `npm test` in `Server/` from a fresh clone produces a green run with global `Lines ≥ 80%` and `Branches ≥ 80%` reported by Jest, in under 120 seconds on a typical laptop.
- **SC-002**: Running `npm test` in `Client/` from a fresh clone produces a green run with global `Lines ≥ 75%` and `Branches ≥ 75%`, with `src/pages/` and `src/components/` individually at `≥ 80%` lines and branches, in under 60 seconds.
- **SC-003**: Running `npx playwright test` against a locally running stack with the seed script applied produces a green run of all 12 specs (6 critical + 6 smoke) in under 5 minutes on a typical laptop.
- **SC-004**: Every service file under `Server/src/application/services/` has at least one corresponding test file under `Server/__tests__/services/`. Verified by directory diff.
- **SC-005**: Every controller file under `Server/src/interfaces/controllers/` is exercised by at least one Supertest test in `Server/__tests__/api/`. Verified by directory diff.
- **SC-006**: Every page file under `Client/src/pages/**/*.jsx` has at least one corresponding test file under `Client/src/__tests__/pages/`. Verified by directory diff.
- **SC-007**: 100% of the master plan's six critical E2E flows have a passing Playwright spec — no flow is marked `skip`, `fixme`, or `only`. Verified by `grep -nE "test\.(skip|fixme|only)" e2e/`.
- **SC-008**: Zero test in either suite performs a real outbound network call. Verified by running the suites with the network disabled (e.g. `--offline` proxy) and confirming green.
- **SC-009**: A deliberately introduced regression — e.g. removing the `wasteQuantity` column from the inventory CSV — fails the suite within 60 seconds and the failing test name and assertion text identify the regression unambiguously. Verified by manual experiment.
- **SC-010**: CI runs the full test:all sequence on every push to a feature branch and on every PR to `master`, with median wall-clock time under 10 minutes. Verified by inspecting the last five workflow runs.
- **SC-011**: No test depends on a real OpenAI API key, SMTP credential, payment-provider key, or running Python ML service. Verified by running the entire backend suite with `OPENAI_API_KEY` unset and the ML service offline, and seeing the suite remain green.
- **SC-012**: The repository's top-level `README.md` (or a dedicated `TESTING.md`) documents how to run each suite and where to find the coverage report. Verified by file inspection.

## Assumptions

- The existing backend tests under `Server/__tests__/` (covering AI/ML, pricing, recommendation, menu validation, CSV escaping, inventory `getById`, order integrity, and a handful of API endpoints) are kept and extended — not deleted and rewritten. The "0%" claim in the master plan is treated as a snapshot from project inception, not as a directive to scrap existing work.
- `mongodb-memory-server` (already in `Server/devDependencies`) supports the developer's local Node version and downloads the binary on first install. CI MUST cache that binary across runs to keep the workflow under the 10-minute budget.
- The frontend's project-internal `axios` wrapper is mocked at the wrapper module path, not at the `axios` package path. The exact wrapper path is determined at implementation time by the implementing model reading `Client/src/api/`.
- Playwright is installed at the repository root rather than under `Client/` because the E2E suite drives both the frontend (browser) and the backend (precondition/seed/cleanup). A repo-root `package.json` is added if one does not already exist; it carries only `devDependencies` related to E2E.
- Test data is seeded by a deterministic script. Tests MUST NOT depend on the existing development seed (`Server/src/infrastructure/config/seed.js`) drifting in shape; a separate, frozen `seed-e2e.js` is the source of truth for E2E.
- Coverage thresholds (80% backend, 75% frontend) are calibrated against current code surface area and the realistic single-quarter implementation budget. Higher thresholds (90%+) are deferred to a future hardening pass.
- `node-cron` schedules (e.g. `spoilage.cron.js`) are exercised by unit-testing the handler function directly with mocked dependencies. The cron schedule itself is NOT tested at runtime; spawning a cron timer in a test is forbidden because it leaks beyond the test lifecycle.
- The Python FastAPI ML service (`Server/ml_model_service/main.py`) gets its own `pytest` suite as a follow-up; it is NOT covered by this Node-side feature. The Node integration boundary is mocked.
- Internationalization, accessibility audit (axe-core), visual regression (screenshot diffs), and performance budgets (Lighthouse) are out of scope. They are candidates for a future P6 hardening phase.
- Mutation testing (Stryker), property-based testing (fast-check), and contract testing (Pact) are out of scope. They are nice-to-haves above the production-grade bar this feature targets.
- Test execution on Windows is supported (the user's primary OS is Windows 11). Test files and helpers MUST avoid POSIX-only paths and MUST use `path.join` for any filesystem operation.
