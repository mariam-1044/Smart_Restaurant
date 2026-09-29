const mlClient = require('../ml/ml-client');
const auditService = require('../../application/services/audit.service');
const logger = require('../config/logger');
const crypto = require('crypto');

async function runBasketRefresh() {
    const start = Date.now();
    const correlationId = crypto.randomUUID();
    let outcome = 'success';
    let errorCode = null;
    try {
        const response = await mlClient.post('/market-basket/refresh');
        logger.info(`basket.cron: refresh complete ruleCount=${(response.data || {}).ruleCount}`);
        return { ok: true, data: response.data, correlationId };
    } catch (err) {
        outcome = err && err.code === 'inference_unavailable' ? 'error_inference' : 'error_internal';
        errorCode = (err && err.code) || 'unknown';
        logger.error(`basket.cron: refresh failed code=${errorCode}`);
        return { ok: false, errorCode, correlationId };
    } finally {
        await auditService.recordInference({
            callerId: null,
            callerRole: 'public',
            capability: 'market_basket_refresh',
            route: 'cron:basket',
            method: 'CRON',
            outcome,
            latencyMs: Date.now() - start,
            inputSummary: {},
            errorCode,
            correlationId
        });
    }
}

function scheduleBasketCron() {
    const cron = require('node-cron');
    return cron.schedule('30 3 * * *', () => {
        runBasketRefresh().catch((err) => {
            logger.error(`basket.cron crashed: ${err.message}`);
        });
    });
}

module.exports = { runBasketRefresh, scheduleBasketCron };
