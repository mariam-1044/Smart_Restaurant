const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const User = require('../../src/domain/models/User');
const Dish = require('../../src/domain/models/Dish');
const Ingredient = require('../../src/domain/models/Ingredient');
const menuRoutes = require('../../src/routes/menu.routes');

let mongoServer, app, adminToken;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
    app = express();
    app.use(express.json());
    app.use('/api/menu', menuRoutes);
    const admin = await User.create({ name: 'A', email: 'menuadmin@x.com', password: 'pass1234', role: 'admin', status: 'approved' });
    adminToken = jwt.sign({ id: admin._id, version: admin.tokenVersion }, process.env.JWT_SECRET);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await Dish.deleteMany({});
    await Ingredient.deleteMany({});
});

describe('POST /api/menu — validation', () => {
    test('missing name returns 400, no DB write', async () => {
        const before = await Dish.countDocuments();
        const res = await request(app).post('/api/menu')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ price: 10, category: 'Pizza' });
        expect(res.status).toBe(400);
        expect(await Dish.countDocuments()).toBe(before);
    });

    test('negative price returns 400', async () => {
        const res = await request(app).post('/api/menu')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'X', price: -5, category: 'Pizza' });
        expect(res.status).toBe(400);
    });

    test('unknown category returns 400', async () => {
        const res = await request(app).post('/api/menu')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'X', price: 10, category: 'NotReal' });
        expect(res.status).toBe(400);
    });

    test('malformed ingredient ref returns 400', async () => {
        const res = await request(app).post('/api/menu')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'X', price: 10, category: 'Pizza',
                    ingredients: [{ ingredient: 'bad-id', quantity: 1 }] });
        expect(res.status).toBe(400);
    });

    test('valid payload returns 201', async () => {
        const res = await request(app).post('/api/menu')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Margherita', price: 50, category: 'Pizza' });
        expect(res.status).toBe(201);
        expect(res.body.data.name).toBe('Margherita');
    });
});

describe('PATCH /api/menu/:id — validation', () => {
    test('negative price on update returns 400', async () => {
        const dish = await Dish.create({ name: 'D', price: 10, category: 'Pizza' });
        const res = await request(app).patch(`/api/menu/${dish._id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'D', price: -1, category: 'Pizza' });
        expect(res.status).toBe(400);
    });
});