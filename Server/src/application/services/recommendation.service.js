const mongoose = require('mongoose');
const mlClient = require('../../infrastructure/ml/ml-client');
const Order = require('../../domain/models/Order');
const RecommendationRating = require('../../domain/models/RecommendationRating');
const PublishedRecommendation = require('../../domain/models/PublishedRecommendation');
const AIInferenceAudit = require('../../domain/models/AIInferenceAudit');
const handleService = require('./handle.service');

class ValidationError extends Error {
    constructor(code, message) {
        super(message || code);
        this.name = 'ValidationError';
        this.code = code;
    }
}

class NotFoundError extends Error {
    constructor(code, message) {
        super(message || code);
        this.name = 'NotFoundError';
        this.code = code;
    }
}

class InferenceUnavailableError extends Error {
    constructor(cause) {
        super('inference_unavailable');
        this.name = 'InferenceUnavailableError';
        this.code = 'inference_unavailable';
        this.cause = cause;
    }
}

async function getRecommendations(customerId) {
    let response;
    try {
        response = await mlClient.post('/recommend', { customerId, limit: 5 });
    } catch (err) {
        if (process.env.AI_FALLBACK_ENABLED === 'true') {
            return await _heuristicRecommendations(customerId);
        }
        throw new InferenceUnavailableError(err && err.cause);
    }
    const data = response.data || {};
    const recommendationContextId = new mongoose.Types.ObjectId().toString();
    return {
        customerId,
        recommendations: (data.items || []).map((it) => ({
            dishId: it.dishId,
            name: it.name || null,
            score: it.score,
            reason: it.reason
        })),
        coldStart: !!data.coldStart,
        basis: data.basis || 'popularity_fallback',
        recommendationContextId
    };
}

// Popularity-based recommendations computed from real order history.
// Used when the ML service is unreachable. Surfaces the top-ordered dishes
// the customer hasn't already tried so the feed still feels fresh.
async function _heuristicRecommendations(customerId) {
    const Dish = require('../../domain/models/Dish');
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const popular = await Order.aggregate([
        { $match: { createdAt: { $gte: cutoff }, status: 'completed' } },
        { $unwind: '$items' },
        {
            $group: {
                _id: '$items.dish',
                qty: { $sum: '$items.quantity' },
                orders: { $sum: 1 }
            }
        },
        { $sort: { qty: -1 } },
        { $limit: 12 }
    ]);

    let customerObjId = null;
    try {
        customerObjId = new mongoose.Types.ObjectId(customerId);
    } catch (_e) {
        customerObjId = null;
    }
    const ownedSet = new Set();
    if (customerObjId) {
        const own = await Order.aggregate([
            {
                $match: {
                    status: 'completed',
                    $or: [{ user: customerObjId }, { customer: customerObjId }]
                }
            },
            { $unwind: '$items' },
            { $group: { _id: '$items.dish' } }
        ]);
        for (const row of own) ownedSet.add(String(row._id));
    }

    const fresh = popular.filter((p) => !ownedSet.has(String(p._id))).slice(0, 5);
    const pool = fresh.length > 0 ? fresh : popular.slice(0, 5);

    const dishIds = pool.map((p) => p._id);
    const dishes = await Dish.find({ _id: { $in: dishIds } }).select('name').lean();
    const nameMap = Object.fromEntries(dishes.map((d) => [String(d._id), d.name]));

    const maxQty = pool[0]?.qty || 1;
    const recommendationContextId = new mongoose.Types.ObjectId().toString();
    return {
        customerId,
        recommendations: pool.map((p, idx) => ({
            dishId: String(p._id),
            name: nameMap[String(p._id)] || null,
            score: Number(Math.max(0.3, p.qty / maxQty - idx * 0.05).toFixed(2)),
            reason: 'Popular with other diners this month'
        })),
        coldStart: pool.length === 0,
        basis: 'popularity_fallback',
        recommendationContextId
    };
}

async function _customerHasOrderedDish(customerId, dishId) {
    return !!(await Order.exists({
        $or: [{ user: customerId }, { customer: customerId }],
        'items.dish': new mongoose.Types.ObjectId(dishId),
        status: 'completed'
    }));
}

async function _customerWasRecommendedDish(customerId, dishId, recommendationContextId) {
    if (recommendationContextId) {
        const exact = await AIInferenceAudit.exists({
            callerId: customerId,
            capability: 'recommend',
            correlationId: recommendationContextId
        });
        if (exact) return true;
    }
    return !!(await AIInferenceAudit.exists({
        callerId: customerId,
        capability: 'recommend'
    }));
}

async function submitRating({ customerId, dishId, score, comment, recommendationContextId }) {
    if (!(await _customerHasOrderedDish(customerId, dishId))) {
        throw new ValidationError('dish_not_ordered', 'Customer never ordered this dish.');
    }
    if (!(await _customerWasRecommendedDish(customerId, dishId, recommendationContextId))) {
        throw new ValidationError('dish_not_recommended', 'Dish was never recommended to this customer.');
    }
    const update = {
        score,
        comment: comment || undefined,
        recommendationContextId: recommendationContextId
            ? new mongoose.Types.ObjectId(recommendationContextId)
            : undefined,
        createdAt: new Date()
    };
    return await RecommendationRating.findOneAndUpdate(
        { customerId, dishId },
        { $set: update, $setOnInsert: { customerId, dishId } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
}

async function publishEndorsement({ customerId, dishId }) {
    const rating = await RecommendationRating.findOne({ customerId, dishId }).sort({ createdAt: -1 });
    if (!rating) {
        throw new ValidationError('no_rating', 'No rating exists for this customer/dish.');
    }
    if (rating.score < 4) {
        throw new ValidationError('rating_below_threshold', 'Endorsement requires a rating ≥ 4.');
    }
    const handle = handleService.anonymizedHandleFor(customerId);
    return await PublishedRecommendation.findOneAndUpdate(
        { customerId, dishId },
        {
            $set: {
                ratingId: rating._id,
                ratingAtPublish: rating.score,
                anonymizedHandle: handle,
                status: 'published',
                publishedAt: new Date(),
                unpublishedAt: null
            },
            $setOnInsert: { customerId, dishId }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
}

async function unpublishEndorsement({ customerId, dishId }) {
    const updated = await PublishedRecommendation.findOneAndUpdate(
        { customerId, dishId, status: 'published' },
        { $set: { status: 'unpublished', unpublishedAt: new Date() } },
        { new: true }
    );
    if (!updated) {
        throw new NotFoundError('endorsement_not_found', 'No published endorsement to unpublish.');
    }
    return updated;
}

// Public peer-endorsement feed: anonymised diner shout-outs for dishes, newest
// first. Used by the ordering / recipe surfaces to show social proof.
async function listPeerEndorsements(limit = 8) {
    const lim = Math.min(50, Math.max(1, Number(limit) || 8));
    const Dish = require('../../domain/models/Dish');
    const docs = await PublishedRecommendation
        .find({ status: 'published' })
        .sort({ publishedAt: -1 })
        .limit(lim)
        .lean();
    if (docs.length === 0) return [];
    const dishIds = [...new Set(docs.map((d) => String(d.dishId)))];
    const dishes = await Dish.find({ _id: { $in: dishIds } }).select('name price').lean();
    const dishMap = new Map(dishes.map((d) => [String(d._id), d]));
    return docs.map((d) => {
        const dish = dishMap.get(String(d.dishId)) || {};
        return {
            dishId: String(d.dishId),
            name: dish.name || 'Dish',
            dishName: dish.name || 'Dish',
            price: typeof dish.price === 'number' ? dish.price : 0,
            rating: d.ratingAtPublish,
            score: d.ratingAtPublish,
            endorser: d.anonymizedHandle,
            handle: d.anonymizedHandle,
            publishedAt: d.publishedAt
        };
    });
}

// Rating shortcut for a published-recipe dish. Records (or updates) the rating
// and, when it is 4★ or higher, promotes it into a public endorsement.
async function rateRecipe({ customerId, dishId, score }) {
    if (!customerId) throw new ValidationError('customer_required', 'A customer id is required.');
    const numericScore = Number(score);
    if (!Number.isInteger(numericScore) || numericScore < 1 || numericScore > 5) {
        throw new ValidationError('invalid_score', 'Score must be an integer between 1 and 5.');
    }
    if (!mongoose.Types.ObjectId.isValid(dishId)) {
        throw new ValidationError('invalid_dish', 'A valid dish id is required.');
    }

    const rating = await RecommendationRating.findOneAndUpdate(
        { customerId, dishId },
        { $set: { score: numericScore, createdAt: new Date() }, $setOnInsert: { customerId, dishId } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    let published = false;
    if (numericScore >= 4) {
        const handle = handleService.anonymizedHandleFor(customerId);
        await PublishedRecommendation.findOneAndUpdate(
            { customerId, dishId },
            {
                $set: {
                    ratingId: rating._id,
                    ratingAtPublish: numericScore,
                    anonymizedHandle: handle,
                    status: 'published',
                    publishedAt: new Date(),
                    unpublishedAt: null
                },
                $setOnInsert: { customerId, dishId }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        published = true;
    } else {
        // A low rating should retract any earlier public endorsement.
        await PublishedRecommendation.findOneAndUpdate(
            { customerId, dishId, status: 'published' },
            { $set: { status: 'unpublished', unpublishedAt: new Date() } }
        );
    }

    return { ok: true, published };
}

module.exports = {
    getRecommendations,
    submitRating,
    publishEndorsement,
    unpublishEndorsement,
    listPeerEndorsements,
    rateRecipe,
    ValidationError,
    NotFoundError,
    InferenceUnavailableError
};
