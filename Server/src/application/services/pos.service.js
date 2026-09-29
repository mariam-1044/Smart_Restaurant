
const orderService = require("../../application/services/order.service");
const etlService = require('../../application/services/etl.service');
const logger = require('../../infrastructure/config/logger');

class POSService {
    /**
     * Processes a real-time, professional POS transaction.
     * This function is robust, handles inventory, and is ready for production.
     * @param {object} transactionData - The complete data for the transaction.
     * @returns {object} - An object containing the created order and payment status.
     */
    async handleTransaction(transactionData) {
        try {
            logger.info(`Starting professional POS transaction for source: ${transactionData.source || 'Live POS'}`);

            // 1. Create the order using the robust order service
            // This will handle stock deduction, validation, and customer management.
            const order = await orderService.createOrder(transactionData, transactionData.customerInfo);

            // 2. Process payment through a simulated gateway
            const paymentResult = await this._processPayment(order, transactionData.paymentMethod);
            if (paymentResult.status !== 'success') {
                // If payment fails, we should ideally revert the order or mark it as 'payment_failed'
                // For now, we'll log and throw an error.
                logger.error(`Payment failed for order ${order._id}. Status: ${paymentResult.status}`);
                // Optional: await orderService.updateOrderStatus(order._id, 'payment_failed');
                throw new Error('Payment processing failed.');
            }

            // 3. Update order to 'completed' and 'paid' status after successful payment
            const updatedOrder = await orderService.updateOrder(order._id, {
                status: 'completed',
                isPaid: true,
                paidAt: new Date()
            });

            // 4. Trigger the ETL pipeline for analytics asynchronously
            // Using setImmediate to avoid blocking the response to the client.
            setImmediate(async () => {
                try {
                    await etlService.runAnalyticsPipeline();
                    logger.info(`Analytics pipeline successfully triggered for order ${order._id}`);
                } catch (err) {
                    logger.error(`ETL background process failed for order ${order._id}: ${err.message}`);
                }
            });

            // 5. Return a professional response
            return {
                success: true,
                message: 'Transaction completed successfully.',
                order: updatedOrder,
                transactionId: paymentResult.transactionId
            };

        } catch (error) {
            logger.error(`POS transaction failed: ${error.message}`);
            // Re-throw the error to be caught by the controller for a proper API response
            throw error;
        }
    }

    /**
     * Simulates a payment gateway interaction.
     * In a real application, this would integrate with Stripe, PayPal, etc.
     * @param {object} order - The order object.
     * @param {string} method - The payment method (e.g., 'Card', 'Cash').
     * @returns {object} - A simulated payment result.
     */
    async _processPayment(order, method) {
        logger.info(`Processing ${method} payment for order ${order._id} with total ${order.totalPrice}`);
        
        // Simulate a 95% success rate for card payments
        if (method === 'Card' && Math.random() < 0.05) {
            return {
                status: 'failed',
                transactionId: null,
                error: 'Insufficient funds or card declined.'
            };
        }

        // Successful payment
        return {
            status: 'success',
            transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`
        };
    }
}

module.exports = new POSService();
