// Spec FR-004(a)(b) + SC-011: any cross-customer attempt under
// /api/v1/recommendations/:customerId/* must return 403 cross_customer_forbidden.

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
    getRecommendations: jest.fn().mockResolvedValue({ recommendations: [] }),
    submitRating: jest.fn().mockResolvedValue({}),
    publishEndorsement: jest.fn().mockResolvedValue({ _id: 'p1' }),
    unpublishEndorsement: jest.fn().mockResolvedValue({})
}));

const request = require('supertest');
const express = require('express');
const recommendationRoutes = require('../../src/routes/recommendation.routes');

const CUSTOMER_A = '5fa1c2b3e4d5a6f7b8c9d0a0';
const CUSTOMER_B = '5fa1c2b3e4d5a6f7b8c9d0a1';
const DISH = '5fa1c2b3e4d5a6f7b8c9d0b1';
const tokenFor = (id) => JSON.stringify({ _id: id, role: 'customer' });

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/recommendations', recommendationRoutes);
    return app;
}

const cases = [
    { name: 'GET /:customerId',                 method: 'get',    path: `/${CUSTOMER_B}` },
    { name: 'POST /:customerId/rate',           method: 'post',   path: `/${CUSTOMER_B}/rate`,    body: { dishId: DISH, score: 5 } },
    { name: 'POST /:customerId/publish',        method: 'post',   path: `/${CUSTOMER_B}/publish`, body: { dishId: DISH } },
    { name: 'DELETE /:customerId/publish/:dishId', method: 'delete', path: `/${CUSTOMER_B}/publish/${DISH}` }
];

describe('Cross-customer access is forbidden', () => {
    test.each(cases)('$name → 403 cross_customer_forbidden', async ({ method, path, body }) => {
        const r = request(makeApp())[method](`/api/v1/recommendations${path}`)
            .set('x-test-user', tokenFor(CUSTOMER_A));
        const res = await (body ? r.send(body) : r);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('cross_customer_forbidden');
    });
});
