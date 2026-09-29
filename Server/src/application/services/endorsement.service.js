const PublishedRecommendation = require('../../domain/models/PublishedRecommendation');
const mongoose = require('mongoose');

async function getDishSummary(dishId) {
    const dishObjectId = typeof dishId === 'string'
        ? new mongoose.Types.ObjectId(dishId)
        : dishId;

    const aggregation = await PublishedRecommendation.aggregate([
        { $match: { dishId: dishObjectId, status: 'published' } },
        {
            $group: {
                _id: null,
                count: { $sum: 1 },
                average: { $avg: '$ratingAtPublish' }
            }
        }
    ]);

    const summary = aggregation[0] || { count: 0, average: null };

    const recentDocs = await PublishedRecommendation
        .find({ dishId: dishObjectId, status: 'published' })
        .sort({ publishedAt: -1 })
        .limit(5)
        .lean();

    const recent = recentDocs.map((doc) => ({
        handle: doc.anonymizedHandle,
        score: doc.ratingAtPublish,
        publishedAt: doc.publishedAt
    }));

    return {
        dishId: String(dishId),
        count: summary.count,
        average: summary.count > 0 ? summary.average : null,
        recent
    };
}

module.exports = { getDishSummary };
