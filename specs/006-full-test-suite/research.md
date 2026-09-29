# Phase 0 Research: Full Test Suite

**Feature**: 006-full-test-suite
**Date**: 2026-05-03
**Status**: Complete

This document captures the design decisions made before authoring the implementation plan. Each decision lists the question, the alternatives considered, the choice, and the rationale.

---

## R1. Backend test runner: keep Jest CommonJS or migrate to ESM?

**Question**: The master plan's example `jest.config.js` used `extensionsToTreatAsEsm: ['.js']`. The existing `Server/jest.config.js` is CommonJS (`module.exports = { ... }`) with a comment that explicitly says "CommonJS project — no ESM flags. Existing src/ uses require/module.exports." Should this feature migrate to ESM or stay CommonJS?

**Alternatives**:
1. **Migrate `Server/` to ESM** — change `package.json` to `"type": "module"`, rewrite every `require/module.exports` in `src/` to `import/export`, drop the CommonJS Jest comment, set `extensionsToTreatAsEsm: ['.js']`. Touches every backend file.
2. **Stay CommonJS** — keep `Server/jest.config.js` and all of `src/` as-is.

**Decision**: **Stay CommonJS.**

**Rationale**:
- Migrating to ESM is a global refactor touching every file in `Server/src/` (services, controllers, routes, middlewares, models). It is unrelated to the testing goal and pollutes the test-suite diff with hundreds of import-statement rewrites.
- Jest 29 supports CommonJS first-class; coverage reporting, mocking, and `mongodb-memory-server` all work without any ESM flags.
- FR-030 forbids production-code refactors that aren't strictly necessary for testability. ESM migration fails that gate.
- The master plan's ESM snippet was illustrative, not binding. The existing config is the source of truth.

**Implication for FRs**: No spec changes. Test files use `require()` / `module.exports` to match the project style.

---

## R2. Test auth strategy: keep `X-Test-User` bypass or migrate to real JWT?

**Question**: The existing `Server/__tests__/helpers/test-app.js` mounts a fake auth middleware that reads `X-Test-User` from the request header and JSON-parses it into `req.user`. This bypasses the real `auth.middleware.js`. Production-grade coverage requires the real middleware to be exercised. Migrate?

**Alternatives**:
1. **Keep `X-Test-User` only** — fast and simple, but the auth middleware itself is never tested by integration tests; `auth.middleware.js` would only be covered by its unit test.
2. **Migrate every test to real JWT through real middleware** — slower test setup (one bcrypt + one jwt.sign per test), but exercises the full path.
3. **Hybrid** — keep `X-Test-User` for the bulk of legacy tests that aren't auth-sensitive; introduce real-JWT helpers for new tests that *should* exercise the middleware (the 401/403 matrix in FR-005).

**Decision**: **Hybrid — option 3.**

**Rationale**:
- The 401/403 matrix mandated by FR-005 is *only* meaningful through real auth. Real JWT is required for those tests.
- Migrating *every* existing test off `X-Test-User` is busywork that adds no coverage; the existing tests cover their own service logic, not auth.
- The `auth.middleware.js` file is in the `collectCoverageFrom` glob. Its real exercise comes from the new 401/403 cases plus its own unit test in `__tests__/middleware/auth.test.js`.
- New helpers (`mintToken`, `authedRequest`) make the real-JWT path the path of least resistance for new tests; legacy tests opt into it as they're touched.
- This satisfies FR-008 verbatim while avoiding a churn-only refactor of ~13 existing API tests.

**Implication for FRs**: FR-008 is unchanged; the helper file is new. FR-030 is honored — no production code change.

---

## R3. ML-service mocking: `nock`, `jest.mock`, or a hand-rolled stub?

**Question**: FR-007 forbids real network calls to the Python ML service at `http://localhost:5002/v1`. How should outbound HTTP from `ai.service.js` be intercepted?

**Alternatives**:
1. **`nock`** — canonical Node HTTP-mocking library. Intercepts at the http/https socket layer, regardless of which client (axios, fetch, got) makes the call.
2. **`jest.mock('axios')`** — mock the axios module. Tight to a single client; brittle if `ai.service.js` ever switches to `node-fetch`.
3. **Hand-rolled global `http.request` override** — minimal but reinvents what `nock` already does.
4. **MSW (Mock Service Worker)** — full-fidelity request handler, but heavier and primarily designed for browser tests.

**Decision**: **`nock`.**

**Rationale**:
- `ai.service.js` already uses `axios` for ML-service calls; `nock` intercepts axios out of the box without any code-side instrumentation.
- `nock` survives a future swap from axios to fetch — same intercept layer.
- One small new devDependency (~50 KB, MIT). Zero impact on production bundle (it's `Server/devDependencies` only).
- The existing test files already do bespoke mocking; `nock` is the standard upgrade path.
- MSW is overkill for backend-only HTTP intercepts.

**Implication for FRs**: FR-007 stays as-is — `nock` is the named "fetch/axios mock" option.

---

## R4. OpenAI client mocking pattern.

**Question**: FR-006 forbids real calls to `api.openai.com`. The `openai@6.27.0` SDK is imported by `ai.service.js`. How should the client be stubbed?

**Alternatives**:
1. **`jest.mock('openai')` at module level** — replaces the entire SDK; tests stub `chat.completions.create` per case.
2. **Inject the OpenAI client via constructor / factory** — refactor `ai.service.js` to accept an `openai` parameter; tests pass a stub.
3. **`nock` against `api.openai.com`** — intercept HTTP; the SDK still runs but its outbound calls are mocked.

**Decision**: **`jest.mock('openai')` (option 1).**

**Rationale**:
- Module-level mock is idiomatic Jest; no production code change required (FR-030 honored).
- Lets each test stub the response shape directly without going through the full SDK serialization.
- Avoids coupling tests to OpenAI's HTTP wire format (which can change between SDK versions).
- A reusable `__tests__/helpers/mockOpenAI.js` factory standardizes the stub across files.
- DI refactor (option 2) is a larger production-code surface change for no testing benefit.

**Implication for FRs**: FR-006 is unchanged. `mockOpenAI.js` is added under `__tests__/helpers/`.

---

## R5. Frontend mocking layer: `vi.mock(axiosWrapper)` vs MSW vs network-mock.

**Question**: FR-015 says every Vitest test mocks the project's axios wrapper. The wrapper lives at `Client/src/api/axios.js`. Should we additionally use MSW for fidelity, or is module-mocking sufficient?

**Alternatives**:
1. **`vi.mock('../../api/axios')` per test file** — mock the wrapper module; each test stubs the methods it needs.
2. **MSW (Mock Service Worker)** — intercepts at the request level via service worker; tests work against the same HTTP shape the real backend produces.
3. **`global.fetch` override** — primitive; no longer relevant since the project uses axios, not fetch.

**Decision**: **`vi.mock('../../api/axios')` (option 1).**

**Rationale**:
- The axios wrapper is the project's seam — every page imports from `../../api/axios` (or relative path equivalent). Mocking at the seam is one line per test file and gives tests full control over response shape and timing.
- MSW adds a service-worker dependency, a setup file with handlers, and a runtime overhead; it's overkill for unit-level component tests where we don't care about HTTP wire fidelity.
- MSW would shine for *integration* tests that actually want HTTP-level realism — that's what Playwright covers in this feature.
- Module-mocking lets tests assert *which* axios method was called with *what* arguments, which is exactly what most component tests need ("did clicking Save call `axios.patch('/auth/update-profile', ...)`?").

**Implication for FRs**: FR-013 mandates a global axios mock in `setup.js` that surfaces a clear error when an unmocked call is made — preserves the safety net while keeping the per-test mocks lightweight.

---

## R6. Vitest coverage provider: `v8` or `istanbul`?

**Question**: Vitest supports both. Which to use?

**Alternatives**:
1. **`v8`** (`@vitest/coverage-v8`) — uses Node's built-in V8 coverage; faster, no instrumentation overhead, accurate.
2. **`istanbul`** (`@vitest/coverage-istanbul`) — older, instruments source code; slower, but the de-facto standard with broader tool integration (e.g. SonarCloud).

**Decision**: **`v8`.**

**Rationale**:
- Vitest's recommended default since 2023.
- ~3× faster on this codebase size.
- The graduation project doesn't integrate SonarCloud or any other tool that requires Istanbul-format reports specifically.
- LCOV output is identical between providers, so any future CI integration still works.

**Implication for FRs**: FR-012 remains as-is — `v8` is the chosen reporter.

---

## R7. Playwright location: repo-root vs `Client/`.

**Question**: Resolved by 2026-05-03 clarification — repo root. This entry documents the rationale for posterity.

**Decision**: **Repository root.**

**Rationale**:
- E2E suite drives both Server (precondition seeds, lifecycle) and Client (browser automation). Co-locating with one or the other distorts ownership.
- Repo-root `package.json` is a thin shell — only `@playwright/test`, `@types/node`, `dotenv`. No production deps.
- Seed scripts live in `Server/scripts/seed-e2e.js` but are *invoked* from `e2e/global-setup.ts` via direct Node child_process spawn against the Server's working directory.
- Master plan's literal `npm init playwright@latest` from `Client/` is overridden — that command was for an illustration, not a binding directive.

**Implication for FRs**: FR-020 is rewritten in the spec; no further FR changes here.

---

## R8. Playwright auth strategy: storageState vs UI login per spec vs per-spec token injection.

**Question**: Resolved by 2026-05-03 clarification — `storageState`. This entry documents the comparative analysis.

**Decision**: **`storageState` written by `globalSetup`.**

**Rationale**:
- One programmatic login (`request.post('/api/auth/login', ...)`) writes `auth.json` once. Every spec consumes it via `use: { storageState: 'auth.json' }`. Login overhead drops from 12× per run to 1× per run.
- The login UI is still tested — `e2e/auth.spec.ts` clears `storageState` (via `test.use({ storageState: { cookies: [], origins: [] } })`) and drives the form.
- Per-spec UI login wastes ~3 s × 11 specs = ~33 s of redundant overhead, runs the same code path 12 times, and adds flake surface (login form is the most-changed UI).
- Direct token injection (`localStorage.setItem('token', jwt)`) couples specs to the login response shape — when the response shape changes, every spec breaks.

**Implication for FRs**: FR-022a captures the binding.

---

## R9. E2E database isolation: separate DB vs same DB as dev.

**Question**: Should E2E tests use the dev database (`smart_restaurant`) or a separate test database (`smart_restaurant_e2e`)?

**Alternatives**:
1. **Separate database** (`smart_restaurant_e2e`) — clean boundary, no risk of E2E seeds polluting dev data.
2. **Same database** — simpler, but E2E mutations (creating orders, approving users, deducting inventory) corrupt the developer's working state.
3. **Per-spec ephemeral database** — fully isolated; one DB per spec. Slow (DB creation overhead).

**Decision**: **Separate database.**

**Rationale**:
- One-line config change: Playwright's `globalSetup` exports `MONGODB_URI=mongodb://localhost:27017/smart_restaurant_e2e` to the Server child process.
- Idempotent seed (`Server/scripts/seed-e2e.js`) drops + re-inserts on every run, so state is deterministic.
- Per-spec databases are slow and unnecessary; the seed is fast enough to reset between runs.
- Sharing the dev DB makes E2E unsafe to run while iterating on the app.

**Implication for FRs**: FR-022 implicitly requires the seed to know its database; the docs in `quickstart.md` will spell out the env var.

---

## R10. Coverage gate scope: include `domain/models/` or not.

**Question**: Resolved by 2026-05-03 clarification — yes, include. Documenting rationale.

**Decision**: **Include `Server/src/domain/models/` in `collectCoverageFrom`.**

**Rationale**:
- Mongoose models in this project are not pure schema declarations. `User` has a `pre('save')` password-hashing hook; `Order` has an enum validator with a documented bug history (the "competed" → "pending" default fix from feature 002); `Notification` has static factory methods (`createAlert`, `markRead`, `getUnread`); `Customer` has virtuals and array shape constraints.
- Treating these as untested data classes means the testing burden falls on integration tests that may or may not exercise the validator path. Direct unit tests on the model are the highest-signal-per-LOC option.
- ~6 new model test files. Small bounded scope.

**Implication for FRs**: FR-002 expanded to call this out explicitly.

---

## R11. CI provider: GitHub Actions vs alternatives.

**Question**: Resolved by 2026-05-03 clarification — GitHub Actions. Documenting rationale.

**Decision**: **GitHub Actions.**

**Rationale**:
- Repo carries `.github/copilot-instructions.md`; GitHub is the de-facto remote.
- GitHub-hosted Linux runners are free for public repos and cheap for private. The graduation project doesn't need self-hosted runners.
- `actions/cache@v4` covers `node_modules` and the `mongodb-memory-server` binary — the two large CI cache wins.
- Playwright's `microsoft/playwright-github-action` (or simply `npx playwright install --with-deps chromium`) is well-trodden.

**Implication for FRs**: FR-026 names `.github/workflows/test.yml` directly.

---

## R12. CI parallelism: sequential vs parallel suites.

**Question**: FR-027 caps median CI wall-clock at 10 minutes. With three suites running sequentially (~2 min Jest + ~1 min Vitest + ~5 min Playwright + setup overhead), the budget is tight. Parallelize?

**Alternatives**:
1. **Sequential** (single job) — simpler, fail-fast. ~9–12 minutes total.
2. **Parallel jobs** (Jest + Vitest in one job, Playwright in another with its own setup) — ~6–7 minutes total but doubles GitHub Actions minutes consumed.
3. **Three parallel jobs** — fastest (~5 min) but triples minutes consumed.

**Decision**: **Start sequential; parallelize only if median exceeds 10 minutes after first 5 runs (per FR-027).**

**Rationale**:
- "Premature optimization" applies to CI too. The project is a graduation submission, not a high-frequency-merge codebase.
- Sequential gives stable fail-fast semantics — one failed Jest test means we don't burn Playwright minutes.
- The 10-minute budget is a soft target. If reality lands at 11 minutes, we revisit; if it lands at 8, we did fine.
- Parallelization is cheap to add later (split the workflow file into two jobs with `needs:` for ordering or remove `needs:` for parallelism).

**Implication for FRs**: FR-027 stays as-is — it's a check, not a mandate to start parallel.

---

## R13. Test-data seeding strategy for unit tests.

**Question**: How do per-test-file backend tests get their seed data?

**Alternatives**:
1. **Per-test seed via helpers** — each test file calls `seedUser({ role: 'admin' })` etc. directly in `beforeEach`. Fully explicit; tests document their preconditions.
2. **Shared fixture module** — `__tests__/fixtures/` exports pre-built users and ingredients; tests import them.
3. **Hybrid** — fixtures for genuinely shared shapes (e.g. canonical seed-staff identity), helpers for ad-hoc per-test seeding.

**Decision**: **Helpers (option 1).**

**Rationale**:
- Each test states its own preconditions explicitly; reading a test tells you everything it depends on.
- Avoids fixture sprawl — fixtures tend to grow until they're used by 100 tests, then any change breaks 100 tests.
- The helpers (`seedUser`, `mintToken`) are tiny — ~10 lines each — so per-test invocation isn't repetitive.
- E2E is different: `seed-e2e.js` is the shared fixture for that layer because the Playwright suite needs cross-spec consistency.

**Implication for FRs**: FR-008 names the helpers; no fixtures directory required.

---

## R14. Date / time freezing for tests that depend on `Date.now()`.

**Question**: Forecasting tests, expiry tests, and the spoilage cron all read the current time. How to make them deterministic?

**Alternatives**:
1. **`jest.useFakeTimers({ now: new Date('2026-05-03') })`** in `beforeEach` for time-sensitive tests.
2. **Inject a clock function** into services that need it (e.g. `etl.service.js` accepts a `now` parameter).
3. **Don't freeze time — write tests that tolerate any Date.now()**.

**Decision**: **`jest.useFakeTimers` per file (option 1).**

**Rationale**:
- No production code change (FR-030 honored).
- Jest's modern fake timers handle `Date.now()` without breaking `setTimeout`/`setInterval` (relevant for any cron handler test).
- Option 2 (clock injection) is a real refactor with a real benefit, but it's *not* worth doing solely for tests if option 1 works.
- Option 3 produces flaky tests that fail on month/year boundaries.

**Implication for FRs**: Edge case in spec already calls this out. No FR change.

---

## R15. Risk register.

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `mongodb-memory-server` fails to download binary in CI (network blocked, registry rate-limited) | Medium | High | Cache the binary directory in `actions/cache@v4` keyed on package-lock hash |
| Coverage gate fails because legacy file added to glob has no tests yet | Medium | Medium | Allow `coveragePathIgnorePatterns` exemptions with one-line justification (FR-002) until tests catch up |
| Playwright flake on CI due to slow startup | Medium | Medium | `expect.toPass({ intervals, timeout })` for navigation; `reuseExistingServer: !process.env.CI`; explicit `await page.waitForLoadState('networkidle')` after navigation |
| OpenAI module-mock leaks between tests (Jest module registry) | Low | Medium | `clearMocks: true` already in jest.config.js (preserved); `jest.resetModules()` in `afterEach` for any test that reaches into module internals |
| Real-JWT tests fail because `JWT_SECRET` differs between `jest.setup.js` ('test-jwt-secret') and a service that read it at module-import time | Low | High | `mintToken.js` reads `process.env.JWT_SECRET` at *call* time, not module-import time; `jest.setup.js` already sets the secret before any test loads |
| Vitest coverage threshold fails because admin / ai sub-pages have low branch coverage at MVP | Medium | Low | Per-directory thresholds: pages 80% / components 80% / global 75%. Admin and ai pages each get one focused test that hits both happy-path + role-block branch |
| E2E low-stock spec is flaky because notification poll runs every 30 s | Medium | Medium | Spec calls `await page.waitForTimeout(31000)` after triggering the event, OR exposes a manual "refresh notifications" hook for testability (decision deferred to /speckit.tasks) |
| Windows path issues in test files | High on Windows | Medium | All filesystem ops use `path.join`; CI runs on Linux but devs run on Windows — both must pass before merge |
| Test runs hang the IDE because `mongodb-memory-server` keeps a port open after a crash | Low | Low | Each test file's `afterAll` calls `mongoServer.stop()` even on test failure (`try/finally`) |
| Playwright `auth.json` has stale cookies after a `JWT_SECRET` rotation in dev | Low | Low | `globalSetup` is idempotent: re-runs login on every CI invocation; the file is gitignored |

---

## R16. Out-of-scope decisions (intentionally deferred to P6 or later).

- **Mutation testing (Stryker)** — would tighten the 80% gate by detecting trivially-passing tests. Real value, but its 8–15 minute run time blows the CI budget.
- **Property-based testing (fast-check)** — useful for the validators (`Joi` schemas); rejected because FR-001..FR-030 don't require it and one-shot example-based tests are sufficient for graduation scope.
- **Visual regression (Playwright screenshots)** — too brittle on Recharts-based pages with auto-generated SVG IDs.
- **Accessibility audit (axe-core)** — important for production but orthogonal to functional coverage.
- **Performance budgets (Lighthouse)** — separate concern.
- **Pact / consumer-driven contract testing** — overkill for a single-team monorepo.
- **Python ML service `pytest` suite** — covered as a separate follow-up; the Node-side boundary is mocked here.

---

## Resolution Summary

All NEEDS CLARIFICATION items from the spec template are resolved. No open questions remain for Phase 1.
