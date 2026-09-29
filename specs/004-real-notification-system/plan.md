# Implementation Plan: Real Notification System

**Branch**: `004-real-notification-system` | **Date**: 2026-04-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-real-notification-system/spec.md`

## Summary

Replace the existing console-only notification path (`notification.service.js` → `logger.info()`) with a persisted, role-targeted, in-app notification system. Build it on the existing Express + Mongoose backend (no new services, no new transport) and surface it inside the existing React 19 + TailwindCSS frontend as a notification bell in the navbar. Two background flows are added on top of persistence: an auto-reorder suggestion fired after each order completes, and an extension to the already-installed `spoilage.cron.js` (06:00) so the same cron run also produces per-ingredient `expiry` notifications and prunes fully-read notifications older than 30 days. The bell stays current via 30-second polling against an unread-count endpoint — no websockets, no SSE. Read state is **per role** (`readByAdmin` / `readByStaff`), so a `targetRole: 'all'` notification can be acknowledged independently by each role; this is the only schema change that meaningfully widens the existing draft `Notification` model.

## Technical Context

**Language/Version**: JavaScript (ES2022), Node 18+ on the server, React 19.1 + Vite 7 on the client.
**Primary Dependencies (server)**: Express 4, Mongoose 8, `node-cron` 3.0.3 (already installed and used by `spoilage.cron.js`), Joi for request validation, the existing `auth.middleware` (`protect`, `restrictTo`).
**Primary Dependencies (client)**: React 19, React Router 7, Axios 1, react-icons 5, TailwindCSS 4, the existing `DashboardLayout`, `AuthContext`, and `axios` instance from feature 003.
**Storage**: MongoDB via Mongoose. One new collection (`notifications`); no schema changes to `Ingredient`, `Order`, `Dish`, or `User` are required by this feature. Auth token continues to live in `localStorage`.
**Testing**: Manual verification via `quickstart.md`. Automated tests are P5 scope per `smart_restaurant_speckit_plan.md` and remain out of scope here, matching feature 003's policy.
**Target Platform**: Modern desktop and tablet browsers — same target surface as feature 003.
**Project Type**: Existing web application monorepo (`Client/` + `Server/`).
**Performance Goals**: New notifications visible in the bell within ≤ 30s of creation in 95% of polling cycles (SC-002). Order completion latency unchanged within ±50 ms with the post-order notification side-effect enabled (SC-009). Bell idle (no notifications) renders empty state in < 3s on a brand-new database (SC-007).
**Constraints**: Must never block order completion on notification side-effects (FR-018). Must never fabricate alert content; AI failure inside the cron must produce a recorded `spoilage_recipe_failed` notification rather than a synthesized recipe (FR-004, FR-021). Must enforce role-based access at the route layer; customer-role users must not reach any notification endpoint (FR-009, SC-004). De-duplication must be honored across reads, writes, and per-role read flips (FR-003).
**Scale/Scope**: 1 new MongoDB collection + 1 new REST surface (4 endpoints) + 1 new navbar component + 3 new detail routes. Graduation-scale: ≤ 100 ingredients, ≤ 50 active staff/admin users, ≤ a few hundred notifications/month after dedup.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project's `.specify/memory/constitution.md` is the unfilled template — no concrete principles are defined. Using the same minimal default gates as feature 003:

- **No new infrastructure unless required**: Pass — `node-cron` is already installed and already wired by `spoilage.cron.js`. Notifications use the existing MongoDB instance and the existing Express app. No websocket layer, no message broker, no email infrastructure.
- **No bypass of existing security**: Pass — every notification endpoint goes through the existing `protect` + `restrictTo('admin', 'staff')` middleware chain. The bell component reads `useAuth().user.role` and renders nothing for customers (FR-009, FR-010). The mark-read endpoint additionally checks the notification's `targetRole` against the calling user's role (FR-007).
- **No fabricated data on dependency failure**: Pass — FR-004 / FR-021 / SC-006 explicitly forbid recipe synthesis on AI-service failure; the existing `spoilage.cron.js` already implements the `spoilage_recipe_failed` fallback.
- **Reuse over reinvent**: Pass — `spoilage.cron.js`, `aiService.generateRecipe`, `auth.middleware`, `DashboardLayout`, `Navbar.jsx`, the shared `LoadingState` / `EmptyState` / `ErrorState` primitives from feature 003, and the `axios` instance are all reused unchanged or as-extended (cron already exists; notification model extended in place).

Re-check after Phase 1 design: same gates re-evaluated against `data-model.md` and `contracts/` — all gates remain Pass; no Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/004-real-notification-system/
├── spec.md                         # Existing — produced by /speckit.specify + /speckit.clarify
├── plan.md                         # This file
├── research.md                     # Phase 0 output — design decisions for shared concerns
├── data-model.md                   # Phase 1 output — Notification document shape, indexes
├── quickstart.md                   # Phase 1 output — manual verification per user story
├── contracts/                      # Phase 1 output — UI ↔ backend contract per surface
│   ├── notification-api.md         # REST endpoints, payloads, error shapes
│   ├── notification-bell.md        # Frontend bell + dropdown state machine, polling
│   ├── auto-reorder-trigger.md     # Post-order check → low_stock + reorder notifications
│   └── spoilage-cron.md            # Daily 06:00 cron → expiry + spoilage_risk + prune
└── tasks.md                        # Phase 2 output (NOT created here; produced by /speckit.tasks)
```

### Source Code (repository root)

```text
Server/                                                # Existing backend
└── src/
    ├── domain/models/
    │   └── Notification.js                           # REWRITE — current draft has narrow type enum and no per-role read state; replace with the model in data-model.md
    ├── application/services/
    │   ├── notification.service.js                   # REWRITE — replace logger-only methods with `createAlert`, `markRead`, `markAllRead`, `listForRole`, `unreadCountForRole`. All previous call sites that just logged now route through `createAlert` (FR-002).
    │   ├── inventory.service.js                      # MODIFY — add `runPostOrderInventoryChecks(order)` that scans consumed ingredients, creates `low_stock` and conditionally `reorder` notifications via notification.service. Reads `REORDER_LEAD_TIME_DAYS`, `REORDER_SAFETY_DAYS` from env (defaults 3, 2) and `avgDailyUsage` from trailing-30-day order-line history.
    │   └── order.service.js                          # MODIFY — call `inventory.runPostOrderInventoryChecks(order)` after the order's ingredient deduction succeeds; wrap in try/catch so a failure never rolls back the order (FR-018).
    ├── interfaces/controllers/
    │   └── notification.controller.js                # NEW — `list`, `unreadCount`, `markRead`, `markAllRead` handlers
    ├── application/validations/
    │   └── notification.validation.js                # NEW — Joi schemas for cursor pagination and `:id` paths
    ├── routes/
    │   └── notification.routes.js                    # NEW — mounts the four endpoints under `/api/notifications`
    ├── infrastructure/cron/
    │   └── spoilage.cron.js                          # MODIFY — extend the existing `runSpoilageCheck`:
    │                                                 #   1. ALSO emit one `expiry` notification per near-expiry ingredient (FR-019a) with dedup
    │                                                 #   2. Use `CRON_TIMEZONE` env var (default `UTC`) when scheduling
    │                                                 #   3. After spoilage handling, run `runDailyPrune()` to delete fully-read notifications >30d old (FR-022)
    └── index.js                                      # MODIFY — `app.use('/api/notifications', notificationRoutes)` registration

Client/                                                # Existing frontend
└── src/
    ├── components/
    │   ├── notifications/                            # NEW — feature-scoped components
    │   │   ├── NotificationBell.jsx                  # NEW — icon + badge, controls dropdown open state
    │   │   ├── NotificationDropdown.jsx              # NEW — list of notifications, "mark all read", empty/error/loading
    │   │   └── NotificationItem.jsx                  # NEW — single row: type icon, title, message, relative time, mark-read on click
    │   └── Navbar.jsx                                # MODIFIED — slot the bell into the existing top bar (admin/staff only)
    ├── api/
    │   └── notifications.js                          # NEW — thin wrapper: `list({before, limit})`, `unreadCount()`, `markRead(id)`, `markAllRead()`
    ├── hooks/
    │   └── useNotifications.js                       # NEW — encapsulates polling (setInterval 30s), tab-visibility pause, list fetch, mark-read state mutation
    ├── pages/
    │   ├── InventoryDetail.jsx                       # NEW — `/inventory/:id` ingredient detail page (FR-014b)
    │   └── OrderDetail.jsx                           # NEW — `/orders/:id` order detail page (FR-014b — does not currently exist)
    └── App.jsx                                       # MODIFIED — register `/inventory/:id`, `/orders/:id`, and a deep-link variant of `/admin/menu/:id` that auto-opens the dish edit modal (FR-014b)
```

**Structure Decision**: Same web-application monorepo as feature 003 (`Client/` + `Server/`). The feature is **mostly additive on the backend** — one new collection, one new REST surface, two service edits, one cron extension — and **mostly additive on the frontend** — one new component group, one new hook, two new detail pages, one navbar slot. The existing partial `Notification.js` model and `notification.service.js` are treated as drafts to be replaced (the existing `spoilage.cron.js` already writes through the partial model, so the model rewrite must be backward-compatible for the in-flight notifications it has produced — a one-time migration step is documented in research.md Decision 7). No new infrastructure, no new external dependencies; `node-cron` is already installed.

## Complexity Tracking

> No Constitution Check violations to justify; the constitution file is the unfilled template, and the minimal default gates above all pass. This section intentionally left empty.

## Phase 0: Research Output

See [research.md](./research.md). Resolved decisions cover: per-role read state shape, dedup composite index strategy, cursor-pagination contract, polling vs push trade-off, post-order trigger placement (`order.service` vs `inventory.service`), reorder formula and the trailing-window source, cron timezone interpretation, model-rewrite migration path for in-flight notifications, "fabricated data" defense reused from feature 003, and the navigation-then-mark-read interaction pattern.

## Phase 1: Design & Contracts

Outputs:
- [data-model.md](./data-model.md) — `Notification` document shape with per-role read flags, indexes for `(targetRole, createdAt desc)` and `(type, relatedEntity, createdAt desc)` to power dedup and listing without a collection scan
- [contracts/](./contracts/) — four contract documents:
  - `notification-api.md` — REST contract for the four endpoints, including the cursor pagination shape and error envelopes
  - `notification-bell.md` — frontend bell + dropdown state machine, polling interval, tab-visibility behavior, click-through mapping
  - `auto-reorder-trigger.md` — post-order inventory check sequence, formula, env-var sources, dedup interaction
  - `spoilage-cron.md` — extended cron behavior: spoilage_risk + per-ingredient expiry + 30d prune, timezone resolution, retry budget reuse from existing implementation
- [quickstart.md](./quickstart.md) — step-by-step manual verification per user story (US1–US5)

Re-evaluation of Constitution Check after Phase 1: gates re-checked against final contracts and data model — all four default gates still Pass.
