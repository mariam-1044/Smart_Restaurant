const Dish = require('../domain/models/Dish');
const Customer = require('../domain/models/Customer');
const Ingredient = require('../domain/models/Ingredient');

async function verifyOrderExistence(req, res, next) {
    try {
        const items = req.body.items || [];

        const dishIds = items.map(item => item.dish);
        const dishes = await Dish.find({ _id: { $in: dishIds } });
        const foundById = new Map(dishes.map(d => [String(d._id), d]));

        for (let i = 0; i < items.length; i++) {
            const dishDoc = foundById.get(String(items[i].dish));
            if (!dishDoc) {
                return res.status(400).json({
                    success: false,
                    cause: 'dish',
                    errors: [{ field: `items[${i}].dish`, message: 'dish not found or not available' }]
                });
            }
            if (!dishDoc.isAvailable) {
                return res.status(400).json({
                    success: false,
                    cause: 'dish',
                    errors: [{ field: `items[${i}].dish`, message: 'dish not found or not available' }]
                });
            }
        }

        if (req.body.customer) {
            const customer = await Customer.findById(req.body.customer);
            if (!customer) {
                return res.status(400).json({
                    success: false,
                    cause: 'customer',
                    errors: [{ field: 'customer', message: 'customer not found' }]
                });
            }
        }

        res.locals.resolvedDishes = dishes;
        next();
    } catch (err) {
        next(err);
    }
}

async function verifyStockFulfillability(req, res, next) {
    try {
        const items = req.body.items || [];
        const dishes = res.locals.resolvedDishes || [];

        const dishById = new Map(dishes.map(d => [String(d._id), d]));

        const requiredByIngredient = new Map();

        for (const item of items) {
            const dishDoc = dishById.get(String(item.dish));
            if (!dishDoc || !dishDoc.ingredients) continue;

            for (const ing of dishDoc.ingredients) {
                const ingId = String(ing.ingredient);
                const needed = ing.quantity * item.quantity;
                const current = requiredByIngredient.get(ingId) || 0;
                requiredByIngredient.set(ingId, current + needed);
            }
        }

        if (requiredByIngredient.size === 0) {
            return next();
        }

        const ingredients = await Ingredient.find({
            _id: { $in: Array.from(requiredByIngredient.keys()) }
        }).select('name quantity');

        for (const ing of ingredients) {
            const required = requiredByIngredient.get(String(ing._id));
            if (required !== undefined && ing.quantity < required) {
                return res.status(400).json({
                    success: false,
                    cause: 'stock',
                    errors: [{
                        field: ing.name,
                        message: `insufficient stock for ${ing.name}`,
                        required,
                        available: ing.quantity
                    }]
                });
            }
        }

        delete res.locals.resolvedDishes;
        next();
    } catch (err) {
        next(err);
    }
}

module.exports = { verifyOrderExistence, verifyStockFulfillability };