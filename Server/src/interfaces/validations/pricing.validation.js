const Joi = require('joi');

const mongoId = Joi.string().length(24).hex();

const applySchema = Joi.object({
    dishId: mongoId.required(),
    newPrice: Joi.number().min(0).required(),
    confidence: Joi.number().min(0).max(1).required(),
    bulk: Joi.boolean().default(false),
    __version: Joi.number().integer().optional(),
    __versions: Joi.object().pattern(Joi.string(), Joi.number().integer())
});

const revertSchema = Joi.object({
    priceHistoryId: mongoId.optional(),
    dishId: mongoId.optional(),
    __version: Joi.number().integer().min(0).optional()
}).min(1);

const bulkApplySchema = Joi.object({
    dishIds: Joi.array().items(mongoId).min(1).required(),
    __versions: Joi.object().pattern(Joi.string(), Joi.number().integer()),
    confidence: Joi.number().min(0).max(1).optional()
});

module.exports = { applySchema, revertSchema, bulkApplySchema };
