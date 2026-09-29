const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const Notification = require('../../src/domain/models/Notification');

describe('Notification Model', () => {
  withInMemoryMongo();

  test('read flags default to false', async () => {
    const notif = await Notification.create({ type: 'low_stock', title: 'Test', message: 'msg', targetRole: 'admin' });
    expect(notif.readByAdmin).toBe(false);
    expect(notif.readByStaff).toBe(false);
  });

  test('targetRole enum rejects invalid value', async () => {
    await expect(Notification.create({ type: 'low_stock', title: 'T', message: 'm', targetRole: 'invalid_role' })).rejects.toThrow();
  });

  test('type enum accepts valid values', async () => {
    for (const t of ['low_stock', 'expiry', 'reorder', 'spoilage_risk', 'spoilage_recipe_failed', 'system']) {
      const n = await Notification.create({ type: t, title: `${t} notif`, message: 'm', targetRole: 'admin' });
      expect(n.type).toBe(t);
    }
  });

  test('relatedEntity and entityModel must be set together', async () => {
    await expect(Notification.create({ type: 'low_stock', title: 'T', message: 'm', targetRole: 'admin', relatedEntity: new (require('mongoose').Types.ObjectId)() })).rejects.toThrow();
  });
});