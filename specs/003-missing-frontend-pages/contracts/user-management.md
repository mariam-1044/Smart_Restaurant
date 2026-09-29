# Contract: User & Staff Management Page (`/admin/users`)

**Spec mapping**: User Story 4, FR-016 through FR-020, FR-035.
**Access**: `admin` only.

## Page → API calls

| Trigger | Method | Path | Request body | Response shape | Failure modes |
|---|---|---|---|---|---|
| Page mount / filter change | `GET` | `/api/auth/users` | — | `User[]` | Standard |
| Optional query filter | `GET` | `/api/auth/users?status=pending` | — | `User[]` filtered by status | Standard |
| Approve pending | `PATCH` | `/api/auth/users/:id/status` | `{ status: 'active', __version }` | updated `User` | 409 → "record changed" toast + refetch; 5xx → toast |
| Reject pending | `PATCH` | `/api/auth/users/:id/status` | `{ status: 'inactive', __version }` | updated `User` | Same |
| Change role | `PATCH` | `/api/auth/users/:id` | `{ role, __version }` | updated `User` | Same — **NEW endpoint** (or extend existing PATCH if present) |
| Deactivate | `PATCH` | `/api/auth/users/:id/status` | `{ status: 'inactive', __version }` | updated `User` | Same |

**Backend gap**: `GET /api/auth/users` does not currently exist (auth.routes.js only has `GET /me`, `PATCH /update-profile`, `PATCH /update-password`, `PATCH /users/:id/status`). Adding this is a prerequisite for Page 2.

**Backend gap**: There is no current endpoint to change a user's `role`. Either extend `PATCH /api/auth/users/:id/status` to also accept `role`, or add `PATCH /api/auth/users/:id` for general user updates. Recommendation: a single `PATCH /api/auth/users/:id` that accepts any of `{ status, role, __version }`.

## State machine

```
'loading' → on mount
'error'   → if list fetch fails
'empty'   → if list fetch succeeds but no users match the active filter
'ready'   → otherwise
```

## Filter pills

`['All', 'Pending', 'Active', 'Inactive']` — single-select; default `'All'`. The filter is a frontend concern (the backend can return all users; frontend filters by `user.status`). If the user list grows large enough to warrant server-side filtering, switch to `?status=` query without changing the page state machine.

## Acceptance contract

- **AS4.1** (every user shown with badge) → table renders one row per user with `StatusBadge` color-coded per status.
- **AS4.2** (filter pending) → only `status === 'pending'` users shown; approve/reject controls visible only on those rows.
- **AS4.3** (approve flow) → after `PATCH`, refetch the list; the approved user moves to the Active filter.
- **AS4.4** (role change) → after `PATCH`, the row's role badge updates to the new role.
- **AS4.5** (non-admin denied) → `<ProtectedRoute roles={['admin']}>` redirects before page mounts.
