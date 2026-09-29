const request = require('supertest');
const express = require('express');
const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const { seedUser } = require('../helpers/seedUser');
const { authedRequest } = require('../helpers/authedRequest');
const Customer = require('../../src/domain/models/Customer');
const { errorHandler } = require('../../src/middlewares/error.middleware');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/customers', require('../../src/routes/customer.routes'));
  app.use(errorHandler);
  return app;
}

describe('Customers API', () => {
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

  describe('GET /api/customers', () => {
    test('admin can list customers', async () => {
      await Customer.create({ name: 'Alice', phone: '01000000001' });
      const res = await adminAgent.get('/api/customers');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
    });

    test('staff can list customers', async () => {
      await Customer.create({ name: 'Bob', phone: '01000000002' });
      const res = await staffAgent.get('/api/customers');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('no token returns 401', async () => {
      const res = await request(app).get('/api/customers');
      expect(res.status).toBe(401);
    });

    test('customer role returns 403', async () => {
      const customer = await seedUser({ role: 'customer' });
      const customerAgent = authedRequest(app, customer);
      const res = await customerAgent.get('/api/customers');
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/customers/:id', () => {
    test('admin can get customer by id', async () => {
      const cust = await Customer.create({ name: 'Charlie', phone: '01000000003' });
      const res = await adminAgent.get(`/api/customers/${cust._id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Charlie');
    });

    test('no token returns 401', async () => {
      const cust = await Customer.create({ name: 'Dave', phone: '01000000004' });
      const res = await request(app).get(`/api/customers/${cust._id}`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/customers/profile', () => {
    test('creates customer profile by phone (no auth required)', async () => {
      const res = await request(app)
        .post('/api/customers/profile')
        .send({ phone: '01000000005', name: 'Eve' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customer.phone).toBe('01000000005');
    });

    test('returns 400 without phone', async () => {
      const res = await request(app)
        .post('/api/customers/profile')
        .send({ name: 'NoPhone' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/customers/order', () => {
    test('places an order without auth', async () => {
      const res = await request(app)
        .post('/api/customers/order')
        .send({
          customerName: 'Frank',
          customerPhone: '01000000006',
          items: [{ dish: 'a'.repeat(24), quantity: 1 }],
          paymentMethod: 'Cash'
        });
      expect(res.status).not.toBe(401);
    });
  });

  describe('GET /api/customers/recommendations/:phone', () => {
    test('gets recommendations by phone (no auth)', async () => {
      await Customer.create({ name: 'Grace', phone: '01000000007' });
      const res = await request(app).get('/api/customers/recommendations/01000000007');
      expect(res.status).not.toBe(401);
    });
  });

  describe('DELETE /api/customers/:id/favorites/:dishId', () => {
    const Dish = require('../../src/domain/models/Dish');

    async function customerWithTwoFavorites() {
      const d1 = await Dish.create({ name: 'Pizza', price: 12, category: 'Pizza', ingredients: [], isAvailable: true });
      const d2 = await Dish.create({ name: 'Burger', price: 8, category: 'Burgers', ingredients: [], isAvailable: true });
      const c = await Customer.create({
        name: 'Faye', phone: '01000000088',
        favorites: [{ dish: d1._id, count: 3 }, { dish: d2._id, count: 1 }],
        favoritesCount: 2
      });
      return { c, d1, d2 };
    }

    test('admin removes a favorite — dish & customer survive, count updates', async () => {
      const { c, d1, d2 } = await customerWithTwoFavorites();
      const res = await adminAgent.delete(`/api/customers/${c._id}/favorites/${d1._id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.favoritesCount).toBe(1);
      expect(await Dish.findById(d1._id)).toBeTruthy();
      const reloaded = await Customer.findById(c._id);
      expect(reloaded.favorites).toHaveLength(1);
      expect(String(reloaded.favorites[0].dish)).toBe(String(d2._id));
    });

    test('staff may also remove a favorite', async () => {
      const { c, d1 } = await customerWithTwoFavorites();
      const res = await staffAgent.delete(`/api/customers/${c._id}/favorites/${d1._id}`);
      expect(res.status).toBe(200);
    });

    test('customer token is forbidden', async () => {
      const { c, d1 } = await customerWithTwoFavorites();
      const customerAgent = authedRequest(app, await seedUser({ role: 'customer' }));
      const res = await customerAgent.delete(`/api/customers/${c._id}/favorites/${d1._id}`);
      expect(res.status).toBe(403);
    });

    test('missing customer → 404', async () => {
      const fakeId = new (require('mongoose').Types.ObjectId)();
      const res = await adminAgent.delete(`/api/customers/${fakeId}/favorites/${fakeId}`);
      expect(res.status).toBe(404);
    });

    test('no token → 401', async () => {
      const { c, d1 } = await customerWithTwoFavorites();
      const res = await request(app).delete(`/api/customers/${c._id}/favorites/${d1._id}`);
      expect(res.status).toBe(401);
    });
  });
});