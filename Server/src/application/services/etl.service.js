const Order = require('../../domain/models/Order');
const Dish = require('../../domain/models/Dish');
const Ingredient = require('../../domain/models/Ingredient');
const logger = require("../../infrastructure/config/logger");

/**
 * Operational analytics pipeline. AI inference (forecasting / market basket /
 * recommendations / pricing) lives in the dedicated AI surface
 * (ai.routes.js, recommendation.routes.js, pricing.routes.js). This pipeline
 * only does deterministic aggregation — never fabricated insights.
 */
class ETLService {
    async runAnalyticsPipeline() {
        try {
            logger.info('Starting ETL Pipeline...');

            const [orders, ingredients, dishes] = await Promise.all([
                Order.find({ status: 'completed' }).populate('items.dish'),
                Ingredient.find(),
                Dish.find().populate('ingredients.ingredient')
            ]);

            const aiReadyData = {
                forecasting: this._prepareForecastingData(orders),
                associationRules: this._prepareMarketBasketData(orders),
                inventoryOptimization: this._prepareInventoryOptimizationData(ingredients, dishes),
                menuPerformance: this._analyzeMenu(dishes)
            };

            const report = {
                timestamp: new Date(),
                financials: this._calculateFinancials(orders),
                inventoryStatus: this._analyzeInventory(ingredients),
                menuPerformance: aiReadyData.menuPerformance,
                salesTrends: this._analyzeTrends(orders),
                wasteAnalytics: this._analyzeWaste(ingredients),
                aiReadyData
            };

            logger.info('ETL Pipeline completed');
            return report;
        } catch (error) {
            logger.error(`ETL Pipeline failed: ${error.message}`);
            throw error;
        }
    }

    _prepareForecastingData(orders) {
        const timeSeries = {};
        orders.forEach(order => {
            const date = order.createdAt.toISOString().split('T')[0];
            const hour = order.createdAt.getHours();
            const key = `${date} H${hour}`;
            if (!timeSeries[key]) timeSeries[key] = 0;
            timeSeries[key] += order.totalPrice;
        });
        return timeSeries;
    }

    _prepareMarketBasketData(orders) {
        return orders.map(order => ({
            orderId: order._id,
            items: order.items.filter(i => i.dish).map(item => item.dish.name)
        }));
    }

    _prepareInventoryOptimizationData(ingredients, dishes) {
        return ingredients.map(ing => ({
            name: ing.name,
            currentStock: ing.quantity,
            minStock: ing.minStock,
            expiryDate: ing.expiryDate,
            usageRate: this._calculateIngredientUsageRate(ing._id, dishes)
        }));
    }

    _calculateIngredientUsageRate(ingredientId, dishes) {
        let rate = 0;
        dishes.forEach(dish => {
            const hasIng = dish.ingredients.find(i => i.ingredient && i.ingredient._id.toString() === ingredientId.toString());
            if (hasIng) {
                rate += (dish.salesCount * hasIng.quantity);
            }
        });
        return rate;
    }

    _calculateFinancials(orders) {
        const totalRevenue = orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
        const totalPaid = orders.reduce((sum, o) => sum + (o.isPaid ? (o.totalPrice || 0) : 0), 0);
        const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;
        // averageOrderValue is the canonical name the dashboard/report UI reads;
        // avgOrderValue is kept as an alias for older callers.
        return {
            totalRevenue,
            totalOrders: orders.length,
            totalPaid,
            avgOrderValue,
            averageOrderValue: avgOrderValue
        };
    }

    _analyzeInventory(ingredients) {
        return {
            lowStock: ingredients.filter(i => i.quantity <= i.minStock).map(i => i.name),
            nearExpiry: ingredients.filter(i => {
                const days = (new Date(i.expiryDate) - new Date()) / (1000 * 60 * 60 * 24);
                return days > 0 && days <= 7;
            }).map(i => i.name),
            expired: ingredients.filter(i => new Date(i.expiryDate) <= new Date()).map(i => i.name)
        };
    }

    _analyzeMenu(dishes) {
        const totalSales = dishes.reduce((sum, d) => sum + d.salesCount, 0);
        return dishes
            .sort((a, b) => b.salesCount - a.salesCount)
            .map(d => ({
                name: d.name,
                sales: d.salesCount,
                percentage: totalSales > 0 ? ((d.salesCount / totalSales) * 100).toFixed(2) : 0
            }));
    }

    _analyzeTrends(orders) {
        const trends = {};
        orders.forEach(o => {
            const date = o.createdAt.toISOString().split('T')[0];
            trends[date] = (trends[date] || 0) + o.totalPrice;
        });
        return trends;
    }

    _analyzeWaste(ingredients) {
        let totalWaste = 0;
        let totalInitial = 0;
        ingredients.forEach(i => {
            totalWaste += (i.wasteQuantity || 0);
            totalInitial += (i.quantity + (i.wasteQuantity || 0));
        });
        return {
            totalWasteQuantity: totalWaste,
            wastePercentage: totalInitial > 0 ? ((totalWaste / totalInitial) * 100).toFixed(2) : 0
        };
    }

    async getAIReadyData() {
        const report = await this.runAnalyticsPipeline();
        return report.aiReadyData;
    }
}

module.exports = new ETLService();
