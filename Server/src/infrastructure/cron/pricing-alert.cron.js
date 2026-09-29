// Price-suggestion notifications (admin only).
// Periodically asks the pricing engine for optimal-price suggestions and raises
// an admin notification for every dish where the engine recommends a materially
// BETTER price than the current one. Nothing is raised when no dish has a
// worthwhile change — the notification only appears "when there is a better
// price suggestion" per product requirement.
//
// This cron NEVER changes a price. It only surfaces the suggestion to the
// manager, who applies/reverts through the existing pricing routes.

const pricingService = require('../../application/services/pricing.service');
const notificationService = require('../../application/services/notification.service');
const auditService = require('../../application/services/audit.service');
const Dish = require('../../domain/models/Dish');
const logger = require('../config/logger');
const crypto = require('crypto');

// A suggestion is "worth telling the admin about" when the engine is reasonably
// confident AND the price move clears a minimum magnitude (avoid noise from
// sub-percent nudges). Tunable via env for demos.
const MIN_ABS_CHANGE = Number(process.env.PRICE_ALERT_MIN_CHANGE || 0.05); // 5%
const MIN_CONFIDENCE = Number(process.env.PRICE_ALERT_MIN_CONFIDENCE || 0.6);

// A prediction is "huge" — and therefore actually worth a notification — when
// it clears a large magnitude, OR is projected to move daily profit by a
// material amount, OR the dish is currently sold below cost (a loss we should
// stop immediately). The product ask: only surface predictions that will
// "cause a profit or save from a loss", not every sub-10% nudge.
const HUGE_ABS_CHANGE = Number(process.env.PRICE_ALERT_HUGE_CHANGE || 0.12); // 12%
const MIN_PROFIT_IMPACT = Number(process.env.PRICE_ALERT_MIN_PROFIT || 20);  // EGP/day

function isActionable(s) {
    if (!s || s.skippedReason) return false;
    if (s.suggestedPrice == null || s.currentPrice == null) return false;
    if (s.suggestedPrice <= 0) return false;
    if (Number(s.suggestedPrice) === Number(s.currentPrice)) return false;
    if (Math.abs(s.percentChange) < MIN_ABS_CHANGE) return false;
    if ((s.confidence ?? 0) < MIN_CONFIDENCE) return false;
    return true;
}

// Among actionable suggestions, keep only the ones with real upside: a large
// move, a material projected profit swing, or a price below cost we should fix.
function isHuge(s) {
    if (!s) return false;
    if (s.lossMaking === true) return true;
    if (Math.abs(s.percentChange ?? 0) >= HUGE_ABS_CHANGE) return true;
    if (s.projectedDailyProfitDelta != null
        && Math.abs(s.projectedDailyProfitDelta) >= MIN_PROFIT_IMPACT) return true;
    return false;
}

// What kind of opportunity is this? Drives the headline and copy.
function classify(s) {
    const raising = s.suggestedPrice > s.currentPrice;
    const lossMaking = s.lossMaking === true || (s.currentMargin != null && s.currentMargin < 0);
    if (lossMaking && raising) return 'loss_prevention';
    if (raising) return 'profit_opportunity';
    return 'demand_capture';
}

function describe(s, dishName) {
    const kind = classify(s);
    const pct = Math.abs((s.percentChange ?? 0) * 100).toFixed(0);
    const name = dishName || 'A dish';
    const conf = Math.round((s.confidence ?? 0) * 100);
    const priceLine = `EGP ${Number(s.currentPrice).toFixed(2)} → EGP ${Number(s.suggestedPrice).toFixed(2)}`;

    let lead;
    let title;
    if (kind === 'loss_prevention') {
        lead = `${name} is selling below cost — raise price ${pct}% to stop the loss`;
        title = `Loss alert: ${name}`;
    } else if (kind === 'profit_opportunity') {
        lead = `${name}: raise price ${pct}% to capture more profit`;
        title = `Profit opportunity: ${name}`;
    } else {
        lead = `${name}: lower price ${pct}% to lift demand`;
        title = `Pricing opportunity: ${name}`;
    }

    let impact = '';
    if (s.projectedDailyProfitDelta != null && Math.abs(s.projectedDailyProfitDelta) >= 0.5) {
        const sign = s.projectedDailyProfitDelta >= 0 ? '+' : '';
        impact = ` Est. impact ${sign}EGP ${Number(s.projectedDailyProfitDelta).toFixed(2)}/day.`;
    }

    return {
        title,
        message: `${lead} — ${priceLine} (${conf}% confidence).${impact}`
    };
}

// Raise an admin notification for every actionable suggestion. Reused by both
// the daily cron and the on-demand admin "suggest" flow so a material price
// prediction surfaces to the manager the moment the model produces it.
// createAlert() dedupes by (type, dish) within 24h, so repeated runs are safe.
async function raisePricingAlerts(suggestions, correlationId = crypto.randomUUID()) {
    // Only surface predictions that are both actionable AND material — a big
    // move, a real projected profit swing, or a below-cost price to rescue.
    const actionable = (suggestions || []).filter((s) => isActionable(s) && isHuge(s));
    if (actionable.length === 0) return 0;

    const ids = actionable.map((s) => s.dishId);
    const dishes = await Dish.find({ _id: { $in: ids } }).select('_id name').lean();
    const nameById = new Map(dishes.map((d) => [String(d._id), d.name]));

    let created = 0;
    for (const s of actionable) {
        const dishName = s.dishName || nameById.get(String(s.dishId));
        const { title, message } = describe(s, dishName);
        try {
            await notificationService.createAlert({
                type: 'price_suggestion',
                title,
                message,
                targetRole: 'admin',
                relatedEntity: s.dishId,
                entityModel: 'Dish',
                payload: {
                    dishId: s.dishId,
                    dishName,
                    kind: classify(s),
                    currentPrice: s.currentPrice,
                    suggestedPrice: s.suggestedPrice,
                    percentChange: s.percentChange,
                    confidence: s.confidence,
                    ingredientCost: s.ingredientCost ?? null,
                    currentMargin: s.currentMargin ?? null,
                    suggestedMargin: s.suggestedMargin ?? null,
                    lossMaking: s.lossMaking ?? false,
                    projectedDailyProfitDelta: s.projectedDailyProfitDelta ?? null,
                    capApplied: s.capApplied,
                    correlationId
                }
            });
            created += 1;
        } catch (e) {
            logger.warn(`pricing-alert: notification failed for dish=${s.dishId}: ${e.message}`);
        }
    }
    return created;
}

async function runPricingAlerts() {
    const start = Date.now();
    const correlationId = crypto.randomUUID();
    let outcome = 'success';
    let errorCode = null;
    let created = 0;

    try {
        const suggestions = await pricingService.getSuggestions();
        created = await raisePricingAlerts(suggestions, correlationId);
        logger.info(`pricing-alert.cron: raised ${created} price suggestions (correlationId=${correlationId})`);
        return { ok: true, created, evaluated: (suggestions || []).length, correlationId };
    } catch (err) {
        outcome = err && err.code === 'inference_unavailable' ? 'error_inference' : 'error_internal';
        errorCode = (err && err.code) || 'unknown';
        logger.error(`pricing-alert.cron: failed code=${errorCode}`);
        return { ok: false, errorCode, created, correlationId };
    } finally {
        try {
            await auditService.recordInference({
                callerId: null,
                callerRole: 'public',
                capability: 'pricing',
                route: 'cron:pricing-alert',
                method: 'CRON',
                outcome,
                latencyMs: Date.now() - start,
                inputSummary: { created },
                errorCode,
                correlationId
            });
        } catch (e) {
            logger.warn(`pricing-alert.cron: audit failed: ${e.message}`);
        }
    }
}

function schedulePricingAlertCron() {
    const cron = require('node-cron');
    // Daily at 04:00 (after the 03:30 basket refresh, before opening hours).
    return cron.schedule('0 4 * * *', () => {
        runPricingAlerts().catch((err) => {
            logger.error(`pricing-alert.cron crashed: ${err.message}`);
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
            const result = await runPricingAlerts();
            console.log('pricing-alert.cron result:', JSON.stringify(result));
            process.exit(0);
        } catch (err) {
            console.error('pricing-alert.cron failed:', err.message);
            process.exit(1);
        }
    })();
}

module.exports = { runPricingAlerts, raisePricingAlerts, schedulePricingAlertCron, isActionable, isHuge, classify, MIN_ABS_CHANGE, MIN_CONFIDENCE, HUGE_ABS_CHANGE, MIN_PROFIT_IMPACT };
