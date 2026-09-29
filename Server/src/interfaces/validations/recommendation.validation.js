const Joi = require('joi');

const mongoId = Joi.string().length(24).hex();

const rateSchema = Joi.object({
    dishId: mongoId.required(),
    score: Joi.number().integer().min(1).max(5).required(),
    comment: Joi.string().max(500).allow('').optional(),
    recommendationContextId: mongoId.optional()
});

const publishSchema = Joi.object({
    dishId: mongoId.required()
});

module.exports = { rateSchema, publishSchema };
