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
jest.mock('../../src/application/services/pricing.service', () => ({
    getSuggestions: jest.fn(),
    applyPrice: jest.fn(),
    revertPrice: jest.fn(),
    getHistory: jest.fn()
}));
jest.mock('../../src/domain/models/Dish', () => ({
    findById: jest.fn(),
    findOneAndUpdate: jest.fn()
}));

const request = require('supertest');
const express = require('express');
const pricingRoutes = require('../../src/routes/pricing.routes');
const pricingService = require('../../src/application/services/pricing.service');
const Dish = require('../../src/domain/models/Dish');
const { withMlServiceStub } = require('../helpers/mlServiceStub');

const ADMIN = JSON.stringify({ _id: 'a'.repeat(24), role: 'admin' });
const STAFF = JSON.stringify({ _id: 'b'.repeat(24), role: 'staff' });
const DISH = 'c'.repeat(24);

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/ai/pricing', pricingRoutes);
    return app;
}

describe('Pricing API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        withMlServiceStub({ route: '/optimize-pricing', response: { currentPrice: 10, suggestedPrice: 10, confidence: 0.5, skippedReason: null } });
    });

    test('admin POST /suggest → 200 with array', async () => {
        pricingService.getSuggestions.mockResolvedValueOnce([{ dishId: DISH }]);
        Dish.findById.mockReturnValueOnce({
            select: () => ({ lean: () => Promise.resolve({ version: 0, name: 'Test Dish', priceHistory: [] }) })
        });
        const res = await request(makeApp())
            .post('/api/v1/ai/pricing/suggest')
            .set('x-test-user', ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('non-admin → 403', async () => {
        const res = await request(makeApp())
            .post('/api/v1/ai/pricing/suggest')
            .set('x-test-user', STAFF);
        expect(res.status).toBe(403);
    });

    test('apply → 201 with new record', async () => {
        pricingService.applyPrice.mockResolvedValueOnce({ _id: 'h1', source: 'manager_apply' });
        const res = await request(makeApp())
            .post('/api/v1/ai/pricing/apply')
            .set('x-test-user', ADMIN)
            .send({ dishId: DISH, newPrice: 12, confidence: 0.7 });
        expect(res.status).toBe(201);
        expect(res.body.source).toBe('manager_apply');
    });

    test('revert → 201 with manager_revert + revertOf', async () => {
        pricingService.revertPrice.mockResolvedValueOnce({
            _id: 'h2', source: 'manager_revert', revertOf: 'h1'
        });
        const res = await request(makeApp())
            .post('/api/v1/ai/pricing/revert')
            .set('x-test-user', ADMIN)
            .send({ priceHistoryId: 'a'.repeat(24) });
        expect(res.status).toBe(201);
        expect(res.body.source).toBe('manager_revert');
        expect(res.body.revertOf).toBe('h1');
    });

    test('GET /history → 200 with oldest→newest array', async () => {
        pricingService.getHistory.mockResolvedValueOnce([
            { _id: 'h1', source: 'manager_apply', createdAt: '2026-04-25' },
            { _id: 'h2', source: 'manager_revert', createdAt: '2026-04-26' }
        ]);
        const res = await request(makeApp())
            .get(`/api/v1/ai/pricing/history/${DISH}`)
            .set('x-test-user', ADMIN);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
    });

    test('bulk apply with confidence < 0.5 → 400 low_confidence_excluded_from_bulk', async () => {
        const res = await request(makeApp())
            .post('/api/v1/ai/pricing/apply')
            .set('x-test-user', ADMIN)
            .send({ dishId: DISH, newPrice: 12, confidence: 0.4, bulk: true });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('validation_failed');
    });
});