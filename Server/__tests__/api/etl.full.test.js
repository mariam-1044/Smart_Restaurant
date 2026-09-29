const request = require('supertest');
const express = require('express');
const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const { seedUser } = require('../helpers/seedUser');
const { authedRequest } = require('../helpers/authedRequest');

jest.mock('../../src/application/services/etl.service', () => ({
  runAnalyticsPipeline: jest.fn().mockResolvedValue({
    timestamp: new Date(),
    aiReadyData: {
      forecasting: {},
      associationRules: [],
      inventoryOptimization: [],
      menuPerformance: []
    },
    financials: { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 },
    inventoryStatus: { lowStock: [], nearExpiry: [], expired: [] },
    menuPerformance: [],
    salesTrends: [{ period: '2026-01-01', revenue: 100 }],
    wasteAnalytics: { totalWasteQuantity: 0, wastePercentage: 0 }
  })
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/etl', require('../../src/routes/etl.routes'));
  return app;
}

describe('ETL API (full)', () => {
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

  describe('GET /api/etl/report', () => {
    test('admin can access analytics report', async () => {
      const res = await adminAgent.get('/api/etl/report');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/etl/export', () => {
    test('admin can export CSV', async () => {
      const res = await adminAgent.get('/api/etl/export');
      expect(res.status).toBe(200);
    });
  });

  describe('Access control', () => {
    test('staff gets 403 on ETL report', async () => {
      const res = await staffAgent.get('/api/etl/report');
      expect(res.status).toBe(403);
    });

    test('staff gets 403 on ETL export', async () => {
      const res = await staffAgent.get('/api/etl/export');
      expect(res.status).toBe(403);
    });

    test('customer gets 403 on ETL report', async () => {
      const customer = await seedUser({ role: 'customer' });
      const customerAgent = authedRequest(app, customer);
      const res = await customerAgent.get('/api/etl/report');
      expect(res.status).toBe(403);
    });

    test('no token returns 401 on ETL report', async () => {
      const res = await request(app).get('/api/etl/report');
      expect(res.status).toBe(401);
    });

    test('no token returns 401 on ETL export', async () => {
      const res = await request(app).get('/api/etl/export');
      expect(res.status).toBe(401);
    });
  });
});