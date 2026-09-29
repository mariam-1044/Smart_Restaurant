const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Order = require('../../src/domain/models/Order');

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
});

describe('Order default status (SC-001)', () => {
    test('new order without explicit status defaults to "pending"', async () => {
        const orderData = {
            items: [{ dish: new mongoose.Types.ObjectId(), quantity: 1, priceAtTime: 5 }],
            totalPrice: 5,
            source: 'POS',
            paymentMethod: 'Cash'
        };
        const order = new Order(orderData);
        await order.save();
        expect(order.status).toBe('pending');
    });

    test('"pending" is a valid enum value', async () => {
        const orderData = {
            items: [{ dish: new mongoose.Types.ObjectId(), quantity: 1, priceAtTime: 5 }],
            totalPrice: 5,
            source: 'POS',
            paymentMethod: 'Cash',
            status: 'pending'
        };
        const order = new Order(orderData);
        await order.save();
        expect(order.status).toBe('pending');
    });

    test('"competed" is NOT a valid enum value', () => {
        expect(Order.schema.path('status').enumValues).not.toContain('competed');
    });
});