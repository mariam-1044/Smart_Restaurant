jest.mock('../../src/domain/models/PublishedRecommendation', () => {
    const find = jest.fn();
    const aggregate = jest.fn();
    return { find, aggregate };
});

const PublishedRecommendation = require('../../src/domain/models/PublishedRecommendation');
const endorsementService = require('../../src/application/services/endorsement.service');

const DISH = '5fa1c2b3e4d5a6f7b8c9d0b1';

describe('endorsementService.getDishSummary', () => {
    beforeEach(() => jest.clearAllMocks());

    test('returns count, average and recent[] from PublishedRecommendation', async () => {
        PublishedRecommendation.aggregate.mockResolvedValueOnce([{ count: 3, average: 4.667 }]);
        const sortLimitLean = {
            sort: () => sortLimitLean,
            limit: () => sortLimitLean,
            lean: () => Promise.resolve([
                { anonymizedHandle: 'Diner #abcd', ratingAtPublish: 5, publishedAt: new Date('2026-04-25') },
                { anonymizedHandle: 'Diner #efgh', ratingAtPublish: 4, publishedAt: new Date('2026-04-24') }
            ])
        };
        PublishedRecommendation.find.mockReturnValueOnce(sortLimitLean);

        const out = await endorsementService.getDishSummary(DISH);
        expect(out.count).toBe(3);
        expect(out.average).toBeCloseTo(4.667);
        expect(out.recent).toHaveLength(2);
    });

    test('payload has zero PII fields', async () => {
        PublishedRecommendation.aggregate.mockResolvedValueOnce([{ count: 1, average: 5 }]);
        const sortLimitLean = {
            sort: () => sortLimitLean,
            limit: () => sortLimitLean,
            lean: () => Promise.resolve([
                {
                    anonymizedHandle: 'Diner #abcd',
                    ratingAtPublish: 5,
                    publishedAt: new Date('2026-04-25'),
                    customerId: 'should-be-hidden',
                    email: 'leak@example.com'
                }
            ])
        };
        PublishedRecommendation.find.mockReturnValueOnce(sortLimitLean);
        const out = await endorsementService.getDishSummary(DISH);
        const recent = out.recent[0];
        expect(Object.keys(recent).sort()).toEqual(['handle', 'publishedAt', 'score']);
        expect(JSON.stringify(out)).not.toContain('email');
        expect(JSON.stringify(out)).not.toContain('customerId');
    });

    test('returns count=0 and average=null for a dish with no published rows', async () => {
        PublishedRecommendation.aggregate.mockResolvedValueOnce([]);
        const sortLimitLean = {
            sort: () => sortLimitLean,
            limit: () => sortLimitLean,
            lean: () => Promise.resolve([])
        };
        PublishedRecommendation.find.mockReturnValueOnce(sortLimitLean);
        const out = await endorsementService.getDishSummary(DISH);
        expect(out.count).toBe(0);
        expect(out.average).toBe(null);
        expect(out.recent).toEqual([]);
    });
});
