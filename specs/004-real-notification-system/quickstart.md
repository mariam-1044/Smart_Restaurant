# Quickstart: Real Notification System

**Feature**: 004-real-notification-system
**Date**: 2026-04-30

This is the manual verification gate for the feature. Each section maps 1:1 to a user story in `spec.md`. A run is "passing" when every section's checkbox list completes with no deviations.

Automated tests are P5 scope per `smart_restaurant_speckit_plan.md` and are not part of this gate.

---

## Prerequisites

- MongoDB running locally; `Server/.env` populated.
- ML service running for the recipe step in §4.
- An admin account, a staff account, and a customer account exist in the DB (or seed them via the existing `Server/src/infrastructure/seed.js` if available).
- Optional but recommended for §4 / §5: `CRON_TIMEZONE=UTC` in `.env` so the schedule is predictable; defaults to UTC anyway.
- `REORDER_LEAD_TIME_DAYS=3`, `REORDER_SAFETY_DAYS=2` (defaults) unless you want to test alternative values.

Run:
```bash
cd Server && npm install && npm run dev
cd Client && npm install && npm run dev
```

---

## §1 — User Story 1: notification bell in the navbar

**Goal**: confirm the bell renders, polls, and lets the admin mark read without reload.

Steps:
1. Sign in as **admin**. Confirm the bell icon is visible at the right side of the top navbar.
2. Sign in (in a separate browser / incognito) as a **customer**. Confirm **no** bell appears.
3. Back in the admin window, seed at least one notification with the helper script:
   ```bash
   # From the Server directory
   node -e "require('./src/application/services/notification.service').createAlert({ type: 'system', title: 'Hello world', message: 'Manual seed for QS §1.', targetRole: 'admin' }).then(() => process.exit())"
   ```
4. Within 30 seconds, the bell badge should show "1" without refreshing the browser.
5. Click the bell. The dropdown opens, "Hello world" is the only row, type icon is `FaInfoCircle`, relative time is "just now" or "1 second ago".
6. Click "Mark all read." The badge disappears, the row's styling shifts to read.
7. Sign in as **staff** in a different browser. Confirm the same notification was *not* targeted at staff (it was admin-only) — the bell shows count 0.

Acceptance:
- [ ] Bell renders for admin and staff, hidden for customer.
- [ ] Badge updates within 30s of a server-side notification creation.
- [ ] Dropdown lists newest first, with title, message, type icon, relative time.
- [ ] "Mark all read" empties the badge for the calling role only.

---

## §2 — User Story 2: persisted low-stock and expiry alerts

**Goal**: confirm the post-order check writes a real `Notification`, not a console line, and the cron writes per-ingredient `expiry` notifications.

Pre-step: pick any ingredient you can edit via `/inventory`. Set its `quantity` to one above its `minStock`. Set its `expiryDate` to two days from today.

Steps:
1. As an **admin**, place an order via the ordering screen that consumes enough of the ingredient to drop it at or below `minStock`. (Use the regular `/order` flow.)
2. Within ~5 seconds, the bell badge for the admin should increment by 1. Open the dropdown and confirm a `low_stock` row exists, naming the ingredient. Click it; the URL should navigate to `/inventory/<ingredientId>`.
3. Confirm the row is now styled read.
4. Force-run the cron (do NOT wait until 06:00):
   ```bash
   node Server/src/infrastructure/cron/spoilage.cron.js --once
   ```
5. Within ~5 seconds the bell badge should increment by exactly 1 for the same ingredient — an `expiry` row.
6. Repeat the cron run immediately. The badge should NOT increment again — dedup catches it.
7. Re-place the same order to re-trigger the post-order check. The badge should NOT increment for `low_stock` again either.
8. (Stretch) Delete the ingredient via `/inventory`. Re-open the bell — the existing `low_stock` row still renders, with the row marked "(item no longer available)" rather than crashing.

Acceptance:
- [ ] The post-order check fires a `low_stock` notification within seconds.
- [ ] The cron run fires an `expiry` notification within seconds.
- [ ] Repeating either trigger inside 24h does not duplicate.
- [ ] Click-through navigates to `/inventory/:id`.
- [ ] Deleted ingredient still renders the historical notification gracefully.

---

## §3 — User Story 3: auto-reorder suggestion

**Goal**: confirm the reorder gate fires only when there is enough usage history and the suggested quantity matches the formula.

Pre-step: pick an ingredient that has at least 14 days of order history and is currently above `minStock`. (Use the seed script or place enough orders over the past two weeks to satisfy the gate.)

Steps:
1. Place enough orders to drop the ingredient below `minStock`.
2. Within ~5 seconds the admin bell should show **two** new rows for that ingredient: a `low_stock` and a `reorder`.
3. Click the `reorder` row. The URL navigates to `/inventory/:id`. The notification's payload (visible by inspecting the network response or in the dropdown body) contains a `suggestedQuantity` equal to `ceil(avgDailyUsage × (3 + 2)) − currentQuantity`, rounded up.
4. Force the gate to fail by repeating the test on a freshly-created ingredient with no history. After dropping it below `minStock`, only the `low_stock` row appears — no `reorder`.
5. Override env vars to `REORDER_LEAD_TIME_DAYS=7`, `REORDER_SAFETY_DAYS=3` and restart the server. Re-trigger the condition (after 24h dedup window OR by deleting the existing notification). Confirm the new suggestion uses 7 + 3.

Acceptance:
- [ ] `reorder` notification fires only when the ingredient has ≥ 14 days of history.
- [ ] `suggestedQuantity` matches the formula and respects the configured lead + safety days.
- [ ] Both notifications appear independently and can be marked read independently.

---

## §4 — User Story 4: daily spoilage cron with recipe attachment

**Goal**: confirm the cron produces a single `spoilage_risk` per day, attaches a recipe when the AI service is up, and falls back gracefully when it is down.

Pre-step: ensure at least one ingredient has `expiryDate` within 3 days. The ML service should be running.

Steps:
1. Force the cron:
   ```bash
   node Server/src/infrastructure/cron/spoilage.cron.js --once
   ```
2. The bell (admin or staff, depending on `targetRole`) shows a `spoilage_risk` row. Open it; the dropdown body (or the network response) shows a `payload.recipe` with `name`, `ingredients[]`, and `steps[]`.
3. Stop the ML service (or set `ML_SERVICE_URL` to an unreachable host).
4. Force the cron a second day later (or temporarily wipe the existing `spoilage_risk` document so dedup doesn't suppress).
5. The bell now shows two rows: a `spoilage_risk` (with `payload.recipe` absent) AND a `spoilage_recipe_failed` (with `lastError` populated).
6. Confirm: at no point does the bell show a fabricated recipe with placeholder text.

Acceptance:
- [ ] Cron emits exactly one `spoilage_risk` per run (when at least one near-expiry ingredient exists).
- [ ] Recipe attachment present on success, absent on AI failure.
- [ ] `spoilage_recipe_failed` is created exactly when the AI service is unavailable.
- [ ] No fabricated recipe ever surfaces.

---

## §5 — User Story 5: 30-day prune

**Goal**: confirm read notifications older than 30 days are deleted, unread ones are not.

Pre-step: seed two notifications via direct DB write:
```js
// In `mongosh` against the project DB
db.notifications.insertMany([
  { type: 'system', title: 'old read', message: '...', targetRole: 'admin',
    readByAdmin: true,  readByAdminAt: new Date(Date.now() - 31*86400000),
    readByStaff: true,  readByStaffAt: new Date(Date.now() - 31*86400000),
    payload: {}, createdAt: new Date(Date.now() - 31*86400000), lastSeenAt: new Date(Date.now() - 31*86400000) },
  { type: 'system', title: 'old unread', message: '...', targetRole: 'admin',
    readByAdmin: false, readByStaff: false,
    payload: {}, createdAt: new Date(Date.now() - 31*86400000), lastSeenAt: new Date(Date.now() - 31*86400000) }
]);
```

Steps:
1. Force the cron once. The orchestrator runs steps 1–3 in order.
2. Re-query the collection:
   ```js
   db.notifications.find({ title: /^old/ }).toArray()
   ```
3. Confirm `'old read'` is gone and `'old unread'` is still present.

Acceptance:
- [ ] Read-by-both-roles notifications older than 30d are deleted.
- [ ] Unread notifications older than 30d are preserved.

---

## §6 — Cross-cutting checks

These mirror the spec's success criteria and should pass after the per-story sections all do.

- [ ] **SC-001**: A grep of `Server/src/application/services/notification.service.js` shows no `logger.info` / `console.log` calls used as the sole delivery channel for stock, expiry, or reorder events.
- [ ] **SC-004**: With a customer-role token, every notification endpoint returns 403 — verify with `curl -H "Authorization: Bearer <customer-token>" http://localhost:8080/api/notifications` etc.
- [ ] **SC-008a**: Create a `targetRole: 'all'` notification. Sign in as admin, mark it read. Sign in as staff — the same notification still renders unread and counts in the badge.
- [ ] **SC-009**: Time a representative order with the post-order check enabled vs disabled (toggle by commenting out the `runPostOrderInventoryChecks` call). The completion latency delta should be within ±50 ms.
- [ ] **SC-010**: Walk every page of the application as admin and as staff (dashboard, ordering, inventory, report). The bell appears on every page that uses the navbar; it never appears as a customer.

---

## Pass criteria

The feature is acceptance-ready when every checkbox above is checked off in a single contiguous run on a fresh DB. Any deviation is a defect to file before declaring the feature done.
