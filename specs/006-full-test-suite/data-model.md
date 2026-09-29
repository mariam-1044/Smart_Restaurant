# Phase 1 Data Model: Test-Suite Fixtures and Lifecycle Entities

**Feature**: 006-full-test-suite
**Date**: 2026-05-03

This document specifies the shapes of the *test-time* entities introduced by this feature. It does NOT change any production-data shape (FR-022, FR-023, FR-029).

---

## 1. In-Memory MongoDB Instance (transient)

**Purpose**: Per-test-file isolated MongoDB. Holds documents created by `seedUser`, `seedIngredient`, etc., for the lifetime of a single Jest test file.

**Origin**: `mongodb-memory-server` v9 (already in `Server/devDependencies`).

**Lifecycle**:
| Hook | Action |
|------|--------|
| `beforeAll` | `MongoMemoryServer.create()` → `mongoose.connect(server.getUri())` |
| `beforeEach` | (no-op) |
| `afterEach` | Drop every collection (`Object.values(mongoose.connection.collections).forEach(c => c.deleteMany({}))`) |
| `afterAll` | `mongoose.disconnect()` then `server.stop()` |

**Shape (config)**:
```js
{
  binary: { version: '6.0.x' },     // pin to match prod Mongo major
  instance: { dbName: 'jest-test' } // single test file → single DB
}
```

**Failure modes**:
- Binary download timeout on first run → cached after success in CI by `actions/cache@v4` keyed on `~/.cache/mongodb-binaries`.
- Port collision when two test files run in parallel → `mongodb-memory-server` allocates ephemeral ports, no manual config needed.

---

## 2. Test User (seed)

**Purpose**: A `User` document used by tests to drive role-gated routes and to mint authentic JWTs.

**Source helper**: `Server/__tests__/helpers/seedUser.js`

**Schema** (mirrors `Server/src/domain/models/User.js` with deterministic test defaults):
```js
{
  _id: ObjectId('6650000000000000000000__'),  // last 2 hex set per role
  name: 'Test Admin',                          // overridable
  email: 'admin@test.local',                   // overridable; unique per test file
  password: '<bcrypt hash of "TestPass!23">',  // hashed via the same pre-save hook prod uses
  role: 'admin' | 'staff' | 'customer',        // required; drives 401/403 matrix
  status: 'active',                            // override to 'pending' for approval flow tests
  tokenVersion: 0,                             // bumped by password change tests
  createdAt: <fixed test date>,
  updatedAt: <fixed test date>
}
```

**Helper signature**:
```js
async function seedUser({
  role = 'staff',
  email,           // defaults to `${role}-${randomId}@test.local`
  password = 'TestPass!23',
  status = 'active',
  name,
  ...overrides
}) → User document
```

**Invariants**:
- The bcrypt hash MUST be produced by the real `User` pre-save hook, not pre-baked. This ensures the hook is exercised by every seed.
- Each call returns a fresh document; helper does not cache.
- `_id` is auto-generated unless overridden — tests rarely need a fixed id.

---

## 3. Test JWT

**Purpose**: A real JSON Web Token signed with the same `JWT_SECRET` the production middleware verifies against. Drives Supertest requests through the real auth pipeline.

**Source helper**: `Server/__tests__/helpers/mintToken.js`

**Shape** (payload):
```js
{
  sub: '<user._id.toString()>',
  email: '<user.email>',
  role: '<user.role>',
  tokenVersion: '<user.tokenVersion ?? 0>',
  iat: <unix timestamp>,
  exp: <iat + 1 hour>
}
```

**Helper signature**:
```js
function mintToken(user, { ttl = '1h' } = {}) → 'eyJ...'   // signed JWT string
```

**Secret resolution**:
- Reads `process.env.JWT_SECRET` at *call time* (not import time) so `jest.setup.js`'s injection of `'test-jwt-secret'` is honored regardless of test file load order.
- The same secret is set in `jest.setup.js` and consumed by `Server/src/middlewares/auth.middleware.js` via `process.env.JWT_SECRET`. No production code change.

**Failure modes**:
- If a service module read `JWT_SECRET` at module-import time and cached it before `jest.setup.js` ran, the secrets would mismatch. Mitigation: every consumer reads at call time. Verified by code inspection during /speckit.tasks.

---

## 4. Authed Supertest Agent

**Purpose**: A Supertest client with `Authorization: Bearer <jwt>` pre-set, ready to call any protected route.

**Source helper**: `Server/__tests__/helpers/authedRequest.js`

**Helper signature**:
```js
function authedRequest(app, user) → request.SuperAgentTest  // chained .get()/.post() etc.
```

**Behavior**:
- Internally calls `mintToken(user)` and attaches `Authorization` header to every request the agent makes.
- Returns a Supertest agent whose `.set('X-Custom', ...)` etc. still works for ad-hoc cases.
- For unauthenticated tests, callers use plain `request(app)` directly.

---

## 5. OpenAI Mock

**Purpose**: A reusable Jest mock factory for the `openai` SDK so `ai.service.js` tests never reach `api.openai.com` (FR-006).

**Source helper**: `Server/__tests__/helpers/mockOpenAI.js`

**Shape**:
```js
function installMockOpenAI({
  generateRecipe,         // optional canned response for chat.completions.create
  shouldThrow = false,    // simulate transient SDK failure
} = {}) → { mockCreate }   // jest.fn() exposed for assertion
```

**Mechanism**:
- Calls `jest.mock('openai', () => ({ default: class { chat = { completions = { create: mockCreate } } } }))`.
- `mockCreate` is a `jest.fn()` whose default resolved value is a structured recipe object matching the production response shape.
- Tests assert on `mockCreate.mock.calls` to verify prompt construction.

---

## 6. ML-Service HTTP Stub

**Purpose**: Intercepts outbound HTTP calls from `ai.service.js` to the Python ML service at `ML_SERVICE_URL` (FR-007).

**Library**: `nock` (new devDependency).

**Pattern**:
```js
const nock = require('nock');

beforeEach(() => {
  nock(process.env.ML_SERVICE_URL)         // 'http://localhost:5002/v1' per jest.setup.js
    .post('/predict-sales')
    .reply(200, { forecast: [...] });
});

afterEach(() => {
  nock.cleanAll();                          // clear interceptors
  if (!nock.isDone()) {
    throw new Error('ML stub had unconsumed interceptors');  // catches dead-code mocks
  }
});
```

**Invariants**:
- `nock.disableNetConnect()` is called once in a global setup so any unmocked outbound HTTP throws — this is the safety net for FR-028.
- `nock.enableNetConnect('127.0.0.1')` is added to allow Supertest's `app.listen(0)` loopback.

---

## 7. Vitest Mock Module Registry

**Purpose**: Per-test-file substitutions for the `Client/src/api/axios.js` wrapper and any other module a Vitest test wants to fake.

**Source**: Vitest's built-in `vi.mock()` API (no helper file needed beyond `Client/src/test/setup.js`).

**Pattern**:
```js
import { vi } from 'vitest';

vi.mock('../../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));
```

**Global safety net** (in `Client/src/test/setup.js`):
- Installs an `afterEach` that calls `vi.clearAllMocks()` to reset call history between tests.
- Installs an `afterEach` that calls `localStorage.clear()` and `sessionStorage.clear()`.
- Imports `@testing-library/jest-dom` for matcher extensions.

---

## 8. RTL Custom Render

**Purpose**: A render helper that wraps the unit under test in the providers it needs at runtime (`MemoryRouter`, `AuthProvider`, `ThemeProvider`, `ToastProvider`) so component tests don't have to assemble the tree by hand.

**Source helper**: `Client/src/test/render.jsx`

**Signature**:
```jsx
function renderWithProviders(ui, {
  authUser = null,        // initial value for AuthContext; null = unauthenticated
  theme = 'light',        // initial value for ThemeContext
  initialRoute = '/',     // MemoryRouter initial entry
  routes,                 // optional <Routes> override for ProtectedRoute tests
} = {}) → RenderResult
```

**Returned**: standard RTL `RenderResult` (rerender, unmount, container, etc.) plus the inner `useToast()` ref for toast-specific tests.

---

## 9. Playwright `auth.json` (storageState)

**Purpose**: Cached authenticated session, written once by `globalSetup`, consumed by every spec via `use: { storageState: 'auth.json' }` (FR-022a).

**Lifecycle**:
| Phase | Action |
|-------|--------|
| `globalSetup` | `request.post('/api/auth/login', { email: 'admin@e2e.local', password: '...' })` → store cookies + `localStorage.token` to `auth.json` |
| Per-spec | Playwright loads `auth.json` into the browser context before any spec code runs |
| `globalTeardown` | (no-op) — `auth.json` is gitignored and overwritten next run |

**Shape** (Playwright's standard format):
```json
{
  "cookies": [],
  "origins": [
    {
      "origin": "http://localhost:5173",
      "localStorage": [
        { "name": "token", "value": "eyJ..." },
        { "name": "user", "value": "{\"_id\":\"...\",\"role\":\"admin\",...}" }
      ]
    }
  ]
}
```

**Failure modes**:
- Backend not running when `globalSetup` executes → setup fails fast with a clear "Server unreachable at http://localhost:5000" error.
- Seed user not present in DB → `globalSetup` calls `seed-e2e.js` first (idempotent), then logs in.

**Override** (for the auth-UI spec): `e2e/auth.spec.ts` calls `test.use({ storageState: { cookies: [], origins: [] } })` to start unauthenticated.

---

## 10. E2E Seed Database

**Purpose**: Deterministic state for E2E specs.

**Source script**: `Server/scripts/seed-e2e.js`

**Database name**: `smart_restaurant_e2e` (separate from dev's `smart_restaurant`).

**Idempotency contract**: Running the script twice MUST leave the database identical to running it once.

**Mechanism**:
1. Connect to `MONGODB_URI` (default override: `mongodb://localhost:27017/smart_restaurant_e2e`).
2. For each seeded collection, `deleteMany({})` then `insertMany([...])` — clean slate.
3. Run any `pre('save')` hook by inserting through Mongoose, not raw driver, so password hashing applies.
4. Log how many documents were inserted; exit 0 on success, non-zero on Mongo error.

**Seeded entities** (counts approximate):
| Collection | Count | Purpose |
|------------|-------|---------|
| `users` | 5 | 1 admin (`admin@e2e.local`), 1 staff (`staff@e2e.local`), 1 pending-staff (`pending@e2e.local`), 2 customers |
| `ingredients` | 8 | 2 near-expiry (3 days), 1 near-minStock (`quantity = minStock + 1`), rest baseline |
| `dishes` | 4 | 1 simple (1 ingredient), 1 multi (3 ingredients), 1 unavailable, 1 with image |
| `orders` | 3 | 1 completed (yesterday), 1 pending, 1 cancelled (with returned ingredients) |
| `customers` | 2 | with `orderHistory` and `favorites` populated |
| `notifications` | 1 | 1 unread `low_stock` for the bell badge smoke |

---

## 11. Coverage Reports (artifacts)

**Purpose**: CI-uploaded artifacts proving the gate was met.

**Server (Jest)**:
- Format: LCOV + HTML.
- Path: `Server/coverage/` (lcov-report, lcov.info, coverage-summary.json).
- Uploaded as `server-coverage` artifact.

**Client (Vitest)**:
- Format: LCOV + HTML.
- Path: `Client/coverage/` (lcov-report, lcov.info).
- Uploaded as `client-coverage` artifact.

**Playwright**:
- Format: HTML report + trace files for failed runs.
- Path: `playwright-report/` and `test-results/`.
- Uploaded as `playwright-report` artifact only on failure (otherwise the artifact is large and rarely consulted).

**Retention**: 14 days (GitHub Actions default; configurable via workflow `retention-days`).

---

## 12. Relationships

```
mongodb-memory-server (per Jest file)
    │
    ├─ seedUser ──→ User document
    │       │
    │       └─ mintToken ──→ JWT string ──→ authedRequest agent
    │                                              │
    │                                              └─ Supertest → real auth.middleware → controller → service → MM Mongo
    │
    └─ (other model seeds: ingredients, orders, etc.)


nock + jest.mock('openai') (per Jest file)
    │
    └─ outbound HTTP from ai.service.js intercepted; no real network


Vitest (per Client test file)
    │
    └─ vi.mock('../../api/axios') → component renders with mocked HTTP
                                        │
                                        └─ providers via render.jsx (Router, Auth, Theme, Toast)


Playwright (one-time globalSetup)
    │
    ├─ seed-e2e.js → smart_restaurant_e2e DB with deterministic seeds
    │
    └─ POST /api/auth/login → auth.json (storageState)
            │
            └─ every spec: chromium context loads auth.json → all routes accessible
```

---

## 13. Out of scope for this data model

- **Pact contracts** between Client and Server — out of scope per /speckit.research R16.
- **Snapshot files** for component renders — actively discouraged (Recharts SVG randomness).
- **MSW request handlers** — not used; `vi.mock` covers the seam.
- **Per-test-file Mongo URI overrides** — not needed; each file gets its own ephemeral instance.
