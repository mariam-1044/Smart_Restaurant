const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const salesService = require('../../src/application/services/sales.service');
const Order = require('../../src/domain/models/Order');
const Dish = require('../../src/domain/models/Dish');

describe('Sales Service', () => {
  withInMemoryMongo();

  let dish;
  beforeEach(async () => {
    dish = await Dish.create({ name: 'Test Pizza', price: 15, category: 'Pizza', ingredients: [], salesCount: 5 });
  });

  test('getSalesReport returns daily report with completed orders', async () => {
    await Order.create({ items: [{ dish: dish._id, quantity: 2, priceAtTime: 15 }], totalPrice: 30, status: 'completed', source: 'POS', paymentMethod: 'Cash' });
    const report = await salesService.getSalesReport('daily');
    expect(report).toHaveProperty('totalRevenue');
    expect(report).toHaveProperty('totalOrders');
    expect(report).toHaveProperty('popularDishes');
    expect(report).toHaveProperty('averageOrderValue');
    expect(report.period).toBe('daily');
  });

  test('getSalesReport excludes non-completed orders', async () => {
    await Order.create({ items: [{ dish: dish._id, quantity: 1, priceAtTime: 15 }], totalPrice: 15, status: 'pending', source: 'POS', paymentMethod: 'Cash' });
    const report = await salesService.getSalesReport('daily');
    expect(report.totalOrders).toBe(0);
    expect(report.totalRevenue).toBe(0);
  });

  test('getSalesReport weekly aggregates 7 days', async () => {
    await Order.create({ items: [{ dish: dish._id, quantity: 1, priceAtTime: 15 }], totalPrice: 15, status: 'completed', source: 'POS', paymentMethod: 'Cash' });
    const report = await salesService.getSalesReport('weekly');
    expect(report.period).toBe('weekly');
    expect(report.totalOrders).toBeGreaterThanOrEqual(1);
  });

  test('getSalesReport popularDishes sorted by count descending', async () => {
    const dish2 = await Dish.create({ name: 'Burger', price: 10, category: 'Burgers', ingredients: [], salesCount: 0 });
    await Order.create({ items: [{ dish: dish._id, quantity: 3, priceAtTime: 15 }], totalPrice: 45, status: 'completed', source: 'POS', paymentMethod: 'Cash' });
    await Order.create({ items: [{ dish: dish2._id, quantity: 1, priceAtTime: 10 }], totalPrice: 10, status: 'completed', source: 'POS', paymentMethod: 'Cash' });
    const report = await salesService.getSalesReport('daily');
    if (report.popularDishes.length >= 2) {
      expect(report.popularDishes[0].count >= report.popularDishes[1].count).toBe(true);
    }
  });

  test('getSalesReport surfaces totalPaid, pendingCount, transactions, topDishes and salesTrends', async () => {
    await Order.create([
      { items: [{ dish: dish._id, quantity: 2, priceAtTime: 15 }], totalPrice: 30, status: 'completed', isPaid: true, paidAt: new Date(), source: 'POS', paymentMethod: 'Cash' },
      { items: [{ dish: dish._id, quantity: 1, priceAtTime: 15 }], totalPrice: 15, status: 'completed', isPaid: false, source: 'POS', paymentMethod: 'Cash' },
      { items: [{ dish: dish._id, quantity: 1, priceAtTime: 15 }], totalPrice: 15, status: 'pending', isPaid: false, source: 'Online', paymentMethod: 'Cash' }
    ]);
    const report = await salesService.getSalesReport('daily');
    expect(report.totalRevenue).toBe(45);   // two completed orders
    expect(report.totalOrders).toBe(2);
    expect(report.totalPaid).toBe(30);       // only the one paid order
    expect(report.pendingCount).toBe(1);
    expect(report.transactions.length).toBe(3);
    const pendingTx = report.transactions.find((t) => t.status === 'pending');
    expect(pendingTx).toBeTruthy();
    expect(pendingTx.itemsLabel).toContain('Test Pizza');
    expect(pendingTx.customerName).toBe('Walk-in');
    expect(report.topDishes[0]).toMatchObject({ name: 'Test Pizza', orders: 3 });
    expect(report.topDishes[0].revenue).toBe(45);
    expect(Object.values(report.salesTrends).reduce((s, v) => s + v, 0)).toBe(45);
  });

  test('getPaymentSummary aggregates paid vs pending across all orders', async () => {
    await Order.create([
      { items: [{ dish: dish._id, quantity: 1, priceAtTime: 15 }], totalPrice: 15, status: 'completed', isPaid: true, source: 'POS', paymentMethod: 'Cash' },
      { items: [{ dish: dish._id, quantity: 1, priceAtTime: 15 }], totalPrice: 25, status: 'pending', isPaid: false, source: 'Online', paymentMethod: 'Cash' },
      { items: [{ dish: dish._id, quantity: 1, priceAtTime: 15 }], totalPrice: 99, status: 'cancelled', isPaid: true, source: 'POS', paymentMethod: 'Card' }
    ]);
    const summary = await salesService.getPaymentSummary();
    expect(summary.totalPaid).toBe(15);   // cancelled-but-paid is excluded
    expect(summary.paidCount).toBe(1);
    expect(summary.pendingCount).toBe(1);
    expect(summary.pendingValue).toBe(25);
    expect(summary.orderCount).toBe(3);
  });

  test('getRecentTransactions returns normalized recent orders newest first', async () => {
    await Order.create({ items: [{ dish: dish._id, quantity: 1, priceAtTime: 15 }], totalPrice: 15, status: 'completed', isPaid: true, source: 'POS', paymentMethod: 'Cash' });
    const tx = await salesService.getRecentTransactions(10);
    expect(Array.isArray(tx)).toBe(true);
    expect(tx[0]).toHaveProperty('itemsLabel');
    expect(tx[0]).toHaveProperty('isPaid', true);
    expect(tx[0]).toHaveProperty('total', 15);
  });
});