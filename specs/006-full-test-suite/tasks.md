# Tasks: Full Test Suite (Production-Grade Coverage)

**Input**: Design documents from `/specs/006-full-test-suite/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (all present)

**Tests**: This feature *is* a test suite — every implementation task creates a test file or test infrastructure. There is no separate "Tests for User Story X" sub-section because the user stories *are* the test work.

**Authoring intent**: This file is written so a smaller / cheaper LLM model can implement each task without further clarification. Code snippets are near-copy-paste-ready. Every task names exact file paths, exact identifiers, and the FRs it satisfies. When two tasks change the same file, the tasks are kept **sequential** (no `[P]` marker) to avoid merge confusion. Where 6+ test files share an identical structure (e.g. one-test-per-page), the first task spells out the full template and subsequent tasks reference it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks).
- **[Story]**: Maps to user stories US1, US2, US3, US4 from spec.md.
- File paths are repository-relative (e.g. `Server/__tests__/...`).

## Path Conventions

- Backend tests: `Server/__tests__/...` (Jest, CommonJS, `require/module.exports`).
- Frontend tests: `Client/src/__tests__/...` (Vitest, ESM, `import/export`).
- E2E tests: `e2e/...` at the repository root (Playwright, TypeScript).
- Helper paths: `Server/__tests__/helpers/`, `Client/src/test/`.
- Production source code: `Server/src/...`, `Client/src/...` — **must not be modified** unless a task explicitly says so (FR-030).

## Codebase facts the implementer must respect

- `Server/` uses **CommonJS**. Use `require(...)` / `module.exports`. Do NOT add `"type": "module"` to `Server/package.json`.
- `Client/` uses **ESM** (`"type": "module"` in `Client/package.json`). Use `import` / `export`. Vitest config and tests are ESM.
- The repo-root `package.json` is **NEW** in this feature; it is created in T021.
- `Server/jest.setup.js` already injects `JWT_SECRET='test-jwt-secret'`, `OPENAI_API_KEY='test-openai-key'`, `ML_SERVICE_URL='http://localhost:5002/v1'`, `HANDLE_SALT='test-handle-salt'`. Do not duplicate these.
- The existing `Server/__tests__/helpers/test-app.js` is preserved (legacy specs use it). New tests use the new helpers from Phase 2.
- Today's existing test files in `Server/__tests__/services/` and `Server/__tests__/api/` are KEPT (not deleted). New tasks only ADD files unless explicitly stated.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install devDependencies, add config files, fix `.gitignore`. No tests yet.

- [ ] T001 Add backend test devDependencies. Edit `Server/package.json`'s `devDependencies` block to include exactly:
  ```json
  "nock": "^13.5.4",
  "cross-env": "^7.0.3"
  ```
  Then run `cd Server && npm install`. Verify `npm ls nock cross-env` resolves both. Do NOT add anything else. **Satisfies FR-007, FR-029.**

- [ ] T002 [P] Add frontend test devDependencies. Edit `Client/package.json`'s `devDependencies` block to include exactly:
  ```json
  "vitest": "^2.1.4",
  "@vitest/coverage-v8": "^2.1.4",
  "@testing-library/react": "^16.0.1",
  "@testing-library/user-event": "^14.5.2",
  "@testing-library/jest-dom": "^6.6.3",
  "jsdom": "^25.0.1"
  ```
  Then add three scripts to the same `package.json` `scripts` block:
  ```json
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
  ```
  Run `cd Client && npm install`. Verify with `npm ls vitest @testing-library/react`. **Satisfies FR-011, FR-029.**

- [ ] T003 [P] Create the repo-root `package.json` for Playwright (NEW file). Path: `package.json` (repo root, **not** `Client/` or `Server/`). Content:
  ```json
  {
    "name": "smart-restaurant-e2e",
    "private": true,
    "version": "1.0.0",
    "scripts": {
      "test:e2e": "playwright test",
      "test:e2e:ui": "playwright test --ui",
      "test:e2e:report": "playwright show-report",
      "test:all": "npm --prefix Server test && npm --prefix Client test && playwright test"
    },
    "devDependencies": {
      "@playwright/test": "^1.48.2",
      "@types/node": "^20.17.6",
      "dotenv": "^16.4.5"
    }
  }
  ```
  Then run `npm install` from the repo root, then `npx playwright install chromium`. Verify `npx playwright --version`. **Satisfies FR-020, FR-025, FR-029.**

- [ ] T004 [P] Update `.gitignore` to add (append at end if not already present):
  ```
  # Test artifacts (feature 006)
  auth.json
  Server/coverage/
  Client/coverage/
  playwright-report/
  test-results/
  ```
  Verify by running `git check-ignore -v auth.json` after creating an empty `auth.json` for the test (then delete the empty file). **Satisfies FR-022a (auth.json not committed).**

- [ ] T005 Replace `Server/jest.config.js` content with the production-grade config below. Keep CommonJS (no ESM flags). **Satisfies FR-002, FR-003.**
  ```js
  // CommonJS project — no ESM flags. Existing src/ uses require/module.exports.
  module.exports = {
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/jest.setup.js'],
    testMatch: ['**/__tests__/**/*.test.js'],
    testPathIgnorePatterns: ['/node_modules/', '/__tests__/helpers/', '/__tests__/fixtures/'],
    collectCoverageFrom: [
      'src/application/services/**/*.js',
      'src/interfaces/controllers/**/*.js',
      'src/routes/**/*.js',
      'src/middlewares/**/*.js',
      'src/application/validations/**/*.js',
      'src/domain/models/**/*.js',
      'src/infrastructure/csv/**/*.js'
    ],
    coveragePathIgnorePatterns: [
      '/node_modules/',
      // Add exclusions here only with a comment explaining why.
    ],
    coverageThreshold: {
      global: { lines: 80, branches: 80, functions: 80, statements: 80 }
    },
    coverageReporters: ['text', 'lcov', 'html'],
    testTimeout: 20000,
    clearMocks: true
  };
  ```
  Add `"test:coverage": "cross-env NODE_ENV=test jest --coverage"` to `Server/package.json` scripts (cross-env makes it Windows-friendly).

- [ ] T006 Update `Server/jest.setup.js`. Append (do NOT delete the existing env-var injections). **Satisfies FR-007 / FR-028 safety net.**
  ```js
  // Network safety net — every outbound HTTP must be explicitly mocked.
  const nock = require('nock');
  nock.disableNetConnect();
  nock.enableNetConnect('127.0.0.1');     // Supertest loopback
  nock.enableNetConnect('localhost');

  afterEach(() => {
    nock.cleanAll();
  });
  ```
  Note: `afterEach` here is a *global* hook — Jest runs it after every `test(...)` in every file.

- [ ] T007 [P] Create `Client/vitest.config.js` (NEW file, separate from `vite.config.js`). Content per `contracts/vitest-axios-mock.md` "Vitest config" section. Reproduced here:
  ```js
  import { defineConfig } from 'vitest/config';
  import react from '@vitejs/plugin-react';

  export default defineConfig({
    plugins: [react()],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
      include: ['src/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov', 'html'],
        include: ['src/**/*.{js,jsx}'],
        exclude: [
          'src/test/**',
          'src/__tests__/**',
          'src/main.jsx',
          'src/App.jsx',
          'src/api/**',
          'src/img/**',
          'src/styles/**'
        ],
        thresholds: {
          lines: 75, branches: 75, functions: 75, statements: 75,
          'src/pages/**': { lines: 80, branches: 80, functions: 80, statements: 80 },
          'src/components/**': { lines: 80, branches: 80, functions: 80, statements: 80 }
        }
      }
    }
  });
  ```
  **Satisfies FR-012.**

**Checkpoint**: `cd Server && npm test` still passes (existing tests). `cd Client && npm test` runs Vitest with zero test files (passes vacuously). `npx playwright --version` works.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the test-helper toolkit that **every** test in US1, US2, US3 depends on.

**⚠️ CRITICAL**: No user-story phase work can begin until this phase is complete.

### Backend helpers

- [ ] T008 Create directory `Server/__tests__/helpers/` (already exists; just verify). The existing `test-app.js` stays.

- [ ] T009 [P] Create `Server/__tests__/helpers/inMemoryMongo.js`. Content per `contracts/test-helpers.md` `withInMemoryMongo`. Reproduced:
  ```js
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mongoose = require('mongoose');

  let mongoServer;

  function withInMemoryMongo({ dropBetween = true } = {}) {
    beforeAll(async () => {
      mongoServer = await MongoMemoryServer.create();
      await mongoose.connect(mongoServer.getUri());
    });

    afterEach(async () => {
      if (!dropBetween) return;
      const collections = mongoose.connection.collections;
      for (const key of Object.keys(collections)) {
        await collections[key].deleteMany({});
      }
    });

    afterAll(async () => {
      try {
        await mongoose.disconnect();
      } finally {
        if (mongoServer) await mongoServer.stop();
      }
    });
  }

  module.exports = { withInMemoryMongo };
  ```
  **Satisfies FR-001, FR-008.**

- [ ] T010 [P] Create `Server/__tests__/helpers/seedUser.js`. **Satisfies FR-008.**
  ```js
  const User = require('../../src/domain/models/User');

  function randomId() {
    return Math.random().toString(36).slice(2, 8);
  }

  async function seedUser({
    role = 'staff',
    email,
    password = 'TestPass!23',
    status = 'active',
    name,
    ...overrides
  } = {}) {
    const finalEmail = email || `${role}-${randomId()}@test.local`;
    const finalName = name || `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`;
    const user = new User({
      email: finalEmail,
      password,           // hashed by pre-save hook
      role,
      status,
      name: finalName,
      ...overrides
    });
    await user.save();
    return user;
  }

  module.exports = { seedUser };
  ```
  Note: this helper assumes `User` has a pre-save bcrypt hook. If the implementer finds the User model has a different password field name, adjust accordingly.

- [ ] T011 [P] Create `Server/__tests__/helpers/mintToken.js`. **Satisfies FR-008.**
  ```js
  const jwt = require('jsonwebtoken');

  function mintToken(user, { ttl = '1h' } = {}) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not set');
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0
    };
    return jwt.sign(payload, secret, { expiresIn: ttl });
  }

  module.exports = { mintToken };
  ```
  Important: `process.env.JWT_SECRET` is read at *call* time, not at import time. Do not capture it in a module-level `const`.

- [ ] T012 [P] Create `Server/__tests__/helpers/authedRequest.js`. **Satisfies FR-008.**
  ```js
  const request = require('supertest');
  const { mintToken } = require('./mintToken');

  function authedRequest(app, user) {
    const token = mintToken(user);
    const agent = request.agent(app);
    agent.set('Authorization', `Bearer ${token}`);
    return agent;
  }

  module.exports = { authedRequest };
  ```

- [ ] T013 [P] Create `Server/__tests__/helpers/mockOpenAI.js`. **Satisfies FR-006.**
  ```js
  // Use jest.mock at the call site (Jest hoists). This helper just builds the stub factory.

  const defaultRecipeResponse = {
    choices: [{
      message: {
        content: JSON.stringify({
          name: 'Test Recipe',
          ingredients: ['ingredient-a', 'ingredient-b'],
          steps: ['step 1', 'step 2'],
          estimated_cost: 5.0,
          suggested_price: 12.0,
          profit_margin: 0.58
        })
      }
    }]
  };

  function buildOpenAIMock({ recipeResponse, shouldThrow = false, errorMessage = 'OpenAI rate limit exceeded' } = {}) {
    const mockCreate = jest.fn(() => {
      if (shouldThrow) return Promise.reject(new Error(errorMessage));
      return Promise.resolve(recipeResponse || defaultRecipeResponse);
    });
    return { mockCreate };
  }

  module.exports = { buildOpenAIMock, defaultRecipeResponse };
  ```
  Usage in a test file:
  ```js
  const { buildOpenAIMock } = require('../helpers/mockOpenAI');
  const { mockCreate } = buildOpenAIMock();
  jest.mock('openai', () => ({
    default: class { constructor() { this.chat = { completions: { create: mockCreate } }; } }
  }));
  ```

- [ ] T014 [P] Create `Server/__tests__/helpers/mlServiceStub.js`. **Satisfies FR-007.**
  ```js
  const nock = require('nock');

  function withMlServiceStub({
    route = '/predict-sales',
    method = 'POST',
    status = 200,
    response = { forecast: [{ date: '2026-05-04', predicted_quantity: 10 }] }
  } = {}) {
    const url = process.env.ML_SERVICE_URL;
    if (!url) throw new Error('ML_SERVICE_URL not set');
    const scope = nock(url)[method.toLowerCase()](route).reply(status, response);
    return scope;
  }

  module.exports = { withMlServiceStub };
  ```

### Frontend helpers

- [ ] T015 [P] Create `Client/src/test/setup.js`. Content per `contracts/vitest-axios-mock.md`. **Satisfies FR-013.**
  ```js
  import '@testing-library/jest-dom';
  import { afterEach, vi } from 'vitest';
  import { cleanup } from '@testing-library/react';

  // Default mock: any unmocked HTTP fails immediately.
  vi.mock('../api/axios', () => ({
    default: {
      get: vi.fn(() => Promise.reject(new Error('axios.get unmocked'))),
      post: vi.fn(() => Promise.reject(new Error('axios.post unmocked'))),
      patch: vi.fn(() => Promise.reject(new Error('axios.patch unmocked'))),
      put: vi.fn(() => Promise.reject(new Error('axios.put unmocked'))),
      delete: vi.fn(() => Promise.reject(new Error('axios.delete unmocked')))
    }
  }));

  // Polyfill matchMedia (jsdom does not implement it; Recharts/ThemeContext probe it).
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });

  // Polyfill ResizeObserver (Recharts depends on it).
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });
  ```

- [ ] T016 [P] Create `Client/src/test/render.jsx`. **Satisfies FR-014's required provider tree.**
  ```jsx
  import React from 'react';
  import { render } from '@testing-library/react';
  import userEvent from '@testing-library/user-event';
  import { MemoryRouter, Routes, Route } from 'react-router-dom';
  import { AuthProvider } from '../context/AuthContext';
  import { ThemeProvider } from '../context/ThemeContext';
  import { ToastProvider } from '../components/toast/ToastContext';

  export function renderWithProviders(ui, {
    authUser = null,
    theme = 'light',
    initialRoute = '/',
    routes,
    ...renderOptions
  } = {}) {
    function Wrapper({ children }) {
      return (
        <MemoryRouter initialEntries={[initialRoute]}>
          <AuthProvider initialUser={authUser}>
            <ThemeProvider initialTheme={theme}>
              <ToastProvider>
                {routes
                  ? <Routes>{routes}{<Route path="*" element={children} />}</Routes>
                  : children}
              </ToastProvider>
            </ThemeProvider>
          </AuthProvider>
        </MemoryRouter>
      );
    }
    const user = userEvent.setup();
    return { user, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
  }
  ```
  **Implementer note**: If `AuthProvider`/`ThemeProvider`/`ToastProvider` don't accept `initialUser`/`initialTheme` props, either (a) add the prop in the production component (small refactor under FR-030 — preserve existing default behavior), or (b) wrap with a `useEffect` that calls the provider's exposed setter (e.g. `setUser(authUser)`) on mount. Pick whichever requires the smaller diff in production code; document the choice in a one-line comment in `render.jsx`.

- [ ] T017 [P] Create `Client/src/test/fixtures.js`. Content per `contracts/vitest-axios-mock.md` `fixtures.js` section (mockUser, mockStaffUser, mockIngredient, mockDish, mockOrder, mockNotification, mockRecipe). **Satisfies FR-014.**

**Checkpoint**: All helpers import cleanly. Run `cd Server && npx jest --listTests` — should list existing tests. Run `cd Client && npx vitest --run --reporter=verbose` — should pass with zero tests.

---

## Phase 3: User Story 1 — Backend Service & API Coverage (Priority: P1)

**Goal**: Raise backend Jest + Supertest coverage to ≥80% global lines/branches/functions/statements covering all of `Server/src/application/services/`, `src/interfaces/controllers/`, `src/routes/`, `src/middlewares/`, `src/application/validations/`, `src/domain/models/`, `src/infrastructure/csv/`.

**Independent Test**: `cd Server && npm run test:coverage` — green, with global ≥80% gate enforced.

### Service tests (extend existing + add missing)

The existing files at `Server/__tests__/services/` are KEPT. Tasks below add new files OR extend existing ones.

- [ ] T018 [P] [US1] Create `Server/__tests__/services/notification.service.test.js`. Cover `Server/src/application/services/notification.service.js`. Test cases:
  - `createAlert(type, title, message, targetRole, relatedEntity?)` writes a Notification document with the given fields and `read: false, createdAt: <now>`.
  - `markRead(id)` sets `read: true` and `readAt` to a Date.
  - `getUnread('admin')` returns `{ count, items }` where `items.length <= 20` and only unread `targetRole='admin'` notifications are returned.
  - `getUnread('staff')` excludes admin-only notifications.
  - Calling `createAlert` with an invalid `type` throws (validator).
  Use `withInMemoryMongo()` from helpers. **Satisfies FR-001, FR-004.**
  Skeleton:
  ```js
  const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
  const notificationService = require('../../src/application/services/notification.service');
  const Notification = require('../../src/domain/models/Notification');

  describe('Notification Service', () => {
    withInMemoryMongo();

    test('createAlert persists a notification', async () => {
      const alert = await notificationService.createAlert('low_stock', 'Low: Tomato', 'Below minStock', 'admin');
      expect(alert).toMatchObject({ type: 'low_stock', read: false, targetRole: 'admin' });
      const fromDb = await Notification.findById(alert._id);
      expect(fromDb).not.toBeNull();
    });
    // ...other cases
  });
  ```

- [ ] T019 [P] [US1] Create `Server/__tests__/services/customer.service.test.js`. Cover `Server/src/application/services/customer.service.js`. Test cases:
  - `findOrCreate({ phone, name })` returns existing customer when phone matches; creates a new one otherwise.
  - `addToOrderHistory(customerId, orderId)` pushes the orderId to `orderHistory` array.
  - `addFavorite(customerId, dishId)` adds dishId to `favorites` if absent; idempotent.
  Use `withInMemoryMongo()`. **Satisfies FR-004.**

- [ ] T020 [P] [US1] Create `Server/__tests__/services/sales.service.test.js`. Cover `Server/src/application/services/sales.service.js`. Test cases:
  - `getDailyReport({ date })` returns `{ totalRevenue, orderCount, popularDishes }` for the given day.
  - `getWeeklyReport({ weekOf })` aggregates 7 days correctly.
  - `getMonthlyReport({ month, year })` aggregates all orders in the month.
  - `popularDishes` array is sorted by quantity descending.
  Seed orders via Mongoose insertions in `beforeEach`. Use `withInMemoryMongo()`. **Satisfies FR-004.**

- [ ] T021 [P] [US1] Create `Server/__tests__/services/etl.service.test.js`. Cover `Server/src/application/services/etl.service.js`. Test cases:
  - `getForecastingData()` returns array of `{ ds, y, dish_id }` shape suitable for Prophet.
  - `getWasteAnalytics()` returns `{ byIngredient, byCategory, totalThisMonth, trendDaily }` with the expected structure.
  - Empty database returns empty arrays / zero totals (no exceptions).
  Use `withInMemoryMongo()`. **Satisfies FR-004.**

- [ ] T022 [P] [US1] Create `Server/__tests__/services/pos.service.test.js`. Cover `Server/src/application/services/pos.service.js`. Test cases:
  - Whatever public methods `pos.service.js` exposes (read the file first, then write tests). Cover the happy path and one error path per method.
  Use `withInMemoryMongo()`. **Satisfies FR-004.**

- [ ] T023 [P] [US1] Create `Server/__tests__/services/inventory.service.full.test.js`. Cover the rest of `Server/src/application/services/inventory.service.js` not covered by the existing `inventory.service.getById.test.js`. Test cases:
  - `create({ name, quantity, unit, ... })` persists and returns the new ingredient.
  - `update(id, fields)` updates the named fields and returns the updated document.
  - `delete(id)` removes the document.
  - `list()` returns all ingredients.
  - `getLowStock()` returns ingredients where `quantity < minStock`.
  - `getNearExpiry({ days = 3 })` returns ingredients expiring within `days`.
  - `recordWaste(id, quantity)` decrements `quantity` and increments `wasteQuantity`. Throws when `quantity > onHand`.
  - `checkReorderPoints()` returns or notifies for items below threshold (verify against the actual function shape).
  Use `withInMemoryMongo()`. **Satisfies FR-004.**

- [ ] T024 [P] [US1] Create `Server/__tests__/services/order.service.full.test.js`. Cover the rest of `Server/src/application/services/order.service.js` not covered by existing `order.service.integrity.test.js`. Test cases:
  - `create({ items, source, paymentMethod, customerId? })` persists order, returns the new doc.
  - Creating an order **decrements ingredients** referenced by the dish recipes (the side effect mandated by FR-009). Verify by querying `Ingredient` directly after the call.
  - `cancel(id)` flips status to `cancelled` and **returns the deducted ingredients** to inventory (FR-009 inverse).
  - `updateStatus(id, status)` validates the status transition and persists it.
  - `delete(id)` removes the order.
  - **Side-effect: low_stock notification.** When `create` drives an ingredient below `minStock`, a `low_stock` notification document is created (FR-010). Verify by querying `Notification`.
  Use `withInMemoryMongo()`. **Satisfies FR-004, FR-009, FR-010.**

- [ ] T025 [P] [US1] Create `Server/__tests__/services/auth.service.full.test.js`. Cover the rest of `Server/src/application/services/auth.service.js` not covered by the existing `auth.service.test.js`. Verify whichever methods aren't already tested: `register`, `login`, `getMe`, `updateProfile`, `updatePassword`. Pay special attention to:
  - `login` returns a JWT and rejects on bad credentials.
  - `updatePassword` verifies the current password via bcrypt before hashing the new one.
  - `updateProfile` rejects an `email` change to an email already taken.
  Use `withInMemoryMongo()`. **Satisfies FR-004.**

### API integration tests (extend existing + add missing)

- [ ] T026 [P] [US1] Create `Server/__tests__/api/notifications.test.js`. Mount `notification.routes.js` on a fresh Express app, run through the helpers (`buildTestApp` already exists, but for *real-auth* tests, build a Express app inline with `require('../../src/middlewares/auth.middleware')` then mount the route). Test cases:
  - `GET /api/notifications` (admin) returns list.
  - `GET /api/notifications/unread-count` returns `{ count }`.
  - `PATCH /api/notifications/:id/read` flips read.
  - `PATCH /api/notifications/read-all` flips all.
  - **No token → 401** for every route.
  - **Wrong role → 403** if the route is admin-only (read the route file to confirm).
  Use `seedUser` + `authedRequest`. **Satisfies FR-005.**

- [ ] T027 [P] [US1] Create `Server/__tests__/api/customers.test.js`. Cover `customer.routes.js`. CRUD + `GET /api/customers/:id/recommendations`. 401/403 matrix. **Satisfies FR-005.**

- [ ] T028 [P] [US1] Create `Server/__tests__/api/sales.test.js`. Cover `sales.routes.js`. Period filter (`?period=daily|weekly|monthly`) + response shape. 401/403 matrix. **Satisfies FR-005.**

- [ ] T029 [P] [US1] Create `Server/__tests__/api/dashboard.test.js`. Cover `dashboard.routes.js`. Response shape includes ETL data per `etl.service.test.js`. 401/403 matrix. **Satisfies FR-005.**

- [ ] T030 [P] [US1] Create `Server/__tests__/api/etl.test.js`. Extend the existing `etl.smoke.test.js` to a full route-level test. Pipeline trigger + output shape. 401/403 matrix. **Satisfies FR-005.**

- [ ] T031 [P] [US1] Create `Server/__tests__/api/recommendation.full.test.js`. Cover any recommendation routes not exercised by the existing `recommendation.service.test.js`. 401/403 matrix. **Satisfies FR-005.**

- [ ] T032 [P] [US1] Create `Server/__tests__/api/endorsement.test.js`. Cover `endorsement.routes.js`. CRUD + 401/403 matrix. **Satisfies FR-005.**

- [ ] T033 [P] [US1] Create `Server/__tests__/api/menu.crud.test.js`. Cover `menu.routes.js` CRUD operations. **Critical**: the admin-only restriction matrix — staff token gets 403 on POST/PUT/DELETE; admin gets 201/200. The existing `menu.validation.test.js` already covers Joi validation; this task covers the auth/role surface. **Satisfies FR-005.**

- [ ] T034 [P] [US1] Create `Server/__tests__/api/orders.full.test.js`. Cover `order.routes.js`. CRUD + side effects (ingredient decrement on create — verify by querying DB after request) + cancellation return. 401/403 matrix. **Satisfies FR-005, FR-009.**

- [ ] T035 [P] [US1] Create `Server/__tests__/api/inventory.full.test.js`. Cover `inventory.routes.js`. Full CRUD + low-stock + expiry + the existing CSV export (the existing `inventory.export.test.js` covers part). 401/403 matrix. **Satisfies FR-005.**

### Model tests (NEW directory)

- [ ] T036 Create directory `Server/__tests__/models/` (mkdir).

- [ ] T037 [P] [US1] Create `Server/__tests__/models/User.test.js`. Cover `Server/src/domain/models/User.js`. Test cases:
  - Saving a user with a plaintext password results in the stored `password` field being a bcrypt hash (`/^\$2[aby]?\$\d+\$/`).
  - Updating a user's password through `user.password = 'new'; await user.save()` re-hashes.
  - `role` enum rejects an unrecognized value.
  - `email` validator rejects malformed emails.
  - Saving with the same `email` twice throws a duplicate-key error.
  Use `withInMemoryMongo()`. **Satisfies FR-002.**

- [ ] T038 [P] [US1] Create `Server/__tests__/models/Order.test.js`. Cover `Server/src/domain/models/Order.js`. Test cases:
  - **Default `status` is `'pending'`** (the bug fix from feature 002 — assert this defensively).
  - Saving with an invalid `status` enum value throws.
  - The total / virtual field (if any) computes correctly.
  Use `withInMemoryMongo()`. **Satisfies FR-002.**

- [ ] T039 [P] [US1] Create `Server/__tests__/models/Ingredient.test.js`. Cover the Ingredient model. Test cases:
  - `quantity` must be ≥ 0.
  - `costPerUnit` must be ≥ 0.
  - `minStock` defaults to a sensible value (read the model to confirm).
  Use `withInMemoryMongo()`. **Satisfies FR-002.**

- [ ] T040 [P] [US1] Create `Server/__tests__/models/Dish.test.js`. Cover the Dish model. Test cases:
  - `price` must be ≥ 0.
  - `ingredients` array shape: each entry has `ingredient` (ObjectId) + `quantity` (Number).
  - `available` defaults to `true`.
  Use `withInMemoryMongo()`. **Satisfies FR-002.**

- [ ] T041 [P] [US1] Create `Server/__tests__/models/Customer.test.js`. Cover the Customer model. Test cases:
  - `phone` is required and unique (whatever the model's actual constraints are).
  - `orderHistory` defaults to empty array.
  - `favorites` defaults to empty array.
  Use `withInMemoryMongo()`. **Satisfies FR-002.**

- [ ] T042 [P] [US1] Create `Server/__tests__/models/Notification.test.js`. Cover the Notification model. Test cases:
  - `Notification.createAlert(...)` static method works (if defined as a static).
  - `read` defaults to `false`.
  - `targetRole` enum rejects a wrong role value.
  - `type` enum: `low_stock`, `expiry`, `reorder`, `spoilage_risk`, `system`.
  Use `withInMemoryMongo()`. **Satisfies FR-002.**

### Middleware tests (NEW directory)

- [ ] T043 Create directory `Server/__tests__/middleware/` (mkdir).

- [ ] T044 [P] [US1] Create `Server/__tests__/middleware/auth.test.js`. Cover `Server/src/middlewares/auth.middleware.js`. Test cases:
  - No `Authorization` header → 401 with descriptive message.
  - Malformed `Authorization` header (`Basic xxx` instead of `Bearer xxx`) → 401.
  - Expired JWT (mint with `ttl: '-1s'`) → 401.
  - Invalid signature (sign with wrong secret) → 401.
  - Valid token with admin role → calls next() with `req.user` populated.
  - Role guard rejects wrong role → 403.
  Build a tiny Express app inline that mounts the middleware then a `GET /test` returning `req.user`. **Satisfies FR-002, FR-005.**

- [ ] T045 [P] [US1] Create `Server/__tests__/middleware/validate.test.js`. Cover `Server/src/middlewares/validate.middleware.js`. Test cases:
  - Pass-through when body matches schema.
  - 400 with descriptive error when body fails schema.
  Use a simple Joi schema in the test (don't depend on production validation files). **Satisfies FR-002.**

### Validation tests

- [ ] T046 [P] [US1] Create `Server/__tests__/validations/auth.validation.test.js`. Cover `Server/src/application/validations/auth.validation.js` Joi schemas: `register`, `login`, `updateProfile`, `updatePassword`. Test happy + each documented branch (missing field, wrong type, password too short, etc.). No DB needed (pure schema tests). **Satisfies FR-002.**

- [ ] T047 [US1] Extend `Server/__tests__/validations/order.validation.test.js` (the existing `order.validation-pipeline.test.js` covers the pipeline). Add cases for: missing `items`, empty `items` array, invalid `paymentMethod` enum, invalid `source` enum, optional `customerId` accepted as ObjectId. **Satisfies FR-002.**

  *Note*: if the existing file is named `order.validation-pipeline.test.js`, do not rename. Add the new cases to it OR create a new sibling file `order.validation.schema.test.js`. Pick the path that requires the smaller diff.

### Cron tests

- [ ] T048 Create directory `Server/__tests__/cron/` (mkdir if not present).

- [ ] T049 [P] [US1] Create `Server/__tests__/cron/spoilage.cron.handler.test.js`. **CRITICAL**: this test exercises the *handler function*, not the cron schedule. Spawning a `node-cron` timer in a test is forbidden (it leaks beyond the test lifecycle). Pattern:
  ```js
  const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
  const { buildOpenAIMock } = require('../helpers/mockOpenAI');
  const { mockCreate } = buildOpenAIMock();
  jest.mock('openai', () => ({ default: class { constructor() { this.chat = { completions: { create: mockCreate } }; } } }));

  // Import the *handler*, NOT the file that schedules the cron.
  // If spoilage.cron.js exports both schedule + handler, refactor it to export `runOnce()` (handler) separately.
  // FR-030 allows this small refactor since it preserves cron behavior.
  const { runOnce } = require('../../src/infrastructure/cron/spoilage.cron');

  describe('Spoilage cron handler', () => {
    withInMemoryMongo();

    test('creates spoilage_risk notification when ingredients are near expiry', async () => {
      // seed near-expiry ingredients
      // call runOnce()
      // assert Notification.find({ type: 'spoilage_risk' }) is non-empty
    });
  });
  ```
  Implementer note: if `spoilage.cron.js` doesn't already export `runOnce`, add the export — production behavior unchanged.

### Coverage gate verification

- [ ] T050 [US1] Run `cd Server && npm run test:coverage`. Read the table. Identify any file with `< 80%` lines/branches/functions/statements. For each gap, add the minimal additional test cases needed to reach 80%. Iterate until the global gate is green. **Satisfies FR-003.**

- [ ] T051 [US1] Verify SC-008 (no real network): from `Server/`, run `npm test` after temporarily setting `OPENAI_API_KEY=` empty: `cross-env OPENAI_API_KEY= npm test`. Suite must remain green. **Satisfies FR-006, FR-028, SC-011.**

**Checkpoint US1**: `cd Server && npm run test:coverage` exits 0 with global lines/branches/functions/statements all ≥80%. Every service file has at least one test file. Every controller is exercised by at least one Supertest call. Every covered Mongoose model has at least one model-level test. SC-001, SC-004, SC-005, SC-008, SC-011 all verifiable.

---

## Phase 4: User Story 2 — Frontend Component & Page Coverage (Priority: P1)

**Goal**: Stand up Vitest + RTL coverage for every page and every cross-cutting component.

**Independent Test**: `cd Client && npm run test:coverage` — green, with global ≥75% / pages-and-components ≥80% gates enforced.

### Reference template — page test pattern

The 18 page-test tasks below all follow the same structure. T052 is the verbose template; T053–T069 reference it.

- [ ] T052 [US2] Create `Client/src/__tests__/pages/auth/Login.test.jsx`. Full template (read carefully — every other page test follows this pattern):
  ```jsx
  import { describe, test, expect, vi } from 'vitest';
  import { screen, waitFor } from '@testing-library/react';
  import axios from '../../../api/axios';
  import { renderWithProviders } from '../../../test/render';
  import { mockUser } from '../../../test/fixtures';
  import Login from '../../../pages/auth/Login';

  describe('Login page', () => {
    test('renders the login form', () => {
      renderWithProviders(<Login />);
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in|login/i })).toBeInTheDocument();
    });

    test('submits credentials and updates auth on success', async () => {
      vi.mocked(axios.post).mockResolvedValueOnce({
        data: { token: 'fake-jwt', user: mockUser }
      });
      const { user } = renderWithProviders(<Login />);
      await user.type(screen.getByLabelText(/email/i), 'admin@test.local');
      await user.type(screen.getByLabelText(/password/i), 'password');
      await user.click(screen.getByRole('button', { name: /sign in|login/i }));
      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(
          expect.stringMatching(/auth\/login/),
          expect.objectContaining({ email: 'admin@test.local', password: 'password' })
        );
      });
    });

    test('shows error on bad credentials', async () => {
      vi.mocked(axios.post).mockRejectedValueOnce({
        response: { status: 401, data: { message: 'Invalid credentials' } }
      });
      const { user } = renderWithProviders(<Login />);
      await user.type(screen.getByLabelText(/email/i), 'wrong@test.local');
      await user.type(screen.getByLabelText(/password/i), 'wrong');
      await user.click(screen.getByRole('button', { name: /sign in|login/i }));
      expect(await screen.findByText(/invalid credentials|wrong/i)).toBeInTheDocument();
    });
  });
  ```
  **Satisfies FR-014.**

- [ ] T053 [P] [US2] `Client/src/__tests__/pages/auth/Register.test.jsx`. Following T052 template. Cases: render fields, submit calls `axios.post('/auth/register', ...)`, error path. **Satisfies FR-014.**

- [ ] T054 [P] [US2] `Client/src/__tests__/pages/Dashboard.test.jsx`. Cases: renders stat cards with mocked `axios.get('/dashboard')` payload, at least one chart in DOM (assert presence of an SVG or a Recharts container), error state when API rejects. **Satisfies FR-014.**

- [ ] T055 [P] [US2] `Client/src/__tests__/pages/Inventory.test.jsx`. Cases: renders ingredient rows from mocked `/inventory` GET, search filter narrows visible rows, **Export** button is present, clicking edit opens the modal (or whatever the existing flow is — read the page first), error path. **Satisfies FR-014.**

- [ ] T056 [P] [US2] `Client/src/__tests__/pages/InventoryDetail.test.jsx`. Cases: renders detail for the ingredient ID in the URL (use `initialRoute='/inventory/:id'` + `routes` override), error path when not found. **Satisfies FR-014.**

- [ ] T057 [P] [US2] `Client/src/__tests__/pages/OrderingSystem.test.jsx`. Cases: renders dishes from `/menu`, adding to basket updates state, checkout calls `/orders` POST, success and error paths. **Satisfies FR-014.**

- [ ] T058 [P] [US2] `Client/src/__tests__/pages/OrderDetail.test.jsx`. Cases: renders order detail, status update calls `/orders/:id` PATCH, error path. **Satisfies FR-014.**

- [ ] T059 [P] [US2] `Client/src/__tests__/pages/Sales.test.jsx`. Cases: renders period toggle, switching the toggle re-fetches sales data (`/sales?period=...`), chart renders. **Satisfies FR-014.**

- [ ] T060 [P] [US2] `Client/src/__tests__/pages/Report.test.jsx`. Cases: renders the report content area inside `<div id="report-content">`, **Export PDF** button is present and clickable. (Don't actually test jspdf rendering — that's e2e territory; just assert the click handler is wired.) **Satisfies FR-014.**

- [ ] T061 [P] [US2] `Client/src/__tests__/pages/Setting.test.jsx`. Cases: renders profile form fields (`name`, `phone`, `avatar`), submits PATCH `/auth/update-profile`, dark-mode toggle flips `document.documentElement.dataset.theme` and writes `localStorage.theme` (covers FR-018 inline). Password form is rendered with three fields. **Satisfies FR-014, FR-018.**

- [ ] T062 [P] [US2] `Client/src/__tests__/pages/Recipes.test.jsx`. Cases: clicking **Generate** calls `axios.post('/ai/recipe', ...)`, recipe card renders with returned name and ingredients (use `mockRecipe` from fixtures), error path. **Satisfies FR-014.**

- [ ] T063 [P] [US2] `Client/src/__tests__/pages/Recommendation.test.jsx`. Cases: renders cards for the mocked recommendation payload, role-based variants if any. **Satisfies FR-014.**

- [ ] T064 [P] [US2] `Client/src/__tests__/pages/CustomerManagement.test.jsx`. Cases: renders customer table from mocked `/customers`, opening a customer drawer fetches details + recommendations, error path. **Satisfies FR-014.**

- [ ] T065 [P] [US2] `Client/src/__tests__/pages/WasteManagement.test.jsx`. Cases: renders waste analytics charts and "Use in Recipe" button, clicking "Use in Recipe" calls `/ai/recipe`. **Satisfies FR-014.**

- [ ] T066 [P] [US2] `Client/src/__tests__/pages/admin/MenuManagement.test.jsx`. Cases: admin sees the page, staff is redirected (covered indirectly by ProtectedRoute test), CRUD modal opens, dish creation calls `/menu` POST. **Satisfies FR-014.**

- [ ] T067 [P] [US2] `Client/src/__tests__/pages/admin/UserManagement.test.jsx`. Cases: renders user list, role dropdown change calls PATCH, approve/reject buttons appear only on `pending` users. **Satisfies FR-014.**

- [ ] T068 [P] [US2] `Client/src/__tests__/pages/ai/DemandForecast.test.jsx`. Cases: dish selector, period toggle, mocked `/ai/demand` response renders chart and table, demand-spike banner appears when one ingredient's forecast exceeds 30% over its average. **Satisfies FR-014.**

- [ ] T069 [P] [US2] `Client/src/__tests__/pages/ai/DynamicPricing.test.jsx`. Cases: pricing cards render, **Apply** button calls PUT `/menu/:id`, bulk apply iterates, confirmation modal appears. **Satisfies FR-014.**

### Component tests

- [ ] T070 [P] [US2] `Client/src/__tests__/components/Sidebar.test.jsx`. Cases: links render, active route shows active styling, role-gated links visible only for admin. **Satisfies FR-014.**

- [ ] T071 [P] [US2] `Client/src/__tests__/components/Navbar.test.jsx`. Cases: renders user name from `useAuth().user`, name updates when AuthContext changes (re-render with new authUser). **Satisfies FR-014.**

- [ ] T072 [P] [US2] `Client/src/__tests__/components/notifications/NotificationBell.test.jsx`. Cases: badge shows the unread count from mocked `/notifications/unread-count`; clicking the bell renders dropdown with one row per notification; **Mark all read** calls `PATCH /notifications/read-all` and badge goes to 0. **Satisfies FR-019.**

- [ ] T073 [P] [US2] `Client/src/__tests__/components/toast/Toast.test.jsx`. Cases: `success` variant renders with green styling (`background-color: rgb(22, 163, 74)` or whichever the production value is); `error` variant red; auto-dismiss after configured duration using `vi.useFakeTimers()` + `vi.advanceTimersByTime(4000)`. **Satisfies FR-017.**

- [ ] T074 [P] [US2] `Client/src/__tests__/components/toast/ToastContext.test.jsx`. Cases: calling `useToast().success('hi')` renders a toast with role `alert` and text "hi"; multiple calls stack; calling on dismiss removes from list. **Satisfies FR-017.**

### Context tests

- [ ] T075 [P] [US2] `Client/src/__tests__/context/AuthContext.test.jsx`. Cases: default `user` is `null`; `setUser({...})` updates the value; consumers re-render. **Satisfies FR-014.**

- [ ] T076 [P] [US2] `Client/src/__tests__/context/ThemeContext.test.jsx`. Cases:
  - Default theme is `light`.
  - `toggleTheme()` flips `document.documentElement.dataset.theme` from `'light'` → `'dark'` and writes `localStorage.theme === 'dark'`.
  - Mounting fresh with `localStorage.theme === 'dark'` pre-applies dark theme on first paint (no light flash).
  **Satisfies FR-018.**

### Routes tests

- [ ] T077 [US2] `Client/src/__tests__/routes/ProtectedRoute.test.jsx`. Cases:
  - Unauthenticated user (`authUser: null`) navigating to `/dashboard` is redirected to `/login`.
  - `staff`-role user navigating to `/admin/users` is redirected away (assert UserManagement is NOT rendered).
  - `admin`-role user navigating to `/admin/users` sees the page.
  - The matrix runs for at least two protected paths.
  Use `routes` override in `renderWithProviders` so the component tree includes `<Routes>` mapping.
  **Satisfies FR-016.**

### Coverage gate verification

- [ ] T078 [US2] Run `cd Client && npm run test:coverage`. Identify any file < 75% global / < 80% in `pages/` or `components/`. Add minimal cases. Iterate until green. **Satisfies FR-012.**

- [ ] T079 [US2] SC-008 sanity: confirm the Vitest setup file's default axios rejection actually catches an unmocked HTTP. Pick any test file, comment out its `vi.mocked(axios.X).mockResolvedValue(...)` line, run that single test, confirm it fails with "axios.X unmocked". Restore the line. **Satisfies SC-008.**

**Checkpoint US2**: `cd Client && npm run test:coverage` exits 0 with global ≥75% and `pages/`+`components/` ≥80%. Every page has a test file. SC-002, SC-006, SC-008 verifiable.

---

## Phase 5: User Story 3 — End-to-End Smoke (Priority: P2)

**Goal**: Stand up Playwright E2E covering the 6 critical flows + 6 page smokes against a real running stack.

**Independent Test**: With `Server/` and `Client/` running locally and the seed script applied, `npx playwright test` runs all 12 specs green.

### Seed and config

- [ ] T080 [US3] Create `Server/scripts/seed-e2e.js` per `contracts/playwright-globalsetup.md` `Server/scripts/seed-e2e.js` section. The script MUST be idempotent (drop + re-insert). Verify by running it twice in a row — both runs print the same one-line summary. **Satisfies FR-022.**

- [ ] T081 [US3] Create `playwright.config.ts` at the repository root per `contracts/playwright-globalsetup.md` `playwright.config.ts` section. **Satisfies FR-020.**

- [ ] T082 [US3] Create `e2e/global-setup.ts` per `contracts/playwright-globalsetup.md` `e2e/global-setup.ts` section. **Satisfies FR-022a.**

- [ ] T083 [P] [US3] Create `e2e/fixtures/users.ts` exporting seed-user constants:
  ```ts
  export const SEED_ADMIN = { email: 'admin@e2e.local', password: 'AdminPass!23' };
  export const SEED_STAFF = { email: 'staff@e2e.local', password: 'StaffPass!23' };
  export const SEED_PENDING = { email: 'pending@e2e.local', password: 'PendPass!23' };
  ```

### Critical-flow specs (6)

- [ ] T084 [US3] Create `e2e/auth.spec.ts`. **This is the ONE spec that does not use the global storageState** — it tests the login UI itself. Override:
  ```ts
  import { test, expect } from '@playwright/test';
  import { SEED_STAFF } from './fixtures/users';

  test.use({ storageState: { cookies: [], origins: [] } });

  test('staff login → dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(SEED_STAFF.email);
    await page.getByLabel(/password/i).fill(SEED_STAFF.password);
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });
  ```
  **Satisfies FR-021, FR-022a.**

- [ ] T085 [P] [US3] Create `e2e/ordering.spec.ts`. Steps:
  1. Read the Margherita ingredient quantities BEFORE the order via `request.get('/api/inventory')` (using Playwright's request fixture).
  2. Navigate to `/ordering` (or whichever route POS lives at — read the routing in App.jsx).
  3. Add Margherita to cart, click checkout.
  4. Wait for success indicator.
  5. Read the same ingredients AFTER the order; assert each decreased by exactly the recipe quantity.
  **Satisfies FR-021, FR-023.**

- [ ] T086 [P] [US3] Create `e2e/ai.spec.ts`. Steps:
  1. Navigate to `/recipes`.
  2. Click **Generate** button.
  3. Wait for recipe card to appear (`page.getByRole('heading', { name: /recipe/i })` or similar — read the page first).
  4. Assert the card contains a name, an ingredients list (`page.getByRole('list')`), and steps.
  **Satisfies FR-021.**

- [ ] T087 [P] [US3] Create `e2e/users.spec.ts`. Steps:
  1. Navigate to `/admin/users`.
  2. Find the row for `pending@e2e.local`.
  3. Click **Approve**.
  4. Assert that user's status badge changes to `Active` without page reload (use `expect(badgeLocator).toHaveText('Active')`).
  **Satisfies FR-021.**

- [ ] T088 [P] [US3] Create `e2e/inventory.spec.ts`. Steps:
  1. Navigate to `/inventory`.
  2. Set up `page.waitForEvent('download')` BEFORE clicking export.
  3. Click **Export** button.
  4. Read the download via `download.createReadStream()` or `download.path()`.
  5. Assert the payload starts with the CSV header `name,quantity,unit,minStock,costPerUnit,expiryDate,wasteQuantity`.
  **Satisfies FR-021, FR-024.**

- [ ] T089 [P] [US3] Create `e2e/notifications.spec.ts`. Steps:
  1. Use Playwright's `request` fixture to drive an order through `/api/orders` that brings the seed Tomato (`quantity = 11`, `minStock = 10`) below threshold (deduct 2 units via order create).
  2. Navigate to any page with the Navbar visible.
  3. Wait for the notification poll cycle (`await page.waitForTimeout(31000)` is acceptable here — the polling interval is 30s; tests in CI may want a deterministic shortcut, but for graduation scope a single 31s wait is fine).
  4. Assert the bell badge is visible with count ≥ 1.
  5. Click the bell. Assert the dropdown contains a row with `low_stock` text.
  **Satisfies FR-021.**

### Page smokes (6)

Each smoke is the same pattern: navigate, assert no console error, assert no error boundary. Template (T090) followed by enumerations T091–T095.

- [ ] T090 [US3] Create `e2e/smoke/customers.spec.ts`. Template:
  ```ts
  import { test, expect } from '@playwright/test';

  test('CustomerManagement renders without errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/customers');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /customer/i })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
  ```
  **Satisfies FR-021.**

- [ ] T091 [P] [US3] `e2e/smoke/waste.spec.ts`. Goto `/waste`, assert heading + empty console errors. **Satisfies FR-021.**

- [ ] T092 [P] [US3] `e2e/smoke/menu-admin.spec.ts`. Goto `/admin/menu`, assert heading + empty console errors. **Satisfies FR-021.**

- [ ] T093 [P] [US3] `e2e/smoke/users-admin.spec.ts`. Goto `/admin/users`, assert heading + empty console errors. **Satisfies FR-021.**

- [ ] T094 [P] [US3] `e2e/smoke/forecast.spec.ts`. Goto `/ai/forecast`, assert heading + empty console errors. **Satisfies FR-021.**

- [ ] T095 [P] [US3] `e2e/smoke/pricing.spec.ts`. Goto `/ai/pricing`, assert heading + empty console errors. **Satisfies FR-021.**

### Verify suite

- [ ] T096 [US3] Run the full E2E sequence locally:
  1. Start MongoDB.
  2. `cd Server && MONGODB_URI=mongodb://localhost:27017/smart_restaurant_e2e npm start`.
  3. In another terminal: `cd Client && npm run dev`.
  4. In a third terminal: `npx playwright test`.
  5. Confirm all 12 specs pass.
  6. Run `npx playwright show-report` and visually inspect.
  **Satisfies SC-003, SC-007.**

- [ ] T097 [US3] SC-007 hygiene check: run `grep -rE "test\.(skip|fixme|only)" e2e/` from the repo root. Expected output: nothing. If any match exists, remove the marker. **Satisfies SC-007.**

**Checkpoint US3**: `npx playwright test` runs 12 specs green in < 5 min. SC-003, SC-007 verifiable.

---

## Phase 6: User Story 4 — One-Command CI (Priority: P3)

**Goal**: Single GitHub Actions workflow runs Jest → Vitest → Playwright on every push and PR. Median CI wall-clock < 10 min.

**Independent Test**: A push triggers the workflow; failed test = failed run.

- [ ] T098 [US4] Verify the repo-root `package.json` (created in T003) has the `test:all` script working. Run `npm run test:all` from the repo root locally with the dev stack running. Expected: Server Jest → Client Vitest → Playwright run sequentially; first failure exits non-zero. **Satisfies FR-025.**

- [ ] T099 [US4] Create `.github/workflows/test.yml`. Content:
  ```yaml
  name: Tests

  on:
    push:
    pull_request:

  jobs:
    test:
      runs-on: ubuntu-latest
      timeout-minutes: 15

      services:
        mongodb:
          image: mongo:6
          ports:
            - 27017:27017
          options: >-
            --health-cmd="mongosh --eval 'db.runCommand({ping:1})'"
            --health-interval=10s
            --health-timeout=5s
            --health-retries=5

      steps:
        - uses: actions/checkout@v4

        - name: Setup Node 18
          uses: actions/setup-node@v4
          with:
            node-version: '18'

        - name: Cache Server node_modules
          uses: actions/cache@v4
          with:
            path: Server/node_modules
            key: server-${{ hashFiles('Server/package-lock.json') }}

        - name: Cache Client node_modules
          uses: actions/cache@v4
          with:
            path: Client/node_modules
            key: client-${{ hashFiles('Client/package-lock.json') }}

        - name: Cache root node_modules
          uses: actions/cache@v4
          with:
            path: node_modules
            key: root-${{ hashFiles('package-lock.json') }}

        - name: Cache mongodb-memory-server binary
          uses: actions/cache@v4
          with:
            path: ~/.cache/mongodb-binaries
            key: mms-${{ runner.os }}

        - name: Cache Playwright browsers
          uses: actions/cache@v4
          with:
            path: ~/.cache/ms-playwright
            key: pw-${{ runner.os }}-${{ hashFiles('package-lock.json') }}

        - name: Install Server deps
          run: npm --prefix Server ci

        - name: Install Client deps
          run: npm --prefix Client ci

        - name: Install root deps
          run: npm ci

        - name: Install Playwright chromium
          run: npx playwright install --with-deps chromium

        - name: Run Server Jest with coverage
          run: npm --prefix Server run test:coverage
          env:
            CI: true

        - name: Run Client Vitest with coverage
          run: npm --prefix Client run test:coverage
          env:
            CI: true

        - name: Run Playwright
          run: npx playwright test
          env:
            CI: true
            MONGODB_URI: mongodb://localhost:27017/smart_restaurant_e2e

        - name: Upload Server coverage
          if: always()
          uses: actions/upload-artifact@v4
          with:
            name: server-coverage
            path: Server/coverage/
            retention-days: 14

        - name: Upload Client coverage
          if: always()
          uses: actions/upload-artifact@v4
          with:
            name: client-coverage
            path: Client/coverage/
            retention-days: 14

        - name: Upload Playwright report
          if: failure()
          uses: actions/upload-artifact@v4
          with:
            name: playwright-report
            path: playwright-report/
            retention-days: 14
  ```
  **Note**: the `Run Playwright` step assumes Server and Client servers are launched by `playwright.config.ts`'s `webServer` block when `CI=true`. Verify T081's config has the `webServer` config gated on `process.env.CI`.

  **Satisfies FR-026, FR-027.**

- [ ] T100 [US4] Push the branch and confirm the workflow runs. If wall-clock exceeds 10 minutes for two consecutive runs, split the workflow into parallel jobs: a `unit` job (Jest + Vitest) and an `e2e` job (Playwright) with `needs:` removed for parallelism. Otherwise leave sequential. **Satisfies FR-027, SC-010.**

- [ ] T101 [US4] Create or update `TESTING.md` at the repo root. Content:
  ```markdown
  # Testing

  This project has three test suites running on every push (see `.github/workflows/test.yml`).

  ## Backend (Jest + Supertest)

  ```bash
  cd Server
  npm install
  npm test                  # full suite
  npm run test:coverage     # + LCOV/HTML coverage at Server/coverage/
  ```

  Coverage gate: ≥80% global lines/branches/functions/statements. Uses `mongodb-memory-server` (no real Mongo needed). Mocks OpenAI and the Python ML service via `jest.mock('openai')` and `nock`.

  ## Frontend (Vitest + React Testing Library)

  ```bash
  cd Client
  npm install
  npm test                  # full suite
  npm run test:coverage     # + coverage at Client/coverage/
  ```

  Coverage gate: ≥75% global, ≥80% for `src/pages/**` and `src/components/**`. Uses `jsdom`. Mocks the project's axios wrapper at `Client/src/api/axios.js`.

  ## End-to-End (Playwright)

  ```bash
  # Prerequisite: MongoDB running on localhost:27017
  # In one terminal:
  cd Server && MONGODB_URI=mongodb://localhost:27017/smart_restaurant_e2e npm start
  # In another:
  cd Client && npm run dev
  # In a third (from repo root):
  npm install
  npx playwright install chromium
  npx playwright test
  npx playwright show-report
  ```

  ## All suites

  ```bash
  npm run test:all   # from repo root: runs Jest → Vitest → Playwright sequentially
  ```

  See `specs/006-full-test-suite/quickstart.md` for a more detailed walkthrough.
  ```
  **Satisfies SC-012.**

**Checkpoint US4**: GitHub Actions tab shows the workflow running and passing on the feature branch. SC-010, SC-012 verifiable.

---

## Phase 7: Polish & Cross-Cutting Verification

- [ ] T102 [P] Run quickstart.md's "Sanity-check the regression detector" experiment (from `quickstart.md`). Confirm the suite catches a deliberate regression in < 60s. **Satisfies SC-009.**

- [ ] T103 [P] Verify SC-011 (no real OpenAI / SMTP / ML keys required): from `Server/`, run `cross-env OPENAI_API_KEY= npm test`. Suite must remain green. **Satisfies SC-011.**

- [ ] T104 [P] Verify FR-029 (no new runtime deps): run from repo root:
  ```bash
  git diff master -- Server/package.json | grep -E '^\+' | grep -v '"devDependencies"' | grep -E '"[a-z]'
  git diff master -- Client/package.json | grep -E '^\+' | grep -v '"devDependencies"' | grep -E '"[a-z]'
  ```
  Both commands should return empty (only the script blocks and devDependencies should have additions). If anything in `dependencies` was added, revert. **Satisfies FR-029.**

- [ ] T105 [P] Verify FR-022 (no schema changes): run
  ```bash
  git diff master -- Server/src/domain/models/
  ```
  Output must be empty (or restricted to no-op changes such as already-existing whitespace cleanup). If a model file was modified for a test, that violates FR-022 — revert and use a workaround. **Satisfies FR-022, FR-023.**

- [ ] T106 [P] Verify FR-023 (no new API routes): run
  ```bash
  git diff master -- Server/src/routes/
  ```
  Output must be empty. **Satisfies FR-023.**

- [ ] T107 Run the entire `npm run test:all` from repo root one final time with the dev stack running. Confirm:
  - Server Jest: green, ≥80% global coverage.
  - Client Vitest: green, ≥75% global / ≥80% pages+components coverage.
  - Playwright: 12 specs green, < 5 min.
  - Total wall-clock: < 10 min.
  Take a screenshot of the green CI run for the graduation portfolio. **Satisfies all SCs.**

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories.
- **Phase 3 (US1)**, **Phase 4 (US2)**, **Phase 5 (US3)**: All depend on Phase 2. Can proceed in parallel if the team has the staffing; otherwise sequentially in priority order (US1 P1 → US2 P1 → US3 P2 → US4 P3).
- **Phase 6 (US4 — CI)**: Depends on Phase 3, 4, and 5 all being green locally — CI is meaningless if local fails.
- **Phase 7 (Polish)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1**: Independent. Backend tests don't need any frontend code.
- **US2**: Independent. Frontend tests mock the backend at the axios wrapper.
- **US3**: Depends on US1 (real Server must run cleanly) and US2 (real Client must serve cleanly). However, US3 *test authoring* can start in parallel; only the green-run gate requires the others.
- **US4**: Depends on US1 + US2 + US3 all green locally.

### Within US1

- T009–T014 (helpers) → T018–T049 (tests using helpers) → T050 (coverage iteration).
- All tests within a single test file are inherently sequential by Jest; tests across files are parallel.
- Order within the service tests doesn't matter — they all depend on the helpers, nothing else.

### Within US2

- T015–T017 (frontend helpers/setup) → T052 (Login template) → T053–T077 (other tests, all [P]) → T078 (coverage iteration).

### Within US3

- T080 (seed) → T081 (config) → T082 (globalSetup) → T083 (fixtures) → T084 (auth.spec, special — overrides storageState) → T085–T095 (other specs, [P]) → T096–T097 (verify).

### Parallel Opportunities

- All tasks marked `[P]` within a phase can run in parallel — they touch different files and have no inter-task ordering dependency.
- **High-leverage parallel waves**:
  - Wave 1 (Phase 1): T001 + T002 + T003 + T004 + T007 (5 parallel).
  - Wave 2 (Phase 2): T009 + T010 + T011 + T012 + T013 + T014 + T015 + T016 + T017 (9 parallel).
  - Wave 3 (Phase 3): T018–T025 (services, 8 parallel) → T026–T035 (api, 10 parallel) → T037–T042 (models, 6 parallel) → T044+T045+T046+T049 (4 parallel).
  - Wave 4 (Phase 4): T053–T077 (≈25 tests, all [P]).
  - Wave 5 (Phase 5): T085–T095 (≈11 specs, [P]).

---

## Implementation hints for the cheaper LLM model

1. **Always read the production file first** before writing its test. Do not invent function names. Run `cat Server/src/application/services/notification.service.js` (or read via the Read tool) and base the test on what's actually exported.

2. **CommonJS in `Server/`, ESM in `Client/`.** A `require('react')` in a Client test file is wrong; an `import express from 'express'` in a Server test file is wrong. Match the project style of the file you're working in.

3. **Don't add timestamps or random data to assertion strings.** A test that asserts `expect(notif.createdAt).toEqual(new Date())` will be flaky. Either freeze time with `jest.useFakeTimers({ now: new Date('2026-05-03') })` or assert structurally (`expect(notif.createdAt).toBeInstanceOf(Date)`).

4. **Use `findBy*` over `getBy*` after async actions.** RTL's `findBy*` already polls; a `getBy*` followed by `waitFor` is verbose and prone to subtle race conditions.

5. **Don't snapshot test pages with charts.** Recharts emits randomized SVG IDs. Assert text content, role presence, or chart-data props instead.

6. **For Playwright, prefer `getByRole` and `getByLabel`.** A spec keyed to a CSS class (`.export-button`) breaks the next time someone refactors the styling. A spec keyed to `getByRole('button', { name: /export/i })` survives.

7. **Run a single test file while iterating** to keep the feedback loop tight:
   - Backend: `npx jest __tests__/services/foo.test.js -t "case name"`.
   - Frontend: `npx vitest run src/__tests__/pages/foo.test.jsx`.
   - E2E: `npx playwright test e2e/auth.spec.ts --debug`.

8. **If a coverage gap requires touching production code**, stop and re-read FR-030. The allowed move is *non-invasive dependency injection*. Adding a `now` parameter to a function that previously read `Date.now()` is acceptable; refactoring the function's signature in a way that breaks existing callers is not.

9. **If a test would require a new API route or schema field**, that's a sign the test is asking for something out of scope. Re-read the FR the task is supposed to satisfy. The test should exercise the *existing* contract, not request a new one.

10. **Commit small.** One task per commit. The reviewer should be able to look at each commit and see "this added the test for service X" without context switching.
