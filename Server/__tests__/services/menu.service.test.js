const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Dish = require('../../src/domain/models/Dish');
const Ingredient = require('../../src/domain/models/Ingredient');
const menuService = require('../../src/application/services/menu.service');

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
    await Dish.deleteMany({});
    await Ingredient.deleteMany({});
});

describe('MenuService', () => {
    const dishData = {
        name: 'Test Pizza',
        price: 100,
        category: 'Pizza',
        isAvailable: true,
        ingredients: []
    };

    test('getAll returns all dishes', async () => {
        await Dish.create(dishData);
        await Dish.create({ ...dishData, name: 'Test Burger', category: 'Burgers' });
        const result = await menuService.getAll({});
        expect(result.length).toBe(2);
    });

    test('getAll filters by search', async () => {
        await Dish.create(dishData);
        await Dish.create({ ...dishData, name: 'Burger Special' });
        const result = await menuService.getAll({ search: 'Pizza' });
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('Test Pizza');
    });

    test('getAll filters by category', async () => {
        await Dish.create(dishData);
        await Dish.create({ ...dishData, name: 'Test Burger', category: 'Burgers' });
        const result = await menuService.getAll({ category: 'Pizza' });
        expect(result.length).toBe(1);
    });

    test('getById returns dish', async () => {
        const dish = await Dish.create(dishData);
        const result = await menuService.getById(dish._id);
        expect(result).not.toBeNull();
        expect(result.name).toBe('Test Pizza');
    });

    test('getById returns null for unknown id', async () => {
        const result = await menuService.getById(new mongoose.Types.ObjectId());
        expect(result).toBeNull();
    });

    test('create adds a dish', async () => {
        const result = await menuService.create(dishData);
        expect(result.name).toBe('Test Pizza');
        expect(result.price).toBe(100);
    });

    test('update modifies a dish', async () => {
        const dish = await Dish.create(dishData);
        const result = await menuService.update(dish._id, { price: 150 });
        expect(result.price).toBe(150);
    });

    test('remove deletes a dish', async () => {
        const dish = await Dish.create(dishData);
        const result = await menuService.remove(dish._id);
        expect(result).not.toBeNull();
        const found = await Dish.findById(dish._id);
        expect(found).toBeNull();
    });
});