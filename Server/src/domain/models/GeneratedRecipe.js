const mongoose = require('mongoose');

const generatedRecipeSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    style: { type: String, default: '' },
    prepTime: { type: String, default: '' },
    difficulty: { type: String, default: '' },
    whatsNew: { type: String, default: '' },
    whyItMatters: { type: String, default: '' },
    ingredients: [{
        name: { type: String, required: true },
        quantity: { type: mongoose.Schema.Types.Mixed },
        unit: { type: String, default: '' }
    }],
    steps: [{ type: String }],
    estimatedCost: { type: Number, default: 0 },
    suggestedPrice: { type: Number, default: 0 },
    profitMargin: { type: Number, default: 0 },
    inputIngredients: [{ type: String }],
    generatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    generatedByRole: {
        type: String,
        enum: ['admin', 'staff', 'customer'],
        required: true
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft',
        index: true
    },
    publishedDish: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Dish',
        default: null
    },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

generatedRecipeSchema.index({ generatedBy: 1, createdAt: -1 });

module.exports = mongoose.model('GeneratedRecipe', generatedRecipeSchema);
