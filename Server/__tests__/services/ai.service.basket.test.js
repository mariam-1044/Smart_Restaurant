jest.mock('../../src/infrastructure/ml/ml-client', () => ({
    post: jest.fn(),
    get: jest.fn()
}));
jest.mock('../../src/domain/models/MarketBasketRule', () => {
    const find = jest.fn();
    return { find };
});

const MarketBasketRule = require('../../src/domain/models/MarketBasketRule');
const aiService = require('../../src/application/services/ai.service');

function chain(rows) {
    const obj = {
        sort: () => obj,
        limit: () => obj,
        lean: () => Promise.resolve(rows)
    };
    return obj;
}

describe('aiService.getMarketBasket', () => {
    beforeEach(() => jest.clearAllMocks());

    test('returns { reason: not_yet_computed } when no rows exist', async () => {
        MarketBasketRule.find.mockReturnValueOnce(chain([]));
        const out = await aiService.getMarketBasket();
        expect(out).toMatchObject({ computedAt: null, rules: [], reason: 'not_yet_computed' });
    });

    test('returns sparse-corpus sentinel when only an empty antecedent row exists', async () => {
        const ts = new Date();
        MarketBasketRule.find.mockReturnValueOnce(chain([
            { antecedent: [], consequent: [], support: 0, confidence: 0, lift: 0, computedAt: ts }
        ]));
        const out = await aiService.getMarketBasket();
        expect(out.reason).toBe('corpus_too_sparse');
        expect(out.rules).toEqual([]);
    });

    test('returns rules sorted by computedAt with the right shape', async () => {
        const ts = new Date();
        MarketBasketRule.find.mockReturnValueOnce(chain([
            { antecedent: ['a'.repeat(24)], consequent: ['b'.repeat(24)], support: 0.2, confidence: 0.7, lift: 2.1, computedAt: ts },
            { antecedent: ['c'.repeat(24)], consequent: ['d'.repeat(24)], support: 0.1, confidence: 0.6, lift: 1.5, computedAt: ts }
        ]));
        const out = await aiService.getMarketBasket();
        expect(out.computedAt).toBe(ts);
        expect(out.rules).toHaveLength(2);
        expect(out.rules[0]).toMatchObject({
            antecedent: ['a'.repeat(24)],
            consequent: ['b'.repeat(24)],
            support: 0.2,
            confidence: 0.7,
            lift: 2.1
        });
    });
});
