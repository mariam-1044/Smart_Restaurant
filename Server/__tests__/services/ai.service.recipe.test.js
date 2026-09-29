// Recipe generation is now RAG-based: ai.service.generateRecipe() forwards to
// the Python ML service via ml-client (POST /generate-recipe). These tests mock
// ml-client so no live Qdrant/Gemini service is required.
jest.mock('../../src/infrastructure/ml/ml-client', () => ({
    post: jest.fn(),
    get: jest.fn()
}));
// _heuristicRecipe reads real Ingredient costs; stub the model so the fallback
// path runs without a database.
jest.mock('../../src/domain/models/Ingredient', () => ({
    find: jest.fn(() => ({
        select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) }))
    }))
}));

const mlClient = require('../../src/infrastructure/ml/ml-client');
const aiService = require('../../src/application/services/ai.service');

const RAG_RECIPE = {
    name: 'Margherita Pizza',
    description: 'Chosen because it matches tomato and cheese.',
    style: 'Italian',
    prepTime: '30 min',
    difficulty: 'Easy',
    steps: ['Make dough', 'Top and bake'],
    ingredients: [
        { name: 'tomato', quantity: 200, unit: 'g' },
        { name: 'cheese', quantity: 150, unit: 'g' }
    ],
    estimatedCost: 30,
    suggestedPrice: 90,
    profitMargin: 66,
    rag: { matched: true, sourceCount: 3, scoreThreshold: 0.7 }
};

describe('aiService.generateRecipe (RAG)', () => {
    const ORIGINAL_FALLBACK = process.env.AI_FALLBACK_ENABLED;

    beforeEach(() => {
        mlClient.post.mockReset();
        delete process.env.AI_FALLBACK_ENABLED;
    });

    afterAll(() => {
        if (ORIGINAL_FALLBACK === undefined) delete process.env.AI_FALLBACK_ENABLED;
        else process.env.AI_FALLBACK_ENABLED = ORIGINAL_FALLBACK;
    });

    test('posts to /generate-recipe with the structured inputs and returns the RAG JSON unchanged', async () => {
        mlClient.post.mockResolvedValueOnce({ data: RAG_RECIPE });

        const out = await aiService.generateRecipe({
            ingredients: ['tomato', 'cheese'],
            style: 'Italian',
            creativity: 7,
            favoriteIngredients: ['cheese'],
            customerContext: 'vegetarian please'
        });

        expect(mlClient.post).toHaveBeenCalledTimes(1);
        const [path, payload] = mlClient.post.mock.calls[0];
        expect(path).toBe('/generate-recipe');
        expect(payload).toEqual({
            ingredients: ['tomato', 'cheese'],
            style: 'Italian',
            creativity: 7,
            favoriteIngredients: ['cheese'],
            customerContext: 'vegetarian please'
        });
        expect(out).toEqual(RAG_RECIPE);
    });

    test('throws UpstreamProviderError when the ML service is unavailable and fallback is off', async () => {
        mlClient.post.mockRejectedValueOnce({ code: 'inference_unavailable' });
        await expect(
            aiService.generateRecipe({ ingredients: ['eggplant'] })
        ).rejects.toMatchObject({ code: 'upstream_provider_failed' });
        expect(mlClient.post).toHaveBeenCalledTimes(1);
    });

    test('falls back to the heuristic recipe when ML is unavailable and AI_FALLBACK_ENABLED=true', async () => {
        process.env.AI_FALLBACK_ENABLED = 'true';
        mlClient.post.mockRejectedValueOnce({ code: 'inference_unavailable' });

        const out = await aiService.generateRecipe({
            ingredients: ['tomato', 'cheese'],
            creativity: 6
        });

        expect(out).toMatchObject({ _fallback: true });
        expect(Array.isArray(out.ingredients)).toBe(true);
        expect(out.name).toEqual(expect.any(String));
    });

    test('maps a 422 no_suitable_recipe into NoSuitableRecipeError (no fallback, even when enabled)', async () => {
        process.env.AI_FALLBACK_ENABLED = 'true';
        mlClient.post.mockRejectedValueOnce({
            code: 'inference_validation',
            status: 422,
            data: { detail: { error: { code: 'no_suitable_recipe', message: 'No suitable recipe found' } } }
        });

        await expect(
            aiService.generateRecipe({ ingredients: ['unicorn'] })
        ).rejects.toMatchObject({ code: 'no_suitable_recipe', status: 422 });
    });

    test('throws UpstreamProviderError(malformed_payload) when the response has no body', async () => {
        mlClient.post.mockResolvedValueOnce({ data: null });
        await expect(
            aiService.generateRecipe({ ingredients: ['eggplant'] })
        ).rejects.toMatchObject({ code: 'upstream_provider_failed', reason: 'malformed_payload' });
    });
});
