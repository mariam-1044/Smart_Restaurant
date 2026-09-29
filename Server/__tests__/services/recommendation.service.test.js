jest.mock('../../src/infrastructure/ml/ml-client', () => ({
    post: jest.fn(),
    get: jest.fn()
}));
jest.mock('../../src/domain/models/Order', () => ({
    exists: jest.fn()
}));
jest.mock('../../src/domain/models/RecommendationRating', () => ({
    findOne: jest.fn(() => ({ sort: jest.fn() })),
    findOneAndUpdate: jest.fn()
}));
jest.mock('../../src/domain/models/PublishedRecommendation', () => ({
    findOneAndUpdate: jest.fn(),
    find: jest.fn()
}));
jest.mock('../../src/domain/models/AIInferenceAudit', () => ({
    exists: jest.fn()
}));
jest.mock('../../src/domain/models/Dish', () => ({
    find: jest.fn()
}));

const mlClient = require('../../src/infrastructure/ml/ml-client');
const Order = require('../../src/domain/models/Order');
const RecommendationRating = require('../../src/domain/models/RecommendationRating');
const PublishedRecommendation = require('../../src/domain/models/PublishedRecommendation');
const AIInferenceAudit = require('../../src/domain/models/AIInferenceAudit');
const Dish = require('../../src/domain/models/Dish');

const recommendationService = require('../../src/application/services/recommendation.service');

const CUSTOMER = '5fa1c2b3e4d5a6f7b8c9d0a0';
const DISH = '5fa1c2b3e4d5a6f7b8c9d0b1';

describe('recommendation.service', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('getRecommendations', () => {
        test('calls mlClient and decorates with recommendationContextId', async () => {
            mlClient.post.mockResolvedValueOnce({
                data: {
                    customerId: CUSTOMER,
                    coldStart: false,
                    basis: 'collaborative',
                    items: [{ dishId: DISH, score: 0.9, reason: 'similar' }]
                }
            });
            const out = await recommendationService.getRecommendations(CUSTOMER);
            expect(mlClient.post).toHaveBeenCalledWith('/recommend', { customerId: CUSTOMER, limit: 5 });
            expect(out.basis).toBe('collaborative');
            expect(typeof out.recommendationContextId).toBe('string');
            expect(out.recommendations).toHaveLength(1);
        });

        test('throws InferenceUnavailableError when mlClient errors', async () => {
            mlClient.post.mockRejectedValueOnce({ code: 'inference_unavailable', cause: new Error('econn') });
            await expect(recommendationService.getRecommendations(CUSTOMER)).rejects.toMatchObject({
                code: 'inference_unavailable'
            });
        });
    });

    describe('submitRating', () => {
        test('rejects when customer never ordered the dish', async () => {
            Order.exists.mockResolvedValueOnce(false);
            await expect(
                recommendationService.submitRating({ customerId: CUSTOMER, dishId: DISH, score: 5 })
            ).rejects.toMatchObject({ code: 'dish_not_ordered' });
        });

        test('rejects when no recommend audit row exists for the customer', async () => {
            Order.exists.mockResolvedValueOnce(true);
            AIInferenceAudit.exists.mockResolvedValue(false);
            await expect(
                recommendationService.submitRating({ customerId: CUSTOMER, dishId: DISH, score: 5 })
            ).rejects.toMatchObject({ code: 'dish_not_recommended' });
        });

        test('upserts a RecommendationRating on success', async () => {
            Order.exists.mockResolvedValueOnce(true);
            AIInferenceAudit.exists.mockResolvedValue(true);
            RecommendationRating.findOneAndUpdate.mockResolvedValueOnce({ _id: 'r1' });
            const out = await recommendationService.submitRating({
                customerId: CUSTOMER, dishId: DISH, score: 5, comment: 'great'
            });
            expect(RecommendationRating.findOneAndUpdate).toHaveBeenCalled();
            const args = RecommendationRating.findOneAndUpdate.mock.calls[0];
            expect(args[2]).toMatchObject({ upsert: true });
            expect(out._id).toBe('r1');
        });
    });

    describe('publishEndorsement', () => {
        function mockRating(score) {
            const sort = jest.fn().mockResolvedValue(score === null ? null : { _id: 'rid', score });
            RecommendationRating.findOne.mockReturnValueOnce({ sort });
        }

        test('rejects when no rating exists', async () => {
            mockRating(null);
            await expect(
                recommendationService.publishEndorsement({ customerId: CUSTOMER, dishId: DISH })
            ).rejects.toMatchObject({ code: 'no_rating' });
        });

        test('rejects when rating < 4', async () => {
            mockRating(3);
            await expect(
                recommendationService.publishEndorsement({ customerId: CUSTOMER, dishId: DISH })
            ).rejects.toMatchObject({ code: 'rating_below_threshold' });
        });

        test('upserts a published recommendation when rating ≥ 4', async () => {
            mockRating(5);
            PublishedRecommendation.findOneAndUpdate.mockResolvedValueOnce({ _id: 'p1' });
            const out = await recommendationService.publishEndorsement({ customerId: CUSTOMER, dishId: DISH });
            expect(out._id).toBe('p1');
            const args = PublishedRecommendation.findOneAndUpdate.mock.calls[0];
            expect(args[1].$set.status).toBe('published');
            expect(args[1].$set.ratingAtPublish).toBe(5);
            expect(args[1].$set.anonymizedHandle).toMatch(/^Diner #/);
        });
    });

    describe('unpublishEndorsement', () => {
        test('flips status and sets unpublishedAt', async () => {
            PublishedRecommendation.findOneAndUpdate.mockResolvedValueOnce({ _id: 'p1', status: 'unpublished' });
            const out = await recommendationService.unpublishEndorsement({ customerId: CUSTOMER, dishId: DISH });
            expect(out.status).toBe('unpublished');
        });

        test('throws NotFound when no published row exists', async () => {
            PublishedRecommendation.findOneAndUpdate.mockResolvedValueOnce(null);
            await expect(
                recommendationService.unpublishEndorsement({ customerId: CUSTOMER, dishId: DISH })
            ).rejects.toMatchObject({ code: 'endorsement_not_found' });
        });
    });

    describe('listPeerEndorsements', () => {
        test('returns [] when there are no published endorsements', async () => {
            PublishedRecommendation.find.mockReturnValueOnce({
                sort: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) })
            });
            const out = await recommendationService.listPeerEndorsements(8);
            expect(out).toEqual([]);
        });

        test('joins dish names onto published endorsements', async () => {
            PublishedRecommendation.find.mockReturnValueOnce({
                sort: () => ({
                    limit: () => ({
                        lean: () => Promise.resolve([
                            { dishId: DISH, anonymizedHandle: 'Diner #ab12', ratingAtPublish: 5, publishedAt: new Date('2026-05-01') }
                        ])
                    })
                })
            });
            Dish.find.mockReturnValueOnce({ select: () => ({ lean: () => Promise.resolve([{ _id: DISH, name: 'Margherita' }]) }) });
            const out = await recommendationService.listPeerEndorsements(8);
            expect(out).toHaveLength(1);
            expect(out[0]).toMatchObject({ dishId: DISH, dishName: 'Margherita', handle: 'Diner #ab12', score: 5 });
        });
    });

    describe('rateRecipe', () => {
        test('rejects an out-of-range score', async () => {
            await expect(recommendationService.rateRecipe({ customerId: CUSTOMER, dishId: DISH, score: 9 }))
                .rejects.toMatchObject({ code: 'invalid_score' });
        });

        test('rejects an invalid dish id', async () => {
            await expect(recommendationService.rateRecipe({ customerId: CUSTOMER, dishId: 'not-an-id', score: 5 }))
                .rejects.toMatchObject({ code: 'invalid_dish' });
        });

        test('a 5★ rating records the rating and publishes an endorsement', async () => {
            RecommendationRating.findOneAndUpdate.mockResolvedValueOnce({ _id: 'rid5' });
            PublishedRecommendation.findOneAndUpdate.mockResolvedValueOnce({ _id: 'pid5' });
            const out = await recommendationService.rateRecipe({ customerId: CUSTOMER, dishId: DISH, score: 5 });
            expect(out).toEqual({ ok: true, published: true });
            const pubArgs = PublishedRecommendation.findOneAndUpdate.mock.calls[0];
            expect(pubArgs[1].$set.status).toBe('published');
            expect(pubArgs[1].$set.ratingAtPublish).toBe(5);
        });

        test('a 2★ rating records the rating and retracts any endorsement', async () => {
            RecommendationRating.findOneAndUpdate.mockResolvedValueOnce({ _id: 'rid2' });
            PublishedRecommendation.findOneAndUpdate.mockResolvedValueOnce(null);
            const out = await recommendationService.rateRecipe({ customerId: CUSTOMER, dishId: DISH, score: 2 });
            expect(out).toEqual({ ok: true, published: false });
            const args = PublishedRecommendation.findOneAndUpdate.mock.calls[0];
            expect(args[0]).toMatchObject({ status: 'published' });
            expect(args[1].$set.status).toBe('unpublished');
        });
    });
});
