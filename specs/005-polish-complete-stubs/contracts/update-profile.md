# Contract: PATCH /api/auth/update-profile

**Feature**: 005-polish-complete-stubs
**Status**: Existing endpoint (introduced in feature 002). This feature does **not** modify the route or the controller; it tightens the **client-side payload contract** so the form submits only the editable field set.

## Route

```
PATCH /api/auth/update-profile
```

## Auth

- Requires a valid JWT in the `Authorization: Bearer <token>` header.
- The existing `axios` interceptor handles 401 redirect-to-login.

## Request body (frontend → backend)

The Settings profile form sends only the editable subset (per Q2 clarification, 2026-05-03):

```json
{
  "name": "string (optional)",
  "phone": "string (optional)",
  "avatar": "string (optional, URL)"
}
```

**Fields the form MUST NOT submit**:

| Field | Reason |
|-------|--------|
| `email` | Not editable in this iteration; uniqueness collision and re-verification flow are P5 scope. |
| `address` | Field does not exist on the `User` schema; submitting it was a pre-existing bug. |
| `password` | Changed via the separate `PATCH /api/auth/update-password` flow only. |
| `role`, `status` | Admin-only, managed via the user-management page from feature 003. |
| `tokenVersion` | Server-managed; incremented on password change. |

The backend's existing handler accepts a partial payload; any field not on the editable allowlist is silently dropped by Mongoose schema validation. Sending one of the forbidden fields above does not cause a 4xx but is forbidden on the **client side** by this contract.

## Successful response (200)

```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "string",
      "name": "string",
      "email": "string",
      "phone": "string|null",
      "avatar": "string|null",
      "role": "admin|staff|customer",
      "status": "approved|pending|rejected|inactive",
      "createdAt": "ISO 8601 string",
      "updatedAt": "ISO 8601 string"
    }
  }
}
```

The `password` field is never returned (the schema marks it `select: false`).

**Frontend behavior on 200** (FR-013, FR-014):
1. Call `useToast().success("Profile updated")` (or the controller's returned message).
2. Call `setUser(response.data.data.user)` to merge the payload into `AuthContext`.
3. Components consuming `useAuth().user` (notably `Navbar.jsx`'s name display) re-render within one frame, no page reload (SC-006).

## Error responses

| Status | Shape | Frontend behavior |
|--------|-------|-------------------|
| 400 (validation) | `{ success: false, message: "..." }` | `useToast().error(response.data.message)`. No `setUser` call. |
| 401 (expired token) | (handled by `axios` interceptor → redirect to login) | No-op at the form level. |
| 5xx | `{ success: false, message: "..." }` | `useToast().error("Could not save profile")` or the server's message. |

## Implementation notes

- The handler at `Server/src/interfaces/controllers/auth.controller.js` already returns the updated user in `data.user`. The Settings form merges this directly — there is **no** second round-trip to `/auth/me` (per the Q3 clarification on 2026-04-30).
- No backend code change is required by this contract. The change is purely on the frontend form payload.
