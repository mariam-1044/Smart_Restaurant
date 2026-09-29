const Joi = require('joi');

// Reusable: matches a 24-char Mongo ObjectId hex string.
const mongoId = Joi.string().length(24).hex().required();

const forecastSchema = Joi.object({
    dishId: mongoId,
    daysAhead: Joi.number().valid(7, 30).required()
});

const recipeSchema = Joi.object({
    ingredients: Joi.array().items(Joi.string().min(1)).min(1).required(),
    style: Joi.string().max(50).optional().allow(null, ''),
    creativity: Joi.number().integer().min(0).max(10).optional(),
    favoriteIngredients: Joi.array().items(Joi.string().min(1).max(60)).max(20).optional()
});

const publishRecipeSchema = Joi.object({
    price: Joi.number().positive().required(),
    category: Joi.string().max(40).optional().allow(null, '')
});

module.exports = { forecastSchema, recipeSchema, publishRecipeSchema, mongoId };
