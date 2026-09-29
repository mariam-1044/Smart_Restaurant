const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../src/domain/models/User');
const jwt = require('jsonwebtoken');

let mongoServer;
let app;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const posRoutes = require('../../src/routes/pos.routes');

    app = express();
    app.use(express.json());
    app.use('/api/pos', posRoutes);

    process.env.JWT_SECRET = 'test-jwt-secret';
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

async function getStaffToken() {
    const user = await User.create({
        name: 'Staff',
        email: 'staff-pos-smoke@test.com',
        password: 'password123',
        role: 'staff',
        status: 'approved'
    });
    return jwt.sign({ id: user._id, version: user.tokenVersion }, process.env.JWT_SECRET || 'test-jwt-secret');
}

describe('POS route smoke test', () => {
    test('POST /api/pos/transaction does NOT return 404', async () => {
        const token = await getStaffToken();
        const res = await request(app)
            .post('/api/pos/transaction')
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).not.toBe(404);
    });
});