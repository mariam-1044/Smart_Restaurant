const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const etlService = require('../../src/application/services/etl.service');
const Order = require('../../src/domain/models/Order');
const Dish = require('../../src/domain/models/Dish');
const Ingredient = require('../../src/domain/models/Ingredient');

describe('ETL Service', () => {
  withInMemoryMongo();

  test('runAnalyticsPipeline returns expected structure', async () => {
    await Order.create({ items: [{ dish: new (require('mongoose').Types.ObjectId)(), quantity: 1, priceAtTime: 10 }], totalPrice: 10, status: 'completed', source: 'POS', paymentMethod: 'Cash' });
    const report = await etlService.runAnalyticsPipeline();
    expect(report).toHaveProperty('financials');
    expect(report).toHaveProperty('inventoryStatus');
    expect(report).toHaveProperty('menuPerformance');
    expect(report).toHaveProperty('salesTrends');
    expect(report).toHaveProperty('wasteAnalytics');
    expect(report).toHaveProperty('aiReadyData');
  });

  test('runAnalyticsPipeline handles empty database gracefully', async () => {
    const report = await etlService.runAnalyticsPipeline();
    expect(report.financials.totalRevenue).toBe(0);
    expect(report.financials.totalOrders).toBe(0);
    expect(report.inventoryStatus.lowStock).toEqual([]);
  });

  test('getAIReadyData returns aiReadyData sub-object', async () => {
    const data = await etlService.getAIReadyData();
    expect(data).toHaveProperty('forecasting');
    expect(data).toHaveProperty('associationRules');
    expect(data).toHaveProperty('inventoryOptimization');
    expect(data).toHaveProperty('menuPerformance');
  });

  test('wasteAnalytics structure from pipeline', async () => {
    await Ingredient.create({ name: 'WasteItem', quantity: 10, unit: 'kg', minStock: 5, costPerUnit: 2, expiryDate: new Date('2027-01-01'), wasteQuantity: 3 });
    const report = await etlService.runAnalyticsPipeline();
    expect(report.wasteAnalytics).toHaveProperty('totalWasteQuantity');
    expect(report.wasteAnalytics).toHaveProperty('wastePercentage');
  });
});