const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const User = require('../../src/domain/models/User');
const authRoutes = require('../../src/routes/auth.routes');

let mongoServer, app, user, token;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await User.deleteMany({});
    user = await User.create({
        name: 'Original', email: 'user@x.com', password: 'oldpass1',
        role: 'admin', status: 'approved'
    });
    token = jwt.sign({ id: user._id, version: user.tokenVersion }, process.env.JWT_SECRET);
});

describe('PATCH /api/auth/update-profile', () => {
    test('happy path: name only', async () => {
        const res = await request(app).patch('/api/auth/update-profile')
            .set('Authorization', `Bearer ${token}`).send({ name: 'New' });
        expect(res.status).toBe(200);
        const reread = await User.findById(user._id);
        expect(reread.name).toBe('New');
    });

    test('happy path: name + phone + avatar', async () => {
        const res = await request(app).patch('/api/auth/update-profile')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'NewName', phone: '+201001112222', avatar: 'https://example.com/avatar.png' });
        expect(res.status).toBe(200);
        const reread = await User.findById(user._id);
        expect(reread.phone).toBe('+201001112222');
        expect(reread.avatar).toBe('https://example.com/avatar.png');
    });

    test('email equal to current (case-insensitive) accepted as no-op', async () => {
        const res = await request(app).patch('/api/auth/update-profile')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'CaseTest', email: 'USER@X.COM' });
        expect(res.status).toBe(200);
        const reread = await User.findById(user._id);
        expect(reread.name).toBe('CaseTest');
        expect(reread.email).toBe('user@x.com');
    });

    test('SC-005a: email change rejected ATOMICALLY — no fields persist', async () => {
        const before = await User.findById(user._id);
        const res = await request(app).patch('/api/auth/update-profile')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'ShouldNotPersist', email: 'different@x.com' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/email-verification flow/);
        const after = await User.findById(user._id);
        expect(after.name).toBe(before.name);
    });

    test('empty body returns 400', async () => {
        const res = await request(app).patch('/api/auth/update-profile')
            .set('Authorization', `Bearer ${token}`).send({});
        expect(res.status).toBe(400);
    });

    test('no token returns 401', async () => {
        const res = await request(app).patch('/api/auth/update-profile').send({ name: 'X' });
        expect(res.status).toBe(401);
    });
});