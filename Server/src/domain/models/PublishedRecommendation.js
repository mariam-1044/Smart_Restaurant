const mongoose = require('mongoose');

const publishedRecommendationSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    dishId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Dish',
        required: true,
        index: true
    },
    ratingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RecommendationRating',
        required: true
    },
    ratingAtPublish: {
        type: Number,
        required: true,
        min: 4,
        max: 5,
        validate: {
            validator: Number.isInteger,
            message: 'ratingAtPublish must be an integer in [4,5]'
        }
    },
    anonymizedHandle: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['published', 'unpublished'],
        default: 'published',
        index: true
    },
    publishedAt: {
        type: Date,
        default: Date.now
    },
    unpublishedAt: {
        type: Date,
        default: null
    }
});

publishedRecommendationSchema.index({ customerId: 1, dishId: 1 }, { unique: true });
publishedRecommendationSchema.index({ dishId: 1, status: 1 });

module.exports = mongoose.model('PublishedRecommendation', publishedRecommendationSchema);
