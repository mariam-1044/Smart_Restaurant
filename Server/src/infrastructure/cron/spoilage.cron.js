const Ingredient = require('../../domain/models/Ingredient');
const Notification = require('../../domain/models/Notification');
const notificationService = require('../../application/services/notification.service');
const aiService = require('../../application/services/ai.service');
const auditService = require('../../application/services/audit.service');
const logger = require('../config/logger');
const crypto = require('crypto');

const RETRY_DELAYS_MS = [250, 500, 1000];
const TOTAL_BUDGET_MS = 15000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSpoilageCheck({ now } = {}) {
    const start = Date.now();
    const correlationId = crypto.randomUUID();
    const horizon = new Date((now ? now.getTime() : Date.now()) + 3 * 24 * 60 * 60 * 1000);

    const nearExpiry = await Ingredient.find({
        expiryDate: { $lte: horizon },
        quantity: { $gt: 0 }
    });

    if (!nearExpiry || nearExpiry.length === 0) {
        logger.info(`spoilage.cron: no near-expiry ingredients (correlationId=${correlationId})`);
        return { skipped: true, reason: 'no_near_expiry', nearExpiry: [] };
    }

    const ingredientNames = nearExpiry.map((i) => i.name);

    let attempts = 0;
    let lastError = null;
    let recipe = null;

    while (attempts < RETRY_DELAYS_MS.length + 1) {
        if (Date.now() - start >= TOTAL_BUDGET_MS) {
            lastError = lastError || new Error('total_budget_exceeded');
            break;
        }
        try {
            recipe = await aiService.generateRecipe({ ingredients: ingredientNames, style: null });
            break;
        } catch (err) {
            attempts += 1;
            lastError = err;
            if (attempts > RETRY_DELAYS_MS.length) break;
            const delay = RETRY_DELAYS_MS[attempts - 1];
            const remaining = TOTAL_BUDGET_MS - (Date.now() - start);
            if (remaining <= 0) break;
            await sleep(Math.min(delay, remaining));
        }
    }

    const elapsed = Date.now() - start;

    if (recipe) {
        await notificationService.createAlert({
            type: 'spoilage_risk',
            title: 'Spoilage prevention recipe',
            message: recipe.name || 'Suggested recipe to use near-expiry ingredients.',
            targetRole: 'staff',
            relatedEntity: nearExpiry[0]._id,
            entityModel: 'Ingredient',
            payload: {
                ingredients: nearExpiry.map(i => ({ ingredientId: i._id, name: i.name, daysUntilExpiry: Math.ceil((i.expiryDate - new Date()) / 86_400_000) })),
                recipe,
                correlationId
            }
        });
        await auditService.recordInference({
            callerId: null,
            callerRole: 'public',
            capability: 'recipe',
            route: 'cron:spoilage',
            method: 'CRON',
            outcome: 'success',
            latencyMs: elapsed,
            inputSummary: { 'body.ingredients': `<array:${ingredientNames.length}>` },
            errorCode: null,
            correlationId
        });
        return { ok: true, recipe, correlationId, nearExpiry };
    }

    await notificationService.createAlert({
        type: 'spoilage_recipe_failed',
        title: 'Spoilage recipe generation failed',
        message: ingredientNames.join(', '),
        targetRole: 'admin',
        payload: {
            ingredients: ingredientNames,
            attempts: Math.min(attempts, RETRY_DELAYS_MS.length + 1),
            lastError: lastError ? (lastError.reason || lastError.message || String(lastError)) : 'unknown',
            correlationId
        }
    });
    await auditService.recordInference({
        callerId: null,
        callerRole: 'public',
        capability: 'recipe',
        route: 'cron:spoilage',
        method: 'CRON',
        outcome: 'error_upstream',
        latencyMs: elapsed,
        inputSummary: { 'body.ingredients': `<array:${ingredientNames.length}>` },
        errorCode: 'upstream_provider_failed',
        correlationId
    });
    return { ok: false, attempts, lastError, correlationId, nearExpiry };
}

async function emitExpiryNotifications(nearExpiry, now) {
    const today = (now || new Date()).getTime();
    for (const ing of nearExpiry) {
      const daysUntilExpiry = Math.ceil((new Date(ing.expiryDate).getTime() - today) / 86_400_000);
      try {
        await notificationService.createAlert({
          type: 'expiry',
          title: daysUntilExpiry <= 0
            ? `${ing.name} has expired`
            : `${ing.name} expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`,
          message: `${ing.quantity ?? 0} ${ing.unit} remaining; expiry ${new Date(ing.expiryDate).toISOString().slice(0, 10)}.`,
          targetRole: 'admin',
          relatedEntity: ing._id,
          entityModel: 'Ingredient',
          payload: {
            ingredientName: ing.name,
            expiryDate: ing.expiryDate,
            daysUntilExpiry,
            unit: ing.unit,
            remainingQuantity: ing.quantity ?? 0
          }
        });
      } catch (e) {
        logger.warn(`expiry notification failed for ${ing.name}: ${e.message}`);
      }
    }
}

async function runDailyPrune() {
    const cutoffMs = Date.now() - 30 * 86_400_000;

    const candidates = await Notification.find({
      readByAdmin: true,
      readByStaff: true
    }).select('_id readByAdminAt readByStaffAt').lean();

    const toDelete = candidates
      .filter(n => {
        const a = n.readByAdminAt ? new Date(n.readByAdminAt).getTime() : 0;
        const s = n.readByStaffAt ? new Date(n.readByStaffAt).getTime() : 0;
        const latest = Math.max(a, s);
        return latest > 0 && latest < cutoffMs;
      })
      .map(n => n._id);

    if (toDelete.length === 0) {
      logger.info('spoilage.cron prune: nothing to delete');
      return { deleted: 0 };
    }

    const BATCH = 1000;
    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += BATCH) {
      const slice = toDelete.slice(i, i + BATCH);
      const r = await Notification.deleteMany({ _id: { $in: slice } });
      deleted += (r.deletedCount ?? 0);
    }
    logger.info(`spoilage.cron prune: deleted ${deleted} notifications`);
    return { deleted };
}

async function runDailyJob() {
    const result = await runSpoilageCheck();
    if (result?.nearExpiry?.length) {
      await emitExpiryNotifications(result.nearExpiry);
    }
    try {
      await runDailyPrune();
    } catch (e) {
      logger.warn(`spoilage.cron prune failed: ${e.message}`);
    }
    return result;
}

function scheduleSpoilageCron() {
    const cron = require('node-cron');
    return cron.schedule('0 6 * * *', () => {
      runDailyJob().catch((err) => {
        logger.error(`spoilage.cron crashed: ${err.message}`);
      });
    }, {
      timezone: process.env.CRON_TIMEZONE || 'UTC'
    });
}

if (require.main === module && process.argv.includes('--once')) {
    require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
    const connectDB = require('../config/db');
    (async () => {
        try {
            await connectDB();
            const result = await runDailyJob();
            console.log('spoilage.cron result:', JSON.stringify(result));
            process.exit(0);
        } catch (err) {
            console.error('spoilage.cron failed:', err.message);
            process.exit(1);
        }
    })();
}

module.exports = { runSpoilageCheck, emitExpiryNotifications, runDailyPrune, runDailyJob, scheduleSpoilageCron, RETRY_DELAYS_MS, TOTAL_BUDGET_MS };