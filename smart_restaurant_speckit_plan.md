# Smart Restaurant Ecosystem — SpecKit Implementation Plan

> **Project Type**: Graduation Project  
> **Current Completion**: ~35–40%  
> **AI Workflow**: Claude Code Opus (planning & review) → Kimi 2.6 (implementation) → Claude Code (review & QA)  
> **Total Phases**: 6 (P0 → P5)

---

## Project Status Snapshot

| Feature Area | Completion | Status |
|---|---|---|
| Authentication & RBAC | 85% | ✅ Mostly done |
| Inventory Management | 70% | ⚠️ Missing export & forecasting |
| Menu Management | 60% | ⚠️ No dedicated page, no service layer |
| Ordering System (POS) | 80% | ⚠️ Routes commented out |
| AI Recipe Generation | 15% | 🔴 Entirely mocked |
| AI Recommendation Engine | 10% | 🔴 Entirely mocked |
| Sales Forecasting | 10% | 🔴 Entirely mocked |
| Dynamic Pricing | 10% | 🔴 Entirely mocked |
| Market Basket Analysis | 10% | 🔴 Entirely mocked |
| Dashboard | 75% | ✅ ETL pipeline working |
| Notifications | 20% | 🔴 Console-only, no DB |
| User/Staff Management | 15% | 🔴 No frontend |
| Customer Management | 20% | 🔴 No frontend |
| Testing | 0% | 🔴 Nothing exists |
| DevOps | 5% | 🔴 No Docker, no CI/CD |

**Overall: ~35–40% complete. The AI/ML core — the centerpiece of the project — is entirely scaffolded with zero real intelligence.**

---

## Three-AI Workflow (Applied to Every Phase)

```
Claude Code Opus
  └─ Reads codebase + gap analysis
  └─ Writes precise implementation spec
       (file paths, function signatures, data contracts, edge cases)
          │
          ▼
      Kimi 2.6
        └─ Implements code following the spec
             │
             ▼
         Claude Code
           └─ Reviews output for:
                - Correctness & logic
                - Architecture consistency
                - Bug detection
                - Missing edge cases
```

This loop repeats for every task inside every phase.

---

## Phase Overview

| Phase | Priority | Title | Focus |
|---|---|---|---|
| P0 | 🔴 Critical | Real AI/ML Engine | Replace all mocks |
| P1 | 🔴 High | Backend Bug Fixes | 9 confirmed bugs + missing endpoints |
| P2 | 🟠 High | Missing Frontend Pages | 6 completely absent pages |
| P3 | 🟠 Medium | Notification System | DB persistence + in-app center |
| P4 | 🟡 Medium | Polish & Stubs | PDF export, dark mode, CSV, settings |
| P5 | 🟡 Medium | Full Test Suite | 0% → production-grade coverage |

---

## P0 — Real AI/ML Engine (Replace All Mocks)

> **Priority**: Critical — this is the core differentiator of a graduation project  
> **Current State**: Every AI endpoint returns hardcoded/random data. The `ml_model_service` on port 5002 is a Node.js Express server with 7 endpoints that all return fake JSON. The `openai` package (v6.27.0) is in `package.json` but never imported or used anywhere.

### Workflow
```
Claude Opus: spec each ML endpoint (inputs, outputs, model choice, training data source)
  → Kimi 2.6: implement Python FastAPI service + wire into ai.service.js
    → Claude: review logic, test harness, fallback handling
```

### Task 1 — Python FastAPI ML Service

**What**: Replace the Node.js mock (`Server/ml_model_service/index.js`) with a real Python FastAPI microservice.

**File to create**: `Server/ml_model_service/main.py`

**Endpoints to implement**:
| Endpoint | Method | Input | Output |
|---|---|---|---|
| `/predict-sales` | POST | `{ dish_id, days_ahead }` | `{ forecast: [{date, predicted_quantity}] }` |
| `/generate-recipe` | POST | `{ ingredients: [], style? }` | `{ name, steps, cost, profit_margin }` |
| `/recommend` | POST | `{ customer_id, limit }` | `{ dishes: [{id, name, score}] }` |
| `/market-basket` | GET | — | `{ rules: [{antecedent, consequent, confidence, lift}] }` |
| `/optimize-pricing` | POST | `{ dish_id }` | `{ current_price, suggested_price, multiplier, confidence }` |
| `/health` | GET | — | `{ status: "ok" }` |

**Dependencies** (`requirements.txt`):
```
fastapi
uvicorn
pandas
numpy
scikit-learn
statsmodels
prophet
mlxtend
openai
pymongo
python-dotenv
```

**Startup**: `uvicorn main:app --port 5002 --reload`

**Claude Opus spec instruction**: "Read `Server/ml_model_service/index.js` (the mock), read `Server/src/application/services/ai.service.js`, and produce a full FastAPI spec for each endpoint including exact request/response schemas, the ML approach to use, and what data to pull from MongoDB."

---

### Task 2 — Sales Forecasting (ARIMA / Prophet)

**Model**: Facebook Prophet (handles seasonality, holidays, day-of-week effects out of the box)

**Training data source**: MongoDB `orders` collection, aggregated via the existing ETL service (`Server/src/application/services/etl.service.js` → `getForecastingData()`)

**Implementation steps**:
1. Pull order history via ETL endpoint → convert to Prophet-compatible dataframe (`ds`, `y` columns)
2. Train one model per dish (or a single model with dish as regressor for speed)
3. Forecast 7 and 30 days ahead
4. Return predictions with `yhat`, `yhat_lower`, `yhat_upper` per day

**Node.js wiring**: In `ai.service.js`, `predictFutureSales()` → POST to `http://localhost:5002/predict-sales`

**Fallback**: If Python service is down, return a clear error (do NOT return random numbers as currently done)

---

### Task 3 — Recipe Generation (OpenAI API)

**Key fact**: `openai@6.27.0` is already in `package.json`. It has never been imported. This task is essentially 10–15 lines of wiring.

**Implementation in `ai.service.js`**:
```javascript
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async generateRecipe(availableIngredients) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [{
      role: 'system',
      content: 'You are a chef AI. Return JSON: { name, description, steps[], ingredients[], estimated_cost, suggested_price, profit_margin }'
    }, {
      role: 'user',
      content: `Available ingredients: ${availableIngredients.join(', ')}. Create a restaurant-quality dish.`
    }]
  });
  return JSON.parse(response.choices[0].message.content);
}
```

**Environment variable needed**: `OPENAI_API_KEY` in `.env`

**Fix `config/ai.js`**: Currently points to port 8000, never imported. Update port to 5002 and import in `ai.service.js`.

---

### Task 4 — Recommendation Engine (Collaborative Filtering)

**Approach**: User-based collaborative filtering on customer order history

**Data source**: MongoDB `customers` collection (has `orderHistory` and `favorites` fields)

**Implementation** (in Python FastAPI):
1. Build a customer × dish matrix from order history
2. Compute cosine similarity between customers
3. For a given `customer_id`, find top-K similar customers, aggregate their top dishes
4. Filter out dishes the customer already ordered frequently
5. Fall back to most-popular dishes for new customers (cold-start)

**Output**: `{ dishes: [{ id, name, score, reason }] }`

---

### Task 5 — Market Basket Analysis (Apriori)

**Library**: `mlxtend` (Python)

**Data source**: MongoDB `orders` collection — each order's `items` array (dish co-occurrences)

**Implementation**:
1. Extract order item sets from MongoDB
2. One-hot encode into a transaction matrix
3. Run `apriori()` with `min_support=0.1`
4. Generate `association_rules()` with `metric='confidence'`, `min_threshold=0.5`
5. Sort by `lift` descending, return top 20 rules
6. Cache results in MongoDB (recalculate nightly via cron)

**Output**: `{ rules: [{ antecedent: ["Pizza"], consequent: ["Cola"], confidence: 0.8, lift: 2.3 }] }`

---

### Task 6 — Dynamic Pricing Model

**Approach**: Gradient Boosting Regression (scikit-learn `GradientBoostingRegressor`)

**Features**:
- `demand_forecast` (from Prophet model)
- `ingredient_cost` (from Ingredient model, `costPerUnit × quantity`)
- `day_of_week` (0–6)
- `is_weekend` (boolean)
- `season` (0–3)
- `current_sales_count` (from Dish model)

**Target**: Optimal price multiplier (1.0 = no change, 1.2 = 20% increase)

**Training**: Use historical sales + pricing data from ETL pipeline

**Output**: `{ current_price: 12.00, suggested_price: 14.40, multiplier: 1.2, confidence: 0.78 }`

---

## P1 — Fix All Backend Bugs & Missing Endpoints

> **Priority**: High — several bugs cause crashes or broken features in production  
> **Count**: 9 confirmed bugs, 2 missing validation schemas, 2 missing auth endpoints, 1 missing inventory endpoint

### Workflow
```
Claude Opus: audit each bug, document exact fix with line numbers
  → Kimi 2.6: apply all patches
    → Claude: regression check, confirm no new issues introduced
```

### Bug Fix Checklist

#### Bug 1 — Order model default typo
- **File**: `Server/src/domain/models/Order.js` line 14
- **Current**: `default: 'competed'`
- **Fix**: `default: 'pending'`
- **Impact**: Every new order created with wrong status, breaks status flow

#### Bug 2 — Undefined variable in inventory controller
- **File**: `Server/src/interfaces/controllers/inventory.controller.js` line 16
- **Current**: `const ingredient = await Ingredient.findById(req.params.id)` — `Ingredient` is never imported
- **Fix**: Replace with `const ingredient = await inventoryService.getById(req.params.id)`
- **Impact**: `GET /inventory/:id` crashes with ReferenceError

#### Bug 3 — ETL and POS routes commented out
- **File**: `Server/src/index.js` lines 27–28
- **Current**: `// app.use('/api/etl', etlRoutes)` and `// app.use('/api/pos', posRoutes)`
- **Fix**: Uncomment both lines
- **Impact**: ETL pipeline and POS system are completely inaccessible via API

#### Bug 4 — Unused and misconfigured AI config
- **File**: `Server/src/infrastructure/config/ai.js`
- **Current**: Points to port 8000, never imported anywhere
- **Fix**: Update to port 5002, import in `ai.service.js` as the base URL for ML service calls
- **Impact**: AI service port config is orphaned; ai.service.js hardcodes URLs

#### Bug 5 — Missing auth endpoints (Settings page broken)
- **File**: `Server/src/routes/auth.routes.js`
- **Missing**: `PATCH /auth/update-profile` and `PATCH /auth/update-password`
- **Fix**: Add both routes + add controller methods in `auth.controller.js`:
  - `updateProfile`: update name, email fields on User model
  - `updatePassword`: verify currentPassword with bcrypt, hash newPassword, save
- **Impact**: Settings page calls these endpoints on every save — both 404 silently

#### Bug 6 — Missing inventory export endpoint
- **File**: `Server/src/routes/inventory.routes.js`
- **Missing**: `GET /inventory/export`
- **Fix**: Add route + controller method that queries all ingredients, converts to CSV using `json2csv`, sets `Content-Type: text/csv` header
- **Install**: `npm install json2csv`
- **Impact**: Frontend Export button calls this endpoint — throws 404

#### Bug 7 — Missing order validation schema
- **File**: `Server/src/interfaces/validations/` (directory)
- **Missing**: `order.validation.js`
- **Fix**: Create Joi schema validating `items[]` (required, min 1), `source` (enum), `paymentMethod` (enum), `customerId` (optional ObjectId)
- **Impact**: Orders can be created with invalid/missing data, corrupts DB

#### Bug 8 — Missing menu validation schema
- **File**: `Server/src/interfaces/validations/` (directory)
- **Missing**: `menu.validation.js`
- **Fix**: Create Joi schema validating `name` (required), `price` (number, min 0), `category` (required), `ingredients[]` (array of `{ingredient, quantity}`)
- **Impact**: Dishes can be created with missing required fields

#### Bug 9 — No menu service layer (architecture violation)
- **File**: `Server/src/application/services/` (directory)
- **Missing**: `menu.service.js`
- **Current**: Menu CRUD done directly in `menu.controller.js` calling `Dish` model directly
- **Fix**: Extract all DB operations into `menu.service.js`. Controller calls service. Matches pattern of all other controllers.
- **Impact**: Inconsistent architecture, untestable controller, violates project's own pattern

---

## P2 — Build All 6 Missing Frontend Pages

> **Priority**: High — graduation demo requires visible AI-powered UI  
> **Stack**: React 19 + Vite 7 + TailwindCSS 4 + Recharts 3 + React Router 7

### Workflow
```
Claude Opus: wireframe each page (component tree, data fetching, state shape, API calls)
  → Kimi 2.6: implement React pages and wire to backend
    → Claude: review UX, API wiring, error states, loading states
```

### Page 1 — Menu Management (`/admin/menu`)

**Purpose**: Standalone admin page for full menu CRUD. Remove the hidden admin logic currently buried in `OrderingSystem.jsx`.

**Components**:
- `MenuTable` — sortable table of all dishes with columns: name, category, price, availability toggle, ingredient count
- `DishFormModal` — create/edit modal with: name, description, category (dropdown), price, image URL, ingredient linker (multi-select from Ingredient collection with quantity input per ingredient)
- `PricingHistoryChart` — Recharts line chart of price changes over time per dish
- `CategoryFilter` — pill filter bar by category

**API calls**:
- `GET /api/menu` — fetch all dishes
- `POST /api/menu` — create dish
- `PUT /api/menu/:id` — update dish
- `DELETE /api/menu/:id` — delete dish
- `GET /api/inventory` — populate ingredient selector

**Access**: Admin role only (add `role="admin"` guard via existing `ProtectedRoute`)

---

### Page 2 — User/Staff Management (`/admin/users`)

**Purpose**: Admin panel to list all users, approve/reject pending staff registrations, update roles.

**Components**:
- `UserTable` — table with columns: name, email, role badge, status badge, actions
- `StatusBadge` — color-coded: active (green), pending (amber), inactive (red)
- `RoleDropdown` — inline dropdown to change role (admin/staff/customer)
- `ApproveRejectButtons` — shown only for pending users

**API calls**:
- `GET /api/auth/users` — **needs to be added** (list all users, admin only)
- `PATCH /api/auth/users/:id/status` — existing `updateUserStatus` endpoint

**State**: Filter tabs (All / Pending / Active / Inactive)

---

### Page 3 — Demand Prediction (`/ai/forecast`)

**Purpose**: Visualize the real sales forecasting output. Key demo page for graduation presentation.

**Components**:
- `ForecastChart` — Recharts `<ComposedChart>` with: line for predicted demand, shaded area band for `yhat_lower`/`yhat_upper` confidence interval
- `DishSelector` — dropdown to switch between dishes
- `PeriodToggle` — 7-day / 30-day toggle
- `ForecastTable` — tabular view of forecast data with export button
- `DemandAlertBanner` — highlights dishes with predicted spike (>30% above average)

**API calls**:
- `POST /api/ai/demand` — triggers prediction for selected dish
- Response feeds directly into Recharts `data` prop

**Special**: Include a "Staffing Suggestion" card derived from total forecasted orders (e.g., if forecasted orders > 150/day, suggest adding 1 staff member)

---

### Page 4 — Dynamic Pricing (`/ai/pricing`)

**Purpose**: Admin views AI pricing suggestions and applies them with one click.

**Components**:
- `PricingCard` (per dish) — shows: current price, suggested price with up/down arrow indicator, demand score bar, confidence percentage badge
- `BulkApplyButton` — applies all suggestions at once
- `PricingHistoryPanel` — collapsible: shows last 5 price changes for each dish
- `FilterBar` — filter by: suggested increase / suggested decrease / no change

**API calls**:
- `POST /api/ai/pricing` — get suggestions for all dishes
- `PUT /api/menu/:id` — apply suggested price (reuses existing menu update endpoint)

**UX detail**: Confirmation modal before applying. Show projected revenue impact.

---

### Page 5 — Customer Management (`/customers`)

**Purpose**: View and manage customer profiles, order history, preferences, and personalized recommendations.

**Components**:
- `CustomerTable` — columns: name/phone, order count, total spend, last order date, favorites count
- `CustomerDetailDrawer` — slide-in panel with:
  - Order history timeline
  - Favorite dishes (from `Customer.favorites`)
  - AI recommendation preview (calls `/api/customers/:id/recommendations`)
  - Tags: "Regular", "High Value", "At Risk" (derived from order frequency)

**API calls**:
- `GET /api/customers` — list all customers
- `GET /api/customers/:id` — get single customer with populated order history
- `GET /api/customers/:id/recommendations` — get personalized recommendations

---

### Page 6 — Waste Management Dashboard (`/waste`)

**Purpose**: Dedicated analytics page for food waste tracking and reduction. Directly demonstrates the "reducing food waste" pillar of the project.

**Components**:
- `WasteByIngredientChart` — Recharts `<BarChart>` showing waste quantity per ingredient
- `WasteTrendChart` — Recharts `<LineChart>` showing waste over time (daily/weekly)
- `WasteByCategoryChart` — Recharts `<PieChart>` waste distribution by category
- `NearExpiryTable` — ingredients expiring within 3 days with "Use in Recipe" CTA button (triggers recipe generation with those ingredients)
- `WasteSummaryCards` — total waste this month, waste value ($), waste reduction % vs last month

**API calls**:
- `GET /api/dashboard` — includes ETL waste analytics
- `GET /api/inventory/expiry` — near-expiry items (existing endpoint)
- `POST /api/ai/recipe` — triggered by "Use in Recipe" button with near-expiry ingredients

---

## P3 — Real Notification System

> **Priority**: Medium-High — currently notifications only log to console with no persistence or delivery  
> **Current State**: `notification.service.js` only calls `logger.info()`. No Notification model exists in MongoDB. No in-app notification center.

### Workflow
```
Claude Opus: design notification architecture (model schema, event triggers, delivery flow)
  → Kimi 2.6: implement model + REST API + React notification center
    → Claude: review persistence, real-time behavior, edge cases
```

### Task 1 — Notification Model (MongoDB)

**File**: `Server/src/domain/models/Notification.js`

**Schema**:
```javascript
{
  type: { type: String, enum: ['low_stock', 'expiry', 'reorder', 'spoilage_risk', 'system'], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  targetRole: { type: String, enum: ['admin', 'staff', 'all'], default: 'admin' },
  relatedEntity: { type: mongoose.Schema.Types.ObjectId, refPath: 'entityModel' },
  entityModel: { type: String, enum: ['Ingredient', 'Dish', 'Order'] },
  read: { type: Boolean, default: false },
  readAt: Date,
  createdAt: { type: Date, default: Date.now }
}
```

**Methods to add**:
- `Notification.createAlert(type, title, message, targetRole, relatedEntity?)` — static factory
- `Notification.markRead(id)` — sets `read: true`, `readAt: now`
- `Notification.getUnread(role)` — returns unread count + latest 20

**Migration**: Update `notification.service.js` to call `Notification.createAlert()` wherever it currently calls `logger.info()`.

---

### Task 2 — Notification REST API

**New routes** in `Server/src/routes/notification.routes.js`:

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/notifications` | GET | staff/admin | Get paginated notifications for current user's role |
| `/api/notifications/unread-count` | GET | staff/admin | Returns `{ count: N }` for badge |
| `/api/notifications/:id/read` | PATCH | staff/admin | Mark single notification read |
| `/api/notifications/read-all` | PATCH | staff/admin | Mark all as read |

---

### Task 3 — In-App Notification Center (Frontend)

**Component**: `NotificationBell` — added to `Navbar.jsx`

**UI**:
- Bell icon with red badge showing unread count
- Dropdown panel (max-height: 400px, scrollable) showing notification list
- Each item: icon (based on type), title, message, relative time ("2 min ago"), read/unread state
- "Mark all read" button at top
- Polling: `setInterval` every 30 seconds calling `/api/notifications/unread-count`

---

### Task 4 — Auto-Reorder Suggestion System

**Logic** (in `inventory.service.js` → `checkReorderPoints()`):

```
For each ingredient:
  if (currentQuantity < minStock) AND (usageForecast.daysUntilDepletion < leadTimeDays):
    suggestedQuantity = (avgDailyUsage × (leadTimeDays + safetyDays)) - currentQuantity
    Notification.createAlert('reorder', ...)
```

**Trigger**: Called after every order is placed (in `order.service.js` after ingredient deduction)

---

### Task 5 — Proactive Spoilage Prevention Cron

**File**: `Server/src/infrastructure/cron/spoilage.cron.js`

**Schedule**: Daily at 6:00 AM (`node-cron`: `'0 6 * * *'`)

**Logic**:
1. Query all ingredients expiring within 3 days
2. If any found, call `aiService.generateRecipe(nearExpiryIngredients)`
3. Create a `spoilage_risk` notification with the suggested recipe attached
4. Notify all staff-role users

**Install**: `npm install node-cron`

---

## P4 — Polish & Complete All Stubs

> **Priority**: Medium — visible broken features hurt demo credibility

### Workflow
```
Kimi 2.6: implement each stub replacement
  → Claude: review correctness and UX
```

### Task 1 — Real PDF Export

**Current**: `Report.jsx` "Export PDF" button calls `alert("Exporting report as PDF...")` — nothing else.

**Fix**:
1. Install `npm install jspdf html2canvas`
2. In `Report.jsx`, replace the alert handler:
```javascript
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const exportPDF = async () => {
  const element = document.getElementById('report-content');
  const canvas = await html2canvas(element, { scale: 2 });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const imgWidth = 210;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
  pdf.save(`restaurant-report-${new Date().toISOString().slice(0,10)}.pdf`);
};
```
3. Wrap the report section in `<div id="report-content">`

---

### Task 2 — CSV Inventory Export

**Backend** (already planned in P1 Bug 6):
- `GET /api/inventory/export` → returns CSV with headers: name, category, quantity, unit, minStock, costPerUnit, expiryDate, wasteQuantity

**Frontend** (in `Inventory.jsx`):
```javascript
const exportCSV = async () => {
  const response = await axiosInstance.get('/inventory/export', { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inventory-${Date.now()}.csv`;
  a.click();
};
```

---

### Task 3 — Functional Dark Mode

**Current**: Toggle in `Setting.jsx` exists but doesn't apply any styling.

**Fix**:
1. `variables.css` — populate dark mode CSS variable overrides under `[data-theme="dark"]` selector
2. In `AuthContext.jsx` (or a new `ThemeContext.jsx`), add:
```javascript
const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
const toggleTheme = () => {
  const newTheme = theme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  setTheme(newTheme);
};
```
3. Wire `toggleTheme` to the existing Settings toggle

---

### Task 4 — Settings Profile Update (Complete Wiring)

**Current**: Settings form submits to `PATCH /auth/update-profile` and `PATCH /auth/update-password` — both 404.

**Fix**: These endpoints are created in P1 Bug 5. This task is frontend-only — ensure the Settings form:
- Uses the correct request body shape matching the new endpoints
- Shows success/error toast after submit
- Updates the user's name in `AuthContext` after a successful profile update (so Navbar reflects the change immediately)

---

## P5 — Full Test Suite (0% → Production-Grade)

> **Priority**: Medium — required for graduation credibility; README claims tests exist but they don't  
> **Current State**: Zero test files. No test framework installed. `npm test` would fail.

### Workflow
```
Claude Opus: write full test plan (what to test, how to mock, coverage targets per module)
  → Kimi 2.6: write all test files following the plan
    → Claude: review coverage report, identify gaps, request additional tests
```

### Task 1 — Backend Unit Tests (Jest)

**Install**:
```bash
npm install --save-dev jest @jest/globals mongodb-memory-server supertest
```

**Configuration** (`jest.config.js`):
```javascript
export default {
  testEnvironment: 'node',
  transform: {},
  extensionsToTreatAsEsm: ['.js'],
  testMatch: ['**/__tests__/**/*.test.js']
};
```

**Test files to create**:

| Service | File | Key test cases |
|---|---|---|
| `inventory.service` | `__tests__/services/inventory.service.test.js` | CRUD operations, low stock detection, expiry check, waste recording |
| `order.service` | `__tests__/services/order.service.test.js` | Create order, ingredient deduction, order cancellation + ingredient return |
| `sales.service` | `__tests__/services/sales.service.test.js` | Daily/weekly/monthly reports, popular dishes calculation |
| `etl.service` | `__tests__/services/etl.service.test.js` | Forecasting data shape, waste analytics output format |
| `ai.service` | `__tests__/services/ai.service.test.js` | Recipe generation (mock OpenAI), fallback on ML service down |
| `customer.service` | `__tests__/services/customer.service.test.js` | Find/create customer, order history update |
| `notification.service` | `__tests__/services/notification.service.test.js` | Alert creation, mark read, unread count |
| `menu.service` | `__tests__/services/menu.service.test.js` | CRUD, availability toggle |

**MongoDB mock**: Use `mongodb-memory-server` — spins up in-memory MongoDB, no real DB needed.

**Coverage target**: ≥80% lines/branches for all services.

---

### Task 2 — API Integration Tests (Supertest)

**Test files to create**:

| Route Group | File | Key cases |
|---|---|---|
| `auth` | `__tests__/api/auth.test.js` | Register, login, logout, getMe, update-profile, update-password |
| `inventory` | `__tests__/api/inventory.test.js` | CRUD, low-stock, expiry, export CSV |
| `menu` | `__tests__/api/menu.test.js` | CRUD, admin-only restriction |
| `orders` | `__tests__/api/orders.test.js` | Create, update status, delete, ingredient deduction side effect |
| `ai` | `__tests__/api/ai.test.js` | All 4 AI endpoints, admin-only restriction |
| `dashboard` | `__tests__/api/dashboard.test.js` | Response shape, ETL data present |
| `sales` | `__tests__/api/sales.test.js` | Period filter, response shape |
| `customers` | `__tests__/api/customers.test.js` | CRUD, recommendations endpoint |
| `notifications` | `__tests__/api/notifications.test.js` | List, mark read, unread count |
| `etl` | `__tests__/api/etl.test.js` | Pipeline trigger, output shape |

**Auth scenarios to test per route**:
- ❌ No token → 401
- ❌ Wrong role → 403
- ✅ Valid token + correct role → 200/201

---

### Task 3 — Frontend Component Tests (Vitest + RTL)

**Install**:
```bash
npm install --save-dev vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

**Configuration** (`vite.config.js` — add test block):
```javascript
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: './src/test/setup.js'
}
```

**Test files to create**:

| Component/Page | File | Key cases |
|---|---|---|
| `Login.jsx` | `__tests__/pages/Login.test.jsx` | Render, form submit, error message on bad credentials |
| `Dashboard.jsx` | `__tests__/pages/Dashboard.test.jsx` | Renders stat cards, charts visible, API data loads |
| `Inventory.jsx` | `__tests__/pages/Inventory.test.jsx` | Table renders, modal opens, search filters, export button |
| `Recipes.jsx` | `__tests__/pages/Recipes.test.jsx` | Generate button calls API, recipe card renders |
| `Recommendation.jsx` | `__tests__/pages/Recommendation.test.jsx` | Cards render with correct categories |
| `Sales.jsx` | `__tests__/pages/Sales.test.jsx` | Period toggle updates chart data |
| `NotificationBell` | `__tests__/components/NotificationBell.test.jsx` | Badge shows unread count, dropdown opens |
| `Sidebar.jsx` | `__tests__/components/Sidebar.test.jsx` | Links render, active state |

**Mock pattern**: All `axios` calls mocked via `vi.mock('../api/axios')`

---

### Task 4 — E2E Tests (Playwright)

**Install**:
```bash
npm init playwright@latest
```

**Critical user flows to cover**:

| Flow | File | Steps |
|---|---|---|
| Staff login → dashboard | `e2e/auth.spec.ts` | Navigate to /login, enter credentials, assert redirect to dashboard, verify stat cards visible |
| Create order → inventory deducted | `e2e/ordering.spec.ts` | Add dish to basket, checkout, verify ingredient quantity decreased in inventory |
| AI recipe generation | `e2e/ai.spec.ts` | Navigate to /recipes, click generate, wait for result, assert recipe card appears |
| Admin approve staff | `e2e/users.spec.ts` | Login as admin, navigate to /admin/users, find pending user, click approve, assert status changes |
| Inventory export | `e2e/inventory.spec.ts` | Navigate to /inventory, click export, assert file download triggered |
| Low stock alert notification | `e2e/notifications.spec.ts` | Set ingredient to below minStock, place order that uses it, assert notification bell badge appears |

---

## Appendix A — Environment Variables Required

Create/update `Server/.env`:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/smart_restaurant

# Auth
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# OpenAI (already in package.json, never used — add key here)
OPENAI_API_KEY=sk-...

# ML Service
ML_SERVICE_URL=http://localhost:5002

# Notifications (optional for P3 email delivery)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your_app_password

# Environment
NODE_ENV=development
PORT=5000
```

---

## Appendix B — File Creation Checklist (New Files)

### Backend — New Files
- [ ] `Server/ml_model_service/main.py` — FastAPI ML service
- [ ] `Server/ml_model_service/requirements.txt`
- [ ] `Server/ml_model_service/models/forecasting.py` — Prophet model
- [ ] `Server/ml_model_service/models/recommender.py` — Collaborative filtering
- [ ] `Server/ml_model_service/models/basket.py` — Apriori
- [ ] `Server/ml_model_service/models/pricing.py` — Gradient Boosting
- [ ] `Server/src/domain/models/Notification.js`
- [ ] `Server/src/application/services/menu.service.js`
- [ ] `Server/src/application/services/notification.service.js` (rewrite existing)
- [ ] `Server/src/interfaces/validations/order.validation.js`
- [ ] `Server/src/interfaces/validations/menu.validation.js`
- [ ] `Server/src/routes/notification.routes.js`
- [ ] `Server/src/infrastructure/cron/spoilage.cron.js`
- [ ] `Server/__tests__/services/*.test.js` (8 files)
- [ ] `Server/__tests__/api/*.test.js` (10 files)

### Frontend — New Files
- [ ] `Client/src/pages/admin/MenuManagement.jsx`
- [ ] `Client/src/pages/admin/UserManagement.jsx`
- [ ] `Client/src/pages/ai/DemandForecast.jsx`
- [ ] `Client/src/pages/ai/DynamicPricing.jsx`
- [ ] `Client/src/pages/CustomerManagement.jsx`
- [ ] `Client/src/pages/WasteManagement.jsx`
- [ ] `Client/src/components/NotificationBell.jsx`
- [ ] `Client/src/context/ThemeContext.jsx`
- [ ] `Client/src/__tests__/pages/*.test.jsx` (8 files)
- [ ] `Client/src/__tests__/components/*.test.jsx` (3 files)
- [ ] `Client/e2e/*.spec.ts` (6 files)

---

## Appendix C — Claude Opus Prompt Templates

Use these prompts verbatim to generate the Claude Code Opus implementation specs.

### For P0 (AI/ML Engine):
```
You are Claude Code (Opus). Read the following files:
- Server/ml_model_service/index.js (the mock to replace)
- Server/src/application/services/ai.service.js
- Server/src/domain/models/Order.js
- Server/src/application/services/etl.service.js

Produce a complete implementation spec for a Python FastAPI service that replaces the mock.
For each endpoint, specify: exact request schema, exact response schema, the ML algorithm to use,
what MongoDB data to pull, how to handle cold-start / insufficient data cases,
and the fallback behavior. Include the full requirements.txt.
```

### For P1 (Bug Fixes):
```
You are Claude Code (Opus). Read these files and produce a precise patch plan:
- Server/src/domain/models/Order.js
- Server/src/interfaces/controllers/inventory.controller.js
- Server/src/index.js
- Server/src/routes/auth.routes.js
- Server/src/interfaces/controllers/auth.controller.js

For each bug, specify: exact file path, exact line number, current code, replacement code,
and a one-line explanation of why the fix is correct. Do not change any other lines.
```

### For P2 (Frontend Pages):
```
You are Claude Code (Opus). The frontend uses React 19 + Vite + TailwindCSS + Recharts + React Router.
Read these existing pages as style references: Client/src/pages/Dashboard.jsx, Client/src/pages/Inventory.jsx.

Produce a full component spec for [PAGE NAME]. Include:
- Component tree (parent → children)
- Props and state shape for each component
- Exact API endpoints called (with request/response shape)
- Loading, error, and empty states
- Role-based access control requirements
```

---

*Plan generated for: Smart Restaurant Ecosystem Graduation Project*  
*AI Workflow: Claude Code Opus (plan) → Kimi 2.6 (implement) → Claude Code (review)*
