const request = require('supertest');
const express = require('express');
const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const { seedUser } = require('../helpers/seedUser');
const { authedRequest } = require('../helpers/authedRequest');
const Ingredient = require('../../src/domain/models/Ingredient');
const { errorHandler } = require('../../src/middlewares/error.middleware');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/inventory', require('../../src/routes/inventory.routes'));
  app.use(errorHandler);
  return app;
}

describe('Inventory API (full)', () => {
  withInMemoryMongo();

  let app, admin, staff, customer, adminAgent, staffAgent, customerAgent;

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
    app = buildApp();
  });

  beforeEach(async () => {
    admin = await seedUser({ role: 'admin' });
    staff = await seedUser({ role: 'staff' });
    customer = await seedUser({ role: 'customer' });
    adminAgent = authedRequest(app, admin);
    staffAgent = authedRequest(app, staff);
    customerAgent = authedRequest(app, customer);
  });

  async function seedIngredient(overrides = {}) {
    return Ingredient.create({
      name: 'Ingredient-' + Math.random().toString(36).slice(2, 8),
      quantity: 100,
      unit: 'kg',
      minStock: 10,
      costPerUnit: 5,
      expiryDate: new Date(Date.now() + 30 * 86400000),
      ...overrides
    });
  }

  describe('GET /api/inventory', () => {
    test('admin can list ingredients', async () => {
      await seedIngredient({ name: 'List Tomato' });
      const res = await adminAgent.get('/api/inventory');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
    });

    test('staff can list ingredients', async () => {
      const res = await staffAgent.get('/api/inventory');
      expect(res.status).toBe(200);
    });

    test('customer gets 403', async () => {
      const res = await customerAgent.get('/api/inventory');
      expect(res.status).toBe(403);
    });

    test('no token returns 401', async () => {
      const res = await request(app).get('/api/inventory');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/inventory/:id', () => {
    test('admin can get ingredient by id', async () => {
      const ing = await seedIngredient({ name: 'Get Tomato' });
      const res = await adminAgent.get(`/api/inventory/${ing._id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Get Tomato');
    });

    test('staff can get ingredient by id', async () => {
      const ing = await seedIngredient({ name: 'Staff Get Tomato' });
      const res = await staffAgent.get(`/api/inventory/${ing._id}`);
      expect(res.status).toBe(200);
    });

    test('returns 404 for non-existent id', async () => {
      const fakeId = 'a'.repeat(24);
      const res = await adminAgent.get(`/api/inventory/${fakeId}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/inventory (admin only)', () => {
    test('admin can create ingredient', async () => {
      const res = await adminAgent
        .post('/api/inventory')
        .send({
          name: 'New Tomato',
          quantity: 50,
          unit: 'kg',
          minStock: 5,
          costPerUnit: 3,
          expiryDate: new Date(Date.now() + 30 * 86400000).toISOString()
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New Tomato');
    });

    test('staff gets 403 on create', async () => {
      const res = await staffAgent
        .post('/api/inventory')
        .send({
          name: 'Staff Tomato',
          quantity: 10,
          unit: 'kg',
          minStock: 2,
          costPerUnit: 1,
          expiryDate: new Date(Date.now() + 30 * 86400000).toISOString()
        });
      expect(res.status).toBe(403);
    });

    test('customer gets 403 on create', async () => {
      const res = await customerAgent
        .post('/api/inventory')
        .send({
          name: 'Cust Tomato',
          quantity: 10,
          unit: 'kg',
          minStock: 2,
          costPerUnit: 1,
          expiryDate: new Date(Date.now() + 30 * 86400000).toISOString()
        });
      expect(res.status).toBe(403);
    });

    test('no token returns 401 on create', async () => {
      const res = await request(app)
        .post('/api/inventory')
        .send({ name: 'NoAuth Tomato', quantity: 10, unit: 'kg', minStock: 2, costPerUnit: 1 });
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/inventory/:id (admin only)', () => {
    test('admin can update ingredient', async () => {
      const ing = await seedIngredient({ name: 'Update Tomato', quantity: 50 });
      const res = await adminAgent
        .patch(`/api/inventory/${ing._id}`)
        .send({ quantity: 75 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quantity).toBe(75);
    });

    test('staff gets 403 on update', async () => {
      const ing = await seedIngredient({ name: 'Staff Update Tomato' });
      const res = await staffAgent
        .patch(`/api/inventory/${ing._id}`)
        .send({ quantity: 99 });
      expect(res.status).toBe(403);
    });

    test('update non-existent returns 404', async () => {
      const fakeId = 'a'.repeat(24);
      const res = await adminAgent
        .patch(`/api/inventory/${fakeId}`)
        .send({ quantity: 99 });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/inventory/:id (admin only)', () => {
    test('admin can delete ingredient', async () => {
      const ing = await seedIngredient({ name: 'Delete Tomato' });
      const res = await adminAgent.delete(`/api/inventory/${ing._id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('staff gets 403 on delete', async () => {
      const ing = await seedIngredient({ name: 'Staff Del Tomato' });
      const res = await staffAgent.delete(`/api/inventory/${ing._id}`);
      expect(res.status).toBe(403);
    });

    test('no token returns 401 on delete', async () => {
      const ing = await seedIngredient({ name: 'NoAuth Del Tomato' });
      const res = await request(app).delete(`/api/inventory/${ing._id}`);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/inventory/alerts', () => {
    test('admin can get alerts', async () => {
      const res = await adminAgent.get('/api/inventory/alerts');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    test('staff can get alerts', async () => {
      const res = await staffAgent.get('/api/inventory/alerts');
      expect(res.status).toBe(200);
    });

    test('customer gets 403', async () => {
      const res = await customerAgent.get('/api/inventory/alerts');
      expect(res.status).toBe(403);
    });

    test('no token returns 401', async () => {
      const res = await request(app).get('/api/inventory/alerts');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/inventory/low-stock', () => {
    test('returns low-stock ingredients', async () => {
      await seedIngredient({ name: 'LowStock Tomato', quantity: 1, minStock: 10 });
      const res = await adminAgent.get('/api/inventory/low-stock');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('staff can view low-stock', async () => {
      const res = await staffAgent.get('/api/inventory/low-stock');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/inventory/near-expiry', () => {
    test('returns near-expiry ingredients', async () => {
      await seedIngredient({
        name: 'NearExpiry Tomato',
        expiryDate: new Date(Date.now() + 2 * 86400000)
      });
      const res = await adminAgent.get('/api/inventory/near-expiry?days=7');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('no token returns 401', async () => {
      const res = await request(app).get('/api/inventory/near-expiry');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/inventory/export', () => {
    test('admin can export CSV', async () => {
      await seedIngredient({ name: 'Export Tomato' });
      const res = await adminAgent.get('/api/inventory/export');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
    });

    test('staff can export CSV', async () => {
      const res = await staffAgent.get('/api/inventory/export');
      expect(res.status).toBe(200);
    });

    test('customer gets 403', async () => {
      const res = await customerAgent.get('/api/inventory/export');
      expect(res.status).toBe(403);
    });

    test('no token returns 401', async () => {
      const res = await request(app).get('/api/inventory/export');
      expect(res.status).toBe(401);
    });
  });
});