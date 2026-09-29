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
jest.mock('../../src/application/services/recommendation.service', () => ({
    getRecommendations: jest.fn(),
    submitRating: jest.fn(),
    publishEndorsement: jest.fn(),
    unpublishEndorsement: jest.fn()
}));
jest.mock('../../src/application/services/endorsement.service', () => ({
    getDishSummary: jest.fn()
}));

const request = require('supertest');
const express = require('express');
const recommendationRoutes = require('../../src/routes/recommendation.routes');
const endorsementRoutes = require('../../src/routes/endorsement.routes');
const recommendationService = require('../../src/application/services/recommendation.service');
const endorsementService = require('../../src/application/services/endorsement.service');

const CUSTOMER_A = '5fa1c2b3e4d5a6f7b8c9d0a0';
const CUSTOMER_B = '5fa1c2b3e4d5a6f7b8c9d0a1';
const DISH = '5fa1c2b3e4d5a6f7b8c9d0b1';

const customerToken = (id) => JSON.stringify({ _id: id, role: 'customer' });
const ADMIN = JSON.stringify({ _id: 'a'.repeat(24), role: 'admin' });

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/recommendations', recommendationRoutes);
    app.use('/api/v1/dishes', endorsementRoutes);
    return app;
}

describe('Recommendations + Endorsements API', () => {
    beforeEach(() => jest.clearAllMocks());

    test('cross-customer GET → 403 cross_customer_forbidden', async () => {
        const res = await request(makeApp())
            .get(`/api/v1/recommendations/${CUSTOMER_B}`)
            .set('x-test-user', customerToken(CUSTOMER_A));
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('cross_customer_forbidden');
    });

    test('customer-self GET → 200 + RecommendationSet', async () => {
        recommendationService.getRecommendations.mockResolvedValueOnce({
            customerId: CUSTOMER_A,
            recommendations: [{ dishId: DISH, score: 0.9, reason: 'sim' }],
            coldStart: false,
            basis: 'collaborative',
            recommendationContextId: 'ctx-1'
        });
        const res = await request(makeApp())
            .get(`/api/v1/recommendations/${CUSTOMER_A}`)
            .set('x-test-user', customerToken(CUSTOMER_A));
        expect(res.status).toBe(200);
        expect(res.body.basis).toBe('collaborative');
    });

    test('admin GET on any customer → 200', async () => {
        recommendationService.getRecommendations.mockResolvedValueOnce({
            customerId: CUSTOMER_B,
            recommendations: [],
            coldStart: true,
            basis: 'popularity_fallback',
            recommendationContextId: 'ctx-2'
        });
        const res = await request(makeApp())
            .get(`/api/v1/recommendations/${CUSTOMER_B}`)
            .set('x-test-user', ADMIN);
        expect(res.status).toBe(200);
    });

    test('rate < 4 then publish → 400 rating_below_threshold', async () => {
        recommendationService.publishEndorsement.mockRejectedValueOnce({
            name: 'ValidationError', code: 'rating_below_threshold', message: 'needs ≥4'
        });
        const res = await request(makeApp())
            .post(`/api/v1/recommendations/${CUSTOMER_A}/publish`)
            .set('x-test-user', customerToken(CUSTOMER_A))
            .send({ dishId: DISH });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('rating_below_threshold');
    });

    test('rate ≥ 4 then publish → 201', async () => {
        recommendationService.publishEndorsement.mockResolvedValueOnce({ _id: 'p1' });
        const res = await request(makeApp())
            .post(`/api/v1/recommendations/${CUSTOMER_A}/publish`)
            .set('x-test-user', customerToken(CUSTOMER_A))
            .send({ dishId: DISH });
        expect(res.status).toBe(201);
        expect(res.body.ok).toBe(true);
    });

    test('staff cannot rate (assertOwnCustomerOnly) → 403', async () => {
        const STAFF = JSON.stringify({ _id: 'b'.repeat(24), role: 'staff' });
        const res = await request(makeApp())
            .post(`/api/v1/recommendations/${CUSTOMER_A}/rate`)
            .set('x-test-user', STAFF)
            .send({ dishId: DISH, score: 5 });
        expect(res.status).toBe(403);
    });

    test('DELETE /publish/:dishId → 204', async () => {
        recommendationService.unpublishEndorsement.mockResolvedValueOnce({ _id: 'p1' });
        const res = await request(makeApp())
            .delete(`/api/v1/recommendations/${CUSTOMER_A}/publish/${DISH}`)
            .set('x-test-user', customerToken(CUSTOMER_A));
        expect(res.status).toBe(204);
    });

    test('public endorsement summary contains zero PII', async () => {
        endorsementService.getDishSummary.mockResolvedValueOnce({
            dishId: DISH,
            count: 1,
            average: 5,
            recent: [{ handle: 'Diner #abcd', score: 5, publishedAt: new Date() }]
        });
        const res = await request(makeApp())
            .get(`/api/v1/dishes/${DISH}/endorsements`)
            .set('x-test-user', ADMIN);
        expect(res.status).toBe(200);
        const text = JSON.stringify(res.body);
        expect(text).not.toContain('email');
        expect(text).not.toContain('phone');
        expect(text).not.toMatch(/customerId/);
    });
});
