// Spec FR-005 + SC-009: every AI route writes one AIInferenceAudit row
// with the correct capability, outcome=success, and a non-zero latencyMs.

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

jest.mock('../../src/application/services/ai.service', () => {
    const real = jest.requireActual('../../src/application/services/ai.service');
    return {
        ...real,
        predictDemand: jest.fn(),
        getTrailing30dAvg: jest.fn().mockResolvedValue(0),
        generateRecipe: jest.fn(),
        getMarketBasket: jest.fn(),
        health: jest.fn()
    };
});
jest.mock('../../src/application/services/pricing.service', () => ({
    getSuggestions: jest.fn(),
    applyPrice: jest.fn(),
    revertPrice: jest.fn(),
    getHistory: jest.fn()
}));
jest.mock('../../src/application/services/recipe.service', () => ({
    generateAndSave: jest.fn(),
    generatePersonalizedAndSave: jest.fn(),
    listForUser: jest.fn(),
    deleteForUser: jest.fn(),
    publishToMenu: jest.fn(),
    customerFavoriteIngredients: jest.fn()
}));
jest.mock('../../src/application/services/insights.service', () => ({
    getBusinessInsights: jest.fn().mockResolvedValue({ data: [], didYouKnow: null, generatedAt: 'now' })
}));

jest.mock('../../src/domain/models/Dish', () => {
    const chain = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({ name: 'TestDish' })
    };
    return {
        findById: jest.fn().mockReturnValue(chain),
        findOneAndUpdate: jest.fn()
    };
});
jest.mock('../../src/domain/models/Order', () => ({
    aggregate: jest.fn().mockResolvedValue([])
}));

const request = require('supertest');
const express = require('express');
const aiRoutes = require('../../src/routes/ai.routes');
const pricingRoutes = require('../../src/routes/pricing.routes');
const aiService = require('../../src/application/services/ai.service');
const pricingService = require('../../src/application/services/pricing.service');
const recipeService = require('../../src/application/services/recipe.service');
const auditService = require('../../src/application/services/audit.service');

const ADMIN = JSON.stringify({ _id: 'a'.repeat(24), role: 'admin' });
const DISH = 'b'.repeat(24);

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/ai/pricing', pricingRoutes);
    app.use('/api/v1/ai', aiRoutes);
    return app;
}

async function exerciseAndAssert(app, method, url, body, expectedCapability) {
    auditService.recordInference.mockClear();
    const r = request(app)[method](url).set('x-test-user', ADMIN);
    const res = await (body ? r.send(body) : r);
    expect(res.status).toBeLessThan(500);
    // Wait a microtask for res.on('finish') to fire.
    await new Promise((r2) => setImmediate(r2));
    const hits = auditService.recordInference.mock.calls.filter(
        (c) => c[0] && c[0].capability === expectedCapability
    );
    expect(hits.length).toBe(1);
    const row = hits[0][0];
    expect(row.outcome).toBe('success');
    expect(row.latencyMs).toBeGreaterThanOrEqual(0);
}

describe('AI routes write exactly one audit row per request', () => {
    let app;
    beforeAll(() => { app = makeApp(); });

    test('forecast capability', async () => {
        aiService.predictDemand.mockResolvedValue({ coldStart: false, points: [{ date: '2026-04-27', predicted: 1, lower: 0, upper: 2 }] });
        await exerciseAndAssert(app, 'post', '/api/v1/ai/forecast', { dishId: DISH, daysAhead: 7 }, 'forecast');
    });

    test('recipe capability', async () => {
        recipeService.generateAndSave.mockResolvedValue({ _id: 'r'.repeat(24), name: 'X', ingredients: [] });
        await exerciseAndAssert(app, 'post', '/api/v1/ai/recipe', { ingredients: ['x'] }, 'recipe');
    });

    test('market_basket_read capability', async () => {
        aiService.getMarketBasket.mockResolvedValue({ computedAt: null, rules: [], reason: 'not_yet_computed' });
        await exerciseAndAssert(app, 'get', '/api/v1/ai/market-basket', null, 'market_basket_read');
    });

    test('health capability', async () => {
        aiService.health.mockResolvedValue({ reachable: true, warm: false, lastSuccessAt: null });
        await exerciseAndAssert(app, 'get', '/api/v1/ai/health', null, 'health');
    });

    test('pricing_suggest capability', async () => {
        pricingService.getSuggestions.mockResolvedValue([]);
        await exerciseAndAssert(app, 'post', '/api/v1/ai/pricing/suggest', null, 'pricing_suggest');
    });

    test('pricing_apply capability', async () => {
        pricingService.applyPrice.mockResolvedValue({ _id: 'h1' });
        await exerciseAndAssert(app, 'post', '/api/v1/ai/pricing/apply', { dishId: DISH, newPrice: 10, confidence: 0.7 }, 'pricing_apply');
    });
});
