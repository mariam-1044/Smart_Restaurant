// Persistence + lifecycle for AI-generated recipes (GeneratedRecipe collection).
// The actual generation (OpenAI / heuristic fallback) lives in ai.service.js;
// this module owns history, deletion, and publishing a recipe into the menu.

const mongoose = require('mongoose');
const GeneratedRecipe = require('../../domain/models/GeneratedRecipe');
const CustomerPreferences = require('../../domain/models/CustomerPreferences');
const Ingredient = require('../../domain/models/Ingredient');
const Order = require('../../domain/models/Order');
const Dish = require('../../domain/models/Dish');
const aiService = require('./ai.service');

const DISH_CATEGORIES = ['Pizza', 'Grills', 'Drinks', 'Desserts', 'Sides', 'Burgers', 'Pasta', 'Main'];

class ServiceError extends Error {
    constructor(code, message, status) {
        super(message || code);
        this.name = 'RecipeServiceError';
        this.code = code;
        this.status = status || 400;
    }
}

function _num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function _normalizeGenerated(raw) {
    const ingredients = Array.isArray(raw && raw.ingredients)
        ? raw.ingredients.map((it) => {
            if (typeof it === 'string') return { name: it, quantity: null, unit: '' };
            return {
                name: String(it && it.name ? it.name : '').slice(0, 80),
                quantity: it && it.quantity != null ? it.quantity : null,
                unit: it && it.unit ? String(it.unit).slice(0, 16) : ''
            };
        }).filter((i) => i.name)
        : [];
    const steps = Array.isArray(raw && raw.steps)
        ? raw.steps.map((s) => String(s)).filter(Boolean).slice(0, 30)
        : [];
    const estimatedCost = _num(raw && raw.estimatedCost, 0);
    let suggestedPrice = _num(raw && raw.suggestedPrice, 0);
    if (suggestedPrice <= 0 && estimatedCost > 0) suggestedPrice = Number((estimatedCost * 2.5).toFixed(2));
    return {
        name: String(raw && raw.name ? raw.name : 'Generated Recipe').slice(0, 120),
        description: String(raw && raw.description ? raw.description : ''),
        style: String(raw && raw.style ? raw.style : ''),
        prepTime: String(raw && raw.prepTime ? raw.prepTime : '').slice(0, 40),
        difficulty: String(raw && raw.difficulty ? raw.difficulty : '').slice(0, 20),
        whatsNew: String(raw && (raw.whatsNew || raw.whatIsNew) ? (raw.whatsNew || raw.whatIsNew) : '').slice(0, 600),
        whyItMatters: String(raw && (raw.whyItMatters || raw.whyImportant) ? (raw.whyItMatters || raw.whyImportant) : '').slice(0, 600),
        ingredients,
        steps,
        estimatedCost,
        suggestedPrice,
        profitMargin: _num(raw && raw.profitMargin, suggestedPrice > 0 ? Math.round(((suggestedPrice - estimatedCost) / suggestedPrice) * 100) : 0)
    };
}

async function _inStockIngredientNames(limit = 25) {
    const docs = await Ingredient.find({ quantity: { $gt: 0 } }).select('name').limit(limit).lean();
    return docs.map((d) => d.name);
}

// --- Generation entry points -------------------------------------------------

async function generateAndSave({ user, ingredients, style, creativity, favoriteIngredients }) {
    const names = (Array.isArray(ingredients) ? ingredients : []).filter(Boolean);
    if (names.length === 0) {
        throw new ServiceError('no_ingredients', 'Pick at least one ingredient.', 400);
    }
    const raw = await aiService.generateRecipe({
        ingredients: names,
        style,
        creativity,
        favoriteIngredients
    });
    return _persist({ user, raw, inputIngredients: names, style });
}

async function generatePersonalizedAndSave({ user }) {
    const prefs = user && user._id
        ? await CustomerPreferences.findOne({ user: user._id }).lean()
        : null;

    const inStock = await _inStockIngredientNames(25);
    let ingredients = inStock;
    if ((!ingredients || ingredients.length === 0) && prefs && Array.isArray(prefs.favoriteIngredients)) {
        ingredients = prefs.favoriteIngredients.slice();
    }
    if (!ingredients || ingredients.length === 0) {
        throw new ServiceError('no_ingredients', 'No ingredients in stock to build a recipe from.', 400);
    }

    // Recent dishes this user has ordered (User-account customers only).
    let recentDishNames = [];
    try {
        if (user && user._id) {
            const rows = await Order.aggregate([
                { $match: { user: new mongoose.Types.ObjectId(user._id) } },
                { $unwind: '$items' },
                { $group: { _id: '$items.dish', qty: { $sum: '$items.quantity' } } },
                { $sort: { qty: -1 } },
                { $limit: 5 }
            ]);
            const dishDocs = await Dish.find({ _id: { $in: rows.map((r) => r._id) } }).select('name').lean();
            recentDishNames = dishDocs.map((d) => d.name);
        }
    } catch (_e) { recentDishNames = []; }

    const ctxParts = [];
    if (prefs) {
        if (Array.isArray(prefs.cuisines) && prefs.cuisines.length) ctxParts.push(`Preferred cuisines: ${prefs.cuisines.join(', ')}.`);
        if (Array.isArray(prefs.dietary) && prefs.dietary.filter((d) => d && d !== 'none').length) ctxParts.push(`Dietary needs: ${prefs.dietary.filter((d) => d && d !== 'none').join(', ')}.`);
        if (prefs.spiceLevel) ctxParts.push(`Spice tolerance: ${prefs.spiceLevel}.`);
        if (Array.isArray(prefs.allergies) && prefs.allergies.length) ctxParts.push(`Must avoid (allergies): ${prefs.allergies.join(', ')}.`);
    }
    if (recentDishNames.length) ctxParts.push(`This diner recently enjoyed: ${recentDishNames.join(', ')}.`);
    const customerContext = ctxParts.length
        ? `Personalise for this returning diner. ${ctxParts.join(' ')}`
        : 'Personalise for a returning diner with no recorded preferences yet — keep it broadly appealing.';

    const favoriteIngredients = prefs && Array.isArray(prefs.favoriteIngredients) ? prefs.favoriteIngredients : [];

    const raw = await aiService.generateRecipe({
        ingredients,
        creativity: 6,
        favoriteIngredients,
        customerContext
    });
    return _persist({ user, raw, inputIngredients: ingredients, style: raw && raw.style ? raw.style : '', personalized: true });
}

async function _persist({ user, raw, inputIngredients, style }) {
    const norm = _normalizeGenerated(raw);
    const doc = await GeneratedRecipe.create({
        name: norm.name,
        description: norm.description,
        style: style || norm.style || '',
        prepTime: norm.prepTime,
        difficulty: norm.difficulty,
        whatsNew: norm.whatsNew,
        whyItMatters: norm.whyItMatters,
        ingredients: norm.ingredients,
        steps: norm.steps,
        estimatedCost: norm.estimatedCost,
        suggestedPrice: norm.suggestedPrice,
        profitMargin: norm.profitMargin,
        inputIngredients: Array.isArray(inputIngredients) ? inputIngredients.slice(0, 50) : [],
        generatedBy: user._id,
        generatedByRole: user.role,
        status: 'draft'
    });
    return doc.toObject();
}

// --- History / deletion ------------------------------------------------------

async function listForUser(user, limit = 20) {
    const lim = Math.min(100, Math.max(1, Number(limit) || 20));
    // Admin/staff see the whole studio history; customers see only their own.
    const filter = (user.role === 'admin' || user.role === 'staff')
        ? {}
        : { generatedBy: user._id };
    return GeneratedRecipe.find(filter).sort({ createdAt: -1 }).limit(lim).lean();
}

async function deleteForUser(user, id) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new ServiceError('not_found', 'Recipe not found.', 404);
    const recipe = await GeneratedRecipe.findById(id);
    if (!recipe) throw new ServiceError('not_found', 'Recipe not found.', 404);
    const isOwner = String(recipe.generatedBy) === String(user._id);
    const isStaff = user.role === 'admin' || user.role === 'staff';
    if (!isOwner && !isStaff) throw new ServiceError('forbidden', 'You can only delete your own recipes.', 403);
    if (recipe.status === 'published') throw new ServiceError('already_published', 'Published recipes cannot be deleted.', 409);
    await recipe.deleteOne();
    return true;
}

// --- Publish to menu ---------------------------------------------------------

async function publishToMenu(user, id, { price, category } = {}) {
    if (!(user.role === 'admin' || user.role === 'staff')) {
        throw new ServiceError('forbidden', 'Only staff can publish recipes to the menu.', 403);
    }
    if (!mongoose.Types.ObjectId.isValid(id)) throw new ServiceError('not_found', 'Recipe not found.', 404);
    const recipe = await GeneratedRecipe.findById(id);
    if (!recipe) throw new ServiceError('not_found', 'Recipe not found.', 404);
    if (recipe.status === 'published' && recipe.publishedDish) {
        throw new ServiceError('already_published', 'This recipe was already published.', 409);
    }

    const finalPrice = _num(price, recipe.suggestedPrice);
    if (!(finalPrice > 0)) throw new ServiceError('invalid_price', 'A positive price is required.', 400);
    const finalCategory = DISH_CATEGORIES.includes(category) ? category : 'Main';

    let dish;
    try {
        dish = await Dish.create({
            name: recipe.name,
            description: recipe.description,
            price: finalPrice,
            category: finalCategory,
            isAvailable: true,
            priceHistory: [{ price: finalPrice, changedAt: new Date(), changedBy: user._id }]
        });
    } catch (err) {
        if (err && err.code === 11000) {
            throw new ServiceError('dish_name_taken', 'A dish with this name already exists.', 409);
        }
        throw err;
    }

    recipe.status = 'published';
    recipe.publishedDish = dish._id;
    recipe.publishedAt = new Date();
    recipe.publishedBy = user._id;
    await recipe.save();

    return { dish: dish.toObject(), recipe: recipe.toObject() };
}

// --- Customer favourites (for the staff recipe generator) --------------------

async function customerFavoriteIngredients(limit = 30) {
    const lim = Math.min(100, Math.max(1, Number(limit) || 30));
    const rows = await CustomerPreferences.aggregate([
        { $unwind: '$favoriteIngredients' },
        {
            $group: {
                _id: { $toLower: { $trim: { input: '$favoriteIngredients' } } },
                name: { $first: '$favoriteIngredients' },
                count: { $sum: 1 }
            }
        },
        { $match: { _id: { $ne: '' } } },
        { $sort: { count: -1, name: 1 } },
        { $limit: lim }
    ]);
    return rows.map((r) => ({ name: r.name, count: r.count }));
}

module.exports = {
    generateAndSave,
    generatePersonalizedAndSave,
    listForUser,
    deleteForUser,
    publishToMenu,
    customerFavoriteIngredients,
    ServiceError,
    DISH_CATEGORIES
};
