# Feature Specification: Real AI/ML Engine — Replace All Mocks

**Feature Branch**: `001-real-ai-ml-engine`
**Created**: 2026-04-26
**Status**: Draft
**Input**: User description: "Read smart_restaurant_speckit_plan.md and create a specification for phase 0 P0 — Real AI/ML Engine (Replace All Mocks) only."

## Clarifications

### Session 2026-04-26

- Q: Who is authorized to invoke the personalized-recommendation capability in this phase? → A: Admin, staff, AND authenticated customers (each customer can only fetch their own recommendations). Additionally, after a customer orders a recommended dish, the customer may rate it on a 5-point scale, and a rating of ≥ 4 unlocks the option to publish (make visible to other customers) that endorsement as a social-proof signal on the public dish view.
- Q: What's the expected operational scale of the deployed system (dishes, customers, orders/day)? → A: Single-restaurant pilot scale — ≤ 200 distinct dishes on the menu, ≤ 5,000 distinct customers tracked, ≤ 500 orders per day at peak. The implementation plan MAY assume per-dish forecasting models, in-memory customer-similarity matrices, and a daily-batch market-basket pass without scale-driven engineering compromises. Multi-location and multi-tenant scaling remain explicitly out of scope for this phase.
- Q: When the recipe provider returns a transient failure (rate-limit, timeout, or 5xx), what should the system do? → A: Fail-fast for interactive calls (one attempt; on any failure return an explicit error within 5 seconds so the user can retry intentionally); retry-with-backoff for the proactive spoilage cron only (up to 3 exponential attempts, total time budget ≤ 15 seconds, then surface a clear failure notification). This split preserves the SC-003 "≤ 10 s for 95% of calls" interactive promise while giving the unattended waste-prevention path a fair shot at success.
- Q: When a dish lacks ≥ 14 days of order history, what fallback formula produces its predicted daily quantity? → A: A recency-weighted mean of daily orders for the dish's category over the trailing 30 days, with a per-day-of-week adjustment factor. This reflects current category trends (more recent days carry more weight) and respects weekly seasonality (Friday-night demand differs from Tuesday-lunch), while remaining a deterministic, one-line computation that the cold-start case can be tested against without invoking the trained models.
- Q: When a manager reverts an applied price change, what happens to the price-history record? → A: Forward-correction (append-only). A revert writes a NEW price-history record restoring the prior price; the original change record is preserved untouched. Each record carries a `source` field distinguishing manager_apply, manager_revert, and ai_bulk_apply. The audit trail is therefore append-only — nothing is ever rewritten or deleted — so the Pricing-History view honestly reflects "tried $X for N hours, then reverted to $Y."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Demand Forecasting for Inventory & Staffing (Priority: P1)

A restaurant manager opens the demand-forecast view, picks a dish, and sees how
many portions are predicted to sell each day for the next 7 (and optionally 30)
days, with a confidence band around each prediction. The manager uses this to
decide how much of each ingredient to order and how many staff to schedule for
upcoming peak days.

**Why this priority**: Forecasting is the most operationally valuable AI
capability — it directly drives inventory purchases, staffing levels, and waste
prevention. It is also the lowest-risk capability to demo because the output is
visualized as a chart that is obviously real (not fabricated).

**Independent Test**: A manager can pick any dish that has order history,
request a 7-day forecast, and visually confirm a prediction line plus an upper
and lower confidence band that responds sensibly to dish selection. Re-running
the forecast for the same dish at the same time MUST return the same result
within the same business day.

**Acceptance Scenarios**:

1. **Given** a dish with at least 30 days of order history,
   **When** the manager requests a 7-day demand forecast,
   **Then** the system returns a per-day predicted quantity with a confidence
   interval for each of the 7 days within 5 seconds.
2. **Given** a dish with fewer than 14 days of order history,
   **When** the manager requests a forecast,
   **Then** the system returns a clearly-labeled cold-start indication (no
   fabricated numbers) and falls back to category-level demand averages.
3. **Given** the inference service is offline,
   **When** the manager requests a forecast,
   **Then** the system returns an explicit error message within 3 seconds and
   the UI surfaces a "forecast temporarily unavailable" state.
4. **Given** a 7-day forecast has been delivered,
   **When** total predicted orders exceed a threshold (e.g., 30% above
   trailing-30-day average),
   **Then** the view also presents a staffing-suggestion hint (e.g., "consider
   adding a shift").

---

### User Story 2 - Recipe Generation from Available Ingredients (Priority: P2)

A chef or manager has a set of ingredients on hand — particularly items nearing
expiry — and wants the system to propose a restaurant-quality dish that uses
them. The user reviews the suggested name, ingredient list, preparation steps,
estimated cost, and suggested price, then decides whether to add it to the menu
or run it as a daily special.

**Why this priority**: Recipe generation is the most visually striking AI
capability for the graduation demo and directly supports the project's
food-waste-reduction pillar. It is also the lowest-effort capability to wire
because it depends on an external provider rather than in-house model training.

**Independent Test**: A user can submit a list of ingredients (e.g., the
near-expiry items returned by the inventory expiry view) and receive within
10 seconds a structured recipe (name, steps, ingredient quantities, cost, and
suggested price). The output MUST be valid structured data the UI can render
without manual reformatting.

**Acceptance Scenarios**:

1. **Given** a list of 3 or more available ingredients,
   **When** the user requests a recipe,
   **Then** the system returns a complete recipe (name, description, steps,
   ingredient list with quantities, estimated cost, suggested price, profit
   margin) within 10 seconds in 95% of calls.
2. **Given** the recipe generator is unreachable or rate-limited,
   **When** the user requests a recipe,
   **Then** the system returns an explicit error within 5 seconds and offers
   a retry — never a placeholder recipe.
3. **Given** the system has identified ingredients expiring within 3 days,
   **When** the proactive spoilage check runs,
   **Then** a recipe suggestion using those ingredients is generated and
   delivered to staff via the notification surface.

---

### User Story 3 - Personalized Recommendations & Customer Endorsements (Priority: P3)

An authenticated customer (or a staff member assisting that customer at the
POS) views a short, ranked list of dishes the system believes that specific
customer is most likely to enjoy, based on their prior order history and
similarities to other customers. New customers see a popularity-based fallback
list instead. After ordering a recommended dish, the customer can rate it on a
5-point scale; if the rating is 4-or-higher, the customer can publish that
endorsement so it appears as social proof on the dish's public view (e.g.,
"recommended by 12 diners, avg rating 4.6"). Customers may unpublish their
endorsement at any time.

**Why this priority**: Personalized recommendations are a customer-facing AI
feature that improves perceived service quality and average ticket size. Adding
the rate-and-publish loop turns one-shot recommendations into accumulating
social proof that benefits other customers and reinforces the AI's value.

**Independent Test**: For any returning customer with at least 3 prior orders,
the system produces a ranked list of at least 5 dish suggestions in under
2 seconds, callable both by the customer themselves and by staff acting on the
customer's behalf. After ordering a recommended dish, the customer can submit a
rating; ratings ≥ 4 unlock a publish action that makes the endorsement visible
on that dish's public view within 5 seconds. Cross-customer access (one
customer trying to fetch, rate, or publish for a different customer ID) MUST
be rejected with an authorization error.

**Acceptance Scenarios**:

1. **Given** a returning customer with order history,
   **When** the system requests recommendations for that customer,
   **Then** at least 5 dishes are returned, ranked by relevance score, with a
   short human-readable reason per recommendation, in under 2 seconds.
2. **Given** a new customer with no order history,
   **When** the system requests recommendations,
   **Then** the response uses popularity-based fallback and is flagged as
   `cold_start: true` so the UI can label it appropriately.
3. **Given** a customer has frequently ordered a particular dish,
   **When** recommendations are produced,
   **Then** that already-frequent dish is suppressed from the recommendation
   list (the goal is discovery, not repetition).
4. **Given** a customer has ordered a recommended dish,
   **When** the customer submits a rating of 4 or 5 stars,
   **Then** a publish action becomes available, and using it makes the
   endorsement visible on that dish's public view (with an anonymized handle)
   within 5 seconds.
5. **Given** a customer has ordered a recommended dish,
   **When** the customer submits a rating below 4 stars,
   **Then** the publish action is not offered, and any direct publish attempt
   is rejected with a clear validation message.
6. **Given** an authenticated customer requests recommendations, ratings, or
   publish actions for a customer ID other than their own,
   **When** the request is made,
   **Then** the system rejects it with an authorization error.
7. **Given** a customer has previously published an endorsement,
   **When** the customer chooses to unpublish it,
   **Then** the endorsement is removed from the public dish view within
   5 seconds while the underlying rating record is retained.

---

### User Story 4 - Market Basket Insights for Promotions (Priority: P4)

A manager opens an analytics view that lists the strongest "customers who
bought X also bought Y" relationships discovered in real order data, ranked
by lift. The manager uses these insights to design combo deals, position items
together on the menu, or train staff on upsell suggestions.

**Why this priority**: Market basket insights are a strategic-tier capability —
valuable for menu design and promotions, but not in the critical path for
day-to-day operations. They become more useful as order volume grows.

**Independent Test**: Given the existing order corpus, the system returns a
ranked list of at least 10 association rules each with a confidence ≥ 0.5 and
a lift ≥ 1.0, refreshed at least once per day.

**Acceptance Scenarios**:

1. **Given** the order corpus has at least 100 multi-item orders,
   **When** the manager opens the market-basket view,
   **Then** at least 10 rules are returned, sorted by lift descending, each
   showing antecedent items, consequent items, confidence, and lift.
2. **Given** market basket analysis has run within the last 24 hours,
   **When** the view is opened again,
   **Then** the cached results are returned within 1 second (not recomputed).
3. **Given** the order corpus is too sparse to produce rules with the
   minimum-support threshold,
   **When** the manager opens the view,
   **Then** the UI displays a clear "not enough data yet" message with the
   current order count and the threshold needed.

---

### User Story 5 - Dynamic Pricing Suggestions (Priority: P5)

A manager opens a pricing view that lists, for each dish, the current price,
a suggested optimized price, an up/down indicator, and a confidence score.
The manager can apply suggestions one-by-one or in bulk, with a confirmation
step that previews projected revenue impact.

**Why this priority**: Dynamic pricing is the most commercially advanced
capability but also the highest-risk if applied automatically. Treating it as
a decision-support tool (manager-in-the-loop) makes the feature shippable
without requiring perfect model accuracy.

**Independent Test**: For every dish on the menu, the system returns a
suggested price, a multiplier, and a confidence value in under 5 seconds for
the full menu. Applying a suggestion updates the live menu price and is
reversible from the same view.

**Acceptance Scenarios**:

1. **Given** a dish with sufficient sales history and known ingredient cost,
   **When** the system computes pricing suggestions,
   **Then** it returns the current price, suggested price, percentage change,
   and confidence score, with the suggested price never differing from current
   by more than 25% unless confidence ≥ 0.8.
2. **Given** the manager applies a suggested price,
   **When** the change is confirmed,
   **Then** the menu price is updated, a new price-history record with
   `source = manager_apply` is appended, and a confirmation toast appears.
   Reverting that change later appends a new `manager_revert` record
   restoring the prior price; the original `manager_apply` record is
   preserved untouched.
3. **Given** a pricing suggestion has low confidence (< 0.5),
   **When** the suggestion is shown,
   **Then** it is visually marked as low-confidence and excluded from any
   bulk-apply action by default.

---

### Edge Cases

- A dish has zero historical orders → forecast falls back to the
  recency-weighted, day-of-week-adjusted category mean (per FR-009) with a
  widened confidence band and a clear cold-start flag; no fabricated number
  is shown.
- A dish's category itself has fewer than 14 days of orders to compute the
  cold-start fallback against → the forecast endpoint MUST return a
  "no-data" response with the cold-start flag set and zero numeric estimate,
  rather than fabricating a value from an underpopulated baseline.
- A customer has fewer than 3 historical orders → recommendations switch to
  popularity-based fallback; cold-start flag is set.
- The external recipe provider returns malformed JSON or an error on an
  interactive call → the system fails fast: one attempt, then an explicit
  error returned within 5 seconds with a retry option; no stub recipe shown.
- The external recipe provider returns a transient failure (rate-limit,
  timeout, 5xx) on the proactive spoilage cron → the system retries with
  exponential backoff up to 3 attempts within a 15-second total budget;
  if every attempt fails, a clear failure notification with the offending
  ingredient list is emitted, and no placeholder recipe is generated.
- The inference service is restarting or unreachable → all AI endpoints
  return an explicit error within 3 seconds and the UI displays a "service
  temporarily unavailable" state without retrying indefinitely.
- An ingredient cost is missing for a dish → pricing suggestion is skipped for
  that dish with a clear "cost data missing" reason.
- The forecast is requested for a date in the past → the request is rejected
  with a validation error.
- Two managers apply pricing suggestions on the same dish concurrently → the
  later write wins; both writes are recorded in the price-history audit trail.
- A non-admin user attempts to call an AI endpoint that is NOT the personalized
  recommendation, recommendation-rating, or recommendation-publish capability →
  the request is rejected with a 403-equivalent authorization error.
- An authenticated customer attempts to fetch, rate, or publish a recommendation
  for a customer ID other than their own → the request is rejected with a
  403-equivalent authorization error.
- A customer attempts to publish an endorsement for a dish they have not yet
  ordered, or rated below 4/5 → the publish request is rejected with a clear
  validation message.
- Two endorsements would otherwise be created by the same customer for the same
  dish → only one Published Recommendation per (customer, dish) pair exists at
  any time; subsequent publishes update the existing record.

## Requirements *(mandatory)*

### Functional Requirements

#### Foundation (cross-cutting prerequisites)

- **FR-001**: System MUST replace every existing mocked AI/ML endpoint with a
  real-inference implementation. No code path reachable from any user-visible
  feature may return hardcoded, randomized, or stub prediction data.
- **FR-002**: System MUST expose a health indicator for the AI/ML inference
  layer, reporting at minimum: reachable (yes/no), warm (yes/no), and last
  successful inference timestamp.
- **FR-003**: System MUST return an explicit, non-fabricated error response
  within 3 seconds when the inference layer is unavailable, regardless of
  which AI capability was requested.
- **FR-004**: System MUST restrict AI/ML endpoints to admin-role users by
  default. Carve-outs: (a) the personalized-recommendation endpoint is also
  callable by authenticated customers for their own customer ID only;
  (b) the recommendation-rating and recommendation-publish endpoints are
  callable only by the authenticated customer for their own customer ID;
  (c) the public dish-endorsement-summary read endpoint is callable by any
  authenticated customer (read-only, anonymized payload). Cross-customer
  access on (a)–(c) MUST be rejected with an authorization error.
- **FR-005**: System MUST record an audit log entry for every AI/ML inference
  call (caller, capability, timestamp, latency, outcome).

#### Demand Forecasting (US1)

- **FR-006**: System MUST forecast per-day demand quantity per dish for
  configurable horizons of 7 days and 30 days ahead.
- **FR-007**: Each forecast point MUST include a predicted central value plus
  lower and upper confidence bounds.
- **FR-008**: System MUST source training inputs from the existing aggregated
  order history, not from raw transactional data.
- **FR-009**: For dishes with insufficient history (defined as < 14 days of
  orders), the system MUST fall back to a **recency-weighted mean of daily
  orders for the dish's category over the trailing 30 days**, with a
  per-day-of-week adjustment factor applied so the forecast for each
  horizon day reflects that day's typical share of weekly demand. The
  resulting forecast points MUST be flagged as cold-start so the UI and
  consumers can render them with appropriate caveats. The lower/upper
  confidence band for cold-start points MUST be widened (relative to a
  trained-model forecast) to communicate the inherent uncertainty.
- **FR-010**: System MUST refresh model artifacts at least daily; on-demand
  inference MUST use the most recent successfully-trained model.

#### Recipe Generation (US2)

- **FR-011**: System MUST generate a complete recipe (name, description, step
  list, ingredient list with quantities, estimated cost, suggested price,
  profit margin) given a list of available ingredients.
- **FR-012**: System MUST accept an optional style/cuisine hint and
  incorporate it into the generated recipe when supplied.
- **FR-013**: System MUST be invokable both interactively (from a UI button)
  and programmatically (from the proactive spoilage check) using the same
  contract.
- **FR-014**: When the upstream provider returns a malformed or partial
  response, the system MUST treat it as a failure and surface an explicit
  error rather than rendering a partial recipe.
- **FR-014a**: For **interactive** recipe-generation calls (originating
  from a user-facing UI action), the system MUST follow a fail-fast
  policy: a single attempt against the provider; on any failure
  (rate-limit / 429, timeout, 5xx, or malformed payload), return an
  explicit error to the caller within 5 seconds. The system MUST NOT
  perform internal retries on the interactive path.
- **FR-014b**: For **proactive cron-driven** recipe-generation calls
  (e.g., the daily spoilage check), the system MUST follow a
  retry-with-backoff policy: up to 3 attempts using exponential backoff,
  with a total time budget of ≤ 15 seconds. If all attempts fail, the
  system MUST emit a clear failure notification (with the offending
  ingredient list) and MUST NOT silently swallow the failure or fall
  back to a placeholder recipe.

#### Personalized Recommendations & Endorsements (US3)

- **FR-015**: System MUST return a ranked list of at least 5 dish suggestions
  for any returning customer with order history. The endpoint MUST be
  callable by (a) admin or staff requesting on behalf of any customer, or
  (b) the authenticated customer requesting their own recommendations.
- **FR-016**: Each recommendation MUST include a relevance score and a short
  human-readable reason.
- **FR-017**: System MUST suppress dishes the customer already orders
  frequently from the recommendation list.
- **FR-018**: For new customers (no order history), the system MUST return a
  popularity-based list and flag the response as cold-start.
- **FR-019**: The recommendation pipeline MUST use only internal customer
  identifiers; no externally identifying personal data may be passed to
  model inference.
- **FR-019a**: System MUST allow an authenticated customer to submit a rating
  on a 1–5 integer scale for any dish that (i) was previously surfaced to
  that customer as a recommendation AND (ii) the customer has ordered at
  least once. The rating record MUST capture rater customer ID, dish ID,
  score, optional short comment, and timestamp.
- **FR-019b**: System MUST allow an authenticated customer to publish (make
  visible to other customers) their endorsement of a dish ONLY when the
  underlying rating is ≥ 4. Publish attempts on lower-rated or unrated
  recommendations MUST be rejected with a clear validation error.
- **FR-019c**: Published endorsements MUST appear on the dish's public view
  within 5 seconds of publication, displayed via an anonymized handle (no
  customer name, email, phone, or other directly identifying field).
- **FR-019d**: System MUST allow a customer to unpublish their own published
  endorsement at any time; the underlying rating record MUST be retained.
  Unpublishing MUST remove the endorsement from the public view within
  5 seconds.
- **FR-019e**: System MUST enforce one Published Recommendation per
  (customer, dish) pair; subsequent publishes update the existing record
  rather than creating a duplicate.
- **FR-019f**: System MUST expose a public dish-endorsement-summary read
  endpoint returning, per dish, the count of currently published
  endorsements and the average published rating; the payload MUST contain
  no personally identifying customer data.

#### Market Basket Analysis (US4)

- **FR-020**: System MUST identify item co-occurrence patterns in completed
  orders and produce association rules with confidence and lift metrics.
- **FR-021**: System MUST recompute association rules at least once per day
  and serve cached results between recomputations.
- **FR-022**: System MUST allow configurable thresholds for minimum support
  and minimum confidence; defaults are documented in Assumptions.
- **FR-023**: When the order corpus is too sparse to produce rules above the
  thresholds, the system MUST return an empty result with a clear reason
  rather than synthesized rules.

#### Dynamic Pricing (US5)

- **FR-024**: System MUST produce a price suggestion per dish, including
  current price, suggested price, percentage change, and confidence score.
- **FR-025**: System MUST cap suggested deviation from current price at 25%
  unless confidence is ≥ 0.8, in which case the cap may extend to 50%.
- **FR-026**: System MUST require explicit admin confirmation before any
  suggested price is applied to the live menu.
- **FR-027**: System MUST record every applied price change in a per-dish
  pricing-history record (timestamp, prior price, new price, applier,
  suggestion confidence at time of apply, and a `source` field with values
  `manager_apply`, `manager_revert`, or `ai_bulk_apply`). The price-history
  collection MUST be append-only — no record is ever modified or deleted
  after creation.
- **FR-027a**: When a manager reverts an applied price change, the system
  MUST perform a **forward-correction**: write a NEW price-history record
  restoring the prior price (with `source = manager_revert` and a reference
  to the original change record being reverted). The original change record
  MUST be preserved untouched. Re-applying a previously reverted price
  follows the same append-only pattern (a new `manager_apply` record).
- **FR-028**: System MUST exclude low-confidence suggestions (< 0.5) from any
  bulk-apply action by default; managers may apply individually after
  acknowledging the low-confidence label.

### Key Entities

- **Demand Forecast**: A time-indexed series of predicted quantities for a
  given dish over a horizon, each point carrying a central value and a
  lower/upper confidence band; tagged with model freshness and cold-start
  indicator.
- **Recipe Suggestion**: A complete dish definition produced by the AI —
  name, description, ordered preparation steps, ingredient list with
  quantities and units, estimated cost, suggested price, profit margin —
  plus the inputs (ingredients supplied, optional style hint).
- **Customer Recommendation Set**: An ordered list of dish recommendations
  for a specific customer, each with a relevance score and a short reason;
  flagged with cold-start status and the basis (collaborative vs. popularity
  fallback).
- **Recommendation Rating**: A customer's score (1–5 integer scale) for a
  specific dish that was previously surfaced to them as a recommendation
  and that the customer has ordered at least once. Captures rater customer
  ID, dish ID, score, optional short text comment, and timestamp.
- **Published Recommendation**: A customer-elected public endorsement of a
  dish, derived from a Recommendation Rating of ≥ 4. Captures timestamp,
  dish ID, anonymized publisher handle, the rating score at the time of
  publication, and a published/unpublished status flag (one per
  (customer, dish) pair).
- **Public Dish Endorsement Summary**: An aggregated, public-facing roll-up
  per dish: count of currently published endorsements and average published
  rating. Contains no personally identifying customer data.
- **Association Rule**: A pair of antecedent and consequent dish sets with
  support, confidence, and lift values; stamped with the corpus snapshot
  date used to compute it.
- **Pricing Suggestion**: A per-dish recommendation containing current
  price, suggested price, percentage change, confidence score, and the
  feature snapshot (demand signal, ingredient cost, day/season indicators)
  used to derive it.
- **Price-History Record**: An immutable, append-only log entry per applied
  price change, capturing timestamp, dish, prior price, new price, applier
  identity, the suggestion confidence at the time of application, a
  `source` field (`manager_apply` | `manager_revert` | `ai_bulk_apply`),
  and — for revert records — a reference to the original change record
  being reverted. Records are never modified or deleted; reverts are
  represented as new records, not as edits.
- **AI Inference Audit Log Entry**: One record per inference call —
  capability invoked, caller identity, timestamp, latency, outcome
  (success/failure with reason), payload size summary.
- **Inference Service Health Indicator**: The reachability/warmth state of
  the AI layer plus the timestamp of the last successful inference.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero AI/ML endpoints return random or hardcoded predictions
  (verified by an audit of every endpoint at acceptance time and continuously
  by automated tests).
- **SC-002**: Forecast accuracy on a held-out 7-day backtest achieves a mean
  absolute percentage error (MAPE) of 25% or lower for dishes with ≥ 30 days
  of history.
- **SC-003**: 95% of recipe-generation requests return a complete, structured
  recipe within 10 seconds end-to-end.
- **SC-004**: 95% of recommendation requests for returning customers return
  at least 5 ranked suggestions within 2 seconds, whether called by the
  customer themselves or by staff on the customer's behalf.
- **SC-005**: Market basket analysis surfaces at least 10 actionable rules
  (confidence ≥ 0.5, lift ≥ 1.0) against the existing production order
  corpus, refreshed within the last 24 hours.
- **SC-006**: When the AI/ML inference service is offline, every AI endpoint
  returns an explicit error response within 3 seconds (no fabricated data,
  no infinite hang).
- **SC-007**: Managers report (via post-pilot survey, n ≥ 5) that forecast
  and pricing suggestions changed at least one operational decision (order
  size, staffing, price) in the trial week.
- **SC-008**: 100% of applied price changes are recorded in the price-history
  audit trail and are reversible from the pricing view via a forward-
  correction record (the original change is preserved; the revert appears
  as a new `manager_revert` entry). 0 records in the audit trail are ever
  modified or deleted after creation (verified by an automated audit).
- **SC-009**: 100% of AI/ML endpoint calls are recorded in the inference
  audit log with caller identity, capability, latency, and outcome.
- **SC-010**: 0 unauthorized non-admin calls succeed against any AI endpoint
  outside the explicit customer-facing carve-outs (recommend / rate / publish
  / endorsement-summary read), in security-test scenarios.
- **SC-011**: 100% of cross-customer recommendation, rating, or publish
  requests are rejected with an authorization error in security-test
  scenarios.
- **SC-012**: 0 publish actions succeed for ratings below 4 / 5; the system
  rejects every such attempt at the validation boundary.
- **SC-013**: Published endorsements appear on (and unpublish requests
  remove from) the public dish view within 5 seconds in 95% of cases.
- **SC-014**: Public dish-endorsement-summary payloads contain zero
  personally identifying fields (verified by automated audit).
- **SC-015**: All performance targets in SC-002 through SC-006 and SC-013
  are met against a corpus representative of the pilot scale envelope —
  ≤ 200 dishes, ≤ 5,000 customers, ≤ 500 orders/day — with no special
  hardware or scale-out infrastructure required.

## Assumptions

- The existing order history aggregated by the data pipeline is the
  canonical training source for forecasting, recommendations, and market
  basket analysis. No new data ingestion is in scope for this feature.
- An external recipe-generation provider with a structured-JSON response
  capability is available; provisioning of any required API key is handled
  outside this spec via environment configuration.
- AI/ML endpoints are admin-only by default. The personalized-recommendation
  endpoint is additionally accessible to the authenticated customer for
  their own customer ID. After ordering a recommended dish, customers may
  rate the dish on a 1–5 scale and may publish (make visible to other
  customers) only those ratings that are ≥ 4. Published endorsements form
  a social-proof signal on the public dish view, displayed via an
  anonymized publisher handle. Cross-customer access remains forbidden.
- Pricing suggestions are decision-support only and are NEVER applied
  automatically. Every change requires an explicit admin confirmation and
  is reversible from the price-history audit trail.
- Forecast and pricing inferences are computed on-demand for interactive
  views; market basket analysis is recomputed nightly on a schedule and
  served from cache within the day.
- Default thresholds for market basket analysis: minimum support 0.10,
  minimum confidence 0.50, returning the top 20 rules by lift descending.
- Cold-start fallbacks (category-average forecasts, popularity-based
  recommendations) are acceptable user experiences provided they are
  clearly labeled as such in the response.
- Personally identifying customer data (name, contact details) is never
  passed to model inference and is never exposed in the public
  endorsement surface; only internal opaque customer identifiers are used
  for personalization, and only an anonymized handle is shown publicly.
- This feature does NOT include the user-facing pages that consume these
  capabilities (those are scoped under the project's separate frontend
  phase); it delivers the inference and endorsement capabilities and their
  data contracts only.
- Out of scope for this phase: training-data labeling tooling, A/B-testing
  framework for pricing experiments, multi-tenant isolation of models, and
  any customer-facing AI capabilities other than personalized
  recommendations and the rate-and-publish loop on those recommendations.
- **Operational scale envelope** (single-restaurant pilot): up to 200
  distinct dishes on the menu, up to 5,000 distinct customers tracked, up
  to 500 orders per day at peak. The implementation MAY rely on per-dish
  forecasting models, an in-memory customer-similarity matrix, and a
  daily-batch market-basket pass without scale-driven engineering
  compromises. Designs that would only become necessary at multi-location
  or multi-tenant scale (e.g., a single global forecasting model with
  dish/location regressors, sparse/streaming similarity stores, windowed
  Apriori) are explicitly NOT required for this phase.

## Dependencies

- Aggregated order history must be available and current (the project's
  data pipeline already provides this).
- Ingredient cost data must be present for any dish included in pricing
  suggestions; dishes without cost data are skipped with a clear reason.
- An external recipe-generation provider account/credential must be
  provisioned and accessible to the inference layer.
- An authentication mechanism distinguishing admin, staff, and authenticated
  customer roles must be in place — including the ability to assert that
  a request originates from a specific customer (so customer-self carve-outs
  for recommendation, rating, and publish endpoints can be enforced).
- A public-facing dish view (or an equivalent surface) must exist to render
  the published-endorsement summary; if not yet built, the data contract
  defined here is the binding agreement for when the surface is added.
