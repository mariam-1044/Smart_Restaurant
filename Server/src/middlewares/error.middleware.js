const logger = require('../infrastructure/config/logger');

/**
 * Global Error Middleware
 */
exports.errorHandler = (err, req, res, next) => {
    logger.error(`${err.name}: ${err.message}\nStack: ${err.stack}`);

    const statusCode = err.statusCode || 500;
    
    res.status(statusCode).json({
        success: false,
        error: {
            message: err.message || 'Internal Server Error',
            type: err.name || 'ServerError',
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        }
    });
};
