const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const orderService = require('../../src/application/services/order.service');
const customerService = require('../../src/application/services/customer.service');
const Order = require('../../src/domain/models/Order');
const Dish = require('../../src/domain/models/Dish');
const Ingredient = require('../../src/domain/models/Ingredient');
const Customer = require('../../src/domain/models/Customer');

describe('Order payment / confirmation flow', () => {
    withInMemoryMongo();

    let dish, ingredient;
    beforeEach(async () => {
        ingredient = await Ingredient.create({ name: 'Tomato', quantity: 200, unit: 'kg', minStock: 5, costPerUnit: 2, expiryDate: new Date('2030-01-01') });
        dish = await Dish.create({ name: 'Margherita', price: 12, category: 'Pizza', ingredients: [{ ingredient: ingredient._id, quantity: 0.2 }], isAvailable: true });
    });

    async function customer() {
        return Customer.findOne({ phone: '15550001' });
    }

    test('paid-at-creation order credits the customer lifetime spend', async () => {
        const order = await orderService.createOrder(
            { items: [{ dish: dish._id, quantity: 2 }], source: 'POS', paymentMethod: 'Cash', isPaid: true },
            { name: 'Aya', phone: '15550001' }
        );
        expect(order.isPaid).toBe(true);
        expect(order.paidAt).toBeTruthy();
        const c = await customer();
        expect(c.totalOrders).toBe(1);
        expect(c.totalSpend).toBeCloseTo(24, 2);
        expect(String(c.orderHistory[0])).toBe(String(order._id));
    });

    test('unpaid order increments order count but not spend', async () => {
        await orderService.createOrder(
            { items: [{ dish: dish._id, quantity: 1 }], source: 'Online', paymentMethod: 'Cash', isPaid: false },
            { name: 'Aya', phone: '15550001' }
        );
        const c = await customer();
        expect(c.totalOrders).toBe(1);
        expect(c.totalSpend || 0).toBe(0);
    });

    test('confirming a pending order via updateOrderStatus marks it completed + paid and credits the customer', async () => {
        const order = await orderService.createOrder(
            { items: [{ dish: dish._id, quantity: 3 }], source: 'Online', paymentMethod: 'Cash', isPaid: false },
            { name: 'Aya', phone: '15550001' }
        );
        expect((await customer()).totalSpend || 0).toBe(0);

        const updated = await orderService.updateOrderStatus(order._id, 'completed', { markPaid: true });
        expect(updated.status).toBe('completed');
        expect(updated.isPaid).toBe(true);
        expect(updated.paidAt).toBeTruthy();

        const c = await customer();
        expect(c.totalSpend).toBeCloseTo(36, 2);
    });

    test('confirming twice does not double-credit the customer', async () => {
        const order = await orderService.createOrder(
            { items: [{ dish: dish._id, quantity: 1 }], source: 'Online', paymentMethod: 'Cash', isPaid: false },
            { name: 'Aya', phone: '15550001' }
        );
        await orderService.updateOrderStatus(order._id, 'completed', { markPaid: true });
        // A second status update (no-op transition) must not change spend again.
        await orderService.updateOrderStatus(order._id, 'completed', { markPaid: true });
        const c = await customer();
        expect(c.totalSpend).toBeCloseTo(12, 2);
    });

    test('updateOrder flipping isPaid credits the customer (POS settle path)', async () => {
        const order = await orderService.createOrder(
            { items: [{ dish: dish._id, quantity: 2 }], source: 'POS', paymentMethod: 'Card', isPaid: false },
            { name: 'Aya', phone: '15550001' }
        );
        await orderService.updateOrder(order._id, { status: 'completed', isPaid: true });
        const c = await customer();
        expect(c.totalSpend).toBeCloseTo(24, 2);
        const reloaded = await Order.findById(order._id);
        expect(reloaded.paidAt).toBeTruthy();
    });

    test('updateOrderStatus on a missing order throws', async () => {
        const fakeId = new (require('mongoose').Types.ObjectId)();
        await expect(orderService.updateOrderStatus(fakeId, 'completed')).rejects.toThrow(/not found/i);
    });

    test('addCustomerSpend helper increments totalSpend', async () => {
        const c = await Customer.create({ name: 'Direct', phone: '15550002', totalSpend: 5 });
        await customerService.addCustomerSpend(c._id, 7.5);
        const reloaded = await Customer.findById(c._id);
        expect(reloaded.totalSpend).toBeCloseTo(12.5, 2);
    });
});
