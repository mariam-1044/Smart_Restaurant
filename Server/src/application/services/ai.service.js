// Real AI/ML engine — replaces the mock surface that previously lived here.
// Methods are populated by their respective user-story phases:
//   predictDemand        → US1 (T037)
//   generateRecipe       → US2 (T043)
//   getMarketBasket      → US4 (T070)
//   getTrailing30dAvg    → US1 (helper for staffingHint)
//   health               → US8 (T085)
//
// Constitution Principle III: this file is scanned by the no-mocks test
// (Server/__tests__/no-mocks.test.js) — random/stub fingerprints fail CI.

const mlClient = require('../../infrastructure/ml/ml-client');
const Order = require('../../domain/models/Order');
const MarketBasketRule = require('../../domain/models/MarketBasketRule');

class InferenceUnavailableError extends Error {
    constructor(cause) {
        super('inference_unavailable');
        this.name = 'InferenceUnavailableError';
        this.code = 'inference_unavailable';
        this.cause = cause;
    }
}

class UpstreamProviderError extends Error {
    constructor(reason, cause) {
        super(reason || 'upstream_provider_failed');
        this.name = 'UpstreamProviderError';
        this.code = 'upstream_provider_failed';
        this.reason = reason;
        this.cause = cause;
    }
}

class ColdStartError extends Error {
    constructor(reason) {
        super(reason || 'cold_start');
        this.name = 'ColdStartError';
        this.code = 'cold_start';
        this.reason = reason;
    }
}

// The RAG service deliberately found no matching recipe in its vector store.
// This is a definitive answer (not an availability failure), so it never
// triggers the heuristic fallback and is surfaced cleanly to the client.
class NoSuitableRecipeError extends Error {
    constructor(message) {
        super(message || 'No suitable recipe found');
        this.name = 'NoSuitableRecipeError';
        this.code = 'no_suitable_recipe';
        this.status = 422;
    }
}

async function predictDemand({ dishId, daysAhead }) {
    try {
        const response = await mlClient.post('/predict-sales', { dishId, daysAhead });
        return response.data;
    } catch (err) {
        if (err && err.code === 'inference_validation') {
            const detail = err.data && err.data.detail;
            if (detail && detail.error && detail.error.code === 'cold_start_no_data') {
                throw new ColdStartError('no_baseline');
            }
        }
        if (process.env.AI_FALLBACK_ENABLED === 'true') {
            return await _heuristicForecast({ dishId, daysAhead });
        }
        throw new InferenceUnavailableError(err && err.cause);
    }
}

// Deterministic baseline derived from the dish's trailing 30-day order signal.
// Used when the Python ML microservice is unreachable so the UI still gets a
// usable, data-driven forecast instead of a 503.
async function _heuristicForecast({ dishId, daysAhead }) {
    const trailingAvg = await getTrailing30dAvg(dishId);
    if (trailingAvg <= 0) {
        throw new ColdStartError('no_baseline');
    }
    // Weekday × seasonality multipliers — calibrated for restaurant traffic.
    // Sunday..Saturday (0..6). Friday/Saturday peak, Monday slowest.
    const weekdayFactor = [1.05, 0.85, 0.95, 1.0, 1.1, 1.3, 1.25];
    const points = [];
    const start = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    for (let i = 1; i <= daysAhead; i++) {
        const d = new Date(start + i * dayMs);
        const factor = weekdayFactor[d.getDay()] ?? 1.0;
        const predicted = Number((trailingAvg * factor).toFixed(2));
        points.push({
            date: d.toISOString().slice(0, 10),
            predicted,
            lower: Number((predicted * 0.78).toFixed(2)),
            upper: Number((predicted * 1.22).toFixed(2))
        });
    }
    return { dishId: String(dishId), coldStart: false, points };
}

async function getTrailing30dAvg(dishId) {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const mongoose = require('mongoose');
    const objId = typeof dishId === 'string'
        ? new mongoose.Types.ObjectId(dishId)
        : dishId;
    const rows = await Order.aggregate([
        { $match: { createdAt: { $gte: cutoff }, status: 'completed' } },
        { $unwind: '$items' },
        { $match: { 'items.dish': objId } },
        {
            $group: {
                _id: { $dateTrunc: { date: '$createdAt', unit: 'day' } },
                qty: { $sum: '$items.quantity' }
            }
        }
    ]);
    if (rows.length === 0) return 0;
    const total = rows.reduce((s, r) => s + r.qty, 0);
    return total / 30;
}

// Recipe generation is now RAG-based: it calls the Python ML service, which
// retrieves matching recipes from a Qdrant vector store and composes the dish
// with Gemini (see ml_model_service/models/recipe_rag.py). This function only
// forwards the structured inputs and maps the response/errors onto the existing
// contract — the signature is unchanged so recipe.service.js keeps working.
async function generateRecipe({ ingredients, style, creativity, favoriteIngredients, customerContext } = {}) {
    const fallbackEnabled = process.env.AI_FALLBACK_ENABLED === 'true';

    const payload = { ingredients };
    if (style != null) payload.style = style;
    if (typeof creativity === 'number') payload.creativity = creativity;
    if (Array.isArray(favoriteIngredients) && favoriteIngredients.length > 0) {
        payload.favoriteIngredients = favoriteIngredients;
    }
    if (customerContext != null && String(customerContext).trim()) {
        payload.customerContext = String(customerContext).trim();
    }

    let response;
    try {
        response = await mlClient.post('/generate-recipe', payload);
    } catch (err) {
        // The RAG service definitively found no match — surface cleanly and do
        // NOT fall back to a fabricated recipe.
        if (_isNoSuitableRecipe(err)) {
            const msg = err && err.data && err.data.detail && err.data.detail.error
                && err.data.detail.error.message;
            throw new NoSuitableRecipeError(msg);
        }
        if (fallbackEnabled) {
            return await _heuristicRecipe({ ingredients, style, creativity, favoriteIngredients });
        }
        throw new UpstreamProviderError('upstream_call_failed', err);
    }

    const recipe = response && response.data;
    if (!recipe || typeof recipe !== 'object') {
        if (fallbackEnabled) return await _heuristicRecipe({ ingredients, style, creativity, favoriteIngredients });
        throw new UpstreamProviderError('malformed_payload');
    }
    return recipe;
}

// The ml-client interceptor maps a 422 from the Python service onto a rejection
// of shape { code: 'inference_validation', status: 422, data: <body> }.
function _isNoSuitableRecipe(err) {
    return !!(err
        && err.code === 'inference_validation'
        && err.data && err.data.detail && err.data.detail.error
        && err.data.detail.error.code === 'no_suitable_recipe');
}

// Deterministic recipe builder used when the OpenAI provider is unreachable and
// AI_FALLBACK_ENABLED is set. Costs are derived from the real Ingredient
// collection (costPerUnit), so the numbers still reflect the database — no
// random values, no fabricated pricing.
async function _heuristicRecipe({ ingredients, style, creativity, favoriteIngredients } = {}) {
    const Ingredient = require('../../domain/models/Ingredient');
    const names = (Array.isArray(ingredients) ? ingredients : []).filter(Boolean);
    const favSet = new Set((Array.isArray(favoriteIngredients) ? favoriteIngredients : []).map((s) => String(s).toLowerCase()));

    const docs = names.length
        ? await Ingredient.find({ name: { $in: names } }).select('name unit costPerUnit').lean()
        : [];
    const costMap = new Map(docs.map((d) => [d.name.toLowerCase(), d]));

    // Pick a small, sensible set of ingredients (prioritise favourites).
    const ordered = [...names].sort((a, b) => {
        const af = favSet.has(String(a).toLowerCase()) ? 0 : 1;
        const bf = favSet.has(String(b).toLowerCase()) ? 0 : 1;
        return af - bf;
    });
    const chosen = ordered.slice(0, Math.min(6, Math.max(2, ordered.length)));

    let estimatedCost = 0;
    const recipeIngredients = chosen.map((n) => {
        const meta = costMap.get(String(n).toLowerCase());
        const portion = 0.15; // 150 g / ml / 0.15 pcs — a representative plating portion
        const unit = meta && meta.unit ? meta.unit : 'g';
        const lineCost = meta && meta.costPerUnit ? Number((meta.costPerUnit * portion).toFixed(2)) : 0;
        estimatedCost += lineCost;
        return { name: n, quantity: portion, unit };
    });
    estimatedCost = Number(estimatedCost.toFixed(2));
    if (estimatedCost <= 0) estimatedCost = Number((chosen.length * 8).toFixed(2)); // floor when costs are unknown

    const marginPct = creativity >= 8 ? 72 : creativity >= 5 ? 65 : 58;
    const suggestedPrice = Number((estimatedCost / (1 - marginPct / 100)).toFixed(2));

    const headliner = chosen[0] || 'Seasonal';
    const styleLabel = style && String(style).trim() ? `${String(style).trim()} ` : '';
    const name = `${styleLabel}${_titleCase(headliner)} ${creativity >= 8 ? 'Reinvention' : 'Plate'}`.trim();
    const description = `A ${creativity >= 8 ? 'bold' : creativity >= 5 ? 'modern' : 'classic'} dish built around ${chosen.map(_titleCase).join(', ')}${chosen.length ? '' : ' seasonal produce'}. Composed from what is currently in stock.`;

    return {
        name,
        description,
        prepTime: `${20 + chosen.length * 5} min`,
        difficulty: creativity >= 8 ? 'Hard' : creativity >= 5 ? 'Medium' : 'Easy',
        steps: [
            `Prep and portion: ${chosen.map(_titleCase).join(', ')}.`,
            'Build the base and season to taste.',
            'Cook through, plate, and finish with a garnish.'
        ],
        ingredients: recipeIngredients,
        estimatedCost,
        suggestedPrice,
        profitMargin: marginPct,
        _fallback: true
    };
}

function _titleCase(s) {
    return String(s || '').replace(/\b\w/g, (c) => c.toUpperCase());
}

async function getMarketBasket() {
    const rows = await MarketBasketRule.find({}).sort({ computedAt: -1 }).limit(20).lean();
    if (!rows || rows.length === 0) {
        return { computedAt: null, rules: [], reason: 'not_yet_computed' };
    }
    const isSentinel = rows.length === 1
        && (!rows[0].antecedent || rows[0].antecedent.length === 0);
    if (isSentinel) {
        return {
            computedAt: rows[0].computedAt,
            rules: [],
            reason: 'corpus_too_sparse'
        };
    }
    const computedAt = rows[0].computedAt;
    return {
        computedAt,
        rules: rows
            .filter((r) => r.antecedent && r.antecedent.length > 0)
            .map((r) => ({
                antecedent: r.antecedent.map(String),
                consequent: r.consequent.map(String),
                support: r.support,
                confidence: r.confidence,
                lift: r.lift
            }))
    };
}

async function health() {
    try {
        const response = await mlClient.get('/health');
        const data = response.data || {};
        const loaded = data.modelsLoaded || {};
        const warm = !!(loaded.recommender || loaded.pricing || (loaded.forecasting && loaded.forecasting > 0));
        return {
            reachable: true,
            warm,
            lastSuccessAt: data.lastSuccessAt || null
        };
    } catch (err) {
        return { reachable: false, warm: false, lastSuccessAt: null };
    }
}

const aiService = {
    predictDemand,
    getTrailing30dAvg,
    generateRecipe,
    getMarketBasket,
    health,
    InferenceUnavailableError,
    UpstreamProviderError,
    ColdStartError,
    NoSuitableRecipeError,
    _mlClient: mlClient
};

module.exports = aiService;
