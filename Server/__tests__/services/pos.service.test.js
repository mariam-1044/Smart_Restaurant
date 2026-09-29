const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const posService = require('../../src/application/services/pos.service');
const Dish = require('../../src/domain/models/Dish');
const Ingredient = require('../../src/domain/models/Ingredient');

describe('POS Service', () => {
  withInMemoryMongo();

  test('handleTransaction creates a completed order for Cash payment', async () => {
    const ingredient = await Ingredient.create({ name: 'Flour', quantity: 100, unit: 'kg', minStock: 10, costPerUnit: 1, expiryDate: new Date('2027-01-01') });
    const dish = await Dish.create({ name: 'Bread', price: 5, category: 'Sides', ingredients: [{ ingredient: ingredient._id, quantity: 0.5 }], isAvailable: true });
    const result = await posService.handleTransaction({
      items: [{ dish: dish._id, quantity: 1 }],
      source: 'POS',
      paymentMethod: 'Cash'
    });
    expect(result.success).toBe(true);
    expect(result.order.status).toBe('completed');
    expect(result.order.isPaid).toBe(true);
    expect(result.transactionId).toBeTruthy();
  });

  test('handleTransaction fails with unavailable dish', async () => {
    const fakeDishId = new (require('mongoose').Types.ObjectId)();
    await expect(posService.handleTransaction({
      items: [{ dish: fakeDishId, quantity: 1 }],
      source: 'POS',
      paymentMethod: 'Cash'
    })).rejects.toThrow();
  });
});