const validate = (schema, source = 'body') => (req, res, next) => {
    const data = source === 'params' ? req.params : source === 'query' ? req.query : req.body;
    const { error } = schema.validate(data, { abortEarly: false });
    
    if (error) {
        const errorMessage = error.details.map(detail => detail.message).join(', ');
        return res.status(400).json({
            success: false,
            message: 'Validation Error',
            errors: errorMessage
        });
    }
    
    next();
};

module.exports = validate;
