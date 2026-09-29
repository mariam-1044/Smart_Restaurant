# Feature Specification: Missing Frontend Pages

**Feature Branch**: `003-missing-frontend-pages`
**Created**: 2026-04-28
**Status**: Implemented
**Input**: User description: "P2 — Build All 6 Missing Frontend Pages (read from smart_restaurant_speckit_plan.md)"

## Clarifications

### Session 2026-04-28

- Q: How should the system resolve concurrent edits when two admins save the same dish, customer, or pricing record at nearly the same time? → A: Reject the loser's save, show a "record changed, please refresh" message, and discard their submission.
- Q: What concrete rules define the customer behavioral tags (Regular, High Value, At Risk)? → A: Regular = ≥ 3 orders in last 90 days; High Value = lifetime spend in top 20% of customers; At Risk = was Regular and no order in last 60 days.
- Q: When a filter is active on the dynamic pricing page, what does "apply all" affect? → A: Only the currently visible (filtered) recommendations; confirmation modal states the count and the active filter.
- Q: What window defines a dish's "historical average" for the forecast spike alert? → A: Trailing 30-day average daily quantity.
- Q: What file format does the forecast tabular export produce? → A: CSV (matches the existing inventory CSV export pattern).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Manages the Restaurant Menu in a Dedicated Workspace (Priority: P1)

A restaurant administrator needs a single, focused workspace to maintain the full menu — adding new dishes, editing prices and descriptions, toggling availability, linking ingredients with quantities, and reviewing how prices have shifted over time. Today the only menu administration lives buried inside the order-taking screen, mixing customer-facing actions with backend management and confusing both groups of users.

**Why this priority**: Menu integrity is the foundation of every other operation — ordering, pricing recommendations, inventory deduction, and demand forecasting all assume the menu is accurate and well-categorized. Without a dedicated, reliable place to maintain it, every downstream feature inherits the same data quality problems. Separating menu administration from the point-of-sale also eliminates a known source of confusion for staff.

**Independent Test**: An admin can sign in, navigate to the menu workspace, create a new dish with category, price, image, and ingredient links, see it appear in the list, edit it, toggle its availability, view its pricing history, and delete it — all without ever opening the ordering screen.

**Acceptance Scenarios**:

1. **Given** an admin is signed in, **When** they open the menu workspace, **Then** they see every dish in a sortable, filterable list with name, category, price, availability, and ingredient count.
2. **Given** an admin opens the create-dish form, **When** they enter a name, category, price, and link at least one ingredient with a quantity, **Then** the dish is saved and immediately visible in the list.
3. **Given** an admin edits a dish's price, **When** they save the change, **Then** the new price is reflected on the list and the dish's pricing history records the change.
4. **Given** an admin toggles a dish's availability off, **When** the change is saved, **Then** the dish no longer appears as orderable in the point-of-sale workspace.
5. **Given** a non-admin user attempts to access the menu workspace, **When** the page loads, **Then** access is denied and the user is redirected.

---

### User Story 2 - Admin Reviews and Acts on AI Demand Forecasts (Priority: P1)

A restaurant administrator wants to know which dishes will be in demand over the coming days so they can prepare ingredients, schedule staff, and avoid both stockouts and waste. They need a clear, dish-by-dish forecast for the next 7 or 30 days, with a visible confidence range, a tabular view they can export, and a flag for any dish whose predicted demand spikes well above its average. They also want a derived suggestion for whether they should add staff on the busiest days.

**Why this priority**: Demand forecasting is the headline AI capability of the project. The graduation demonstration depends on visibly turning predictions into concrete operational decisions (staffing, prep). Without this page, the forecasting engine produces numbers nobody sees.

**Independent Test**: An admin selects a dish, picks a 7-day or 30-day window, and sees a chart with predicted quantities and confidence bands, a table view of the same data, a staffing hint for the busiest projected day, and an alert banner whenever any dish's forecast exceeds 30% above its historical average.

**Acceptance Scenarios**:

1. **Given** the forecast page is open, **When** the admin picks a dish and a 7-day window, **Then** a chart shows a predicted-quantity line with an upper/lower confidence band for each of the next 7 days.
2. **Given** a forecast has loaded, **When** the admin switches to the 30-day window, **Then** the chart and table refresh with the longer horizon without reloading the page.
3. **Given** any dish's forecasted daily quantity for the period exceeds 130% of its trailing-30-day average daily quantity, **When** the page renders, **Then** an alert banner names the affected dish and the projected spike.
4. **Given** total forecasted orders for a day exceed an internally defined high-volume threshold, **When** the staffing card renders, **Then** it suggests adding staff for that day.
5. **Given** the forecast service is unavailable, **When** the admin requests a prediction, **Then** the page shows a clear error message and does not display fabricated numbers.

---

### User Story 3 - Admin Applies AI Pricing Recommendations (Priority: P1)

A restaurant administrator wants to see, for each dish, the system's recommended price along with the current price, an indication of whether the recommendation is up or down, a confidence rating, and a snapshot of recent price history. They need to apply suggestions one at a time or in bulk, see the projected revenue impact before confirming, and filter the list to focus on dishes flagged for an increase, a decrease, or no change.

**Why this priority**: Dynamic pricing is the second headline AI capability and the most direct revenue lever in the product. Recommendations that cannot be applied are not actionable; this page makes the AI's output operationally usable.

**Independent Test**: An admin opens the pricing page, filters to "suggested increase," reviews each dish's current price, suggested price, demand score, and confidence, applies one recommendation through a confirmation dialog that shows projected revenue impact, and verifies the change is reflected back on the menu workspace.

**Acceptance Scenarios**:

1. **Given** the pricing page has loaded recommendations, **When** the admin views any dish card, **Then** they see current price, suggested price, direction (up/down/no change), demand score, and confidence percentage.
2. **Given** the admin applies a single recommendation, **When** they confirm in the modal showing projected revenue impact, **Then** the dish's price is updated and its pricing history records the change.
3. **Given** a filter is active and the admin selects "apply all," **When** they confirm in a modal that names the count and the active filter, **Then** only the currently visible (filtered) recommendations are applied and recommendations excluded by the filter are left unchanged.
4. **Given** the admin filters by "suggested decrease," **When** the list refreshes, **Then** only dishes whose suggested price is lower than the current price are shown.
5. **Given** a recommendation has low confidence, **When** the admin views it, **Then** the confidence badge makes the lower reliability visually obvious.

---

### User Story 4 - Admin Approves Staff and Manages Users (Priority: P2)

A restaurant administrator needs to see every registered user — staff, admins, and customers — in one list, approve or reject pending staff registrations, change roles, and deactivate accounts. Filters let the admin focus on pending registrations or active staff without scrolling through the full directory.

**Why this priority**: User and staff onboarding is a routine but high-trust operation. New staff cannot work until approved, so this page directly unblocks day-to-day operations. It is P2 (rather than P1) because the underlying authentication and role system already exists — this page surfaces capabilities, rather than enabling new ones.

**Independent Test**: An admin signs in, opens the user management page, filters by "pending," approves one applicant, watches that applicant's status change to "active," changes a user's role from staff to admin, and confirms the change is reflected on the user's next sign-in.

**Acceptance Scenarios**:

1. **Given** the user management page has loaded, **When** the admin views the list, **Then** every user is shown with name, email, role, and a color-coded status indicator.
2. **Given** the admin filters by "pending," **When** the list refreshes, **Then** only users awaiting approval appear, each with approve and reject controls.
3. **Given** the admin approves a pending user, **When** the change is saved, **Then** the user's status becomes "active" and approve/reject controls disappear.
4. **Given** the admin changes a user's role, **When** the change is saved, **Then** the new role badge is shown immediately and the user's permissions update on their next request.
5. **Given** a non-admin user opens this page, **When** the page loads, **Then** access is denied.

---

### User Story 5 - Staff Reviews Customers and Their Personalized Recommendations (Priority: P2)

Restaurant staff want a directory of customers showing how often each one orders, total spend, last order date, and number of favorite dishes, with a side panel that opens to reveal full order history, favorite dishes, AI-generated personalized recommendations, and quick-glance tags such as "Regular," "High Value," or "At Risk."

**Why this priority**: Customer insight drives both upsell during ordering and retention outreach. The recommendation engine produces per-customer suggestions that are currently invisible to anyone who could act on them. This is P2 because the project's primary operational flows function without it, but the demo and the long-term retention story depend on it.

**Independent Test**: A staff member opens the customer directory, sorts by total spend, opens a high-value customer, sees the recent order timeline, the customer's favorite dishes, three personalized dish recommendations, and a "High Value" tag derived from order frequency and spend.

**Acceptance Scenarios**:

1. **Given** the customer page has loaded, **When** the staff member views the table, **Then** every customer is shown with name/phone, order count, total spend, last order date, and favorites count.
2. **Given** the staff member opens a customer, **When** the detail panel renders, **Then** order history, favorites, personalized recommendations, and behavioral tags are visible.
3. **Given** a customer has placed no orders in the last 60 days, **When** their detail panel renders, **Then** the "At Risk" tag appears.
4. **Given** the recommendation service is unavailable, **When** the panel opens, **Then** order history and favorites still render and the recommendations area shows a clear unavailable state.

---

### User Story 6 - Admin Reduces Food Waste with a Dedicated Analytics Workspace (Priority: P2)

A restaurant administrator wants a single workspace devoted to food waste: how much is being wasted, by ingredient, by category, and over time; which ingredients are about to expire; and a one-click way to turn near-expiry stock into a generated recipe so it is used rather than thrown away. Summary cards show total waste this month, its monetary value, and the percentage change versus the previous month.

**Why this priority**: Reducing food waste is one of the project's stated value pillars, and this page is the most direct demonstration of that pillar. It is P2 because the underlying inventory and dashboard analytics already exist; this view organizes them into an actionable surface.

**Independent Test**: An admin opens the waste page, sees this month's total waste, its monetary value, and a comparison versus last month; reviews waste broken down by ingredient, category, and over time; opens the near-expiry list; clicks "Use in Recipe" on an item and receives a generated recipe that uses the near-expiry ingredients.

**Acceptance Scenarios**:

1. **Given** the waste page has loaded, **When** the admin views the summary cards, **Then** total waste, waste value, and reduction-versus-last-month are all shown.
2. **Given** the breakdown charts have rendered, **When** the admin reviews them, **Then** waste is shown per ingredient, per category, and as a trend over time.
3. **Given** at least one ingredient is within three days of expiry, **When** the admin opens the near-expiry list, **Then** that ingredient appears with a "Use in Recipe" action.
4. **Given** the admin clicks "Use in Recipe" on a near-expiry item, **When** the recipe is generated, **Then** the recipe uses the selected ingredients and is presented in a way the kitchen can act on.

---

### Edge Cases

- A page is opened before any underlying data exists (no dishes, no customers, no waste records, no forecast history). The page must show a clear empty state, not a broken layout or perpetual loader.
- A backend or AI service that the page depends on is unreachable or slow. The page must show a clear error or unavailable state, never fabricated values.
- A user without the required role navigates directly to a restricted page URL. Access must be denied at the route guard, not after the page partially renders.
- Two admins edit the same dish, customer, or price simultaneously. The first save succeeds; the second admin's save is rejected with a "this record was changed by another admin — please refresh to see the latest version" message, and their unsaved changes are discarded so they cannot accidentally overwrite the other edit.
- A customer profile has zero order history. The detail panel must render gracefully and the recommendation area must show a cold-start message rather than empty results.
- A predicted forecast period contains no historical data for the selected dish. The page must explain why a forecast cannot be produced rather than showing a flat zero line.
- A bulk pricing apply contains some failures (e.g. one dish was deleted between load and apply). The page must report which items succeeded and which failed, not silently swallow either outcome.
- A near-expiry recipe generation succeeds but the generated recipe references an ingredient that is no longer in stock by the time it is shown. The recipe must remain visible with a clear note rather than being suppressed.

## Requirements *(mandatory)*

### Functional Requirements

**Menu Management Workspace**

- **FR-001**: System MUST present every dish in a single list with sortable, filterable columns covering name, category, price, availability state, and ingredient count.
- **FR-002**: System MUST allow an admin to create, edit, and delete dishes, and to toggle each dish's availability without leaving the workspace.
- **FR-003**: System MUST allow each dish to be linked to one or more ingredients with a per-ingredient quantity.
- **FR-004**: System MUST display, for any dish, a chronological history of its price changes.
- **FR-005**: System MUST restrict all menu management actions to users with the admin role and refuse access otherwise.

**Demand Forecast Workspace**

- **FR-006**: System MUST display, for an admin-selected dish and time window of 7 or 30 days, a per-day predicted quantity with a visualized confidence band.
- **FR-007**: System MUST present the same forecast in a tabular form, and MUST allow the admin to export it as a CSV file containing one row per forecasted day with columns for date, predicted quantity, lower confidence bound, and upper confidence bound.
- **FR-008**: System MUST surface a visible alert whenever any day's forecasted quantity for a dish exceeds 130% of that dish's trailing-30-day average daily quantity, where the trailing-30-day average is computed from actual order history ending the day before the forecast window begins. If the dish has fewer than 14 days of history, the alert MUST be suppressed and the page MUST note "insufficient history for spike detection."
- **FR-009**: System MUST present a staffing suggestion derived from total forecasted demand on the busiest projected day.
- **FR-010**: System MUST show a clear unavailable state, and never display fabricated numbers, when the forecasting service does not respond successfully.

**Dynamic Pricing Workspace**

- **FR-011**: System MUST display, for each dish, the current price, the recommended price, the direction of change, a demand score, and a confidence rating.
- **FR-012**: System MUST allow filtering recommendations by suggested increase, suggested decrease, or no change.
- **FR-013**: System MUST allow applying a single recommendation or all currently visible (filtered) recommendations, and MUST require a confirmation step that names the count of items being changed, the active filter (if any), and the projected revenue impact of the action. Bulk apply MUST NOT affect recommendations excluded by the active filter.
- **FR-014**: System MUST show recent price history alongside each recommendation so the admin has context before applying.
- **FR-015**: System MUST report partial failures during bulk apply, listing which dishes succeeded and which did not.

**User & Staff Management Workspace**

- **FR-016**: System MUST list every user with name, email, role, and a status indicator that visually distinguishes active, pending, and inactive accounts.
- **FR-017**: System MUST allow filtering the user list by status (all, pending, active, inactive).
- **FR-018**: System MUST allow approving or rejecting pending staff registrations, with the action reflected immediately in the list.
- **FR-019**: System MUST allow changing a user's role between admin, staff, and customer.
- **FR-020**: System MUST restrict all actions on this page to users with the admin role.

**Customer Management Workspace**

- **FR-021**: System MUST list every customer with identifying info, lifetime order count, lifetime total spend, date of last order, and favorites count.
- **FR-022**: System MUST allow opening any customer in a detail panel that shows order history, favorite dishes, and personalized recommendations.
- **FR-023**: System MUST display behavioral tags for each customer derived from their order history using these rules: **Regular** = the customer has placed at least 3 orders in the last 90 days; **High Value** = the customer's lifetime spend is in the top 20% of all customers; **At Risk** = the customer previously qualified as Regular but has placed no order in the last 60 days. A customer may carry more than one tag concurrently when the rules overlap.
- **FR-024**: System MUST gracefully present customers with no order history (cold-start) without throwing errors or hiding the customer.
- **FR-025**: System MUST keep order history and favorites visible even when the personalized recommendation service is unavailable, and MUST show an unavailable state for the recommendations area only.

**Waste Management Workspace**

- **FR-026**: System MUST display summary metrics for total waste this month, the monetary value of that waste, and the change versus the previous month.
- **FR-027**: System MUST display waste broken down by ingredient, by category, and as a time trend.
- **FR-028**: System MUST list ingredients within three days of expiry and allow the admin to launch recipe generation directly from any near-expiry ingredient.
- **FR-029**: System MUST present any generated near-expiry recipe in a form the kitchen can act on (name, ingredients used, and preparation steps).

**Cross-Cutting Requirements**

- **FR-030**: System MUST guard every restricted page at the route level so that unauthorized users are redirected before any page content is fetched or rendered.
- **FR-031**: System MUST provide a clear loading state for every page while data is fetching and a clear empty state whenever the underlying data set is empty.
- **FR-032**: System MUST display a clear, actionable error message whenever a backend or AI dependency fails, and MUST never display fabricated values in place of real data.
- **FR-033**: System MUST visually match the existing application's look, navigation patterns, and accessibility conventions so the new pages feel native rather than bolted on.
- **FR-034**: All six pages MUST be reachable from the application's primary navigation according to the user's role.
- **FR-035**: System MUST detect concurrent-edit conflicts on any record an admin modifies (dish, pricing recommendation, customer, user) and, when a conflict occurs, reject the second save, present a "record changed by another admin — refresh to see the latest version" message, and discard the rejected submission rather than overwriting the saved record.

### Key Entities *(include if feature involves data)*

- **Dish**: A menu item with name, description, category, price, availability flag, image reference, and a set of ingredient links each carrying a quantity. Has an associated price-change history.
- **Ingredient**: A stock item with current quantity, unit, minimum stock level, expiry date, cost, and waste-quantity tracking. Linked to dishes via per-dish quantities.
- **User**: A person with credentials, a role (admin, staff, or customer), and a status (active, pending, inactive). Pending users require admin approval before they can act.
- **Customer**: A patron with contact details, an order history, a favorites set, and a derived behavioral classification (Regular, High Value, At Risk).
- **Forecast**: A predicted per-day quantity for a specific dish over a future window, accompanied by upper and lower confidence bounds.
- **Pricing Recommendation**: For a specific dish, a current price, a recommended price, a direction of change, a demand score, and a confidence rating, anchored to a recent price-history snapshot.
- **Waste Record**: Quantity and monetary value of an ingredient discarded, attributed to an ingredient, a category, and a date.
- **Notification (alert banner)**: A surface-level signal raised when a dish's forecast spikes above its average or staffing should be reconsidered. (Distinct from the persistent notification system planned in P3.)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can fully manage a dish (create → link ingredients → set price → save → reopen and verify) in under 90 seconds without leaving the menu workspace.
- **SC-002**: All six pages reach a usable state (visible content or a clear empty/loading/error state) within three seconds on a typical broadband connection in 95% of loads.
- **SC-003**: Zero menu-management actions remain in the point-of-sale workspace after this feature ships; admins use only the dedicated workspace.
- **SC-004**: An admin can approve a pending staff registration in under 30 seconds from arriving at the workspace.
- **SC-005**: An admin can apply a single AI pricing recommendation, end-to-end with confirmation, in under 15 seconds.
- **SC-006**: An admin can identify the busiest forecasted day for a dish in under 10 seconds after the forecast loads.
- **SC-007**: A staff member can locate any specific customer and view their personalized recommendations in under 20 seconds.
- **SC-008**: An admin can launch a near-expiry recipe and receive a usable result in under 30 seconds from arriving at the waste workspace.
- **SC-009**: 100% of restricted pages refuse access at the route guard for unauthorized roles, with no partial render or data leak.
- **SC-010**: 100% of dependency failures (backend or AI service unavailable) surface a clear unavailable or error state, with zero pages showing fabricated values in place of missing data.
- **SC-011**: Every page exposes loading, empty, populated, and error states; an automated or manual review can verify all four for each of the six pages.

## Assumptions

- The existing role-based access control (admin / staff / customer) is the source of truth for page-level authorization; no new role definitions are introduced by this feature.
- The existing visual design system (color, typography, spacing, components, charting library) will be reused for consistency rather than introducing a new design language.
- Backend endpoints required by these pages either already exist or are being added in the parallel backend bug-fix work; this specification is concerned with the user-facing pages and their behavior, not with adding backend capabilities beyond what those pages must consume.
- The AI services for forecasting, pricing, recommendations, and recipe generation are being implemented separately; these pages must function correctly when those services succeed and degrade gracefully when they do not.
- "Recent" price history means the most recent few price changes per dish — exact length is a presentation detail and may be tuned without changing the spec.
- Customer behavioral tag thresholds are now explicit (see FR-023): they use only order count, lifetime spend, and last-order date — all already tracked on the customer record. They can be tuned in future iterations without redesigning the page.
- Staffing suggestion thresholds will be defined by simple operational rules (e.g. forecasted orders above a configured daily volume) rather than by an additional ML model.
- These pages are designed for desktop and tablet usage by restaurant administrators and staff; mobile-first or phone-sized layouts are out of scope for this iteration.
- The pricing apply confirmation's "projected revenue impact" is computed from current demand and forecast data already available to the application; no new revenue model is introduced.
- Internationalization, currency localization, and right-to-left layouts are out of scope for this iteration.
