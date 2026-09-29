# Contract: Daily Spoilage / Expiry / Prune Cron

**Feature**: 004-real-notification-system
**Surface**: `Server/src/infrastructure/cron/spoilage.cron.js` — **extends** the existing implementation.

The current file already runs at `0 6 * * *`, scans for `expiryDate <= now + 3d`, retries the AI recipe call up to 4 times within a 15-second budget, and writes either a `spoilage_risk` (with recipe) or a `spoilage_recipe_failed` notification. This feature extends that file in three places: (1) timezone resolution, (2) per-ingredient `expiry` notifications alongside the aggregate `spoilage_risk`, and (3) the daily 30-day prune.

---

## Schedule

```js
const cron = require('node-cron');

cron.schedule('0 6 * * *', () => {
  runDailyJob().catch(err => logger.error(`spoilage.cron crashed: ${err.message}`));
}, {
  timezone: process.env.CRON_TIMEZONE || 'UTC'
});
```

The `timezone` option is the only new line required for FR-019. Reading `process.env` at scheduling time is fine — the schedule is configured once at boot.

---

## `runDailyJob()` orchestration

```js
async function runDailyJob() {
  // Step 1: existing spoilage_risk path. The existing function does this end-to-end.
  await runSpoilageCheck();

  // Step 2: NEW — emit per-ingredient expiry notifications.
  await emitExpiryNotifications();

  // Step 3: NEW — prune fully-read notifications older than 30d.
  await runDailyPrune();
}
```

A failure in any step MUST log and proceed. The next day's run gets another chance; we do not want a `expiry` failure to suppress the prune step or vice versa.

---

## Step 2: per-ingredient `expiry` notifications (FR-019a)

The ingredient list from step 1 (`nearExpiry` = ingredients with `expiryDate <= now + 3d`) is reused to avoid double-querying. For each `ing` in that list:

```js
await notificationService.createAlert({
  type: 'expiry',
  title: `${ing.name} ${daysUntilExpiry <= 0 ? 'has expired' : `expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`}`,
  message: `${ing.quantity ?? 0} ${ing.unit} remaining; expiry ${ing.expiryDate.toISOString().slice(0, 10)}.`,
  targetRole: 'admin',
  relatedEntity: ing._id,
  entityModel: 'Ingredient',
  payload: {
    ingredientName: ing.name,
    expiryDate: ing.expiryDate,
    daysUntilExpiry,
    unit: ing.unit,
    remainingQuantity: ing.quantity ?? 0
  }
});
```

`daysUntilExpiry` is `Math.ceil((ing.expiryDate − now) / 86_400_000)`. Negative for already-expired ingredients.

Dedup is enforced by `createAlert` (`(type='expiry', relatedEntity=ing._id)` within 24h), so re-running the cron the same day produces no duplicates. Re-running with a **fresh** ingredient (one that became near-expiry only today) does emit a new notification.

---

## Step 3: 30-day prune (FR-022)

```js
async function runDailyPrune() {
  const cutoff = new Date(Date.now() - 30 * 86_400_000);

  // Candidate scan: notifications where both flags are true.
  // We must apply the "later of two timestamps" filter in JS because Mongo
  // can't index `max(readByAdminAt, readByStaffAt)` directly.
  const candidates = await Notification.find({
    readByAdmin: true,
    readByStaff: true
  }).select('_id readByAdminAt readByStaffAt').lean();

  const toDelete = candidates
    .filter(n => {
      const latestRead = Math.max(
        n.readByAdminAt ? new Date(n.readByAdminAt).getTime() : 0,
        n.readByStaffAt ? new Date(n.readByStaffAt).getTime() : 0
      );
      return latestRead > 0 && latestRead < cutoff.getTime();
    })
    .map(n => n._id);

  if (toDelete.length === 0) return { deleted: 0 };

  // Batch the delete — never more than 1000 ids per call.
  const BATCH = 1000;
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += BATCH) {
    const slice = toDelete.slice(i, i + BATCH);
    const r = await Notification.deleteMany({ _id: { $in: slice } });
    deleted += r.deletedCount;
  }
  return { deleted };
}
```

Notes:
- A `targetRole: 'admin'` notification with `readByAdmin: true` and `readByStaff: false` is NOT fully read (the staff flag is irrelevant for an admin-only notification, but the candidate filter doesn't know that). To keep the rule simple and consistent, the cron only prunes notifications where **both** flags are true regardless of `targetRole`. Single-role notifications "stick" because their other flag never flips. **This is intentional** — it means single-role notifications stay as a record indefinitely once read; if that becomes a problem, a future iteration can add a `prunable: true` projection. For graduation scope this is acceptable.

  *(Alternative considered: prune logic that respects `targetRole` semantically — "prune if every relevant role has marked read." Rejected for now to keep the rule trivially auditable. Documented here so the future maintainer knows.)*

- The query uses `idx_prune` for the candidate scan; the in-memory filter is over hundreds of rows at most, well under the 30-second cron budget.

---

## Failure modes

| Failure | Behavior |
|---|---|
| Step 1 (`runSpoilageCheck`) throws | Existing behavior preserved: a `spoilage_recipe_failed` notification is written by the existing implementation. The orchestrator continues to step 2. |
| Step 2 throws on a single ingredient | Logged; loop continues to the next ingredient. Other ingredients' notifications are unaffected. |
| Step 3's candidate scan times out | Logged; the cron skips prune for the day. Tomorrow tries again. |
| Step 3's batch delete fails partway | Already-deleted batches stay deleted; the failure is logged. The next day's run picks up the rest naturally. |

---

## Manual run

The existing `--once` mode works unchanged:

```bash
node Server/src/infrastructure/cron/spoilage.cron.js --once
```

The orchestrator hooks into the same entry point so a manual run also executes step 2 and step 3.

---

## Configuration summary

| Env var | Default | Used in |
|---|---|---|
| `CRON_TIMEZONE` | `UTC` | The `cron.schedule(..., { timezone })` option. |
| (none for window) | hardcoded 3-day expiry horizon, hardcoded 30-day prune cutoff | Step 2 / Step 3. Promoting these to env vars is a P5 enhancement. |

---

## Non-goals

- The cron does NOT emit `low_stock` or `reorder` notifications — those live exclusively on the post-order trigger (see `auto-reorder-trigger.md`). Splitting low-stock detection across two surfaces would create dedup conflicts.
- The cron does NOT batch-deduplicate `expiry` notifications across multiple consecutive runs at the **collection** level — `createAlert`'s 24h dedup handles it correctly per-ingredient.
- The cron does NOT email or SMS anyone. Email fan-out remains a P5 enhancement (the `SMTP_*` envs in the master plan are reserved for it).
