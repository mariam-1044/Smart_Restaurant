const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const User = require('../../src/domain/models/User');
const Order = require('../../src/domain/models/Order');
const orderRoutes = require('../../src/routes/order.routes');

let mongoServer, app, adminToken, staffToken, customerToken;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
    app = express();
    app.use(express.json());
    app.use('/api/orders', orderRoutes);
    const a = await User.create({ name: 'A', email: 'aint@x.com', password: 'pass1234', role: 'admin', status: 'approved' });
    const s = await User.create({ name: 'S', email: 'sint@x.com', password: 'pass1234', role: 'staff', status: 'approved' });
    const c = await User.create({ name: 'C', email: 'cint@x.com', password: 'pass1234', role: 'customer', status: 'approved' });
    adminToken = jwt.sign({ id: a._id, version: a.tokenVersion }, process.env.JWT_SECRET);
    staffToken = jwt.sign({ id: s._id, version: s.tokenVersion }, process.env.JWT_SECRET);
    customerToken = jwt.sign({ id: c._id, version: c.tokenVersion }, process.env.JWT_SECRET);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await Order.deleteMany({});
});

describe('GET /api/orders/integrity-report', () => {
    test('admin + 0 legacy docs returns { count: 0, orderIds: [] }', async () => {
        const res = await request(app).get('/api/orders/integrity-report').set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ count: 0, orderIds: [] });
    });

    test('admin + 3 legacy docs returns correct count and ids', async () => {
        const ids = [];
        for (let i = 0; i < 3; i++) {
            const r = await Order.collection.insertOne({
                items: [{ dish: new mongoose.Types.ObjectId(), quantity: 1, priceAtTime: 5 }],
                totalPrice: 5, source: 'POS', paymentMethod: 'Cash', status: 'competed'
            });
            ids.push(String(r.insertedId));
        }
        const res = await request(app).get('/api/orders/integrity-report').set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.count).toBe(3);
        expect(res.body.data.orderIds.sort()).toEqual(ids.sort());
    });

    test('idempotent reads — two calls return the same result', async () => {
        await Order.collection.insertOne({
            items: [{ dish: new mongoose.Types.ObjectId(), quantity: 1, priceAtTime: 5 }],
            totalPrice: 5, source: 'POS', paymentMethod: 'Cash', status: 'competed'
        });
        const r1 = await request(app).get('/api/orders/integrity-report').set('Authorization', `Bearer ${adminToken}`);
        const r2 = await request(app).get('/api/orders/integrity-report').set('Authorization', `Bearer ${adminToken}`);
        expect(r1.body).toEqual(r2.body);
    });

    test('staff role returns 403', async () => {
        const res = await request(app).get('/api/orders/integrity-report').set('Authorization', `Bearer ${staffToken}`);
        expect(res.status).toBe(403);
    });

    test('customer role returns 403', async () => {
        const res = await request(app).get('/api/orders/integrity-report').set('Authorization', `Bearer ${customerToken}`);
        expect(res.status).toBe(403);
    });

    test('no token returns 401', async () => {
        const res = await request(app).get('/api/orders/integrity-report');
        expect(res.status).toBe(401);
    });
});