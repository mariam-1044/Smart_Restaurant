const request = require('supertest');
const express = require('express');
const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const { seedUser } = require('../helpers/seedUser');
const { authedRequest } = require('../helpers/authedRequest');
const { errorHandler } = require('../../src/middlewares/error.middleware');
const Order = require('../../src/domain/models/Order');
const Dish = require('../../src/domain/models/Dish');
const Ingredient = require('../../src/domain/models/Ingredient');
const Customer = require('../../src/domain/models/Customer');

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/orders', require('../../src/routes/order.routes'));
    app.use(errorHandler);
    return app;
}

describe('PATCH /api/orders/:id/status', () => {
    withInMemoryMongo();

    let app, adminAgent, staffAgent, customerAgent, dish, customer;

    beforeAll(() => {
        process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
        app = buildApp();
    });

    beforeEach(async () => {
        adminAgent = authedRequest(app, await seedUser({ role: 'admin' }));
        staffAgent = authedRequest(app, await seedUser({ role: 'staff' }));
        customerAgent = authedRequest(app, await seedUser({ role: 'customer' }));
        const ing = await Ingredient.create({ name: 'Tomato', quantity: 100, unit: 'kg', minStock: 2, costPerUnit: 2, expiryDate: new Date('2030-01-01') });
        dish = await Dish.create({ name: 'Pizza', price: 20, category: 'Pizza', ingredients: [{ ingredient: ing._id, quantity: 0.1 }], isAvailable: true });
        customer = await Customer.create({ name: 'Sam', phone: '15559999' });
    });

    async function makePendingOrder() {
        return Order.create({
            items: [{ dish: dish._id, quantity: 2, priceAtTime: 20 }],
            totalPrice: 40,
            customer: customer._id,
            status: 'pending',
            isPaid: false,
            source: 'Online'
        });
    }

    test('admin confirms a pending order → completed + paid and customer credited', async () => {
        const order = await makePendingOrder();
        const res = await adminAgent.patch(`/api/orders/${order._id}/status`).send({ status: 'completed', isPaid: true });
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('completed');
        expect(res.body.data.isPaid).toBe(true);
        const reloaded = await Customer.findById(customer._id);
        expect(reloaded.totalSpend).toBeCloseTo(40, 2);
    });

    test('staff can change status without marking paid', async () => {
        const order = await makePendingOrder();
        const res = await staffAgent.patch(`/api/orders/${order._id}/status`).send({ status: 'preparing' });
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('preparing');
        expect(res.body.data.isPaid).toBe(false);
    });

    test('customer is forbidden', async () => {
        const order = await makePendingOrder();
        const res = await customerAgent.patch(`/api/orders/${order._id}/status`).send({ status: 'completed' });
        expect(res.status).toBe(403);
    });

    test('invalid status → 400', async () => {
        const order = await makePendingOrder();
        const res = await adminAgent.patch(`/api/orders/${order._id}/status`).send({ status: 'teleported' });
        expect(res.status).toBe(400);
    });

    test('missing order → 404', async () => {
        const fakeId = new (require('mongoose').Types.ObjectId)();
        const res = await adminAgent.patch(`/api/orders/${fakeId}/status`).send({ status: 'completed' });
        expect(res.status).toBe(404);
    });

    test('no token → 401', async () => {
        const order = await makePendingOrder();
        const res = await request(app).patch(`/api/orders/${order._id}/status`).send({ status: 'completed' });
        expect(res.status).toBe(401);
    });
});
