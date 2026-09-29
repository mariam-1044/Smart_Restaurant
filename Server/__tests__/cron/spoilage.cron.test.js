jest.mock('../../src/infrastructure/ml/ml-client', () => ({
    post: jest.fn(),
    get: jest.fn()
}));
jest.mock('../../src/domain/models/Ingredient', () => ({
    find: jest.fn()
}));
jest.mock('../../src/application/services/notification.service', () => ({
    createAlert: jest.fn().mockResolvedValue({ _id: 'notif1' })
}));
jest.mock('../../src/application/services/ai.service', () => ({
    generateRecipe: jest.fn()
}));
jest.mock('../../src/application/services/audit.service', () => ({
    recordInference: jest.fn().mockResolvedValue(undefined)
}));

const Ingredient = require('../../src/domain/models/Ingredient');
const notificationService = require('../../src/application/services/notification.service');
const aiService = require('../../src/application/services/ai.service');

const { runSpoilageCheck, RETRY_DELAYS_MS, TOTAL_BUDGET_MS } = require('../../src/infrastructure/cron/spoilage.cron');

const mongoose = require('mongoose');

function fakeIngredients(names) {
    return names.map((n) => ({ _id: new mongoose.Types.ObjectId(), name: n, expiryDate: new Date(Date.now() + 12 * 60 * 60 * 1000) }));
}

describe('runSpoilageCheck', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('writes spoilage_risk Notification on success (single try)', async () => {
        Ingredient.find.mockResolvedValueOnce(fakeIngredients(['tomato', 'basil']));
        const recipe = { name: 'Caprese', steps: [], ingredients: [] };
        aiService.generateRecipe.mockResolvedValueOnce(recipe);

        const out = await runSpoilageCheck();

        expect(out.ok).toBe(true);
        expect(aiService.generateRecipe).toHaveBeenCalledTimes(1);
        expect(notificationService.createAlert).toHaveBeenCalledTimes(1);
        const callArgs = notificationService.createAlert.mock.calls[0][0];
        expect(callArgs.type).toBe('spoilage_risk');
        expect(callArgs.payload.recipe).toBe(recipe);
        expect(callArgs.payload.ingredients.map(i => i.name)).toEqual(['tomato', 'basil']);
    });

    test('retries with exponential backoff and writes spoilage_recipe_failed on final failure', async () => {
        Ingredient.find.mockResolvedValueOnce(fakeIngredients(['eggplant']));
        aiService.generateRecipe.mockRejectedValue(new Error('boom'));

        const out = await runSpoilageCheck();

        expect(out.ok).toBe(false);
        expect(aiService.generateRecipe.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(notificationService.createAlert).toHaveBeenCalledTimes(1);
        const callArgs = notificationService.createAlert.mock.calls[0][0];
        expect(callArgs.type).toBe('spoilage_recipe_failed');
        expect(callArgs.payload.ingredients).toEqual(['eggplant']);
        expect(callArgs.payload.attempts).toBeGreaterThanOrEqual(2);
    }, 20000);

    test('skips when no near-expiry ingredients', async () => {
        Ingredient.find.mockResolvedValueOnce([]);
        const out = await runSpoilageCheck();
        expect(out.skipped).toBe(true);
        expect(aiService.generateRecipe).not.toHaveBeenCalled();
        expect(notificationService.createAlert).not.toHaveBeenCalled();
    });

    test('retry delays are 250/500/1000 ms (exponential backoff)', () => {
        expect(RETRY_DELAYS_MS).toEqual([250, 500, 1000]);
        expect(TOTAL_BUDGET_MS).toBe(15000);
    });
});