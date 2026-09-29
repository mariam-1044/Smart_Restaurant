jest.mock('../../src/application/services/pricing.service', () => ({
    getSuggestions: jest.fn()
}));
jest.mock('../../src/application/services/notification.service', () => ({
    createAlert: jest.fn().mockResolvedValue({ _id: 'n1' })
}));
jest.mock('../../src/application/services/audit.service', () => ({
    recordInference: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../../src/domain/models/Dish', () => ({
    find: jest.fn(() => ({ select: () => ({ lean: () => Promise.resolve([
        { _id: 'd1', name: 'Margherita Pizza' }
    ]) }) }))
}));

const pricingService = require('../../src/application/services/pricing.service');
const notificationService = require('../../src/application/services/notification.service');
const auditService = require('../../src/application/services/audit.service');
const { runPricingAlerts, isActionable } = require('../../src/infrastructure/cron/pricing-alert.cron');

describe('pricing-alert cron', () => {
    beforeEach(() => jest.clearAllMocks());

    test('isActionable filters out small / low-confidence / skipped suggestions', () => {
        expect(isActionable({ dishId: 'd1', currentPrice: 10, suggestedPrice: 12, percentChange: 0.2, confidence: 0.8 })).toBe(true);
        // too small a change
        expect(isActionable({ dishId: 'd1', currentPrice: 10, suggestedPrice: 10.2, percentChange: 0.02, confidence: 0.9 })).toBe(false);
        // low confidence
        expect(isActionable({ dishId: 'd1', currentPrice: 10, suggestedPrice: 13, percentChange: 0.3, confidence: 0.3 })).toBe(false);
        // skipped
        expect(isActionable({ dishId: 'd1', currentPrice: 10, suggestedPrice: null, percentChange: 0, confidence: 0, skippedReason: 'insufficient_data' })).toBe(false);
        // no change
        expect(isActionable({ dishId: 'd1', currentPrice: 10, suggestedPrice: 10, percentChange: 0, confidence: 0.9 })).toBe(false);
    });

    test('raises an admin notification only for actionable suggestions', async () => {
        pricingService.getSuggestions.mockResolvedValueOnce([
            { dishId: 'd1', currentPrice: 10, suggestedPrice: 12.5, percentChange: 0.25, confidence: 0.82, capApplied: 'high_confidence_50pct' },
            { dishId: 'd2', currentPrice: 8, suggestedPrice: 8.1, percentChange: 0.0125, confidence: 0.9 } // ignored — tiny change
        ]);

        const out = await runPricingAlerts();

        expect(out.ok).toBe(true);
        expect(out.created).toBe(1);
        expect(notificationService.createAlert).toHaveBeenCalledTimes(1);
        expect(notificationService.createAlert).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'price_suggestion',
                targetRole: 'admin',
                relatedEntity: 'd1',
                entityModel: 'Dish'
            })
        );
        expect(auditService.recordInference).toHaveBeenCalledWith(
            expect.objectContaining({ capability: 'pricing', outcome: 'success' })
        );
    });

    test('creates no notifications when nothing is actionable', async () => {
        pricingService.getSuggestions.mockResolvedValueOnce([
            { dishId: 'd2', currentPrice: 8, suggestedPrice: 8, percentChange: 0, confidence: 0.9 }
        ]);
        const out = await runPricingAlerts();
        expect(out.created).toBe(0);
        expect(notificationService.createAlert).not.toHaveBeenCalled();
    });

    test('records error_inference outcome when the pricing engine is offline', async () => {
        pricingService.getSuggestions.mockRejectedValueOnce({ code: 'inference_unavailable' });
        const out = await runPricingAlerts();
        expect(out.ok).toBe(false);
        expect(auditService.recordInference).toHaveBeenCalledWith(
            expect.objectContaining({ capability: 'pricing', outcome: 'error_inference' })
        );
    });
});
