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
    app.use('/api/menu', require('../../src/routes/menu.routes'));
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('public-read contract regression (SC-013)', () => {
    test('GET /api/menu shape: { success, count, data: [] }', async () => {
        const res = await request(app).get('/api/menu');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('count');
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('GET /api/menu/:id with unknown id returns 404 with { success:false }', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app).get(`/api/menu/${fakeId}`);
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });
});