jest.mock('../../src/domain/models/Dish', () => ({
    find: jest.fn(),
    findById: jest.fn()
}));
jest.mock('../../src/domain/models/PriceHistory', () => ({
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn()
}));
jest.mock('../../src/domain/models/Order', () => ({
    aggregate: jest.fn().mockResolvedValue([])
}));

const Dish = require('../../src/domain/models/Dish');
const pricingService = require('../../src/application/services/pricing.service');
const { withMlServiceStub } = require('../helpers/mlServiceStub');
const nock = require('nock');

function dishesReturning(dishes) {
    Dish.find.mockReturnValueOnce({
        select: () => ({ lean: () => Promise.resolve(dishes) })
    });
}

describe('pricing.service.getSuggestions branches', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        withMlServiceStub({ route: '/optimize-pricing', response: { currentPrice: 10, suggestedPrice: 10, confidence: 0.5, skippedReason: null } });
    });

    test('skipped suggestion is propagated with skippedReason', async () => {
        dishesReturning([{ _id: 'a'.repeat(24), price: 10 }]);
        nock.cleanAll();
        withMlServiceStub({ route: '/optimize-pricing', response: { currentPrice: 10, skippedReason: 'missing_cost_data' } });
        const out = await pricingService.getSuggestions();
        expect(out[0].skippedReason).toBe('missing_cost_data');
        expect(out[0].suggestedPrice).toBeNull();
    });

    test('high-confidence suggestion gets capApplied=high_confidence_50pct', async () => {
        dishesReturning([{ _id: 'a'.repeat(24), price: 10 }]);
        nock.cleanAll();
        withMlServiceStub({ route: '/optimize-pricing', response: { currentPrice: 10, suggestedPrice: 13, confidence: 0.85, skippedReason: null } });
        const out = await pricingService.getSuggestions();
        expect(out[0].capApplied).toBe('high_confidence_50pct');
        expect(out[0].percentChange).toBeGreaterThan(0);
    });

    test('zero percentChange yields capApplied=none', async () => {
        dishesReturning([{ _id: 'a'.repeat(24), price: 10 }]);
        nock.cleanAll();
        withMlServiceStub({ route: '/optimize-pricing', response: { currentPrice: 10, suggestedPrice: 10, confidence: 0.5, skippedReason: null } });
        const out = await pricingService.getSuggestions();
        expect(out[0].capApplied).toBe('none');
    });

    test('throws InferenceUnavailableError when one call fails', async () => {
        dishesReturning([{ _id: 'a'.repeat(24), price: 10 }]);
        nock.cleanAll();
        withMlServiceStub({ route: '/optimize-pricing', status: 500, response: {} });
        await expect(pricingService.getSuggestions()).rejects.toMatchObject({
            code: 'inference_unavailable'
        });
    });

    test('getHistory returns oldest→newest', async () => {
        const PriceHistory = require('../../src/domain/models/PriceHistory');
        PriceHistory.find.mockReturnValueOnce({
            sort: () => ({ lean: () => Promise.resolve([{ _id: '1' }, { _id: '2' }]) })
        });
        const out = await pricingService.getHistory('a'.repeat(24));
        expect(out).toHaveLength(2);
    });

    test('applyPrice → NotFoundError when dish not found', async () => {
        Dish.findById.mockResolvedValueOnce(null);
        await expect(pricingService.applyPrice({
            dishId: 'a'.repeat(24), newPrice: 10, applierId: 'u', applierRole: 'admin', suggestionConfidence: 0.5, source: 'manager_apply'
        })).rejects.toMatchObject({ code: 'dish_not_found' });
    });

    test('revertPrice → NotFoundError when original missing', async () => {
        const PriceHistory = require('../../src/domain/models/PriceHistory');
        PriceHistory.findById.mockResolvedValueOnce(null);
        await expect(pricingService.revertPrice({
            priceHistoryId: 'a'.repeat(24), applierId: 'u', applierRole: 'admin'
        })).rejects.toMatchObject({ code: 'price_history_not_found' });
    });
});