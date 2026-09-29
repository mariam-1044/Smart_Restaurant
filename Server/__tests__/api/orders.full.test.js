const request = require('supertest');
const express = require('express');
const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const { seedUser } = require('../helpers/seedUser');
const { authedRequest } = require('../helpers/authedRequest');
const Dish = require('../../src/domain/models/Dish');
const Ingredient = require('../../src/domain/models/Ingredient');
const Customer = require('../../src/domain/models/Customer');
const { errorHandler } = require('../../src/middlewares/error.middleware');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/orders', require('../../src/routes/order.routes'));
  app.use(errorHandler);
  return app;
}

describe('Orders API (full)', () => {
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

  describe('POST /api/orders (create order)', () => {
    test('customer can create an order', async () => {
      const ingredient = await Ingredient.create({
        name: 'Tomato',
        quantity: 100,
        unit: 'kg',
        minStock: 10,
        costPerUnit: 5,
        expiryDate: new Date(Date.now() + 30 * 86400000)
      });
      const dish = await Dish.create({
        name: 'Order Pizza',
        price: 15,
        category: 'Pizza',
        isAvailable: true,
        ingredients: [{ ingredient: ingredient._id, quantity: 1 }]
      });
      const res = await customerAgent
        .post('/api/orders')
        .send({
          items: [{ dish: dish._id.toString(), quantity: 2 }],
          source: 'Online',
          paymentMethod: 'Cash'
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeDefined();
    });

    test('rejects order with non-existent dish', async () => {
      const fakeDishId = 'a'.repeat(24);
      const res = await customerAgent
        .post('/api/orders')
        .send({
          items: [{ dish: fakeDishId, quantity: 1 }],
          source: 'Online',
          paymentMethod: 'Cash'
        });
      expect(res.status).toBe(400);
      expect(res.body.cause).toBe('dish');
    });

    test('rejects order with unavailable dish', async () => {
      const dish = await Dish.create({
        name: 'Unavailable Pizza',
        price: 15,
        category: 'Pizza',
        isAvailable: false
      });
      const res = await customerAgent
        .post('/api/orders')
        .send({
          items: [{ dish: dish._id.toString(), quantity: 1 }],
          source: 'Online',
          paymentMethod: 'Cash'
        });
      expect(res.status).toBe(400);
    });

    test('no token returns 401', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({ items: [], source: 'Online' });
      expect(res.status).toBe(401);
    });

    test('rejects order with empty items', async () => {
      const res = await customerAgent
        .post('/api/orders')
        .send({ items: [], source: 'Online' });
      expect(res.status).toBe(400);
    });

    test('ingredient stock deducted after order', async () => {
      const ingredient = await Ingredient.create({
        name: 'Deduct Tomato',
        quantity: 50,
        unit: 'kg',
        minStock: 5,
        costPerUnit: 3,
        expiryDate: new Date(Date.now() + 30 * 86400000)
      });
      const dish = await Dish.create({
        name: 'Deduct Pizza',
        price: 12,
        category: 'Pizza',
        isAvailable: true,
        ingredients: [{ ingredient: ingredient._id, quantity: 2 }]
      });
      await customerAgent
        .post('/api/orders')
        .send({
          items: [{ dish: dish._id.toString(), quantity: 3 }],
          source: 'Online',
          paymentMethod: 'Cash'
        });
      const updated = await Ingredient.findById(ingredient._id);
      expect(updated.quantity).toBe(50 - 2 * 3);
    });
  });

  describe('GET /api/orders (admin/staff)', () => {
    test('admin can list orders', async () => {
      const res = await adminAgent.get('/api/orders');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('staff can list orders', async () => {
      const res = await staffAgent.get('/api/orders');
      expect(res.status).toBe(200);
    });

    test('customer gets 403 on list orders', async () => {
      const res = await customerAgent.get('/api/orders');
      expect(res.status).toBe(403);
    });

    test('no token returns 401', async () => {
      const res = await request(app).get('/api/orders');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/orders/:id', () => {
    test('admin can get order by id', async () => {
      const ingredient = await Ingredient.create({
        name: 'GetOrder Tomato',
        quantity: 50,
        unit: 'kg',
        minStock: 5,
        costPerUnit: 3,
        expiryDate: new Date(Date.now() + 30 * 86400000)
      });
      const dish = await Dish.create({
        name: 'GetOrder Pizza',
        price: 15,
        category: 'Pizza',
        isAvailable: true,
        ingredients: [{ ingredient: ingredient._id, quantity: 1 }]
      });
      const createRes = await adminAgent
        .post('/api/orders')
        .send({
          items: [{ dish: dish._id.toString(), quantity: 1 }],
          source: 'POS'
        });
      const orderId = createRes.body.data._id;
      const res = await adminAgent.get(`/api/orders/${orderId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('staff can get order by id', async () => {
      const ingredient = await Ingredient.create({
        name: 'StaffOrder Tomato',
        quantity: 50,
        unit: 'kg',
        minStock: 5,
        costPerUnit: 3,
        expiryDate: new Date(Date.now() + 30 * 86400000)
      });
      const dish = await Dish.create({
        name: 'StaffOrder Pizza',
        price: 15,
        category: 'Pizza',
        isAvailable: true,
        ingredients: [{ ingredient: ingredient._id, quantity: 1 }]
      });
      const createRes = await staffAgent
        .post('/api/orders')
        .send({
          items: [{ dish: dish._id.toString(), quantity: 1 }],
          source: 'POS'
        });
      const orderId = createRes.body.data._id;
      const res = await staffAgent.get(`/api/orders/${orderId}`);
      expect(res.status).toBe(200);
    });

    test('customer gets 403 on get order by id', async () => {
      const fakeId = 'a'.repeat(24);
      const res = await customerAgent.get(`/api/orders/${fakeId}`);
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/orders/:id', () => {
    test('admin can update order status', async () => {
      const ingredient = await Ingredient.create({
        name: 'PatchOrder Tomato',
        quantity: 50,
        unit: 'kg',
        minStock: 5,
        costPerUnit: 3,
        expiryDate: new Date(Date.now() + 30 * 86400000)
      });
      const dish = await Dish.create({
        name: 'PatchOrder Pizza',
        price: 15,
        category: 'Pizza',
        isAvailable: true,
        ingredients: [{ ingredient: ingredient._id, quantity: 1 }]
      });
      const createRes = await adminAgent
        .post('/api/orders')
        .send({
          items: [{ dish: dish._id.toString(), quantity: 1 }],
          source: 'POS'
        });
      const orderId = createRes.body.data._id;
      const res = await adminAgent
        .patch(`/api/orders/${orderId}`)
        .send({ status: 'preparing' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('staff can update order status', async () => {
      const ingredient = await Ingredient.create({
        name: 'StaffPatch Tomato',
        quantity: 50,
        unit: 'kg',
        minStock: 5,
        costPerUnit: 3,
        expiryDate: new Date(Date.now() + 30 * 86400000)
      });
      const dish = await Dish.create({
        name: 'StaffPatch Pizza',
        price: 15,
        category: 'Pizza',
        isAvailable: true,
        ingredients: [{ ingredient: ingredient._id, quantity: 1 }]
      });
      const createRes = await staffAgent
        .post('/api/orders')
        .send({
          items: [{ dish: dish._id.toString(), quantity: 1 }],
          source: 'POS'
        });
      const orderId = createRes.body.data._id;
      const res = await staffAgent
        .patch(`/api/orders/${orderId}`)
        .send({ status: 'completed' });
      expect(res.status).toBe(200);
    });

    test('customer gets 403 on update order', async () => {
      const fakeId = 'a'.repeat(24);
      const res = await customerAgent
        .patch(`/api/orders/${fakeId}`)
        .send({ status: 'preparing' });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/orders/:id', () => {
    test('admin can delete an order', async () => {
      const ingredient = await Ingredient.create({
        name: 'DeleteOrder Tomato',
        quantity: 50,
        unit: 'kg',
        minStock: 5,
        costPerUnit: 3,
        expiryDate: new Date(Date.now() + 30 * 86400000)
      });
      const dish = await Dish.create({
        name: 'DeleteOrder Pizza',
        price: 15,
        category: 'Pizza',
        isAvailable: true,
        ingredients: [{ ingredient: ingredient._id, quantity: 1 }]
      });
      const createRes = await adminAgent
        .post('/api/orders')
        .send({
          items: [{ dish: dish._id.toString(), quantity: 1 }],
          source: 'POS'
        });
      const orderId = createRes.body.data._id;
      const res = await adminAgent.delete(`/api/orders/${orderId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('staff can delete an order', async () => {
      const ingredient = await Ingredient.create({
        name: 'StaffDelete Tomato',
        quantity: 50,
        unit: 'kg',
        minStock: 5,
        costPerUnit: 3,
        expiryDate: new Date(Date.now() + 30 * 86400000)
      });
      const dish = await Dish.create({
        name: 'StaffDelete Pizza',
        price: 15,
        category: 'Pizza',
        isAvailable: true,
        ingredients: [{ ingredient: ingredient._id, quantity: 1 }]
      });
      const createRes = await staffAgent
        .post('/api/orders')
        .send({
          items: [{ dish: dish._id.toString(), quantity: 1 }],
          source: 'POS'
        });
      const orderId = createRes.body.data._id;
      const res = await staffAgent.delete(`/api/orders/${orderId}`);
      expect(res.status).toBe(200);
    });

    test('customer gets 403 on delete order', async () => {
      const fakeId = 'a'.repeat(24);
      const res = await customerAgent.delete(`/api/orders/${fakeId}`);
      expect(res.status).toBe(403);
    });

    test('no token returns 401 on delete', async () => {
      const fakeId = 'a'.repeat(24);
      const res = await request(app).delete(`/api/orders/${fakeId}`);
      expect(res.status).toBe(401);
    });
  });
});