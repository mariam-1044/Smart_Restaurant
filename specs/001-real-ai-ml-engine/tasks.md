---
description: "Task list for Real AI/ML Engine — Replace All Mocks (Phase P0)"
---

# Tasks: Real AI/ML Engine — Replace All Mocks

**Input**: Design documents from `/specs/001-real-ai-ml-engine/`
**Prerequisites**: `plan.md` ✅, `spec.md` ✅, `research.md` ✅, `data-model.md` ✅, `contracts/` ✅, `quickstart.md` ✅

**Tests**: Test tasks ARE included. The constitution (Principle IV) mandates tests-first with ≥80% coverage on services and routes; the project plan also lists the test suite as a non-negotiable deliverable. Each user-story phase begins with its tests.

**Organization**: Tasks are grouped by user story (US1 → US5) per spec.md. Each story is independently implementable and independently testable.

## Format: `[ID] [P?] [Story] Description`

- `[P]` = task touches only its own file(s) and has no dependency on other unfinished tasks in the same phase → safe to parallelize.
- `[USn]` = task belongs to user story n (omitted for Setup / Foundational / Polish).
- Every task gives an absolute repo-relative file path. Exact symbol names, function signatures, and library calls are stated where they reduce ambiguity.

## Path Conventions (repo-relative, all paths from repo root)

- Node.js backend lives under `Server/`.
- Python ML service lives under `Server/ml_model_service/`.
- Tests live under `Server/__tests__/` (Jest) and `Server/ml_model_service/tests/` (pytest).
- The React client under `Client/` is **not touched in this phase** (per spec Assumption).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Toolchain, dependencies, test runners. Nothing here is story-specific.

- [X] T001 Add new runtime dependencies in `Server/package.json`: `axios`, `node-cron`. Add new devDependencies: `jest`, `supertest`, `mongodb-memory-server`, `@jest/globals`. Run `npm install` from `Server/`.
- [X] T002 [P] Create `Server/jest.config.js` (CommonJS-friendly — existing src is CJS). `testEnvironment: 'node'`, `testMatch: ['**/__tests__/**/*.test.js']`, `collectCoverageFrom: ['src/application/services/**/*.js', 'src/interfaces/controllers/**/*.js', 'src/routes/**/*.js']`, `coverageThreshold: { global: { lines: 80, branches: 80 } }`.
- [X] T003 [P] Add scripts to `Server/package.json`: `"test": "jest"`, `"test:coverage": "jest --coverage"`, `"cron:spoilage:run-once": "node src/infrastructure/cron/spoilage.cron.js --once"`, `"seed:ai-engine": "node scripts/seed-ai-engine.js"`.
- [X] T004 [P] Create `Server/ml_model_service/requirements.txt` containing exactly: `fastapi`, `uvicorn[standard]`, `pandas`, `numpy`, `scikit-learn`, `statsmodels`, `prophet`, `mlxtend`, `pymongo`, `python-dotenv`, `tenacity`, `pytest`, `httpx`, `pytest-asyncio`. (One package per line.)
- [X] T005 [P] Create `Server/ml_model_service/pyproject.toml` with `[tool.pytest.ini_options]` block: `testpaths = ["tests"]`, `asyncio_mode = "auto"`. Tells pytest where tests live.
- [X] T006 [P] Create `Server/.env.example` listing every variable from `quickstart.md` §1 with placeholder values: `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `OPENAI_API_KEY`, `ML_SERVICE_URL`, `NODE_ENV`, `PORT`. Do NOT commit a real `.env`.
- [X] T007 [P] Update root `.gitignore` to add (if missing): `Server/ml_model_service/.venv/`, `Server/ml_model_service/artifacts/`, `Server/ml_model_service/__pycache__/`, `**/*.pyc`, `Server/coverage/`, `Server/.env`.
- [X] T008 [P] Create `Server/ml_model_service/.env.example` with: `MONGODB_URI=mongodb://localhost:27017/smart_restaurant`, `MODEL_ARTIFACTS_DIR=./artifacts`, `LOG_LEVEL=info`. Required so the FastAPI process can read Mongo without depending on Node's `.env`.

**Checkpoint**: `npm install` succeeds in `Server/`; `pip install -r requirements.txt` succeeds in `Server/ml_model_service/` (after `python -m venv .venv` + activation per `quickstart.md` §2).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Models, middleware, helpers, FastAPI skeleton. **No user-story work may begin until this phase is complete.**

### Mongoose models (one file each — all [P], can run in parallel)

- [X] T009 [P] Create `Server/src/domain/models/RecommendationRating.js` exporting Mongoose model `RecommendationRating` with the schema in `data-model.md` §1 (fields: `customerId` ObjectId ref Customer required indexed, `dishId` ObjectId ref Dish required indexed, `recommendationContextId` ObjectId optional, `score` Number 1–5 integer required, `comment` String maxlength 500, `createdAt` Date default now indexed). Add compound index `{ customerId: 1, dishId: 1, createdAt: -1 }` and `{ dishId: 1, score: 1 }`.
- [X] T010 [P] Create `Server/src/domain/models/PublishedRecommendation.js` exporting model `PublishedRecommendation` with the schema in `data-model.md` §2 (fields: `customerId`, `dishId` indexed, `ratingId` ref RecommendationRating required, `ratingAtPublish` Number 4–5 integer required, `anonymizedHandle` String required, `status` String enum ['published','unpublished'] default 'published' indexed, `publishedAt` Date default now, `unpublishedAt` Date default null). Add **unique** compound index `{ customerId: 1, dishId: 1 }` and compound `{ dishId: 1, status: 1 }`.
- [X] T011 [P] Create `Server/src/domain/models/PriceHistory.js` exporting model `PriceHistory` with the schema in `data-model.md` §3 (fields: `dishId` ObjectId ref Dish required indexed, `priorPrice` Number min 0 required, `newPrice` Number min 0 required, `applierId` ObjectId ref User required, `applierRole` String enum ['admin','staff'] required, `source` String enum ['manager_apply','manager_revert','ai_bulk_apply'] required, `suggestionConfidence` Number 0–1, `revertOf` ObjectId ref PriceHistory default null, `createdAt` Date default now indexed). Add compound `{ dishId: 1, createdAt: -1 }` and sparse index `{ revertOf: 1 }`. Add a Mongoose pre-validate hook that throws if `source === 'manager_revert' && !this.revertOf` OR if `source !== 'manager_revert' && this.revertOf`.
- [X] T012 [P] Create `Server/src/domain/models/AIInferenceAudit.js` exporting model `AIInferenceAudit` with the schema in `data-model.md` §4 (fields: `callerId` ObjectId optional, `callerRole` String enum required, `capability` String required indexed, `route` String required, `method` String required, `outcome` String enum required, `latencyMs` Number min 0 required, `inputSummary` Object default {}, `errorCode` String default null, `correlationId` String indexed, `createdAt` Date default now indexed). Add compound `{ capability: 1, createdAt: -1 }` and `{ callerId: 1, createdAt: -1 }`.
- [X] T013 [P] Create `Server/src/domain/models/MarketBasketRule.js` exporting model `MarketBasketRule` with the schema in `data-model.md` §5 (fields: `antecedent` [ObjectId] ref Dish required, `consequent` [ObjectId] ref Dish required, `support` Number 0–1 required, `confidence` Number 0–1 required, `lift` Number min 0 required, `computedAt` Date required indexed). Add compound `{ computedAt: -1, lift: -1 }`.
- [X] T014 [P] Create `Server/src/domain/models/Notification.js` exporting model `Notification` with the **minimal** schema in `data-model.md` §6 (fields: `type` String enum ['spoilage_risk','spoilage_recipe_failed','system'] required indexed, `title` String required, `message` String required, `targetRole` String enum ['admin','staff','all'] default 'staff' indexed, `payload` Object default {}, `read` Boolean default false indexed, `readAt` Date default null, `createdAt` Date default now indexed). This is the minimal P3 stub justified in `plan.md` Complexity Tracking.

### Cross-cutting middleware, helpers, clients

- [X] T015 [P] Create `Server/src/infrastructure/config/ai.js` exporting an object `{ baseUrl: process.env.ML_SERVICE_URL || 'http://localhost:5002/v1', timeoutMs: 3000 }`. Replaces the orphaned port-8000 config (plan Bug 4). The 3-second timeout enforces spec FR-003.
- [X] T016 [P] Create `Server/src/infrastructure/config/openai.js` that imports `OpenAI` from `'openai'` and exports a single shared client `openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })`. Throw at import time if `OPENAI_API_KEY` is missing.
- [X] T017 [P] Create `Server/src/infrastructure/ml/ml-client.js` exporting an `axios` instance `mlClient` configured from `infrastructure/config/ai.js` (baseURL = `baseUrl`, timeout = `timeoutMs`). Add a response interceptor that converts any error (network, 5xx, timeout) into a typed error object `{ code: 'inference_unavailable', cause }` so callers can distinguish from validation errors.
- [X] T018 [P] Create `Server/src/interfaces/middleware/audit.middleware.js` exporting `auditMiddleware(capability)` — a higher-order Express middleware that wraps the next handler. On every call: capture start time, generate a correlation ID (uuid v4) if header `X-Correlation-Id` is absent, call next(), and after the response finishes, insert one row into `AIInferenceAudit` with `{ callerId: req.user?._id ?? null, callerRole: req.user?.role ?? 'public', capability, route: req.originalUrl, method: req.method, outcome: derivedFromResStatus(res.statusCode), latencyMs: Date.now() - start, inputSummary: shapeOf(req.body, req.params, req.query), errorCode: res.locals.errorCode ?? null, correlationId }`. The helper `shapeOf` MUST return only field names + scalar values (never free text like recipe comments).
- [X] T019 [P] Create `Server/src/interfaces/middleware/customer-self.middleware.js` exporting `assertOwnCustomerOrStaff(paramName = 'customerId')` — middleware that returns 403 (`{ error: { code: 'cross_customer_forbidden', ... } }`) unless `req.user.role` is `'admin'` or `'staff'`, OR `req.user.role === 'customer' && String(req.user.customerId) === String(req.params[paramName])`. This satisfies spec FR-004(a)(b) and SC-011.
- [X] T020 [P] Create `Server/src/interfaces/middleware/role.middleware.js` exporting `requireRole(...allowed)` — middleware that returns 403 unless `allowed.includes(req.user.role)`. Used by every AI route per spec FR-004.
- [X] T021 [P] Create `Server/src/application/services/audit.service.js` exporting `recordInference({ callerId, callerRole, capability, route, method, outcome, latencyMs, inputSummary, errorCode, correlationId })` that inserts an `AIInferenceAudit` document. The middleware in T018 delegates here so the call can also be invoked from the cron path (which has no Express request).

### Python FastAPI skeleton

- [X] T022 Create `Server/ml_model_service/main.py` containing a FastAPI app under prefix `/v1` with a `/health` route returning `{ status: 'ok', lastSuccessAt: <last-recorded-success-or-null>, modelsLoaded: { forecasting: 0, recommender: false, pricing: false } }`. Use a module-level `_state` dict that the model modules will mutate as they finish loading. Run with `uvicorn main:app --port 5002 --reload`.
- [X] T023 [P] Create `Server/ml_model_service/data/__init__.py` (empty).
- [X] T024 [P] Create `Server/ml_model_service/data/repository.py` exporting:
  - `get_db()` — returns a pymongo `Database` from `MONGODB_URI`.
  - `get_dish_order_history(dish_id: str, days: int = 365) -> pandas.DataFrame` — returns DataFrame columns `ds` (date) and `y` (qty) suitable for Prophet.
  - `get_category_orders_30d(category_id: str) -> pandas.DataFrame` — used by cold-start.
  - `get_customer_dish_matrix() -> tuple[csr_matrix, list[str], list[str]]` — sparse matrix + customer_ids + dish_ids for collaborative filtering.
  - `get_orders_for_basket(min_items: int = 2) -> list[list[str]]` — list of dish-id lists per multi-item order.
  - `get_pricing_features(dish_id: str) -> dict` — current price, ingredient cost, day-of-week one-hot, current sales count.
- [X] T025 [P] Create `Server/ml_model_service/models/__init__.py` (empty).
- [X] T026 [P] Create `Server/ml_model_service/tests/__init__.py` (empty).
- [X] T027 [P] Create `Server/ml_model_service/tests/test_health.py` — pytest using `httpx.AsyncClient` to assert `GET /v1/health` returns 200 with required fields. (Smoke for T022.)

### Constitution Principle III enforcement test (foundational because every story relies on it)

- [X] T028 [P] Create `Server/__tests__/no-mocks.test.js` that scans `Server/src/application/services/ai.service.js`, `Server/src/application/services/recommendation.service.js`, `Server/src/application/services/pricing.service.js`, and any future file under `Server/src/application/services/` for the regex `/Math\.random|fakeData|FAKE_|HARDCODED_/i` and **fails if any match**. Enforces constitution III + spec SC-001. Run on every CI build.

**Checkpoint**: All models exist; the FastAPI service starts and `/health` responds; `Server/__tests__/no-mocks.test.js` passes against the (still empty) ai.service.js. User-story work can now proceed in parallel.

---

## Phase 3: User Story 1 — Demand Forecasting (Priority: P1) 🎯 MVP

**Goal**: Admin can request a 7-day or 30-day demand forecast per dish; cold-start dishes fall back to recency-weighted day-of-week category baseline (spec FR-006 → FR-010, Q4 clarification).

**Independent Test**: Admin POSTs `/api/v1/ai/forecast` with a dish that has ≥30 days of history → receives a `ForecastResponse` with 7 points, `coldStart: false`, predicted/lower/upper for each. Same call for a never-ordered dish → `coldStart: true`, widened band. ML service offline → 503 within 3 s.

### Tests for User Story 1 (write FIRST, ensure they FAIL before implementation)

- [X] T029 [P] [US1] Create `Server/ml_model_service/tests/test_coldstart.py` asserting `compute_cold_start_forecast('cat-1', 7)` from `models.coldstart` returns 7 dicts with keys `date`, `predicted`, `lower`, `upper`. Mock `repository.get_category_orders_30d` to return a fixture DataFrame. Verify the recency weight (half-life 14 days) and DOW share calculation against a hand-computed expectation.
- [X] T030 [P] [US1] Create `Server/ml_model_service/tests/test_forecasting.py` asserting `forecast(dish_id, days=7)` from `models.forecasting`: (a) returns 7 points when ≥14 days of history exist, (b) raises `ColdStartError` when <14 days exist, (c) point values include `yhat`, `yhat_lower`, `yhat_upper` from a Prophet model. Mock `repository.get_dish_order_history`.
- [X] T031 [P] [US1] Create `Server/__tests__/services/ai.service.forecast.test.js` testing `aiService.predictDemand({ dishId, daysAhead })`: (a) calls `mlClient.post('/predict-sales', ...)` with the right body, (b) returns the response.data, (c) throws `InferenceUnavailableError` when mlClient errors, (d) writes to `AIInferenceAudit` (mock the model). Use Jest's `vi.mock`-equivalent (`jest.mock`) for `ml-client.js`.
- [X] T032 [P] [US1] Create `Server/__tests__/api/ai.forecast.test.js` using `supertest` against the Express app: (a) admin token + valid body → 200 + `ForecastResponse` shape per `contracts/node-api.openapi.yaml`, (b) staff token → 403, (c) no token → 401, (d) invalid `daysAhead` (e.g., 14) → 400 `validation_failed`, (e) ML service down → 503 within 3 s.

### Implementation for User Story 1

- [X] T033 [P] [US1] Create `Server/ml_model_service/models/coldstart.py` exporting `compute_cold_start_forecast(category_id: str, horizon_days: int) -> list[dict]` per `research.md` §11: pull 30-day category history, apply recency weight `0.5 ** ((today - d) / 14)`, compute weighted-mean daily quantity, compute DOW share (Mon–Sun), return one dict per horizon day with `predicted = weighted_mean * dow_share[day_of_week]`, `lower = predicted * 0.4`, `upper = predicted * 1.8`. Raise `ColdStartError("no_baseline")` if the 30-day baseline is empty (spec edge case).
- [X] T034 [US1] Create `Server/ml_model_service/models/forecasting.py` exporting `forecast(dish_id: str, days: int) -> dict`. Logic: (1) call `repository.get_dish_order_history(dish_id)`, (2) if `< 14` days of data, call `compute_cold_start_forecast(dish.category_id, days)` and return `{ "coldStart": True, "points": ... }`, (3) else fit a Prophet model on `(ds, y)`, predict `days` periods, return `{ "coldStart": False, "points": [...] }` with `predicted`, `lower`, `upper` per point. Cache the trained Prophet model in a module-level dict keyed by dish_id with the training date; reuse if same calendar day. Update `main._state['lastSuccessAt'] = datetime.utcnow()` on successful inference.
- [X] T035 [US1] In `Server/ml_model_service/main.py`, add the route `POST /v1/predict-sales` matching `contracts/ml-service.openapi.yaml`. Pydantic request model `PredictSalesRequest { dishId: str, daysAhead: Literal[7, 30] }`. Pydantic response per the OpenAPI shape. On `ColdStartError("no_baseline")` return HTTP 422 with `{ "error": { "code": "cold_start_no_data", "message": "..." } }`. Depends on T034.
- [X] T036 [US1] Create `Server/src/interfaces/validations/ai.validation.js` exporting Joi schema `forecastSchema` matching `ForecastRequest` in `contracts/node-api.openapi.yaml`: `dishId` MongoId required, `daysAhead` valid `[7, 30]` only.
- [X] T037 [US1] In `Server/src/application/services/ai.service.js` (rewrite — preserve only the function shells), implement `async predictDemand({ dishId, daysAhead })`. Logic: import `mlClient` from `infrastructure/ml/ml-client.js`, call `mlClient.post('/predict-sales', { dishId, daysAhead })`, return response.data. On the typed `inference_unavailable` error from the interceptor, throw `InferenceUnavailableError` (a small custom Error class — define at top of file). **No `Math.random`. No fallback data.**
- [X] T038 [US1] In `Server/src/interfaces/controllers/ai.controller.js`, add `forecast(req, res, next)`. Validate `req.body` with `forecastSchema` (return 400 on failure with `{ error: { code: 'validation_failed', ... } }`). Call `aiService.predictDemand(req.body)`. On success: 200 + payload. On `InferenceUnavailableError`: set `res.locals.errorCode = 'inference_unavailable'` and respond 503. Compute `staffingHint` if `sum(points.predicted) > 1.3 * trailing30dAvg(dishId)` — the trailing average lookup belongs in `aiService.getTrailing30dAvg(dishId)`; if it is too expensive, set hint to `null` for now and add a TODO referencing US1 acceptance scenario #4.
- [X] T039 [US1] In `Server/src/routes/ai.routes.js`, add `router.post('/forecast', requireRole('admin'), auditMiddleware('forecast'), aiController.forecast)`. Mount at `/api/v1/ai` in `Server/src/index.js`.

**Checkpoint**: `npm test -- ai.forecast` and `pytest tests/test_forecasting.py tests/test_coldstart.py` both pass. The acceptance scenarios in `quickstart.md` §5 US1 succeed against a seeded DB.

---

## Phase 4: User Story 2 — Recipe Generation (Priority: P2)

**Goal**: Admin can generate a structured recipe from a list of ingredients via OpenAI (interactive, fail-fast); the spoilage cron does the same with retry-with-backoff for unattended waste prevention (spec FR-011 → FR-014b, Q3 clarification).

**Independent Test**: POST `/api/v1/ai/recipe` with `{ingredients:["tomato","basil","mozzarella"]}` returns a complete `RecipeResponse` within 10 s. With an invalid OPENAI_API_KEY → 502 within 5 s on the interactive path. The spoilage cron handles the same upstream failure with up to 3 retries (≤ 15 s total) and writes a `spoilage_recipe_failed` Notification on final failure.

### Tests for User Story 2

- [X] T040 [P] [US2] Create `Server/__tests__/services/ai.service.recipe.test.js` testing `aiService.generateRecipe({ ingredients, style })`: (a) calls `openai.chat.completions.create` once with `model: 'gpt-4o'`, `response_format: { type: 'json_object' }`, and returns the parsed JSON, (b) on `openai` SDK throwing → throws `UpstreamProviderError` (single attempt, no internal retry), (c) on malformed JSON in `response.choices[0].message.content` → throws `UpstreamProviderError` with reason `malformed_payload`. Mock the `openai` module.
- [X] T041 [P] [US2] Create `Server/__tests__/api/ai.recipe.test.js`: admin + valid body → 200 + `RecipeResponse` shape; invalid body (empty ingredients[]) → 400; non-admin → 403; OpenAI failure path → 502 with `code: 'upstream_provider_failed'` within 5 s.
- [X] T042 [P] [US2] Create `Server/__tests__/cron/spoilage.cron.test.js` testing `runSpoilageCheck()` from `infrastructure/cron/spoilage.cron.js`: (a) when `aiService.generateRecipe` resolves → inserts a `Notification` of type `spoilage_risk` with the recipe in `payload`, (b) when it rejects 3 times in a row → retries with backoff (250 ms / 500 ms / 1000 ms — verify timing with `jest.useFakeTimers`), (c) on final failure inserts a `Notification` of type `spoilage_recipe_failed` with `payload.attempts === 3` and `payload.lastError`, (d) total wall-clock budget never exceeds 15 s. Mock `aiService.generateRecipe` and `Notification.create`.

### Implementation for User Story 2

- [X] T043 [US2] In `Server/src/application/services/ai.service.js`, implement `async generateRecipe({ ingredients, style })`: import `openai` from `infrastructure/config/openai.js`, call `openai.chat.completions.create({ model: 'gpt-4o', response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'You are a chef AI. Respond ONLY with JSON of shape { name, description, steps[], ingredients[{name,quantity,unit}], estimatedCost, suggestedPrice, profitMargin }' }, { role: 'user', content: \`Available ingredients: ${ingredients.join(", ")}.${style ? " Style: " + style + "." : ""} Create a restaurant-quality dish.\` }] })`. Parse `response.choices[0].message.content` with `JSON.parse` inside a try/catch that throws `UpstreamProviderError('malformed_payload')`. Single attempt only — no retry on this path (FR-014a).
- [X] T044 [US2] In `Server/src/interfaces/validations/ai.validation.js`, add `recipeSchema`: `ingredients` Joi.array().items(Joi.string().min(1)).min(1).required(), `style` Joi.string().max(50).optional().allow(null).
- [X] T045 [US2] In `Server/src/interfaces/controllers/ai.controller.js`, add `recipe(req, res, next)`: validate with `recipeSchema`; call `aiService.generateRecipe(req.body)`; 200 on success; on `UpstreamProviderError` set `res.locals.errorCode = 'upstream_provider_failed'` and respond 502.
- [X] T046 [US2] In `Server/src/routes/ai.routes.js`, add `router.post('/recipe', requireRole('admin'), auditMiddleware('recipe'), aiController.recipe)`.
- [X] T047 [US2] Create `Server/src/infrastructure/cron/spoilage.cron.js` exporting `runSpoilageCheck()` and `scheduleSpoilageCron()`. `runSpoilageCheck`: (1) query `Ingredient.find({ expiryDate: { $lte: new Date(Date.now() + 3*24*60*60*1000) } })`, (2) if empty → return, (3) call `aiService.generateRecipe({ ingredients: nearExpiry.map(i => i.name), style: null })` inside a retry helper with exponential backoff (250 ms → 500 ms → 1000 ms; max 3 attempts; total budget ≤ 15 s — track with `Date.now()`), (4) on success → `Notification.create({ type: 'spoilage_risk', title: 'Spoilage prevention recipe', message: <recipe.name>, targetRole: 'staff', payload: { ingredients, recipe, correlationId }, })`, (5) on final failure → `Notification.create({ type: 'spoilage_recipe_failed', title: 'Spoilage recipe generation failed', message: <ingredient list>, targetRole: 'staff', payload: { ingredients, attempts: 3, lastError: err.message, correlationId } })`. Also write an `audit.service.recordInference` row with `capability: 'recipe'`, `outcome: 'success' | 'error_upstream'`. `scheduleSpoilageCron`: register `node-cron` job with cron `'0 6 * * *'` calling `runSpoilageCheck()`. If `process.argv.includes('--once')`, call `runSpoilageCheck()` immediately and `process.exit(0)`.
- [X] T048 [US2] In `Server/src/index.js`, import and call `scheduleSpoilageCron()` once on app startup (after Mongo connection completes).

**Checkpoint**: All four US2 tests green. `npm run cron:spoilage:run-once` writes a Notification document.

---

## Phase 5: User Story 3 — Personalized Recommendations & Endorsements (Priority: P3)

**Goal**: Authenticated customer can fetch their own recommendations; staff/admin can fetch any customer's. Customer can rate (1–5) a previously-recommended-and-ordered dish. Ratings ≥4 unlock publish; published endorsements appear on the public dish view via an anonymized handle (spec FR-015 → FR-019f, Q1 clarification).

**Independent Test**: Customer JWT calls `GET /api/v1/recommendations/<own-id>` → 5+ recommendations within 2 s. Same call with another customer's ID → 403 `cross_customer_forbidden`. Customer rates a dish 5 stars → publish succeeds → public endorsements summary shows count incremented + anonymized handle (no PII).

### Tests for User Story 3

- [X] T049 [P] [US3] Create `Server/ml_model_service/tests/test_recommender.py` testing `recommend(customer_id, limit=5)` from `models.recommender`: (a) returning customer → ≥5 items with `dishId`, `score`, `reason`, basis = `collaborative`, (b) cold-start customer → popularity fallback with basis = `popularity_fallback`, (c) frequently-ordered dish suppressed (FR-017). Mock `repository.get_customer_dish_matrix`.
- [X] T050 [P] [US3] Create `Server/__tests__/services/recommendation.service.test.js` covering: `getRecommendations(customerId)` calls mlClient and returns the set; `submitRating({ customerId, dishId, score, recommendationContextId })` (a) rejects when customer never ordered the dish, (b) rejects when dish was never recommended to that customer (no matching `AIInferenceAudit` row), (c) upserts a `RecommendationRating`; `publishEndorsement({ customerId, dishId })` (a) rejects when no rating exists, (b) rejects when rating <4, (c) upserts (insert or status flip) a `PublishedRecommendation` with `anonymizedHandle`; `unpublishEndorsement({ customerId, dishId })` flips status and sets `unpublishedAt`.
- [X] T051 [P] [US3] Create `Server/__tests__/services/endorsement.service.test.js` testing `getDishSummary(dishId)`: (a) returns `{ count, average, recent[] }` from `PublishedRecommendation` aggregate, (b) `recent[]` items contain `handle`, `score`, `publishedAt` and **NO PII fields** (assert no `customerId`, `email`, `name`, `phone` keys exist).
- [X] T052 [P] [US3] Create `Server/__tests__/api/recommendation.test.js`: cross-customer GET → 403 `cross_customer_forbidden`; valid customer-self GET → 200 + RecommendationSet; admin GET on any customer → 200; rate sub-4 then publish → 400; rate ≥4 then publish → 201; DELETE publish → 204; verify the anonymized-handle endpoint output has zero PII.

### Implementation for User Story 3

- [X] T053 [P] [US3] Create `Server/ml_model_service/models/recommender.py` exporting `recommend(customer_id: str, limit: int = 5) -> dict`. Logic per `research.md` §2: build/refresh in-memory `customer × dish` frequency matrix from `repository.get_customer_dish_matrix()`, compute cosine similarity (`sklearn.metrics.pairwise.cosine_similarity`), find top-K similar customers, aggregate their dish frequencies, subtract dishes the target customer already orders frequently (≥3 times), return top `limit` with score (normalized similarity-weighted) and reason (`"Liked by diners with similar order history"`). For new customers (zero history) return popularity fallback (`{"basis": "popularity_fallback", ...}`) using top-N by overall order count. Update `main._state['lastSuccessAt']` and `main._state['modelsLoaded']['recommender'] = True`.
- [X] T054 [US3] In `Server/ml_model_service/main.py`, add `POST /v1/recommend` per `contracts/ml-service.openapi.yaml` Pydantic shape `{ customerId, limit }`. Calls `recommender.recommend()`. Returns `RecommendResponse`. Depends on T053.
- [X] T055 [P] [US3] Create `Server/src/application/services/handle.service.js` exporting `anonymizedHandleFor(customerId)` → returns `'Diner #' + crypto.createHmac('sha256', process.env.HANDLE_SALT || 'dev-salt').update(String(customerId)).digest('hex').slice(0, 4)`. Stable per customer, leaks no ID. Add `HANDLE_SALT` to `Server/.env.example`.
- [X] T056 [US3] Create `Server/src/application/services/recommendation.service.js` exporting:
  - `async getRecommendations(customerId)` → calls `mlClient.post('/recommend', { customerId, limit: 5 })`, attaches `recommendationContextId = <new ObjectId().toString()>`, persists nothing (the contextId lives in the audit row written by middleware — pass via `res.locals.recommendationContextId`), returns the set.
  - `async submitRating({ customerId, dishId, score, comment, recommendationContextId })` → (a) verify `Order.exists({ customerId, 'items.dishId': dishId, status: 'completed' })`; if not, throw `ValidationError('dish_not_ordered')`. (b) verify the customer was previously recommended this dish: `AIInferenceAudit.exists({ callerId-or-staff-recommendation-for: customerId, capability: 'recommend', 'inputSummary.dishesReturned': dishId })` — if your audit middleware does not populate that field, fall back to checking that any `recommend` audit row exists for this `customerId`; the recommendation contextId lookup is the more precise alternative. (c) upsert `RecommendationRating` keyed on `(customerId, dishId)` with the new `score`, `comment`, `recommendationContextId`, `createdAt: Date.now()`.
  - `async publishEndorsement({ customerId, dishId })` → fetch the latest `RecommendationRating` for `(customerId, dishId)`. If none → `ValidationError('no_rating')`. If `score < 4` → `ValidationError('rating_below_threshold')`. Upsert `PublishedRecommendation` keyed on `(customerId, dishId)` with `ratingId`, `ratingAtPublish: rating.score`, `anonymizedHandle: handleService.anonymizedHandleFor(customerId)`, `status: 'published'`, `publishedAt: Date.now()`, `unpublishedAt: null`.
  - `async unpublishEndorsement({ customerId, dishId })` → updateOne `PublishedRecommendation` to `{ status: 'unpublished', unpublishedAt: Date.now() }`. Return 404 if not found.
- [X] T057 [P] [US3] Create `Server/src/application/services/endorsement.service.js` exporting `async getDishSummary(dishId)` → MongoDB aggregate over `PublishedRecommendation` where `dishId == X && status == 'published'`: project `count`, `average` (avg of `ratingAtPublish`), and `recent` (latest 5 by `publishedAt` projecting only `handle: anonymizedHandle`, `score: ratingAtPublish`, `publishedAt`). Return `{ dishId, count, average: count > 0 ? average : null, recent }`.
- [X] T058 [P] [US3] Create `Server/src/interfaces/validations/recommendation.validation.js` exporting Joi schemas `rateSchema` (`dishId` MongoId required, `score` int 1–5 required, `comment` string max 500 optional, `recommendationContextId` MongoId optional) and `publishSchema` (`dishId` MongoId required) per `contracts/node-api.openapi.yaml`.
- [X] T059 [US3] Create `Server/src/interfaces/controllers/recommendation.controller.js` with `getRecommendations(req,res)`, `submitRating(req,res)`, `publishEndorsement(req,res)`, `unpublishEndorsement(req,res)`. Each validates input, delegates to `recommendation.service`, maps `ValidationError(code)` → 400 with that code, maps not-found → 404, returns the success status from the OpenAPI spec (201 on rate/publish, 204 on unpublish).
- [X] T060 [P] [US3] Create `Server/src/interfaces/controllers/endorsement.controller.js` with `getDishSummary(req,res)` calling `endorsementService.getDishSummary(req.params.dishId)`.
- [X] T061 [US3] Create `Server/src/routes/recommendation.routes.js`:
  - `router.get('/:customerId', authMiddleware, assertOwnCustomerOrStaff('customerId'), auditMiddleware('recommend'), recommendationController.getRecommendations)`
  - `router.post('/:customerId/rate', authMiddleware, assertOwnCustomerOrStaff('customerId'), auditMiddleware('rate'), recommendationController.submitRating)` — note: even though admin/staff can fetch on customer behalf, **only the customer can rate/publish for themselves** (FR-019a/b). Replace `assertOwnCustomerOrStaff` here with a stricter helper `assertOwnCustomerOnly` (add to `customer-self.middleware.js`).
  - `router.post('/:customerId/publish', authMiddleware, assertOwnCustomerOnly('customerId'), auditMiddleware('publish'), recommendationController.publishEndorsement)`
  - `router.delete('/:customerId/publish/:dishId', authMiddleware, assertOwnCustomerOnly('customerId'), auditMiddleware('unpublish'), recommendationController.unpublishEndorsement)`
- [X] T062 [US3] In `Server/src/interfaces/middleware/customer-self.middleware.js` (created in T019), add `assertOwnCustomerOnly(paramName)` — like the existing helper but **rejects admin and staff** when acting on a customer-only endpoint. Reason: rate/publish are personal endorsements (FR-019a/b).
- [X] T063 [US3] Create `Server/src/routes/endorsement.routes.js` exposing `router.get('/:dishId/endorsements', authMiddleware, auditMiddleware('endorsement_summary_read'), endorsementController.getDishSummary)`. Note: `authMiddleware` is enough — the spec FR-004(c) allows any authenticated user.
- [X] T064 [US3] In `Server/src/index.js`, mount `app.use('/api/v1/recommendations', recommendationRoutes)` and `app.use('/api/v1/dishes', endorsementRoutes)`.

**Checkpoint**: All US3 tests green. `quickstart.md` §5 US3 smoke (recommend → rate 5 → publish → public summary) succeeds. Cross-customer attempts return 403.

---

## Phase 6: User Story 4 — Market Basket Insights (Priority: P4)

**Goal**: Admin opens market-basket view → sees ≥10 association rules sorted by lift, refreshed at most 24 h old. Cache served from `MarketBasketRule` collection (spec FR-020 → FR-023).

**Independent Test**: After cron runs, `GET /api/v1/ai/market-basket` returns `MarketBasketResponse` with ≥10 rules; calling within 24 h returns cached results in <1 s; sparse corpus → empty rules with `reason: corpus_too_sparse`.

### Tests for User Story 4

- [X] T065 [P] [US4] Create `Server/ml_model_service/tests/test_basket.py` testing `compute_basket_rules(min_support=0.10, min_confidence=0.50)` from `models.basket`: (a) returns a list of dicts with `antecedent`, `consequent`, `support`, `confidence`, `lift` for a fixture order corpus, (b) returns `[]` plus a `reason='corpus_too_sparse'` flag when corpus is too small.
- [X] T066 [P] [US4] Create `Server/__tests__/services/ai.service.basket.test.js` covering `aiService.getMarketBasket()` reads from `MarketBasketRule` collection (latest `computedAt`), returning the response shape; if no documents exist → `{ computedAt: null, rules: [], reason: 'not_yet_computed' }`.
- [X] T067 [P] [US4] Create `Server/__tests__/cron/basket.cron.test.js` testing `runBasketRefresh()` calls `mlClient.post('/market-basket/refresh')` and on success expects the FastAPI side to have written rows to `MarketBasketRule` (integration: use mongo-memory-server or stub the call and verify it was made with correct args).

### Implementation for User Story 4

- [X] T068 [P] [US4] Create `Server/ml_model_service/models/basket.py` exporting `compute_basket_rules(min_support: float = 0.10, min_confidence: float = 0.50, top_k: int = 20) -> list[dict]`. Logic per `research.md` §3: pull `repository.get_orders_for_basket()`, one-hot encode via `mlxtend.preprocessing.TransactionEncoder`, run `apriori(df, min_support=min_support, use_colnames=True)`, run `association_rules(itemsets, metric='confidence', min_threshold=min_confidence)`, sort by `lift` desc, take top_k, return list of dicts `{ antecedent: list[str], consequent: list[str], support, confidence, lift }`. If `len(orders) < 50` (heuristic), return `([], 'corpus_too_sparse')`.
- [X] T069 [US4] In `Server/ml_model_service/main.py`, add `POST /v1/market-basket/refresh` and `GET /v1/market-basket`. Refresh calls `compute_basket_rules`, then writes to MongoDB collection `market_basket_rules` (via `pymongo`) — first deletes any documents older than 7 days, then inserts the new batch with shared `computedAt`. On `corpus_too_sparse`, insert the sentinel record per `data-model.md` §5. Returns `MarketBasketRefreshResponse`. The GET reads the latest snapshot (`find().sort([('computedAt', -1)]).limit(20)`).
- [X] T070 [US4] In `Server/src/application/services/ai.service.js`, add `async getMarketBasket()` → `MarketBasketRule.find({}).sort({ computedAt: -1 }).limit(20).lean()`. If empty → return `{ computedAt: null, rules: [], reason: 'not_yet_computed' }`. Else if there is one sentinel row (empty `antecedent`) → return `{ computedAt: rows[0].computedAt, rules: [], reason: 'corpus_too_sparse' }`. Else return `{ computedAt: rows[0].computedAt, rules: rows.map(r => ({ antecedent, consequent, support, confidence, lift })) }`.
- [X] T071 [US4] In `Server/src/interfaces/controllers/ai.controller.js`, add `marketBasket(req, res)` calling `aiService.getMarketBasket()`.
- [X] T072 [US4] In `Server/src/routes/ai.routes.js`, add `router.get('/market-basket', requireRole('admin'), auditMiddleware('market_basket_read'), aiController.marketBasket)`.
- [X] T073 [US4] Create `Server/src/infrastructure/cron/basket.cron.js` exporting `runBasketRefresh()` and `scheduleBasketCron()`. `runBasketRefresh`: call `mlClient.post('/market-basket/refresh')`, log outcome, write an audit row with `capability: 'market_basket_refresh'`. `scheduleBasketCron`: `node-cron` `'30 3 * * *'` (3:30 AM, after 3:00 model retraining).
- [X] T074 [US4] In `Server/src/index.js`, call `scheduleBasketCron()` after `scheduleSpoilageCron()`.

**Checkpoint**: All US4 tests green. After running `curl -X POST http://localhost:5002/v1/market-basket/refresh`, the admin endpoint returns rules in <1 s.

---

## Phase 7: User Story 5 — Dynamic Pricing (Priority: P5)

**Goal**: Admin views per-dish pricing suggestions with confidence; can apply or revert; revert is **forward-correction** (append-only — original record preserved) per spec FR-027a + Q5 clarification.

**Independent Test**: `POST /api/v1/ai/pricing/suggest` returns suggestions for all dishes, capped per FR-025. Apply → new `PriceHistory` row with `source: manager_apply`; revert → new row with `source: manager_revert` and `revertOf` set; original row unchanged. Sub-0.5-confidence suggestions excluded from bulk by default.

### Tests for User Story 5

- [X] T075 [P] [US5] Create `Server/ml_model_service/tests/test_pricing.py` testing `optimize_price(dish_id)` from `models.pricing`: (a) returns `{ currentPrice, suggestedPrice, multiplier, confidence, skippedReason: null }` for a dish with cost data + history, (b) returns `{ skippedReason: 'missing_cost_data' }` when ingredient cost is null, (c) returns `{ skippedReason: 'insufficient_history' }` when history < 14 days, (d) caps multiplier at 1.25 unless `confidence >= 0.8` (then 1.50).
- [X] T076 [P] [US5] Create `Server/__tests__/services/pricing.service.test.js` covering: `getSuggestions()` calls `/optimize-pricing` for every dish; `applyPrice({ dishId, newPrice, applierId, applierRole, suggestionConfidence, source })` inserts a `PriceHistory` row AND updates `Dish.price`; `revertPrice({ priceHistoryId, applierId, applierRole })` inserts a NEW `PriceHistory` row with `source: manager_revert`, `revertOf`, and the prior price restored — **does not modify or delete** the original. Critical assertion: spy on `PriceHistory.updateOne`, `updateMany`, `findOneAndUpdate`, `deleteOne`, `deleteMany`, `findOneAndDelete` and assert each is called **zero** times by the service module.
- [X] T077 [P] [US5] Create `Server/__tests__/api/pricing.test.js` covering: admin POST `/ai/pricing/suggest` → 200 + array; non-admin → 403; apply → 201 + record; revert → 201 + record with `source: manager_revert` + `revertOf`; price-history GET returns oldest→newest including both records; bulk-apply with `{ confidence: 0.4 }` rejected with `validation_failed` for the low-confidence subset (or filtered out per FR-028 — pick one and document in the validator).

### Implementation for User Story 5

- [X] T078 [P] [US5] Create `Server/ml_model_service/models/pricing.py` exporting `optimize_price(dish_id: str) -> dict`. Logic per `research.md` §4: pull features via `repository.get_pricing_features(dish_id)` (demand_forecast, ingredient_cost, day_of_week, is_weekend, season, current_sales_count); if `ingredient_cost is None` return `{ skippedReason: 'missing_cost_data', currentPrice: None, suggestedPrice: None, multiplier: None, confidence: 0.0 }`; if history < 14 days return `{ skippedReason: 'insufficient_history' }`; otherwise predict optimal multiplier with a `GradientBoostingRegressor` trained at module load (cache the trained model in module state); confidence = `1.0 - normalized_std_of_staged_predictions`; cap multiplier per FR-025: if `confidence < 0.8` clamp `multiplier ∈ [0.75, 1.25]`, else clamp `[0.5, 1.5]`. Return `{ currentPrice, suggestedPrice: currentPrice * multiplier, multiplier, confidence, skippedReason: None }`.
- [X] T079 [US5] In `Server/ml_model_service/main.py`, add `POST /v1/optimize-pricing` per OpenAPI Pydantic shape. Calls `pricing.optimize_price`. Updates `_state['modelsLoaded']['pricing'] = True` after first successful call.
- [X] T080 [P] [US5] Create `Server/src/interfaces/validations/pricing.validation.js` exporting Joi schemas `applySchema` (`dishId` MongoId required, `newPrice` number min 0 required, `confidence` number 0–1 required, `bulk` boolean default false) and `revertSchema` (`priceHistoryId` MongoId required) per `contracts/node-api.openapi.yaml`.
- [X] T081 [US5] Create `Server/src/application/services/pricing.service.js`. The module **MUST NOT IMPORT** any of: `PriceHistory.updateOne`, `updateMany`, `findOneAndUpdate`, `deleteOne`, `deleteMany`, `findOneAndDelete`. Exports:
  - `async getSuggestions()` → fetch all dishes, call `mlClient.post('/optimize-pricing', { dishId })` per dish in parallel (use `Promise.all`); for each result decorate with `capApplied: confidence >= 0.8 ? 'high_confidence_50pct' : 'low_confidence_25pct'` (or `'none'` if `Math.abs(percentChange) < 0.001`).
  - `async applyPrice({ dishId, newPrice, applierId, applierRole, suggestionConfidence, source })` → look up `Dish.findById(dishId)` for the prior price; create new `PriceHistory({ dishId, priorPrice: dish.price, newPrice, applierId, applierRole, source, suggestionConfidence })`; update `Dish.price = newPrice` via `dish.save()`. (Note: editing `Dish.price` is allowed — only `PriceHistory` is append-only.)
  - `async revertPrice({ priceHistoryId, applierId, applierRole })` → find `original = PriceHistory.findById(priceHistoryId)`; if original null → throw NotFound; create NEW `PriceHistory({ dishId: original.dishId, priorPrice: original.newPrice, newPrice: original.priorPrice, applierId, applierRole, source: 'manager_revert', suggestionConfidence: null, revertOf: original._id })`; update `Dish.price = original.priorPrice` via save. Return the new revert record.
  - `async getHistory(dishId)` → `PriceHistory.find({ dishId }).sort({ createdAt: 1 }).lean()`.
- [X] T082 [US5] Create `Server/src/interfaces/controllers/pricing.controller.js` with `suggest(req,res)`, `apply(req,res)`, `revert(req,res)`, `history(req,res)`. `apply` honors FR-028: if `bulk === true` AND `confidence < 0.5` → respond 400 `validation_failed` with code `'low_confidence_excluded_from_bulk'`. Single (non-bulk) low-confidence applies are allowed.
- [X] T083 [US5] Create `Server/src/routes/pricing.routes.js`:
  - `router.post('/suggest', requireRole('admin'), auditMiddleware('pricing_suggest'), pricingController.suggest)`
  - `router.post('/apply', requireRole('admin'), auditMiddleware('pricing_apply'), pricingController.apply)`
  - `router.post('/revert', requireRole('admin'), auditMiddleware('pricing_revert'), pricingController.revert)`
  - `router.get('/history/:dishId', requireRole('admin'), auditMiddleware('pricing_history_read'), pricingController.history)`
- [X] T084 [US5] In `Server/src/index.js`, mount `app.use('/api/v1/ai/pricing', pricingRoutes)`.

**Checkpoint**: All US5 tests green. `quickstart.md` §5 US5 smoke (suggest → apply → revert → verify both rows in history) succeeds.

---

## Phase 8: AI Health & Cleanup (Cross-cutting)

**Goal**: Wire the `/api/v1/ai/health` route + delete the obsolete Node mock + final smoke.

- [X] T085 [P] In `Server/src/application/services/ai.service.js`, add `async health()` → call `mlClient.get('/health')`. Catch errors and return `{ reachable: false, warm: false, lastSuccessAt: null }`. On success return `{ reachable: true, warm: response.data.modelsLoaded.recommender || response.data.modelsLoaded.pricing || response.data.modelsLoaded.forecasting > 0, lastSuccessAt: response.data.lastSuccessAt }`.
- [X] T086 [P] In `Server/src/interfaces/controllers/ai.controller.js`, add `health(req,res)` calling `aiService.health()`.
- [X] T087 [P] In `Server/src/routes/ai.routes.js`, add `router.get('/health', requireRole('admin'), auditMiddleware('health'), aiController.health)`.
- [X] T088 **Delete** `Server/ml_model_service/index.js` (the old Node.js mock). Use `git rm`. Constitution Principle III prohibits leaving the mock in the tree.
- [X] T089 [P] Create `Server/__tests__/api/ai.health.test.js`: admin call returns 200 with required keys; if Python service is down (mock mlClient to throw), still 200 but `reachable: false`.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Coverage, security audits, performance smoke, docs.

- [X] T090 [P] Run `npm run test:coverage` from `Server/`; if `lines` or `branches` < 80% on any file under `Server/src/application/services/` or `Server/src/routes/` modified by this phase, add tests until the gate passes.
- [X] T091 [P] Run `pytest --cov` from `Server/ml_model_service/`; ensure all model modules have at least one test that exercises the success path AND one that exercises the failure path.
- [X] T092 [P] Create `Server/__tests__/security/cross-customer.test.js` enumerating EVERY route under `/api/v1/recommendations/:customerId/...` and asserting that a customer JWT for customerId A receives 403 `cross_customer_forbidden` for any operation against customerId B. Use a parameterized table-driven test.
- [X] T093 [P] Create `Server/__tests__/security/non-admin-ai.test.js` asserting that a `customer` JWT and a `staff` JWT (where the spec restricts to admin) both receive 403 on every admin-only AI route in `node-api.openapi.yaml` — `forecast`, `recipe`, `market-basket`, `pricing/*`, `health`.
- [X] T094 [P] Create `Server/__tests__/audit/audit-coverage.test.js` exercising one happy-path request to each AI route and asserting that exactly one `AIInferenceAudit` document was inserted with the right `capability`, `outcome: 'success'`, and a non-zero `latencyMs`.
- [X] T095 [P] Create `Server/scripts/seed-ai-engine.js` referenced by T003 — seed 5 categories, 30 dishes (with ingredient links + costs), 50 customers, 200 orders spread across the trailing 60 days, 1 admin / 1 staff / 1 customer user as named in `quickstart.md` §4. Print credentials to stdout at the end.
- [X] T096 [P] Run the `quickstart.md` §5 smoke tests end-to-end against the local stack. Document any deviations in the PR description.
- [X] T097 [P] Update `CLAUDE.md` (between `<!-- SPECKIT START -->` and `<!-- SPECKIT END -->`) to reference the most recent active artifact path: `specs/001-real-ai-ml-engine/plan.md` (already done in Phase 1 of `/speckit-plan`; verify still correct).
- [X] T098 [P] In `Server/README.md` (create if absent), add a "Running the AI/ML stack" section that links to `specs/001-real-ai-ml-engine/quickstart.md`.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no deps; do first.
- **Foundational (Phase 2)**: depends on Setup; **blocks all user stories**.
- **US1 / US2 / US3 / US4 / US5**: each depends only on Foundational. Can run in parallel by separate developers (or in sequence by one).
- **Phase 8 (Health & Cleanup)**: depends on Foundational (T015–T017). T088 (delete mock) MUST come after Foundational (so the FastAPI replacement is up before the mock disappears).
- **Phase 9 (Polish)**: depends on all desired user-story phases being complete.

### Within each user story

- Tests (T029–T032 for US1, etc.) MUST be written and observed FAILING before the matching implementation tasks.
- Models (in this plan, all models live in Phase 2) before services.
- Services before controllers.
- Controllers before routes.
- Route added in `routes/*.js` before mounted in `Server/src/index.js`.

### Parallel opportunities

- **All [P] tasks within Setup** (T002–T008) — different files.
- **All [P] tasks within Foundational** (T009–T021, T023–T028) — different files.
- **Within each story**: all test tasks marked [P] (different test files). All implementation tasks marked [P] within the same story (different source files).
- **Across stories** (after Foundational): US1, US2, US3, US4, US5 can each be assigned to a separate developer/agent; each delivers an independently testable slice.

---

## Parallel Example: User Story 1 (after Foundational)

```bash
# Test files first — all parallel:
Task: "Create Server/ml_model_service/tests/test_coldstart.py" (T029)
Task: "Create Server/ml_model_service/tests/test_forecasting.py" (T030)
Task: "Create Server/__tests__/services/ai.service.forecast.test.js" (T031)
Task: "Create Server/__tests__/api/ai.forecast.test.js" (T032)

# Then parallel implementation:
Task: "Create Server/ml_model_service/models/coldstart.py" (T033)
Task: "Create Server/src/interfaces/validations/ai.validation.js" (T036)

# Then sequential (each builds on the previous):
Task: "Create Server/ml_model_service/models/forecasting.py" (T034) — needs T033
Task: "Wire POST /v1/predict-sales in main.py" (T035) — needs T034
Task: "Implement aiService.predictDemand" (T037) — independent of Python side
Task: "Wire ai.controller.forecast" (T038) — needs T036 + T037
Task: "Mount route" (T039) — needs T038
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete **Phase 1: Setup**.
2. Complete **Phase 2: Foundational** (CRITICAL — blocks all stories).
3. Complete **Phase 3: User Story 1 — Forecasting**.
4. **STOP and VALIDATE**: Run `quickstart.md` §5 US1 smoke; coverage must hit 80% on US1 files.
5. Demo / deploy / mark MVP complete.

### Incremental delivery (recommended)

1. Setup + Foundational → Foundation ready.
2. Add US1 (Forecasting) → independently testable → Demo (MVP).
3. Add US2 (Recipes) → independently testable → Demo.
4. Add US3 (Recommendations + Endorsements) → independently testable → Demo.
5. Add US4 (Market Basket) → independently testable → Demo.
6. Add US5 (Dynamic Pricing) → independently testable → Demo.
7. Phase 8 + Phase 9 polish → Phase P0 complete; graduation demo cut.

### Parallel-team strategy

If multiple developers/agents are available after Foundational:

- Developer A → US1 (Python Prophet + Node forecast wiring)
- Developer B → US2 (OpenAI wiring + spoilage cron)
- Developer C → US3 (Recommender + endorsements — biggest surface)
- Developer D → US4 (Market basket cron + cache)
- Developer E → US5 (Pricing model + append-only history)

All five stories integrate independently and the final phase wraps cross-cutting concerns.

---

## Notes for the implementing model

- `[P]` tasks = different files, no dependency on other unfinished tasks.
- `[USn]` label maps the task to its user story for traceability.
- Each user story is independently completable and independently testable — do NOT introduce cross-story dependencies that break independence.
- **Verify each test fails before writing its implementation** (constitution Principle IV).
- **Commit after each task or logical group** (constitution Principle VII — small, atomic commits with conventional-commits messages, e.g., `feat(P0): add Prophet forecasting endpoint (T034)`).
- **Stop at any checkpoint** to validate the story independently before moving to the next.
- **Avoid**: vague tasks, same-file conflicts in [P] groups, cross-story dependencies, `Math.random()` or hardcoded literals in any AI code path (constitution Principle III; enforced by T028).
- When in doubt about an unspecified detail, check `spec.md` (especially the `## Clarifications` section), then `data-model.md`, then `contracts/`, then `research.md`. Do NOT invent behavior not present in those documents.
