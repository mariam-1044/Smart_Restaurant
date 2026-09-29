const Joi = require('joi');

const ingredientSchema = Joi.object({
    name: Joi.string().required().trim(),
    quantity: Joi.number().required().min(0),
    unit: Joi.string().required().valid('kg', 'g', 'l', 'ml', 'pcs'),
    minStock: Joi.number().required().min(0),
    costPerUnit: Joi.number().min(0),
    expiryDate: Joi.date().required(),
    imageUrl: Joi.string()
});

module.exports = {
    ingredientSchema
};
