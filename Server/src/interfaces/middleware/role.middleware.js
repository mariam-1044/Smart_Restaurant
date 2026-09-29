function requireRole(...allowed) {
    return function (req, res, next) {
        if (!req.user || !allowed.includes(req.user.role)) {
            res.locals.errorCode = 'role_forbidden';
            return res.status(403).json({
                error: {
                    code: 'role_forbidden',
                    message: `This route requires one of: ${allowed.join(', ')}.`,
                    correlationId: res.locals.correlationId || null
                }
            });
        }
        next();
    };
}

module.exports = { requireRole };
