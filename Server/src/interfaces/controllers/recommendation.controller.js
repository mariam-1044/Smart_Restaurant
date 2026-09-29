const recommendationService = require('../../application/services/recommendation.service');
const { rateSchema, publishSchema } = require('../validations/recommendation.validation');
const logger = require('../../infrastructure/config/logger');

function correlationIdOf(res) {
    return (res && res.locals && res.locals.correlationId) || null;
}

function validationError(res, message, details) {
    res.locals.errorCode = 'validation_failed';
    return res.status(400).json({
        error: {
            code: 'validation_failed',
            message,
            details: details || undefined,
            correlationId: correlationIdOf(res)
        }
    });
}

function mapServiceError(err, res) {
    if (err && err.name === 'ValidationError') {
        res.locals.errorCode = err.code;
        return res.status(400).json({
            error: { code: err.code, message: err.message, correlationId: correlationIdOf(res) }
        });
    }
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
    logger.error(`recommendation.controller error: ${err && err.message}`);
    res.locals.errorCode = 'internal_error';
    return res.status(500).json({
        error: {
            code: 'internal_error',
            message: 'Unexpected error.',
            correlationId: correlationIdOf(res)
        }
    });
}

exports.getRecommendations = async (req, res) => {
    const customerId = req.params.customerId;
    try {
        const out = await recommendationService.getRecommendations(customerId);
        if (res.locals) res.locals.recommendationContextId = out.recommendationContextId;
        return res.status(200).json(out);
    } catch (err) {
        return mapServiceError(err, res);
    }
};

exports.submitRating = async (req, res) => {
    const { error, value } = rateSchema.validate(req.body);
    if (error) return validationError(res, error.message);
    const customerId = req.params.customerId;
    try {
        await recommendationService.submitRating({ customerId, ...value });
        return res.status(201).json({ ok: true });
    } catch (err) {
        return mapServiceError(err, res);
    }
};

exports.publishEndorsement = async (req, res) => {
    const { error, value } = publishSchema.validate(req.body);
    if (error) return validationError(res, error.message);
    const customerId = req.params.customerId;
    try {
        const rec = await recommendationService.publishEndorsement({ customerId, dishId: value.dishId });
        return res.status(201).json({ ok: true, _id: rec._id });
    } catch (err) {
        return mapServiceError(err, res);
    }
};

exports.unpublishEndorsement = async (req, res) => {
    const customerId = req.params.customerId;
    const dishId = req.params.dishId;
    try {
        await recommendationService.unpublishEndorsement({ customerId, dishId });
        return res.status(204).send();
    } catch (err) {
        return mapServiceError(err, res);
    }
};

exports.peerEndorsements = async (req, res) => {
    try {
        const limit = req.query.limit ? Number(req.query.limit) : 8;
        const items = await recommendationService.listPeerEndorsements(limit);
        return res.status(200).json({ success: true, data: items });
    } catch (err) {
        return mapServiceError(err, res);
    }
};

exports.rateRecipe = async (req, res) => {
    const userId = req.params.userId;
    const { dishId, score } = req.body || {};
    try {
        const out = await recommendationService.rateRecipe({ customerId: userId, dishId, score });
        return res.status(200).json(out);
    } catch (err) {
        return mapServiceError(err, res);
    }
};
