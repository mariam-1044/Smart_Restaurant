# Contract: Playwright Global Setup and E2E Seed

**Modules**: `playwright.config.ts`, `e2e/global-setup.ts`, `Server/scripts/seed-e2e.js`
**Status**: New — to be authored in /speckit.tasks
**Consumers**: every spec under `e2e/` and `e2e/smoke/`

---

## `playwright.config.ts` (repository root)

**Required structure**:
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['html'], ['github']] : [['list'], ['html']],
  use: {
    baseURL: 'http://localhost:5173',
    storageState: 'auth.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  globalSetup: require.resolve('./e2e/global-setup'),
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: process.env.CI ? [
    {
      command: 'cd Server && npm start',
      url: 'http://localhost:5000/api/health',  // assumes /api/health exists
      reuseExistingServer: false,
      env: { MONGODB_URI: 'mongodb://localhost:27017/smart_restaurant_e2e', NODE_ENV: 'test' }
    },
    {
      command: 'cd Client && npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: false
    }
  ] : undefined
});
```

**Invariants**:
- `baseURL` is `http://localhost:5173` (Vite default). Specs use relative paths (`page.goto('/login')`).
- `storageState` defaults to `auth.json` (written by `globalSetup`); the auth-UI spec overrides this with empty state.
- `webServer` config kicks in only on CI; locally, the developer is expected to have `Server/` and `Client/` running manually.
- Cross-browser matrix is intentionally absent (FR-020). Only `chromium` runs.

---

## `e2e/global-setup.ts`

**Required structure**:
```ts
import { chromium, request, FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import * as path from 'path';

async function globalSetup(_config: FullConfig) {
  // 1. Seed the E2E database (idempotent)
  const repoRoot = path.resolve(__dirname, '..');
  execSync('node Server/scripts/seed-e2e.js', {
    cwd: repoRoot,
    env: { ...process.env, MONGODB_URI: 'mongodb://localhost:27017/smart_restaurant_e2e' },
    stdio: 'inherit'
  });

  // 2. Programmatic login via API
  const apiContext = await request.newContext({ baseURL: 'http://localhost:5000' });
  const response = await apiContext.post('/api/auth/login', {
    data: { email: 'admin@e2e.local', password: 'AdminPass!23' }
  });
  if (!response.ok()) {
    throw new Error(`E2E login failed: ${response.status()} ${await response.text()}`);
  }
  const { token, user } = await response.json();

  // 3. Hydrate a browser context with the resulting session and persist
  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addInitScript((auth) => {
    window.localStorage.setItem('token', auth.token);
    window.localStorage.setItem('user', JSON.stringify(auth.user));
  }, { token, user });

  // Visit the app once so localStorage gets associated with origin http://localhost:5173
  const page = await context.newPage();
  await page.goto('http://localhost:5173/');
  await context.storageState({ path: path.join(repoRoot, 'auth.json') });
  await browser.close();
  await apiContext.dispose();
}

export default globalSetup;
```

**Behavior**:
1. Run the idempotent seed script via `child_process.execSync` so seed errors fail fast and clearly.
2. POST to `/api/auth/login` via Playwright's `request` API (no browser involved).
3. Launch a chromium context, set `localStorage` keys to mimic what the real login flow sets.
4. Visit the frontend once so the origin is associated with the storage entries.
5. Save storage state to `auth.json` at the repo root.

**Failure modes**:
- Seed script fails (Mongo unreachable) → setup throws, no specs run, CI fails fast.
- `/api/auth/login` returns non-2xx → throw with the response status and body.
- `auth.json` write permission denied → throw.

**Idempotency**:
- Calling `globalSetup` twice in a row produces the same `auth.json`.
- The seed script drops collections before inserting, so prior state is wiped.

---

## `Server/scripts/seed-e2e.js`

**Required behavior**:
```js
#!/usr/bin/env node
// Idempotent seed for Playwright E2E suite.
// Reads MONGODB_URI from env (defaults to mongodb://localhost:27017/smart_restaurant_e2e).
// Drops then re-inserts every seeded collection. Inserts via Mongoose so pre-save hooks run.

const mongoose = require('mongoose');
const User = require('../src/domain/models/User');
const Ingredient = require('../src/domain/models/Ingredient');
const Dish = require('../src/domain/models/Dish');
const Order = require('../src/domain/models/Order');
const Customer = require('../src/domain/models/Customer');
const Notification = require('../src/domain/models/Notification');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_restaurant_e2e';

async function main() {
  await mongoose.connect(MONGODB_URI);

  // Drop all seeded collections
  await Promise.all([
    User.deleteMany({}),
    Ingredient.deleteMany({}),
    Dish.deleteMany({}),
    Order.deleteMany({}),
    Customer.deleteMany({}),
    Notification.deleteMany({})
  ]);

  // Insert canonical users (passwords hashed via pre-save hook)
  const admin = await new User({ name: 'E2E Admin', email: 'admin@e2e.local', password: 'AdminPass!23', role: 'admin', status: 'active' }).save();
  const staff = await new User({ name: 'E2E Staff', email: 'staff@e2e.local', password: 'StaffPass!23', role: 'staff', status: 'active' }).save();
  const pending = await new User({ name: 'E2E Pending', email: 'pending@e2e.local', password: 'PendPass!23', role: 'staff', status: 'pending' }).save();

  // Insert ingredients (one near-minStock for low-stock spec)
  const tomato = await new Ingredient({ name: 'Tomato', quantity: 11, unit: 'kg', minStock: 10, costPerUnit: 1.5 }).save();
  const cheese = await new Ingredient({ name: 'Cheese', quantity: 50, unit: 'kg', minStock: 5, costPerUnit: 4.0 }).save();
  // ... 6 more ingredients per data-model.md §10

  // Insert dishes
  const margherita = await new Dish({ name: 'Margherita', price: 12, category: 'Pizza', available: true, ingredients: [{ ingredient: tomato._id, quantity: 0.2 }, { ingredient: cheese._id, quantity: 0.15 }] }).save();
  // ... 3 more dishes

  // Insert one unread low_stock notification for the bell smoke
  await new Notification({ type: 'low_stock', title: 'Low stock: Tomato', message: 'Tomato is below minStock', targetRole: 'admin' }).save();

  console.log(`[seed-e2e] DB=${mongoose.connection.name} users=3 ingredients=8 dishes=4 notifications=1`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[seed-e2e] FAILED', err);
  process.exit(1);
});
```

**Invariants**:
- The script connects via Mongoose so every model's `pre('save')` hook runs (User password hash is real bcrypt).
- The script logs a one-line summary to stdout that names the database — easy to verify "we hit the right DB" in CI logs.
- Exit code 0 on success, non-zero on any error.
- All seeded `_id`s are auto-generated (no fixed IDs) — specs query by `email` or `name`, not by `_id`.

**Idempotency proof**:
- `deleteMany({})` is called before every insert. Running the script twice yields the same final state because the second run wipes the first run's output.

---

## E2E spec authoring rules

Every spec under `e2e/` MUST:

1. **Use `getByRole`/`getByLabel`/`getByText`** for selectors. Forbidden: CSS class names, pixel offsets, auto-generated IDs.
2. **Trust `auth.json`** by default. Specs that need a different role (or unauthenticated) override:
   ```ts
   test.use({ storageState: { cookies: [], origins: [] } });
   ```
3. **Wait for explicit signals** — `page.waitForLoadState('networkidle')`, `expect(locator).toBeVisible()`, `page.waitForResponse('**/api/...')`. Forbidden: bare `setTimeout` or `page.waitForTimeout()` over 1 second.
4. **Read downloads via `page.waitForEvent('download')`** and inspect `download.createReadStream()` or `download.path()`. Forbidden: writing to a hardcoded filesystem path.
5. **Self-clean any data they create** that would break a later spec. Specs are otherwise considered side-effect-tolerant because each CI run is preceded by `globalSetup` which re-seeds.

---

## Affected source paths summary

| Path | New / Modified | Owner |
|------|----------------|-------|
| `playwright.config.ts` | NEW | this contract |
| `e2e/global-setup.ts` | NEW | this contract |
| `e2e/auth.spec.ts` | NEW | spec authors |
| `e2e/ordering.spec.ts` | NEW | spec authors |
| `e2e/ai.spec.ts` | NEW | spec authors |
| `e2e/users.spec.ts` | NEW | spec authors |
| `e2e/inventory.spec.ts` | NEW | spec authors |
| `e2e/notifications.spec.ts` | NEW | spec authors |
| `e2e/smoke/*.spec.ts` (6 files) | NEW | spec authors |
| `e2e/fixtures/users.ts` | NEW | this contract |
| `Server/scripts/seed-e2e.js` | NEW | this contract |
| `package.json` (repo root) | NEW | this contract — `@playwright/test`, `@types/node`, `dotenv` |
| `auth.json` | NEW (gitignored) | written by globalSetup, read by specs |
| `.gitignore` | MODIFIED | add `auth.json`, `playwright-report/`, `test-results/` |
