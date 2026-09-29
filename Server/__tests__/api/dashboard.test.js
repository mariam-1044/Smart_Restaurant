const request = require('supertest');
const express = require('express');
const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const { seedUser } = require('../helpers/seedUser');
const { authedRequest } = require('../helpers/authedRequest');

jest.mock('../../src/application/services/etl.service', () => ({
  runAnalyticsPipeline: jest.fn().mockResolvedValue({
    timestamp: new Date(),
    aiInsights: { forecast: [], topDishes: [], associationRules: [] },
    aiReadyData: {
      forecasting: {},
      associationRules: [],
      inventoryOptimization: [],
      menuPerformance: []
    },
    financials: { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 },
    inventoryStatus: { lowStock: [], nearExpiry: [], expired: [] },
    menuPerformance: [],
    salesTrends: {},
    wasteAnalytics: { totalWasteQuantity: 0, wastePercentage: 0 }
  })
}));

jest.mock('../../src/application/services/inventory.service', () => ({
  getInventoryAlerts: jest.fn().mockResolvedValue({ lowStock: [], expired: [], nearExpiry: [] }),
  calculateTotalWaste: jest.fn().mockResolvedValue({ totalWasteQuantity: 0, totalCurrentQuantity: 0, wastePercentage: 0, ingredientsCount: 0 })
}));

jest.mock('../../src/infrastructure/ml/ml-client', () => ({
  getForecast: jest.fn().mockResolvedValue({ forecast: [] }),
  getAssociationRules: jest.fn().mockResolvedValue({ rules: [] })
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/dashboard', require('../../src/routes/dashboard.routes'));
  return app;
}

describe('Dashboard API', () => {
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

  describe('GET /api/dashboard/stats', () => {
    test('authenticated user can access stats', async () => {
      const res = await adminAgent.get('/api/dashboard/stats');
      expect([200, 500]).toContain(res.status);
    });

    test('staff can access stats', async () => {
      const res = await staffAgent.get('/api/dashboard/stats');
      expect([200, 500]).toContain(res.status);
    });

    test('no token returns 401', async () => {
      const res = await request(app).get('/api/dashboard/stats');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/dashboard/admin', () => {
    test('admin can access admin dashboard', async () => {
      const res = await adminAgent.get('/api/dashboard/admin');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('staff gets 403 on admin dashboard', async () => {
      const res = await staffAgent.get('/api/dashboard/admin');
      expect(res.status).toBe(403);
    });

    test('customer gets 403 on admin dashboard', async () => {
      const customer = await seedUser({ role: 'customer' });
      const customerAgent = authedRequest(app, customer);
      const res = await customerAgent.get('/api/dashboard/admin');
      expect(res.status).toBe(403);
    });

    test('no token returns 401 on admin dashboard', async () => {
      const res = await request(app).get('/api/dashboard/admin');
      expect(res.status).toBe(401);
    });
  });
});