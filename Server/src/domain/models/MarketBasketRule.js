const mongoose = require('mongoose');

const marketBasketRuleSchema = new mongoose.Schema({
    antecedent: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Dish' }],
    consequent: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Dish' }],
    support: { type: Number, required: true, min: 0, max: 1 },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    lift: { type: Number, required: true, min: 0 },
    computedAt: { type: Date, required: true, index: true }
});

marketBasketRuleSchema.index({ computedAt: -1, lift: -1 });

// Bind to the exact collection the Python ML service writes to
// (`market_basket_rules`, per specs data-model.md). Without this, Mongoose
// pluralises to `marketbasketrules` and the Node read path never sees the
// rules the basket cron / ML refresh produces.
module.exports = mongoose.model('MarketBasketRule', marketBasketRuleSchema, 'market_basket_rules');
