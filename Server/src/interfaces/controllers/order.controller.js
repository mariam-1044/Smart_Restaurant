const orderService = require('../../application/services/order.service');
const logger = require('../../infrastructure/config/logger');

exports.createOrder = async (req, res) => {
    try {
        const { items, customerInfo, source, paymentMethod, isPaid } = req.body;
        
        const finalCustomerInfo = req.user.role === 'customer' ? {
            name: req.user.name,
            email: req.user.email,
            phone: req.user.phone || customerInfo?.phone,
            tableNumber: customerInfo?.tableNumber
        } : customerInfo;

        const order = await orderService.createOrder({ items, paymentMethod, isPaid }, finalCustomerInfo);
        res.status(201).json({ success: true, data: order });
    } catch (error) {
        logger.error(`Controller Error [createOrder]: ${error.message}`);
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getOrderById = async (req, res) => {
    try {
        const order = await orderService.getOrderById(req.params.id);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        res.status(200).json({ success: true, data: order });
    } catch (error) {
        logger.error(`Controller Error [getOrderById]: ${error.message}`);
        res.status(500).json({ success: false, message: 'Error fetching order', error: error.message });
    }
};

exports.getOrders = async (req, res) => {
    try {
        const orders = await orderService.getAllOrders(req.query);
        res.status(200).json({ success: true, count: orders.length, data: orders });
    } catch (error) {
        logger.error(`Controller Error [getOrders]: ${error.message}`);
        res.status(500).json({ success: false, message: 'Error fetching orders', error: error.message });
    }
};

exports.updateOrder = async (req, res) => {
    try {
        const order = await orderService.updateOrder(req.params.id, req.body);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        res.status(200).json({ success: true, data: order });
    } catch (error) {
        logger.error(`Controller Error [updateOrder]: ${error.message}`);
        res.status(400).json({ success: false, message: error.message });
    }
};

const ORDER_STATUSES = ['pending', 'preparing', 'completed', 'cancelled'];

exports.updateOrderStatus = async (req, res) => {
    try {
        const { status, isPaid } = req.body || {};
        if (!status || !ORDER_STATUSES.includes(status)) {
            return res.status(400).json({ success: false, message: `status must be one of: ${ORDER_STATUSES.join(', ')}` });
        }
        const order = await orderService.updateOrderStatus(req.params.id, status, { markPaid: isPaid === true });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        res.status(200).json({ success: true, data: order });
    } catch (error) {
        logger.error(`Controller Error [updateOrderStatus]: ${error.message}`);
        const code = /not found/i.test(error.message) ? 404 : 400;
        res.status(code).json({ success: false, message: error.message });
    }
};

exports.deleteOrder = async (req, res) => {
    try {
        const result = await orderService.deleteOrder(req.params.id);
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        logger.error(`Controller Error [deleteOrder]: ${error.message}`);
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.integrityReport = async (req, res) => {
    try {
        const report = await orderService.getIntegrityReport();
        res.status(200).json({ success: true, data: report });
    } catch (error) {
        logger.error(`Controller Error [integrityReport]: ${error.message}`);
        res.status(500).json({ success: false, message: 'Error generating integrity report' });
    }
};
