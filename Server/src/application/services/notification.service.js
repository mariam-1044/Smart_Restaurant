const Notification = require('../../domain/models/Notification');
const logger = require('../../infrastructure/config/logger');

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

async function createAlert({ type, title, message, targetRole = 'admin', relatedEntity = null, entityModel = null, payload = {} }) {
  const now = new Date();

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