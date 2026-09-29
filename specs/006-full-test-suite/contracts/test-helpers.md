# Contract: Backend Test Helpers

**Module**: `Server/__tests__/helpers/`
**Status**: New — to be authored in /speckit.tasks
**Consumers**: every test file under `Server/__tests__/services/`, `Server/__tests__/api/`, `Server/__tests__/models/`, `Server/__tests__/middleware/`

This contract defines the public API of the test-helper toolkit. Any change to these signatures is a breaking change for test files that consume them.

---

## `withInMemoryMongo()`

**File**: `Server/__tests__/helpers/inMemoryMongo.js`

**Purpose**: Install Jest lifecycle hooks (`beforeAll` / `afterEach` / `afterAll`) that manage an in-memory MongoDB for the calling test file.

**Signature**:
```js
function withInMemoryMongo({ dropBetween = true } = {}) → void  // installs hooks as side effect
```

**Behavior**:
- `beforeAll`: starts `MongoMemoryServer`, calls `mongoose.connect(server.getUri())`. Caches the server in module-private state for the file.
- `afterEach`: if `dropBetween` is true (default), drops every collection in the connected DB.
- `afterAll`: disconnects mongoose, stops the server. Wrapped in `try/finally` so a test failure does not leak the process.

**Usage**:
```js
const { withInMemoryMongo } = require('../helpers/inMemoryMongo');

describe('Inventory Service', () => {
  withInMemoryMongo();  // installs hooks for this describe block

  test('records waste below stock', async () => { /* ... */ });
});
```

**Invariants**:
- One server per Jest test file. Helper is idempotent within a file (calling twice is harmless).
- Calling without `withInMemoryMongo` from a test that imports a Mongoose model is a programming error; tests must declare their DB dependency.

---

## `seedUser(options)`

**File**: `Server/__tests__/helpers/seedUser.js`

**Purpose**: Insert a `User` document with deterministic test defaults; password is hashed by the real `pre('save')` hook.

**Signature**:
```js
async function seedUser({
  role = 'staff',           // 'admin' | 'staff' | 'customer'
  email,                    // default: `${role}-${randomId()}@test.co`
  password = 'TestPass!23', // plaintext; hashed by pre-save hook
  status = 'approved',      // 'approved' | 'pending' | 'rejected' | 'active' | 'inactive'
  name,                     // default: `Test ${capitalize(role)}`
  ...overrides              // any other User field
}) → Promise<UserDocument>
```

**Behavior**:
- Builds the document via `new User({ ... }).save()` so the password-hashing pre-save hook runs.
- Returns the saved Mongoose document, with `_id`, `createdAt`, `updatedAt` populated.

**Errors**:
- Duplicate `email` (unique constraint) → throws `MongoServerError` with code `11000`. Tests must supply unique emails or rely on the random suffix.
- Invalid `role` enum value → throws `ValidationError` (the actual prod validator runs).

**Invariants**:
- The returned document's `password` field is the bcrypt hash, NOT the plaintext. Tests that need the plaintext password (e.g. login flow) must use the constant `'TestPass!23'` or capture the override.

---

## `mintToken(user, options)`

**File**: `Server/__tests__/helpers/mintToken.js`

**Purpose**: Sign a JWT with the test `JWT_SECRET` so it verifies through the real `auth.middleware`.

**Signature**:
```js
function mintToken(user, { ttl = '1h' } = {}) → string  // JWT
```

**Payload shape** (verified to match `auth.controller.js`'s `signToken` and `auth.middleware.js`'s decode expectations):
```js
{
  id: user._id.toString(),
  version: user.tokenVersion ?? 0,
  iat: <now>,
  exp: <now + ttl>
}
```

**Behavior**:
- Reads `process.env.JWT_SECRET` at *call time* (not at module-import time) — required because `jest.setup.js` injects the secret before tests run.
- Uses `jsonwebtoken.sign(payload, secret, { expiresIn: ttl })`.
- No DB interaction; pure function.

**Errors**:
- `JWT_SECRET` unset → throws synchronously. Test files should never see this if `jest.setup.js` runs first.

---

## `authedRequest(app, user)`

**File**: `Server/__tests__/helpers/authedRequest.js`

**Purpose**: Return a Supertest agent with `Authorization: Bearer <jwt>` pre-set so consuming tests don't repeat the header dance.

**Signature**:
```js
function authedRequest(app, user) → SuperAgentTest  // Supertest agent
```

**Behavior**:
- Calls `mintToken(user)` once at agent-creation time.
- Uses `request.agent(app)` and adds the `Authorization` header via `agent.set('Authorization', ...)` — the agent applies it to every subsequent request.
- The returned agent supports the full Supertest API (`.get()`, `.post()`, `.set()`, `.send()`, `.expect()`, etc.).

**Usage**:
```js
const admin = await seedUser({ role: 'admin' });
const agent = authedRequest(app, admin);

const res = await agent.post('/api/menu').send({ name: 'Pizza', price: 10 });
expect(res.status).toBe(201);
```

**Invariants**:
- Token is issued once per agent. If a test needs a fresh token (e.g. after a password change), it creates a new agent.
- For unauthenticated tests, callers use plain `request(app)` (no helper needed).

---

## `mockOpenAI(options)`

**File**: `Server/__tests__/helpers/mockOpenAI.js`

**Purpose**: Install a `jest.mock('openai', ...)` stub at module-level scope.

**Signature**:
```js
function mockOpenAI({
  recipeResponse,           // canned object returned by chat.completions.create
  shouldThrow = false,      // if true, the stubbed call throws
  errorMessage = 'OpenAI rate limit exceeded'
} = {}) → { mockCreate: jest.Mock }
```

**Behavior**:
- Calls `jest.mock('openai', ...)` to substitute the SDK.
- Returns the underlying `jest.fn()` so the test can assert on `.mock.calls`.

**Default response**:
```js
{
  choices: [{
    message: {
      content: JSON.stringify({
        name: 'Test Recipe',
        ingredients: ['ingredient-a', 'ingredient-b'],
        steps: ['step 1', 'step 2'],
        estimated_cost: 5.00,
        suggested_price: 12.00,
        profit_margin: 0.58
      })
    }
  }]
}
```

**Usage**:
```js
const { mockOpenAI } = require('../helpers/mockOpenAI');
const { mockCreate } = mockOpenAI();

test('generateRecipe parses OpenAI JSON', async () => {
  const recipe = await aiService.generateRecipe(['cheese', 'tomato']);
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
    messages: expect.arrayContaining([
      expect.objectContaining({ content: expect.stringContaining('cheese, tomato') })
    ])
  }));
  expect(recipe.name).toBe('Test Recipe');
});
```

**Invariants**:
- `jest.mock` is hoisted to the top of the file by Jest's transform; calling `mockOpenAI()` inside a test body works because the helper itself wraps the `jest.mock` call at module scope (caller imports the helper, which has `jest.mock` at its own top).

---

## `withMlServiceStub({ url, route, response })`

**File**: `Server/__tests__/helpers/mlServiceStub.js` (optional convenience wrapper around `nock`)

**Purpose**: Single-line nock setup for the most common ML-service stubs (forecast, pricing, basket, recommend).

**Signature**:
```js
function withMlServiceStub({
  route = '/predict-sales',                             // ML endpoint path
  method = 'POST',
  status = 200,
  response = { forecast: [{ date: '...', predicted_quantity: 10 }] }
} = {}) → nock.Scope
```

**Behavior**:
- Wraps `nock(process.env.ML_SERVICE_URL)[method.toLowerCase()](route).reply(status, response)`.
- Returns the nock scope so the test can assert `.isDone()`.

**Usage**:
```js
const scope = withMlServiceStub({ route: '/predict-sales' });
const res = await agent.post('/api/ai/forecast').send({ dish_id: '...', days_ahead: 7 });
expect(res.status).toBe(200);
expect(scope.isDone()).toBe(true);
```

**Failure modes**:
- ML service "down" simulation: caller passes `status: 503` → ai.service.js wraps this into a clear "ML unavailable" error per FR-007.

---

## Global hooks (in `Server/jest.setup.js`)

**Existing** (kept):
- Inject test env vars: `OPENAI_API_KEY`, `HANDLE_SALT`, `JWT_SECRET`, `ML_SERVICE_URL`.

**New** (added):
- `nock.disableNetConnect()` — every outbound HTTP throws unless explicitly stubbed (FR-028 safety net).
- `nock.enableNetConnect('127.0.0.1')` — Supertest's `app.listen(0)` loopback still works.
- `afterEach(() => { nock.cleanAll(); })` — interceptors don't leak between tests.

---

## Versioning policy

This contract is internal to the test suite. Changes are:
- **Backwards compatible**: adding new optional parameters with sensible defaults.
- **Breaking**: changing a parameter type, removing a parameter, or changing the return shape.

A breaking change is allowed only when accompanied by a migration of all consuming test files in the same commit. The contract file is updated to reflect the new signature.
