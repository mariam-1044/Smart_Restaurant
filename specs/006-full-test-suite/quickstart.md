# Quickstart: Full Test Suite

**Feature**: 006-full-test-suite
**Audience**: developer (graduating student) and reviewer
**Estimated total time (cold clone)**: ~12 minutes for the full Jest + Vitest + Playwright sequence

This document gives reviewer-runnable steps to validate each user story end-to-end after this feature ships.

---

## Prerequisites (one-time)

| Requirement | Why | Verify |
|-------------|-----|--------|
| Node 18+ | Both projects target ES2022 + Vitest needs Node ≥18 | `node --version` |
| MongoDB 6.x running on localhost:27017 | Required ONLY for E2E (Playwright); Jest uses in-memory Mongo | `mongosh --eval 'db.runCommand({ping:1})'` |
| Git | Cloning the repo | `git --version` |
| ~2 GB free disk | `mongodb-memory-server` binary + Playwright chromium | `df -h` |

If MongoDB is not installed, **the backend Jest suite still runs** (it spawns its own ephemeral Mongo). MongoDB is required only for Playwright E2E (US3).

---

## Quickstart 1 — User Story 1: Backend Jest + Supertest

```bash
cd Server
npm install                    # ~1 min cold; ~5 s warm
npm test                       # full suite, no coverage
npm run test:coverage          # full suite + LCOV/HTML coverage
```

**Expected output (npm test)**:
```
Test Suites: ~80 passed, 80 total
Tests:       ~400 passed, 400 total
Time:        < 120 s
```

**Expected output (npm run test:coverage)**:
A coverage table printed to stdout. The last row reads:
```
All files                  |   ≥80 |     ≥80 |    ≥80 |    ≥80
```

If any line / branch / function / statement column drops below 80%, Jest exits non-zero with `Jest: "global" coverage threshold for ___ (80%) not met: ...`.

**HTML report**: open `Server/coverage/lcov-report/index.html` in any browser. Click into any service file and confirm green coverage stripes.

**SC mapping**: SC-001 (`Lines ≥ 80%`, `Branches ≥ 80%`, < 120 s). SC-004 (every service has a corresponding test file). SC-005 (every controller is exercised). SC-008 (no real network — verified by `nock.disableNetConnect()` in `jest.setup.js` failing any unmocked request). SC-011 (run with `OPENAI_API_KEY=` empty — `unset OPENAI_API_KEY && npm test` — and confirm green).

**If a test fails**:
1. Read the failing test name; it tells you the service and the case.
2. Open the test file and the service file side-by-side.
3. Run a single file: `npx jest __tests__/services/foo.service.test.js -t "case name"`.

---

## Quickstart 2 — User Story 2: Frontend Vitest + RTL

```bash
cd Client
npm install                    # ~1 min cold; ~5 s warm
npm test                       # full Vitest suite
npm run test:coverage          # + coverage
npm run test:ui                # interactive Vitest UI (optional)
```

**Expected output (npm test)**:
```
Test Files  ~30 passed (30)
Tests       ~150 passed (150)
Duration    < 60 s
```

**Expected output (npm run test:coverage)**:
A coverage summary printed to stdout. Confirm:
- Global lines/branches ≥ 75%
- `src/pages/` lines/branches ≥ 80%
- `src/components/` lines/branches ≥ 80%

**HTML report**: open `Client/coverage/index.html`.

**SC mapping**: SC-002 (`Lines ≥ 75%`, `Branches ≥ 75%`, pages/components ≥ 80%, < 60 s). SC-006 (every page has a test file). SC-008 (no real network — global `vi.mock('../api/axios')` in `setup.js` rejects any unmocked HTTP).

**Manual sanity check — the Login spec**:
```bash
npx vitest run src/__tests__/pages/auth/Login.test.jsx
```
Read the test source. Confirm the mocked `axios.post('/auth/login', ...)` is asserted *with the form values the test typed*. If a future refactor removes the form field but tests still pass, this would be a hole — but the test should fail because no `axios.post` would be called.

**If `matchMedia is not defined` errors appear**:
The `Client/src/test/setup.js` polyfill is not loading. Verify `vitest.config.js` has `setupFiles: ['./src/test/setup.js']`.

---

## Quickstart 3 — User Story 3: Playwright E2E

**Prerequisite**: Backend and Frontend running locally.

In one terminal:
```bash
cd Server
NODE_ENV=test MONGODB_URI=mongodb://localhost:27017/smart_restaurant_e2e npm start
```

In a second terminal:
```bash
cd Client
npm run dev                    # starts Vite at http://localhost:5173
```

In a third terminal (from repo root):
```bash
npm install                    # one-time: installs Playwright at the repo root
npx playwright install chromium # one-time: downloads ~130 MB chromium build
npx playwright test            # runs the 12 specs
```

**Expected output**:
```
Running 12 tests using 2 workers
  ✓  e2e/auth.spec.ts:5:5 › staff login → dashboard
  ✓  e2e/ordering.spec.ts:5:5 › create order → inventory deducted
  ✓  e2e/ai.spec.ts:5:5 › AI recipe generation produces card
  ✓  e2e/users.spec.ts:5:5 › admin approves pending staff
  ✓  e2e/inventory.spec.ts:5:5 › CSV export download
  ✓  e2e/notifications.spec.ts:5:5 › low-stock badge increments
  ✓  e2e/smoke/customers.spec.ts:5:5 › CustomerManagement renders
  ✓  e2e/smoke/waste.spec.ts:5:5 › WasteManagement renders
  ✓  e2e/smoke/menu-admin.spec.ts:5:5 › admin/MenuManagement renders
  ✓  e2e/smoke/users-admin.spec.ts:5:5 › admin/UserManagement renders
  ✓  e2e/smoke/forecast.spec.ts:5:5 › ai/DemandForecast renders
  ✓  e2e/smoke/pricing.spec.ts:5:5 › ai/DynamicPricing renders

  12 passed (~5 min)
```

**HTML report**:
```bash
npx playwright show-report
```
Opens `playwright-report/index.html` with per-spec timing, screenshots on failure, and traces (if any retry occurred).

**SC mapping**: SC-003 (12 specs, < 5 min). SC-007 (no `test.skip`, `test.fixme`, `test.only` — verify via `grep -nE "test\.(skip|fixme|only)" e2e/`).

**Tear down between iterations**:
The seed script is idempotent. To reset the E2E database manually:
```bash
node Server/scripts/seed-e2e.js
```

**If `Server unreachable at http://localhost:5000` appears in `globalSetup`**:
The Server is not running, or it's running on a different port, or the Server connected to the dev DB instead of `smart_restaurant_e2e`. Confirm Server's `.env` does not override `MONGODB_URI`.

---

## Quickstart 4 — User Story 4: One-command CI run

**From the repo root**:
```bash
npm run test:all
```

This invokes:
1. `cd Server && npm test`
2. `cd Client && npm test`
3. `npx playwright test`

In sequence. Any failure exits non-zero.

**On GitHub**: every push and PR triggers `.github/workflows/test.yml`. The workflow:
1. Checks out the repo.
2. Restores caches: `Server/node_modules`, `Client/node_modules`, `~/.cache/mongodb-binaries`, `~/.cache/ms-playwright`.
3. Runs `npm ci` in `Server/` and `Client/` (skips re-install on cache hit).
4. Runs Server Jest with coverage.
5. Runs Client Vitest with coverage.
6. Boots Server + Client, runs Playwright.
7. Uploads three artifacts: `server-coverage`, `client-coverage`, `playwright-report` (last only on failure).

**SC mapping**: SC-010 (median wall-clock < 10 min — verify by inspecting the last 5 runs in the GitHub Actions tab). SC-012 (top-level `README.md` documents how to run each suite).

---

## Sanity-check the regression detector (from the spec's SC-009)

This is a one-time confidence check that the suite actually catches regressions.

1. Open `Server/src/interfaces/controllers/inventory.controller.js`.
2. Find the CSV export handler. Remove `wasteQuantity` from the headers list.
3. Run `cd Server && npx jest __tests__/api/inventory`.
4. **Expected**: a test fails within 60 seconds with a name like `inventory.export › header row contains wasteQuantity column`.
5. Restore the file.

If the test does NOT fail, the suite has a coverage hole — the export handler change was not exercised by any test.

---

## Manual verification matrix per FR

| FR | Verification command | Expected outcome |
|----|----------------------|------------------|
| FR-001 (in-memory Mongo) | `cd Server && pkill -f mongod && npm test` | All Jest tests pass — they don't need real Mongo |
| FR-003 (coverage gate) | `cd Server && npm run test:coverage` | Exit 0 if ≥80% global; exit non-zero otherwise |
| FR-006 (OpenAI mock) | `cd Server && OPENAI_API_KEY= npm test` | All tests pass — no real OpenAI calls |
| FR-007 (ML stub) | `cd Server && npm test` (with port 5002 unused) | All tests pass — nock intercepts |
| FR-013 (axios mock global) | `cd Client && grep -r "import axios from 'axios'" src/` | Should return zero matches outside `src/api/` |
| FR-022 (idempotent seed) | `node Server/scripts/seed-e2e.js && node Server/scripts/seed-e2e.js` | Both runs print the same summary line; exit 0 |
| FR-022a (storageState auth) | `npx playwright test --debug e2e/ordering.spec.ts` | Spec opens with the user already authenticated; no login form is visible |
| FR-026 (CI workflow) | Push to a feature branch | Actions tab shows the workflow running with the three suites |
| FR-028 (hermetic) | Disconnect from internet, run `npm run test:all` (skip Playwright if MongoDB is unreachable) | Jest + Vitest pass green |
| FR-029 (no runtime deps) | `git diff main -- Server/package.json Client/package.json | grep -E '^\+' | grep -v devDependencies` | Empty — no production-dep additions |

---

## Common failures and fixes

**Jest hangs on `MongoMemoryServer.create()`**:
- First run is downloading the binary; wait up to 60 s.
- Behind a corporate proxy: set `MONGOMS_DOWNLOAD_URL` per `mongodb-memory-server` docs.
- On CI: ensure the cache step ran successfully.

**Vitest reports `vi.mock('../api/axios')` did not match the import path**:
- Verify the test file imports the page from `../../pages/...` and the page imports from `../api/axios`. Vitest mocks by *resolved path*, so the path in `vi.mock(...)` must resolve to the same module the test indirectly loads.

**Playwright spec passes locally but fails in CI**:
- 90% of the time it's a missing `await page.waitForLoadState('networkidle')` after a navigation. Local machines are fast enough to mask the race.
- Use `--debug` flag locally to step through.

**Coverage threshold passes locally but fails in CI**:
- Different Node versions can produce slightly different v8 coverage counts on conditional branches. Pin `engines.node` in `Server/package.json` to a single major version (already 18+).

---

## Out-of-scope (deferred)

- Mutation testing (Stryker) — not run.
- Visual regression screenshots — not run.
- axe-core accessibility audit — not run.
- Cross-browser matrix (firefox, webkit) — not run.
- Python ML service `pytest` suite — separate feature.

These are intentionally not gated by this quickstart; they belong to a future hardening phase.
