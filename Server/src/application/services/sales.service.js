const Order = require('../../domain/models/Order');

const PERIOD_LABELS = { daily: 'today', weekly: 'this week', monthly: 'this month', seasonal: 'this season' };

class SalesService {
    /**
     * Sales report for a period — every number is derived from the Orders
     * collection, so it always matches what is actually in the database.
     *  - revenue / order counts / popular dishes: COMPLETED orders only
     *  - totalPaid: any non-cancelled order flagged isPaid
     *  - transactions: the most recent orders in the window, all statuses
     */
    async getSalesReport(period = 'daily') {
        const startDate = this._getStartDate(period);

        const ordersInWindow = await Order.find({ createdAt: { $gte: startDate } })
            .populate('items.dish', 'name')
            .populate('customer', 'name phone')
            .sort({ createdAt: -1 })
            .lean();

        const completed = ordersInWindow.filter((o) => o.status === 'completed');
        const totalRevenue = completed.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
        const totalOrders = completed.length;
        const pendingCount = ordersInWindow.filter((o) => o.status === 'pending').length;
        const cancelledCount = ordersInWindow.filter((o) => o.status === 'cancelled').length;
        const paidOrders = ordersInWindow.filter((o) => o.isPaid && o.status !== 'cancelled');
        const totalPaid = paidOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

        // Popular dishes (by units), from completed orders.
        const dishStats = {};
        completed.forEach((order) => {
            (order.items || []).forEach((item) => {
                if (!item.dish) return;
                const dishId = String(item.dish._id);
                if (!dishStats[dishId]) {
                    dishStats[dishId] = { dishId, name: item.dish.name, count: 0, revenue: 0 };
                }
                dishStats[dishId].count += item.quantity || 0;
                dishStats[dishId].revenue += (item.priceAtTime || 0) * (item.quantity || 0);
            });
        });
        const popularDishes = Object.values(dishStats)
            .sort((a, b) => b.count - a.count)
            .map((dish) => ({
                ...dish,
                percentage: totalRevenue > 0 ? Number(((dish.revenue / totalRevenue) * 100).toFixed(2)) : 0
            }));
        // Alias shape the Sales page expects: { name, orders, revenue }.
        const topDishes = popularDishes.map((d) => ({ name: d.name, orders: d.count, revenue: Math.round(d.revenue) }));

        return {
            period,
            periodLabel: PERIOD_LABELS[period] || period,
            startDate,
            totalRevenue,
            totalOrders,
            totalPaid,
            pendingCount,
            cancelledCount,
            averageOrderValue: totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0,
            popularDishes,
            topDishes,
            salesTrends: this._buildSalesTrends(completed, period),
            transactions: this._normalizeTransactions(ordersInWindow.slice(0, 40))
        };
    }

    /** Recent orders (all statuses), newest first — used by the dashboard/report. */
    async getRecentTransactions(limit = 40, since = null) {
        const query = since ? { createdAt: { $gte: since } } : {};
        const orders = await Order.find(query)
            .populate('items.dish', 'name')
            .populate('customer', 'name phone')
            .sort({ createdAt: -1 })
            .limit(Math.min(200, Math.max(1, Number(limit) || 40)))
            .lean();
        return this._normalizeTransactions(orders);
    }

    /** Aggregate payment numbers across all orders (or since a date). */
    async getPaymentSummary(since = null) {
        const match = since ? { createdAt: { $gte: since } } : {};
        const rows = await Order.aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    totalPaid: { $sum: { $cond: [{ $and: ['$isPaid', { $ne: ['$status', 'cancelled'] }] }, '$totalPrice', 0] } },
                    paidCount: { $sum: { $cond: [{ $and: ['$isPaid', { $ne: ['$status', 'cancelled'] }] }, 1, 0] } },
                    pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                    pendingValue: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$totalPrice', 0] } },
                    orderCount: { $sum: 1 }
                }
            }
        ]);
        const r = rows[0] || {};
        return {
            totalPaid: r.totalPaid || 0,
            paidCount: r.paidCount || 0,
            pendingCount: r.pendingCount || 0,
            pendingValue: r.pendingValue || 0,
            orderCount: r.orderCount || 0
        };
    }

    _normalizeTransactions(orders) {
        return (orders || []).map((o) => {
            const items = (o.items || []).map((it) => ({
                name: it.dish && it.dish.name ? it.dish.name : 'Dish',
                quantity: it.quantity || 0,
                price: it.priceAtTime || 0
            }));
            const itemsLabel = items.length
                ? items.map((i) => `${i.quantity}× ${i.name}`).join(', ')
                : '—';
            return {
                _id: String(o._id),
                createdAt: o.createdAt,
                items,
                itemsLabel,
                total: o.totalPrice || 0,
                status: o.status,
                isPaid: !!o.isPaid,
                paidAt: o.paidAt || null,
                source: o.source || 'POS',
                paymentMethod: o.paymentMethod || 'Cash',
                customerName: o.customer && o.customer.name ? o.customer.name : 'Walk-in'
            };
        });
    }

    _buildSalesTrends(completedOrders, period) {
        const trends = {};
        const fmtDay = (d) => new Date(d).toISOString().slice(0, 10);
        const fmtHour = (d) => `${String(new Date(d).getHours()).padStart(2, '0')}:00`;
        const bucket = period === 'daily' ? fmtHour : fmtDay;
        for (const o of completedOrders) {
            const key = bucket(o.createdAt);
            trends[key] = (trends[key] || 0) + (o.totalPrice || 0);
        }
        Object.keys(trends).forEach((k) => { trends[k] = Math.round(trends[k] * 100) / 100; });
        return trends;
    }

    _getStartDate(period) {
        const date = new Date();
        switch (period) {
            case 'weekly':
                date.setDate(date.getDate() - 7);
                break;
            case 'monthly':
                date.setMonth(date.getMonth() - 1);
                break;
            case 'seasonal':
                date.setMonth(date.getMonth() - 3);
                break;
            case 'daily':
            default:
                date.setHours(0, 0, 0, 0);
                break;
        }
        return date;
    }
}

module.exports = new SalesService();
