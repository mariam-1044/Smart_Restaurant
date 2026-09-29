# Contract: PATCH /api/auth/update-password

**Feature**: 005-polish-complete-stubs
**Status**: Existing endpoint (introduced in feature 002). This feature does **not** modify the route, the controller, or the password policy. It replaces the client-side `window.prompt()` collection with an embedded three-field form.

## Route

```
PATCH /api/auth/update-password
```

## Auth

- Requires a valid JWT in the `Authorization: Bearer <token>` header.
- The existing `axios` interceptor handles 401 redirect-to-login.

## Request body (frontend → backend)

```json
{
  "currentPassword": "string (required, non-empty)",
  "newPassword": "string (required, must satisfy policy)"
}
```

**`confirmNewPassword` is a client-side gate only and is NOT sent.** The frontend rejects submission when `newPassword !== confirmNewPassword` without making an API call.

## Server-side password policy

The backend validates `newPassword` against the existing policy (introduced in feature 002):

| Code | Constraint |
|-------|------------|
| `min_length` | Minimum 8 characters |
| `missing_letter` | Must contain at least one alphabetic character |
| `missing_digit` | Must contain at least one digit |
| `same_as_current` | Must differ from `currentPassword` |

Multiple violations may be returned together in `message`.

## Successful response (200)

```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

**Server-side side effect**: `User.tokenVersion` is incremented. The currently-issued token continues to validate (because it was signed with the prior `tokenVersion`, and the existing JWT verify middleware accepts tokens whose `tokenVersion` claim matches the user's at issuance time — verify in `auth.middleware.js`). The user is **not** forced to re-log-in (per the Q4 clarification on 2026-04-30).

**Frontend behavior on 200** (FR-015):
1. Call `useToast().success(response.data.message || "Password changed")`.
2. Clear all three fields (`currentPassword`, `newPassword`, `confirmNewPassword`).
3. Leave the existing session active. The next API call (e.g., navigating to Dashboard) succeeds with the existing token (SC-007).

## Error responses

| Status | Body shape | Frontend field-clearing | Toast message |
|--------|------------|-------------------------|---------------|
| 400 (`current_password_incorrect`) | `{ success: false, code: "current_password_incorrect", message: "Current password is incorrect" }` | clear `currentPassword` only; **preserve** `newPassword` and `confirmNewPassword` (FR-016) | `error("Current password is incorrect")` |
| 400 (policy violation) | `{ success: false, code: "policy", message: "Password must contain at least one digit, ..." }` | preserve all three fields | `error(response.data.message)` (FR-017) |
| 400 (same_as_current) | `{ success: false, code: "same_as_current", message: "New password must differ from current" }` | preserve all three fields | `error(response.data.message)` |
| 401 | (handled by `axios` interceptor) | n/a | n/a |
| 5xx | `{ success: false, message: "..." }` | preserve all three fields | `error("Could not change password")` or the server's message |

## Client-side validation gate (before API call)

```pseudocode
if (newPassword !== confirmNewPassword) {
  toast.error("New passwords do not match");
  // do not call API; do not clear any field
  return;
}
```

This catches the most common typo without consuming a server round-trip and without burning a `current_password_incorrect` attempt count (if one exists; verify in feature 002).

## Implementation notes

- The handler at `Server/src/interfaces/controllers/auth.controller.js` already implements the policy and `tokenVersion` increment; **no backend changes are required** by this contract.
- The existing controller uses the `bcryptjs` `correctPassword` instance method on the User document for the current-password check.
- The exact `code` values above (`current_password_incorrect`, `policy`, `same_as_current`) reflect the spec's FR-017 list. The implementing model verifies the actual codes the existing controller emits and adjusts the toast-mapping accordingly. If the controller emits all errors as plain `message` strings (no `code` discriminator), the frontend falls back to substring matching on the message — but a code-based dispatch is preferred and may warrant a small backend tightening if the existing handler doesn't already provide it. (Tightening the response shape does not introduce a new route or schema change.)
