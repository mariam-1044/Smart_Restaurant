const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../src/domain/models/User');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');

let mongoServer;
let app;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const etlRoutes = require('../../src/routes/etl.routes');

    app = express();
    app.use(express.json());
    app.use('/api/etl', etlRoutes);

    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

afterEach(async () => {
    await User.deleteMany({});
});

async function createAdminAndGetToken(email) {
    const user = await User.create({
        name: 'Admin',
        email: email,
        password: 'password123',
        role: 'admin',
        status: 'approved'
    });
    return jwt.sign({ id: user._id, version: user.tokenVersion }, process.env.JWT_SECRET || 'test-jwt-secret');
}

describe('ETL route smoke test', () => {
    test('GET /api/etl/report does NOT return 404', async () => {
        const token = await createAdminAndGetToken('etl-report@smoke.com');
        const res = await request(app)
            .get('/api/etl/report')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).not.toBe(404);
    });

    test('GET /api/etl/export does NOT return 404', async () => {
        const token = await createAdminAndGetToken('etl-export@smoke.com');
        const res = await request(app)
            .get('/api/etl/export')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).not.toBe(404);
    });
});