# Research & Decisions: Real Notification System

**Feature**: 004-real-notification-system
**Date**: 2026-04-30

This document records the design decisions made during planning. Each decision lists the chosen approach, the alternatives considered, and the reason. The implementing model should not re-litigate these — they are the contract for `tasks.md`.

---

## Decision 1 — Per-role read state on the `Notification` document

**Decision**: Each notification carries two independent flag pairs: `readByAdmin` + `readByAdminAt` and `readByStaff` + `readByStaffAt`. Read-state mutations affect only the calling user's role.

**Alternatives considered**:
- A single `read` boolean shared across all roles. Rejected — does not satisfy spec Q5 (round 2): an admin acknowledging an alert must not hide it from staff and vice versa.
- A per-user inbox (`readBy: [userId, ...]`). Rejected — significantly larger schema change, adds a join table or sub-document write per read action, and is not required for the graduation scope (single-tenant, small staff). The chosen per-role shape is forward-compatible: a future migration can replace each flag with a per-user array without breaking the API contract or the bell.

**Why**: Per-role hits the right granularity for the demonstration scenario. Both roles get to see and acknowledge alerts without losing visibility from each other.

---

## Decision 2 — Dedup is keyed on `(type, relatedEntity)` ignoring read state

**Decision**: Within a 24-hour window, **any** existing notification with the same `(type, relatedEntity)` — regardless of whether either role has read it — suppresses creation of a new one. The existing record's `lastSeenAt` is updated to the current time. Notifications without a `relatedEntity` (i.e., `system`, `spoilage_recipe_failed`) are never deduplicated.

**Alternatives considered**:
- Only suppress when an **unread** record exists. Rejected — under per-role read state this is ambiguous (unread by which role?) and creates a race where one role's read flip causes a duplicate to fire on the next condition recurrence.
- A 1-hour window. Rejected — too short for "still below `minStock` after the next order completes" cases that recur naturally throughout the day.
- A 7-day window. Rejected — too long; conditions that resolve and recur within a week deserve a fresh alert.

**Why**: 24h is the natural operational cycle for this restaurant; a single alert per condition per day matches how staff actually work. Ignoring read state in the dedup decision keeps the rule simple and removes the per-role race.

---

## Decision 3 — Cursor pagination, not page-number pagination

**Decision**: `GET /api/notifications?before=<ISO createdAt>&limit=<N>` returns `{ items: [...], nextCursor: <ISO of oldest item or null> }`. Newest first. `limit` defaults to 20 and is capped at 50.

**Alternatives considered**:
- `?page=N&pageSize=20` with a `total` count. Rejected — the notification stream is high-write and the user is paging it newest-first; a new notification arriving between page 1 and page 2 would shift every record by one and cause duplicates. Cursor-based pagination is stable under concurrent writes.
- "No pagination, return last 50". Rejected — fine for the badge dropdown but blocks the "show more" affordance the dropdown will eventually need (and several stories naturally trail off into older entries).

**Why**: Cursors are stable under concurrent writes, cheap to compute (`createdAt` is already indexed), and trivial to consume on the client.

---

## Decision 4 — Polling at 30s, paused while the tab is hidden

**Decision**: The bell's unread-count poll runs at 30s intervals via `setInterval`. The interval is paused when `document.hidden === true` and resumed (with an immediate refresh) when the tab regains visibility.

**Alternatives considered**:
- Websockets / Server-Sent Events. Rejected — would introduce a new transport layer (the existing client is HTTP-only via `axios`), no proxy/reverse-proxy config has been validated for upgrade requests, and the freshness gain (sub-second vs ~30s) is not worth the operational complexity for the graduation demo.
- 10s polling. Rejected — three times the request volume for a marginally faster bell, with no story-level requirement for sub-30s freshness.
- 60s polling. Rejected — fails SC-002 ("within 30 seconds in 95% of polling cycles") for users who have just received a new notification.

**Why**: 30s matches the spec's success criterion exactly; tab-visibility pausing prevents background tabs from generating a constant request stream when nobody is looking.

---

## Decision 5 — Post-order trigger placement: `order.service.js` calls into `inventory.service.js`

**Decision**: After `order.service.js` completes the order's ingredient deduction (the existing flow), it calls `inventory.runPostOrderInventoryChecks(order)`. That function lives on `inventory.service.js` because the check needs access to the same ingredient documents the deduction loop just touched. The call is wrapped in `try/catch` so a check failure logs but never rolls back the order (FR-018).

**Alternatives considered**:
- Put the check inside `notification.service.js`. Rejected — that service should be the **delivery** layer, not the **detection** layer. Mixing them would mean every alert type imports inventory/order/dish models, which is the original problem the existing `notification.service.js` had.
- Put it on a Mongoose post-save hook on `Order`. Rejected — hidden control flow; the order completion path becomes hard to read and harder to test.
- Run a separate cron polling for low-stock conditions. Rejected — slower (the alert would only fire on the next cron tick, possibly the next morning), wasted work when no orders are happening, and violates the spec's expectation that low-stock alerts fire promptly after the order that caused them.

**Why**: This is a "trigger after a known business event" — the existing controller call site is the right place to fan out the side effect.

---

## Decision 6 — Reorder formula and trailing-30-day source

**Decision**:
- `avgDailyUsage` for ingredient `I` is computed as the sum over the last 30 days of `quantity_in_dish × order_line.quantity` for every completed order line whose dish references `I`, divided by 30. This is the same window the demand-forecast trailing-average already uses (`ai.service.js` `getTrailing30dAvg`), keeping a single mental model across the project.
- `daysUntilDepletion = currentQuantity / avgDailyUsage` (returns `Infinity` when `avgDailyUsage === 0`).
- A `reorder` notification is created only when `currentQuantity < minStock` AND `daysUntilDepletion < leadTimeDays` AND the ingredient has at least 14 days of order history (i.e., the trailing 30-day usage is computed from at least 14 distinct days with non-zero usage).
- `suggestedQuantity = ceil(avgDailyUsage × (leadTimeDays + safetyDays)) − currentQuantity`, rounded up to the nearest whole ingredient unit (`kg`, `g`, `l`, `ml`, `pcs`).
- `leadTimeDays` and `safetyDays` are read from environment variables `REORDER_LEAD_TIME_DAYS` (default 3) and `REORDER_SAFETY_DAYS` (default 2).

**Alternatives considered**:
- Compute usage from `Dish.salesCount` × per-ingredient quantity. Rejected — `salesCount` is lifetime, not windowed, so it cannot answer "how fast are we using this *now*."
- Skip the 14-day-history guard. Rejected — for new ingredients the average is wildly unreliable and would generate misleading reorder quantities.
- Round to a fractional unit (e.g., 0.1 kg). Rejected — actual restaurant ordering rounds to whole units; the suggestion should respect that.

**Why**: The formula matches the plan document's prescription verbatim; the 14-day guard mirrors feature 003's forecast `historyStatus = 'insufficient'` rule so the UX is consistent.

---

## Decision 7 — Migration path for the existing partial `Notification.js`

**Decision**: The existing `Notification` model uses a narrower `type` enum (`['spoilage_risk', 'spoilage_recipe_failed', 'system']`) and lacks `relatedEntity`, `entityModel`, `lastSeenAt`, and per-role read state. The model is rewritten in place with the full schema from `data-model.md`. Existing in-flight notifications continue to read correctly because:
- The new schema's enum is a strict superset of the old one.
- The old `read` boolean and `readAt` field are migrated by a one-shot script: any document where `read === true` gets `readByAdmin: true`, `readByAdminAt: <readAt>`, `readByStaff: true`, `readByStaffAt: <readAt>`. (Conservative — assumes both roles already saw it; matches the prior single-flag semantics.)
- Documents missing `lastSeenAt` are backfilled to `lastSeenAt = createdAt` so dedup queries return them.

**Alternatives considered**:
- Drop the existing collection and start fresh. Rejected — `spoilage.cron.js` has been writing notifications during feature 003 development; discarding them is unnecessary data loss.
- Keep the old schema and add new fields alongside. Rejected — leaves the codebase with two ways to express read state and accumulates technical debt.

**Why**: A one-shot migration script is cheap, the data volume is small (hundreds of rows at most), and the new schema is obviously the correct long-term shape.

---

## Decision 8 — Cron timezone via `CRON_TIMEZONE` env var, default `UTC`

**Decision**: `node-cron`'s `schedule` accepts a `timezone` option. Pass `process.env.CRON_TIMEZONE || 'UTC'`. The schedule string `'0 6 * * *'` is interpreted in that zone.

**Alternatives considered**:
- Hardcode `Africa/Cairo`. Rejected — couples the code to one deployment site.
- Use the host's local TZ. Rejected — Docker containers default to UTC; reasoning about "06:00 local" requires knowing the host's `/etc/localtime`, which is unreliable in CI.

**Why**: Env-var TZ is the standard `node-cron` pattern and lets the demo override without a code change.

---

## Decision 9 — "Navigate then mark read" interaction pattern

**Decision**: Clicking a navigable notification row in the dropdown does both, in order:
1. Closes the dropdown.
2. Calls `PATCH /api/notifications/:id/read` (fire-and-forget; no await in the navigation path).
3. `react-router-dom`'s `navigate(targetRoute)` is invoked.

If the row is non-navigable (`system`, `spoilage_recipe_failed`, or related entity no longer exists), only step 2 runs.

**Alternatives considered**:
- "Read first, navigate second" (await). Rejected — slows the click; the read mutation is allowed to fail silently because the next poll will reconcile.
- Click-to-mark-read with a separate "Open" button. Rejected — adds a second control per row for no real gain; the convention from email clients (click to open + mark read) is more familiar.

**Why**: The fire-and-forget mark-read keeps perceived latency low while still satisfying FR-014a's "navigate before marking read" intent (the mark happens before navigation completes).

---

## Decision 10 — Reuse feature 003's `LoadingState` / `EmptyState` / `ErrorState`

**Decision**: The notification dropdown reuses the shared primitives from `Client/src/components/shared/` (created in feature 003) for its loading, empty, and error states. No new state-machine components are introduced.

**Why**: Visual and interaction consistency. These primitives already match the project's Tailwind tokens and the rest of the dashboard.

---

## Decision 11 — Dedup window is enforced server-side, not client-side

**Decision**: `notification.service.createAlert(...)` performs the dedup check (existence query against the composite `(type, relatedEntity)` index, scoped to `createdAt > now − 24h`). The post-order check, the cron, and any future call site can call `createAlert` blindly; the service decides whether to insert or to update `lastSeenAt`.

**Alternatives considered**:
- Each call site implements its own dedup. Rejected — guaranteed to drift and break.
- Mongoose `unique` constraint on `(type, relatedEntity, day-bucket)`. Rejected — composite uniqueness on a derived field is fragile; the server-side check is simpler and more flexible (e.g., for changing the window).

**Why**: Centralizing dedup in one place is the single source of truth for the rule.

---

## Decision 12 — Bell visibility tied to `useAuth().user.role`, not a feature flag

**Decision**: `Navbar.jsx` renders `<NotificationBell />` only when `user.role === 'admin' || user.role === 'staff'`. No global on/off toggle.

**Why**: The notification system has no "off" mode in production — if a user has the role, they should see the bell. A feature flag adds a runtime branch that nobody wants to maintain. If the bell ever needs to be hidden in a future demo, hiding by role is more robust than a build-time flag.
