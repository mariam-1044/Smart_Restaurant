# Contract: Vitest Setup and Axios Mock

**Module**: `Client/src/test/setup.js`, `Client/src/test/render.jsx`, `Client/src/test/fixtures.js`
**Status**: New — to be authored in /speckit.tasks
**Consumers**: every test file under `Client/src/__tests__/`

This contract pins the contract that frontend tests rely on for HTTP mocking, provider wiring, and shared mock data.

---

## `Client/src/test/setup.js` (Vitest setupFiles)

**Purpose**: Run once per Vitest worker, before any test file. Establishes the global testing environment.

**Required behavior**:

1. **Import `@testing-library/jest-dom`** to extend Vitest's `expect` with DOM matchers (`toBeInTheDocument`, `toHaveTextContent`, etc.).
2. **Mock the project's axios wrapper** at `Client/src/api/axios.js` globally:
   ```js
   import { vi } from 'vitest';

   vi.mock('../api/axios', () => ({
     default: {
       get: vi.fn(() => Promise.reject(new Error('axios.get unmocked — call vi.mocked(axios.get).mockResolvedValue(...) in your test'))),
       post: vi.fn(() => Promise.reject(new Error('axios.post unmocked'))),
       patch: vi.fn(() => Promise.reject(new Error('axios.patch unmocked'))),
       put: vi.fn(() => Promise.reject(new Error('axios.put unmocked'))),
       delete: vi.fn(() => Promise.reject(new Error('axios.delete unmocked')))
     }
   }));
   ```
   Default rejects ensure that any unmocked HTTP call surfaces a clear, immediate test failure rather than a silent network attempt or a hung promise.
3. **Reset state between tests** in an `afterEach`:
   ```js
   import { afterEach } from 'vitest';
   import { cleanup } from '@testing-library/react';

   afterEach(() => {
     cleanup();              // unmount React trees
     vi.clearAllMocks();     // reset call history without removing mocks
     localStorage.clear();
     sessionStorage.clear();
     document.documentElement.removeAttribute('data-theme');
   });
   ```
4. **Polyfill `matchMedia`** (jsdom does not implement it; Recharts and ThemeContext may probe it):
   ```js
   Object.defineProperty(window, 'matchMedia', {
     writable: true,
     value: vi.fn().mockImplementation(query => ({
       matches: false, media: query, onchange: null,
       addListener: vi.fn(), removeListener: vi.fn(),
       addEventListener: vi.fn(), removeEventListener: vi.fn(),
       dispatchEvent: vi.fn()
     }))
   });
   ```
5. **Polyfill `ResizeObserver`** (Recharts depends on it):
   ```js
   global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
   ```

**Forbidden behavior**:
- MUST NOT make any network request (the global `vi.mock` of axios prevents this; verify by setting CI's network namespace to disabled in a lint check).
- MUST NOT spawn timers, web workers, or service workers.
- MUST NOT import any production page or component (those imports happen in test files, not in setup).

---

## `Client/src/test/render.jsx` (Custom RTL render)

**Purpose**: Wrap a unit-under-test in the same providers it sees at runtime so component tests don't need to assemble the tree by hand.

**Signature**:
```jsx
function renderWithProviders(ui, options = {}) → RenderResult & { user, toast }

// options:
// - authUser: user object (or null) to seed AuthContext; null = unauthenticated
// - theme: 'light' | 'dark' (default 'light')
// - initialRoute: string (default '/')
// - routes: optional <Routes> override (for ProtectedRoute matrix tests)
```

**Provider stack** (outermost → innermost):
```jsx
<MemoryRouter initialEntries={[initialRoute]}>
  <AuthProvider initialUser={authUser}>
    <ThemeProvider initialTheme={theme}>
      <ToastProvider>
        {ui}
      </ToastProvider>
    </ThemeProvider>
  </AuthProvider>
</MemoryRouter>
```

**Returns**: standard RTL `RenderResult`, plus:
- `user`: a `userEvent.setup()` instance ready for click/type interactions (FR-014's user-event requirement).
- `toast`: a ref to the active toast queue (for tests asserting toast appearance without poking the DOM).

**Invariants**:
- The provider stack matches `Client/src/App.jsx`'s production order. If App.jsx changes, this helper changes in lockstep.
- Tests that need a custom router (e.g. testing redirects) pass `routes` to override.

**Usage**:
```jsx
import { renderWithProviders } from '../../test/render';
import Login from '../../pages/auth/Login';

test('renders login form', async () => {
  const { user } = renderWithProviders(<Login />);
  await user.type(screen.getByLabelText(/email/i), 'admin@test.local');
  await user.type(screen.getByLabelText(/password/i), 'password');
  await user.click(screen.getByRole('button', { name: /sign in/i }));
  // ... assertions
});
```

---

## `Client/src/test/fixtures.js`

**Purpose**: Centralized mock payloads for test files. Reduces duplication and keeps fixture shapes in sync with backend response contracts.

**Exports** (initial set; expanded as tests are authored):
```js
export const mockUser = {
  _id: '6650000000000000000000a1',
  name: 'Admin User',
  email: 'admin@test.local',
  role: 'admin',
  status: 'active',
  avatar: ''
};

export const mockStaffUser = { ...mockUser, role: 'staff', email: 'staff@test.local' };

export const mockIngredient = {
  _id: '6650000000000000000000b1',
  name: 'Tomato',
  quantity: 50,
  unit: 'kg',
  minStock: 10,
  costPerUnit: 1.50,
  expiryDate: new Date('2026-12-31').toISOString(),
  wasteQuantity: 0
};

export const mockDish = {
  _id: '6650000000000000000000c1',
  name: 'Margherita',
  category: 'Pizza',
  price: 12.00,
  available: true,
  ingredients: [{ ingredient: mockIngredient._id, quantity: 0.2 }]
};

export const mockOrder = {
  _id: '6650000000000000000000d1',
  items: [{ dish: mockDish._id, quantity: 2 }],
  status: 'pending',
  total: 24.00,
  paymentMethod: 'cash',
  source: 'pos',
  createdAt: new Date('2026-05-01').toISOString()
};

export const mockNotification = {
  _id: '6650000000000000000000e1',
  type: 'low_stock',
  title: 'Low stock: Tomato',
  message: 'Tomato is below minStock',
  targetRole: 'admin',
  read: false,
  createdAt: new Date('2026-05-03').toISOString()
};

export const mockRecipe = {
  name: 'Tomato Pasta',
  ingredients: ['Tomato', 'Pasta', 'Garlic'],
  steps: ['Boil pasta', 'Sauté garlic in oil', 'Add tomato sauce', 'Toss pasta'],
  estimated_cost: 3.50,
  suggested_price: 9.00,
  profit_margin: 0.61
};
```

**Invariants**:
- IDs are deterministic 24-hex-char ObjectId-shaped strings (Mongoose's `Types.ObjectId.isValid` accepts them).
- Dates are ISO strings (matches what JSON serialization of Date returns from backend).
- Fixtures are *frozen* shapes — if a backend response shape changes, fixtures change in the same commit.

---

## Vitest config (`Client/vitest.config.js`)

**Required structure**:
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
        'src/App.jsx',          // top-level provider wrapping; tested implicitly
        'src/api/**',           // axios wrapper; thin pass-through
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

**Invariants**:
- Vitest config is **separate from `vite.config.js`** for clarity. Vite remains responsible for the dev server / build; Vitest reads its own config.
- The `coverage.exclude` list includes thin pass-through files (`api/axios.js`, `main.jsx`) where 100% coverage would require boilerplate without value.
- Per-directory thresholds for `pages/` and `components/` keep those green even if `src/utils/` lags.

---

## Forbidden patterns in test files

- **No real `axios` import** outside `src/api/axios.js` (Vitest mock at the wrapper path catches everything that imports through it).
- **No direct DOM assertions on Recharts SVG IDs** (they include random suffixes; assert role/text instead).
- **No `screen.getByText('Loading...')` followed by `await waitFor(...)`** when `findBy*` works in one call.
- **No timer-based flake**: use `vi.useFakeTimers()` + `vi.advanceTimersByTime(N)` instead of `await new Promise(r => setTimeout(r, N))`.
- **No snapshot tests** on chart-bearing pages.
