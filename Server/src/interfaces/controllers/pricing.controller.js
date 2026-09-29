const pricingService = require('../../application/services/pricing.service');
const Dish = require('../../domain/models/Dish');
const { applySchema, revertSchema, bulkApplySchema } = require('../validations/pricing.validation');
const logger = require('../../infrastructure/config/logger');
const { raisePricingAlerts } = require('../../infrastructure/cron/pricing-alert.cron');

// Price changes are backed by Dish.priceHistory (append-only array on the Dish document,
// capped to the last 10 entries via $slice). This is the source of truth for recentHistory
// shown in PricingCard and for revert lookups. See spec FR-027, T013.

function correlationIdOf(res) {
    return (res && res.locals && res.locals.correlationId) || null;
}

function validationError(res, code, message) {
    res.locals.errorCode = code;
    return res.status(400).json({
        error: { code: 'validation_failed', message, correlationId: correlationIdOf(res) }
    });
}

function mapServiceError(err, res) {
    if (err && err.name === 'NotFoundError') {
        res.locals.errorCode = err.code;
        return res.status(404).json({
            error: { code: err.code, message: err.message, correlationId: correlationIdOf(res) }
        });
    }
    if (err && err.code === 'inference_unavailable') {
        res.locals.errorCode = 'inference_unavailable';
        return res.status(503).json({
            error: {
                code: 'inference_unavailable',
                message: 'ML inference layer is offline.',
                correlationId: correlationIdOf(res)
            }
        });
    }
    logger.error(`pricing.controller error: ${err && err.message}`);
    res.locals.errorCode = 'internal_error';
    return res.status(500).json({
        error: { code: 'internal_error', message: 'Unexpected error.', correlationId: correlationIdOf(res) }
    });
}

exports.suggest = async (req, res) => {
    try {
        const items = await pricingService.getSuggestions();
        const enriched = items.map(item => ({
            ...item,
            currentPrice: item.currentPrice ?? item.currentPrice,
            suggestedPrice: item.suggestedPrice ?? item.suggestedPrice,
            direction: item.suggestedPrice > item.currentPrice ? 'up' : item.suggestedPrice < item.currentPrice ? 'down' : 'none',
            __version: 0
        }));
        for (const item of enriched) {
            const dish = await Dish.findById(item.dishId).select('version name priceHistory').lean();
            item.__version = dish ? dish.version : 0;
            item.dishName = item.dishName || dish?.name || 'Unknown';
            item.recentHistory = (dish?.priceHistory || []).slice(-3).map(h => ({ price: h.price, changedAt: h.changedAt }));
        }
        // Surface materially large predictions to the admin as notifications the
        // moment the model produces them (deduped by dish within 24h). Best-effort:
        // never let notification raising fail the suggestions response.
        try {
            const raised = await raisePricingAlerts(items, correlationIdOf(res));
            if (raised > 0) logger.info(`pricing.suggest: raised ${raised} price-suggestion notifications`);
        } catch (e) {
            logger.warn(`pricing.suggest: alert raising failed: ${e.message}`);
        }

        return res.status(200).json({ success: true, data: enriched });
    } catch (err) {
        return mapServiceError(err, res);
    }
};

exports.apply = async (req, res) => {
    // Bulk apply: { dishIds: string[], __versions: { [dishId]: number } } or single: { dishId, newPrice, confidence }
    if (req.body.dishIds && Array.isArray(req.body.dishIds)) {
        const { dishIds, __versions } = req.body;
        const applied = [];
        const conflicts = [];
        const failed = [];

        for (const dishId of dishIds) {
            try {
                const dish = await Dish.findById(dishId);
                if (!dish) {
                    failed.push({ dishId, errorType: 'not_found', message: 'Dish not found' });
                    continue;
                }
                const expectedVersion = __versions?.[dishId] ?? 0;
                const rec = await pricingService.getSuggestions();
                const suggestion = rec.find(r => String(r.dishId) === String(dishId));
                if (!suggestion || suggestion.skippedReason) {
                    failed.push({ dishId, errorType: 'no_suggestion', message: suggestion?.skippedReason || 'No suggestion available' });
                    continue;
                }
                const oldPrice = dish.price;
                const newPrice = suggestion.suggestedPrice;
                const result = await Dish.findOneAndUpdate(
                    { _id: dishId, version: expectedVersion },
                    {
                        $set: { price: newPrice },
                        $push: { priceHistory: { $each: [{ price: newPrice, changedAt: new Date(), changedBy: req.user?._id ?? null }], $slice: -10 } },
                        $inc: { version: 1 }
                    },
                    { new: true }
                );
                if (!result) {
                    const fresh = await Dish.findById(dishId).select('version');
                    conflicts.push({ dishId, currentVersion: fresh ? fresh.version : null, message: 'This record was changed by another admin. Please refresh.' });
                } else {
                    applied.push({ dishId, oldPrice, newPrice });
                    await pricingService.applyPrice({
                        dishId,
                        newPrice,
                        applierId: req.user._id,
                        applierRole: req.user.role,
                        suggestionConfidence: suggestion.confidence,
                        source: 'ai_bulk_apply'
                    });
                }
            } catch (err) {
                failed.push({ dishId, errorType: 'error', message: err.message });
            }
        }
        return res.status(200).json({ success: true, data: { applied, conflicts, failed } });
    }

    // Single apply (existing behavior)
    const { error, value } = applySchema.validate(req.body);
    if (error) return validationError(res, 'validation_failed', error.message);
    if (value.bulk && value.confidence < 0.5) {
        return validationError(
            res,
            'low_confidence_excluded_from_bulk',
            'Bulk apply rejects suggestions with confidence < 0.5 (FR-028).'
        );
    }
    try {
        const record = await pricingService.applyPrice({
            dishId: value.dishId,
            newPrice: value.newPrice,
            applierId: req.user._id,
            applierRole: req.user.role,
            suggestionConfidence: value.confidence,
            source: value.bulk ? 'ai_bulk_apply' : 'manager_apply'
        });
        return res.status(201).json(record);
    } catch (err) {
        return mapServiceError(err, res);
    }
};

exports.revert = async (req, res) => {
    const { error, value } = revertSchema.validate(req.body);
    if (error) return validationError(res, 'validation_failed', error.message);

    // If dishId + __version is provided, revert by looking up the previous price from priceHistory
    if (value.dishId || req.body.dishId) {
        const dishId = value.dishId || req.body.dishId;
        const expectedVersion = value.__version || req.body.__version || 0;
        const dish = await Dish.findById(dishId);
        if (!dish) {
            return res.status(404).json({ success: false, message: 'Dish not found' });
        }
        if (!dish.priceHistory || dish.priceHistory.length < 2) {
            return res.status(400).json({ success: false, message: 'No previous price to revert to' });
        }
        const sortedHistory = [...dish.priceHistory].sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));
        const previousPrice = sortedHistory[1].price;
        const result = await Dish.findOneAndUpdate(
            { _id: dishId, version: expectedVersion },
            {
                $set: { price: previousPrice },
                $push: { priceHistory: { $each: [{ price: previousPrice, changedAt: new Date(), changedBy: req.user?._id ?? null }], $slice: -10 } },
                $inc: { version: 1 }
            },
            { new: true }
        );
        if (!result) {
            const fresh = await Dish.findById(dishId).select('version');
            return res.status(409).json({
                success: false,
                errorType: 'VERSION_CONFLICT',
                message: 'This record was changed by another admin. Please refresh to see the latest version.',
                currentVersion: fresh ? fresh.version : null
            });
        }
        await pricingService.applyPrice({
            dishId,
            newPrice: previousPrice,
            applierId: req.user._id,
            applierRole: req.user.role,
            suggestionConfidence: null,
            source: 'manager_revert'
        });
        return res.status(200).json({ success: true, data: result });
    }

    try {
        const record = await pricingService.revertPrice({
            priceHistoryId: value.priceHistoryId,
            applierId: req.user._id,
            applierRole: req.user.role
        });
        return res.status(201).json(record);
    } catch (err) {
        return mapServiceError(err, res);
    }
};

exports.history = async (req, res) => {
    try {
        const rows = await pricingService.getHistory(req.params.dishId);
        return res.status(200).json(rows);
    } catch (err) {
        return mapServiceError(err, res);
    }
};