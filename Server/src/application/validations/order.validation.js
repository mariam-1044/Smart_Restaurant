const Joi = require('joi');

const orderItemSchema = Joi.object({
    dish: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
            'string.pattern.base': 'Each item must have a valid dish ObjectId',
            'any.required': 'Each item must have a dish reference'
        }),
    quantity: Joi.number().integer().min(1).required()
        .messages({
            'number.min': 'Item quantity must be at least 1',
            'any.required': 'Each item must have a quantity'
        })
});

const orderSchema = Joi.object({
    items: Joi.array().items(orderItemSchema).min(1).required()
        .messages({
            'array.min': 'Order must contain at least one item',
            'any.required': 'Order items are required'
        }),
    customerInfo: Joi.object({
        name: Joi.string().allow('').optional(),
        phone: Joi.string().allow('').optional(),
        email: Joi.string().email().allow('').optional(),
        tableNumber: Joi.string().allow('').optional()
    }).optional(),
    customer: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .optional()
        .messages({
            'string.pattern.base': 'Customer must be a valid ObjectId'
        }),
    user: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .optional()
        .messages({
            'string.pattern.base': 'User must be a valid ObjectId'
        }),
    source: Joi.string()
        .valid('POS', 'Online', 'POS_SIMULATOR')
        .optional(),
    paymentMethod: Joi.string()
        .valid('Cash', 'Card', 'Online', 'Wallet')
        .optional(),
    isPaid: Joi.boolean().optional(),
    totalPrice: Joi.number().min(0).optional()
});

module.exports = { orderSchema };