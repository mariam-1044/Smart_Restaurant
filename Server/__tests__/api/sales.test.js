const request = require('supertest');
const express = require('express');
const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const { seedUser } = require('../helpers/seedUser');
const { authedRequest } = require('../helpers/authedRequest');
const { errorHandler } = require('../../src/middlewares/error.middleware');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/sales', require('../../src/routes/sales.routes'));
  app.use(errorHandler);
  return app;
}

describe('Sales API', () => {
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

  describe('GET /api/sales/report', () => {
    test('admin can access sales report', async () => {
      const res = await adminAgent.get('/api/sales/report?period=daily');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    test('admin can request weekly report', async () => {
      const res = await adminAgent.get('/api/sales/report?period=weekly');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('admin can request monthly report', async () => {
      const res = await adminAgent.get('/api/sales/report?period=monthly');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('defaults to daily when period is not specified', async () => {
      const res = await adminAgent.get('/api/sales/report');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Access control', () => {
    test('staff gets 403 on sales report', async () => {
      const res = await staffAgent.get('/api/sales/report?period=daily');
      expect(res.status).toBe(403);
    });

    test('customer gets 403 on sales report', async () => {
      const customer = await seedUser({ role: 'customer' });
      const customerAgent = authedRequest(app, customer);
      const res = await customerAgent.get('/api/sales/report?period=daily');
      expect(res.status).toBe(403);
    });

    test('no token returns 401', async () => {
      const res = await request(app).get('/api/sales/report?period=daily');
      expect(res.status).toBe(401);
    });
  });
});