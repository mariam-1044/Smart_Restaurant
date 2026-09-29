const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const inventoryService = require('../../src/application/services/inventory.service');
const Ingredient = require('../../src/domain/models/Ingredient');
const Notification = require('../../src/domain/models/Notification');

describe('Inventory Service (full)', () => {
  withInMemoryMongo();

  test('createIngredient persists and returns new ingredient', async () => {
    const data = { name: 'Garlic', quantity: 20, unit: 'kg', minStock: 5, costPerUnit: 3, expiryDate: new Date('2027-06-01') };
    const ing = await inventoryService.createIngredient(data);
    expect(ing.name).toBe('Garlic');
    expect(ing.quantity).toBe(20);
  });

  test('updateIngredient updates fields', async () => {
    const ing = await Ingredient.create({ name: 'Onion', quantity: 30, unit: 'kg', minStock: 10, costPerUnit: 1, expiryDate: new Date('2027-06-01') });
    const updated = await inventoryService.updateIngredient(ing._id, { quantity: 25 });
    expect(updated.quantity).toBe(25);
  });

  test('deleteIngredient removes the document', async () => {
    const ing = await Ingredient.create({ name: 'Pepper', quantity: 10, unit: 'kg', minStock: 2, costPerUnit: 5, expiryDate: new Date('2027-06-01') });
    await inventoryService.deleteIngredient(ing._id);
    const found = await Ingredient.findById(ing._id);
    expect(found).toBeNull();
  });

  test('getAllIngredients returns all ingredients', async () => {
    await Ingredient.create({ name: 'Salt', quantity: 50, unit: 'kg', minStock: 10, costPerUnit: 0.5, expiryDate: new Date('2028-01-01') });
    const all = await inventoryService.getAllIngredients();
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  test('getLowStockIngredients returns items below minStock', async () => {
    await Ingredient.create({ name: 'LowItem', quantity: 3, unit: 'kg', minStock: 10, costPerUnit: 2, expiryDate: new Date('2027-06-01') });
    const low = await inventoryService.getLowStockIngredients();
    expect(low.some(i => i.name === 'LowItem')).toBe(true);
  });

  test('getNearExpiryIngredients returns items expiring soon', async () => {
    const tomorrow = new Date(Date.now() + 86400000);
    await Ingredient.create({ name: 'ExpiringItem', quantity: 10, unit: 'kg', minStock: 5, costPerUnit: 1, expiryDate: tomorrow });
    const near = await inventoryService.getNearExpiryIngredients(3);
    expect(near.some(i => i.name === 'ExpiringItem')).toBe(true);
  });

  test('recordManualWaste decrements quantity and increments wasteQuantity', async () => {
    const ing = await Ingredient.create({ name: 'WasteItem', quantity: 50, unit: 'kg', minStock: 10, costPerUnit: 2, expiryDate: new Date('2027-06-01') });
    const result = await inventoryService.recordManualWaste(ing._id, 5, 'Spoiled');
    expect(result.quantity).toBe(45);
    expect(result.wasteQuantity).toBe(5);
  });

  test('recordManualWaste throws if quantity exceeds on-hand', async () => {
    const ing = await Ingredient.create({ name: 'SmallItem', quantity: 2, unit: 'kg', minStock: 1, costPerUnit: 1, expiryDate: new Date('2027-06-01') });
    await expect(inventoryService.recordManualWaste(ing._id, 10)).rejects.toThrow();
  });

  test('getInventoryAlerts returns lowStock, expired, and nearExpiry', async () => {
    await Ingredient.create({ name: 'AlertItem', quantity: 1, unit: 'kg', minStock: 10, costPerUnit: 1, expiryDate: new Date('2027-06-01') });
    const alerts = await inventoryService.getInventoryAlerts();
    expect(alerts).toHaveProperty('lowStock');
    expect(alerts).toHaveProperty('expired');
    expect(alerts).toHaveProperty('nearExpiry');
  });

  test('getById returns ingredient', async () => {
    const ing = await Ingredient.create({ name: 'ByIdItem', quantity: 5, unit: 'kg', minStock: 2, costPerUnit: 1, expiryDate: new Date('2027-06-01') });
    const found = await inventoryService.getById(ing._id);
    expect(found.name).toBe('ByIdItem');
  });

  test('getById returns null for invalid id', async () => {
    const found = await inventoryService.getById(new (require('mongoose').Types.ObjectId)());
    expect(found).toBeNull();
  });

  test('searchIngredients filters by name', async () => {
    await Ingredient.create({ name: 'SearchGarlic', quantity: 10, unit: 'kg', minStock: 2, costPerUnit: 1, expiryDate: new Date('2027-06-01') });
    const results = await inventoryService.searchIngredients('SearchGarlic');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});