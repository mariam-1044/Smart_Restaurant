
const Order = require("../../domain/models/Order");
const { findOrCreateCustomer, updateCustomerOrderHistory, addCustomerSpend } = require("./customer.service");
const Dish = require("../../domain/models/Dish");
const Ingredient = require("../../domain/models/Ingredient");
const notificationService = require("./notification.service");
const logger = require("../../infrastructure/config/logger");

class OrderService {
    /**
     * Creates a new order, deducting ingredients and updating sales counts.
     * @param {object} orderData - Data for the new order.
     * @param {object} [customerInfo=null] - Optional customer information.
     * @returns {Promise<Order>} The created order document.
     */
    async createOrder(orderData, customerInfo = null) {
        try {
            let totalPrice = 0;
            const processedItems = [];

            // 1. Pre-check availability of dishes and ingredients
            for (const item of orderData.items) {
                const dish = await Dish.findById(item.dish).populate("ingredients.ingredient");
                if (!dish || !dish.isAvailable) {
                    throw new Error(`Dish ${item.dish} is not available or does not exist.`);
                }

                // Check stock for each ingredient in the dish
                for (const ing of dish.ingredients) {
                    const requiredQty = ing.quantity * item.quantity;
                    const ingredient = ing.ingredient;

                    if (!ingredient || ingredient.quantity < requiredQty) {
                        throw new Error(`Insufficient stock for ${ingredient ? ingredient.name : 'unknown ingredient'}. Required: ${requiredQty}, Available: ${ingredient ? ingredient.quantity : 0}`);
                    }
                }
                
                totalPrice += dish.price * item.quantity;
                processedItems.push({
                    dish: dish._id,
                    quantity: item.quantity,
                    priceAtTime: dish.price,
                    imageUrlAtTime: dish.imageUrl,
                    ingredients: dish.ingredients // Store for later deduction
                });
            }

            // 2. Deduct ingredients from stock and update dish sales count
            for (const item of processedItems) {
                await this._deductIngredients(item.ingredients, item.quantity);
                await Dish.findByIdAndUpdate(item.dish, { $inc: { salesCount: item.quantity } });
            }

            // 3. Process customer data (find or create)
            let customer = null;
            if (customerInfo && customerInfo.phone) {
                customer = await findOrCreateCustomer(customerInfo.name, customerInfo.phone);
                orderData.customer = customer._id;
            }

            // 4. Save the order record
            const order = new Order({
                items: processedItems.map(i => ({
                    dish: i.dish,
                    quantity: i.quantity,
                    priceAtTime: i.priceAtTime,
                    imageUrlAtTime: i.imageUrlAtTime
                })),
                totalPrice,
                tableNumber: customerInfo?.tableNumber,
                customer: orderData.customer,
                source: orderData.source || 'POS',
                paymentMethod: orderData.paymentMethod || 'Cash',
                status: orderData.status || 'pending',
                isPaid: orderData.isPaid || false,
                paidAt: orderData.isPaid ? new Date() : null
            });

            await order.save();

            // 5. Update customer's order history and preferences
            if (customer) {
                await updateCustomerOrderHistory(customer._id, order._id, processedItems, { paid: !!order.isPaid });
            }

            // 6. Send notification to admin (asynchronous)
            setImmediate(async () => {
                try {
                    await notificationService.createAlert({
                        type: 'system',
                        title: `New order received`,
                        message: `Order #${String(order._id).slice(-6)} — total $${(order.totalPrice ?? 0).toFixed(2)}.`,
                        targetRole: 'staff',
                        relatedEntity: order._id,
                        entityModel: 'Order',
                        payload: { orderId: order._id, total: order.totalPrice }
                    });
                } catch (err) {
                    logger.error(`Failed to send new order notification for order ${order._id}: ${err.message}`);
                }
            });

            // 7. Post-order inventory checks (low_stock + reorder)
            try {
                const inventoryService = require('./inventory.service');
                await inventoryService.runPostOrderInventoryChecks(order);
            } catch (e) {
                require('../../infrastructure/config/logger').warn(`post-order inventory check failed: ${e.message}`);
            }

            return order;

        } catch (error) {
            logger.error(`Order Creation Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Updates an existing order, handling ingredient adjustments.
     * Only pending orders can be modified.
     * @param {string} orderId - ID of the order to update.
     * @param {object} updateData - Data to update the order with.
     * @returns {Promise<Order>} The updated order document.
     */
    async updateOrder(orderId, updateData) {
        try {
            const order = await Order.findById(orderId);
            if (!order) throw new Error('Order not found');

            // Allow status updates for all orders, but item changes only for pending.
            if (updateData.items && order.status !== 'pending') {
                throw new Error(`Cannot modify items for order with status: ${order.status}. Only Pending orders can be modified.`);
            }

            if (updateData.items) {
                // Restore old ingredients to stock and decrement sales count
                for (const item of order.items) {
                    const dish = await Dish.findById(item.dish).populate('ingredients.ingredient');
                    if (dish) {
                        await this._returnIngredientsToStock(dish.ingredients, item.quantity);
                        await Dish.findByIdAndUpdate(dish._id, { $inc: { salesCount: -item.quantity } });
                    }
                }

                // Deduct new ingredients and increment sales count
                let newTotalPrice = 0;
                const finalProcessedItems = [];

                for (const newItem of updateData.items) {
                    const dish = await Dish.findById(newItem.dishId).populate('ingredients.ingredient');
                    if (!dish) throw new Error(`Dish ${newItem.dishId} not found`);

                    await this._checkStockAvailability(dish.ingredients, newItem.quantity);
                    await this._deductIngredients(dish.ingredients, newItem.quantity);
                    await Dish.findByIdAndUpdate(dish._id, { $inc: { salesCount: newItem.quantity } });

                    newTotalPrice += dish.price * newItem.quantity;
                    finalProcessedItems.push({
                        dish: dish._id,
                        quantity: newItem.quantity,
                        priceAtTime: dish.price,
                        imageUrlAtTime: dish.imageUrl
                    });
                }

                order.items = finalProcessedItems;
                order.totalPrice = newTotalPrice;
            }

            // Apply other updates (e.g., status, paymentMethod)
            const { items, ...otherUpdates } = updateData;
            const wasPaid = !!order.isPaid;
            Object.assign(order, otherUpdates);
            if (order.isPaid && !order.paidAt) order.paidAt = new Date();

            await order.save();

            // If this update flipped the order to paid, credit the customer's lifetime spend.
            if (!wasPaid && order.isPaid && order.customer) {
                await addCustomerSpend(order.customer, order.totalPrice);
            }
            return order;
        } catch (error) {
            logger.error(`Order Update Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Updates the status of an order.
     * @param {string} orderId - ID of the order.
     * @param {string} newStatus - The new status (e.g., 'completed', 'cancelled').
     * @returns {Promise<Order>} The updated order document.
     */
    async updateOrderStatus(orderId, newStatus, { markPaid = false } = {}) {
        try {
            const order = await Order.findById(orderId);
            if (!order) throw new Error('Order not found');

            // Prevent status changes if already cancelled or completed, unless specific transitions are allowed
            if (order.status === 'completed' || order.status === 'cancelled') {
                // Example: Allow 'completed' to 'refunded' if needed, but not back to 'pending'
                if (newStatus === 'refunded' && order.status === 'completed') {
                    // Handle refund logic, e.g., return items to stock if applicable
                    logger.info(`Order ${orderId} status changing from ${order.status} to ${newStatus}`);
                } else if (newStatus !== order.status) {
                    throw new Error(`Cannot change status of an ${order.status} order to ${newStatus}.`);
                }
            }

            const wasPaid = !!order.isPaid;
            order.status = newStatus;
            // Confirming an order can also settle its payment in one step.
            if (markPaid && !order.isPaid) {
                order.isPaid = true;
                order.paidAt = new Date();
            }
            if (newStatus === 'cancelled') {
                for (const item of order.items) {
                    const dish = await Dish.findById(item.dish).populate('ingredients.ingredient');
                    if (dish) {
                        await this._returnIngredientsToStock(dish.ingredients, item.quantity);
                        await Dish.findByIdAndUpdate(dish._id, { $inc: { salesCount: -item.quantity } });
                    }
                }
            }

            await order.save();

            if (!wasPaid && order.isPaid && order.customer) {
                await addCustomerSpend(order.customer, order.totalPrice);
            }
            return order;
        } catch (error) {
            logger.error(`Order Status Update Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Deletes an order and returns ingredients to stock.
     * Only pending orders can be deleted.
     * @param {string} orderId - ID of the order to delete.
     * @returns {Promise<object>} Confirmation message.
     */
    async deleteOrder(orderId) {
        try {
            const order = await Order.findById(orderId);
            if (!order) throw new Error('Order not found');

            if (order.status !== 'pending') {
                throw new Error(`Cannot delete order with status: ${order.status}. Only Pending orders can be deleted.`);
            }

            for (const item of order.items) {
                const dish = await Dish.findById(item.dish).populate('ingredients.ingredient');
                if (dish) {
                    await this._returnIngredientsToStock(dish.ingredients, item.quantity);
                    await Dish.findByIdAndUpdate(dish._id, { $inc: { salesCount: -item.quantity } });
                }
            }

            await Order.findByIdAndDelete(orderId);
            return { message: 'Order deleted and ingredients returned to stock successfully' };
        } catch (error) {
            logger.error(`Order Deletion Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Checks if there is sufficient stock for ingredients required for a dish.
     * @param {Array<object>} ingredients - Array of ingredient objects with quantity.
     * @param {number} orderQuantity - Quantity of the dish being ordered.
     * @private
     */
    async _checkStockAvailability(ingredients, orderQuantity) {
        for (const ing of ingredients) {
            const requiredQty = ing.quantity * orderQuantity;
            const ingredient = await Ingredient.findById(ing.ingredient._id);
            if (!ingredient || ingredient.quantity < requiredQty) {
                throw new Error(`Insufficient stock for ${ingredient ? ingredient.name : 'unknown ingredient'}. Required: ${requiredQty}, Available: ${ingredient ? ingredient.quantity : 0}`);
            }
        }
    }

    /**
     * Deducts ingredients from stock and sends alerts if stock is low.
     * @param {Array<object>} ingredients - Array of ingredient objects with quantity.
     * @param {number} orderQuantity - Quantity of the dish being ordered.
     * @private
     */
    async _deductIngredients(ingredients, orderQuantity) {
        for (const ing of ingredients) {
            const requiredQty = ing.quantity * orderQuantity;
            await Ingredient.findByIdAndUpdate(
                ing.ingredient._id,
                { $inc: { quantity: -requiredQty } }
            );
        }
    }

    /**
     * Returns ingredients to stock.
     * @param {Array<object>} ingredients - Array of ingredient objects with quantity.
     * @param {number} orderQuantity - Quantity of the dish being returned.
     * @private
     */
    async _returnIngredientsToStock(ingredients, orderQuantity) {
        for (const ing of ingredients) {
            const returnQty = ing.quantity * orderQuantity;
            await Ingredient.findByIdAndUpdate(
                ing.ingredient._id,
                { $inc: { quantity: returnQty } }
            );
        }
    }

    /**
     * Retrieves all orders with optional filters.
     * @param {object} [filters={}] - Filters to apply to the order query.
     * @returns {Promise<Array<Order>>} List of orders.
     */
    async getAllOrders(filters = {}) {
        return await Order.find(filters).populate('items.dish').populate('customer').sort({ createdAt: -1 });
    }

    /**
     * Retrieves a single order by ID.
     * @param {string} orderId - ID of the order.
     * @returns {Promise<Order>} The order document.
     */
    async getOrderById(orderId) {
        return await Order.findById(orderId).populate('items.dish').populate('customer');
    }

    async getIntegrityReport() {
        const legacy = await Order.find({ status: 'competed' }).select('_id').lean();
        return { count: legacy.length, orderIds: legacy.map(o => String(o._id)) };
    }
}

module.exports = new OrderService();
