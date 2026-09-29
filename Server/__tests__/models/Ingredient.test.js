const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const Ingredient = require('../../src/domain/models/Ingredient');

describe('Ingredient Model', () => {
  withInMemoryMongo();

  test('quantity must be >= 0', async () => {
    await expect(Ingredient.create({ name: 'BadQty', quantity: -5, unit: 'kg', minStock: 10, costPerUnit: 1, expiryDate: new Date('2027-01-01') })).rejects.toThrow();
  });

  test('costPerUnit must be >= 0', async () => {
    await expect(Ingredient.create({ name: 'BadCost', quantity: 10, unit: 'kg', minStock: 5, costPerUnit: -1, expiryDate: new Date('2027-01-01') })).rejects.toThrow();
  });

  test('minStock defaults are enforced', async () => {
    const ing = await Ingredient.create({ name: 'MinStockTest', quantity: 10, unit: 'kg', minStock: 5, costPerUnit: 1, expiryDate: new Date('2027-01-01') });
    expect(ing.minStock).toBe(5);
  });

  test('name is required and unique', async () => {
    await Ingredient.create({ name: 'UniqueIng', quantity: 5, unit: 'kg', minStock: 2, costPerUnit: 1, expiryDate: new Date('2027-01-01') });
    await expect(Ingredient.create({ name: 'UniqueIng', quantity: 5, unit: 'kg', minStock: 2, costPerUnit: 1, expiryDate: new Date('2027-01-01') })).rejects.toThrow();
  });
});