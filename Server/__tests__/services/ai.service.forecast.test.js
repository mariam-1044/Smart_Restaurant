jest.mock('../../src/infrastructure/ml/ml-client', () => ({
    post: jest.fn(),
    get: jest.fn()
}));

const mlClient = require('../../src/infrastructure/ml/ml-client');
const aiService = require('../../src/application/services/ai.service');

describe('aiService.predictDemand', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('calls /predict-sales with the right body and returns response.data', async () => {
        const payload = {
            dishId: '65fa1c2b3e4d5a6f7b8c9d0e',
            coldStart: false,
            points: [{ date: '2026-04-27', predicted: 18.4, lower: 14.2, upper: 22.1 }]
        };
        mlClient.post.mockResolvedValueOnce({ data: payload });

        const out = await aiService.predictDemand({
            dishId: '65fa1c2b3e4d5a6f7b8c9d0e',
            daysAhead: 7
        });

        expect(mlClient.post).toHaveBeenCalledWith('/predict-sales', {
            dishId: '65fa1c2b3e4d5a6f7b8c9d0e',
            daysAhead: 7
        });
        expect(out).toBe(payload);
    });

    test('throws InferenceUnavailableError when mlClient errors with inference_unavailable', async () => {
        mlClient.post.mockRejectedValueOnce({ code: 'inference_unavailable', cause: new Error('econn') });

        await expect(
            aiService.predictDemand({ dishId: 'a'.repeat(24), daysAhead: 7 })
        ).rejects.toMatchObject({ code: 'inference_unavailable' });
    });

    test('translates a 422 cold_start_no_data into ColdStartError', async () => {
        mlClient.post.mockRejectedValueOnce({
            code: 'inference_validation',
            status: 422,
            data: { detail: { error: { code: 'cold_start_no_data', message: 'no_baseline' } } }
        });

        await expect(
            aiService.predictDemand({ dishId: 'a'.repeat(24), daysAhead: 7 })
        ).rejects.toMatchObject({ code: 'cold_start' });
    });
});
