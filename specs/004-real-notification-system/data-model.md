# Data Model: Real Notification System

**Feature**: 004-real-notification-system
**Date**: 2026-04-30

This document is the single source of truth for the `Notification` document shape, its indexes, and the field-level invariants that the implementing model must honor. Do not deviate.

---

## Notification

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | yes | Mongo-assigned. |
| `type` | String enum | yes | One of `low_stock`, `expiry`, `reorder`, `spoilage_risk`, `spoilage_recipe_failed`, `system`. |
| `title` | String | yes | Short, role-readable header. Max 120 chars. |
| `message` | String | yes | One-line body. Max 500 chars. |
| `targetRole` | String enum | yes | One of `admin`, `staff`, `all`. Default `admin`. Drives both visibility (the listing query filters by role) and which read flag is meaningful. |
| `relatedEntity` | ObjectId | no | Reference to the entity the alert is about. Required when `type ∈ {low_stock, expiry, reorder}`. Optional for `spoilage_risk` (can point at the first ingredient in the batch, or be absent). Absent for `system` and `spoilage_recipe_failed`. |
| `entityModel` | String enum | no | Discriminator for `relatedEntity`. One of `Ingredient`, `Dish`, `Order`. Required iff `relatedEntity` is set. |
| `payload` | Object | no | Free-form, type-specific structured data. See **Payload shapes by type** below. Capped at 16 KB serialized to keep documents small. |
| `readByAdmin` | Boolean | yes | Default `false`. Admin's read state. |
| `readByAdminAt` | Date | no | Set when `readByAdmin` flips to `true`. Cleared (set to `null`) is **never** allowed — read is a one-way flip per role. |
| `readByStaff` | Boolean | yes | Default `false`. Staff's read state. |
| `readByStaffAt` | Date | no | Set when `readByStaff` flips to `true`. |
| `createdAt` | Date | yes | Default `Date.now`. Immutable after creation. Used as the cursor for pagination. |
| `lastSeenAt` | Date | yes | Default `Date.now`. Updated on every dedup hit. Never less than `createdAt`. |

### Field-level invariants

- A notification with `targetRole: 'admin'` MUST be considered visible to admins only; the staff read flag is meaningless on it but is still stored as `false` for shape uniformity.
- A notification with `targetRole: 'all'` is visible to both roles; the unread-count and listing endpoints MUST filter by the calling user's role flag (`!readByAdmin` for admins, `!readByStaff` for staff).
- `relatedEntity` and `entityModel` MUST be set together or both unset. The validation layer rejects the half-set case.
- `readByAdminAt` MUST be set iff `readByAdmin === true`. Same for staff.
- `lastSeenAt >= createdAt` always.
- `payload` MAY be `{}` but MUST NOT be `null`.

### Payload shapes by type

```jsonc
// type: 'low_stock'
{
  ingredientName: 'Tomato',
  currentQuantity: 1.2,
  minStock: 5.0,
  unit: 'kg'
}

// type: 'expiry'
{
  ingredientName: 'Mozzarella',
  expiryDate: '2026-05-02T00:00:00.000Z',
  daysUntilExpiry: 2,        // negative when already expired
  unit: 'kg',
  remainingQuantity: 0.8
}

// type: 'reorder'
{
  ingredientName: 'Olive Oil',
  currentQuantity: 0.6,
  minStock: 2.0,
  avgDailyUsage: 0.4,
  daysUntilDepletion: 1.5,
  leadTimeDays: 3,
  safetyDays: 2,
  suggestedQuantity: 2,       // ceil(0.4 * (3+2)) − 0.6 = 1.4 → ceil → 2 (in `unit`)
  unit: 'l'
}

// type: 'spoilage_risk'
{
  ingredients: [{ ingredientId: '<oid>', name: 'Mozzarella', daysUntilExpiry: 2 }, ...],
  recipe: {                   // OPTIONAL; absent when AI service was unavailable
    name: 'Caprese Bake',
    description: '...',
    ingredients: [{ name, quantity, unit }, ...],
    steps: ['Preheat oven...', '...']
  },
  correlationId: '<uuid>'      // mirrors the cron's audit log
}

// type: 'spoilage_recipe_failed'
{
  ingredients: ['Mozzarella', 'Basil'],
  attempts: 4,
  lastError: 'upstream_provider_failed',
  correlationId: '<uuid>'
}

// type: 'system'
{
  // Free-form. Used sparingly for events that fit no other type.
}
```

The implementing model SHOULD validate `payload` against the type at write time (Joi `Joi.object().when('type', { is: 'reorder', then: <reorderPayloadSchema> })`); read-time the payload is rendered defensively (`?.` everywhere) because old documents from the partial-model era may not match.

---

## Indexes

The implementing model MUST create these indexes on the `notifications` collection. They are required to keep the listing, unread-count, dedup, and prune paths off a collection scan.

| Index | Fields | Purpose |
|---|---|---|
| `idx_role_created` | `{ targetRole: 1, createdAt: -1 }` | Listing queries (`GET /api/notifications`) and unread-count queries filter by role and sort newest-first. |
| `idx_role_admin_unread` | `{ targetRole: 1, readByAdmin: 1, createdAt: -1 }` | Unread-count for admin role; partial filter `readByAdmin = false`. |
| `idx_role_staff_unread` | `{ targetRole: 1, readByStaff: 1, createdAt: -1 }` | Unread-count for staff role; partial filter `readByStaff = false`. |
| `idx_dedup` | `{ type: 1, relatedEntity: 1, createdAt: -1 }` | Dedup existence query (`createAlert` checks for any existing record in the last 24h). |
| `idx_prune` | `{ readByAdmin: 1, readByStaff: 1, readByAdminAt: 1, readByStaffAt: 1 }` | Daily prune query: notifications where both flags are `true` and the **later** of the two read timestamps is older than 30 days. |

Mongo cannot directly index "the later of two dates"; the prune query handles this in two steps (a candidate scan against `idx_prune` for `readByAdmin && readByStaff`, then an in-memory filter on `Math.max(readByAdminAt, readByStaffAt) < cutoff`). At graduation scale (hundreds of read notifications) this is well under the 30-second prune budget.

---

## State diagram (per notification)

```text
            createAlert
                │
                ▼
         (created, both
          flags false)
            │       │
admin reads │       │ staff reads
            ▼       ▼
   (readByAdmin   (readByStaff
     true)         true)
            │       │
staff reads │       │ admin reads
            ▼       ▼
       (both flags true,
        candidate for prune
        when latest readAt
        > 30d old)
                │
                ▼
            (deleted)
```

Notifications never transition back to "unread"; the only mutating endpoints flip `false → true` for the calling user's role.

The dedup path does NOT mutate any read flag; it only updates `lastSeenAt` on the existing record.

---

## Indexes the implementing model MUST NOT add

- `unique` on `(type, relatedEntity)` — would block legitimate re-creation outside the 24h window.
- `unique` on `(type, relatedEntity, dayBucket)` — fragile and hard to maintain across daylight-saving boundaries.
- TTL index on `createdAt` — would auto-delete unread notifications, violating FR-022.

---

## Field-rename / migration notes

The currently-deployed partial model (used by `spoilage.cron.js` since feature 003 development) has:
- `read: Boolean, default: false`
- `readAt: Date, default: null`
- narrower `type` enum

The one-shot migration documented in research.md Decision 7 transforms each in-flight document as:
```js
{
  readByAdmin: doc.read === true,
  readByAdminAt: doc.read === true ? doc.readAt : null,
  readByStaff:  doc.read === true,
  readByStaffAt:  doc.read === true ? doc.readAt : null,
  lastSeenAt: doc.lastSeenAt ?? doc.createdAt
}
```
After the migration runs, the new model's required fields all have valid defaults and the listing/unread-count queries return correct results.
