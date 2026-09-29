const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../src/domain/models/User');
const authService = require('../../src/application/services/auth.service');
const bcrypt = require('bcryptjs');

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

afterEach(async () => {
    await User.deleteMany({});
});

describe('AuthService.updateProfile', () => {
    let user;

    beforeEach(async () => {
        user = await User.create({
            name: 'Test User',
            email: 'test@example.com',
            password: 'password123',
            role: 'admin'
        });
    });

    test('updates name only', async () => {
        const updated = await authService.updateProfile(user._id, { name: 'New Name' });
        expect(updated.name).toBe('New Name');
        expect(updated.email).toBe('test@example.com');
    });

    test('updates phone and avatar', async () => {
        const updated = await authService.updateProfile(user._id, { phone: '+1234567890', avatar: 'https://example.com/avatar.png' });
        expect(updated.phone).toBe('+1234567890');
        expect(updated.avatar).toBe('https://example.com/avatar.png');
    });

    test('does not expose password in result', async () => {
        const updated = await authService.updateProfile(user._id, { name: 'New Name' });
        expect(updated.password).toBeUndefined();
    });
});

describe('AuthService.updatePassword', () => {
    let user;

    beforeEach(async () => {
        user = await User.create({
            name: 'Test User',
            email: 'test2@example.com',
            password: 'oldpassword123',
            role: 'admin'
        });
    });

    test('throws current_password_incorrect when current password is wrong', async () => {
        await expect(authService.updatePassword(user._id, 'wrongpassword', 'newpassword123'))
            .rejects.toEqual({ code: 'current_password_incorrect' });
    });

    test('throws same_as_current when new password equals current', async () => {
        await expect(authService.updatePassword(user._id, 'oldpassword123', 'oldpassword123'))
            .rejects.toEqual({ code: 'same_as_current' });
    });

    test('successfully updates password', async () => {
        const result = await authService.updatePassword(user._id, 'oldpassword123', 'newpassword456');
        expect(result.success).toBe(true);

        const freshUser = await User.findById(user._id).select('+password');
        const match = await freshUser.correctPassword('newpassword456', freshUser.password);
        expect(match).toBe(true);
    });

    test('old password no longer works after update', async () => {
        await authService.updatePassword(user._id, 'oldpassword123', 'newpassword456');

        const freshUser = await User.findById(user._id).select('+password');
        const match = await freshUser.correctPassword('oldpassword123', freshUser.password);
        expect(match).toBe(false);
    });

    test('throws user_not_found for non-existent user', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        await expect(authService.updatePassword(fakeId, 'oldpassword123', 'newpassword456'))
            .rejects.toEqual({ code: 'user_not_found' });
    });
});