// Append-only pricing history (spec FR-027 + Q5 clarification).
// THIS MODULE MUST NOT IMPORT OR USE: PriceHistory.updateOne, updateMany,
// findOneAndUpdate, deleteOne, deleteMany, findOneAndDelete.
// Enforced by Server/__tests__/services/pricing.service.test.js.

const mlClient = require('../../infrastructure/ml/ml-client');
const Dish = require('../../domain/models/Dish');
const PriceHistory = require('../../domain/models/PriceHistory');
const Order = require('../../domain/models/Order');

async function _demandStats(dishId) {
    const mongoose = require('mongoose');
    const objId = typeof dishId === 'string' ? new mongoose.Types.ObjectId(dishId) : dishId;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await Order.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo }, status: 'completed', 'items.dish': objId } },
        { $unwind: '$items' },
        { $match: { 'items.dish': objId } },
        { $group: { _id: null, totalQty: { $sum: '$items.quantity' }, orderCount: { $sum: 1 } } }
    ]);
    if (rows.length === 0) return { score: 0, avgPerDay: 0 };
    const avgPerDay = rows[0].totalQty / 30;
    return { score: Math.min(1, Math.max(0, avgPerDay / 10)), avgPerDay };
}

async function _demandScore(dishId) {
    return (await _demandStats(dishId)).score;
}

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

function _capLabel(percentChange, confidence) {
    if (Math.abs(percentChange) < 0.001) return 'none';
    return confidence >= 0.8 ? 'high_confidence_50pct' : 'low_confidence_25pct';
}

async function getSuggestions() {
    const dishes = await Dish.find({ isAvailable: true }).select('_id name price').lean();
    const calls = dishes.map(async (dish) => {
        try {
            const response = await mlClient.post('/optimize-pricing', { dishId: String(dish._id) });
            const data = response.data || {};
            if (data.skippedReason) {
                return {
                    dishId: String(dish._id),
                    currentPrice: data.currentPrice ?? dish.price,
                    suggestedPrice: null,
                    percentChange: 0,
                    confidence: 0,
                    capApplied: 'none',
                    skippedReason: data.skippedReason
                };
            }
            const currentPrice = data.currentPrice ?? dish.price;
            const suggestedPrice = data.suggestedPrice;
            const percentChange = currentPrice > 0
                ? (suggestedPrice - currentPrice) / currentPrice
                : 0;
            const { score: demandScore, avgPerDay } = await _demandStats(dish._id);

            // Profit/loss context so downstream alerts can tell a "raise to
            // capture profit" suggestion apart from a "raise to stop a loss"
            // one, and quantify the daily impact.
            const ingredientCost = data.ingredientCost ?? null;
            const currentMargin = ingredientCost != null ? Number((currentPrice - ingredientCost).toFixed(2)) : null;
            const suggestedMargin = ingredientCost != null ? Number((suggestedPrice - ingredientCost).toFixed(2)) : null;
            const lossMaking = currentMargin != null ? currentMargin < 0 : false;
            // Estimated change in daily profit if the suggestion is applied,
            // holding demand roughly constant: Δprice × units/day.
            const projectedDailyProfitDelta = Number(((suggestedPrice - currentPrice) * avgPerDay).toFixed(2));

            return {
                dishId: String(dish._id),
                currentPrice,
                suggestedPrice,
                percentChange: Number(percentChange.toFixed(4)),
                confidence: data.confidence,
                demandScore: Number(demandScore.toFixed(2)),
                ingredientCost,
                currentMargin,
                suggestedMargin,
                lossMaking,
                projectedDailyProfitDelta,
                capApplied: _capLabel(percentChange, data.confidence),
                skippedReason: null
            };
        } catch (err) {
            if (process.env.AI_FALLBACK_ENABLED === 'true') {
                return await _heuristicSuggestion(dish);
            }
            throw new InferenceUnavailableError(err && err.cause);
        }
    });
    return await Promise.all(calls);
}

// Deterministic suggestion when the ML pricing model is offline.
// Demand-driven multiplier: hot dishes get a small bump, cold dishes get a
// small discount, mid-range stays put. Keeps the UI usable for the demo.
async function _heuristicSuggestion(dish) {
    const currentPrice = Number(dish.price) || 0;
    const demandScore = await _demandScore(dish._id);
    let multiplier;
    let confidence;
    if (demandScore >= 0.7) {
        multiplier = 1.10;
        confidence = 0.62;
    } else if (demandScore <= 0.3) {
        multiplier = 0.93;
        confidence = 0.58;
    } else {
        multiplier = 1.0;
        confidence = 0.5;
    }
    const suggestedPrice = currentPrice > 0
        ? Number((currentPrice * multiplier).toFixed(2))
        : 0;
    const percentChange = currentPrice > 0
        ? Number(((suggestedPrice - currentPrice) / currentPrice).toFixed(4))
        : 0;
    return {
        dishId: String(dish._id),
        dishName: dish.name,
        currentPrice,
        suggestedPrice,
        percentChange,
        confidence,
        demandScore: Number(demandScore.toFixed(2)),
        capApplied: _capLabel(percentChange, confidence),
        skippedReason: null
    };
}

async function applyPrice({
    dishId,
    newPrice,
    applierId,
    applierRole,
    suggestionConfidence,
    source
}) {
    const dish = await Dish.findById(dishId);
    if (!dish) {
        throw new NotFoundError('dish_not_found', 'Dish not found.');
    }
    const record = await PriceHistory.create({
        dishId,
        priorPrice: dish.price,
        newPrice,
        applierId,
        applierRole,
        source: source || 'manager_apply',
        suggestionConfidence
    });
    dish.price = newPrice;
    await dish.save();
    return record;
}

async function revertPrice({ priceHistoryId, applierId, applierRole }) {
    const original = await PriceHistory.findById(priceHistoryId);
    if (!original) {
        throw new NotFoundError('price_history_not_found', 'Original record not found.');
    }
    const record = await PriceHistory.create({
        dishId: original.dishId,
        priorPrice: original.newPrice,
        newPrice: original.priorPrice,
        applierId,
        applierRole,
        source: 'manager_revert',
        suggestionConfidence: null,
        revertOf: original._id
    });
    const dish = await Dish.findById(original.dishId);
    if (dish) {
        dish.price = original.priorPrice;
        await dish.save();
    }
    return record;
}

async function getHistory(dishId) {
    return await PriceHistory.find({ dishId }).sort({ createdAt: 1 }).lean();
}

module.exports = {
    getSuggestions,
    applyPrice,
    revertPrice,
    getHistory,
    ValidationError,
    NotFoundError,
    InferenceUnavailableError
};
