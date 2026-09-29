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
        name: 'Test', email: 'pwtest@x.com', password: 'oldPass1',
        role: 'admin', status: 'approved'
    });
    token = jwt.sign({ id: user._id, version: user.tokenVersion }, process.env.JWT_SECRET);
});

describe('PATCH /api/auth/update-password', () => {
    test('SC-007: happy path; old password no longer works', async () => {
        const res = await request(app).patch('/api/auth/update-password')
            .set('Authorization', `Bearer ${token}`)
            .send({ currentPassword: 'oldPass1', newPassword: 'newPass2' });
        expect(res.status).toBe(200);
        const fresh = await User.findById(user._id).select('+password');
        expect(await fresh.correctPassword('newPass2', fresh.password)).toBe(true);
        expect(await fresh.correctPassword('oldPass1', fresh.password)).toBe(false);
    });

    test('SC-006: wrong current password returns 401, hash unchanged', async () => {
        const before = await User.findById(user._id).select('+password');
        const res = await request(app).patch('/api/auth/update-password')
            .set('Authorization', `Bearer ${token}`)
            .send({ currentPassword: 'WRONG', newPassword: 'newPass2' });
        expect(res.status).toBe(401);
        const after = await User.findById(user._id).select('+password');
        expect(after.password).toBe(before.password);
    });

    test('SC-006a: too-short new password — violations include min_length and missing_digit', async () => {
        const res = await request(app).patch('/api/auth/update-password')
            .set('Authorization', `Bearer ${token}`)
            .send({ currentPassword: 'oldPass1', newPassword: 'abc' });
        expect(res.status).toBe(400);
        expect(res.body.violations).toEqual(expect.arrayContaining(['min_length', 'missing_digit']));
    });

    test('SC-006a: all-letters — violations include missing_digit', async () => {
        const res = await request(app).patch('/api/auth/update-password')
            .set('Authorization', `Bearer ${token}`)
            .send({ currentPassword: 'oldPass1', newPassword: 'abcdefghi' });
        expect(res.status).toBe(400);
        expect(res.body.violations).toContain('missing_digit');
    });

    test('SC-006a: all-digits — violations include missing_letter', async () => {
        const res = await request(app).patch('/api/auth/update-password')
            .set('Authorization', `Bearer ${token}`)
            .send({ currentPassword: 'oldPass1', newPassword: '12345678' });
        expect(res.status).toBe(400);
        expect(res.body.violations).toContain('missing_letter');
    });

    test('SC-006a: same_as_current', async () => {
        const res = await request(app).patch('/api/auth/update-password')
            .set('Authorization', `Bearer ${token}`)
            .send({ currentPassword: 'oldPass1', newPassword: 'oldPass1' });
        expect(res.status).toBe(400);
        expect(res.body.violations).toContain('same_as_current');
    });

    test('no token returns 401', async () => {
        const res = await request(app).patch('/api/auth/update-password')
            .send({ currentPassword: 'oldPass1', newPassword: 'newPass2' });
        expect(res.status).toBe(401);
    });
});