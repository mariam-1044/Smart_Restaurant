const AIInferenceAudit = require('../../domain/models/AIInferenceAudit');
const logger = require('../../infrastructure/config/logger');

async function recordInference({
    callerId = null,
    callerRole,
    capability,
    route,
    method,
    outcome,
    latencyMs,
    inputSummary = {},
    errorCode = null,
    correlationId = null
}) {
    try {
        await AIInferenceAudit.create({
            callerId,
            callerRole,
            capability,
            route,
            method,
            outcome,
            latencyMs,
            inputSummary,
            errorCode,
            correlationId
        });
    } catch (err) {
        logger.error(`audit.recordInference failed: ${err.message}`);
    }
}

module.exports = { recordInference };
