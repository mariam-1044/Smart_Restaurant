const mongoose = require('mongoose');

const recommendationRatingSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true,
        index: true
    },
    dishId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Dish',
        required: true,
        index: true
    },
    recommendationContextId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false
    },
    score: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
        validate: {
            validator: Number.isInteger,
            message: 'score must be an integer in [1,5]'
        }
    },
    comment: {
        type: String,
        maxlength: 500
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

recommendationRatingSchema.index({ customerId: 1, dishId: 1, createdAt: -1 });
recommendationRatingSchema.index({ dishId: 1, score: 1 });

module.exports = mongoose.model('RecommendationRating', recommendationRatingSchema);
