---
description: "Task list for Feature 004 — Real Notification System"
---

# Tasks: Real Notification System

**Input**: Design documents from `/specs/004-real-notification-system/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)
**Tests**: Automated tests are NOT in scope for this feature (P5 per `smart_restaurant_speckit_plan.md`). Manual verification via `quickstart.md`.

## How to use this file

Each task is **self-contained and decision-free**: file paths, signatures, dependencies, and the spec/research/contracts reference are listed inline. Implement them in numerical order unless `[P]` is present (in which case the task can run in parallel with other `[P]` tasks in the same phase). Do not invent extra files. Do not change the structures defined in `data-model.md` and `contracts/` — those are the contract.

When a task says "see ResearchDecision N" or "see Contract X", open `research.md` or `contracts/<X>.md` and follow it; do not re-decide.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps to spec.md User Story (US1..US5). Setup/Foundational/Polish tasks have no story label.

## Path Conventions

- Frontend: `Client/src/...`
- Backend: `Server/src/...`
- All paths absolute from repo root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the directories and confirm dependencies. No business logic.

- [X] T01 [P] Create `Client/src/components/notifications/` (will hold NotificationBell.jsx, NotificationDropdown.jsx, NotificationItem.jsx).
- [X] T02 [P] Create `Client/src/hooks/` if it doesn't exist (will hold useNotifications.js).
- [X] T03 [P] Create `Client/src/utils/` if it doesn't exist (will hold relativeTime.js).
- [X] T04 Verify `Server/package.json` already includes `node-cron ^3` (it does — used by `spoilage.cron.js`). No new dependency to add.
- [X] T05 Verify `Server/.env` (or `.env.example`) lists `REORDER_LEAD_TIME_DAYS`, `REORDER_SAFETY_DAYS`, `CRON_TIMEZONE`. If missing, append:
  ```
  REORDER_LEAD_TIME_DAYS=3
  REORDER_SAFETY_DAYS=2
  CRON_TIMEZONE=UTC
  ```

**Checkpoint**: Directory tree from `plan.md` § Project Structure is in place; env vars exist.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the model, the service, the REST surface, the migration script, and the frontend API client. **Every user story depends on these.**

> ⚠️ Do not begin any user story (Phase 3+) until every task in Phase 2 is complete.

### Backend foundational

- [X] T06 Replace `Server/src/domain/models/Notification.js` with the schema from `data-model.md`. Keep the file path the same. Required schema:

  ```js
  const mongoose = require('mongoose');

  const notificationSchema = new mongoose.Schema({
    type:           { type: String, enum: ['low_stock', 'expiry', 'reorder', 'spoilage_risk', 'spoilage_recipe_failed', 'system'], required: true },
    title:          { type: String, required: true, maxlength: 120 },
    message:        { type: String, required: true, maxlength: 500 },
    targetRole:     { type: String, enum: ['admin', 'staff', 'all'], default: 'admin' },
    relatedEntity:  { type: mongoose.Schema.Types.ObjectId, default: null },
    entityModel:    { type: String, enum: ['Ingredient', 'Dish', 'Order'], default: null },
    payload:        { type: Object, default: {} },
    readByAdmin:    { type: Boolean, default: false },
    readByAdminAt:  { type: Date, default: null },
    readByStaff:    { type: Boolean, default: false },
    readByStaffAt:  { type: Date, default: null },
    createdAt:      { type: Date, default: Date.now, immutable: true },
    lastSeenAt:     { type: Date, default: Date.now }
  });

  // Indexes — see data-model.md § Indexes
  notificationSchema.index({ targetRole: 1, createdAt: -1 });
  notificationSchema.index({ targetRole: 1, readByAdmin: 1, createdAt: -1 });
  notificationSchema.index({ targetRole: 1, readByStaff: 1, createdAt: -1 });
  notificationSchema.index({ type: 1, relatedEntity: 1, createdAt: -1 });
  notificationSchema.index({ readByAdmin: 1, readByStaff: 1, readByAdminAt: 1, readByStaffAt: 1 });

  // Validation: relatedEntity and entityModel must be set together.
  notificationSchema.pre('validate', function (next) {
    const hasEntity = !!this.relatedEntity;
    const hasModel  = !!this.entityModel;
    if (hasEntity !== hasModel) return next(new Error('relatedEntity and entityModel must be set together'));
    next();
  });

  module.exports = mongoose.model('Notification', notificationSchema);
  ```

  Acceptance: `Notification.create({ type: 'system', title: 'x', message: 'y' })` succeeds; `Notification.create({ type: 'low_stock', title: 'x', message: 'y', relatedEntity: someId })` (without `entityModel`) throws.

- [X] T07 Create `Server/scripts/migrate-notifications.js` — one-shot migration script per `research.md` Decision 7. The script connects to the configured DB and runs:

  ```js
  // Usage: node Server/scripts/migrate-notifications.js
  require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
  const mongoose = require('mongoose');
  const connectDB = require('../src/infrastructure/config/db');

  (async () => {
    await connectDB();
    const Notification = mongoose.model('Notification') || require('../src/domain/models/Notification');
    const cursor = Notification.collection.find({});
    let migrated = 0;
    for await (const doc of cursor) {
      const update = {};
      if (doc.read !== undefined) {
        update.readByAdmin   = doc.read === true;
        update.readByAdminAt = doc.read === true ? doc.readAt || null : null;
        update.readByStaff   = doc.read === true;
        update.readByStaffAt = doc.read === true ? doc.readAt || null : null;
      }
      if (doc.lastSeenAt === undefined) update.lastSeenAt = doc.createdAt || new Date();
      const unset = {};
      if ('read' in doc)   unset.read = '';
      if ('readAt' in doc) unset.readAt = '';

      if (Object.keys(update).length || Object.keys(unset).length) {
        await Notification.collection.updateOne(
          { _id: doc._id },
          { $set: update, $unset: unset }
        );
        migrated += 1;
      }
    }
    console.log(`Migrated ${migrated} notifications.`);
    await mongoose.disconnect();
  })().catch((e) => { console.error(e); process.exit(1); });
  ```

  Acceptance: running the script against a DB containing the old shape produces zero documents with `read` / `readAt` fields and every document has `readByAdmin`, `readByStaff`, `lastSeenAt`.

- [X] T08 Replace `Server/src/application/services/notification.service.js` end-to-end. The new service exports the methods used by every call site. The OLD methods (`sendStockAlert`, `sendExpiryAlert`, `sendNewOrderNotification`) are removed in this task; T13 migrates the call sites.

  ```js
  const Notification = require('../../domain/models/Notification');
  const logger = require('../../infrastructure/config/logger');

  const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

  async function createAlert({ type, title, message, targetRole = 'admin', relatedEntity = null, entityModel = null, payload = {} }) {
    const now = new Date();

    // Dedup: see research.md Decision 2 + Decision 11.
    if (relatedEntity) {
      const cutoff = new Date(now.getTime() - DEDUP_WINDOW_MS);
      const existing = await Notification.findOne({
        type,
        relatedEntity,
        createdAt: { $gte: cutoff }
      }).sort({ createdAt: -1 });
      if (existing) {
        existing.lastSeenAt = now;
        await existing.save();
        return existing;
      }
    }

    const created = await Notification.create({
      type, title, message, targetRole, relatedEntity, entityModel, payload,
      createdAt: now, lastSeenAt: now
    });
    logger.info(`notification.created type=${type} role=${targetRole} id=${created._id}`);
    return created;
  }

  function projectForRole(doc, role) {
    const o = doc.toObject ? doc.toObject() : doc;
    const read   = role === 'admin' ? !!o.readByAdmin   : !!o.readByStaff;
    const readAt = role === 'admin' ?  o.readByAdminAt  :  o.readByStaffAt;
    // strip raw flags from the response shape
    const { readByAdmin, readByAdminAt, readByStaff, readByStaffAt, ...rest } = o;
    return { ...rest, read, readAt };
  }

  async function listForRole(role, { before, limit = 20 } = {}) {
    const lim = Math.min(50, Math.max(1, limit));
    const filter = { $or: [{ targetRole: role }, { targetRole: 'all' }] };
    if (before) filter.createdAt = { $lt: new Date(before) };
    const rows = await Notification.find(filter).sort({ createdAt: -1 }).limit(lim + 1).lean();
    const items = rows.slice(0, lim).map(d => projectForRole(d, role));
    const nextCursor = rows.length > lim ? rows[lim - 1].createdAt.toISOString() : null;
    return { items, nextCursor };
  }

  async function unreadCountForRole(role) {
    const flag = role === 'admin' ? 'readByAdmin' : 'readByStaff';
    return await Notification.countDocuments({
      $or: [{ targetRole: role }, { targetRole: 'all' }],
      [flag]: false
    });
  }

  async function markRead(id, role) {
    const doc = await Notification.findById(id);
    if (!doc) return { notFound: true };
    const targetMatches = doc.targetRole === role || doc.targetRole === 'all';
    if (!targetMatches) return { forbidden: true };

    const flag    = role === 'admin' ? 'readByAdmin'   : 'readByStaff';
    const flagAt  = role === 'admin' ? 'readByAdminAt' : 'readByStaffAt';
    if (!doc[flag]) {
      doc[flag] = true;
      doc[flagAt] = new Date();
      await doc.save();
    }
    return { ok: true, doc: projectForRole(doc, role) };
  }

  async function markAllRead(role) {
    const flag   = role === 'admin' ? 'readByAdmin'   : 'readByStaff';
    const flagAt = role === 'admin' ? 'readByAdminAt' : 'readByStaffAt';
    const now = new Date();
    const r = await Notification.updateMany(
      { $or: [{ targetRole: role }, { targetRole: 'all' }], [flag]: false },
      { $set: { [flag]: true, [flagAt]: now } }
    );
    return { modifiedCount: r.modifiedCount ?? r.nModified ?? 0 };
  }

  module.exports = { createAlert, listForRole, unreadCountForRole, markRead, markAllRead };
  ```

  Acceptance: `notification.service.createAlert(...)` writes a document; calling it again within 24h with the same `(type, relatedEntity)` updates `lastSeenAt` only.

- [X] T09 [P] Create `Server/src/application/validations/notification.validation.js`:

  ```js
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

- [X] T10 [P] Create `Server/src/interfaces/controllers/notification.controller.js`:

  ```js
  const notificationService = require('../../application/services/notification.service');

  exports.list = async (req, res) => {
    try {
      const { before, limit } = req.query;
      const data = await notificationService.listForRole(req.user.role, { before, limit: Number(limit) || 20 });
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  };

  exports.unreadCount = async (req, res) => {
    try {
      const count = await notificationService.unreadCountForRole(req.user.role);
      res.json({ success: true, data: { count } });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  };

  exports.markRead = async (req, res) => {
    try {
      const r = await notificationService.markRead(req.params.id, req.user.role);
      if (r.notFound)  return res.status(404).json({ success: false, message: 'notification_not_found' });
      if (r.forbidden) return res.status(403).json({ success: false, errorType: 'cross_role_forbidden', message: 'Notification is not visible to your role.' });
      res.json({ success: true, data: r.doc });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  };

  exports.markAllRead = async (req, res) => {
    try {
      const r = await notificationService.markAllRead(req.user.role);
      res.json({ success: true, data: r });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  };
  ```

- [X] T11 [P] Create `Server/src/routes/notification.routes.js` per `contracts/notification-api.md` § Route registration. **Critical**: register `/read-all` BEFORE `/:id/read` so Express does not match `read-all` as `:id`:

  ```js
  const express = require('express');
  const router = express.Router();
  const { protect, restrictTo } = require('../middlewares/auth.middleware');
  const validate = require('../middlewares/validate.middleware');
  const { listSchema, idParamSchema } = require('../application/validations/notification.validation');
  const ctrl = require('../interfaces/controllers/notification.controller');

  router.use(protect);
  router.use(restrictTo('admin', 'staff'));

  router.get('/',                                                    ctrl.list);
  router.get('/unread-count',                                        ctrl.unreadCount);
  router.patch('/read-all',                                          ctrl.markAllRead);
  router.patch('/:id/read',                                          ctrl.markRead);

  module.exports = router;
  ```

  > Implementation note: the existing `validate` middleware in this codebase wraps `req.body` by default; for `req.query` validation (the `listSchema`), parse and validate inline inside `ctrl.list` (the controller in T10 already coerces `limit` defensively). If your `validate` middleware supports a second argument (`'query'`), you may use it.

- [X] T12 In `Server/src/index.js`, register the route after the existing `customerRoutes` mount (alphabetical-ish order):

  ```js
  const notificationRoutes = require('./routes/notification.routes');
  // ...
  app.use('/api/notifications', notificationRoutes);
  ```

  Acceptance: `curl http://localhost:8080/api/notifications` with an admin token returns `{ success: true, data: { items: [], nextCursor: null } }` against an empty collection.

- [X] T13 Migrate the existing call sites that used the old `notification.service` shape (the old methods were removed in T08, so the codebase will fail to start until this task completes). Edit:

  - `Server/src/application/services/inventory.service.js`:
    - Replace `notificationService.sendExpiryAlert(ing, 0)` with:
      ```js
      await notificationService.createAlert({
        type: 'expiry',
        title: `${ing.name} has expired`,
        message: `${ing.quantity ?? 0} ${ing.unit} remaining; expiry ${ing.expiryDate.toISOString().slice(0,10)}.`,
        targetRole: 'admin',
        relatedEntity: ing._id,
        entityModel: 'Ingredient',
        payload: { ingredientName: ing.name, expiryDate: ing.expiryDate, daysUntilExpiry: 0, unit: ing.unit, remainingQuantity: ing.quantity ?? 0 }
      });
      ```
    - Replace `notificationService.sendExpiryAlert(ing, diffDays)` with the same shape, using `daysUntilExpiry: diffDays` and an appropriate title (`expires in X day(s)`).
    - Replace `notificationService.sendStockAlert(ing)` with:
      ```js
      await notificationService.createAlert({
        type: 'low_stock',
        title: `${ing.name} is below minimum stock`,
        message: `${ing.quantity} ${ing.unit} remaining (min: ${ing.minStock} ${ing.unit}).`,
        targetRole: 'admin',
        relatedEntity: ing._id,
        entityModel: 'Ingredient',
        payload: { ingredientName: ing.name, currentQuantity: ing.quantity, minStock: ing.minStock, unit: ing.unit }
      });
      ```
  - `Server/src/application/services/order.service.js`:
    - Line ~88: replace `notificationService.sendNewOrderNotification(order)` with:
      ```js
      await notificationService.createAlert({
        type: 'system',
        title: `New order received`,
        message: `Order #${String(order._id).slice(-6)} — total $${(order.totalPrice ?? 0).toFixed(2)}.`,
        targetRole: 'staff',
        relatedEntity: order._id,
        entityModel: 'Order',
        payload: { orderId: order._id, total: order.totalPrice }
      });
      ```
    - Line ~270: same `low_stock` shape as the inventory.service replacement above.

  Acceptance: `node Server/src/index.js` starts cleanly. Placing an order that consumes an at-min-stock ingredient creates a `low_stock` notification document in Mongo.

### Frontend foundational — API client and helpers

- [X] T14 [P] Create `Client/src/api/notifications.js` per `contracts/notification-bell.md` § API client:

  ```js
  import api from "./axios";

  export const list        = ({ before, limit = 20 } = {}) =>
    api.get("/notifications", { params: { before, limit } }).then(r => r.data.data);

  export const unreadCount = () =>
    api.get("/notifications/unread-count").then(r => r.data.data.count);

  export const markRead    = (id) =>
    api.patch(`/notifications/${id}/read`).then(r => r.data.data);

  export const markAllRead = () =>
    api.patch("/notifications/read-all").then(r => r.data.data);
  ```

- [X] T15 [P] Create `Client/src/utils/relativeTime.js`:

  ```js
  export function relativeTime(input) {
    if (!input) return "";
    const then = new Date(input).getTime();
    const diff = Math.max(0, Date.now() - then);
    const sec  = Math.round(diff / 1000);
    if (sec < 5)        return "just now";
    if (sec < 60)       return `${sec} second${sec === 1 ? "" : "s"} ago`;
    const min = Math.round(sec / 60);
    if (min < 60)       return `${min} minute${min === 1 ? "" : "s"} ago`;
    const hr  = Math.round(min / 60);
    if (hr < 24)        return `${hr} hour${hr === 1 ? "" : "s"} ago`;
    const day = Math.round(hr / 24);
    if (day < 30)       return `${day} day${day === 1 ? "" : "s"} ago`;
    return new Date(input).toLocaleDateString();
  }
  ```

**Checkpoint**: Backend has the model, the service, the four endpoints, and migrated call sites. Frontend has the API client and the time helper. User stories can now be implemented in any order.

---

## Phase 3: User Story 1 — Notification Bell (Priority: P1) 🎯 MVP candidate

**Goal**: Render a bell icon in the navbar (admin/staff only) with an unread badge, a dropdown listing notifications, and a mark-all-read affordance. Polls every 30s and pauses when the tab is hidden.

**Independent test**: see `quickstart.md` §1.

**Contract**: `contracts/notification-bell.md`. Do not deviate.

### Implementation

- [X] T16 [P] [US1] Create `Client/src/components/notifications/NotificationItem.jsx`. Props: `{ item, onClick }`. Renders type icon (per the table in `notification-bell.md` § Dropdown contents), title (bold when unread), message (truncated), `relativeTime(item.createdAt)`. Visual distinction unread vs read: white bg + bold title vs gray bg + regular weight. Cursor pointer when navigable. The icon→type map:

  ```jsx
  import { FaExclamationTriangle, FaClock, FaTruck, FaUtensils, FaTimesCircle, FaInfoCircle } from "react-icons/fa";
  import { relativeTime } from "../../utils/relativeTime";

  const ICONS = {
    low_stock:               { icon: FaExclamationTriangle, color: "text-amber-500" },
    expiry:                  { icon: FaClock,                color: "text-red-500"   },
    reorder:                 { icon: FaTruck,                color: "text-blue-500"  },
    spoilage_risk:           { icon: FaUtensils,             color: "text-purple-500"},
    spoilage_recipe_failed:  { icon: FaTimesCircle,          color: "text-red-500"   },
    system:                  { icon: FaInfoCircle,           color: "text-gray-500"  }
  };

  const NAVIGABLE_TYPES = ["low_stock", "expiry", "reorder", "spoilage_risk"];

  export default function NotificationItem({ item, onClick }) {
    const { icon: Icon, color } = ICONS[item.type] || ICONS.system;
    const navigable = NAVIGABLE_TYPES.includes(item.type) && !!item.relatedEntity;
    return (
      <div
        onClick={() => onClick(item, navigable)}
        className={`flex gap-3 px-3 py-2 border-b ${item.read ? "bg-gray-50" : "bg-white"} ${navigable ? "cursor-pointer hover:bg-gray-100" : "cursor-default"}`}
      >
        <Icon className={`mt-1 ${color}`} />
        <div className="flex-1 min-w-0">
          <div className={`${item.read ? "font-normal" : "font-semibold"} text-sm truncate`}>{item.title}</div>
          <div className="text-xs text-gray-600 truncate">{item.message}</div>
          <div className="text-xs text-gray-400 mt-0.5">{relativeTime(item.createdAt)}</div>
        </div>
      </div>
    );
  }
  ```

- [X] T17 [P] [US1] Create `Client/src/hooks/useNotifications.js` — owns polling, tab visibility, optimistic mutations. See `contracts/notification-bell.md` § Hook contract.

  ```js
  import { useEffect, useRef, useState, useCallback } from "react";
  import { list, unreadCount, markRead as apiMarkRead, markAllRead as apiMarkAllRead } from "../api/notifications";

  const POLL_MS = 30_000;

  export default function useNotifications() {
    const [count, setCount] = useState(0);
    const [items, setItems] = useState([]);
    const [pageState, setPageState] = useState("loading");   // loading | ready | api-error
    const [listState, setListState] = useState("idle");      // idle | loading | ready | error
    const intervalRef = useRef(null);
    const inFlightRef = useRef(false);

    const refreshCount = useCallback(async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const c = await unreadCount();
        setCount(c);
        setPageState("ready");
      } catch {
        setPageState("api-error");
      } finally {
        inFlightRef.current = false;
      }
    }, []);

    const refreshList = useCallback(async () => {
      setListState("loading");
      try {
        const { items } = await list({ limit: 20 });
        setItems(items);
        setListState("ready");
      } catch {
        setListState("error");
      }
    }, []);

    const armPolling = useCallback(() => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(refreshCount, POLL_MS);
    }, [refreshCount]);

    const disarmPolling = useCallback(() => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, []);

    useEffect(() => {
      refreshCount();
      armPolling();
      const onVisibility = () => {
        if (document.hidden) disarmPolling();
        else { refreshCount(); armPolling(); }
      };
      document.addEventListener("visibilitychange", onVisibility);
      return () => {
        document.removeEventListener("visibilitychange", onVisibility);
        disarmPolling();
      };
    }, [refreshCount, armPolling, disarmPolling]);

    const open = useCallback(() => { if (listState === "idle") refreshList(); }, [listState, refreshList]);
    const close = useCallback(() => {}, []);

    const markReadOptimistic = useCallback(async (id) => {
      setItems(prev => prev.map(i => i._id === id ? { ...i, read: true, readAt: new Date().toISOString() } : i));
      setCount(c => Math.max(0, c - 1));
      try { await apiMarkRead(id); } catch { await refreshCount(); await refreshList(); }
    }, [refreshCount, refreshList]);

    const markAllReadOptimistic = useCallback(async () => {
      setItems(prev => prev.map(i => i.read ? i : { ...i, read: true, readAt: new Date().toISOString() }));
      setCount(0);
      try { await apiMarkAllRead(); } catch { await refreshCount(); await refreshList(); }
    }, [refreshCount, refreshList]);

    return { count, items, pageState, listState, open, close, refresh: () => { refreshCount(); refreshList(); }, markReadOptimistic, markAllReadOptimistic };
  }
  ```

- [X] T18 [P] [US1] Create `Client/src/components/notifications/NotificationDropdown.jsx`. Props: `{ items, listState, count, onItemClick, onMarkAllRead }`. Reuses shared primitives from feature 003 (`LoadingState`, `EmptyState`, `ErrorState`).

  ```jsx
  import LoadingState from "../shared/LoadingState";
  import EmptyState from "../shared/EmptyState";
  import ErrorState from "../shared/ErrorState";
  import NotificationItem from "./NotificationItem";

  export default function NotificationDropdown({ items, listState, count, onItemClick, onMarkAllRead, onRetry }) {
    return (
      <div className="absolute right-0 top-10 z-50 bg-white rounded shadow-lg w-96 max-h-[500px] flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <h4 className="font-semibold">Notifications</h4>
          <button
            onClick={onMarkAllRead}
            disabled={count === 0}
            className="text-xs text-blue-600 disabled:opacity-40"
          >
            Mark all read
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {listState === "loading" && <LoadingState message="Loading notifications…" />}
          {listState === "error"   && <ErrorState message="Couldn't reach notifications service." onRetry={onRetry} />}
          {listState === "ready" && items.length === 0 && (
            <EmptyState title="You're all caught up" message="No notifications right now." />
          )}
          {listState === "ready" && items.length > 0 && items.map(item => (
            <NotificationItem key={item._id} item={item} onClick={onItemClick} />
          ))}
        </div>
      </div>
    );
  }
  ```

- [X] T19 [US1] Create `Client/src/components/notifications/NotificationBell.jsx`. Composes the hook + dropdown + the click-through navigation. See `contracts/notification-bell.md` § Click-through navigation map for the type→route table.

  ```jsx
  import { useState, useRef, useEffect } from "react";
  import { useNavigate } from "react-router-dom";
  import { FaBell } from "react-icons/fa";
  import useNotifications from "../../hooks/useNotifications";
  import NotificationDropdown from "./NotificationDropdown";

  function resolveRoute(item) {
    switch (item.type) {
      case "low_stock":
      case "expiry":
      case "reorder":
        return item.entityModel === "Ingredient" && item.relatedEntity ? `/inventory/${item.relatedEntity}` : null;
      case "spoilage_risk": {
        const firstId = item.payload?.ingredients?.[0]?.ingredientId;
        return firstId ? `/inventory/${firstId}` : null;
      }
      default:
        return null;
    }
  }

  export default function NotificationBell() {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const wrapRef = useRef(null);
    const n = useNotifications();

    useEffect(() => {
      function handleOutside(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
      if (open) document.addEventListener("mousedown", handleOutside);
      return () => document.removeEventListener("mousedown", handleOutside);
    }, [open]);

    function toggle() { setOpen(o => { const next = !o; if (next) n.open(); return next; }); }

    function handleItemClick(item, navigable) {
      setOpen(false);
      n.markReadOptimistic(item._id);  // fire-and-forget, see ResearchDecision 9
      if (navigable) {
        const route = resolveRoute(item);
        if (route) navigate(route);
      }
    }

    return (
      <div ref={wrapRef} className="relative">
        <button onClick={toggle} className="relative p-2 hover:bg-gray-100 rounded-full" aria-label="Notifications">
          <FaBell className="text-gray-600 text-xl" />
          {n.count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white text-xs rounded-full px-1.5 min-w-[18px] text-center">
              {n.count > 99 ? "99+" : n.count}
            </span>
          )}
        </button>
        {open && (
          <NotificationDropdown
            items={n.items}
            listState={n.listState}
            count={n.count}
            onItemClick={handleItemClick}
            onMarkAllRead={n.markAllReadOptimistic}
            onRetry={n.refresh}
          />
        )}
      </div>
    );
  }
  ```

- [X] T20 [US1] Modify `Client/src/components/Navbar.jsx` to slot the bell. Add the import at the top and place it inside `<div className="nav-right">` between the actions div and the profile div, **only when the user's role is `admin` or `staff`**:

  ```jsx
  // top of file
  import NotificationBell from "./notifications/NotificationBell";

  // inside <div className="nav-right">, between the existing `actions` div and the `profile` div:
  {(user?.role === "admin" || user?.role === "staff") && (
    <div style={{ marginLeft: "10px", marginRight: "10px" }}>
      <NotificationBell />
    </div>
  )}
  ```

  Acceptance: signing in as admin shows the bell; signing in as a customer hides it. The bell badge reflects the unread count.

**Checkpoint US1**: Run `quickstart.md` §1. All steps pass. Notifications can be seen, polled, and marked read.

---

## Phase 4: User Story 2 — Persisted Low-Stock & Expiry Alerts (Priority: P1)

**Goal**: After every order completes, scan consumed ingredients and create persisted `low_stock` notifications. The 06:00 cron also creates per-ingredient `expiry` notifications. Add the detail routes the bell needs to navigate to.

**Independent test**: `quickstart.md` §2.

**Contracts**: `contracts/auto-reorder-trigger.md` (low_stock half), `contracts/spoilage-cron.md` (expiry half).

### Detail routes (new pages required by FR-014b)

- [X] T21 [P] [US2] Create `Client/src/pages/InventoryDetail.jsx` — minimal page that fetches `GET /inventory/:id` and renders the ingredient. If the request 404s, render `<EmptyState title="Item no longer available" message="…" />`. Use `DashboardLayout`. Outline:

  ```jsx
  import { useEffect, useState } from "react";
  import { useParams, Link } from "react-router-dom";
  import DashboardLayout from "../layouts/DashboardLayout";
  import api from "../api/axios";
  import LoadingState from "../components/shared/LoadingState";
  import EmptyState   from "../components/shared/EmptyState";
  import ErrorState   from "../components/shared/ErrorState";

  export default function InventoryDetail() {
    const { id } = useParams();
    const [state, setState] = useState("loading"); // loading | ready | missing | error
    const [ing, setIng] = useState(null);

    useEffect(() => {
      let active = true;
      api.get(`/inventory/${id}`)
        .then(r => { if (!active) return; setIng(r.data.data ?? r.data); setState("ready"); })
        .catch(err => { if (!active) return; setState(err.response?.status === 404 ? "missing" : "error"); });
      return () => { active = false; };
    }, [id]);

    return (
      <DashboardLayout>
        <div className="p-6">
          <Link to="/inventory" className="text-blue-600 text-sm">← Back to inventory</Link>
          {state === "loading" && <LoadingState message="Loading ingredient…" />}
          {state === "missing" && <EmptyState title="Item no longer available" message="This ingredient may have been deleted." />}
          {state === "error"   && <ErrorState message="Failed to load ingredient." />}
          {state === "ready" && ing && (
            <div className="mt-4 bg-white rounded shadow p-6 space-y-2">
              <h1 className="text-2xl font-semibold">{ing.name}</h1>
              <p>Quantity: {ing.quantity} {ing.unit}</p>
              <p>Min stock: {ing.minStock} {ing.unit}</p>
              <p>Cost per unit: ${(ing.costPerUnit ?? 0).toFixed(2)}</p>
              <p>Expiry: {ing.expiryDate ? new Date(ing.expiryDate).toLocaleDateString() : "—"}</p>
              <p>Waste so far: {ing.wasteQuantity ?? 0} {ing.unit}</p>
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }
  ```

- [X] T22 [P] [US2] Create `Client/src/pages/OrderDetail.jsx` — fetches `GET /orders/:id` and renders the order summary. Same loading/missing/error pattern as T21. (The `/orders/:id` backend endpoint already exists; if not, this is a P5 follow-up. For graduation scope the page can also gracefully render the "missing" state.)

  ```jsx
  import { useEffect, useState } from "react";
  import { useParams, Link } from "react-router-dom";
  import DashboardLayout from "../layouts/DashboardLayout";
  import api from "../api/axios";
  import LoadingState from "../components/shared/LoadingState";
  import EmptyState   from "../components/shared/EmptyState";
  import ErrorState   from "../components/shared/ErrorState";

  export default function OrderDetail() {
    const { id } = useParams();
    const [state, setState] = useState("loading");
    const [order, setOrder] = useState(null);

    useEffect(() => {
      let active = true;
      api.get(`/orders/${id}`)
        .then(r => { if (!active) return; setOrder(r.data.data ?? r.data); setState("ready"); })
        .catch(err => { if (!active) return; setState(err.response?.status === 404 ? "missing" : "error"); });
      return () => { active = false; };
    }, [id]);

    return (
      <DashboardLayout>
        <div className="p-6">
          <Link to="/sales" className="text-blue-600 text-sm">← Back to sales</Link>
          {state === "loading" && <LoadingState message="Loading order…" />}
          {state === "missing" && <EmptyState title="Order no longer available" message="" />}
          {state === "error"   && <ErrorState message="Failed to load order." />}
          {state === "ready" && order && (
            <div className="mt-4 bg-white rounded shadow p-6 space-y-2">
              <h1 className="text-2xl font-semibold">Order #{String(order._id).slice(-6)}</h1>
              <p>Total: ${(order.totalPrice ?? 0).toFixed(2)}</p>
              <p>Status: {order.status}</p>
              <p>Placed: {new Date(order.createdAt).toLocaleString()}</p>
              <h3 className="font-semibold pt-2">Items</h3>
              <ul className="text-sm list-disc pl-5">
                {(order.items ?? []).map((it, i) => (
                  <li key={i}>{it.dish?.name ?? it.dish} × {it.quantity} — ${it.priceAtTime?.toFixed?.(2) ?? it.priceAtTime}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }
  ```

- [X] T23 [US2] Modify `Client/src/App.jsx` to register the two new detail routes. Add imports and routes:

  ```jsx
  import InventoryDetail from "./pages/InventoryDetail";
  import OrderDetail     from "./pages/OrderDetail";
  // ...
  <Route path="/inventory/:id" element={<ProtectedRoute><InventoryDetail /></ProtectedRoute>} />
  <Route path="/orders/:id"    element={<ProtectedRoute><OrderDetail     /></ProtectedRoute>} />
  ```

  Place these AFTER the existing `/inventory` route (Express-style longest-match isn't necessary for React Router 7 nested matching, but put them adjacent for readability).

### Backend low-stock trigger

- [X] T24 [US2] Add `runPostOrderInventoryChecks(order)` to `Server/src/application/services/inventory.service.js`. This task creates the function with **only the low_stock branch**; the reorder branch is added in T28 (US3). Per `contracts/auto-reorder-trigger.md`:

  ```js
  // At top of file
  const Dish = require('../../domain/models/Dish');
  const Order = require('../../domain/models/Order');
  const notificationService = require('./notification.service');

  // Append at the end of the existing module.exports surface
  exports.runPostOrderInventoryChecks = async function (order) {
    if (!order || !order.items || order.items.length === 0) return;

    const dishIds = [...new Set(order.items.map(i => String(i.dish)))];
    const dishes  = await Dish.find({ _id: { $in: dishIds } }).populate('ingredients.ingredient').lean();
    const consumedIngredientIds = new Set();
    for (const d of dishes) {
      for (const link of d.ingredients || []) {
        if (link.ingredient?._id) consumedIngredientIds.add(String(link.ingredient._id));
      }
    }
    if (consumedIngredientIds.size === 0) return;

    const Ingredient = require('../../domain/models/Ingredient');
    const ingredients = await Ingredient.find({ _id: { $in: [...consumedIngredientIds] } }).lean();

    for (const ing of ingredients) {
      if ((ing.quantity ?? 0) <= (ing.minStock ?? 0)) {
        try {
          await notificationService.createAlert({
            type: 'low_stock',
            title: `${ing.name} is below minimum stock`,
            message: `${ing.quantity} ${ing.unit} remaining (min: ${ing.minStock} ${ing.unit}).`,
            targetRole: 'admin',
            relatedEntity: ing._id,
            entityModel: 'Ingredient',
            payload: { ingredientName: ing.name, currentQuantity: ing.quantity, minStock: ing.minStock, unit: ing.unit }
          });
        } catch (e) {
          require('../../infrastructure/config/logger').warn(`low_stock notification failed for ${ing.name}: ${e.message}`);
        }
        // Reorder branch added in T28 (US3).
      }
    }
  };
  ```

- [X] T25 [US2] Modify `Server/src/application/services/order.service.js`. After the existing post-create flow (the place where the order has been persisted AND `_deductIngredients` has been called), add:

  ```js
  // FR-015 / FR-018 — fire and forget; never roll back the order on a side-effect failure.
  try {
    const inventoryService = require('./inventory.service');
    await inventoryService.runPostOrderInventoryChecks(order);
  } catch (e) {
    require('../../infrastructure/config/logger').warn(`post-order inventory check failed: ${e.message}`);
  }
  ```

  The exact line of insertion depends on the existing order flow — search for the place where the order is returned to the controller (typically right after `await this._deductIngredients(...)` succeeded). Wrap **separately** from the existing try/catch so a check failure does not propagate.

  > Note: T13 already replaced the previous `notificationService.sendStockAlert(updatedIng)` call inside `_deductIngredients` with `createAlert(... 'low_stock' ...)`. This task adds a second-pass scan AFTER deduction so multi-item orders that touch the same ingredient see the right post-state. The dedup in `createAlert` ensures the bell still shows exactly one row.

### Backend per-ingredient expiry (cron extension)

- [X] T26 [US2] Modify `Server/src/infrastructure/cron/spoilage.cron.js`. Add an `emitExpiryNotifications(nearExpiry, now)` helper and call it from a new `runDailyJob` orchestrator. (The existing `runSpoilageCheck` stays — it produces the aggregate `spoilage_risk`. This adds the per-ingredient expiry pass.)

  ```js
  const notificationService = require('../../application/services/notification.service');

  async function emitExpiryNotifications(nearExpiry, now) {
    const today = (now || new Date()).getTime();
    for (const ing of nearExpiry) {
      const daysUntilExpiry = Math.ceil((new Date(ing.expiryDate).getTime() - today) / 86_400_000);
      try {
        await notificationService.createAlert({
          type: 'expiry',
          title: daysUntilExpiry <= 0
            ? `${ing.name} has expired`
            : `${ing.name} expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`,
          message: `${ing.quantity ?? 0} ${ing.unit} remaining; expiry ${new Date(ing.expiryDate).toISOString().slice(0, 10)}.`,
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
      } catch (e) {
        logger.warn(`expiry notification failed for ${ing.name}: ${e.message}`);
      }
    }
  }
  ```

  Then refactor `runSpoilageCheck` to **return** its `nearExpiry` array (currently it computes it internally) so the orchestrator can pass it to `emitExpiryNotifications` without re-querying. Concretely: at the top of `runSpoilageCheck`, after `nearExpiry = await Ingredient.find(...)`, the function continues with its existing recipe logic; it should additionally return `{ ...existing, nearExpiry }` on every code path that returns. Consumer code that currently checks `result.skipped` or `result.ok` keeps working.

  Add the orchestrator at the bottom of the file (used by both the cron schedule and `--once`):

  ```js
  async function runDailyJob() {
    const result = await runSpoilageCheck();        // step 1: existing spoilage_risk path
    if (result?.nearExpiry?.length) {
      await emitExpiryNotifications(result.nearExpiry);   // step 2: per-ingredient expiry — added in this task
    }
    // step 3: prune is added in T34 (US5).
    return result;
  }

  module.exports = { runSpoilageCheck, emitExpiryNotifications, runDailyJob, scheduleSpoilageCron, RETRY_DELAYS_MS, TOTAL_BUDGET_MS };
  ```

  Update `scheduleSpoilageCron` to call `runDailyJob` instead of `runSpoilageCheck`, and update the `--once` block at the bottom of the file to call `runDailyJob` too.

  Acceptance: `node Server/src/infrastructure/cron/spoilage.cron.js --once` against a DB with at least one ingredient expiring in ≤3 days creates one `expiry` notification per such ingredient AND one `spoilage_risk` aggregate.

**Checkpoint US2**: Run `quickstart.md` §2. The post-order check writes a `low_stock`, the cron writes per-ingredient `expiry`, dedup catches duplicates, click-through navigates to `/inventory/:id`, deleted-ingredient renders gracefully.

---

## Phase 5: User Story 3 — Auto-Reorder Suggestion (Priority: P2)

**Goal**: When the post-order check finds a below-`minStock` ingredient AND the trailing-30-day usage indicates depletion before the configured lead time AND the ingredient has at least 14 days of order history, also create a `reorder` notification with a suggested quantity.

**Independent test**: `quickstart.md` §3.

**Contract**: `contracts/auto-reorder-trigger.md` § Reorder gate.

### Implementation

- [X] T27 [US3] Read env vars at process start. In `Server/src/application/services/inventory.service.js`, add at the top of the file:

  ```js
  const REORDER_LEAD_TIME_DAYS = Number(process.env.REORDER_LEAD_TIME_DAYS ?? 3);
  const REORDER_SAFETY_DAYS    = Number(process.env.REORDER_SAFETY_DAYS    ?? 2);
  ```

  These constants are used in T28. They are read once at module load — do NOT re-read `process.env` per request.

- [X] T28 [US3] Extend `runPostOrderInventoryChecks` (added in T24) with the reorder gate. Inside the `for (const ing of ingredients)` loop, after the low_stock block, add:

  ```js
  // Reorder gate — see contracts/auto-reorder-trigger.md and ResearchDecision 6.
  try {
    const Order = require('../../domain/models/Order');
    const lookback = new Date(Date.now() - 30 * 86_400_000);
    const usage = await Order.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: lookback } } },
      { $unwind: '$items' },
      { $lookup: { from: 'dishes', localField: 'items.dish', foreignField: '_id', as: 'd' } },
      { $unwind: '$d' },
      { $unwind: '$d.ingredients' },
      { $match: { 'd.ingredients.ingredient': ing._id } },
      { $group: {
          _id: { day: { $dateTrunc: { date: '$createdAt', unit: 'day' } } },
          qty: { $sum: { $multiply: ['$d.ingredients.quantity', '$items.quantity'] } }
      } }
    ]);
    const daysWithData = usage.length;
    if (daysWithData < 14) continue;  // FR-016: insufficient history → no reorder

    const totalUsage    = usage.reduce((s, r) => s + (r.qty || 0), 0);
    const avgDailyUsage = totalUsage / 30;
    if (avgDailyUsage <= 0) continue;

    const daysUntilDepletion = ing.quantity / avgDailyUsage;
    if (daysUntilDepletion >= REORDER_LEAD_TIME_DAYS) continue;

    const targetQuantity   = Math.ceil(avgDailyUsage * (REORDER_LEAD_TIME_DAYS + REORDER_SAFETY_DAYS));
    const suggestedQuantity = Math.max(0, Math.ceil(targetQuantity - ing.quantity));
    if (suggestedQuantity <= 0) continue;

    await notificationService.createAlert({
      type: 'reorder',
      title: `Reorder ${ing.name}`,
      message: `Suggested: order ${suggestedQuantity} ${ing.unit} (covers ${REORDER_LEAD_TIME_DAYS}d lead + ${REORDER_SAFETY_DAYS}d safety).`,
      targetRole: 'admin',
      relatedEntity: ing._id,
      entityModel: 'Ingredient',
      payload: {
        ingredientName: ing.name,
        currentQuantity: ing.quantity,
        minStock: ing.minStock,
        avgDailyUsage,
        daysUntilDepletion,
        leadTimeDays: REORDER_LEAD_TIME_DAYS,
        safetyDays: REORDER_SAFETY_DAYS,
        suggestedQuantity,
        unit: ing.unit
      }
    });
  } catch (e) {
    require('../../infrastructure/config/logger').warn(`reorder check failed for ${ing.name}: ${e.message}`);
  }
  ```

  The reorder notification appears as a **separate row** in the bell from the low_stock notification (different `type`, same `relatedEntity`). Dedup is per-`type`, so both fire once per 24h.

  Acceptance: an ingredient with 14+ days of history, currently at-or-below `minStock`, with `daysUntilDepletion < 3`, generates exactly one `reorder` notification per 24h whose payload's `suggestedQuantity` matches the formula.

**Checkpoint US3**: Run `quickstart.md` §3. Reorder fires only when history is sufficient; suggested quantity is correct; env-var override works.

---

## Phase 6: User Story 4 — Daily Spoilage Cron (Priority: P2)

**Goal**: The 06:00 cron creates a `spoilage_risk` notification with an AI-generated recipe attached, falls back to `spoilage_recipe_failed` when the AI service is unavailable, and respects `CRON_TIMEZONE`.

**Independent test**: `quickstart.md` §4.

**Contract**: `contracts/spoilage-cron.md`.

> Most of this story is **already implemented** by the existing `Server/src/infrastructure/cron/spoilage.cron.js` (it does the recipe call, the retry budget, and writes both `spoilage_risk` and `spoilage_recipe_failed`). This phase only **adds the timezone option** and **routes the existing notification creation through `notification.service.createAlert`** so dedup applies.

### Implementation

- [X] T29 [US4] Modify `scheduleSpoilageCron` in `Server/src/infrastructure/cron/spoilage.cron.js` to pass the timezone option:

  ```js
  function scheduleSpoilageCron() {
    const cron = require('node-cron');
    return cron.schedule('0 6 * * *', () => {
      runDailyJob().catch((err) => logger.error(`spoilage.cron crashed: ${err.message}`));
    }, {
      timezone: process.env.CRON_TIMEZONE || 'UTC'
    });
  }
  ```

  Acceptance: setting `CRON_TIMEZONE=Africa/Cairo` and restarting the server reschedules the cron to 06:00 Cairo time.

- [X] T30 [US4] Replace the two direct `Notification.create({...})` calls in `runSpoilageCheck` with `notificationService.createAlert(...)` so the dedup window applies. The existing payload shapes already match `data-model.md`. After the change:

  ```js
  // SUCCESS branch (had: await Notification.create({ type: 'spoilage_risk', ... }))
  await notificationService.createAlert({
    type: 'spoilage_risk',
    title: 'Spoilage prevention recipe',
    message: recipe.name || 'Suggested recipe to use near-expiry ingredients.',
    targetRole: 'staff',
    relatedEntity: nearExpiry[0]._id,                      // first near-expiry ingredient anchors the deep link
    entityModel: 'Ingredient',
    payload: {
      ingredients: nearExpiry.map(i => ({ ingredientId: i._id, name: i.name, daysUntilExpiry: Math.ceil((i.expiryDate - new Date()) / 86_400_000) })),
      recipe,
      correlationId
    }
  });

  // FAILURE branch (had: await Notification.create({ type: 'spoilage_recipe_failed', ... }))
  await notificationService.createAlert({
    type: 'spoilage_recipe_failed',
    title: 'Spoilage recipe generation failed',
    message: ingredientNames.join(', '),
    targetRole: 'admin',
    payload: {
      ingredients: ingredientNames,
      attempts: Math.min(attempts, RETRY_DELAYS_MS.length + 1),
      lastError: lastError ? (lastError.reason || lastError.message || String(lastError)) : 'unknown',
      correlationId
    }
  });
  ```

  At top of file: `const notificationService = require('../../application/services/notification.service');`

  > Note: `spoilage_recipe_failed` has **no** `relatedEntity`/`entityModel`, so dedup does NOT apply (per FR-003 and Decision 11). Each cron run that fails produces a fresh failure notification — that's intended.

  Acceptance: with the AI service up, the cron creates a `spoilage_risk` whose `payload.recipe` is populated. With the AI service stubbed down, the cron creates `spoilage_risk` (no recipe) AND `spoilage_recipe_failed`.

**Checkpoint US4**: Run `quickstart.md` §4. Cron behaves identically to today, plus respects the timezone env var, plus benefits from the per-ingredient `expiry` notifications added in T26.

---

## Phase 7: User Story 5 — 30-day Prune (Priority: P3)

**Goal**: The same daily cron deletes notifications fully read by every relevant role and older than 30 days. Unread notifications are preserved.

**Independent test**: `quickstart.md` §5.

**Contract**: `contracts/spoilage-cron.md` § Step 3.

### Implementation

- [X] T31 [US5] Add `runDailyPrune` to `Server/src/infrastructure/cron/spoilage.cron.js`:

  ```js
  async function runDailyPrune() {
    const cutoffMs = Date.now() - 30 * 86_400_000;

    const candidates = await Notification.find({
      readByAdmin: true,
      readByStaff: true
    }).select('_id readByAdminAt readByStaffAt').lean();

    const toDelete = candidates
      .filter(n => {
        const a = n.readByAdminAt ? new Date(n.readByAdminAt).getTime() : 0;
        const s = n.readByStaffAt ? new Date(n.readByStaffAt).getTime() : 0;
        const latest = Math.max(a, s);
        return latest > 0 && latest < cutoffMs;
      })
      .map(n => n._id);

    if (toDelete.length === 0) {
      logger.info('spoilage.cron prune: nothing to delete');
      return { deleted: 0 };
    }

    const BATCH = 1000;
    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += BATCH) {
      const slice = toDelete.slice(i, i + BATCH);
      const r = await Notification.deleteMany({ _id: { $in: slice } });
      deleted += (r.deletedCount ?? 0);
    }
    logger.info(`spoilage.cron prune: deleted ${deleted} notifications`);
    return { deleted };
  }
  ```

- [X] T32 [US5] Wire `runDailyPrune` into the orchestrator. Update `runDailyJob` from T26:

  ```js
  async function runDailyJob() {
    const result = await runSpoilageCheck();
    if (result?.nearExpiry?.length) {
      await emitExpiryNotifications(result.nearExpiry);
    }
    try {
      await runDailyPrune();
    } catch (e) {
      logger.warn(`spoilage.cron prune failed: ${e.message}`);
    }
    return result;
  }

  module.exports = {
    runSpoilageCheck, emitExpiryNotifications, runDailyPrune, runDailyJob,
    scheduleSpoilageCron, RETRY_DELAYS_MS, TOTAL_BUDGET_MS
  };
  ```

  Acceptance: seeded 31-day-old read notifications are deleted by `--once`; unread ones older than 30 days are preserved.

**Checkpoint US5**: Run `quickstart.md` §5.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T33 [P] Run the full `quickstart.md` end-to-end including §6 (cross-cutting checks). Fix any deviations. The quickstart pass is the acceptance gate.
- [X] T34 [P] Verify SC-001: grep `Server/src/application/services/notification.service.js` for `logger.info` — there should be exactly one (the audit log inside `createAlert`); none acting as a sole delivery channel for a stock/expiry/reorder event.
- [X] T35 [P] Verify SC-004: with a customer-role token, `curl http://localhost:8080/api/notifications` returns 403. Same for `/unread-count`, `/:id/read`, `/read-all`.
- [X] T36 [P] Verify SC-008a: create a `targetRole: 'all'` notification via the helper, sign in as admin and mark it read, sign in as staff — the same notification still renders unread for staff.
- [X] T37 [P] Verify SC-009: time a representative order with `runPostOrderInventoryChecks` enabled vs commented-out. The completion latency delta should be within ±50 ms. If above, profile the aggregation pipeline (likely the `$lookup`) — do NOT remove the side effect.
- [X] T38 [P] Verify SC-010: walk every page of the application as admin and as staff (`/dashboard`, `/order`, `/inventory`, `/sales`, `/admin/menu`, `/customers`, `/waste`, `/report`, `/setting`). Bell appears on every page that uses the navbar. Sign in as customer; bell never appears.
- [X] T39 Final: run the migration script once against the dev database to ensure any pre-existing notifications from feature 003's spoilage cron are upgraded to the new schema:

  ```bash
  node Server/scripts/migrate-notifications.js
  ```

- [X] T40 Final: update the spec status from `Draft` to `Implemented` (one-line change to `specs/004-real-notification-system/spec.md` frontmatter).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies. Can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1. **Blocks all user stories.**
- **Phase 3 (US1)**: P1; depends on Phase 2 only.
- **Phase 4 (US2)**: P1; depends on Phase 2 only. Can run in parallel with US1 (different files).
- **Phase 5 (US3)**: P2; depends on **Phase 4** specifically (US3 extends the function added by T24). Cannot run before US2.
- **Phase 6 (US4)**: P2; depends on Phase 2 only. Can run in parallel with US1, US2, US3.
- **Phase 7 (US5)**: P3; depends on **Phase 6** (extends the orchestrator added by T26 / T29).
- **Phase 8 (Polish)**: Depends on all desired user stories being complete.

### Within each user story

- Component / page tasks marked `[P]` can be built in parallel since they live in different files.
- The page or hook that imports them is built last in each story.
- Backend changes specific to a story (T24, T28, T29, T30, T31) are sequential within their phase.

### Parallel opportunities (after Phase 2 completes)

```
Developer A: T16 → T17 → T18 → T19 → T20  (US1 Bell)
Developer B: T21, T22 → T23 → T24 → T25 → T26  (US2 Stock + Expiry + Detail Routes)
Developer C: T29 → T30  (US4 Cron — recipe path + timezone)
```

T27 → T28 (US3) waits on T24. T31 → T32 (US5) waits on T26. T33+ (Polish) waits on everything.

---

## Implementation Strategy

### Recommended MVP path

1. Phase 1 → Phase 2 (Setup + Foundational). **No detours.**
2. Phase 3 (US1 — Bell) is the cleanest standalone P1 story to validate the foundational layer end-to-end. Run `quickstart.md` §1 and stop to confirm.
3. Phase 4 (US2 — Stock + Expiry) — the core operational value of the feature.
4. Phase 5–7 (US3, US4, US5) in any order subject to the cross-phase dependencies above.
5. Phase 8 (Polish). The quickstart pass is the acceptance gate.

### Parallel team strategy

After Phase 2 completes, US1 / US2 / US4 can run in parallel by different developers; US3 and US5 fold in once their predecessors land. Each pair shares no files, so merge conflicts are minimal.

---

## Notes

- **No new npm dependencies.** `node-cron` is already installed; the bell uses only `react-icons` and `react-router-dom` already on the frontend.
- **Optimistic concurrency is NOT used here.** Notifications are append-only with monotonic per-role flag flips; concurrent "Mark all read" by two admins is idempotent (FR-008). Do NOT add a `version` field.
- **Dedup lives in one place.** `notification.service.createAlert` is the single source of truth for the 24h rule (research.md Decision 11). Call sites pass `relatedEntity` and trust the service. Do not re-implement dedup on call sites.
- **State machines, not flag soup.** `useNotifications` exposes a single `pageState` and `listState`. The bell never juggles separate `loading` / `error` / `data` booleans. This matches feature 003's hard rule.
- **No fabricated data on AI failure.** When `aiService.generateRecipe` fails, the `spoilage_risk` notification ships without a recipe AND a `spoilage_recipe_failed` notification is created. Never synthesize a placeholder recipe (FR-004 / FR-021).
- **Manual verification is the acceptance gate.** Automated tests are P5 scope. The quickstart pass is what closes this feature.
- **Commit after each task.** Small, traceable commits make the cheaper-LLM workflow safer.
