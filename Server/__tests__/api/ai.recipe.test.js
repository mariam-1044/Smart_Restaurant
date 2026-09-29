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
// The recipe controller now delegates persistence + lifecycle to recipe.service;
// mock it so these route tests don't need a live database.
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

const request = require('supertest');
const express = require('express');
const aiRoutes = require('../../src/routes/ai.routes');
const recipeService = require('../../src/application/services/recipe.service');

const ADMIN = JSON.stringify({ _id: 'a'.repeat(24), role: 'admin' });
const STAFF = JSON.stringify({ _id: 'b'.repeat(24), role: 'staff' });
const CUSTOMER = JSON.stringify({ _id: 'c'.repeat(24), role: 'customer' });

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/ai', aiRoutes);
    return app;
}

describe('POST /api/v1/ai/recipe', () => {
    const VALID_BODY = { ingredients: ['tomato', 'basil', 'mozzarella'], style: 'Italian', creativity: 7 };

    beforeEach(() => jest.clearAllMocks());

    test('admin + valid body → 200 with persisted recipe shape', async () => {
        recipeService.generateAndSave.mockResolvedValueOnce({
            _id: 'd'.repeat(24),
            name: 'Caprese',
            description: '...',
            steps: ['s1'],
            ingredients: [{ name: 'tomato', quantity: 100, unit: 'g' }],
            estimatedCost: 3,
            suggestedPrice: 10,
            profitMargin: 70,
            status: 'draft'
        });
        const res = await request(makeApp())
            .post('/api/v1/ai/recipe')
            .set('x-test-user', ADMIN)
            .send(VALID_BODY);
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Caprese');
        expect(recipeService.generateAndSave).toHaveBeenCalledWith(
            expect.objectContaining({ ingredients: VALID_BODY.ingredients, creativity: 7 })
        );
    });

    test('"creativity" + "favoriteIngredients" in body are accepted (not rejected by validation)', async () => {
        recipeService.generateAndSave.mockResolvedValueOnce({ _id: 'd'.repeat(24), name: 'Dish', ingredients: [] });
        const res = await request(makeApp())
            .post('/api/v1/ai/recipe')
            .set('x-test-user', STAFF)
            .send({ ingredients: ['eggplant'], creativity: 9, favoriteIngredients: ['truffle'] });
        expect(res.status).toBe(200);
    });

    test('empty ingredients → 400 validation_failed', async () => {
        const res = await request(makeApp())
            .post('/api/v1/ai/recipe')
            .set('x-test-user', ADMIN)
            .send({ ingredients: [] });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('validation_failed');
    });

    test('staff + valid body → 200 (staff may generate)', async () => {
        recipeService.generateAndSave.mockResolvedValueOnce({ _id: 'd'.repeat(24), name: 'Staff Dish', ingredients: [] });
        const res = await request(makeApp())
            .post('/api/v1/ai/recipe')
            .set('x-test-user', STAFF)
            .send(VALID_BODY);
        expect(res.status).toBe(200);
    });

    test('customer + valid body → 200 (customer may generate)', async () => {
        recipeService.generateAndSave.mockResolvedValueOnce({ _id: 'd'.repeat(24), name: 'Customer Dish', ingredients: [] });
        const res = await request(makeApp())
            .post('/api/v1/ai/recipe')
            .set('x-test-user', CUSTOMER)
            .send(VALID_BODY);
        expect(res.status).toBe(200);
    });

    test('unauthenticated → 401', async () => {
        const res = await request(makeApp())
            .post('/api/v1/ai/recipe')
            .send(VALID_BODY);
        expect(res.status).toBe(401);
    });

    test('upstream provider failure → 502 upstream_provider_failed', async () => {
        recipeService.generateAndSave.mockRejectedValueOnce({
            code: 'upstream_provider_failed',
            reason: 'malformed_payload'
        });
        const res = await request(makeApp())
            .post('/api/v1/ai/recipe')
            .set('x-test-user', ADMIN)
            .send(VALID_BODY);
        expect(res.status).toBe(502);
        expect(res.body.error.code).toBe('upstream_provider_failed');
    });
});

describe('recipe lifecycle routes', () => {
    const CUSTOMER_ = JSON.stringify({ _id: 'c'.repeat(24), role: 'customer' });
    const STAFF_ = JSON.stringify({ _id: 'b'.repeat(24), role: 'staff' });
    const ADMIN_ = JSON.stringify({ _id: 'a'.repeat(24), role: 'admin' });

    beforeEach(() => jest.clearAllMocks());

    test('GET /api/v1/ai/recipes → 200 list', async () => {
        recipeService.listForUser.mockResolvedValueOnce([{ _id: 'r'.repeat(24), name: 'R1' }]);
        const res = await request(makeApp())
            .get('/api/v1/ai/recipes?limit=5')
            .set('x-test-user', CUSTOMER_);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(1);
    });

    test('DELETE /api/v1/ai/recipes/:id → 200', async () => {
        recipeService.deleteForUser.mockResolvedValueOnce(true);
        const res = await request(makeApp())
            .delete(`/api/v1/ai/recipes/${'r'.repeat(24)}`)
            .set('x-test-user', CUSTOMER_);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('POST /api/v1/ai/recipes/:id/publish as customer → 403 (route guard, service not called)', async () => {
        const res = await request(makeApp())
            .post(`/api/v1/ai/recipes/${'r'.repeat(24)}/publish`)
            .set('x-test-user', CUSTOMER_)
            .send({ price: 20 });
        expect(res.status).toBe(403);
        expect(recipeService.publishToMenu).not.toHaveBeenCalled();
    });

    test('POST /api/v1/ai/recipes/:id/publish as staff → 201', async () => {
        recipeService.publishToMenu.mockResolvedValueOnce({ dish: { _id: 'x'.repeat(24), name: 'New Dish' }, recipe: {} });
        const res = await request(makeApp())
            .post(`/api/v1/ai/recipes/${'r'.repeat(24)}/publish`)
            .set('x-test-user', STAFF_)
            .send({ price: 20, category: 'Main' });
        expect(res.status).toBe(201);
        expect(res.body.data.dish.name).toBe('New Dish');
    });

    test('GET /api/v1/ai/customer-favorites as staff → 200', async () => {
        recipeService.customerFavoriteIngredients.mockResolvedValueOnce([{ name: 'truffle', count: 2 }]);
        const res = await request(makeApp())
            .get('/api/v1/ai/customer-favorites')
            .set('x-test-user', STAFF_);
        expect(res.status).toBe(200);
        expect(res.body.data[0].name).toBe('truffle');
    });

    test('GET /api/v1/ai/customer-favorites as customer → 403', async () => {
        const res = await request(makeApp())
            .get('/api/v1/ai/customer-favorites')
            .set('x-test-user', CUSTOMER_);
        expect(res.status).toBe(403);
    });

    test('GET /api/v1/ai/recommendations (insights) as admin → 200', async () => {
        const res = await request(makeApp())
            .get('/api/v1/ai/recommendations')
            .set('x-test-user', ADMIN_);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });
});
