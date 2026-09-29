# Contract: Notification REST API

**Feature**: 004-real-notification-system
**Surface**: `Server/src/routes/notification.routes.js` mounted at `/api/notifications` from `Server/src/index.js`.

All endpoints sit behind `protect` then `restrictTo('admin', 'staff')`. Customer-role tokens MUST receive HTTP 403 from every endpoint.

The success envelope is the project's existing convention: `{ success: true, data: ... }`. The failure envelope is `{ success: false, message: string, errorType?: string }` matching the rest of the codebase.

---

## `GET /api/notifications`

List the calling user's role-targeted notifications, newest first.

**Query parameters**:
- `before` (optional, ISO 8601 datetime) — return notifications strictly older than this `createdAt`. Used for cursor pagination. Default: now.
- `limit` (optional, integer 1..50) — page size. Default: 20. Values > 50 are clamped to 50.

**Filter logic** (computed on the server):
- `targetRole === <callerRole> OR targetRole === 'all'`
- `createdAt < before`
- ordered by `createdAt` descending
- limited to `limit + 1` rows internally so the server can compute `nextCursor` without a second query

**Response — 200**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "_id": "...",
        "type": "low_stock",
        "title": "Tomato is below minimum stock",
        "message": "1.2 kg remaining (min: 5.0 kg).",
        "targetRole": "admin",
        "relatedEntity": "<ingredient _id>",
        "entityModel": "Ingredient",
        "payload": { "...": "..." },
        "read": false,
        "readAt": null,
        "createdAt": "2026-04-30T08:13:42.123Z",
        "lastSeenAt": "2026-04-30T08:13:42.123Z"
      }
    ],
    "nextCursor": "2026-04-30T08:11:01.000Z"
  }
}
```

The `read` and `readAt` fields in the JSON are the **caller-role-projected** flags — for an admin caller they reflect `readByAdmin` / `readByAdminAt`; for a staff caller, `readByStaff` / `readByStaffAt`. The raw per-role flags are NOT returned. This keeps the client code simple (no role branching on the client) and matches the per-role read semantics.

`nextCursor` is `null` when fewer than `limit + 1` rows match (i.e., the page is the last one).

**Errors**:
- 400 `validation_failed` — `before` is not parseable as ISO 8601, or `limit` is non-numeric.

---

## `GET /api/notifications/unread-count`

Return the count of notifications the caller's role has not yet marked read.

**Filter logic**:
- `targetRole === <callerRole> OR targetRole === 'all'`
- `readBy<CallerRole> === false`

**Response — 200**:
```json
{ "success": true, "data": { "count": 7 } }
```

This is the only endpoint the bell polls every 30s; it MUST be cheap. The implementing model uses `idx_role_admin_unread` / `idx_role_staff_unread` and runs a `countDocuments` (no full document fetch).

---

## `PATCH /api/notifications/:id/read`

Mark a single notification read for the calling user's role.

**Authorization**:
- Caller's role MUST equal the notification's `targetRole`, OR the notification's `targetRole` MUST be `'all'`. Otherwise 403.

**Idempotency**:
- If `readBy<CallerRole>` is already `true`, return 200 with the existing `readBy<CallerRole>At` (no second timestamp flip). The client's "mark all read then click another" sequence MUST NOT produce different results from a single click.

**Response — 200**:
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "read": true,
    "readAt": "2026-04-30T08:14:09.451Z"
  }
}
```

**Errors**:
- 403 `cross_role_forbidden` — caller's role does not match the notification's target.
- 404 `notification_not_found` — `:id` does not resolve.

---

## `PATCH /api/notifications/read-all`

Mark every notification visible to the calling user's role as read for that role only.

**Filter** (server-side):
- `targetRole === <callerRole> OR targetRole === 'all'`
- `readBy<CallerRole> === false`

**Mutation** (single bulk update):
- `$set: { readBy<CallerRole>: true, readBy<CallerRole>At: <now> }`

**Response — 200**:
```json
{ "success": true, "data": { "modifiedCount": 7 } }
```

`modifiedCount: 0` is a valid, non-error response (idempotent no-op).

**Errors**: None other than the standard auth failures.

---

## Authentication failures (apply to every endpoint)

| Status | `errorType` | Cause |
|---|---|---|
| 401 | `TOKEN_EXPIRED` / `INVALID_TOKEN` / `SESSION_EXPIRED` / `USER_NOT_FOUND` | Standard `protect` failure. The existing `axios.js` response interceptor handles these by clearing `localStorage` and redirecting to `/`. |
| 403 | `cross_role_forbidden` | Customer-role token, or admin-role token operating on a staff-only notification (or vice versa). |

---

## Validation schemas

```js
// Server/src/application/validations/notification.validation.js
const Joi = require('joi');

const listSchema = Joi.object({
  before: Joi.date().iso().optional(),
  limit:  Joi.number().integer().min(1).max(50).default(20)
});

const idParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required()
});

module.exports = { listSchema, idParamSchema };
```

The `validate` middleware already in the codebase wraps these for the `req.query` and `req.params` cases respectively.

---

## Route registration

```js
// Server/src/routes/notification.routes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { listSchema, idParamSchema } = require('../application/validations/notification.validation');
const ctrl = require('../interfaces/controllers/notification.controller');

router.use(protect);
router.use(restrictTo('admin', 'staff'));

router.get('/',                             validate(listSchema, 'query'),    ctrl.list);
router.get('/unread-count',                                                   ctrl.unreadCount);
router.patch('/read-all',                                                     ctrl.markAllRead);  // MUST come before `/:id/read`
router.patch('/:id/read',                   validate(idParamSchema, 'params'),ctrl.markRead);

module.exports = router;
```

Route ordering matters: `/read-all` must be registered before `/:id/read` so Express does not match `read-all` as `:id = "read-all"`.

In `Server/src/index.js`:
```js
app.use('/api/notifications', require('./routes/notification.routes'));
```
