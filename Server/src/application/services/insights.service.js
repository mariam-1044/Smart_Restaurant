// Business "smart recommendations" surface for the admin dashboard.
// Every insight here is derived from real collections (Order, Dish, Ingredient,
// MarketBasketRule) — there are no fabricated numbers. If the data is too thin
// to support an insight, it is simply omitted.

const mongoose = require('mongoose');
const Order = require('../../domain/models/Order');
const Dish = require('../../domain/models/Dish');
const Ingredient = require('../../domain/models/Ingredient');
const MarketBasketRule = require('../../domain/models/MarketBasketRule');

function _egp(n) {
    return `EGP ${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
}

async function _menuOptimizationInsight() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await Order.aggregate([
        { $match: { createdAt: { $gte: since }, status: 'completed' } },
        { $unwind: '$items' },
        {
            $group: {
                _id: '$items.dish',
                units: { $sum: '$items.quantity' },
                revenue: { $sum: { $multiply: ['$items.priceAtTime', '$items.quantity'] } }
            }
        },
        { $sort: { units: -1 } },
        { $limit: 1 }
    ]);
    if (rows.length === 0 || !rows[0]._id) return null;
    const top = rows[0];
    const dish = await Dish.findById(top._id).select('name price').lean();
    if (!dish) return null;
    const currentPrice = Number(dish.price) || 0;
    const bumpPct = 5;
    const monthlyUplift = currentPrice * (bumpPct / 100) * top.units;
    return {
        title: 'Menu Optimization',
        description: `"${dish.name}" sold ${top.units} unit${top.units === 1 ? '' : 's'} in the last 30 days (${_egp(top.revenue)} revenue). A ${bumpPct}% price increase — from ${_egp(currentPrice)} to ${_egp(currentPrice * (1 + bumpPct / 100))} — is unlikely to dent demand for a proven best-seller.`,
        impact: `+ ${_egp(monthlyUplift)}/mo`,
        type: 'marketing'
    };
}

async function _wastePreventionInsight() {
    const horizon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const item = await Ingredient.findOne({
        expiryDate: { $lte: horizon, $gte: new Date() }
    }).sort({ expiryDate: 1, quantity: -1 }).lean();
    if (!item) return null;
    const daysLeft = Math.max(0, Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
    const atRiskValue = (Number(item.quantity) || 0) * (Number(item.costPerUnit) || 0);
    return {
        title: 'Waste Prevention',
        description: `${item.quantity} ${item.unit} of "${item.name}" expire${daysLeft === 1 ? 's' : 's'} in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Run a same-day special that leans on it before it has to be thrown out${atRiskValue > 0 ? ` — about ${_egp(atRiskValue)} of stock is at risk` : ''}.`,
        impact: atRiskValue > 0 ? `Save ~${_egp(atRiskValue)}` : 'Cut waste',
        type: 'waste'
    };
}

async function _stockAlertInsight() {
    const low = await Ingredient.aggregate([
        { $match: { $expr: { $lte: ['$quantity', '$minStock'] } } },
        { $addFields: { deficit: { $subtract: ['$minStock', '$quantity'] } } },
        { $sort: { deficit: -1 } },
        { $limit: 1 }
    ]);
    if (low.length === 0) return null;
    const it = low[0];
    const reorderQty = Math.max(it.minStock - it.quantity, Math.ceil(it.minStock * 0.5));
    return {
        title: 'Stock Alert',
        description: `"${it.name}" is down to ${it.quantity} ${it.unit} (minimum is ${it.minStock} ${it.unit}). Reorder at least ${reorderQty} ${it.unit} to stay above the safety threshold.`,
        impact: 'Avoid stockout',
        type: 'alert'
    };
}

async function _pairingInsight() {
    // Prefer a precomputed market-basket rule; fall back to live co-occurrence.
    const rule = await MarketBasketRule.findOne({ antecedent: { $exists: true, $ne: [] } })
        .sort({ lift: -1, confidence: -1 })
        .lean();
    const nameFor = async (ids) => {
        const docs = await Dish.find({ _id: { $in: ids } }).select('name').lean();
        const map = new Map(docs.map((d) => [String(d._id), d.name]));
        return ids.map((id) => map.get(String(id)) || 'a dish');
    };
    if (rule && Array.isArray(rule.antecedent) && rule.antecedent.length && Array.isArray(rule.consequent) && rule.consequent.length) {
        const a = await nameFor(rule.antecedent);
        const c = await nameFor(rule.consequent);
        const pct = Math.round((Number(rule.confidence) || 0) * 100);
        return `When customers order ${a.join(' + ')}, ${pct}% also order ${c.join(' + ')}. Bundle them into a combo to lift average order value.`;
    }

    // Live fallback: most frequent 2-dish co-occurrence in the last 60 days.
    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const recent = await Order.find({ createdAt: { $gte: since }, status: 'completed' }).select('items.dish').lean();
    const counts = new Map();
    for (const o of recent) {
        const ids = [...new Set((o.items || []).map((i) => String(i.dish)).filter(Boolean))];
        for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
                const key = [ids[i], ids[j]].sort().join('|');
                counts.set(key, (counts.get(key) || 0) + 1);
            }
        }
    }
    let best = null;
    for (const [key, n] of counts) {
        if (!best || n > best.n) best = { key, n };
    }
    if (!best || best.n < 2) return null;
    const [id1, id2] = best.key.split('|');
    const [n1, n2] = await nameFor([id1, id2]);
    return `"${n1}" and "${n2}" were ordered together ${best.n} times in the last 60 days. A combo deal on the pair could nudge average order value up.`;
}

async function getBusinessInsights() {
    const [menu, waste, stock, didYouKnow] = await Promise.all([
        _menuOptimizationInsight().catch(() => null),
        _wastePreventionInsight().catch(() => null),
        _stockAlertInsight().catch(() => null),
        _pairingInsight().catch(() => null)
    ]);

    const data = [menu, waste, stock].filter(Boolean);

    if (data.length === 0) {
        data.push({
            title: 'Not enough data yet',
            description: 'Once you have completed orders and stocked ingredients, this page will surface pricing, waste, and reorder recommendations computed from your live data.',
            impact: 'Pending',
            type: 'alert'
        });
    }

    return {
        data,
        didYouKnow: didYouKnow || null,
        generatedAt: new Date().toISOString()
    };
}

module.exports = { getBusinessInsights };
