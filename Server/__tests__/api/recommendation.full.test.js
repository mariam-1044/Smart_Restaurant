const request = require('supertest');
const express = require('express');
const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const { seedUser } = require('../helpers/seedUser');
const { authedRequest } = require('../helpers/authedRequest');
const { errorHandler } = require('../../src/middlewares/error.middleware');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/recommendations', require('../../src/routes/recommendation.routes'));
  app.use(errorHandler);
  return app;
}

describe('Recommendation API (full)', () => {
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

  describe('GET /api/v1/recommendations/:customerId', () => {
    test('admin can get recommendations for any customer', async () => {
      const res = await adminAgent.get(`/api/v1/recommendations/${customer._id}`);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    test('staff can get recommendations for any customer', async () => {
      const res = await staffAgent.get(`/api/v1/recommendations/${customer._id}`);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    test('customer can get their own recommendations', async () => {
      const res = await customerAgent.get(`/api/v1/recommendations/${customer._id}`);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    test('customer cannot access another customer recommendations', async () => {
      const otherCustomer = await seedUser({ role: 'customer' });
      const otherAgent = authedRequest(app, otherCustomer);
      const res = await otherAgent.get(`/api/v1/recommendations/${customer._id}`);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/recommendations/:customerId/rate', () => {
    test('customer can rate their own recommendation', async () => {
      const res = await customerAgent
        .post(`/api/v1/recommendations/${customer._id}/rate`)
        .send({ dishId: 'a'.repeat(24), score: 4 });
      expect(res.status).not.toBe(401);
    });

    test('staff cannot rate (assertOwnCustomerOnly)', async () => {
      const res = await staffAgent
        .post(`/api/v1/recommendations/${customer._id}/rate`)
        .send({ dishId: 'a'.repeat(24), score: 4 });
      expect(res.status).toBe(403);
    });

    test('admin cannot rate (assertOwnCustomerOnly)', async () => {
      const res = await adminAgent
        .post(`/api/v1/recommendations/${customer._id}/rate`)
        .send({ dishId: 'a'.repeat(24), score: 4 });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/recommendations/:customerId/publish', () => {
    test('only the customer can publish endorsement', async () => {
      const res = await customerAgent
        .post(`/api/v1/recommendations/${customer._id}/publish`)
        .send({ dishId: 'a'.repeat(24) });
      expect(res.status).not.toBe(401);
    });

    test('staff gets 403 on publish', async () => {
      const res = await staffAgent
        .post(`/api/v1/recommendations/${customer._id}/publish`)
        .send({ dishId: 'a'.repeat(24) });
      expect(res.status).toBe(403);
    });

    test('admin gets 403 on publish', async () => {
      const res = await adminAgent
        .post(`/api/v1/recommendations/${customer._id}/publish`)
        .send({ dishId: 'a'.repeat(24) });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/recommendations/:customerId/publish/:dishId', () => {
    test('customer can unpublish their own endorsement', async () => {
      const dishId = 'b'.repeat(24);
      const res = await customerAgent
        .delete(`/api/v1/recommendations/${customer._id}/publish/${dishId}`);
      expect(res.status).not.toBe(401);
    });

    test('staff gets 403 on unpublish', async () => {
      const dishId = 'b'.repeat(24);
      const res = await staffAgent
        .delete(`/api/v1/recommendations/${customer._id}/publish/${dishId}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Auth enforcement', () => {
    test('no token returns 401 on GET', async () => {
      const res = await request(app).get(`/api/v1/recommendations/${customer._id}`);
      expect(res.status).toBe(401);
    });

    test('no token returns 401 on POST rate', async () => {
      const res = await request(app)
        .post(`/api/v1/recommendations/${customer._id}/rate`)
        .send({ dishId: 'a'.repeat(24), score: 4 });
      expect(res.status).toBe(401);
    });

    test('no token returns 401 on POST publish', async () => {
      const res = await request(app)
        .post(`/api/v1/recommendations/${customer._id}/publish`)
        .send({ dishId: 'a'.repeat(24) });
      expect(res.status).toBe(401);
    });

    test('no token returns 401 on DELETE unpublish', async () => {
      const res = await request(app)
        .delete(`/api/v1/recommendations/${customer._id}/publish/${'a'.repeat(24)}`);
      expect(res.status).toBe(401);
    });
  });
});