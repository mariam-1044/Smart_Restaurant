const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../domain/models/User');
const logger = require('../infrastructure/config/logger');

/**
 * @description Middleware to protect routes - ensures user is logged in.
 */
exports.protect = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'You are not logged in! Please log in to get access.',
                errorType: 'INVALID_TOKEN'
            });
        }

        let decoded;
        try {
            decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET || 'super-secret-key');
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: 'Your session has expired! Please log in again.',
                    errorType: 'TOKEN_EXPIRED'
                });
            }
            return res.status(401).json({
                success: false,
                message: 'Invalid token! Please log in again.',
                errorType: 'INVALID_TOKEN'
            });
        }

        const currentUser = await User.findById(decoded.id);
        if (!currentUser) {
            return res.status(401).json({
                success: false,
                message: 'The user belonging to this token no longer exists.',
                errorType: 'USER_NOT_FOUND'
            });
        }

        if (decoded.version !== undefined && decoded.version !== currentUser.tokenVersion) {
            return res.status(401).json({
                success: false,
                message: 'Token is no longer valid. Please log in again.',
                errorType: 'SESSION_EXPIRED'
            });
        }

        req.user = currentUser;
        next();
    } catch (error) {
        logger.error(`Auth Middleware Error: ${error.message}`);
        return res.status(401).json({
            success: false,
            message: 'Invalid token or session expired.',
            errorType: 'AUTH_ERROR'
        });
    }
};

/**
 * @description Middleware to restrict access based on user roles.
 */
exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to perform this action'
            });
        }
        next();
    };
};
