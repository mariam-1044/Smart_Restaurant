# Contract: Notification Bell (Frontend)

**Feature**: 004-real-notification-system
**Surface**: `Client/src/components/notifications/{NotificationBell, NotificationDropdown, NotificationItem}.jsx`, `Client/src/hooks/useNotifications.js`, `Client/src/api/notifications.js`. Slotted into `Client/src/components/Navbar.jsx`.

---

## Visibility

`Navbar.jsx` renders `<NotificationBell />` only when `useAuth().user.role === 'admin' || 'staff'`. For customers the bell is absent — not just hidden by CSS.

---

## State machine

The bell + dropdown is a single state machine, owned by `useNotifications()`:

```text
        ┌───────────┐  initial mount
        │  loading  │ ◀─────────────────────┐
        └─────┬─────┘                       │
              │ fetch ok                    │
              ▼                             │
   ┌────────────────────┐                   │
   │ ready (count == 0) │                   │
   └────────────────────┘                   │
              │ poll tick / mark / list                          │
              ▼                             │
   ┌────────────────────┐                   │
   │ ready (count > 0)  │                   │
   └─────┬──────────────┘                   │
         │                                  │
         │ network failure on any call      │
         ▼                                  │
   ┌────────────────────┐                   │
   │     api-error      │ ─── retry ───────┘
   └────────────────────┘
```

The dropdown's content depends on `pageState ∈ {loading, ready, api-error}` AND a separate `listState ∈ {idle, loading, ready, error}`:
- `loading` while the **first** unread-count call is in flight.
- `api-error` when the most-recent unread-count call OR the list call failed; the **last good count** is preserved on the badge so a transient network hiccup does not flicker.
- The list is fetched lazily — `listState === 'idle'` until the user opens the dropdown.

---

## Polling

- `setInterval(unreadCountPoll, 30_000)` is started on mount and cleared on unmount.
- When `document.hidden === true` (the visibilitychange event), the interval is paused (cleared and the handle nulled). When it returns to visible, the count is refreshed immediately and the interval is re-armed.
- The poll is **only** the unread-count endpoint (cheap, no list fetch). The list is re-fetched only when the user opens the dropdown.
- Polling MUST NOT cause duplicate concurrent in-flight requests; if a previous tick is still pending when the next tick fires, the new tick is skipped (a simple `inFlight` flag suffices).

---

## Dropdown contents (per row)

Each row in `NotificationDropdown` is a `<NotificationItem />` rendering:
- a type-icon (different react-icons glyph per `type`):
  - `low_stock` — `FaExclamationTriangle` amber
  - `expiry` — `FaClock` red
  - `reorder` — `FaTruck` blue
  - `spoilage_risk` — `FaUtensils` purple
  - `spoilage_recipe_failed` — `FaTimesCircle` red
  - `system` — `FaInfoCircle` gray
- the `title` (bold)
- the `message` (one-line, truncated with ellipsis at row width)
- a relative timestamp ("2 minutes ago"), computed from `createdAt` against `Date.now()`. No external date library; a 20-line helper in the same file is sufficient (see `relativeTime.js` style — minute / hour / day buckets).
- visual distinction between unread (white background, bold title) and read (gray background, non-bold). Distinction is from the **caller-role-projected** `read` field returned by the API.

If `relatedEntity` exists in the document and the row is navigable per FR-014a, the row is `cursor-pointer` and clicking triggers the navigate-then-mark-read sequence (see Decision 9). If the related entity has been deleted (server returns the notification with a `relatedEntityMissing: true` flag — TODO at backend, see notification-api.md note) OR the row's type is non-navigable, the row renders without the cursor-pointer affordance and the click only fires mark-read.

> **Note**: detecting "entity no longer in inventory" is a backend responsibility — the listing endpoint does an `$exists` check on each `relatedEntity` and tags missing ones with a synthetic flag. For graduation scope this can be deferred: when the client navigates to a 404 detail page, the detail page is responsible for showing "(item no longer available)" and offering a back-link.

---

## "Mark all read" affordance

A button at the top of the dropdown labeled "Mark all read":
- Disabled when `count === 0` for the caller's role.
- On click: optimistically flips every visible row's `read` to `true` and the badge to 0, then calls `markAllRead()`.
- On success: keeps the optimistic state.
- On failure: reverts and surfaces `api-error` (the dropdown shows a small inline error banner; the badge falls back to the last good count).

---

## Empty / error states

- `count === 0` with a successfully fetched list (or an open-but-never-fetched dropdown) → `<EmptyState title="You're all caught up" message="No notifications right now." />` (reuses the shared primitive from feature 003).
- `api-error` → `<ErrorState title="Couldn't reach notifications service." message="..." onRetry={refresh} />`.
- `listState === 'loading'` → `<LoadingState message="Loading notifications…" />`.
- `listState === 'ready'` and zero items → empty state (same as count 0).

The dropdown MUST NOT render an indefinite loader; if the list call has not returned within 8 seconds, fall through to `api-error`.

---

## Click-through navigation map

Resolved on the client from `(type, relatedEntity, entityModel)`:

| Type | entityModel | Target route |
|---|---|---|
| `low_stock` | `Ingredient` | `/inventory/:id` |
| `expiry` | `Ingredient` | `/inventory/:id` |
| `reorder` | `Ingredient` | `/inventory/:id` |
| `spoilage_risk` | `Ingredient` (first in payload) | `/inventory/:id` |
| `spoilage_risk` | absent | non-navigable, opens a recipe modal showing `payload.recipe` |
| `system`, `spoilage_recipe_failed` | — | non-navigable |

Future extensions (e.g., dish-related notifications routed to `/admin/menu/:id?edit=1`) follow the same shape; the navigation helper is a switch on `type` first, `entityModel` second.

---

## API client

```js
// Client/src/api/notifications.js
import api from "./axios";

export const list          = ({ before, limit = 20 } = {}) =>
  api.get("/notifications", { params: { before, limit } }).then(r => r.data.data);

export const unreadCount   = () =>
  api.get("/notifications/unread-count").then(r => r.data.data.count);

export const markRead      = (id) =>
  api.patch(`/notifications/${id}/read`).then(r => r.data.data);

export const markAllRead   = () =>
  api.patch("/notifications/read-all").then(r => r.data.data);
```

The bell never calls `axios` directly — every fetch goes through `notifications.js`.

---

## Hook contract

```ts
function useNotifications(): {
  count: number;             // last successful unread-count
  items: Notification[];     // last successful list fetch (empty on first mount)
  pageState: 'loading' | 'ready' | 'api-error';
  listState: 'idle' | 'loading' | 'ready' | 'error';
  open: () => void;          // user opened the dropdown — triggers list fetch if listState === 'idle'
  close: () => void;
  markAllReadOptimistic: () => Promise<void>;
  markReadOptimistic: (id: string) => Promise<void>;
  refresh: () => Promise<void>; // manual retry after api-error
}
```

The hook owns the `setInterval` and the visibilitychange listener; the component just consumes its return value.

---

## Acceptance checks (manual)

These map 1:1 to spec US1 acceptance scenarios:

1. Bell renders and shows correct count for an admin with seeded notifications.
2. Open dropdown → up-to-20 items, newest first, with type icon + title + message + relative time.
3. "Mark all read" → all rows render read styling, badge goes to 0, page state stays `ready`.
4. Customer-role token → no bell at all.
5. Wait 30s after creating a backend notification → badge increments without manual refresh.
6. Click any navigable row → navigation happens, mark-read fires, dropdown closes.
