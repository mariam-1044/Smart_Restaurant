const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const orderService = require('../../src/application/services/order.service');
const Order = require('../../src/domain/models/Order');
const Dish = require('../../src/domain/models/Dish');
const Ingredient = require('../../src/domain/models/Ingredient');

describe('Order Service (full)', () => {
  withInMemoryMongo();

  let dish, ingredient;
  beforeEach(async () => {
    ingredient = await Ingredient.create({ name: 'Tomato', quantity: 100, unit: 'kg', minStock: 10, costPerUnit: 2, expiryDate: new Date('2027-06-01') });
    dish = await Dish.create({ name: 'Margherita', price: 12, category: 'Pizza', ingredients: [{ ingredient: ingredient._id, quantity: 0.3 }], isAvailable: true });
  });

  test('createOrder persists order and deducts ingredients', async () => {
    const before = await Ingredient.findById(ingredient._id);
    const order = await orderService.createOrder({ items: [{ dish: dish._id, quantity: 2 }], source: 'POS', paymentMethod: 'Cash' });
    expect(order.status).toBe('pending');
    expect(order.totalPrice).toBe(24);
    const after = await Ingredient.findById(ingredient._id);
    expect(after.quantity).toBe(before.quantity - 0.6);
  });

  test('createOrder creates low_stock notification when ingredient falls below minStock', async () => {
    await Ingredient.findByIdAndUpdate(ingredient._id, { $set: { quantity: 10.5 } });
    const Notification = require('../../src/domain/models/Notification');
    await orderService.createOrder({ items: [{ dish: dish._id, quantity: 2 }], source: 'POS', paymentMethod: 'Cash' });
    const notifs = await Notification.find({ type: 'low_stock', relatedEntity: ingredient._id });
    expect(notifs.length).toBeGreaterThanOrEqual(1);
  });

  test('createOrder throws if dish not available', async () => {
    const fakeDishId = new (require('mongoose').Types.ObjectId)();
    await expect(orderService.createOrder({ items: [{ dish: fakeDishId, quantity: 1 }], source: 'POS', paymentMethod: 'Cash' })).rejects.toThrow();
  });

  test('updateOrderStatus changes status', async () => {
    const order = await orderService.createOrder({ items: [{ dish: dish._id, quantity: 1 }], source: 'POS', paymentMethod: 'Cash' });
    const updated = await orderService.updateOrderStatus(order._id, 'preparing');
    expect(updated.status).toBe('preparing');
  });

  test('deleteOrder removes pending order and returns ingredients', async () => {
    const order = await orderService.createOrder({ items: [{ dish: dish._id, quantity: 1 }], source: 'POS', paymentMethod: 'Cash' });
    const beforeQty = (await Ingredient.findById(ingredient._id)).quantity;
    await orderService.deleteOrder(order._id);
    const afterDelete = await Order.findById(order._id);
    expect(afterDelete).toBeNull();
    const afterQty = (await Ingredient.findById(ingredient._id)).quantity;
    expect(afterQty).toBeGreaterThan(beforeQty);
  });

  test('updateOrderStatus cancelled restores ingredient quantities', async () => {
    const beforeQty = (await Ingredient.findById(ingredient._id)).quantity;
    const order = await orderService.createOrder({ items: [{ dish: dish._id, quantity: 2 }], source: 'POS', paymentMethod: 'Cash' });
    const afterDeductQty = (await Ingredient.findById(ingredient._id)).quantity;
    expect(afterDeductQty).toBe(beforeQty - 0.6);
    await orderService.updateOrderStatus(order._id, 'cancelled');
    const afterCancelQty = (await Ingredient.findById(ingredient._id)).quantity;
    expect(afterCancelQty).toBe(beforeQty);
  });

  test('getAllOrders returns orders list', async () => {
    await orderService.createOrder({ items: [{ dish: dish._id, quantity: 1 }], source: 'POS', paymentMethod: 'Cash' });
    const orders = await orderService.getAllOrders({});
    expect(orders.length).toBeGreaterThanOrEqual(1);
  });

  test('getOrderById returns single order', async () => {
    const order = await orderService.createOrder({ items: [{ dish: dish._id, quantity: 1 }], source: 'POS', paymentMethod: 'Cash' });
    const found = await orderService.getOrderById(order._id);
    expect(found).not.toBeNull();
  });
});