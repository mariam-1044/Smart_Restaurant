const request = require('supertest');
const express = require('express');
const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const { seedUser } = require('../helpers/seedUser');
const { authedRequest } = require('../helpers/authedRequest');
const Dish = require('../../src/domain/models/Dish');
const Ingredient = require('../../src/domain/models/Ingredient');
const { errorHandler } = require('../../src/middlewares/error.middleware');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/menu', require('../../src/routes/menu.routes'));
  app.use(errorHandler);
  return app;
}

describe('Menu CRUD API', () => {
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

  describe('GET /api/menu (public)', () => {
    test('returns all dishes without auth', async () => {
      await Dish.create({ name: 'Public Pizza', price: 10, category: 'Pizza' });
      const res = await request(app).get('/api/menu');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
    });

    test('returns empty list when no dishes', async () => {
      const res = await request(app).get('/api/menu');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('GET /api/menu/:id (public)', () => {
    test('returns a single dish by id without auth', async () => {
      const dish = await Dish.create({ name: 'Detail Pizza', price: 15, category: 'Pizza' });
      const res = await request(app).get(`/api/menu/${dish._id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Detail Pizza');
    });

    test('returns 404 for non-existent dish', async () => {
      const fakeId = 'a'.repeat(24);
      const res = await request(app).get(`/api/menu/${fakeId}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/menu (admin only)', () => {
    test('admin can create a dish', async () => {
      const res = await adminAgent
        .post('/api/menu')
        .send({ name: 'New Dish', price: 12.99, category: 'Pizza' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New Dish');
    });

    test('staff gets 403 on create', async () => {
      const res = await staffAgent
        .post('/api/menu')
        .send({ name: 'Staff Dish', price: 9.99, category: 'Pizza' });
      expect(res.status).toBe(403);
    });

    test('no token returns 401 on create', async () => {
      const res = await request(app)
        .post('/api/menu')
        .send({ name: 'NoAuth Dish', price: 9.99, category: 'Pizza' });
      expect(res.status).toBe(401);
    });

    test('rejects dish without required fields', async () => {
      const res = await adminAgent
        .post('/api/menu')
        .send({ description: 'No name or price' });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/menu/:id (admin only)', () => {
    test('admin can update a dish', async () => {
      const dish = await Dish.create({ name: 'Update Me', price: 10, category: 'Pizza' });
      const res = await adminAgent
        .patch(`/api/menu/${dish._id}`)
        .send({ name: 'Updated Dish', __version: 0 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Dish');
    });

    test('staff gets 403 on update', async () => {
      const dish = await Dish.create({ name: 'Staff Update', price: 10, category: 'Pizza' });
      const res = await staffAgent
        .patch(`/api/menu/${dish._id}`)
        .send({ name: 'Nope', __version: 0 });
      expect(res.status).toBe(403);
    });

    test('version conflict returns 409', async () => {
      const dish = await Dish.create({ name: 'Conflict Dish', price: 10, category: 'Pizza' });
      const res = await adminAgent
        .patch(`/api/menu/${dish._id}`)
        .send({ name: 'Stale Update', __version: 99 });
      expect(res.status).toBe(409);
      expect(res.body.errorType).toBe('VERSION_CONFLICT');
    });

    test('update non-existent dish returns 404', async () => {
      const fakeId = 'a'.repeat(24);
      const res = await adminAgent
        .patch(`/api/menu/${fakeId}`)
        .send({ name: 'Ghost', __version: 0 });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/menu/:id (admin only)', () => {
    test('admin can delete a dish', async () => {
      const dish = await Dish.create({ name: 'Delete Me', price: 10, category: 'Pizza' });
      const res = await adminAgent
        .delete(`/api/menu/${dish._id}`)
        .send({ __version: 0 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('staff gets 403 on delete', async () => {
      const dish = await Dish.create({ name: 'Staff Delete', price: 10, category: 'Pizza' });
      const res = await staffAgent
        .delete(`/api/menu/${dish._id}`)
        .send({ __version: 0 });
      expect(res.status).toBe(403);
    });

    test('version conflict on delete returns 409', async () => {
      const dish = await Dish.create({ name: 'Conflict Delete', price: 10, category: 'Pizza' });
      const res = await adminAgent
        .delete(`/api/menu/${dish._id}`)
        .send({ __version: 99 });
      expect(res.status).toBe(409);
    });

    test('no token returns 401 on delete', async () => {
      const dish = await Dish.create({ name: 'NoAuth Delete', price: 10, category: 'Pizza' });
      const res = await request(app)
        .delete(`/api/menu/${dish._id}`)
        .send({ __version: 0 });
      expect(res.status).toBe(401);
    });
  });
});