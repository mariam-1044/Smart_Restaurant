---
description: "Task list for Feature 003 — Missing Frontend Pages"
---

# Tasks: Missing Frontend Pages

**Input**: Design documents from `/specs/003-missing-frontend-pages/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)
**Tests**: Automated tests are NOT in scope for this feature (they are P5 per `smart_restaurant_speckit_plan.md`). Manual verification via `quickstart.md`.

## How to use this file

Each task is **self-contained and decision-free**: file paths, signatures, dependencies, and the spec/research/contracts reference are all listed inline. Implement them in numerical order unless `[P]` is present (in which case the task can run in parallel with other `[P]` tasks in the same phase). Do not invent extra files. Do not change the structures defined in `data-model.md` and `contracts/` — those are the contract.

When a task says "see ResearchDecision N" or "see Contract X", open `research.md` or `contracts/<X>.md` and follow it; do not re-decide.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps to spec.md User Story (US1..US6). Setup/Foundational/Polish tasks have no story label.

## Path Conventions

- Frontend: `Client/src/...`
- Backend: `Server/src/...`
- All paths absolute from repo root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the directories and confirm dependencies the new pages will use. No business logic in this phase.

- [X] T00 Create new frontend directory `Client/src/pages/admin/` (will hold MenuManagement.jsx, UserManagement.jsx).
- [X] T00 Create new frontend directory `Client/src/pages/ai/` (will hold DemandForecast.jsx, DynamicPricing.jsx).
- [X] T00 [P] Create new frontend directory `Client/src/components/shared/` (LoadingState, EmptyState, ErrorState, ConfirmationModal, DetailDrawer, FilterPills).
- [X] T00 [P] Create new frontend directory `Client/src/components/menu/` (DishFormModal, PricingHistoryChart, IngredientLinker).
- [X] T00 [P] Create new frontend directory `Client/src/components/users/` (StatusBadge, RoleDropdown).
- [X] T00 [P] Create new frontend directory `Client/src/components/ai/` (ForecastChart, DemandAlertBanner, StaffingSuggestionCard, PricingCard).
- [X] T00 [P] Create new frontend directory `Client/src/components/customers/` (CustomerTagBadges).
- [X] T00 [P] Create new frontend directory `Client/src/components/waste/` (WasteSummaryCards, WasteByIngredientChart, WasteTrendChart, WasteByCategoryChart, NearExpiryTable).
- [X] T00 Verify `Client/package.json` already includes `recharts ^3`, `axios ^1`, `react-router-dom ^7`, `react-icons ^5`. If any is missing, run `npm install` in `Client/`. Do not add new dependencies — every page is built with the existing ones.

**Checkpoint**: Directory tree from `plan.md` §Project Structure is in place; no source code yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared primitives, the role-aware route guard, the optimistic-concurrency support, and the AI-failure helper. **Every user story depends on these.**

> ⚠️ Do not begin any user story (Phase 3+) until every task in Phase 2 is complete.

### Backend foundational

- [X] T0 [P] Add `version: { type: Number, default: 0 }` to `Server/src/domain/models/Dish.js`. See `data-model.md` § Dish and `research.md` § Decision 1. Existing fields stay unchanged.
- [X] T0 [P] Add `version: { type: Number, default: 0 }` to `Server/src/domain/models/User.js`.
- [X] T0 [P] Add `version: { type: Number, default: 0 }` to `Server/src/domain/models/Customer.js` (create the field; do not add other fields).
- [X] T0 Locate the pricing record model used by `Server/src/interfaces/controllers/pricing.controller.js` (it may be `Dish.priceHistory` rather than a separate document — if so, no model change needed; the `version` on `Dish` covers it). Confirm and document in a one-line comment in `pricing.controller.js`.
- [X] T0 In every PATCH/DELETE controller method that mutates one of the four models above (Dish, User, Customer, plus `pricing.controller.apply` and `pricing.controller.revert`), wrap the update in this pattern:

  ```js
  // Optimistic concurrency. See spec FR-035 and research.md Decision 1.
  const expectedVersion = req.body.__version;
  const result = await Model.findOneAndUpdate(
    { _id: req.params.id, version: expectedVersion },
    { $set: changes, $inc: { version: 1 } },
    { new: true }
  );
  if (!result) {
    const fresh = await Model.findById(req.params.id).select('version');
    return res.status(409).json({
      success: false,
      errorType: 'VERSION_CONFLICT',
      message: 'This record was changed by another admin. Please refresh to see the latest version.',
      currentVersion: fresh ? fresh.version : null
    });
  }
  ```

  Files to update: `Server/src/interfaces/controllers/menu.controller.js`, `Server/src/interfaces/controllers/auth.controller.js` (updateUserStatus + the new updateUser handler from T028), `Server/src/interfaces/controllers/customer.controller.js` (when the new endpoints from T030/T031 are added; if no customer mutations exist yet, defer until then), `Server/src/interfaces/controllers/pricing.controller.js` (apply, revert).

  Acceptance: any PATCH/DELETE that does not include `__version` matching the server-side `version` returns HTTP 409 with the exact body shape above.

- [X] T0 [P] Update `Server/src/application/validations/menu.validation.js` `dishSchema` to make `__version` an optional integer (`Joi.number().integer().min(0).optional()`). Do not require it for POST (creation has no prior version).
- [X] T0 [P] If a pricing-apply or revert request body has its own validation schema, update it to accept `__versions: Joi.object().pattern(Joi.string(), Joi.number().integer())` for bulk operations and `__version: Joi.number().integer().optional()` for single operations.

### Frontend foundational — shared components

- [X] T0 [P] Create `Client/src/components/shared/LoadingState.jsx`. Default export. Props: `{ message?: string }`. Renders centered spinner + message (default "Loading…"). Use existing Tailwind classes (`flex items-center justify-center p-8 text-gray-500`); use `react-icons` `FaSpinner` with `animate-spin`. No external deps.
- [X] T0 [P] Create `Client/src/components/shared/EmptyState.jsx`. Props: `{ title, message, action? }` where `action` is a React node (e.g. a button). Renders centered message; reuse Tailwind tokens consistent with `Inventory.jsx`.
- [X] T0 [P] Create `Client/src/components/shared/ErrorState.jsx`. Props: `{ title?, message, onRetry? }`. Renders the error and a "Retry" button when `onRetry` is provided. Default title "Something went wrong."
- [X] T0 [P] Create `Client/src/components/shared/ConfirmationModal.jsx`. Props: `{ isOpen, title, body, confirmLabel='Confirm', confirmVariant='primary', onConfirm, onCancel }`. Close on backdrop click or `Esc`. `body` accepts a React node (so caller can include counts, filter names, projected revenue impact). When `confirmVariant === 'danger'`, the confirm button is red. Use a fixed full-screen backdrop and a centered card. No focus-trap library — only initial autofocus on the confirm button is required.
- [X] T0 [P] Create `Client/src/components/shared/DetailDrawer.jsx`. Props: `{ isOpen, onClose, title, children }`. Slides in from the right (Tailwind `translate-x-0` ↔ `translate-x-full` with `transition-transform`). Width 30rem on desktop, 100% on tablet. Close on backdrop click and Esc.
- [X] T0 [P] Create `Client/src/components/shared/FilterPills.jsx`. Props: `{ options: Array<{value, label}>, value, onChange }`. Single-select. Active pill styled differently. Clicking the active pill clears it (calls `onChange(null)` or `onChange(options[0].value)` if a default exists — use `onChange(null)` as the convention).

### Frontend foundational — route guard, axios helper, sidebar, routes

- [X] T0 Modify `Client/src/routes/ProtectedRoute.jsx` to accept an optional `roles` prop:

  ```jsx
  import { Navigate } from "react-router-dom";
  import { useAuth } from "../context/AuthContext";

  export default function ProtectedRoute({ children, roles }) {
    const { user } = useAuth();
    if (!user) return <Navigate to="/" replace />;
    if (roles && roles.length > 0 && !roles.includes(user.role)) {
      return <Navigate to="/dashboard" replace />;
    }
    return children;
  }
  ```

  Existing call sites that pass no `roles` keep their current behavior.

- [X] T0 Create `Client/src/api/aiCall.js` with this helper, used by every page that calls an AI endpoint:

  ```js
  // See research.md Decision 3.
  import api from "./axios";

  export async function aiCall(method, url, body) {
    try {
      const res = await api.request({ method, url, data: body });
      if (res.data && res.data.success === false) {
        return { ok: false, kind: 'ai_unavailable', message: res.data.message || 'Service unavailable' };
      }
      return { ok: true, data: res.data.data ?? res.data };
    } catch (err) {
      const status = err?.response?.status;
      if (!status || status >= 500) {
        return { ok: false, kind: 'ai_unavailable', message: 'Service unavailable' };
      }
      return { ok: false, kind: 'error', message: err?.response?.data?.message || err.message, status };
    }
  }
  ```

  All AI-related pages use this helper rather than calling `api` directly. Never returns synthesized data on failure.

- [X] T0 Modify `Client/src/components/Data.jsx` to add the six new sidebar entries (see `research.md` Decision 10). Append to the existing `SidebarData` array exactly:

  ```js
  { icon: FaUtensils,      heading: "Menu",       path: "/admin/menu",   roles: ["admin"] },
  { icon: FaUsers,         heading: "Users",      path: "/admin/users",  roles: ["admin"] },
  { icon: FaChartArea,     heading: "Forecast",   path: "/ai/forecast",  roles: ["admin"] },
  { icon: FaTag,           heading: "Pricing",    path: "/ai/pricing",   roles: ["admin"] },
  { icon: FaUserFriends,   heading: "Customers",  path: "/customers",    roles: ["admin", "staff"] },
  { icon: FaTrash,         heading: "Waste",      path: "/waste",        roles: ["admin"] },
  ```

  Add the new icons to the import line at the top of `Data.jsx` (`FaUsers`, `FaChartArea`, `FaTag`, `FaUserFriends`, `FaTrash`).

- [X] T0 Modify `Client/src/App.jsx` to register the six new routes. Imports go at top:

  ```jsx
  import MenuManagement from "./pages/admin/MenuManagement";
  import UserManagement from "./pages/admin/UserManagement";
  import DemandForecast from "./pages/ai/DemandForecast";
  import DynamicPricing from "./pages/ai/DynamicPricing";
  import CustomerManagement from "./pages/CustomerManagement";
  import WasteManagement from "./pages/WasteManagement";
  ```

  Add inside `<Routes>` (after existing routes):

  ```jsx
  <Route path="/admin/menu"   element={<ProtectedRoute roles={["admin"]}><MenuManagement /></ProtectedRoute>} />
  <Route path="/admin/users"  element={<ProtectedRoute roles={["admin"]}><UserManagement /></ProtectedRoute>} />
  <Route path="/ai/forecast"  element={<ProtectedRoute roles={["admin"]}><DemandForecast /></ProtectedRoute>} />
  <Route path="/ai/pricing"   element={<ProtectedRoute roles={["admin"]}><DynamicPricing /></ProtectedRoute>} />
  <Route path="/customers"    element={<ProtectedRoute roles={["admin","staff"]}><CustomerManagement /></ProtectedRoute>} />
  <Route path="/waste"        element={<ProtectedRoute roles={["admin"]}><WasteManagement /></ProtectedRoute>} />
  ```

  At this point each new page does not exist yet — the build will fail. That is expected; the page files are created in their respective story phases. To keep the dev server green during foundational work, create six placeholder page files now, each containing only:

  ```jsx
  import DashboardLayout from "../layouts/DashboardLayout";
  export default function PageName() { return <DashboardLayout><div className="p-8">Coming soon</div></DashboardLayout>; }
  ```

  Adjust import path depth for files in subdirectories (`../../layouts/DashboardLayout`).

### Backend foundational — additive endpoints stub

- [X] T0 Create new route registration: in `Server/src/routes/auth.routes.js`, add (between `router.get('/me', ...)` and `router.patch('/update-profile', ...)`):

  ```js
  router.get('/users', restrictTo('admin'), authController.listUsers);
  router.patch('/users/:id', restrictTo('admin'), validate(updateUserSchema), authController.updateUser);
  ```

  Note: `updateUserSchema` is added in T029.

- [X] T0 Add `listUsers` and `updateUser` handlers to `Server/src/interfaces/controllers/auth.controller.js`:

  ```js
  exports.listUsers = async (req, res, next) => {
    try {
      const users = await User.find({}, 'name email role status createdAt version').sort({ createdAt: -1 }).lean();
      res.json({ success: true, data: users });
    } catch (e) { next(e); }
  };

  exports.updateUser = async (req, res, next) => {
    try {
      const expectedVersion = req.body.__version;
      const updates = {};
      if (req.body.role !== undefined)   updates.role = req.body.role;
      if (req.body.status !== undefined) updates.status = req.body.status;
      const updated = await User.findOneAndUpdate(
        { _id: req.params.id, version: expectedVersion },
        { $set: updates, $inc: { version: 1 } },
        { new: true }
      );
      if (!updated) {
        const fresh = await User.findById(req.params.id).select('version');
        return res.status(409).json({
          success: false, errorType: 'VERSION_CONFLICT',
          message: 'This record was changed by another admin. Please refresh to see the latest version.',
          currentVersion: fresh ? fresh.version : null
        });
      }
      res.json({ success: true, data: updated });
    } catch (e) { next(e); }
  };
  ```

  Make sure `User` is imported at the top of the file.

- [X] T0 Add `updateUserSchema` to `Server/src/application/validations/auth.validation.js`:

  ```js
  const Joi = require('joi');
  // ...
  const updateUserSchema = Joi.object({
    role: Joi.string().valid('admin', 'staff', 'customer').optional(),
    status: Joi.string().valid('active', 'pending', 'inactive').optional(),
    __version: Joi.number().integer().min(0).required()
  }).min(1);
  module.exports = { ...module.exports, updateUserSchema };
  ```

  Update the named export at the top of `auth.routes.js` (`const { ... , updateUserSchema } = require(...)`).

- [X] T0 In `Server/src/routes/customer.routes.js`, prepend (above the existing `router.post('/profile', ...)` line):

  ```js
  const { protect, restrictTo } = require('../middlewares/auth.middleware');
  router.get('/',       protect, restrictTo('admin','staff'), customerController.listAll);
  router.get('/:id',    protect, restrictTo('admin','staff'), customerController.getById);
  ```

- [X] T0 Add `listAll` and `getById` handlers to `Server/src/interfaces/controllers/customer.controller.js` and the corresponding service methods in `Server/src/application/services/customer.service.js`. Tag derivation per spec FR-023 and research Decision 8:

  ```js
  // customer.service.js
  async function listAllWithTags() {
    const customers = await Customer.find({}, 'name phone email totalOrders totalSpend lastOrderAt favoritesCount version').lean();
    if (customers.length === 0) return [];
    const sortedSpend = customers.map(c => c.totalSpend || 0).sort((a, b) => a - b);
    const cutoffIndex = Math.floor(sortedSpend.length * 0.8);
    const highValueCutoff = sortedSpend[cutoffIndex] ?? Infinity;
    const now = Date.now();
    const days = (date) => date ? (now - new Date(date).getTime()) / 86400000 : Infinity;
    return customers.map(c => {
      const tags = [];
      // Regular: ≥3 orders in last 90 days — needs per-customer recent-order count.
      // For graduation scale, treat `totalOrders` as proxy if no per-window count exists.
      // If a per-window count is available on the customer, replace this line with the real check.
      // Otherwise compute from orders collection (see TODO note below).
      // ...
      const lastDays = days(c.lastOrderAt);
      // Regular rule (placeholder until orders-collection lookup is wired):
      // const ordersIn90d = await Order.countDocuments({ customer: c._id, placedAt: { $gte: ninetyDaysAgo } });
      // if (ordersIn90d >= 3) tags.push('Regular');
      if ((c.totalSpend || 0) >= highValueCutoff) tags.push('High Value');
      // At Risk: was Regular and no order in last 60 days.
      // Implementation depends on the same orders-collection lookup as Regular.
      return { ...c, tags };
    });
  }
  ```

  **Implementation note for the implementing model**: The Regular and At Risk rules require counting orders per customer over the last 90 / 60 days. Look at the existing Order model in `Server/src/domain/models/Order.js` for the `customer` reference field (likely `customer` or `customerId`). Add an aggregation step before the `customers.map(...)` that builds a `Map<customerId, { ordersIn90d, ordersIn60d }>`, then read it inside the map. Do not skip this — the tags are part of the contract.

  ```js
  exports.listAll = async (req, res, next) => {
    try {
      const customers = await customerService.listAllWithTags();
      res.json({ success: true, data: customers });
    } catch (e) { next(e); }
  };
  exports.getById = async (req, res, next) => {
    try {
      const detail = await customerService.getByIdWithDetail(req.params.id);
      if (!detail) return res.status(404).json({ success: false, message: 'Customer not found' });
      res.json({ success: true, data: detail });
    } catch (e) { next(e); }
  };
  ```

  `customerService.getByIdWithDetail(id)` populates `orderHistory` (newest first, last 20 orders with items + total + status), `favorites` (top 5 dishes by orderCount, derived from order history or from `customer.favorites` if already stored), and the same `tags` array.

- [X] T0 In `Server/src/index.js`, ensure `customer.routes.js` is mounted at `/api/customers` (it likely already is at `/api/customer`; if so, also mount at `/api/customers` to match the contract path or update the route prefix). Confirm by grepping `customer` in `Server/src/index.js` — if mounted at `/api/customer`, change to `/api/customers` and verify no other client code calls the singular path. If existing client code calls `/customer/profile`, leave the singular mount in place and additionally mount at `/customers`.

### AI / forecast extension (foundational for US2 only — but listed here so US2 starts unblocked)

- [X] T0 Extend the forecast response shape in the ML service and `Server/src/application/services/ai.service.js` to include `historyStatus`, `trailingAverage`, `spikeAlert`, `staffingSuggestion` fields per `data-model.md` § ForecastResult. The implementing model should:

  - In the ML service (`Server/ml_model_service/main.py`), compute `trailingAverage` as the mean daily quantity over the trailing 30-day window prior to the forecast start; set `historyStatus = 'insufficient'` when the dish has fewer than 14 days of history; set `spikeAlert.triggered = true` when any forecasted day's `predictedQuantity / trailingAverage > 1.30`; populate `staffingSuggestion` with the busiest forecast day and `suggestedAddedStaff = max(0, ceil((forecastedOrders - 150) / 50))` (use 150 as the high-volume threshold and 50 orders per added staff member — these numbers are illustrative defaults; if the project already has staffing thresholds in config, use those).
  - Pass these fields through unchanged in `ai.service.js`'s `predictFutureSales`/`forecast` function.

- [X] T0 Confirm `Server/src/routes/inventory.routes.js` already exposes `GET /api/inventory/near-expiry`. (It does per the codebase grep — this is just a verification step; no code change.)

**Checkpoint**: All shared primitives, route guard, axios helper, sidebar entries, route registrations, additive endpoints, and concurrency support are in place. Six placeholder pages render "Coming soon". User stories can now be implemented in any order.

---

## Phase 3: User Story 1 — Menu Management (Priority: P1) 🎯 MVP candidate

**Goal**: Deliver an admin-only `/admin/menu` page that lets the admin perform full menu CRUD with ingredient linking, an availability toggle, and a per-dish pricing-history view, with concurrent-edit protection and full state coverage (loading/empty/error/populated).

**Independent test**: see `quickstart.md` §1 — 7 sequential steps, including the concurrency check.

**Contract**: `contracts/menu-management.md`. Do not deviate.

### Implementation

- [X] T0 [P] [US1] Create `Client/src/components/menu/IngredientLinker.jsx`. Props: `{ value: Array<{ingredientId, quantity, unit}>, onChange, ingredientOptions: Ingredient[] }`. Renders a list of (dropdown for ingredient, number input for quantity, unit derived from selected ingredient, "remove" button) plus an "Add ingredient" button. The unit is read-only and comes from the selected `Ingredient.unit`.

- [X] T0 [P] [US1] Create `Client/src/components/menu/PricingHistoryChart.jsx`. Props: `{ history: Array<{ price, changedAt }> }`. Uses Recharts `<LineChart>` with `dataKey="price"` and `XAxis dataKey="changedAt"` (formatted as short date). If `history.length === 0`, render `EmptyState` with message "No price changes yet."

- [X] T0 [P] [US1] Create `Client/src/components/menu/DishFormModal.jsx`. Props: `{ isOpen, mode: 'create' | 'edit', dish?: Dish, ingredientOptions: Ingredient[], onSubmit, onCancel, submitting?: boolean, validationErrors?: Record<string,string> }`. Form fields: name (required), description, category (dropdown — values from existing `Dish.category` enum or freeform; check `Dish.js` for the enum and reuse), price (number ≥ 0), imageUrl, ingredients (uses `IngredientLinker`). On submit, call `onSubmit({ ...formValues, __version: dish?.version })` (omit `__version` in create mode). Render inline field errors from `validationErrors`. The modal itself is a fixed full-screen backdrop with a centered card.

- [X] T0 [US1] Create `Client/src/pages/admin/MenuManagement.jsx`. Replace the placeholder from T026. Implementation outline (see contract for state machine):

  ```jsx
  import { useEffect, useState } from "react";
  import DashboardLayout from "../../layouts/DashboardLayout";
  import api from "../../api/axios";
  import LoadingState from "../../components/shared/LoadingState";
  import EmptyState   from "../../components/shared/EmptyState";
  import ErrorState   from "../../components/shared/ErrorState";
  import ConfirmationModal from "../../components/shared/ConfirmationModal";
  import DishFormModal from "../../components/menu/DishFormModal";
  import PricingHistoryChart from "../../components/menu/PricingHistoryChart";
  import { FaEdit, FaTrash, FaHistory, FaPlus } from "react-icons/fa";

  export default function MenuManagement() {
    const [pageState, setPageState] = useState("loading"); // 'loading' | 'error' | 'empty' | 'ready'
    const [dishes, setDishes] = useState([]);
    const [ingredients, setIngredients] = useState([]);
    const [editing, setEditing] = useState(null);   // null | { mode, dish }
    const [deletingId, setDeletingId] = useState(null);
    const [historyDish, setHistoryDish] = useState(null);
    const [toast, setToast] = useState(null);

    async function fetchAll() {
      setPageState("loading");
      try {
        const [menuRes, invRes] = await Promise.all([api.get("/menu"), api.get("/inventory")]);
        const menuData = menuRes.data.data ?? menuRes.data;
        const invData  = invRes.data.data  ?? invRes.data;
        setDishes(menuData);
        setIngredients(invData);
        setPageState(menuData.length === 0 ? "empty" : "ready");
      } catch { setPageState("error"); }
    }
    useEffect(() => { fetchAll(); }, []);

    async function handleSubmit(values) {
      try {
        if (editing.mode === "create") await api.post("/menu", values);
        else                            await api.patch(`/menu/${editing.dish._id}`, values);
        setEditing(null);
        await fetchAll();
        setToast({ kind: "success", text: editing.mode === "create" ? "Dish created." : "Dish updated." });
      } catch (err) {
        if (err.response?.status === 409) {
          setEditing(null);
          setToast({ kind: "error", text: err.response.data.message });
          await fetchAll();
        } else if (err.response?.status === 400) {
          setToast({ kind: "error", text: err.response.data.message ?? "Invalid input." });
        } else {
          setToast({ kind: "error", text: "Something went wrong." });
        }
      }
    }

    async function handleToggleAvailability(dish) {
      try {
        await api.patch(`/menu/${dish._id}`, { available: !dish.available, __version: dish.version });
        await fetchAll();
      } catch (err) {
        if (err.response?.status === 409) { setToast({ kind: "error", text: err.response.data.message }); await fetchAll(); }
        else                              { setToast({ kind: "error", text: "Toggle failed." }); }
      }
    }

    async function handleDelete() {
      const dish = dishes.find(d => d._id === deletingId);
      try {
        await api.delete(`/menu/${deletingId}`, { data: { __version: dish.version } });
        setDeletingId(null);
        await fetchAll();
        setToast({ kind: "success", text: "Dish deleted." });
      } catch (err) {
        setDeletingId(null);
        if (err.response?.status === 409) { setToast({ kind: "error", text: err.response.data.message }); await fetchAll(); }
        else                              { setToast({ kind: "error", text: "Delete failed." }); }
      }
    }

    return (
      <DashboardLayout>
        <div className="p-6">
          <header className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold">Menu</h1>
            <button onClick={() => setEditing({ mode: "create" })} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2">
              <FaPlus /> New dish
            </button>
          </header>

          {pageState === "loading" && <LoadingState message="Loading menu…" />}
          {pageState === "error"   && <ErrorState message="Failed to load menu." onRetry={fetchAll} />}
          {pageState === "empty"   && <EmptyState title="No dishes yet" message="Create your first dish to get started." />}
          {pageState === "ready"   && (
            <table className="w-full bg-white rounded shadow">
              <thead><tr className="text-left border-b"><th className="p-3">Name</th><th>Category</th><th>Price</th><th>Available</th><th>Ingredients</th><th></th></tr></thead>
              <tbody>
                {dishes.map(d => (
                  <tr key={d._id} className="border-b">
                    <td className="p-3">{d.name}</td>
                    <td>{d.category}</td>
                    <td>${d.price.toFixed(2)}</td>
                    <td><input type="checkbox" checked={d.available} onChange={() => handleToggleAvailability(d)} /></td>
                    <td>{d.ingredients?.length ?? 0}</td>
                    <td className="text-right pr-3">
                      <button onClick={() => setHistoryDish(d)} title="History" className="mr-2"><FaHistory /></button>
                      <button onClick={() => setEditing({ mode: "edit", dish: d })} title="Edit" className="mr-2"><FaEdit /></button>
                      <button onClick={() => setDeletingId(d._id)} title="Delete" className="text-red-600"><FaTrash /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DishFormModal
          isOpen={!!editing}
          mode={editing?.mode ?? "create"}
          dish={editing?.dish}
          ingredientOptions={ingredients}
          onSubmit={handleSubmit}
          onCancel={() => setEditing(null)}
        />
        <ConfirmationModal
          isOpen={!!deletingId}
          title="Delete dish"
          body="This dish will be removed from the menu. This action cannot be undone."
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
        />
        {historyDish && (
          <ConfirmationModal
            isOpen={true}
            title={`Pricing history — ${historyDish.name}`}
            body={<PricingHistoryChart history={historyDish.priceHistory ?? []} />}
            confirmLabel="Close"
            onConfirm={() => setHistoryDish(null)}
            onCancel={() => setHistoryDish(null)}
          />
        )}
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      </DashboardLayout>
    );
  }

  function Toast({ kind, text, onClose }) {
    return <div className={`fixed bottom-4 right-4 px-4 py-2 rounded shadow text-white ${kind === "success" ? "bg-green-600" : "bg-red-600"}`} onClick={onClose}>{text}</div>;
  }
  ```

  Implementation notes:
  - Follow the contract in `contracts/menu-management.md` exactly. Do not add columns or actions not listed there.
  - The 401 case is handled by the existing axios response interceptor (no special code here).
  - `dishes` is the source of truth for the populated state; do not introduce a separate filtered state in this iteration (filtering by category is out of scope for the MVP).

- [X] T0 [US1] In `Server/src/interfaces/controllers/menu.controller.js`, ensure `update`, `remove`, and `add` controllers populate `priceHistory` correctly:
  - `add`: initialize `priceHistory: []`, `version: 0`.
  - `update`: if `req.body.price !== undefined && req.body.price !== currentDish.price`, push `{ price: req.body.price, changedAt: new Date(), changedBy: req.user?._id ?? null }` into `priceHistory`. Cap to last 10 entries (`$slice: -10`).
  - `update` and `remove`: implement optimistic concurrency per T014.

**Checkpoint US1**: Run `quickstart.md` §1 manually. All seven steps including the concurrency check pass.

---

## Phase 4: User Story 2 — Demand Forecast (Priority: P1)

**Goal**: Deliver an admin-only `/ai/forecast` page that visualizes per-day predicted quantity with a confidence band, supports 7/30-day toggle, exports CSV client-side, surfaces a spike-alert banner, and shows a staffing suggestion. Degrades cleanly when the AI service is down.

**Independent test**: `quickstart.md` §3.

**Contract**: `contracts/demand-forecast.md`.

### Implementation

- [X] T0 [P] [US2] Create `Client/src/components/ai/ForecastChart.jsx`. Props: `{ data: ForecastResult['forecast'] }`. Use Recharts `<ComposedChart data={data}>` with:
  - `<CartesianGrid />`
  - `<XAxis dataKey="date" />`
  - `<YAxis />`
  - `<Tooltip />`
  - `<Area type="monotone" dataKey="upperBound" stroke="none" fill="#8884d8" fillOpacity={0.15} />`
  - `<Area type="monotone" dataKey="lowerBound" stroke="none" fill="#ffffff" fillOpacity={1} />` (inverse mask to render the band)
  - `<Line type="monotone" dataKey="predictedQuantity" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} />`

  If the simple band rendering above doesn't satisfy the implementing model, fall back to two `<Area>` components stacked, or a single `<Area>` plotting `[lowerBound, upperBound]` ranges. The visual goal: a shaded confidence band with a clear prediction line on top.

- [X] T0 [P] [US2] Create `Client/src/components/ai/DemandAlertBanner.jsx`. Props: `{ alert: ForecastResult['spikeAlert'], dishName: string }`. Renders only when `alert?.triggered === true`. Body: "Demand spike: {dishName} forecast peaks at {peakQuantity} on {peakDay} ({Math.round(alert.ratio * 100)}% of trailing 30-day average)." Tailwind classes: amber background, dark amber text, rounded, padding.

- [X] T0 [P] [US2] Create `Client/src/components/ai/StaffingSuggestionCard.jsx`. Props: `{ suggestion: ForecastResult['staffingSuggestion'] }`. Returns `null` if `suggestion.suggestedAddedStaff === 0`. Otherwise render a card showing busiest day, forecasted orders, and the suggested added staff count.

- [X] T0 [US2] Create `Client/src/pages/ai/DemandForecast.jsx`. Replace the placeholder. Outline:

  ```jsx
  import { useEffect, useState } from "react";
  import DashboardLayout from "../../layouts/DashboardLayout";
  import api from "../../api/axios";
  import { aiCall } from "../../api/aiCall";
  import LoadingState from "../../components/shared/LoadingState";
  import ErrorState   from "../../components/shared/ErrorState";
  import EmptyState   from "../../components/shared/EmptyState";
  import ForecastChart from "../../components/ai/ForecastChart";
  import DemandAlertBanner from "../../components/ai/DemandAlertBanner";
  import StaffingSuggestionCard from "../../components/ai/StaffingSuggestionCard";

  export default function DemandForecast() {
    const [dishes, setDishes] = useState([]);
    const [selectorState, setSelectorState] = useState("loading"); // 'loading'|'error'|'ready'
    const [dishId, setDishId] = useState("");
    const [days, setDays]     = useState(7);
    const [forecastState, setForecastState] = useState("idle");   // 'idle'|'loading'|'ready'|'error'|'ai-unavailable'|'insufficient-history'
    const [forecast, setForecast] = useState(null);

    useEffect(() => {
      api.get("/menu").then(r => { setDishes(r.data.data ?? r.data); setSelectorState("ready"); })
                      .catch(() => setSelectorState("error"));
    }, []);

    useEffect(() => {
      if (!dishId) { setForecastState("idle"); setForecast(null); return; }
      setForecastState("loading"); setForecast(null);
      aiCall("post", "/ai/forecast", { dishId, daysAhead: days }).then(res => {
        if (!res.ok) {
          setForecastState(res.kind === "ai_unavailable" ? "ai-unavailable" : "error");
          return;
        }
        setForecast(res.data);
        if (res.data.historyStatus === "insufficient") setForecastState("insufficient-history");
        else if ((res.data.forecast ?? []).length === 0) setForecastState("idle");
        else setForecastState("ready");
      });
    }, [dishId, days]);

    function exportCsv() {
      if (!forecast?.forecast?.length) return;
      const header = "date,predictedQuantity,lowerBound,upperBound\n";
      const rows = forecast.forecast.map(r => `${r.date},${r.predictedQuantity},${r.lowerBound},${r.upperBound}`).join("\n");
      const blob = new Blob([header + rows], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `forecast-${forecast.dishName}-${days}d-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }

    return (
      <DashboardLayout>
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-semibold">Demand Forecast</h1>
          <div className="flex gap-3 items-center">
            {selectorState === "loading" && <span className="text-gray-500">Loading dishes…</span>}
            {selectorState === "error"   && <span className="text-red-600">Failed to load dishes.</span>}
            {selectorState === "ready"   && (
              <select value={dishId} onChange={e => setDishId(e.target.value)} className="border p-2 rounded">
                <option value="">Choose a dish…</option>
                {dishes.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            )}
            <div className="flex gap-1">
              {[7, 30].map(n => (
                <button key={n} onClick={() => setDays(n)} className={`px-3 py-1 rounded ${days === n ? "bg-blue-600 text-white" : "bg-gray-200"}`}>{n}d</button>
              ))}
            </div>
            <button onClick={exportCsv} disabled={forecastState !== "ready"} className="ml-auto bg-gray-100 px-3 py-1 rounded">Export CSV</button>
          </div>

          {forecastState === "idle"             && <EmptyState title="Pick a dish" message="Choose a dish above to see its demand forecast." />}
          {forecastState === "loading"          && <LoadingState message="Generating forecast…" />}
          {forecastState === "error"            && <ErrorState message="Failed to load forecast." onRetry={() => setDishId(dishId)} />}
          {forecastState === "ai-unavailable"   && <ErrorState title="AI forecast service unavailable" message="Try again later." onRetry={() => setDishId(dishId)} />}
          {forecastState === "insufficient-history" && (
            <div className="space-y-3">
              <div className="bg-blue-50 text-blue-800 p-3 rounded">Insufficient history for spike detection (this dish has fewer than 14 days of order history).</div>
              {forecast?.forecast?.length > 0 && <ForecastChart data={forecast.forecast} />}
            </div>
          )}
          {forecastState === "ready" && forecast && (
            <>
              {forecast.spikeAlert?.triggered && <DemandAlertBanner alert={forecast.spikeAlert} dishName={forecast.dishName} />}
              <ForecastChart data={forecast.forecast} />
              <ForecastTable data={forecast.forecast} />
              <StaffingSuggestionCard suggestion={forecast.staffingSuggestion} />
            </>
          )}
        </div>
      </DashboardLayout>
    );
  }

  function ForecastTable({ data }) {
    return (
      <table className="w-full bg-white rounded shadow">
        <thead><tr className="text-left border-b"><th className="p-2">Date</th><th>Predicted</th><th>Lower</th><th>Upper</th></tr></thead>
        <tbody>{data.map(r => <tr key={r.date} className="border-b"><td className="p-2">{r.date}</td><td>{r.predictedQuantity}</td><td>{r.lowerBound}</td><td>{r.upperBound}</td></tr>)}</tbody>
      </table>
    );
  }
  ```

  Acceptance: every state in the contract's state machine is reachable; the chart renders a confidence band; CSV export downloads a file with the exact column header `date,predictedQuantity,lowerBound,upperBound`.

**Checkpoint US2**: Run `quickstart.md` §3. All steps pass, including the AI-failure step that must show no fabricated values.

---

## Phase 5: User Story 3 — Dynamic Pricing (Priority: P1)

**Goal**: Deliver an admin-only `/ai/pricing` page showing per-dish pricing recommendations with apply/revert/bulk-apply controls; bulk apply respects the active filter; partial failures are reported per-item.

**Independent test**: `quickstart.md` §4.

**Contract**: `contracts/dynamic-pricing.md`.

### Implementation

- [X] T0 [P] [US3] Create `Client/src/components/ai/PricingCard.jsx`. Props: `{ rec: PricingRecommendation, onApply, onRevert }`. Renders current price, suggested price, an arrow icon (`FaArrowUp` for `direction === 'up'`, `FaArrowDown` for `'down'`, `FaEquals` for `'none'`), demand-score bar (Tailwind width style scaled to `demandScore * 100`%), confidence percent (color: green ≥0.7, amber 0.5–0.7, red <0.5), and the recent history mini-list.

- [X] T0 [US3] Create `Client/src/pages/ai/DynamicPricing.jsx`. Replace placeholder. Outline:

  ```jsx
  import { useEffect, useMemo, useState } from "react";
  import DashboardLayout from "../../layouts/DashboardLayout";
  import api from "../../api/axios";
  import { aiCall } from "../../api/aiCall";
  import LoadingState from "../../components/shared/LoadingState";
  import ErrorState   from "../../components/shared/ErrorState";
  import EmptyState   from "../../components/shared/EmptyState";
  import FilterPills  from "../../components/shared/FilterPills";
  import ConfirmationModal from "../../components/shared/ConfirmationModal";
  import PricingCard from "../../components/ai/PricingCard";

  const FILTERS = [
    { value: "all",      label: "All" },
    { value: "increase", label: "Suggested increase" },
    { value: "decrease", label: "Suggested decrease" },
    { value: "none",     label: "No change" }
  ];

  export default function DynamicPricing() {
    const [pageState, setPageState] = useState("loading");
    const [recs, setRecs] = useState([]);
    const [filter, setFilter] = useState("all");
    const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
    const [singleConfirm, setSingleConfirm] = useState(null);
    const [resultsModal, setResultsModal] = useState(null);
    const [toast, setToast] = useState(null);

    async function load() {
      setPageState("loading");
      const res = await aiCall("post", "/pricing/suggest", {});
      if (!res.ok) { setPageState(res.kind === "ai_unavailable" ? "ai-unavailable" : "error"); return; }
      const data = res.data ?? [];
      setRecs(data);
      setPageState(data.length === 0 ? "empty" : "ready");
    }
    useEffect(() => { load(); }, []);

    const visibleRecs = useMemo(() => {
      if (filter === "all") return recs;
      return recs.filter(r => r.direction === filter || (filter === "none" && r.direction === "none"));
    }, [recs, filter]);

    const projectedImpact = useMemo(
      () => visibleRecs.reduce((sum, r) => sum + (r.suggestedPrice - r.currentPrice) * (r.demandScore * 100 || 0), 0),
      [visibleRecs]
    );

    async function applyMany(ids) {
      const __versions = Object.fromEntries(recs.filter(r => ids.includes(r.dishId)).map(r => [r.dishId, r.__version]));
      try {
        setPageState("applying");
        const r = await api.post("/pricing/apply", { dishIds: ids, __versions });
        const body = r.data.data ?? r.data;
        setResultsModal(body);
        await load();
      } catch {
        setToast({ kind: "error", text: "Apply failed." });
        setPageState("ready");
      }
    }

    return (
      <DashboardLayout>
        <div className="p-6 space-y-4">
          <header className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Dynamic Pricing</h1>
            <button
              disabled={pageState !== "ready" || visibleRecs.length === 0}
              onClick={() => setBulkConfirmOpen(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
              Apply all
            </button>
          </header>
          <FilterPills options={FILTERS} value={filter} onChange={(v) => setFilter(v ?? "all")} />

          {pageState === "loading"        && <LoadingState message="Loading recommendations…" />}
          {pageState === "ai-unavailable" && <ErrorState title="AI pricing service unavailable" message="Try again later." onRetry={load} />}
          {pageState === "error"          && <ErrorState message="Failed to load recommendations." onRetry={load} />}
          {pageState === "empty"          && <EmptyState title="No recommendations" message="No pricing changes recommended right now." />}
          {(pageState === "ready" || pageState === "applying") && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleRecs.map(rec => (
                <PricingCard
                  key={rec.dishId}
                  rec={rec}
                  onApply={() => setSingleConfirm(rec)}
                  onRevert={async () => { await api.post("/pricing/revert", { dishId: rec.dishId, __version: rec.__version }); await load(); }}
                />
              ))}
            </div>
          )}
        </div>

        <ConfirmationModal
          isOpen={!!singleConfirm}
          title="Apply this pricing change?"
          body={singleConfirm && (
            <div>
              <p>Change <strong>{singleConfirm.dishName}</strong> from ${singleConfirm.currentPrice.toFixed(2)} to ${singleConfirm.suggestedPrice.toFixed(2)}.</p>
              <p className="text-sm text-gray-600 mt-2">Confidence: {Math.round(singleConfirm.confidence * 100)}%.</p>
            </div>
          )}
          onConfirm={() => { applyMany([singleConfirm.dishId]); setSingleConfirm(null); }}
          onCancel={() => setSingleConfirm(null)}
        />

        <ConfirmationModal
          isOpen={bulkConfirmOpen}
          title="Apply all visible recommendations?"
          body={
            <div>
              <p>Apply {visibleRecs.length} {filter === "all" ? "recommendations" : `suggested ${filter === "increase" ? "increases" : filter === "decrease" ? "decreases" : "no-change"}`} to currently displayed dishes?</p>
              <p className="text-sm text-gray-600 mt-2">Projected revenue impact: ${projectedImpact.toFixed(2)}/day (estimate).</p>
            </div>
          }
          onConfirm={() => { applyMany(visibleRecs.map(r => r.dishId)); setBulkConfirmOpen(false); }}
          onCancel={() => setBulkConfirmOpen(false)}
        />

        {resultsModal && <ResultsModal results={resultsModal} onClose={() => setResultsModal(null)} />}
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      </DashboardLayout>
    );
  }

  function ResultsModal({ results, onClose }) {
    const { applied = [], conflicts = [], failed = [] } = results;
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center" onClick={onClose}>
        <div className="bg-white rounded p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
          <h3 className="text-xl font-semibold mb-3">Apply results</h3>
          <p>Applied: {applied.length}</p>
          <p>Conflicts: {conflicts.length}</p>
          <p>Failed: {failed.length}</p>
          {(conflicts.length || failed.length) > 0 && (
            <ul className="mt-3 text-sm text-gray-700 max-h-48 overflow-auto">
              {[...conflicts, ...failed].map(x => <li key={x.dishId}>{x.dishId}: {x.message}</li>)}
            </ul>
          )}
          <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  function Toast({ kind, text, onClose }) { return <div className={`fixed bottom-4 right-4 px-4 py-2 rounded shadow text-white ${kind === "success" ? "bg-green-600" : "bg-red-600"}`} onClick={onClose}>{text}</div>; }
  ```

- [X] T0 [US3] Update `Server/src/interfaces/controllers/pricing.controller.js`'s `apply` handler to:
  - Accept `{ dishIds: string[], __versions: { [dishId]: number } }` in the body.
  - For each dishId, attempt the optimistic-version-protected update of the corresponding Dish (price = suggested price; push to `priceHistory`).
  - Build three response buckets:
    ```js
    { applied: [{ dishId, oldPrice, newPrice }], conflicts: [{ dishId, currentVersion, message }], failed: [{ dishId, errorType, message }] }
    ```
  - Return HTTP 200 with `{ success: true, data: { applied, conflicts, failed } }` regardless of partial failures (so the page can render the per-bucket summary).

- [X] T0 [US3] Update `Server/src/interfaces/controllers/pricing.controller.js`'s `revert` handler to:
  - Accept `{ dishId, __version }`.
  - Look up the second-most-recent entry in `priceHistory` (the previous price), set `price` to that value, push a new entry to `priceHistory` for the revert, all under the same optimistic-concurrency pattern.
  - Return 409 if version mismatches; 404 if no previous price exists.

**Checkpoint US3**: Run `quickstart.md` §4. Verify that `Apply all` under a filter only changes the filtered subset (verify on `/admin/menu`).

---

## Phase 6: User Story 4 — User & Staff Management (Priority: P2)

**Goal**: Admin-only `/admin/users` page listing all users with status filters, approve/reject controls for pending, and inline role change.

**Independent test**: `quickstart.md` §2.

**Contract**: `contracts/user-management.md`.

### Implementation

- [X] T0 [P] [US4] Create `Client/src/components/users/StatusBadge.jsx`. Props: `{ status: 'active'|'pending'|'inactive' }`. Returns a small pill: green for active, amber for pending, red for inactive.

- [X] T0 [P] [US4] Create `Client/src/components/users/RoleDropdown.jsx`. Props: `{ value, onChange, disabled? }`. Native `<select>` with options `admin`, `staff`, `customer`.

- [X] T0 [US4] Create `Client/src/pages/admin/UserManagement.jsx`. Replace placeholder. Outline:

  ```jsx
  import { useEffect, useMemo, useState } from "react";
  import DashboardLayout from "../../layouts/DashboardLayout";
  import api from "../../api/axios";
  import LoadingState from "../../components/shared/LoadingState";
  import ErrorState from "../../components/shared/ErrorState";
  import EmptyState from "../../components/shared/EmptyState";
  import FilterPills from "../../components/shared/FilterPills";
  import StatusBadge from "../../components/users/StatusBadge";
  import RoleDropdown from "../../components/users/RoleDropdown";

  const FILTERS = [
    { value: "all",      label: "All" },
    { value: "pending",  label: "Pending" },
    { value: "active",   label: "Active" },
    { value: "inactive", label: "Inactive" }
  ];

  export default function UserManagement() {
    const [pageState, setPageState] = useState("loading");
    const [users, setUsers] = useState([]);
    const [filter, setFilter] = useState("all");
    const [toast, setToast] = useState(null);

    async function load() {
      setPageState("loading");
      try {
        const r = await api.get("/auth/users");
        const data = r.data.data ?? r.data;
        setUsers(data);
        setPageState("ready");
      } catch { setPageState("error"); }
    }
    useEffect(() => { load(); }, []);

    const filtered = useMemo(() => filter === "all" ? users : users.filter(u => u.status === filter), [users, filter]);

    async function patchUser(u, body) {
      try {
        await api.patch(`/auth/users/${u._id}`, { ...body, __version: u.version });
        await load();
      } catch (err) {
        if (err.response?.status === 409) { setToast({ kind: "error", text: err.response.data.message }); await load(); }
        else                              { setToast({ kind: "error", text: "Update failed." }); }
      }
    }

    return (
      <DashboardLayout>
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-semibold">Users</h1>
          <FilterPills options={FILTERS} value={filter} onChange={(v) => setFilter(v ?? "all")} />

          {pageState === "loading" && <LoadingState message="Loading users…" />}
          {pageState === "error"   && <ErrorState message="Failed to load users." onRetry={load} />}
          {pageState === "ready"   && filtered.length === 0 && <EmptyState title="No users match this filter" message="" />}
          {pageState === "ready"   && filtered.length > 0   && (
            <table className="w-full bg-white rounded shadow">
              <thead><tr className="text-left border-b"><th className="p-3">Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u._id} className="border-b">
                    <td className="p-3">{u.name}</td>
                    <td>{u.email}</td>
                    <td><RoleDropdown value={u.role} onChange={(role) => patchUser(u, { role })} /></td>
                    <td><StatusBadge status={u.status} /></td>
                    <td className="text-right pr-3">
                      {u.status === "pending" && (
                        <>
                          <button className="bg-green-600 text-white px-3 py-1 rounded mr-2" onClick={() => patchUser(u, { status: "active" })}>Approve</button>
                          <button className="bg-red-600   text-white px-3 py-1 rounded"      onClick={() => patchUser(u, { status: "inactive" })}>Reject</button>
                        </>
                      )}
                      {u.status === "active" && (
                        <button className="bg-gray-200 px-3 py-1 rounded" onClick={() => patchUser(u, { status: "inactive" })}>Deactivate</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      </DashboardLayout>
    );
  }
  function Toast({ kind, text, onClose }) { return <div className={`fixed bottom-4 right-4 px-4 py-2 rounded shadow text-white ${kind === "success" ? "bg-green-600" : "bg-red-600"}`} onClick={onClose}>{text}</div>; }
  ```

**Checkpoint US4**: Run `quickstart.md` §2.

---

## Phase 7: User Story 5 — Customer Management (Priority: P2)

**Goal**: `/customers` page (admin + staff) listing customers with derived tags; clicking a row opens a side drawer with order history, favorites, and AI recommendations. The recommendations region degrades independently when the AI service is unavailable.

**Independent test**: `quickstart.md` §5.

**Contract**: `contracts/customer-management.md`.

### Implementation

- [X] T0 [P] [US5] Create `Client/src/components/customers/CustomerTagBadges.jsx`. Props: `{ tags: string[] }`. Renders one Tailwind pill per tag with these color tokens: `Regular` → blue, `High Value` → green, `At Risk` → amber.

- [X] T0 [US5] Create `Client/src/pages/CustomerManagement.jsx`. Replace placeholder. Outline:

  ```jsx
  import { useEffect, useState } from "react";
  import DashboardLayout from "../layouts/DashboardLayout";
  import api from "../api/axios";
  import { aiCall } from "../api/aiCall";
  import LoadingState from "../components/shared/LoadingState";
  import ErrorState from "../components/shared/ErrorState";
  import EmptyState from "../components/shared/EmptyState";
  import DetailDrawer from "../components/shared/DetailDrawer";
  import CustomerTagBadges from "../components/customers/CustomerTagBadges";

  export default function CustomerManagement() {
    const [pageState, setPageState] = useState("loading");
    const [customers, setCustomers] = useState([]);
    const [openId, setOpenId] = useState(null);
    const [detailState, setDetailState] = useState("idle"); // 'idle'|'loading'|'ready'|'error'
    const [detail, setDetail] = useState(null);
    const [recsState, setRecsState] = useState("idle");    // 'idle'|'loading'|'ready'|'ai-unavailable'|'error'
    const [recs, setRecs] = useState([]);

    async function load() {
      setPageState("loading");
      try {
        const r = await api.get("/customers");
        const data = r.data.data ?? r.data;
        setCustomers(data);
        setPageState(data.length === 0 ? "empty" : "ready");
      } catch { setPageState("error"); }
    }
    useEffect(() => { load(); }, []);

    useEffect(() => {
      if (!openId) { setDetail(null); setRecs([]); setDetailState("idle"); setRecsState("idle"); return; }
      setDetailState("loading"); setRecsState("loading");
      api.get(`/customers/${openId}`)
         .then(r => { setDetail(r.data.data ?? r.data); setDetailState("ready"); })
         .catch(() => setDetailState("error"));
      aiCall("get", `/recommend/${openId}`).then(res => {
        if (!res.ok) { setRecsState(res.kind === "ai_unavailable" ? "ai-unavailable" : "error"); return; }
        setRecs(res.data.dishes ?? []);
        setRecsState("ready");
      });
    }, [openId]);

    return (
      <DashboardLayout>
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-semibold">Customers</h1>
          {pageState === "loading" && <LoadingState message="Loading customers…" />}
          {pageState === "error"   && <ErrorState message="Failed to load customers." onRetry={load} />}
          {pageState === "empty"   && <EmptyState title="No customers yet" message="" />}
          {pageState === "ready"   && (
            <table className="w-full bg-white rounded shadow">
              <thead><tr className="text-left border-b"><th className="p-3">Name / Phone</th><th>Orders</th><th>Total spend</th><th>Last order</th><th>Favorites</th><th>Tags</th></tr></thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c._id} className="border-b cursor-pointer hover:bg-gray-50" onClick={() => setOpenId(c._id)}>
                    <td className="p-3"><div>{c.name}</div><div className="text-xs text-gray-500">{c.phone}</div></td>
                    <td>{c.totalOrders}</td>
                    <td>${(c.totalSpend ?? 0).toFixed(2)}</td>
                    <td>{c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString() : "—"}</td>
                    <td>{c.favoritesCount ?? 0}</td>
                    <td><CustomerTagBadges tags={c.tags ?? []} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DetailDrawer isOpen={!!openId} onClose={() => setOpenId(null)} title={detail?.name ?? "Customer"}>
          {detailState === "loading" && <LoadingState message="Loading customer…" />}
          {detailState === "error"   && <ErrorState message="Failed to load customer." onRetry={() => setOpenId(openId)} />}
          {detailState === "ready" && detail && (
            <div className="space-y-4 p-4">
              <div className="space-y-1">
                <div className="text-sm text-gray-500">{detail.phone} · {detail.email ?? "no email"}</div>
                <CustomerTagBadges tags={detail.tags ?? []} />
              </div>

              <section>
                <h4 className="font-semibold mb-2">Order history</h4>
                {(detail.orderHistory ?? []).length === 0
                  ? <EmptyState title="No orders yet" message="" />
                  : <ul className="space-y-2">
                      {detail.orderHistory.map(o => (
                        <li key={o.orderId} className="border-b pb-2">
                          <div className="text-sm">{new Date(o.placedAt).toLocaleString()} · ${o.total.toFixed(2)} · {o.status}</div>
                          <div className="text-xs text-gray-500">{o.items.map(i => `${i.dishName} × ${i.quantity}`).join(", ")}</div>
                        </li>
                      ))}
                    </ul>}
              </section>

              <section>
                <h4 className="font-semibold mb-2">Favorites</h4>
                {(detail.favorites ?? []).length === 0
                  ? <div className="text-sm text-gray-500">No favorites yet.</div>
                  : <ul className="text-sm">
                      {detail.favorites.map(f => <li key={f.dishId}>{f.dishName} ({f.orderCount}×)</li>)}
                    </ul>}
              </section>

              <section>
                <h4 className="font-semibold mb-2">Personalized recommendations</h4>
                {recsState === "loading"        && <LoadingState message="Loading recommendations…" />}
                {recsState === "ai-unavailable" && <ErrorState title="Recommendations unavailable" message="Try again later." onRetry={() => setOpenId(openId)} />}
                {recsState === "error"          && <ErrorState message="Failed to load recommendations." onRetry={() => setOpenId(openId)} />}
                {recsState === "ready"          && (recs.length === 0
                  ? <EmptyState title="Cold-start customer" message="Not enough order history yet to generate personalized picks." />
                  : <ul className="text-sm">{recs.map(r => <li key={r.dishId}>{r.name} <span className="text-gray-500">({Math.round(r.score * 100)}% — {r.reason})</span></li>)}</ul>)}
              </section>
            </div>
          )}
        </DetailDrawer>
      </DashboardLayout>
    );
  }
  ```

**Checkpoint US5**: Run `quickstart.md` §5. Verify the recommendations region degrades alone (history + favorites stay visible).

---

## Phase 8: User Story 6 — Waste Management (Priority: P2)

**Goal**: `/waste` page (admin) showing summary cards, three waste charts, and a near-expiry table whose "Use in Recipe" action calls `POST /api/ai/recipe`. Each region degrades independently.

**Independent test**: `quickstart.md` §6.

**Contract**: `contracts/waste-management.md`.

### Implementation

- [X] T0 [P] [US6] Create `Client/src/components/waste/WasteSummaryCards.jsx`. Props: `{ summary }`. Renders four cards: This month total, Value, vs Last month (% with up/down arrow color), and Item count if available.

- [X] T0 [P] [US6] Create `Client/src/components/waste/WasteByIngredientChart.jsx`. Props: `{ data: Array<{ ingredientName, quantity, value }> }`. Recharts `<BarChart>` with `XAxis dataKey="ingredientName"` and `YAxis`, single `<Bar dataKey="quantity" fill="#4f46e5" />`. Render `EmptyState` if `data.length === 0`.

- [X] T0 [P] [US6] Create `Client/src/components/waste/WasteTrendChart.jsx`. Props: `{ data: Array<{ date, quantity, value }> }`. Recharts `<LineChart>` with `dataKey="date"` and a single line on `quantity`.

- [X] T0 [P] [US6] Create `Client/src/components/waste/WasteByCategoryChart.jsx`. Props: `{ data: Array<{ category, quantity }> }`. Recharts `<PieChart>` with a `<Pie data={data} dataKey="quantity" nameKey="category" cx="50%" cy="50%" outerRadius={80} label />`.

- [X] T0 [P] [US6] Create `Client/src/components/waste/NearExpiryTable.jsx`. Props: `{ items: NearExpiryItem[], onUseInRecipe }`. Render rows with name, quantity, unit, expiryDate, daysUntilExpiry, and a "Use in Recipe" button that calls `onUseInRecipe(item)`.

- [X] T0 [US6] Create `Client/src/pages/WasteManagement.jsx`. Replace placeholder. Outline:

  ```jsx
  import { useEffect, useState } from "react";
  import DashboardLayout from "../layouts/DashboardLayout";
  import api from "../api/axios";
  import { aiCall } from "../api/aiCall";
  import LoadingState from "../components/shared/LoadingState";
  import ErrorState from "../components/shared/ErrorState";
  import EmptyState from "../components/shared/EmptyState";
  import WasteSummaryCards       from "../components/waste/WasteSummaryCards";
  import WasteByIngredientChart  from "../components/waste/WasteByIngredientChart";
  import WasteTrendChart         from "../components/waste/WasteTrendChart";
  import WasteByCategoryChart    from "../components/waste/WasteByCategoryChart";
  import NearExpiryTable         from "../components/waste/NearExpiryTable";
  import ConfirmationModal       from "../components/shared/ConfirmationModal";

  export default function WasteManagement() {
    const [pageState, setPageState] = useState("loading");
    const [waste, setWaste] = useState(null);
    const [nearExpiry, setNearExpiry] = useState([]);
    const [nearExpiryError, setNearExpiryError] = useState(false);
    const [recipeFor, setRecipeFor] = useState(null);
    const [recipeState, setRecipeState] = useState("idle"); // 'idle'|'loading'|'ready'|'ai-unavailable'|'error'
    const [recipe, setRecipe] = useState(null);

    async function load() {
      setPageState("loading");
      try {
        const [dRes, neRes] = await Promise.allSettled([api.get("/dashboard/admin"), api.get("/inventory/near-expiry")]);
        if (dRes.status === "rejected") { setPageState("error"); return; }
        const dash = dRes.value.data.data ?? dRes.value.data;
        setWaste(dash.waste ?? null);
        if (neRes.status === "rejected") { setNearExpiry([]); setNearExpiryError(true); }
        else                             { setNearExpiry(neRes.value.data.data ?? neRes.value.data); setNearExpiryError(false); }
        setPageState("ready");
      } catch { setPageState("error"); }
    }
    useEffect(() => { load(); }, []);

    async function generateRecipe(item) {
      setRecipeFor(item); setRecipeState("loading"); setRecipe(null);
      const res = await aiCall("post", "/ai/recipe", { ingredients: [{ name: item.name, quantity: item.quantity, unit: item.unit }] });
      if (!res.ok) { setRecipeState(res.kind === "ai_unavailable" ? "ai-unavailable" : "error"); return; }
      setRecipe(res.data); setRecipeState("ready");
    }

    return (
      <DashboardLayout>
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-semibold">Waste Management</h1>

          {pageState === "loading" && <LoadingState message="Loading waste analytics…" />}
          {pageState === "error"   && <ErrorState message="Failed to load dashboard." onRetry={load} />}
          {pageState === "ready"   && (
            <>
              {waste?.summary
                ? <WasteSummaryCards summary={waste.summary} />
                : <EmptyState title="No waste data yet" message="" />}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Section title="By ingredient">
                  {(waste?.byIngredient?.length ?? 0) === 0
                    ? <EmptyState title="No data" message="" />
                    : <WasteByIngredientChart data={waste.byIngredient} />}
                </Section>
                <Section title="By category">
                  {(waste?.byCategory?.length ?? 0) === 0
                    ? <EmptyState title="No data" message="" />
                    : <WasteByCategoryChart data={waste.byCategory} />}
                </Section>
                <Section title="Trend">
                  {(waste?.trend?.length ?? 0) === 0
                    ? <EmptyState title="No data" message="" />
                    : <WasteTrendChart data={waste.trend} />}
                </Section>
                <Section title="Near-expiry">
                  {nearExpiryError
                    ? <ErrorState message="Failed to load near-expiry items." onRetry={load} />
                    : nearExpiry.length === 0
                      ? <EmptyState title="Nothing expiring within 3 days" message="" />
                      : <NearExpiryTable items={nearExpiry} onUseInRecipe={generateRecipe} />}
                </Section>
              </div>
            </>
          )}
        </div>

        <ConfirmationModal
          isOpen={!!recipeFor}
          title={`Recipe from ${recipeFor?.name ?? ""}`}
          body={
            <div>
              {recipeState === "loading"        && <LoadingState message="Generating recipe…" />}
              {recipeState === "ai-unavailable" && <ErrorState title="AI recipe service unavailable" message="Try again later." onRetry={() => generateRecipe(recipeFor)} />}
              {recipeState === "error"          && <ErrorState message="Failed to generate recipe." onRetry={() => generateRecipe(recipeFor)} />}
              {recipeState === "ready" && recipe && (
                <div className="space-y-2">
                  <h4 className="text-lg font-semibold">{recipe.name}</h4>
                  <p>{recipe.description}</p>
                  <h5 className="font-semibold">Ingredients</h5>
                  <ul className="text-sm list-disc pl-5">{(recipe.ingredients ?? []).map((i, idx) => <li key={idx}>{i.name ?? i} {i.quantity ? `— ${i.quantity} ${i.unit ?? ""}` : ""}</li>)}</ul>
                  <h5 className="font-semibold">Steps</h5>
                  <ol className="text-sm list-decimal pl-5 space-y-1">{(recipe.steps ?? []).map((s, idx) => <li key={idx}>{s}</li>)}</ol>
                </div>
              )}
            </div>
          }
          confirmLabel="Close"
          onConfirm={() => { setRecipeFor(null); setRecipeState("idle"); setRecipe(null); }}
          onCancel={() => { setRecipeFor(null); setRecipeState("idle"); setRecipe(null); }}
        />
      </DashboardLayout>
    );
  }

  function Section({ title, children }) {
    return <div className="bg-white rounded shadow p-4"><h3 className="font-semibold mb-2">{title}</h3>{children}</div>;
  }
  ```

- [X] T0 [US6] Confirm `Server/src/application/services/etl.service.js`'s dashboard aggregation populates the `waste` block as documented in `data-model.md` § WasteAggregate. If any sub-field is missing (`summary`, `byIngredient`, `byCategory`, `trend`), extend the aggregation to provide it. Use the existing waste-tracking fields on Ingredient (`wasteQuantity`, `costPerUnit`) plus order/inventory history. Do not invent data; if a sub-aggregate cannot be computed (no source data yet), return `[]` so the page renders the empty state.

**Checkpoint US6**: Run `quickstart.md` §6.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T060 [P] Run the full `quickstart.md` end-to-end including §7 (cross-cutting checks). Fix any deviations. The quickstart pass is the acceptance gate for this feature.
- [X] T061 Once US1 is functional, remove the buried admin menu logic from `Client/src/pages/OrderingSystem.jsx` (per FR-003 in spec and SC-003). The ordering screen should no longer expose dish create/edit/delete; those live exclusively at `/admin/menu` now. Keep ordering workflow itself untouched.
- [X] T062 [P] Visual consistency review: open `/dashboard`, then each of the six new pages, and verify spacing, typography, sidebar look, and color palette match. Adjust Tailwind classes only — do not add new CSS files unless absolutely necessary.
- [X] T063 [P] Verify all six new pages handle the four states (loading / empty / error / populated) per SC-011. Manually force each by stopping/starting the backend and clearing the DB.
- [X] T064 [P] Verify route guards block before page mount per SC-009. Open DevTools Network tab as a non-admin and navigate directly to `/admin/menu`, `/admin/users`, `/ai/forecast`, `/ai/pricing`, `/waste`. Confirm the redirect happens before any `/api/*` request is made by those pages.
- [X] T065 [P] Verify SC-010: with both backend and AI services down, no page displays a number, list, or shape that isn't sourced from a successful response. Walk every page and confirm.
- [X] T066 Final: update the spec status from `Draft` to `Implemented` (one-line change to `specs/003-missing-frontend-pages/spec.md` frontmatter).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies. Can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1. **Blocks all user stories.**
- **Phase 3 (US1) / Phase 4 (US2) / Phase 5 (US3)**: All P1; depend on Phase 2 only. Can run in parallel by different developers, since each story's files are disjoint.
- **Phase 6 (US4) / Phase 7 (US5) / Phase 8 (US6)**: All P2; depend on Phase 2 only. Can run in parallel with each other and with the P1 stories.
- **Phase 9 (Polish)**: Depends on all desired user stories being complete.

### Within each user story

- Components (`[P]` tasks) can be built in parallel since they live in different files.
- The page file (`MenuManagement.jsx`, `DemandForecast.jsx`, etc.) imports those components; build it last in each story.
- Backend changes specific to a story (e.g., T046, T047 for pricing) can be done in parallel with the frontend file but should land before manual quickstart verification.

### Parallel opportunities (sample for P1 stories)

```
Developer A: T035 → T036 → T037 → T038 → T039  (US1 Menu)
Developer B: T040 → T041 → T042 → T043          (US2 Forecast — also depends on T033)
Developer C: T044 → T045 → T046 → T047          (US3 Pricing)
```

All three can run after Phase 2 completes; none block each other.

---

## Implementation Strategy

### Recommended MVP path

1. Phase 1 → Phase 2 (Setup + Foundational). **No detours.**
2. Phase 3 (US1 — Menu Management) is the cleanest standalone P1 story to validate the foundational layer end-to-end. Run `quickstart.md` §1 and stop to confirm.
3. Phase 4 (US2 — Demand Forecast) and Phase 5 (US3 — Dynamic Pricing) — the two demo-critical AI pages. Each one is a meaningful demo step.
4. Phase 6–8 (P2 stories) in any order; they round out the feature.
5. Phase 9 (Polish). The quickstart pass is the acceptance gate.

### Parallel team strategy

After Phase 2 completes:
- Developer A: US1 → US4 (admin pages)
- Developer B: US2 → US3 (AI pages)
- Developer C: US5 → US6 (customer + waste pages)

Each pair shares no files, so merge conflicts are minimal.

---

## Notes

- **No new npm dependencies.** Every page is built from `react`, `react-router-dom`, `axios`, `recharts`, `react-icons`, and Tailwind. If you find yourself reaching for a new package, stop and re-read `research.md` — the answer is almost certainly already there.
- **No fabricated data.** Wherever the spec says "MUST NOT display fabricated values" (FR-010, FR-025, FR-032), use `aiCall` from T024 and the `ErrorState` component. Never zero-fill, never use Math.random, never substitute defaults.
- **Optimistic concurrency is everywhere.** Whenever you `PATCH` or `DELETE` a Dish, User, Customer, or pricing record, the request body MUST include `__version`. The page state must include `version` for every record it might mutate. Read `research.md` Decision 1 once and keep it close.
- **State machines, not flag soup.** Every page uses a single string state value (`'loading' | 'error' | 'empty' | 'ready'` or its variant) rather than separate booleans for `loading` / `error` / `data`. This is a hard rule — do not deviate.
- **Manual verification is the acceptance gate.** Automated tests are P5 scope. The quickstart pass is what closes this feature.
- **Commit after each task.** Small, traceable commits make the cheaper-LLM workflow safer.
