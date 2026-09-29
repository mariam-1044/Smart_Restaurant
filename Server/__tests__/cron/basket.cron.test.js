jest.mock('../../src/infrastructure/ml/ml-client', () => ({
    post: jest.fn(),
    get: jest.fn()
}));
jest.mock('../../src/application/services/audit.service', () => ({
    recordInference: jest.fn().mockResolvedValue(undefined)
}));

const mlClient = require('../../src/infrastructure/ml/ml-client');
const auditService = require('../../src/application/services/audit.service');
const { runBasketRefresh } = require('../../src/infrastructure/cron/basket.cron');

describe('runBasketRefresh', () => {
    beforeEach(() => jest.clearAllMocks());

    test('calls mlClient with the refresh endpoint and returns ok=true on success', async () => {
        mlClient.post.mockResolvedValueOnce({ data: { computedAt: new Date().toISOString(), ruleCount: 17 } });
        const out = await runBasketRefresh();
        expect(mlClient.post).toHaveBeenCalledWith('/market-basket/refresh');
        expect(out.ok).toBe(true);
        expect(out.data.ruleCount).toBe(17);
        expect(auditService.recordInference).toHaveBeenCalledWith(
            expect.objectContaining({ capability: 'market_basket_refresh', outcome: 'success' })
        );
    });

    test('writes audit row with error_inference outcome on inference_unavailable', async () => {
        mlClient.post.mockRejectedValueOnce({ code: 'inference_unavailable', cause: new Error('econn') });
        const out = await runBasketRefresh();
        expect(out.ok).toBe(false);
        expect(auditService.recordInference).toHaveBeenCalledWith(
            expect.objectContaining({ capability: 'market_basket_refresh', outcome: 'error_inference' })
        );
    });
});
