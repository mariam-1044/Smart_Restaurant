const request = require('supertest');
const express = require('express');
const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const { seedUser } = require('../helpers/seedUser');
const { authedRequest } = require('../helpers/authedRequest');
const Dish = require('../../src/domain/models/Dish');
const { errorHandler } = require('../../src/middlewares/error.middleware');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/dishes', require('../../src/routes/endorsement.routes'));
  app.use(errorHandler);
  return app;
}

describe('Endorsement API', () => {
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

  describe('GET /api/v1/dishes/:dishId/endorsements', () => {
    test('returns endorsement summary for valid dish', async () => {
      const dish = await Dish.create({
        name: 'Test Pizza',
        price: 12.99,
        category: 'Pizza',
        isAvailable: true
      });
      const res = await adminAgent.get(`/api/v1/dishes/${dish._id}/endorsements`);
      expect(res.status).toBe(200);
    });

    test('staff can view endorsement summary', async () => {
      const dish = await Dish.create({
        name: 'Staff Pizza',
        price: 10.99,
        category: 'Pizza',
        isAvailable: true
      });
      const res = await staffAgent.get(`/api/v1/dishes/${dish._id}/endorsements`);
      expect(res.status).toBe(200);
    });

    test('customer can view endorsement summary', async () => {
      const customer = await seedUser({ role: 'customer' });
      const customerAgent = authedRequest(app, customer);
      const dish = await Dish.create({
        name: 'Customer Pizza',
        price: 9.99,
        category: 'Pizza',
        isAvailable: true
      });
      const res = await customerAgent.get(`/api/v1/dishes/${dish._id}/endorsements`);
      expect(res.status).toBe(200);
    });
  });

  describe('Auth enforcement', () => {
    test('no token returns 401', async () => {
      const dish = await Dish.create({
        name: 'NoAuth Pizza',
        price: 8.99,
        category: 'Pizza',
        isAvailable: true
      });
      const res = await request(app).get(`/api/v1/dishes/${dish._id}/endorsements`);
      expect(res.status).toBe(401);
    });
  });
});