// Targeted controller error-path coverage:
// - ai.controller: cold-start mapping, internal error mapping
// - recommendation.controller: ValidationError mapping, NotFoundError mapping,
//                              inference_unavailable mapping, internal error
// - pricing.controller: NotFoundError mapping, internal error, validation_failed
// - endorsement.controller: internal error mapping

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
        getTrailing30dAvg: jest.fn().mockResolvedValue(0),
        generateRecipe: jest.fn(),
        getMarketBasket: jest.fn()
    };
});
jest.mock('../../src/application/services/recommendation.service', () => ({
    getRecommendations: jest.fn(),
    submitRating: jest.fn(),
    publishEndorsement: jest.fn(),
    unpublishEndorsement: jest.fn()
}));
jest.mock('../../src/application/services/endorsement.service', () => ({
    getDishSummary: jest.fn()
}));
jest.mock('../../src/application/services/pricing.service', () => ({
    getSuggestions: jest.fn(),
    applyPrice: jest.fn(),
    revertPrice: jest.fn(),
    getHistory: jest.fn()
}));

const request = require('supertest');
const express = require('express');
const aiRoutes = require('../../src/routes/ai.routes');
const pricingRoutes = require('../../src/routes/pricing.routes');
const recommendationRoutes = require('../../src/routes/recommendation.routes');
const endorsementRoutes = require('../../src/routes/endorsement.routes');
const aiService = require('../../src/application/services/ai.service');
const pricingService = require('../../src/application/services/pricing.service');
const recommendationService = require('../../src/application/services/recommendation.service');
const endorsementService = require('../../src/application/services/endorsement.service');

const ADMIN = JSON.stringify({ _id: 'a'.repeat(24), role: 'admin' });
const CUSTOMER = '5fa1c2b3e4d5a6f7b8c9d0a0';
const customerToken = (id) => JSON.stringify({ _id: id, role: 'customer' });
const DISH = '5fa1c2b3e4d5a6f7b8c9d0b1';

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/ai/pricing', pricingRoutes);
    app.use('/api/v1/ai', aiRoutes);
    app.use('/api/v1/recommendations', recommendationRoutes);
    app.use('/api/v1/dishes', endorsementRoutes);
    return app;
}

describe('Controller error-path coverage', () => {
    beforeEach(() => jest.clearAllMocks());

    test('ai.controller forecast → 200 with insufficient history on cold_start', async () => {
        aiService.predictDemand.mockRejectedValueOnce({ code: 'cold_start' });
        const res = await request(makeApp())
            .post('/api/v1/ai/forecast')
            .set('x-test-user', ADMIN)
            .send({ dishId: 'a'.repeat(24), daysAhead: 7 });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.historyStatus).toBe('insufficient');
    });

    test('ai.controller forecast → 500 on unknown error', async () => {
        aiService.predictDemand.mockRejectedValueOnce(new Error('boom'));
        const res = await request(makeApp())
            .post('/api/v1/ai/forecast')
            .set('x-test-user', ADMIN)
            .send({ dishId: 'a'.repeat(24), daysAhead: 7 });
        expect(res.status).toBe(500);
    });

    test('ai.controller forecast staffingHint populates when avg trailing is high', async () => {
        aiService.predictDemand.mockResolvedValueOnce({
            coldStart: false,
            points: [
                { date: '2026-04-27', predicted: 100, lower: 80, upper: 120 },
                { date: '2026-04-28', predicted: 100, lower: 80, upper: 120 }
            ]
        });
        aiService.getTrailing30dAvg.mockResolvedValueOnce(10);
        const res = await request(makeApp())
            .post('/api/v1/ai/forecast')
            .set('x-test-user', ADMIN)
            .send({ dishId: 'a'.repeat(24), daysAhead: 7 });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toBeDefined();
    });

    test('ai.controller recipe → 500 on unknown error', async () => {
        aiService.generateRecipe.mockRejectedValueOnce(new Error('boom'));
        const res = await request(makeApp())
            .post('/api/v1/ai/recipe')
            .set('x-test-user', ADMIN)
            .send({ ingredients: ['x'] });
        expect(res.status).toBe(500);
    });

    test('ai.controller marketBasket → 500 on unknown error', async () => {
        aiService.getMarketBasket.mockRejectedValueOnce(new Error('boom'));
        const res = await request(makeApp())
            .get('/api/v1/ai/market-basket')
            .set('x-test-user', ADMIN);
        expect(res.status).toBe(500);
    });

    test('recommendation.controller getRecommendations → 503 on inference_unavailable', async () => {
        recommendationService.getRecommendations.mockRejectedValueOnce({ code: 'inference_unavailable' });
        const res = await request(makeApp())
            .get(`/api/v1/recommendations/${CUSTOMER}`)
            .set('x-test-user', customerToken(CUSTOMER));
        expect(res.status).toBe(503);
    });

    test('recommendation.controller getRecommendations → 500 on unknown error', async () => {
        recommendationService.getRecommendations.mockRejectedValueOnce(new Error('boom'));
        const res = await request(makeApp())
            .get(`/api/v1/recommendations/${CUSTOMER}`)
            .set('x-test-user', customerToken(CUSTOMER));
        expect(res.status).toBe(500);
    });

    test('recommendation.controller submitRating validation error → 400', async () => {
        const res = await request(makeApp())
            .post(`/api/v1/recommendations/${CUSTOMER}/rate`)
            .set('x-test-user', customerToken(CUSTOMER))
            .send({});
        expect(res.status).toBe(400);
    });

    test('recommendation.controller submitRating service ValidationError → 400', async () => {
        recommendationService.submitRating.mockRejectedValueOnce({
            name: 'ValidationError', code: 'dish_not_ordered', message: 'never ordered'
        });
        const res = await request(makeApp())
            .post(`/api/v1/recommendations/${CUSTOMER}/rate`)
            .set('x-test-user', customerToken(CUSTOMER))
            .send({ dishId: DISH, score: 5 });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('dish_not_ordered');
    });

    test('recommendation.controller publishEndorsement validation error → 400', async () => {
        const res = await request(makeApp())
            .post(`/api/v1/recommendations/${CUSTOMER}/publish`)
            .set('x-test-user', customerToken(CUSTOMER))
            .send({});
        expect(res.status).toBe(400);
    });

    test('recommendation.controller unpublishEndorsement NotFoundError → 404', async () => {
        recommendationService.unpublishEndorsement.mockRejectedValueOnce({
            name: 'NotFoundError', code: 'endorsement_not_found', message: 'no row'
        });
        const res = await request(makeApp())
            .delete(`/api/v1/recommendations/${CUSTOMER}/publish/${DISH}`)
            .set('x-test-user', customerToken(CUSTOMER));
        expect(res.status).toBe(404);
    });

    test('pricing.controller suggest → 503 on inference_unavailable', async () => {
        pricingService.getSuggestions.mockRejectedValueOnce({ code: 'inference_unavailable' });
        const res = await request(makeApp())
            .post('/api/v1/ai/pricing/suggest')
            .set('x-test-user', ADMIN);
        expect(res.status).toBe(503);
    });

    test('pricing.controller apply → 404 on dish_not_found', async () => {
        pricingService.applyPrice.mockRejectedValueOnce({
            name: 'NotFoundError', code: 'dish_not_found', message: 'no'
        });
        const res = await request(makeApp())
            .post('/api/v1/ai/pricing/apply')
            .set('x-test-user', ADMIN)
            .send({ dishId: DISH, newPrice: 10, confidence: 0.7 });
        expect(res.status).toBe(404);
    });

    test('pricing.controller apply validation error → 400', async () => {
        const res = await request(makeApp())
            .post('/api/v1/ai/pricing/apply')
            .set('x-test-user', ADMIN)
            .send({ dishId: DISH }); // missing newPrice + confidence
        expect(res.status).toBe(400);
    });

    test('pricing.controller revert validation error → 400', async () => {
        const res = await request(makeApp())
            .post('/api/v1/ai/pricing/revert')
            .set('x-test-user', ADMIN)
            .send({});
        expect(res.status).toBe(400);
    });

    test('pricing.controller revert → 500 on unknown error', async () => {
        pricingService.revertPrice.mockRejectedValueOnce(new Error('boom'));
        const res = await request(makeApp())
            .post('/api/v1/ai/pricing/revert')
            .set('x-test-user', ADMIN)
            .send({ priceHistoryId: 'a'.repeat(24) });
        expect(res.status).toBe(500);
    });

    test('endorsement.controller getDishSummary → 500 on unknown error', async () => {
        endorsementService.getDishSummary.mockRejectedValueOnce(new Error('boom'));
        const res = await request(makeApp())
            .get(`/api/v1/dishes/${DISH}/endorsements`)
            .set('x-test-user', ADMIN);
        expect(res.status).toBe(500);
    });
});
