const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
    dishId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Dish',
        required: true,
        index: true
    },
    priorPrice: { type: Number, required: true, min: 0 },
    newPrice: { type: Number, required: true, min: 0 },
    applierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    applierRole: {
        type: String,
        enum: ['admin', 'staff'],
        required: true
    },
    source: {
        type: String,
        enum: ['manager_apply', 'manager_revert', 'ai_bulk_apply'],
        required: true
    },
    suggestionConfidence: { type: Number, min: 0, max: 1 },
    revertOf: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PriceHistory',
        default: null
    },
    createdAt: { type: Date, default: Date.now, index: true }
});

priceHistorySchema.index({ dishId: 1, createdAt: -1 });
priceHistorySchema.index({ revertOf: 1 }, { sparse: true });

priceHistorySchema.pre('validate', function (next) {
    if (this.source === 'manager_revert' && !this.revertOf) {
        return next(new Error('manager_revert records require revertOf'));
    }
    if (this.source !== 'manager_revert' && this.revertOf) {
        return next(new Error('revertOf only allowed when source=manager_revert'));
    }
    next();
});

module.exports = mongoose.model('PriceHistory', priceHistorySchema);
