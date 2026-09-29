// In this codebase, a User row with role='customer' represents the diner;
// `req.user._id` is treated as the customerId for the customer-self check.
// Walk-in Customer documents (no User account) are not authenticated and
// never reach these endpoints.

function forbidden(res, correlationId) {
    return res.status(403).json({
        error: {
            code: 'cross_customer_forbidden',
            message: 'You may only access your own customer resources.',
            correlationId: correlationId || null
        }
    });
}

function assertOwnCustomerOrStaff(paramName) {
    const param = paramName || 'customerId';
    return function (req, res, next) {
        if (!req.user) return forbidden(res, res.locals.correlationId);
        const role = req.user.role;
        if (role === 'admin' || role === 'staff') return next();
        if (role === 'customer') {
            const callerCustomerId = String(req.user.customerId || req.user._id);
            if (callerCustomerId === String(req.params[param])) return next();
        }
        res.locals.errorCode = 'cross_customer_forbidden';
        return forbidden(res, res.locals.correlationId);
    };
}

function assertOwnCustomerOnly(paramName) {
    const param = paramName || 'customerId';
    return function (req, res, next) {
        if (!req.user) return forbidden(res, res.locals.correlationId);
        if (req.user.role !== 'customer') {
            res.locals.errorCode = 'cross_customer_forbidden';
            return forbidden(res, res.locals.correlationId);
        }
        const callerCustomerId = String(req.user.customerId || req.user._id);
        if (callerCustomerId !== String(req.params[param])) {
            res.locals.errorCode = 'cross_customer_forbidden';
            return forbidden(res, res.locals.correlationId);
        }
        next();
    };
}

module.exports = { assertOwnCustomerOrStaff, assertOwnCustomerOnly };
