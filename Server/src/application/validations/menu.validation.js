const Joi = require('joi');

const dishSchema = Joi.object({
    name: Joi.string().required().min(1).trim()
        .messages({
            'string.empty': 'name is required',
            'any.required': 'name is required'
        }),
    description: Joi.string().allow(''),
    price: Joi.number().required().min(0)
        .messages({
            'number.min': 'price must be a non-negative number',
            'any.required': 'price is required'
        }),
    category: Joi.string().required().valid('Pizza', 'Grills', 'Drinks', 'Desserts', 'Sides', 'Burgers', 'Pasta', 'Main')
        .messages({
            'any.only': 'category must be a valid category',
            'any.required': 'category is required'
        }),
    imageUrl: Joi.string().allow(''),
    isAvailable: Joi.boolean(),
    ingredients: Joi.array().items(Joi.object({
        ingredient: Joi.string()
            .pattern(/^[0-9a-fA-F]{24}$/)
            .required()
            .messages({
                'string.pattern.base': 'Each ingredient must be a valid ObjectId',
                'any.required': 'ingredient reference is required'
            }),
        quantity: Joi.number().required().min(0)
            .messages({
                'number.min': 'ingredient quantity must be non-negative',
                'any.required': 'ingredient quantity is required'
            })
    })),
    salesCount: Joi.number().min(0),
    __version: Joi.number().integer().min(0).optional()
});

const dishPatchSchema = Joi.object({
    name: Joi.string().min(1).trim().optional(),
    description: Joi.string().allow(''),
    price: Joi.number().min(0).optional(),
    category: Joi.string().valid('Pizza', 'Grills', 'Drinks', 'Desserts', 'Sides', 'Burgers', 'Pasta', 'Main').optional(),
    imageUrl: Joi.string().allow(''),
    isAvailable: Joi.boolean().optional(),
    ingredients: Joi.array().items(Joi.object({
        ingredient: Joi.string()
            .pattern(/^[0-9a-fA-F]{24}$/)
            .optional(),
        quantity: Joi.number().min(0).optional()
    })).optional(),
    salesCount: Joi.number().min(0).optional(),
    __version: Joi.number().integer().min(0).required()
}).min(1);

module.exports = { dishSchema, dishPatchSchema };