const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const { buildOpenAIMock } = require('../helpers/mockOpenAI');
const Ingredient = require('../../src/domain/models/Ingredient');
const Notification = require('../../src/domain/models/Notification');

const { mockCreate } = buildOpenAIMock();
jest.mock('openai', () => ({
  default: class { constructor() { this.chat = { completions: { create: mockCreate } }; } }
}));

describe('Spoilage cron handler', () => {
  withInMemoryMongo();

  test('creates spoilage_risk notification for near-expiry ingredients', async () => {
    const nearExpiry = new Date(Date.now() + 2 * 86400000);
    await Ingredient.create({ name: 'NearExpiry', quantity: 10, unit: 'kg', minStock: 5, costPerUnit: 1, expiryDate: nearExpiry });
    const { runSpoilageCheck } = require('../../src/infrastructure/cron/spoilage.cron');
    const result = await runSpoilageCheck();
    expect(result).toBeDefined();
    const notifs = await Notification.find({ type: { $in: ['spoilage_risk', 'spoilage_recipe_failed'] } });
    expect(notifs.length).toBeGreaterThanOrEqual(1);
  });
});