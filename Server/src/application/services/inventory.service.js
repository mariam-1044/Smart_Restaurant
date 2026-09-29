const Ingredient = require('../../domain/models/Ingredient');
const notificationService = require('./notification.service');
const logger = require('../../infrastructure/config/logger');

const REORDER_LEAD_TIME_DAYS = Number(process.env.REORDER_LEAD_TIME_DAYS ?? 3);
const REORDER_SAFETY_DAYS    = Number(process.env.REORDER_SAFETY_DAYS    ?? 2);

class InventoryService {
    
    //   Track stock quantity and expiration dates, Send notifications
    
    async checkInventoryHealth() {
        try {
            const ingredients = await Ingredient.find();
            const today = new Date();
            const warningThresholdDays = 3;

            for (const ing of ingredients) {
                // 1.Expiration Tracking
                const expiryDate = new Date(ing.expiryDate);
                const diffTime = expiryDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

if (diffDays <= 0) {
                        if (ing.quantity > 0) {
                        const expiredQty = ing.quantity;
                        ing.wasteQuantity += expiredQty;
                        ing.quantity = 0;
                        await ing.save();
                        logger.warn(`CRITICAL: Ingredient ${ing.name} expired. ${expiredQty} units moved to waste.`);
                        await notificationService.createAlert({
                            type: 'expiry',
                            title: `${ing.name} has expired`,
                            message: `${ing.quantity ?? 0} ${ing.unit} remaining; expiry ${ing.expiryDate.toISOString().slice(0,10)}.`,
                            targetRole: 'admin',
                            relatedEntity: ing._id,
                            entityModel: 'Ingredient',
                            payload: { ingredientName: ing.name, expiryDate: ing.expiryDate, daysUntilExpiry: 0, unit: ing.unit, remainingQuantity: ing.quantity ?? 0 }
                        });
                    }
                } else if (diffDays <= warningThresholdDays) {
                    await notificationService.createAlert({
                        type: 'expiry',
                        title: `${ing.name} expires in ${diffDays} day${diffDays === 1 ? '' : 's'}`,
                        message: `${ing.quantity ?? 0} ${ing.unit} remaining; expiry ${ing.expiryDate.toISOString().slice(0,10)}.`,
                        targetRole: 'admin',
                        relatedEntity: ing._id,
                        entityModel: 'Ingredient',
                        payload: { ingredientName: ing.name, expiryDate: ing.expiryDate, daysUntilExpiry: diffDays, unit: ing.unit, remainingQuantity: ing.quantity ?? 0 }
                    });
                }

                if (ing.quantity <= ing.minStock) {
                    logger.info(`Low stock alert for ${ing.name}: Current ${ing.quantity}, Min ${ing.minStock}`);
                    await notificationService.createAlert({
                        type: 'low_stock',
                        title: `${ing.name} is below minimum stock`,
                        message: `${ing.quantity} ${ing.unit} remaining (min: ${ing.minStock} ${ing.unit}).`,
                        targetRole: 'admin',
                        relatedEntity: ing._id,
                        entityModel: 'Ingredient',
                        payload: { ingredientName: ing.name, currentQuantity: ing.quantity, minStock: ing.minStock, unit: ing.unit }
                    });
                }
            }
            logger.info('Inventory health check completed successfully');
        } catch (error) {
            logger.error(`Inventory health check failed: ${error.message}`);
        }
    }

    /**
     * Food Waste Percentage
     * Calculate food waste percentage
     */
    async calculateTotalWaste() {
        try {
            const ingredients = await Ingredient.find();
            let totalQuantity = 0;
            let totalWaste = 0;

            ingredients.forEach(ing => {
                // الإجمالي هو ما تبقى + ما تم هدره
                totalQuantity += ing.quantity;
                totalWaste += ing.wasteQuantity;
            });

            const totalInitial = totalQuantity + totalWaste;
            const percentage = totalInitial > 0 
                ? ((totalWaste / totalInitial) * 100).toFixed(2) 
                : 0;

            return {
                totalWasteQuantity: totalWaste,
                totalCurrentQuantity: totalQuantity,
                wastePercentage: percentage,
                ingredientsCount: ingredients.length
            };
        } catch (error) {
            logger.error(`Waste Calculation Error: ${error.message}`);
            throw error;
        }
    }

        //   Manual Waste Recording

    async recordManualWaste(ingredientId, amount, reason = 'Manual') {
        try {
            const ingredient = await Ingredient.findById(ingredientId);
            if (!ingredient) throw new Error('Ingredient not found');
            if (ingredient.quantity < amount) throw new Error('Insufficient quantity to waste');

            ingredient.quantity -= amount;
            ingredient.wasteQuantity += amount;
            await ingredient.save();
            
            logger.info(`Manual waste recorded for ${ingredient.name}: ${amount} units. Reason: ${reason}`);
            return ingredient;
        } catch (error) {
            logger.error(`Manual Waste Recording Error: ${error.message}`);
            throw error;
        }
    }

    
    //   CRUD Operations 
     
    async getAllIngredients(query = {}) {
        const filter = {};
        if (query.search) {
            filter.name = { $regex: query.search, $options: 'i' };
        }
        if (query.category) {
            filter.category = query.category;
        }
        return await Ingredient.find(filter).sort({ name: 1 });
    }

    async createIngredient(data) {
        return await Ingredient.create(data);
    }

    async updateIngredient(id, data) {
        return await Ingredient.findByIdAndUpdate(id, data, { new: true });
    }

    async deleteIngredient(id) {
        return await Ingredient.findByIdAndDelete(id);
    }

    async searchIngredients(searchTerm) {
        return await Ingredient.find({ name: { $regex: searchTerm, $options: 'i' } }).sort({ name: 1 });
    }

    async getById(id) {
        try {
            return await Ingredient.findById(id);
        } catch (err) {
            if (err.name === 'CastError') return null;
            throw err;
        }
    }

    async getLowStockIngredients() {
        return await Ingredient.find({ $expr: { $lt: ["$quantity", "$minStock"] } });
    }

    async getExpiredIngredients() {
        const today = new Date();
        return await Ingredient.find({ expiryDate: { $lt: today } });
    }

    async getNearExpiryIngredients(days = 7) {
        const today = new Date();
        const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
        return await Ingredient.find({
            expiryDate: { $gte: today, $lte: futureDate }
        });
    }

    async getInventoryAlerts() {
        const lowStock = await this.getLowStockIngredients();
        const expired = await this.getExpiredIngredients();
        const nearExpiry = await this.getNearExpiryIngredients();

        return {
            lowStock: lowStock.map(i => ({ name: i.name, quantity: i.quantity, minStock: i.minStock })),
            expired: expired.map(i => ({ name: i.name, expiryDate: i.expiryDate })),
            nearExpiry: nearExpiry.map(i => ({ name: i.name, expiryDate: i.expiryDate }))
        };
    }

    async exportRows({ search, category, lowStock, nearExpiry, days } = {}) {
        let rows;
        if (lowStock === 'true' || lowStock === true) {
            rows = await this.getLowStockIngredients();
        } else if (nearExpiry === 'true' || nearExpiry === true) {
            rows = await this.getNearExpiryIngredients(days ? Number(days) : 7);
        } else {
            rows = await this.getAllIngredients({ search, category });
        }
        if (search && (lowStock || nearExpiry)) {
            const re = new RegExp(search, 'i');
            rows = rows.filter(r => re.test(r.name));
        }
        if (category && (lowStock || nearExpiry)) {
            rows = rows.filter(r => r.category === category);
        }
        return rows;
    }

    async runPostOrderInventoryChecks(order) {
        if (!order || !order.items || order.items.length === 0) return;

        const Dish = require('../../domain/models/Dish');
        const dishIds = [...new Set(order.items.map(i => String(i.dish)))];
        const dishes  = await Dish.find({ _id: { $in: dishIds } }).populate('ingredients.ingredient').lean();
        const consumedIngredientIds = new Set();
        for (const d of dishes) {
            for (const link of d.ingredients || []) {
                if (link.ingredient?._id) consumedIngredientIds.add(String(link.ingredient._id));
            }
        }
        if (consumedIngredientIds.size === 0) return;

        const ingredients = await Ingredient.find({ _id: { $in: [...consumedIngredientIds] } }).lean();

        for (const ing of ingredients) {
            if ((ing.quantity ?? 0) <= (ing.minStock ?? 0)) {
                try {
                    await notificationService.createAlert({
                        type: 'low_stock',
                        title: `${ing.name} is below minimum stock`,
                        message: `${ing.quantity} ${ing.unit} remaining (min: ${ing.minStock} ${ing.unit}).`,
                        targetRole: 'admin',
                        relatedEntity: ing._id,
                        entityModel: 'Ingredient',
                        payload: { ingredientName: ing.name, currentQuantity: ing.quantity, minStock: ing.minStock, unit: ing.unit }
                    });
                } catch (e) {
                    require('../../infrastructure/config/logger').warn(`low_stock notification failed for ${ing.name}: ${e.message}`);
                }

                try {
                    const Order = require('../../domain/models/Order');
                    const lookback = new Date(Date.now() - 30 * 86_400_000);
                    const usage = await Order.aggregate([
                        { $match: { status: 'completed', createdAt: { $gte: lookback } } },
                        { $unwind: '$items' },
                        { $lookup: { from: 'dishes', localField: 'items.dish', foreignField: '_id', as: 'd' } },
                        { $unwind: '$d' },
                        { $unwind: '$d.ingredients' },
                        { $match: { 'd.ingredients.ingredient': ing._id } },
                        { $group: {
                            _id: { day: { $dateTrunc: { date: '$createdAt', unit: 'day' } } },
                            qty: { $sum: { $multiply: ['$d.ingredients.quantity', '$items.quantity'] } }
                        } }
                    ]);
                    const daysWithData = usage.length;
                    if (daysWithData < 14) continue;

                    const totalUsage    = usage.reduce((s, r) => s + (r.qty || 0), 0);
                    const avgDailyUsage = totalUsage / 30;
                    if (avgDailyUsage <= 0) continue;

                    const daysUntilDepletion = ing.quantity / avgDailyUsage;
                    if (daysUntilDepletion >= REORDER_LEAD_TIME_DAYS) continue;

                    const targetQuantity   = Math.ceil(avgDailyUsage * (REORDER_LEAD_TIME_DAYS + REORDER_SAFETY_DAYS));
                    const suggestedQuantity = Math.max(0, Math.ceil(targetQuantity - ing.quantity));
                    if (suggestedQuantity <= 0) continue;

                    await notificationService.createAlert({
                        type: 'reorder',
                        title: `Reorder ${ing.name}`,
                        message: `Suggested: order ${suggestedQuantity} ${ing.unit} (covers ${REORDER_LEAD_TIME_DAYS}d lead + ${REORDER_SAFETY_DAYS}d safety).`,
                        targetRole: 'admin',
                        relatedEntity: ing._id,
                        entityModel: 'Ingredient',
                        payload: {
                            ingredientName: ing.name,
                            currentQuantity: ing.quantity,
                            minStock: ing.minStock,
                            avgDailyUsage,
                            daysUntilDepletion,
                            leadTimeDays: REORDER_LEAD_TIME_DAYS,
                            safetyDays: REORDER_SAFETY_DAYS,
                            suggestedQuantity,
                            unit: ing.unit
                        }
                    });
                } catch (e2) {
                    require('../../infrastructure/config/logger').warn(`reorder check failed for ${ing.name}: ${e2.message}`);
                }
            }
        }
    }
}

module.exports = new InventoryService();
