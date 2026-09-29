const Joi = require('joi');

const registerSchema = Joi.object({
    name: Joi.string().required().min(2).max(50).messages({
        'string.empty': 'Name is required',
        'string.min': 'Name must be at least 2 characters',
        'string.max': 'Name cannot exceed 50 characters'
    }),
    email: Joi.string().required().email().messages({
        'string.empty': 'Email is required',
        'string.email': 'Please provide a valid email address'
    }),
    password: Joi.string().required().min(8).messages({
        'string.empty': 'Password is required',
        'string.min': 'Password must be at least 8 characters'
    }),
    role: Joi.string().valid('admin', 'staff', 'customer').default('admin')
});

const loginSchema = Joi.object({
    email: Joi.string().required().email().messages({
        'string.empty': 'Email is required',
        'string.email': 'Please provide a valid email address'
    }),
    password: Joi.string().required().min(8).messages({
        'string.empty': 'Password is required',
        'string.min': 'Password must be at least 8 characters'
    })
});

const updateProfileSchema = Joi.object({
    name: Joi.string().min(2).max(50),
    phone: Joi.string().allow(''),
    avatar: Joi.string().allow(''),
    email: Joi.string().email().allow('')
}).min(1).messages({
    'object.min': 'At least one field must be provided for update'
});

const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required().messages({
        'any.required': 'Current password is required',
        'string.empty': 'Current password is required'
    }),
    newPassword: Joi.string().required().messages({
        'any.required': 'New password is required',
        'string.empty': 'New password is required'
    })
});

const updateUserSchema = Joi.object({
    role: Joi.string().valid('admin', 'staff', 'customer').optional(),
    status: Joi.string().valid('pending', 'approved', 'rejected', 'inactive').optional(),
    __version: Joi.number().integer().min(0).required()
}).min(1);

module.exports = {
    registerSchema,
    loginSchema,
    updateProfileSchema,
    changePasswordSchema,
    updateUserSchema
};
