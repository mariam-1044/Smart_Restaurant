const aiService = require('../../application/services/ai.service');
const recipeService = require('../../application/services/recipe.service');
const insightsService = require('../../application/services/insights.service');
const { forecastSchema, recipeSchema, publishRecipeSchema } = require('../validations/ai.validation');
const logger = require('../../infrastructure/config/logger');

function correlationIdOf(res) {
    return (res && res.locals && res.locals.correlationId) || null;
}

function validationError(res, code, message, details) {
    res.locals.errorCode = code;
    return res.status(400).json({
        error: {
            code: 'validation_failed',
            message,
            details: details || undefined,
            correlationId: correlationIdOf(res)
        }
    });
}

exports.forecast = async (req, res) => {
    const { error, value } = forecastSchema.validate(req.body);
    if (error) return validationError(res, 'validation_failed', error.message);

    const Dish = require('../../domain/models/Dish');
    const dishDoc = await Dish.findById(value.dishId).select('name').lean();
    const dishName = dishDoc ? dishDoc.name : 'Unknown dish';

    try {
        const inference = await aiService.predictDemand(value);
        const points = Array.isArray(inference && inference.points) ? inference.points : [];

        let historyStatus = 'sufficient';
        let trailingAverage = 0;
        let spikeAlert = null;
        let staffingSuggestion = null;
        let distinctDays = 0;

        try {
            trailingAverage = await aiService.getTrailing30dAvg(value.dishId);
            const Order = require('../../domain/models/Order');
            const mongoose = require('mongoose');
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const objId = typeof value.dishId === 'string' ? new mongoose.Types.ObjectId(value.dishId) : value.dishId;
            const dayRows = await Order.aggregate([
                { $match: { createdAt: { $gte: thirtyDaysAgo }, status: 'completed', 'items.dish': objId } },
                { $group: { _id: { $dateTrunc: { date: '$createdAt', unit: 'day' } } } }
            ]);
            distinctDays = dayRows.length;

            if (distinctDays < 14) {
                historyStatus = 'insufficient';
            }

            if (historyStatus === 'sufficient' && trailingAverage > 0 && points.length > 0) {
                const peakPoint = points.reduce((max, p) => (p.predicted || 0) > (max.predicted || 0) ? p : max, points[0]);
                const peakQuantity = peakPoint.predicted || 0;
                const ratio = peakQuantity / trailingAverage;
                const baseline = 1.3 * trailingAverage;

                if (peakQuantity > baseline) {
                    spikeAlert = {
                        triggered: true,
                        peakDay: peakPoint.date || peakPoint.ds || '',
                        peakQuantity,
                        baseline,
                        ratio: Math.round(ratio * 100) / 100
                    };
                } else {
                    spikeAlert = { triggered: false, peakDay: '', peakQuantity: 0, baseline: baseline, ratio: Math.round(ratio * 100) / 100 };
                }

                const busiestPoint = points.reduce((max, p) => (p.predicted || 0) > (max.predicted || 0) ? p : max, points[0]);
                const forecastedOrders = busiestPoint.predicted || 0;
                staffingSuggestion = {
                    busiestDay: busiestPoint.date || busiestPoint.ds || '',
                    forecastedOrders,
                    suggestedAddedStaff: Math.max(0, Math.ceil((forecastedOrders - 150) / 50))
                };
            }
        } catch (hintErr) {
            historyStatus = 'insufficient';
        }

        return res.status(200).json({
            success: true,
            data: {
                dishId: value.dishId,
                dishName,
                daysAhead: value.daysAhead,
                generatedAt: new Date().toISOString(),
                historyStatus,
                forecast: (inference.points || []).map(p => ({
                    date: p.date || p.ds || '',
                    predictedQuantity: p.predicted || 0,
                    lowerBound: p.lowerBound ?? (p.predicted || 0) * 0.85,
                    upperBound: p.upperBound ?? (p.predicted || 0) * 1.15
                })),
                trailingAverage: Math.round(trailingAverage * 100) / 100,
                spikeAlert,
                staffingSuggestion
            }
        });
    } catch (err) {
        if (err && err.code === 'inference_unavailable') {
            res.locals.errorCode = 'inference_unavailable';
            return res.status(503).json({
                error: {
                    code: 'inference_unavailable',
                    message: 'ML inference layer is offline. Try again shortly.',
                    correlationId: correlationIdOf(res)
                }
            });
        }
        if (err && err.code === 'cold_start') {
            return res.status(200).json({
                success: true,
                data: {
                    dishId: value.dishId,
                    dishName,
                    daysAhead: value.daysAhead,
                    generatedAt: new Date().toISOString(),
                    historyStatus: 'insufficient',
                    forecast: [],
                    trailingAverage: 0,
                    spikeAlert: null,
                    staffingSuggestion: null,
                    coldStartReason: 'No baseline data available for this dish category.'
                }
            });
        }
        logger.error(`forecast error: ${err.message}`);
        res.locals.errorCode = 'internal_error';
        return res.status(500).json({
            error: {
                code: 'internal_error',
                message: 'Unexpected error computing forecast.',
                correlationId: correlationIdOf(res)
            }
        });
    }
};

function recipeServiceError(res, err) {
    if (err && err.name === 'RecipeServiceError') {
        res.locals.errorCode = err.code;
        return res.status(err.status || 400).json({
            error: { code: err.code, message: err.message, correlationId: correlationIdOf(res) }
        });
    }
    if (err && err.code === 'no_suitable_recipe') {
        res.locals.errorCode = 'no_suitable_recipe';
        return res.status(422).json({
            error: {
                code: 'no_suitable_recipe',
                message: err.message || 'No suitable recipe found',
                correlationId: correlationIdOf(res)
            }
        });
    }
    if (err && err.code === 'upstream_provider_failed') {
        res.locals.errorCode = 'upstream_provider_failed';
        return res.status(502).json({
            error: {
                code: 'upstream_provider_failed',
                message: err.reason || 'Upstream recipe provider failed.',
                correlationId: correlationIdOf(res)
            }
        });
    }
    logger.error(`recipe error: ${err && err.message}`);
    res.locals.errorCode = 'internal_error';
    return res.status(500).json({
        error: {
            code: 'internal_error',
            message: 'Unexpected error generating recipe.',
            correlationId: correlationIdOf(res)
        }
    });
}

exports.recipe = async (req, res) => {
    const { error, value } = recipeSchema.validate(req.body);
    if (error) return validationError(res, 'validation_failed', error.message);

    try {
        const recipe = await recipeService.generateAndSave({
            user: req.user,
            ingredients: value.ingredients,
            style: value.style,
            creativity: value.creativity,
            favoriteIngredients: value.favoriteIngredients
        });
        return res.status(200).json(recipe);
    } catch (err) {
        return recipeServiceError(res, err);
    }
};

exports.recipePersonalized = async (req, res) => {
    try {
        const recipe = await recipeService.generatePersonalizedAndSave({ user: req.user });
        return res.status(200).json(recipe);
    } catch (err) {
        return recipeServiceError(res, err);
    }
};

exports.listRecipes = async (req, res) => {
    try {
        const limit = req.query.limit ? Number(req.query.limit) : 20;
        const items = await recipeService.listForUser(req.user, limit);
        return res.status(200).json({ success: true, data: items });
    } catch (err) {
        logger.error(`listRecipes error: ${err && err.message}`);
        res.locals.errorCode = 'internal_error';
        return res.status(500).json({ success: false, message: 'Failed to load recipe history.' });
    }
};

exports.deleteRecipe = async (req, res) => {
    try {
        await recipeService.deleteForUser(req.user, req.params.id);
        return res.status(200).json({ success: true });
    } catch (err) {
        if (err && err.name === 'RecipeServiceError') {
            res.locals.errorCode = err.code;
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
        logger.error(`deleteRecipe error: ${err && err.message}`);
        res.locals.errorCode = 'internal_error';
        return res.status(500).json({ success: false, message: 'Failed to delete recipe.' });
    }
};

exports.publishRecipe = async (req, res) => {
    const { error, value } = publishRecipeSchema.validate(req.body || {});
    if (error) return res.status(400).json({ success: false, message: error.message });
    try {
        const out = await recipeService.publishToMenu(req.user, req.params.id, value);
        return res.status(201).json({ success: true, data: out });
    } catch (err) {
        if (err && err.name === 'RecipeServiceError') {
            res.locals.errorCode = err.code;
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
        logger.error(`publishRecipe error: ${err && err.message}`);
        res.locals.errorCode = 'internal_error';
        return res.status(500).json({ success: false, message: 'Failed to publish recipe.' });
    }
};

exports.customerFavorites = async (req, res) => {
    try {
        const limit = req.query.limit ? Number(req.query.limit) : 30;
        const items = await recipeService.customerFavoriteIngredients(limit);
        return res.status(200).json({ success: true, data: items });
    } catch (err) {
        logger.error(`customerFavorites error: ${err && err.message}`);
        res.locals.errorCode = 'internal_error';
        return res.status(500).json({ success: false, message: 'Failed to load customer favorites.' });
    }
};

exports.recommendations = async (req, res) => {
    try {
        const out = await insightsService.getBusinessInsights();
        return res.status(200).json({ success: true, data: out.data, didYouKnow: out.didYouKnow, generatedAt: out.generatedAt });
    } catch (err) {
        logger.error(`recommendations insights error: ${err && err.message}`);
        res.locals.errorCode = 'internal_error';
        return res.status(500).json({ success: false, message: 'Failed to compute recommendations.' });
    }
};

exports.marketBasket = async (req, res) => {
    try {
        const out = await aiService.getMarketBasket();
        return res.status(200).json(out);
    } catch (err) {
        logger.error(`marketBasket error: ${err.message}`);
        res.locals.errorCode = 'internal_error';
        return res.status(500).json({
            error: {
                code: 'internal_error',
                message: 'Unexpected error reading market basket.',
                correlationId: correlationIdOf(res)
            }
        });
    }
};

exports.health = async (req, res) => {
    const out = await aiService.health();
    return res.status(200).json(out);
};
