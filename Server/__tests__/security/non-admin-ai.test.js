// Spec FR-004 + node-api.openapi.yaml: every admin-only AI route must
// return 403 to a non-admin (customer or staff) JWT.

jest.mock('../../src/middlewares/auth.middleware', () => ({
    protect: (req, res, next) => {
        const raw = req.headers['x-test-user'];
        if (raw) {
            try { req.user = JSON.parse(raw); } catch (e) {}
        }
        if (!req.user) {
            return res.status(401).json({ error: { code: 'unauthenticated' } });
        }
        next();
    }
}));
jest.mock('../../src/application/services/audit.service', () => ({
    recordInference: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../../src/infrastructure/ml/ml-client', () => ({
    post: jest.fn(),
    get: jest.fn()
}));

const request = require('supertest');
const express = require('express');
const aiRoutes = require('../../src/routes/ai.routes');
const pricingRoutes = require('../../src/routes/pricing.routes');

const CUSTOMER_TOK = JSON.stringify({ _id: 'c'.repeat(24), role: 'customer' });
const STAFF_TOK    = JSON.stringify({ _id: 'b'.repeat(24), role: 'staff' });
const DISH = 'a'.repeat(24);

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/ai/pricing', pricingRoutes);
    app.use('/api/v1/ai', aiRoutes);
    return app;
}

const adminOnlyRoutes = [
    { method: 'post',   url: '/api/v1/ai/forecast',                     body: { dishId: DISH, daysAhead: 7 } },
    // Note: POST /api/v1/ai/recipe is intentionally NOT admin-only — staff and
    // customers may generate recipes. Publishing to the menu and reading
    // customer favourites stay staff/admin only (covered by ai.recipe.test.js).
    { method: 'get',    url: '/api/v1/ai/market-basket' },
    { method: 'get',    url: '/api/v1/ai/health' },
    { method: 'post',   url: '/api/v1/ai/pricing/suggest' },
    { method: 'post',   url: '/api/v1/ai/pricing/apply',                body: { dishId: DISH, newPrice: 10, confidence: 0.7 } },
    { method: 'post',   url: '/api/v1/ai/pricing/revert',               body: { priceHistoryId: 'a'.repeat(24) } },
    { method: 'get',    url: `/api/v1/ai/pricing/history/${DISH}` }
];

describe('Admin-only AI routes reject non-admin tokens', () => {
    test.each(adminOnlyRoutes)('%s %s → 403 for customer JWT', async ({ method, url, body }) => {
        const r = request(makeApp())[method](url).set('x-test-user', CUSTOMER_TOK);
        const res = await (body ? r.send(body) : r);
        expect(res.status).toBe(403);
    });

    test.each(adminOnlyRoutes)('%s %s → 403 for staff JWT', async ({ method, url, body }) => {
        const r = request(makeApp())[method](url).set('x-test-user', STAFF_TOK);
        const res = await (body ? r.send(body) : r);
        expect(res.status).toBe(403);
    });
});
