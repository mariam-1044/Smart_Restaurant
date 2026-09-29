const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { verifyOrderExistence, verifyStockFulfillability } = require('../../src/middlewares/order-existence.middleware');
const Dish = require('../../src/domain/models/Dish');
const Ingredient = require('../../src/domain/models/Ingredient');
const Customer = require('../../src/domain/models/Customer');

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('Order existence middleware', () => {
    let availableDish, unavailableDish, customer;

    beforeEach(async () => {
        await Dish.deleteMany({});
        await Customer.deleteMany({});

        availableDish = await Dish.create({
            name: 'Available Pizza',
            price: 100,
            category: 'Pizza',
            isAvailable: true,
            ingredients: []
        });

        unavailableDish = await Dish.create({
            name: 'Unavailable Pizza',
            price: 50,
            category: 'Pizza',
            isAvailable: false,
            ingredients: []
        });

        customer = await Customer.create({
            name: 'Test Customer',
            phone: '1234567890'
        });
    });

    test('passes when dish exists and is available', async () => {
        const req = {
            body: {
                items: [{ dish: String(availableDish._id), quantity: 1 }],
                source: 'POS',
                paymentMethod: 'Cash'
            }
        };
        const res = { locals: {} };
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        await verifyOrderExistence(req, res, next);
        expect(nextCalled).toBe(true);
    });

    test('rejects when dish does not exist (level b)', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const req = {
            body: {
                items: [{ dish: String(fakeId), quantity: 1 }],
                source: 'POS',
                paymentMethod: 'Cash'
            }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        await verifyOrderExistence(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].cause).toBe('dish');
    });

    test('rejects when dish exists but isUnavailable (level b)', async () => {
        const req = {
            body: {
                items: [{ dish: String(unavailableDish._id), quantity: 1 }],
                source: 'POS',
                paymentMethod: 'Cash'
            }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        await verifyOrderExistence(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].cause).toBe('dish');
    });

    test('rejects when customer does not exist (level c)', async () => {
        const fakeCustomerId = new mongoose.Types.ObjectId();
        const req = {
            body: {
                items: [{ dish: String(availableDish._id), quantity: 1 }],
                customer: String(fakeCustomerId),
                source: 'POS',
                paymentMethod: 'Cash'
            }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        await verifyOrderExistence(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].cause).toBe('customer');
    });

    test('passes when customer exists', async () => {
        const req = {
            body: {
                items: [{ dish: String(availableDish._id), quantity: 1 }],
                customer: String(customer._id),
                source: 'POS',
                paymentMethod: 'Cash'
            }
        };
        const res = { locals: {} };
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        await verifyOrderExistence(req, res, next);
        expect(nextCalled).toBe(true);
    });
});

describe('Stock fulfillability middleware', () => {
    let ingredient, dish;

    beforeEach(async () => {
        await Ingredient.deleteMany({});
        await Dish.deleteMany({});

        ingredient = await Ingredient.create({
            name: 'Tomato',
            quantity: 10,
            unit: 'kg',
            minStock: 2,
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });

        dish = await Dish.create({
            name: 'Tomato Soup',
            price: 50,
            category: 'Sides',
            isAvailable: true,
            ingredients: [{ ingredient: ingredient._id, quantity: 2 }]
        });
    });

    test('passes when stock is sufficient', async () => {
        const req = {
            body: {
                items: [{ dish: String(dish._id), quantity: 1 }]
            }
        };
        const res = {
            locals: {
                resolvedDishes: [dish]
            }
        };
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        await verifyStockFulfillability(req, res, next);
        expect(nextCalled).toBe(true);
    });

    test('rejects when stock is insufficient (level d)', async () => {
        const req = {
            body: {
                items: [{ dish: String(dish._id), quantity: 10 }]
            }
        };
        const res = {
            locals: {
                resolvedDishes: [dish]
            },
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        await verifyStockFulfillability(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].cause).toBe('stock');
    });
});