# Feature Specification: Real Notification System

**Feature Branch**: `004-real-notification-system`
**Created**: 2026-04-29
**Status**: Draft
**Input**: User description: "P3 — Real Notification System (read from smart_restaurant_speckit_plan.md)"

## Summary

Today the backend's "notifications" only call `logger.info()` / `console.log()` — they vanish the moment they are written, no admin or staff member ever sees them in the application, and no record exists to look up later. This feature replaces that console-only logging with a persisted, role-targeted, in-app notification system: every operationally significant event (low stock, expiry, reorder suggestion, near-expiry spoilage risk, generic system event) is written to a `Notification` collection, exposed through a small REST surface, and surfaced inside the existing application via a notification bell in the top navbar. Two new background flows are added on top of the persistence layer — an auto-reorder suggestion fired after order placement, and a daily 06:00 cron that detects near-expiry stock and attaches an AI-generated recipe to the resulting notification — so the staff has actionable, time-sensitive guidance rather than buried logs.

## Clarifications

### Session 2026-04-29 (round 1)

- Q: How should the in-app notification center stay current — push (websocket/SSE) or pull (polling)? → A: Pull, using a 30-second polling interval against an unread-count endpoint, to match the existing project's HTTP-only client and avoid introducing a new transport.
- Q: When the same condition recurs (e.g., the same ingredient is still below `minStock` the next time the check runs), should a duplicate notification be created? → A: No — within a 24-hour window, **any** existing notification of the same type for the same `relatedEntity` (read or unread, by either role) suppresses re-creation; the existing record's `createdAt` is left untouched and a `lastSeenAt` field is updated. This prevents the bell from drowning in duplicates.
- Q: Who can mark a notification as read? → A: Any user whose role matches the notification's `targetRole` (or `'all'`). See round 2 Q5 for how `'all'` interacts with per-role read state.
- Q: What happens to read notifications over time? → A: Read notifications whose latest per-role `readAt` is more than 30 days old are deleted by the same daily cron that runs the spoilage scan. Unread notifications are never auto-deleted.
- Q: When the AI recipe service fails inside the daily spoilage cron, should the spoilage notification still be created? → A: Yes — the notification is created with `type: 'spoilage_risk'` and the recipe attachment is omitted; a separate `type: 'spoilage_recipe_failed'` notification records the failure for the admin so the gap is traceable. Never fabricate a recipe.
- Q: For auto-reorder, where do `leadTimeDays`, `safetyDays`, and `avgDailyUsage` come from? → A: `leadTimeDays` and `safetyDays` are read from environment variables with defaults (`REORDER_LEAD_TIME_DAYS=3`, `REORDER_SAFETY_DAYS=2`); `avgDailyUsage` is computed from the trailing-30-day order-line history for each ingredient, the same window already used by the demand-forecast trailing average.

### Session 2026-04-29 (round 2)

- Q: Pagination shape for `GET /api/notifications`? → A: Cursor-based. Query: `?before=<ISO createdAt>&limit=20` (limit max 50). Response: `{ items: [...], nextCursor: <ISO createdAt of last item, or null> }`. Newest first. Cursor avoids pagination drift when new notifications stream in while the user is paging.
- Q: Where does the daily expiry scan live? → A: The 06:00 spoilage cron also iterates ingredients within three days of expiry and creates an `expiry` notification per ingredient, alongside the single aggregate `spoilage_risk` notification with the recipe attachment. One cron, two notification types — keeps the schedule simple and avoids drift between scans.
- Q: Click-through targets for each notification type? → A: Each notification carries a deterministic deep-link route resolved on the client from `(type, relatedEntity)`. Required routes that must exist after this feature ships: `/inventory/:id` (ingredient detail), `/admin/menu/:id` (dish detail, anchored from the menu workspace), `/orders/:id` (order detail, **new — does not currently exist and must be added by this feature**). `system` and `spoilage_recipe_failed` notifications are non-navigable.
- Q: Cron timezone? → A: Configurable via `CRON_TIMEZONE` environment variable, default `UTC`. The schedule string `'0 6 * * *'` is interpreted in that timezone. The graduation demo can override to `Africa/Cairo` (or whichever local TZ is wanted) without code changes.
- Q: How does `targetRole: 'all'` interact with read state? → A: Read state is tracked **per role**. A notification with `targetRole: 'all'` carries two independent read flags (`readByAdmin` / `readByStaff`) and timestamps. An admin marking it read does **not** hide it from staff and vice versa. For notifications with a single-role `targetRole`, only that role's flag is meaningful; the other flag stays `false` and is ignored. Per-user inboxes are still out of scope (a P5 enhancement); this is per-role, not per-user.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Staff Sees a Live Notification Center in the Top Bar (Priority: P1)

A staff member or administrator working anywhere inside the application can glance at a bell icon in the top navbar and immediately know whether anything operationally important needs their attention. The bell shows an unread count; clicking it opens a dropdown listing the most recent notifications with title, message, type icon, relative time, and read state. From the dropdown they can mark a single item read or mark all as read, and the badge count updates without reloading the page.

**Why this priority**: A persisted notification database is worthless if nobody can see it. The bell is the single user-facing surface that makes every other notification type in this feature visible. Without it, the rest of the work is invisible to the people the system is built for.

**Independent Test**: An admin signs in, sees the bell icon in the navbar with an unread badge reflecting the seeded notifications, opens the dropdown to see their content, clicks "Mark all read," and watches the badge disappear. The badge re-appears within 30 seconds when a new notification is created on the backend.

**Acceptance Scenarios**:

1. **Given** an admin is signed in and at least one notification with `readByAdmin: false` exists, **When** the navbar renders, **Then** the bell icon shows a badge with the unread-for-admin count.
2. **Given** the admin clicks the bell, **When** the dropdown opens, **Then** the most recent up-to-20 notifications are shown with type icon, title, message, and a relative time stamp; the unread/read styling reflects the **admin's** read state, not the staff's.
3. **Given** the admin clicks "Mark all read," **When** the action completes, **Then** every visible notification renders in the read state for the admin **and the badge disappears**, but a staff member signed in elsewhere still sees them as unread.
4. **Given** a customer (non-staff) is signed in, **When** the navbar renders, **Then** no bell icon appears.
5. **Given** the admin has the dropdown open, **When** a new notification is created on the server, **Then** within 30 seconds the badge increments and the new notification appears at the top of the list without a manual refresh.
6. **Given** the admin clicks any notification row that maps to a deep-link target (`low_stock`, `expiry`, `reorder`, `spoilage_risk`), **When** the click is registered, **Then** the application navigates to the resolved detail route and the notification is marked read for the admin role.

---

### User Story 2 - Stock and Expiry Alerts Persist and Surface to Staff (Priority: P1)

When an ingredient's quantity drops to or below its minimum stock level, or when an ingredient is within three days of expiry (or past expiry), the system records a persisted notification visible in the bell instead of (or in addition to) writing to the server log. Staff and administrators can then act on these alerts from the same workspace where they already manage inventory.

**Why this priority**: Stock-out and spoilage are the two most common operational failures the restaurant runs into. The codebase already detects both conditions but currently only writes them to the log file, where nobody reads them. Persisting and surfacing these conditions is the highest-value change in the feature; it converts existing dormant detections into actionable alerts.

**Independent Test**: An admin restocks an ingredient to one unit above its minimum, places an order that consumes two units, and confirms a low-stock notification with the ingredient's name appears in the bell. Separately, an admin creates an ingredient with an expiry date in two days and confirms an expiry notification appears.

**Acceptance Scenarios**:

1. **Given** an ingredient's quantity is at or below its `minStock` after an order completes, **When** the post-order inventory check runs, **Then** a `low_stock` notification is created targeting the admin role and the ingredient is referenced via `relatedEntity`.
2. **Given** an ingredient's `expiryDate` is within three days of today, **When** the 06:00 spoilage cron runs (which also performs the daily expiry sweep — see FR-019a), **Then** an `expiry` notification is created with the days-until-expiry value in the message.
3. **Given** the same low-stock condition still holds when the next order completes, **When** the inventory check runs again within 24 hours, **Then** no duplicate notification is created and the existing notification's `lastSeenAt` is updated.
4. **Given** the admin clicks a stock or expiry notification in the dropdown, **When** the click is registered, **Then** the application navigates to `/inventory/:id` (the route added by FR-014b) and the notification is marked read for the admin role.
5. **Given** an ingredient has been deleted between when a notification was created and when it is viewed, **When** the dropdown renders that notification, **Then** the entry still displays with a clear "(item no longer available)" label, the row is non-navigable, and the notification can still be marked read.

---

### User Story 3 - Auto-Reorder Suggestions Tell the Admin Exactly How Much to Buy (Priority: P2)

When a low-stock condition is detected after an order completes, the system also evaluates whether the projected daily usage will deplete the remaining stock before a reorder could realistically arrive. If so, it generates a `reorder` notification that names the ingredient and recommends a concrete reorder quantity calibrated to lead time plus a safety buffer. The admin can read the recommendation, decide, and adjust their next purchase order without doing the arithmetic themselves.

**Why this priority**: A low-stock alert without a quantity recommendation forces the admin to compute lead-time × usage every time, which they often skip. Adding the suggested-quantity calculation turns the alert into a decision the admin can act on in seconds. This is P2 (rather than P1) because it depends on the persistence and bell of US1+US2 to be visible at all.

**Independent Test**: An admin places enough orders to drop an ingredient below its `minStock` while the trailing-30-day usage indicates depletion within the configured lead-time window. They open the bell and see a `reorder` notification quoting a specific quantity to buy, computed as `(avgDailyUsage × (leadTimeDays + safetyDays)) − currentQuantity`.

**Acceptance Scenarios**:

1. **Given** an ingredient's `currentQuantity` is below `minStock` and its forecasted days-until-depletion is less than `leadTimeDays`, **When** the post-order check runs, **Then** a `reorder` notification is created whose message includes the suggested reorder quantity.
2. **Given** the same low-stock condition produces both a `low_stock` and a `reorder` notification, **When** the bell renders, **Then** both notifications are visible separately (one is a status alert, the other is a recommendation).
3. **Given** an ingredient has fewer than 14 days of order history, **When** the post-order check runs, **Then** no `reorder` notification is created (the average would be unreliable) and only the plain `low_stock` alert fires.
4. **Given** a `reorder` notification was created within the last 24 hours and is still unread, **When** the same condition recurs, **Then** the duplicate is suppressed per the de-duplication rule.

---

### User Story 4 - The System Detects Spoilage Risk Each Morning and Suggests a Recipe (Priority: P2)

Every day at 06:00, before the kitchen opens, the system scans inventory for ingredients within three days of expiry. If any are found, it asks the existing AI recipe service for a dish that uses those ingredients and writes a `spoilage_risk` notification with the suggested recipe attached, so the head chef finds a concrete plan waiting in the bell rather than a problem.

**Why this priority**: Reducing food waste is one of the project's stated value pillars and the bell turns this scan into a daily conversation with the kitchen. The cron is P2 because the underlying expiry detection (US2) and the AI recipe service already exist; this story orchestrates them into a single morning briefing.

**Independent Test**: Set an ingredient's expiry to two days from now. Force-run the spoilage cron (or wait until 06:00). Confirm a `spoilage_risk` notification appears in the bell whose `payload` contains the ingredient list, a recipe name, ingredients, and steps.

**Acceptance Scenarios**:

1. **Given** at least one ingredient is within three days of expiry at 06:00, **When** the spoilage cron runs, **Then** a `spoilage_risk` notification is created targeting staff and admins, and its `payload` includes the originating ingredient ids and the AI-generated recipe.
2. **Given** the AI recipe service responds successfully, **When** the cron writes the notification, **Then** the recipe's name, ingredients, and steps are stored in the notification `payload` so the kitchen can act without making a second call.
3. **Given** the AI recipe service is unavailable, **When** the cron writes the spoilage notification, **Then** the recipe attachment is omitted (no fabricated steps) and an additional `spoilage_recipe_failed` system notification is created so the gap is visible to the admin.
4. **Given** no ingredients are within three days of expiry, **When** the cron runs, **Then** no notification is created (silence is informative — the bell is not used as a heartbeat).
5. **Given** read notifications older than 30 days exist, **When** the same daily cron runs, **Then** they are deleted; unread notifications are never auto-deleted.

---

### User Story 5 - Stale Notifications Are Pruned Automatically (Priority: P3)

Read notifications older than 30 days are removed by the same daily cron that runs the spoilage scan, so the notification list does not grow unbounded over months of operation. Unread notifications are kept regardless of age — if nobody has acknowledged a problem, the system continues to show it.

**Why this priority**: Pure housekeeping. It does not deliver new user value but keeps the bell usable over time. P3 because the system functions correctly without it for the foreseeable demonstration window; only long-running deployments need it.

**Independent Test**: Seed read notifications with `createdAt` 31 days in the past. Run the cron. Confirm those notifications are gone and that any unread or recent notifications are untouched.

**Acceptance Scenarios**:

1. **Given** a read notification has `readAt` more than 30 days ago, **When** the daily prune step runs, **Then** the notification is deleted.
2. **Given** an unread notification has `createdAt` more than 30 days ago, **When** the daily prune step runs, **Then** the notification is **not** deleted.
3. **Given** a read notification has `readAt` within the last 30 days, **When** the daily prune step runs, **Then** the notification is **not** deleted.

---

### Edge Cases

- The notification dropdown is opened the very first time after deployment, when no notifications exist at all. The dropdown must show a clear empty state, not a loader stuck forever.
- A notification's `relatedEntity` (e.g. the ingredient) is deleted after the notification was written. The notification must still render with a clear "(item no longer in inventory)" label, not error out.
- Two admins click "Mark all read" at nearly the same moment. The second click must not error; the system must accept the no-op idempotently.
- The notification API is unreachable while the bell is open. The badge must continue to display the last successfully fetched count and the dropdown must show a quiet inline error instead of an empty list (so the user knows the count may be stale).
- A user whose role does not match `targetRole` somehow obtains a notification id (e.g., shared URL). The mark-read endpoint must reject the action with a 403, not silently succeed.
- The polling interval coincides with a long-running tab in the background; the browser throttles `setInterval`. The system must accept the polling skew without producing duplicate notifications or duplicate read events.
- The AI recipe service returns a recipe that references an ingredient that is no longer in stock by the time the kitchen reads it the next morning. The recipe must remain visible with a clear note (handled the same way as the recipe surface in feature 003), not be suppressed.
- The post-order inventory check fires while another order is mid-flight on the same ingredients. The notification creation must not block or fail order completion — order acceptance is the system of record; the notification is a side effect.
- An ingredient is restocked between when the low-stock notification was created and when it is read. The notification must remain visible (it is a record of what was true at the time) but the system must not re-create it when restock completes; it must wait for the condition to recur naturally.
- The 30-day prune step encounters more rows than can be deleted in a single batch. The prune must complete in batches without exceeding query timeouts.

## Requirements *(mandatory)*

### Functional Requirements

**Persistence**

- **FR-001**: System MUST persist every operationally significant alert (low stock, expiry, reorder suggestion, spoilage risk, generic system event) as a `Notification` document with at minimum: type, title, message, target role, optional related entity reference (id + collection name), optional structured payload, **per-role read flags and timestamps** (`readByAdmin` + `readByAdminAt`, `readByStaff` + `readByStaffAt`), creation timestamp, and a `lastSeenAt` timestamp updated by the de-duplication path.
- **FR-002**: System MUST replace every existing console-only notification call (`logger.info` / `console.log` style alerts in `notification.service.js`) with a persisted notification creation. After this feature ships, no operational alert lives only in the log file.
- **FR-003**: System MUST de-duplicate notifications: within a 24-hour window, **any** existing notification (read or unread, by either role) of the same `type` for the same `relatedEntity` MUST suppress creation of a new one; instead the existing record's `lastSeenAt` is updated to the current time. Notifications with no `relatedEntity` (e.g. `system`, `spoilage_recipe_failed`) are never deduplicated.
- **FR-004**: System MUST never fabricate alert content. When an underlying service (notably the AI recipe service for spoilage notifications) fails, the dependent attachment MUST be omitted and a separate failure-record notification created so the gap is auditable.

**REST API**

- **FR-005**: System MUST expose `GET /api/notifications?before=<ISO>&limit=<N>` returning the current user's role-targeted notifications, newest first, in cursor-based pages. `limit` is capped at 50 and defaults to 20. The response MUST be `{ items: [...], nextCursor: <ISO createdAt of the oldest item in the page, or null when exhausted> }`.
- **FR-006**: System MUST expose `GET /api/notifications/unread-count` returning the count of notifications visible to the calling user's role whose corresponding role's read flag is `false`, suitable for badge display.
- **FR-007**: System MUST expose `PATCH /api/notifications/:id/read` to mark a single notification read **for the calling user's role only**, setting that role's `readBy<Role>` flag to `true` and `readBy<Role>At` to the current time. Other roles' read state MUST be left untouched. Calls by users whose role does not match the notification's target (or `'all'`) MUST be rejected with HTTP 403.
- **FR-008**: System MUST expose `PATCH /api/notifications/read-all` to mark every notification visible to the calling user's role as read **for that role only**, idempotently. Other roles' read state MUST be left untouched.
- **FR-009**: System MUST restrict every notification endpoint to authenticated users with role `admin` or `staff`. Customer-role users MUST NOT have access.

**In-app Notification Center**

- **FR-010**: System MUST add a bell icon to the application's primary navigation visible only to `admin` and `staff` roles.
- **FR-011**: System MUST display an unread count badge on the bell, refreshed every 30 seconds via a poll against the unread-count endpoint, and refreshed immediately after any "mark read" action.
- **FR-012**: System MUST present the most recent up-to-20 notifications in a scrollable dropdown panel anchored to the bell, each row showing a type icon, title, message, and a relative time stamp ("2 minutes ago"), with a clear visual distinction between unread and read rows from the **calling user's role's perspective**.
- **FR-013**: System MUST provide "Mark all read" inside the dropdown. The control MUST be disabled when no unread notifications are present for the calling user's role.
- **FR-014**: System MUST present a clear empty state inside the dropdown when no notifications exist, and a clear inline error state when the notification API is unreachable, never an indefinite loader.
- **FR-014a**: System MUST resolve a click on any notification row to a deterministic deep-link route based on `(type, relatedEntity)` and navigate the user there before marking the notification read. Required mappings: `low_stock` / `expiry` / `reorder` → `/inventory/:id`; `spoilage_risk` → `/inventory/:id` (the first attached ingredient); `system` and `spoilage_recipe_failed` → non-navigable. Notifications whose `relatedEntity` no longer exists in the database MUST display "(item no longer available)" and become non-navigable.
- **FR-014b**: System MUST add the detail routes that the click-through requires. Required new routes: `/inventory/:id` (ingredient detail), `/orders/:id` (order detail — does not currently exist and MUST be created by this feature). `/admin/menu/:id` (dish detail — may be implemented as a deep-linked open-edit-modal on the existing `/admin/menu` page). Each route MUST honour the same role-based guard already used by its parent workspace.

**Auto-Reorder Suggestion**

- **FR-015**: System MUST evaluate, after every order completes, whether each consumed ingredient is below `minStock`, and if so create a `low_stock` notification (per FR-001 and FR-003).
- **FR-016**: System MUST additionally create a `reorder` notification whenever a below-`minStock` ingredient also has projected days-until-depletion less than the configured lead time, AND it has at least 14 days of order history; the notification's message MUST include a suggested reorder quantity computed as `(avgDailyUsage × (leadTimeDays + safetyDays)) − currentQuantity`, rounded to the ingredient's natural unit increment.
- **FR-017**: System MUST source `leadTimeDays` and `safetyDays` from environment variables (`REORDER_LEAD_TIME_DAYS`, `REORDER_SAFETY_DAYS`) with defaults of 3 and 2 respectively. Changing these values MUST NOT require code changes.
- **FR-018**: System MUST never block order completion on notification creation. Notification side-effects MUST be best-effort and any failure MUST be logged but MUST NOT roll back the order.

**Daily Spoilage Cron**

- **FR-019**: System MUST run a daily scheduled job at 06:00 in the timezone configured by the `CRON_TIMEZONE` environment variable (default `UTC`). The schedule string `'0 6 * * *'` MUST be interpreted in that timezone — changing `CRON_TIMEZONE` MUST shift the run time without code changes.
- **FR-019a**: The same cron run MUST also create one `expiry` notification per ingredient that is within three days of `expiryDate` (or already expired), subject to the de-duplication rule in FR-003. The `expiry` notifications and the `spoilage_risk` notification are written in the same transaction-equivalent loop so that a partial cron failure leaves a coherent state.
- **FR-020**: System MUST, when at least one near-expiry ingredient is found, call the AI recipe service with those ingredients and create a single aggregated `spoilage_risk` notification whose `payload` contains the originating ingredient ids and the recipe (name, ingredients, steps).
- **FR-021**: System MUST, when the AI recipe service is unavailable, still create the `spoilage_risk` notification (with the recipe field omitted) AND a `spoilage_recipe_failed` system notification capturing the failure.
- **FR-022**: System MUST, in the same daily run, delete notifications that are fully read by every relevant role and whose latest per-role `readBy<Role>At` is more than 30 days old, in batches that do not exceed query timeouts. A notification with `targetRole: 'all'` MUST be considered fully read only when both `readByAdmin` and `readByStaff` are `true`. Unread notifications (by any relevant role) MUST never be auto-deleted regardless of age.

**Cross-Cutting**

- **FR-023**: System MUST keep the existing inventory, order, and recipe flows working unchanged when this feature is removed or disabled — the notification system is additive and never on the critical path of business operations.
- **FR-024**: System MUST log every notification creation and every "mark read" action to the existing application logger so that the persisted notifications can still be reconstructed from logs in the event of a database restore.

### Key Entities *(include if feature involves data)*

- **Notification**: A persisted record of an operationally significant event. Carries a type (`low_stock`, `expiry`, `reorder`, `spoilage_risk`, `spoilage_recipe_failed`, `system`), a human-readable title and message, a target role (`admin`, `staff`, or `all`), an optional reference to a related entity (ingredient, dish, or order — `relatedEntity` id plus `entityModel` discriminator), an optional structured `payload` (used by spoilage notifications to carry the recipe and by reorder notifications to carry the suggested quantity), **two independent per-role read flags and timestamps** (`readByAdmin` + `readByAdminAt`, `readByStaff` + `readByStaffAt`) so a `targetRole: 'all'` notification can be acknowledged independently by each role, the time it was first created (`createdAt`), and the time it was most recently re-seen by the de-duplication check (`lastSeenAt`).
- **Reorder Suggestion (computed)**: A derived value, not its own document. Computed from an ingredient's trailing usage and the configured lead-time/safety values, embedded in a `reorder` notification's message and `payload` at creation time so the suggestion is stable even if the underlying numbers later change.
- **Spoilage Recipe Attachment (computed)**: The AI-generated recipe attached to a `spoilage_risk` notification. Stored in the notification's `payload`; never re-fetched. If absent, the notification still renders, with the kitchen instructed to use the listed ingredients however they see fit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero operational alerts remain console-only after this feature ships. A grep of `notification.service.js` shows no `logger.info`/`console.log` calls used as the sole delivery channel for stock, expiry, or reorder events.
- **SC-002**: An admin sees a newly created notification in the bell within 30 seconds of its server-side creation in 95% of polling cycles.
- **SC-003**: An admin can go from "I see the bell badge" to "I have read the notification and know what to do" in under 10 seconds.
- **SC-004**: 100% of notification endpoints reject access by non-admin/non-staff users with HTTP 403, verified manually with a customer-role token.
- **SC-005**: 100% of recurring conditions within a 24-hour window result in exactly one persisted notification per `(type, relatedEntity)` pair regardless of read state, verified by inducing the same low-stock condition twice in succession.
- **SC-006**: 100% of dependency failures (AI recipe service unavailable) surface as a `spoilage_recipe_failed` system notification rather than an exception or a silent omission, verified by stubbing the AI service down.
- **SC-007**: An admin opens the bell on a brand-new database with no notifications and sees a clear empty state, not a perpetual loader, in under three seconds.
- **SC-008**: Notifications fully read by every relevant role and older than 30 days are pruned within one daily cron run; notifications still unread by at least one relevant role are preserved regardless of age, verified by seeding both classes and observing the cron's effect.
- **SC-008a**: A `targetRole: 'all'` notification marked read by an admin remains visible (and unread-styled, and counted in the badge) for a staff user, verified by signing in as both roles in turn.
- **SC-009**: Order completion latency is unchanged within ±50 ms when the notification side-effect is enabled vs. disabled, verified by timing a representative order under both configurations.
- **SC-010**: The bell is visible in the navbar to admin and staff users and absent for customer users on every page of the application that uses the existing top navigation, verified manually across the dashboard, ordering, inventory, and report pages.

## Assumptions

- The existing role-based access control (admin / staff / customer) is the source of truth for notification authorization; no new role definitions are introduced by this feature.
- The existing application's HTTP API surface (`/api/...`) is the only delivery channel for the notification center; no websockets, server-sent events, or push services are introduced. The 30-second polling interval is the chosen trade-off between freshness and simplicity.
- The existing AI recipe service exposed at `POST /api/v1/ai/recipe` is the source of recipe attachments for the daily spoilage cron. If that service is unavailable, the spoilage notification still ships without a recipe; this feature does not replace or wrap the recipe service.
- The existing inventory, order, and ingredient data models already carry `quantity`, `minStock`, `expiryDate`, and `unit`. This feature reads those fields without changing their shape.
- `node-cron` is acceptable as the scheduler. No external job runner (Kubernetes CronJob, Cloud Scheduler) is introduced; the cron lives in-process. If the application restarts, the cron re-attaches on boot.
- Single-tenant deployment: a notification with `targetRole: 'admin'` is visible to **every** admin user, and read state is shared across all admins (per-role read, not per-user). Per-user inboxes remain out of scope for this iteration; the per-role schema (`readByAdmin` / `readByStaff`) is forward-compatible — a future migration can replace each flag with a `readBy: [userId, ...]` array without breaking the API contract.
- Email or SMS fan-out is **out of scope** for this feature. The plan's optional SMTP environment variables are reserved for a later phase; this feature ships in-app only.
- The mobile/responsive form factor is unchanged; the bell appears in the same desktop/tablet navbar consumed by feature 003.
- Internationalization, currency localization, and right-to-left layouts are out of scope, consistent with feature 003.
- A small `Notification` model already exists in the codebase but is incomplete (limited type enum, missing `relatedEntity`, no de-duplication or unread-count helpers). This feature treats that file as a draft to be replaced rather than as an existing contract.
