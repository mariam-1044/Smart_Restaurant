const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Order = require('../../src/domain/models/Order');
const orderService = require('../../src/application/services/order.service');
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

afterEach(async () => {
    await Order.deleteMany({});
    await Dish.deleteMany({});
    await Ingredient.deleteMany({});
    await Customer.deleteMany({});
});

describe('Order integrity report', () => {
    test('returns empty report when no legacy documents exist', async () => {
        const report = await orderService.getIntegrityReport();
        expect(report).toEqual({ count: 0, orderIds: [] });
    });

    test('finds orders with legacy "competed" status', async () => {
        const ids = [];
        for (let i = 0; i < 3; i++) {
            const doc = await Order.collection.insertOne({
                items: [{ dish: new mongoose.Types.ObjectId(), quantity: 1, priceAtTime: 5 }],
                totalPrice: 5,
                source: 'POS',
                paymentMethod: 'Cash',
                status: 'competed'
            });
            ids.push(String(doc.insertedId));
        }

        const report = await orderService.getIntegrityReport();
        expect(report.count).toBe(3);
        expect(report.orderIds.sort()).toEqual(ids.sort());
    });

    test('does not modify documents (read-only)', async () => {
        await Order.collection.insertOne({
            items: [{ dish: new mongoose.Types.ObjectId(), quantity: 1, priceAtTime: 5 }],
            totalPrice: 5,
            source: 'POS',
            paymentMethod: 'Cash',
            status: 'competed'
        });

        const snapshotBefore = await Order.find({ status: 'competed' }).lean();
        await orderService.getIntegrityReport();
        const snapshotAfter = await Order.find({ status: 'competed' }).lean();

        expect(snapshotBefore.length).toBe(snapshotAfter.length);
    });
});