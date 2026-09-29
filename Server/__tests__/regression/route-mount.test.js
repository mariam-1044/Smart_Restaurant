const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer, app;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

    const express = require('express');
    app = express();
    app.use(express.json());
    app.use('/api/auth', require('../../src/routes/auth.routes'));
    app.use('/api/customer', require('../../src/routes/customer.routes'));
    app.use('/api/menu', require('../../src/routes/menu.routes'));
    app.use('/api/orders', require('../../src/routes/order.routes'));
    app.use('/api/inventory', require('../../src/routes/inventory.routes'));
    app.use('/api/dashboard', require('../../src/routes/dashboard.routes'));
    app.use('/api/v1/ai/pricing', require('../../src/routes/pricing.routes'));
    app.use('/api/v1/ai', require('../../src/routes/ai.routes'));
    app.use('/api/v1/recommendations', require('../../src/routes/recommendation.routes'));
    app.use('/api/v1/dishes', require('../../src/routes/endorsement.routes'));
    app.use('/api/sales', require('../../src/routes/sales.routes'));
    app.use('/api/etl', require('../../src/routes/etl.routes'));
    app.use('/api/pos', require('../../src/routes/pos.routes'));
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

const surfaces = [
    ['POST', '/api/auth/login'],
    ['POST', '/api/customer/profile'],
    ['GET', '/api/menu'],
    ['GET', '/api/orders'],
    ['GET', '/api/inventory'],
    ['GET', '/api/dashboard'],
    ['GET', '/api/sales'],
    ['GET', '/api/v1/ai/health'],
    ['GET', '/api/v1/recommendations'],
    ['GET', '/api/v1/dishes'],
    ['GET', '/api/v1/ai/pricing'],
    ['GET', '/api/etl/report'],
    ['POST', '/api/pos/transaction']
];

describe('every previously-mounted route surface is reachable (not 404)', () => {
    surfaces.forEach(([method, path]) => {
        test(`${method} ${path} not 404`, async () => {
            const res = await request(app)[method.toLowerCase()](path).send({});
            expect(res.status).not.toBe(404);
        });
    });
});