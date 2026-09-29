# Implementation Plan: Real AI/ML Engine — Replace All Mocks

**Branch**: `001-real-ai-ml-engine` | **Date**: 2026-04-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-real-ai-ml-engine/spec.md`

## Summary

Replace every mocked AI/ML endpoint in the Smart Restaurant backend with real
inference, delivered as a Python FastAPI microservice (port 5002) for
forecasting / recommendations / market-basket / pricing, plus a direct OpenAI
call from the Node.js layer for recipe generation. Persist three new
collections (`recommendation_ratings`, `published_recommendations`,
`price_history` — append-only) and an inference audit log; carve out
authenticated-customer access on the recommend / rate / publish surface so
customers can fetch their own recommendations and turn ≥4-star ratings into
public endorsements. All AI endpoints surface explicit errors when inference
is unavailable — never fabricated data.

## Technical Context

**Language/Version**:
- Node.js 20.x LTS (existing backend / orchestrator)
- Python 3.11+ (new ML inference microservice)

**Primary Dependencies**:
- Backend orchestrator: Express, Mongoose, Joi, `openai` v6.27.0 (already
  in `Server/package.json`, never imported), `axios` (for FastAPI calls),
  `node-cron` (spoilage / nightly basket refresh).
- ML service: FastAPI, Uvicorn, Prophet (forecasting), scikit-learn
  (`GradientBoostingRegressor` for pricing, `cosine_similarity` for
  collaborative filtering), mlxtend (`apriori` + `association_rules`),
  pandas, numpy, pymongo, python-dotenv, tenacity (bounded retries).

**Storage**: MongoDB (existing). New collections: `recommendation_ratings`,
`published_recommendations`, `price_history`, `ai_inference_audit`,
`market_basket_rules` (cached daily). In-memory artifacts on the Python
side: per-dish trained Prophet models, customer × dish similarity matrix
(rebuilt nightly).

**Testing**:
- Backend: Jest + supertest + `mongodb-memory-server` (per the constitution's
  P5 testing track and the project plan).
- ML service: pytest + httpx for FastAPI test client.
- Coverage gate: ≥ 80% lines/branches on services and routes added or
  modified by this phase (constitution Principle IV).

**Target Platform**: Linux server in production; cross-platform (Windows,
macOS, Linux) for development. Two long-running processes: Node.js API
(port 5000) and Python FastAPI ML service (port 5002).

**Project Type**: Web application (multi-service backend). This phase
touches `Server/` and `Server/ml_model_service/` only — the React frontend
under `Client/` is intentionally out of scope here per spec Assumption.

**Performance Goals** (from spec SC-002 → SC-006, SC-013):
- Forecast 7-day MAPE ≤ 25% on dishes with ≥ 30 days history.
- Recipe generation: 95% of interactive calls return within 10 s end-to-end.
- Recommendation: 95% of returning-customer calls return ≥ 5 ranked dishes
  within 2 s.
- Market basket: top 10 actionable rules (confidence ≥ 0.5, lift ≥ 1.0)
  refreshed within 24 h.
- Inference-offline error response within 3 s.
- Endorsement publish/unpublish reflects on public dish view within 5 s
  in 95% of cases.

**Constraints**:
- **Operational scale envelope** (spec Clarifications Q2): ≤ 200 dishes,
  ≤ 5,000 customers, ≤ 500 orders/day. Per-dish Prophet models, in-memory
  similarity matrix, and a daily Apriori batch are all feasible at this
  scale without scale-out engineering.
- **Zero AI Mocks** (constitution III, spec FR-001 / SC-001): no
  `Math.random()`, no hardcoded scoring, no stub JSON in any reachable
  AI code path. When the inference layer is offline → explicit error
  within 3 s, never a fabricated response.
- **Append-only audit** (spec FR-027 / FR-027a): `price_history` is
  insert-only; reverts produce new `manager_revert` records.
- **PII firewall** (spec FR-019, FR-019c, SC-014): only opaque internal
  customer IDs cross into model inference; the public endorsement surface
  exposes only an anonymized handle.
- **Failure-policy split** (spec FR-014a / FR-014b): interactive recipe
  calls fail-fast (1 attempt, ≤ 5 s); the proactive spoilage cron retries
  with exponential backoff (≤ 3 attempts, ≤ 15 s total budget).

**Scale/Scope**: Pilot envelope above. Backend code added: ~6 new service
modules + ~10 new route handlers + ~6 new Mongoose models or schemas +
the FastAPI service (~6 endpoints, ~5 model modules) + cron harness for
spoilage and nightly basket refresh.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.0.0:

| Principle | Compliance Plan | Status |
|-----------|----------------|--------|
| **I. Three-AI Spec-Driven Workflow** (NON-NEGOTIABLE) | This plan IS the Opus-stage spec for Kimi to implement. Each implementation PR will be reviewed under the third Claude pass. | ✅ Pass |
| **II. Layered Service Architecture** | All new Node.js work follows Routes → Controllers → Services → Models. New service files: `ai.service.js` (rewritten, no mocks), `recommendation.service.js`, `pricing.service.js`, `audit.service.js`. New Joi validators for every write endpoint (`recommendation.validation.js`, `pricing.validation.js`). No controller calls Mongoose directly. | ✅ Pass |
| **III. Real Intelligence — Zero AI Mocks** (NON-NEGOTIABLE) | Existing `Server/ml_model_service/index.js` (Node.js mock) is deleted and replaced by `Server/ml_model_service/main.py` (FastAPI). The `Math.random()` paths in `ai.service.js` are removed; on FastAPI / OpenAI failure the service returns an explicit error. Acceptance test in Phase 1 contracts grep-asserts no `Math.random` or hardcoded literals in any AI code path. | ✅ Pass |
| **IV. Test-First Discipline & Coverage Gates** | Each new service module ships with a Jest test file written first; the FastAPI service ships with pytest contract tests. Coverage gate ≥ 80% on touched services & routes. | ✅ Pass |
| **V. Role-Based Security & Boundary Validation** | All new routes declare role guards at the route level (admin-default with explicit customer-self carve-outs per spec FR-004). All write endpoints have Joi schemas. Secrets (`OPENAI_API_KEY`, `MONGODB_URI`) live only in env. | ✅ Pass |
| **VI. Observable & Persisted Operational Signals** | Every inference call writes a row to `ai_inference_audit`. Spoilage cron logs start/finish/outcome with a correlation ID. Spoilage notifications persist to the existing `Notification` collection (created in P3, but the contract is honored here for the spoilage path). | ⚠ Conditional — depends on `Notification` model existing; this phase MUST either ship a minimal `Notification` model now or stub the spoilage notification persistence behind a feature flag if P3 has not landed. See Complexity Tracking. |
| **VII. GitHub Trunk-Based Delivery Workflow** | Each task in tasks.md will land as a separate small PR on `feature/ai-*` branches with conventional-commits, linked to a P0 sub-task. | ✅ Pass |

**Gate result**: Pass with one conditional (Principle VI). The conditional
is resolved by the **minimal Notification shipping** decision in Complexity
Tracking below — we ship the Notification model in this phase ahead of P3,
which is a controlled scope expansion (~30 LOC) that avoids violating
Principle VI later.

## Project Structure

### Documentation (this feature)

```text
specs/001-real-ai-ml-engine/
├── spec.md                    # Feature specification (clarified)
├── plan.md                    # This file
├── research.md                # Phase 0 — model & library decisions
├── data-model.md              # Phase 1 — entities, schemas, indexes
├── quickstart.md              # Phase 1 — local dev / smoke-test guide
├── contracts/                 # Phase 1 — REST contracts
│   ├── node-api.openapi.yaml      # Node orchestrator surface (admin + customer-self)
│   ├── ml-service.openapi.yaml    # Python FastAPI internal surface
│   └── README.md                  # Contract conventions
├── checklists/
│   └── requirements.md        # Spec quality checklist (created by /speckit-specify)
└── tasks.md                   # Phase 2 output (NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
Server/
├── src/
│   ├── domain/
│   │   └── models/
│   │       ├── RecommendationRating.js          # NEW
│   │       ├── PublishedRecommendation.js       # NEW
│   │       ├── PriceHistory.js                  # NEW
│   │       ├── AIInferenceAudit.js              # NEW
│   │       ├── MarketBasketRule.js              # NEW (cached nightly)
│   │       └── Notification.js                  # NEW (minimal — see Complexity)
│   ├── application/
│   │   └── services/
│   │       ├── ai.service.js                    # REWRITE — no mocks
│   │       ├── recommendation.service.js        # NEW (rate / publish / fetch)
│   │       ├── pricing.service.js               # NEW (suggest / apply / revert)
│   │       ├── endorsement.service.js           # NEW (public summary read)
│   │       ├── audit.service.js                 # NEW (inference audit logger)
│   │       └── notification.service.js          # MODIFY — persist spoilage alerts
│   ├── infrastructure/
│   │   ├── config/
│   │   │   ├── ai.js                            # FIX — point to port 5002, import
│   │   │   └── openai.js                        # NEW — wraps OpenAI SDK init
│   │   ├── cron/
│   │   │   ├── spoilage.cron.js                 # NEW — fail-fast on inference, retry-w-backoff on recipe
│   │   │   └── basket.cron.js                   # NEW — nightly Apriori refresh
│   │   └── ml/
│   │       └── ml-client.js                     # NEW — axios wrapper around FastAPI
│   ├── interfaces/
│   │   ├── controllers/
│   │   │   ├── ai.controller.js                 # MODIFY — wire new routes
│   │   │   ├── recommendation.controller.js     # NEW
│   │   │   ├── pricing.controller.js            # NEW
│   │   │   └── endorsement.controller.js        # NEW
│   │   └── validations/
│   │       ├── ai.validation.js                 # NEW (forecast / pricing inputs)
│   │       ├── recommendation.validation.js     # NEW (rate / publish payloads)
│   │       └── pricing.validation.js            # NEW (apply / revert payloads)
│   └── routes/
│       ├── ai.routes.js                         # MODIFY — admin-only AI surface
│       ├── recommendation.routes.js             # NEW — admin + customer-self
│       ├── pricing.routes.js                    # NEW — admin only
│       └── endorsement.routes.js                # NEW — public-read
├── ml_model_service/
│   ├── main.py                                  # NEW — FastAPI app
│   ├── requirements.txt                         # NEW
│   ├── models/
│   │   ├── forecasting.py                       # NEW — Prophet per-dish
│   │   ├── recommender.py                       # NEW — cosine similarity CF
│   │   ├── basket.py                            # NEW — mlxtend Apriori
│   │   ├── pricing.py                           # NEW — GradientBoostingRegressor
│   │   └── coldstart.py                         # NEW — recency-weighted DOW fallback
│   ├── data/
│   │   └── repository.py                        # NEW — pymongo data access
│   ├── tests/
│   │   ├── test_forecasting.py
│   │   ├── test_recommender.py
│   │   ├── test_basket.py
│   │   ├── test_pricing.py
│   │   ├── test_coldstart.py
│   │   └── test_api_contract.py                 # exercises every route
│   └── index.js                                 # DELETE — Node.js mock
└── __tests__/
    ├── services/
    │   ├── ai.service.test.js
    │   ├── recommendation.service.test.js
    │   ├── pricing.service.test.js
    │   ├── endorsement.service.test.js
    │   └── audit.service.test.js
    └── api/
        ├── ai.test.js
        ├── recommendation.test.js
        ├── pricing.test.js
        └── endorsement.test.js
```

**Structure Decision**: Web-application multi-service. Two deployable
processes for this phase: the existing Node.js Express server
(`Server/src/`) and a new Python FastAPI ML service
(`Server/ml_model_service/`). The Node API is the only public surface;
the FastAPI service is reachable only over the local network (or
Docker-internal network) on port 5002 and trusts its caller. The React
frontend (`Client/`) is intentionally untouched in this phase per spec
Assumption — its consumption of these endpoints belongs to the project's
P2 frontend phase.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Ship a **minimal `Notification` model** in this phase even though notifications are formally P3 | The proactive spoilage cron in this phase MUST persist its alert per constitution Principle VI; otherwise an alert generated at 06:00 disappears as soon as the process restarts. | Logging-only would violate Principle VI ("console-only logging is not acceptable for any user-facing alert"). A feature-flag stub adds equal LOC and zero capability. The minimal model (~30 LOC: type, title, message, targetRole, read, createdAt) is the smallest viable shape; P3 will extend it (relatedEntity, REST API, NotificationBell) without breaking the schema. |
| Run **two language stacks** (Node.js + Python) in development and CI | Prophet, mlxtend, scikit-learn, and Pandas are first-class in Python and second-class or absent in Node. The plan's own task spec already commits to Python. | A pure-Node implementation would either drop Prophet (loses seasonality story — the demo's strongest signal) or require a JS Prophet port that does not exist at production quality. Calling the JS-side `openai` SDK from Node for recipes (and only crossing the language boundary for ML inference over HTTP) keeps the seam narrow and well-typed. |

---

## Phase 0 — Outline & Research

See [research.md](./research.md). Summary of decisions resolved there:

- **Forecasting library**: Prophet, per-dish models, retrained nightly.
- **Recommendation algorithm**: User-based collaborative filtering via
  scikit-learn cosine similarity on a customer × dish frequency matrix,
  with popularity fallback for new customers.
- **Market basket library**: mlxtend Apriori + association_rules, daily
  cron, results cached in `market_basket_rules` collection.
- **Pricing model**: scikit-learn `GradientBoostingRegressor` predicting
  optimal multiplier; trained on historical orders × cost × DOW.
- **Recipe generation**: Direct OpenAI call from Node `ai.service.js`
  (model `gpt-4o`, `response_format: { type: 'json_object' }`); does not
  cross the FastAPI boundary.
- **Inter-service transport**: REST/JSON over HTTP, axios on Node side,
  FastAPI Pydantic models on Python side.
- **Audit logging**: Mongoose model `AIInferenceAudit` written
  synchronously by a small middleware on the Node side wrapping every
  AI-controller call.
- **Append-only price history**: enforced by service layer, not by
  Mongoose alone (Mongoose has no native immutability — see research).
- **Customer-self auth carve-out**: existing JWT middleware reused;
  controllers compare `req.user.customerId === req.params.customerId`
  before delegating to service.
- **Spoilage cron retry**: simple async/await loop with exponential
  backoff (250 ms → 500 ms → 1000 ms, capped at 15 s total wall-clock).
- **Cold-start forecast**: pure-Python helper `coldstart.py` consuming
  the trailing-30-day category history and applying day-of-week shares.

---

## Phase 1 — Design & Contracts

See:
- [data-model.md](./data-model.md) — entity schemas, indexes, transitions.
- [contracts/node-api.openapi.yaml](./contracts/node-api.openapi.yaml) —
  Node orchestrator REST surface (admin + customer-self).
- [contracts/ml-service.openapi.yaml](./contracts/ml-service.openapi.yaml)
  — Python FastAPI internal surface.
- [contracts/README.md](./contracts/README.md) — contract conventions,
  auth model, audit headers.
- [quickstart.md](./quickstart.md) — local development setup, smoke-test
  walkthrough for each user story.

### Post-design Constitution re-check

Re-evaluated after data-model and contracts:

- Principle II (Layered Service Architecture) — confirmed: every new
  controller delegates to a service; every write route has a Joi
  validator; no Mongoose import outside `domain/models/` and `services/`.
- Principle III (No mocks) — contracts include health-fail and
  inference-fail responses; OpenAPI examples exclude any random/stub.
- Principle IV (Test-First) — every contract has at least one example
  payload that doubles as a contract-test fixture for both Jest and
  pytest harnesses.
- Principle V (Role-based security) — every operation in the OpenAPI
  spec carries an explicit `security` block (admin / staff / customer-self
  / public-authenticated-read).
- Principle VI (Observable signals) — `data-model.md` defines the
  `Notification` minimal schema and the `AIInferenceAudit` schema; the
  ML service `/health` contract reports last-success timestamp.

**Re-check verdict**: PASS. No new violations introduced by Phase 1
design. Complexity Tracking entries unchanged.

---

## Phase 2 — Task Generation

Out of scope for `/speckit-plan`. The next command (`/speckit-tasks`) will
read this plan + spec + data-model + contracts and produce
`tasks.md` — dependency-ordered, story-grouped, [P]-marked.

Suggested task grouping anticipated by this plan:

1. **Setup** — install Python toolchain, add `requirements.txt`, add
   Jest/pytest test infrastructure if missing.
2. **Foundational** — Mongoose models, audit middleware, `ml-client.js`
   wrapper, `openai.js` config, FastAPI app skeleton + `/health`.
3. **US1 (P1) — Forecasting** — `forecasting.py` + cold-start fallback +
   Node service wiring + tests.
4. **US2 (P2) — Recipe generation** — `openai.js` wiring + spoilage cron
   with retry-with-backoff + tests.
5. **US3 (P3) — Recommendations + endorsements** — `recommender.py` +
   recommendation/endorsement services + customer-self carve-out + tests.
6. **US4 (P4) — Market basket** — `basket.py` + nightly cron + cache
   read path + tests.
7. **US5 (P5) — Dynamic pricing** — `pricing.py` + pricing service with
   append-only history + revert as forward-correction + tests.
8. **Polish** — coverage check, contract tests, security tests
   (cross-customer, non-admin), performance smoke against pilot scale.
