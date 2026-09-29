const crypto = require('crypto');
const { recordInference } = require('../../application/services/audit.service');

function shapeOf(body, params, query) {
    const summary = {};
    const reduce = (src, prefix) => {
        if (!src || typeof src !== 'object') return;
        for (const key of Object.keys(src)) {
            const v = src[key];
            if (v === null || v === undefined) {
                summary[`${prefix}${key}`] = null;
            } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
                summary[`${prefix}${key}`] = typeof v === 'string' && v.length > 64
                    ? `<string:${v.length}>`
                    : v;
            } else if (Array.isArray(v)) {
                summary[`${prefix}${key}`] = `<array:${v.length}>`;
            } else {
                summary[`${prefix}${key}`] = '<object>';
            }
        }
    };
    reduce(body, 'body.');
    reduce(params, 'params.');
    reduce(query, 'query.');
    return summary;
}

function deriveOutcome(statusCode, explicitErrorCode) {
    if (statusCode >= 200 && statusCode < 300) return 'success';
    if (statusCode === 400) return 'error_validation';
    if (statusCode === 401 || statusCode === 403) return 'error_authz';
    if (statusCode === 502) return 'error_upstream';
    if (statusCode === 503) return 'error_inference';
    if (explicitErrorCode === 'inference_unavailable') return 'error_inference';
    if (explicitErrorCode === 'upstream_provider_failed') return 'error_upstream';
    return 'error_internal';
}

function auditMiddleware(capability) {
    return function (req, res, next) {
        const start = Date.now();
        if (!req.headers['x-correlation-id']) {
            req.headers['x-correlation-id'] = crypto.randomUUID();
        }
        const correlationId = req.headers['x-correlation-id'];
        res.locals.correlationId = correlationId;

        res.on('finish', () => {
            const callerRole =
                (req.user && req.user.role) ? req.user.role : 'public';
            const callerId =
                (req.user && req.user._id) ? req.user._id : null;
            recordInference({
                callerId,
                callerRole,
                capability,
                route: req.originalUrl,
                method: req.method,
                outcome: deriveOutcome(res.statusCode, res.locals.errorCode),
                latencyMs: Date.now() - start,
                inputSummary: shapeOf(req.body, req.params, req.query),
                errorCode: res.locals.errorCode || null,
                correlationId
            });
        });

        next();
    };
}

module.exports = { auditMiddleware, shapeOf, deriveOutcome };
