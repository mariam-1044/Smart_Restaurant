const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const { createAlert, listForRole, unreadCountForRole, markRead, markAllRead } = require('../../src/application/services/notification.service');
const Notification = require('../../src/domain/models/Notification');

describe('Notification Service', () => {
  withInMemoryMongo();

  test('createAlert persists a notification', async () => {
    const alert = await createAlert({ type: 'low_stock', title: 'Low: Tomato', message: 'Below minStock', targetRole: 'admin' });
    expect(alert).toMatchObject({ type: 'low_stock', readByAdmin: false, targetRole: 'admin' });
    const fromDb = await Notification.findById(alert._id);
    expect(fromDb).not.toBeNull();
  });

  test('createAlert with relatedEntity deduplicates within 24h', async () => {
    const entityId = new (require('mongoose').Types.ObjectId)();
    const first = await createAlert({ type: 'low_stock', title: 'Low', message: 'msg', targetRole: 'admin', relatedEntity: entityId, entityModel: 'Ingredient' });
    const second = await createAlert({ type: 'low_stock', title: 'Low', message: 'msg', targetRole: 'admin', relatedEntity: entityId, entityModel: 'Ingredient' });
    expect(second._id.toString()).toBe(first._id.toString());
    expect(second.lastSeenAt).not.toEqual(first.createdAt);
  });

  test('createAlert rejects invalid type', async () => {
    await expect(createAlert({ type: 'invalid_type', title: 'Bad', message: 'msg', targetRole: 'admin' })).rejects.toThrow();
  });

  test('listForRole returns items for admin', async () => {
    await createAlert({ type: 'low_stock', title: 'A1', message: 'm', targetRole: 'admin' });
    const result = await listForRole('admin');
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.items[0].read).toBe(false);
  });

  test('listForRole excludes admin-only notifications for staff', async () => {
    await createAlert({ type: 'low_stock', title: 'Admin only', message: 'm', targetRole: 'admin' });
    const result = await listForRole('staff');
    expect(result.items.every(i => i.targetRole !== 'admin' || i.targetRole === 'all')).toBe(true);
  });

  test('unreadCountForRole returns count of unread', async () => {
    await createAlert({ type: 'expiry', title: 'Expiring', message: 'm', targetRole: 'staff' });
    const count = await unreadCountForRole('staff');
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('markRead marks notification as read for admin', async () => {
    const alert = await createAlert({ type: 'system', title: 'Test', message: 'm', targetRole: 'admin' });
    const result = await markRead(alert._id.toString(), 'admin');
    expect(result.ok).toBe(true);
    expect(result.doc.read).toBe(true);
    expect(result.doc.readAt).toBeInstanceOf(Date);
  });

  test('markRead returns notFound for nonexistent id', async () => {
    const fakeId = new (require('mongoose').Types.ObjectId)();
    const result = await markRead(fakeId.toString(), 'admin');
    expect(result.notFound).toBe(true);
  });

  test('markRead returns forbidden for wrong role', async () => {
    const alert = await createAlert({ type: 'low_stock', title: 'T', message: 'm', targetRole: 'staff' });
    const result = await markRead(alert._id.toString(), 'admin');
    expect(result.forbidden).toBe(true);
  });

  test('markAllRead marks all notifications for role', async () => {
    await createAlert({ type: 'system', title: 'B1', message: 'm', targetRole: 'admin' });
    await createAlert({ type: 'system', title: 'B2', message: 'm', targetRole: 'admin' });
    const result = await markAllRead('admin');
    expect(result.modifiedCount).toBeGreaterThanOrEqual(2);
  });
});