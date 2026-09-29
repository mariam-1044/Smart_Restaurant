const etlService = require("../../application/services/etl.service");
const inventoryService = require("../../application/services/inventory.service");
const salesService = require("../../application/services/sales.service");
const Ingredient = require("../../domain/models/Ingredient");
const Dish = require("../../domain/models/Dish");
const Order = require("../../domain/models/Order");
const logger = require("../../infrastructure/config/logger");

exports.getAdminDashboard = async (req, res) => {
    try {
        logger.info('Fetching dashboard statistics...');
        
        // 1. Run Analytics Pipeline to get latest data
        const etlReport = await etlService.runAnalyticsPipeline();

        // 2. Get Inventory Alerts (Low stock, Expired) directly from service for real-time accuracy
        const inventoryAlertsData = await inventoryService.getInventoryAlerts();
        
        // 3. Get Waste Analytics
        const wasteAnalytics = await inventoryService.calculateTotalWaste();

        // 4. Build waste breakdown by ingredient, category, and trend
        const ingredients = await Ingredient.find().lean();
        const byIngredient = ingredients
            .filter(i => (i.wasteQuantity || 0) > 0)
            .map(i => ({ ingredientId: i._id, ingredientName: i.name, quantity: i.wasteQuantity, value: (i.wasteQuantity || 0) * (i.costPerUnit || 0) }))
            .sort((a, b) => b.value - a.value);

        const dishes = await Dish.find().populate('ingredients.ingredient', 'name wasteQuantity costPerUnit').lean();
        const ingToDishCat = new Map();
        dishes.forEach(d => {
            (d.ingredients || []).forEach(link => {
                const ingId = link.ingredient?._id?.toString();
                if (ingId) ingToDishCat.set(ingId, d.category || 'Other');
            });
        });
        const categoryMap = {};
        ingredients.forEach(i => {
            const cat = ingToDishCat.get(i._id.toString()) || 'Other';
            if (!categoryMap[cat]) categoryMap[cat] = { quantity: 0, value: 0 };
            categoryMap[cat].quantity += (i.wasteQuantity || 0);
            categoryMap[cat].value += (i.wasteQuantity || 0) * (i.costPerUnit || 0);
        });
        const byCategory = Object.entries(categoryMap).map(([category, data]) => ({ category, ...data }));

        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const prevMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
        const prevMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0, 23, 59, 59, 999);

        const prevMonthOrders = await Order.aggregate([
            { $match: { createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd }, status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$totalPrice' } } }
        ]);
        const prevMonthValue = prevMonthOrders.length > 0 ? prevMonthOrders[0].total : 0;

        const currentMonthTotalValue = byIngredient.reduce((s, i) => s + i.value, 0);
        let reductionPctVsLastMonth = 0;
        if (prevMonthValue > 0) {
            reductionPctVsLastMonth = parseFloat((((prevMonthValue - currentMonthTotalValue) / prevMonthValue) * 100).toFixed(1));
        }

        const trendDays = 7;
        const trend = [];
        for (let d = trendDays - 1; d >= 0; d--) {
            const day = new Date();
            day.setDate(day.getDate() - d);
            day.setHours(0, 0, 0, 0);
            const nextDay = new Date(day);
            nextDay.setDate(nextDay.getDate() + 1);
            const dayWaste = ingredients
                .filter(i => {
                    const restocked = i.lastRestocked;
                    return restocked && restocked >= day && restocked < nextDay;
                })
                .reduce((s, i) => s + (i.wasteQuantity || 0), 0);
            trend.push({
                date: day.toISOString().slice(0, 10),
                quantity: dayWaste,
                value: dayWaste * (ingredients.reduce((s, i) => s + (i.costPerUnit || 0), 0) / Math.max(ingredients.length, 1))
            });
        }

        const waste = {
            summary: {
                monthTotalQuantity: wasteAnalytics.totalWasteQuantity || 0,
                monthTotalValue: currentMonthTotalValue,
                previousMonthTotalValue: prevMonthValue,
                reductionPctVsLastMonth
            },
            byIngredient,
            byCategory,
            trend
        };

        const { aiReadyData, financials, menuPerformance, salesTrends } = etlReport;

        // Live order/payment signals straight from the Orders collection so the
        // report & dashboard always show the real numbers (including seeded data).
        const paymentSummary = await salesService.getPaymentSummary();
        const transactions = await salesService.getRecentTransactions(40);
        const financialsWithPayments = {
            ...financials,
            totalPaid: paymentSummary.totalPaid,
            pendingOrders: paymentSummary.pendingCount,
            pendingValue: paymentSummary.pendingValue
        };

        const inventoryAlerts = {
            lowStockCount: inventoryAlertsData.lowStock.length,
            expiredCount: inventoryAlertsData.expired.length,
            details: {
                lowStockItems: inventoryAlertsData.lowStock.map(i => i.name),
                expiredItems: inventoryAlertsData.expired.map(i => i.name)
            }
        };

        res.set('Cache-Control', 'no-store');
        res.status(200).json({
            success: true,
            data: {
                forecast: aiReadyData.forecasting,
                associationRules: aiReadyData.associationRules,
                topDishes: aiReadyData.menuPerformance,
                inventoryAlerts,
                financials: financialsWithPayments,
                paymentSummary,
                transactions,
                menuPerformance,
                salesTrends,
                waste,
                wasteAnalytics,
                timestamp: new Date()
            }
        });
    } catch (error) {
        logger.error(`Dashboard Controller Error: ${error.message}`);
        res.status(500).json({ success: false, message: error.message });
    }
};