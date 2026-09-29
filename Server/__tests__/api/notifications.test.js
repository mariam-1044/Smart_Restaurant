const request = require('supertest');
const express = require('express');
const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const { seedUser } = require('../helpers/seedUser');
const { authedRequest } = require('../helpers/authedRequest');
const Notification = require('../../src/domain/models/Notification');
const { errorHandler } = require('../../src/middlewares/error.middleware');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/notifications', require('../../src/routes/notification.routes'));
  app.use(errorHandler);
  return app;
}

describe('Notifications API', () => {
  withInMemoryMongo();

  let app, admin, staff, adminAgent, staffAgent;

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
    app = buildApp();
  });

  beforeEach(async () => {
    admin = await seedUser({ role: 'admin' });
    staff = await seedUser({ role: 'staff' });
    adminAgent = authedRequest(app, admin);
    staffAgent = authedRequest(app, staff);
  });

  describe('GET /api/notifications', () => {
    test('returns 200 with notifications for admin', async () => {
      await Notification.create({
        type: 'low_stock',
        title: 'Low Stock Alert',
        message: 'Tomato is running low',
        targetRole: 'admin'
      });
      const res = await adminAgent.get('/api/notifications');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].title).toBe('Low Stock Alert');
    });

    test('staff sees staff and all-targeted notifications', async () => {
      await Notification.create([
        { type: 'low_stock', title: 'Admin Only', message: 'm1', targetRole: 'admin' },
        { type: 'system', title: 'Staff Note', message: 'm2', targetRole: 'staff' },
        { type: 'system', title: 'Everyone', message: 'm3', targetRole: 'all' }
      ]);
      const res = await staffAgent.get('/api/notifications');
      expect(res.status).toBe(200);
      const titles = res.body.data.items.map(n => n.title);
      expect(titles).not.toContain('Admin Only');
      expect(titles).toContain('Staff Note');
      expect(titles).toContain('Everyone');
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    test('returns correct unread count', async () => {
      await Notification.create([
        { type: 'low_stock', title: 'A1', message: 'm1', targetRole: 'admin', readByAdmin: false },
        { type: 'system', title: 'A2', message: 'm2', targetRole: 'admin', readByAdmin: true }
      ]);
      const res = await adminAgent.get('/api/notifications/unread-count');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(1);
    });
  });

  describe('PATCH /api/notifications/:id/read', () => {
    test('marks a notification as read for admin', async () => {
      const notif = await Notification.create({
        type: 'low_stock',
        title: 'Unread',
        message: 'm1',
        targetRole: 'admin',
        readByAdmin: false
      });
      const res = await adminAgent.patch(`/api/notifications/${notif._id}/read`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.read).toBe(true);
    });

    test('returns 404 for non-existent notification', async () => {
      const fakeId = 'a'.repeat(24);
      const res = await adminAgent.patch(`/api/notifications/${fakeId}/read`);
      expect(res.status).toBe(404);
    });

    test('staff cannot mark admin-only notification as read', async () => {
      const notif = await Notification.create({
        type: 'low_stock',
        title: 'Admin Only',
        message: 'm1',
        targetRole: 'admin'
      });
      const res = await staffAgent.patch(`/api/notifications/${notif._id}/read`);
      expect(res.status).toBe(403);
      expect(res.body.errorType).toBe('cross_role_forbidden');
    });
  });

  describe('PATCH /api/notifications/read-all', () => {
    test('marks all notifications as read for role', async () => {
      await Notification.create([
        { type: 'low_stock', title: 'N1', message: 'm1', targetRole: 'admin', readByAdmin: false },
        { type: 'system', title: 'N2', message: 'm2', targetRole: 'all', readByAdmin: false }
      ]);
      const res = await adminAgent.patch('/api/notifications/read-all');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.modifiedCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Auth enforcement', () => {
    test('no token returns 401', async () => {
      const res = await request(app).get('/api/notifications');
      expect(res.status).toBe(401);
    });

    test('customer role cannot access notifications', async () => {
      const customer = await seedUser({ role: 'customer' });
      const customerAgent = authedRequest(app, customer);
      const res = await customerAgent.get('/api/notifications');
      expect(res.status).toBe(403);
    });
  });
});