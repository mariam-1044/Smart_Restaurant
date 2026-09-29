const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const User = require('../../src/domain/models/User');
const Ingredient = require('../../src/domain/models/Ingredient');
const inventoryRoutes = require('../../src/routes/inventory.routes');

let mongoServer, app, staffToken;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
    app = express();
    app.use(express.json());
    app.use('/api/inventory', inventoryRoutes);
    const s = await User.create({ name: 'S', email: 'staffinv@x.com', password: 'pass1234', role: 'staff', status: 'approved' });
    staffToken = jwt.sign({ id: s._id, version: s.tokenVersion }, process.env.JWT_SECRET);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await Ingredient.deleteMany({});
});

describe('GET /api/inventory/:id', () => {
    test('valid id returns 200 + full record', async () => {
        const ing = await Ingredient.create({ name: 'Tomato', quantity: 10, unit: 'kg', minStock: 1, expiryDate: new Date(Date.now() + 30 * 86400000) });
        const res = await request(app).get(`/api/inventory/${ing._id}`).set('Authorization', `Bearer ${staffToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('Tomato');
    });

    test('unknown valid-shape id returns 404 (NOT 500)', async () => {
        const res = await request(app).get(`/api/inventory/${new mongoose.Types.ObjectId()}`).set('Authorization', `Bearer ${staffToken}`);
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });

    test('invalid-shape id returns 404 (NOT 500)', async () => {
        const res = await request(app).get('/api/inventory/not-an-objectid').set('Authorization', `Bearer ${staffToken}`);
        expect(res.status).toBe(404);
    });

    test('no token returns 401', async () => {
        const res = await request(app).get('/api/inventory/anyid');
        expect(res.status).toBe(401);
    });
});