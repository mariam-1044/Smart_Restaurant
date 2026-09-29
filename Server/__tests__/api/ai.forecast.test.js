jest.mock('../../src/infrastructure/ml/ml-client', () => ({
    post: jest.fn(),
    get: jest.fn()
}));
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
jest.mock('../../src/domain/models/Dish', () => ({
    findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({ name: 'Test Dish' })
        })
    })
}));
jest.mock('../../src/domain/models/Order', () => ({
    aggregate: jest.fn().mockResolvedValue([])
}));
jest.mock('../../src/application/services/ai.service', () => {
    const real = jest.requireActual('../../src/application/services/ai.service');
    return {
        ...real,
        predictDemand: jest.fn(),
        getTrailing30dAvg: jest.fn().mockResolvedValue(0)
    };
});

const request = require('supertest');
const express = require('express');
const aiRoutes = require('../../src/routes/ai.routes');
const aiService = require('../../src/application/services/ai.service');
const mlClient = require('../../src/infrastructure/ml/ml-client');

const ADMIN = JSON.stringify({ _id: 'a'.repeat(24), role: 'admin' });
const STAFF = JSON.stringify({ _id: 'b'.repeat(24), role: 'staff' });

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/ai', aiRoutes);
    return app;
}

describe('POST /api/v1/ai/forecast', () => {
    const VALID = { dishId: 'a'.repeat(24), daysAhead: 7 };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('admin + valid body → 200 with ForecastResponse shape', async () => {
        aiService.predictDemand.mockResolvedValueOnce({
            coldStart: false,
            points: [{ date: '2026-04-27', predicted: 10, lower: 5, upper: 15 }]
        });
        const res = await request(makeApp())
            .post('/api/v1/ai/forecast')
            .set('x-test-user', ADMIN)
            .send(VALID);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toMatchObject({
            dishId: VALID.dishId,
            daysAhead: 7
        });
        expect(Array.isArray(res.body.data.forecast)).toBe(true);
    });

    test('staff token → 403', async () => {
        const res = await request(makeApp())
            .post('/api/v1/ai/forecast')
            .set('x-test-user', STAFF)
            .send(VALID);
        expect(res.status).toBe(403);
    });

    test('no token → 401', async () => {
        const res = await request(makeApp())
            .post('/api/v1/ai/forecast')
            .send(VALID);
        expect(res.status).toBe(401);
    });

    test('invalid daysAhead → 400 validation_failed', async () => {
        const res = await request(makeApp())
            .post('/api/v1/ai/forecast')
            .set('x-test-user', ADMIN)
            .send({ dishId: 'a'.repeat(24), daysAhead: 14 });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('validation_failed');
    });

    test('ML cold_start → 200 with insufficient history', async () => {
        aiService.predictDemand.mockRejectedValueOnce({ code: 'cold_start' });
        const res = await request(makeApp())
            .post('/api/v1/ai/forecast')
            .set('x-test-user', ADMIN)
            .send(VALID);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.historyStatus).toBe('insufficient');
        expect(res.body.data.forecast).toEqual([]);
        expect(res.body.data.coldStartReason).toBeDefined();
    });

    test('ML service down → 503 inference_unavailable', async () => {
        aiService.predictDemand.mockRejectedValueOnce({
            code: 'inference_unavailable',
            cause: new Error('ECONNREFUSED')
        });
        const res = await request(makeApp())
            .post('/api/v1/ai/forecast')
            .set('x-test-user', ADMIN)
            .send(VALID);
        expect(res.status).toBe(503);
        expect(res.body.error.code).toBe('inference_unavailable');
    });
});
