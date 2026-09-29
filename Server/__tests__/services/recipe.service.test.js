jest.mock('../../src/application/services/ai.service', () => ({
    generateRecipe: jest.fn()
}));

const mongoose = require('mongoose');
const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const aiService = require('../../src/application/services/ai.service');
const recipeService = require('../../src/application/services/recipe.service');
const GeneratedRecipe = require('../../src/domain/models/GeneratedRecipe');
const CustomerPreferences = require('../../src/domain/models/CustomerPreferences');
const Ingredient = require('../../src/domain/models/Ingredient');
const Dish = require('../../src/domain/models/Dish');

const ADMIN = { _id: new mongoose.Types.ObjectId(), role: 'admin' };
const STAFF = { _id: new mongoose.Types.ObjectId(), role: 'staff' };
const CUSTOMER_A = { _id: new mongoose.Types.ObjectId(), role: 'customer' };
const CUSTOMER_B = { _id: new mongoose.Types.ObjectId(), role: 'customer' };

const SAMPLE_RAW = {
    name: 'Caprese Stack',
    description: 'A light Italian stack.',
    prepTime: '15 min',
    difficulty: 'Easy',
    steps: ['Slice', 'Layer', 'Drizzle'],
    ingredients: [
        { name: 'tomato', quantity: 200, unit: 'g' },
        { name: 'mozzarella', quantity: 150, unit: 'g' }
    ],
    estimatedCost: 6,
    suggestedPrice: 18,
    profitMargin: 66
};

describe('recipe.service', () => {
    withInMemoryMongo();
    beforeEach(() => jest.clearAllMocks());

    describe('generateAndSave', () => {
        test('persists a GeneratedRecipe owned by the caller', async () => {
            aiService.generateRecipe.mockResolvedValueOnce(SAMPLE_RAW);
            const doc = await recipeService.generateAndSave({
                user: CUSTOMER_A,
                ingredients: ['tomato', 'mozzarella'],
                style: 'Italian',
                creativity: 7
            });
            expect(doc.name).toBe('Caprese Stack');
            expect(String(doc.generatedBy)).toBe(String(CUSTOMER_A._id));
            expect(doc.generatedByRole).toBe('customer');
            expect(doc.status).toBe('draft');
            const inDb = await GeneratedRecipe.findById(doc._id).lean();
            expect(inDb).toBeTruthy();
            expect(inDb.estimatedCost).toBe(6);
            expect(aiService.generateRecipe).toHaveBeenCalledWith(expect.objectContaining({ creativity: 7, style: 'Italian' }));
        });

        test('rejects empty ingredient list', async () => {
            await expect(recipeService.generateAndSave({ user: STAFF, ingredients: [] }))
                .rejects.toMatchObject({ name: 'RecipeServiceError', code: 'no_ingredients' });
            expect(aiService.generateRecipe).not.toHaveBeenCalled();
        });

        test('propagates upstream provider failures', async () => {
            aiService.generateRecipe.mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 'upstream_provider_failed', reason: 'malformed_payload' }));
            await expect(recipeService.generateAndSave({ user: STAFF, ingredients: ['x'] }))
                .rejects.toMatchObject({ code: 'upstream_provider_failed' });
        });
    });

    describe('generatePersonalizedAndSave', () => {
        test('uses in-stock ingredients and the caller preferences', async () => {
            await Ingredient.create([
                { name: 'chicken', quantity: 5, unit: 'kg', minStock: 1, costPerUnit: 80, expiryDate: new Date(Date.now() + 5 * 86400000) },
                { name: 'rice', quantity: 10, unit: 'kg', minStock: 2, costPerUnit: 20, expiryDate: new Date(Date.now() + 30 * 86400000) }
            ]);
            await CustomerPreferences.create({ user: CUSTOMER_A._id, cuisines: ['Middle Eastern'], spiceLevel: 'hot', favoriteIngredients: ['garlic'] });
            aiService.generateRecipe.mockResolvedValueOnce({ ...SAMPLE_RAW, name: 'Personalised Plate' });

            const doc = await recipeService.generatePersonalizedAndSave({ user: CUSTOMER_A });
            expect(doc.name).toBe('Personalised Plate');
            const callArg = aiService.generateRecipe.mock.calls[0][0];
            expect(callArg.ingredients).toEqual(expect.arrayContaining(['chicken', 'rice']));
            expect(callArg.favoriteIngredients).toEqual(['garlic']);
            expect(callArg.customerContext).toMatch(/Middle Eastern/);
        });

        test('throws when there is nothing in stock and no favourites', async () => {
            await expect(recipeService.generatePersonalizedAndSave({ user: CUSTOMER_B }))
                .rejects.toMatchObject({ code: 'no_ingredients' });
        });
    });

    describe('listForUser', () => {
        test('customers see only their own; admins see everything', async () => {
            aiService.generateRecipe.mockResolvedValue(SAMPLE_RAW);
            await recipeService.generateAndSave({ user: CUSTOMER_A, ingredients: ['tomato'] });
            await recipeService.generateAndSave({ user: CUSTOMER_B, ingredients: ['tomato'] });

            const aList = await recipeService.listForUser(CUSTOMER_A, 20);
            expect(aList).toHaveLength(1);
            expect(String(aList[0].generatedBy)).toBe(String(CUSTOMER_A._id));

            const adminList = await recipeService.listForUser(ADMIN, 20);
            expect(adminList).toHaveLength(2);
        });
    });

    describe('deleteForUser', () => {
        test('owner can delete a draft; non-owner customer cannot', async () => {
            aiService.generateRecipe.mockResolvedValueOnce(SAMPLE_RAW);
            const doc = await recipeService.generateAndSave({ user: CUSTOMER_A, ingredients: ['tomato'] });

            await expect(recipeService.deleteForUser(CUSTOMER_B, doc._id))
                .rejects.toMatchObject({ code: 'forbidden' });

            const ok = await recipeService.deleteForUser(CUSTOMER_A, doc._id);
            expect(ok).toBe(true);
            expect(await GeneratedRecipe.findById(doc._id)).toBeNull();
        });

        test('published recipes cannot be deleted', async () => {
            aiService.generateRecipe.mockResolvedValueOnce(SAMPLE_RAW);
            const doc = await recipeService.generateAndSave({ user: STAFF, ingredients: ['tomato'] });
            await recipeService.publishToMenu(STAFF, doc._id, { price: 20, category: 'Main' });
            await expect(recipeService.deleteForUser(STAFF, doc._id))
                .rejects.toMatchObject({ code: 'already_published' });
        });

        test('unknown id → not_found', async () => {
            await expect(recipeService.deleteForUser(STAFF, new mongoose.Types.ObjectId()))
                .rejects.toMatchObject({ code: 'not_found' });
        });
    });

    describe('publishToMenu', () => {
        test('staff publishes → creates a Dish and marks recipe published', async () => {
            aiService.generateRecipe.mockResolvedValueOnce({ ...SAMPLE_RAW, name: 'Publishable Dish' });
            const doc = await recipeService.generateAndSave({ user: STAFF, ingredients: ['tomato'] });
            const out = await recipeService.publishToMenu(STAFF, doc._id, { price: 25, category: 'Pasta' });
            expect(out.dish.name).toBe('Publishable Dish');
            expect(out.dish.price).toBe(25);
            expect(out.dish.category).toBe('Pasta');
            const dishInDb = await Dish.findById(out.dish._id).lean();
            expect(dishInDb).toBeTruthy();
            const recInDb = await GeneratedRecipe.findById(doc._id).lean();
            expect(recInDb.status).toBe('published');
            expect(String(recInDb.publishedDish)).toBe(String(out.dish._id));
        });

        test('customer cannot publish', async () => {
            aiService.generateRecipe.mockResolvedValueOnce(SAMPLE_RAW);
            const doc = await recipeService.generateAndSave({ user: CUSTOMER_A, ingredients: ['tomato'] });
            await expect(recipeService.publishToMenu(CUSTOMER_A, doc._id, { price: 20 }))
                .rejects.toMatchObject({ code: 'forbidden' });
        });

        test('publishing twice → already_published (409)', async () => {
            aiService.generateRecipe.mockResolvedValueOnce({ ...SAMPLE_RAW, name: 'Once Only' });
            const doc = await recipeService.generateAndSave({ user: STAFF, ingredients: ['tomato'] });
            await recipeService.publishToMenu(STAFF, doc._id, { price: 20 });
            await expect(recipeService.publishToMenu(STAFF, doc._id, { price: 20 }))
                .rejects.toMatchObject({ code: 'already_published', status: 409 });
        });

        test('invalid category falls back to Main; missing price uses suggestedPrice', async () => {
            aiService.generateRecipe.mockResolvedValueOnce({ ...SAMPLE_RAW, name: 'Defaulted Dish', suggestedPrice: 33 });
            const doc = await recipeService.generateAndSave({ user: ADMIN, ingredients: ['tomato'] });
            const out = await recipeService.publishToMenu(ADMIN, doc._id, { category: 'NotARealCategory' });
            expect(out.dish.category).toBe('Main');
            expect(out.dish.price).toBe(33);
        });
    });

    describe('customerFavoriteIngredients', () => {
        test('aggregates and ranks favourites across customers', async () => {
            await CustomerPreferences.create([
                { user: new mongoose.Types.ObjectId(), favoriteIngredients: ['truffle', 'garlic'] },
                { user: new mongoose.Types.ObjectId(), favoriteIngredients: ['Truffle', 'basil'] },
                { user: new mongoose.Types.ObjectId(), favoriteIngredients: ['garlic'] }
            ]);
            const out = await recipeService.customerFavoriteIngredients(10);
            const truffle = out.find((o) => o.name.toLowerCase() === 'truffle');
            const garlic = out.find((o) => o.name.toLowerCase() === 'garlic');
            expect(truffle.count).toBe(2);
            expect(garlic.count).toBe(2);
            expect(out.find((o) => o.name === 'basil').count).toBe(1);
        });
    });
});
