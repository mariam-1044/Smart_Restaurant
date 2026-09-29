# Contract: Post-order Inventory Check & Auto-Reorder Trigger

**Feature**: 004-real-notification-system
**Surface**: `Server/src/application/services/inventory.service.js` (new function `runPostOrderInventoryChecks`), called from `Server/src/application/services/order.service.js` after the existing ingredient-deduction step.

---

## Trigger point

In `order.service.js`, after the order has been persisted AND ingredient quantities have been deducted (the existing `deductIngredients(order)` call):

```js
// Existing flow:
const savedOrder = await Order.create(orderData);
await deductIngredients(savedOrder);

// New side-effect, FR-015 / FR-018:
try {
  await inventoryService.runPostOrderInventoryChecks(savedOrder);
} catch (err) {
  logger.warn(`post-order inventory check failed: ${err.message}`);
  // intentionally swallowed — order completion is the source of truth
}
```

Order completion is the source of truth. A failure inside the check MUST log and continue. Order acceptance MUST NOT be rolled back because a notification could not be written.

---

## `runPostOrderInventoryChecks(order)` algorithm

1. Build `consumedIngredientIds` — the unique set of ingredient ids referenced by every dish in `order.items`. Use the existing dish→ingredient links populated during deduction; a fresh `Dish.find({ _id: { $in: dishIds } }).populate('ingredients.ingredient')` is acceptable when the deduction code didn't keep the resolved set in scope.
2. Load all consumed ingredients in one query: `Ingredient.find({ _id: { $in: consumedIngredientIds } }).lean()`.
3. For each ingredient `ing`:
   - **Low stock check (FR-015)**: if `ing.quantity <= ing.minStock`, call `notification.service.createAlert({ type: 'low_stock', relatedEntity: ing._id, entityModel: 'Ingredient', targetRole: 'admin', title, message, payload })`. Dedup is enforced by the service; a single notification per ingredient per 24h.
   - **Reorder check (FR-016)**: if low-stock fired AND the ingredient passes the reorder gate (see below), call `createAlert({ type: 'reorder', ... })` with the suggested quantity in the payload.

The two notifications are independent — the bell shows them as separate rows.

---

## Reorder gate (FR-016)

Compute, for each below-`minStock` ingredient:

```js
const trailingDays = 30;
const lookback = new Date(Date.now() - trailingDays * 86_400_000);

// Sum quantity_in_dish * order_line.quantity over the last 30 days, completed orders only.
const usage = await Order.aggregate([
  { $match: { status: 'completed', createdAt: { $gte: lookback } } },
  { $unwind: '$items' },
  // Lookup each item's dish to find ingredient links
  { $lookup: { from: 'dishes', localField: 'items.dish', foreignField: '_id', as: 'd' } },
  { $unwind: '$d' },
  { $unwind: '$d.ingredients' },
  { $match: { 'd.ingredients.ingredient': ingredientId } },
  { $group: {
      _id: { day: { $dateTrunc: { date: '$createdAt', unit: 'day' } } },
      qty: { $sum: { $multiply: ['$d.ingredients.quantity', '$items.quantity'] } }
  } }
]);

const daysWithData = usage.length;
const totalUsage   = usage.reduce((s, r) => s + r.qty, 0);
const avgDailyUsage = totalUsage / 30;
```

Then:
- If `daysWithData < 14` → **skip** the reorder notification (insufficient history; the average is unreliable). Only the plain `low_stock` fires.
- `daysUntilDepletion = avgDailyUsage > 0 ? ing.quantity / avgDailyUsage : Infinity`
- If `daysUntilDepletion < leadTimeDays` → fire the `reorder` notification.
- `suggestedQuantity = Math.ceil(avgDailyUsage * (leadTimeDays + safetyDays)) - ing.quantity`, then `Math.ceil(suggestedQuantity)` to whole units. If negative, clamp to `0` and skip (means we already have more than the safety buffer would target — should not normally fire if `quantity <= minStock`, but defensive).

`leadTimeDays` and `safetyDays` come from environment variables:

```js
const leadTimeDays = Number(process.env.REORDER_LEAD_TIME_DAYS ?? 3);
const safetyDays   = Number(process.env.REORDER_SAFETY_DAYS    ?? 2);
```

Both MUST be parsed at process start and cached; do not re-read `process.env` on every order completion.

---

## Notification shapes

### `low_stock`
```js
{
  type: 'low_stock',
  title: `${ing.name} is below minimum stock`,
  message: `${ing.quantity} ${ing.unit} remaining (min: ${ing.minStock} ${ing.unit}).`,
  targetRole: 'admin',
  relatedEntity: ing._id,
  entityModel: 'Ingredient',
  payload: {
    ingredientName: ing.name,
    currentQuantity: ing.quantity,
    minStock: ing.minStock,
    unit: ing.unit
  }
}
```

### `reorder`
```js
{
  type: 'reorder',
  title: `Reorder ${ing.name}`,
  message: `Suggested: order ${suggestedQuantity} ${ing.unit} (covers ${leadTimeDays}d lead + ${safetyDays}d safety).`,
  targetRole: 'admin',
  relatedEntity: ing._id,
  entityModel: 'Ingredient',
  payload: {
    ingredientName: ing.name,
    currentQuantity: ing.quantity,
    minStock: ing.minStock,
    avgDailyUsage,
    daysUntilDepletion,
    leadTimeDays,
    safetyDays,
    suggestedQuantity,
    unit: ing.unit
  }
}
```

---

## Dedup interaction

Dedup is centralized in `notification.service.createAlert`; this trigger does NOT implement its own dedup. The service's check is `(type, relatedEntity)` within 24h, so:

- A second order completing while the same ingredient is still below `minStock` → no new `low_stock` document; existing one's `lastSeenAt` is bumped.
- The same applies to `reorder` — the suggested quantity in the existing record is **not** updated even if the calculation has changed slightly. This is intentional: the suggestion in the bell is a snapshot at first detection, not a moving target. If the admin wants a fresh suggestion, they read the existing one (which moves it to read state) and the next condition recurrence after 24h produces a fresh document.

---

## Failure modes

| Failure | Behavior |
|---|---|
| `notification.service.createAlert` throws | Logged via `logger.warn`. The check loop continues to the next ingredient. The order is unaffected. |
| The aggregation pipeline times out | The reorder gate falls back to "no reorder notification" (the safer choice — admin sees only the plain `low_stock`). |
| `consumedIngredientIds` is empty (e.g., the order had no items somehow) | The check returns immediately. Not an error. |
| MongoDB connection lost mid-check | The order is already persisted (occurred earlier in the request). The check throws; the wrapping `try/catch` in `order.service.js` swallows. The next order to consume any of the same ingredients re-evaluates them. |

---

## Non-goals

- This trigger does NOT emit `expiry` notifications. Those are produced exclusively by the daily cron (see `spoilage-cron.md`) — keeping the trigger surfaces single-purpose.
- This trigger does NOT respect a "do not disturb" mode or rate-limiting beyond the 24h dedup. If genuinely needed in the future, the place to add it is `notification.service.createAlert`.
- This trigger does NOT call out to any external service. It only reads from the local DB.
