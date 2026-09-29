const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Ingredient = require('../../src/domain/models/Ingredient');
const inventoryService = require('../../src/application/services/inventory.service');

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

afterEach(async () => {
    await Ingredient.deleteMany({});
});

describe('inventoryService.getById', () => {
    test('returns ingredient when id is valid', async () => {
        const ingredient = await Ingredient.create({
            name: 'Test Tomato',
            quantity: 100,
            unit: 'kg',
            minStock: 10,
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });

        const result = await inventoryService.getById(ingredient._id);
        expect(result).not.toBeNull();
        expect(result.name).toBe('Test Tomato');
    });

    test('returns null for unknown valid ObjectId', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const result = await inventoryService.getById(fakeId);
        expect(result).toBeNull();
    });

    test('returns null for invalid id format', async () => {
        const result = await inventoryService.getById('not-an-objectid');
        expect(result).toBeNull();
    });
});