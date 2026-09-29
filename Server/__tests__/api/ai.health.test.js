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
const mlClient = require('../../src/infrastructure/ml/ml-client');

const ADMIN = JSON.stringify({ _id: 'a'.repeat(24), role: 'admin' });

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/ai', aiRoutes);
    return app;
}

describe('GET /api/v1/ai/health', () => {
    beforeEach(() => jest.clearAllMocks());

    test('admin call returns 200 with required keys', async () => {
        mlClient.get.mockResolvedValueOnce({
            data: {
                status: 'ok',
                lastSuccessAt: '2026-04-26T13:42:11Z',
                modelsLoaded: { forecasting: 5, recommender: true, pricing: true }
            }
        });
        const res = await request(makeApp())
            .get('/api/v1/ai/health')
            .set('x-test-user', ADMIN);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            reachable: true,
            warm: true,
            lastSuccessAt: '2026-04-26T13:42:11Z'
        });
    });

    test('Python service down → 200 with reachable=false', async () => {
        mlClient.get.mockRejectedValueOnce({ code: 'inference_unavailable' });
        const res = await request(makeApp())
            .get('/api/v1/ai/health')
            .set('x-test-user', ADMIN);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ reachable: false, warm: false, lastSuccessAt: null });
    });
});
