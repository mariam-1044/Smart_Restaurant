const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const Order = require('../../src/domain/models/Order');

describe('Order Model', () => {
  withInMemoryMongo();

  test('default status is pending', async () => {
    const order = await Order.create({ items: [{ dish: new (require('mongoose').Types.ObjectId)(), quantity: 1, priceAtTime: 10 }], totalPrice: 10, source: 'POS', paymentMethod: 'Cash' });
    expect(order.status).toBe('pending');
  });

  test('invalid status enum throws', async () => {
    await expect(Order.create({ items: [{ dish: new (require('mongoose').Types.ObjectId)(), quantity: 1, priceAtTime: 10 }], totalPrice: 10, status: 'unknown_status', source: 'POS', paymentMethod: 'Cash' })).rejects.toThrow();
  });

  test('totalPrice must be >= 0', async () => {
    await expect(Order.create({ items: [], totalPrice: -5, source: 'POS', paymentMethod: 'Cash' })).rejects.toThrow();
  });

  test('isPaid defaults to false', async () => {
    const order = await Order.create({ items: [{ dish: new (require('mongoose').Types.ObjectId)(), quantity: 1, priceAtTime: 10 }], totalPrice: 10, source: 'POS', paymentMethod: 'Cash' });
    expect(order.isPaid).toBe(false);
  });
});