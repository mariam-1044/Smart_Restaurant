jest.mock('../../src/domain/models/Dish', () => {
    const mock = {
        find: jest.fn(),
        findById: jest.fn()
    };
    return mock;
});
jest.mock('../../src/domain/models/PriceHistory', () => {
    const mock = {
        create: jest.fn(),
        find: jest.fn(),
        findById: jest.fn(),
        updateOne: jest.fn(),
        updateMany: jest.fn(),
        findOneAndUpdate: jest.fn(),
        deleteOne: jest.fn(),
        deleteMany: jest.fn(),
        findOneAndDelete: jest.fn()
    };
    return mock;
});
jest.mock('../../src/domain/models/Order', () => ({
    aggregate: jest.fn().mockResolvedValue([])
}));

const Dish = require('../../src/domain/models/Dish');
const PriceHistory = require('../../src/domain/models/PriceHistory');
const pricingService = require('../../src/application/services/pricing.service');
const { withMlServiceStub } = require('../helpers/mlServiceStub');
const nock = require('nock');

const DISH_ID = 'a'.repeat(24);
const APPLIER_ID = 'b'.repeat(24);

describe('pricing.service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        withMlServiceStub({ route: '/optimize-pricing', response: { currentPrice: 10, suggestedPrice: 10, confidence: 0.5, skippedReason: null } });
    });

    test('getSuggestions calls /optimize-pricing for every dish', async () => {
        Dish.find.mockReturnValueOnce({
            select: () => ({ lean: () => Promise.resolve([
                { _id: DISH_ID, price: 10 },
                { _id: 'c'.repeat(24), price: 20 }
            ])})
        });
        nock.cleanAll();
        withMlServiceStub({ route: '/optimize-pricing', response: { currentPrice: 10, suggestedPrice: 12, confidence: 0.7, skippedReason: null } });
        withMlServiceStub({ route: '/optimize-pricing', response: { currentPrice: 20, suggestedPrice: 18, confidence: 0.6, skippedReason: null } });

        const out = await pricingService.getSuggestions();
        expect(out).toHaveLength(2);
        expect(out[0]).toMatchObject({ currentPrice: 10, suggestedPrice: 12 });
    });

    test('applyPrice inserts a PriceHistory row and updates Dish.price', async () => {
        const dishDoc = { _id: DISH_ID, price: 10, save: jest.fn().mockResolvedValue() };
        Dish.findById.mockResolvedValueOnce(dishDoc);
        PriceHistory.create.mockResolvedValueOnce({ _id: 'h1', source: 'manager_apply' });

        const out = await pricingService.applyPrice({
            dishId: DISH_ID, newPrice: 12, applierId: APPLIER_ID, applierRole: 'admin',
            suggestionConfidence: 0.7, source: 'manager_apply'
        });

        expect(PriceHistory.create).toHaveBeenCalledWith(expect.objectContaining({
            dishId: DISH_ID,
            priorPrice: 10,
            newPrice: 12,
            source: 'manager_apply'
        }));
        expect(dishDoc.price).toBe(12);
        expect(dishDoc.save).toHaveBeenCalled();
        expect(out._id).toBe('h1');
    });

    test('revertPrice inserts a NEW PriceHistory row with source=manager_revert and revertOf', async () => {
        const original = {
            _id: 'orig-id',
            dishId: DISH_ID,
            priorPrice: 10,
            newPrice: 12
        };
        PriceHistory.findById.mockResolvedValueOnce(original);
        PriceHistory.create.mockResolvedValueOnce({ _id: 'h2', source: 'manager_revert', revertOf: original._id });
        const dishDoc = { _id: DISH_ID, price: 12, save: jest.fn().mockResolvedValue() };
        Dish.findById.mockResolvedValueOnce(dishDoc);

        const out = await pricingService.revertPrice({
            priceHistoryId: original._id, applierId: APPLIER_ID, applierRole: 'admin'
        });

        expect(PriceHistory.create).toHaveBeenCalledWith(expect.objectContaining({
            dishId: DISH_ID,
            priorPrice: 12,
            newPrice: 10,
            source: 'manager_revert',
            revertOf: original._id
        }));
        expect(dishDoc.price).toBe(10);
        expect(out.source).toBe('manager_revert');
    });

    test('append-only invariant: service NEVER calls mutating PriceHistory methods', async () => {
        const dishDoc = { _id: DISH_ID, price: 10, save: jest.fn().mockResolvedValue() };
        Dish.findById.mockResolvedValue(dishDoc);
        PriceHistory.create.mockResolvedValue({ _id: 'h1' });
        PriceHistory.findById.mockResolvedValue({ _id: 'h0', dishId: DISH_ID, priorPrice: 8, newPrice: 10 });
        await pricingService.applyPrice({ dishId: DISH_ID, newPrice: 12, applierId: APPLIER_ID, applierRole: 'admin', suggestionConfidence: 0.7, source: 'manager_apply' });
        await pricingService.revertPrice({ priceHistoryId: 'h0', applierId: APPLIER_ID, applierRole: 'admin' });

        expect(PriceHistory.updateOne).not.toHaveBeenCalled();
        expect(PriceHistory.updateMany).not.toHaveBeenCalled();
        expect(PriceHistory.findOneAndUpdate).not.toHaveBeenCalled();
        expect(PriceHistory.deleteOne).not.toHaveBeenCalled();
        expect(PriceHistory.deleteMany).not.toHaveBeenCalled();
        expect(PriceHistory.findOneAndDelete).not.toHaveBeenCalled();
    });
});