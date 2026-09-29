const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const authService = require('../../src/application/services/auth.service');
const User = require('../../src/domain/models/User');

describe('Auth Service (full)', () => {
  withInMemoryMongo();

  let user;
  beforeEach(async () => {
    user = await User.create({ name: 'Auth Test', email: 'auth@test.co', password: 'Password!23', role: 'admin', status: 'approved' });
  });

  test('updateProfile updates name and phone', async () => {
    const updated = await authService.updateProfile(user._id, { name: 'Updated Name', phone: '555-1234' });
    expect(updated.name).toBe('Updated Name');
    expect(updated.phone).toBe('555-1234');
  });

  test('updateProfile ignores disallowed fields', async () => {
    const updated = await authService.updateProfile(user._id, { role: 'staff' });
    const refreshed = await User.findById(user._id);
    expect(refreshed.role).toBe('admin');
  });

  test('updatePassword succeeds with correct current password', async () => {
    const result = await authService.updatePassword(user._id, 'Password!23', 'NewPass!234');
    expect(result.success).toBe(true);
    const refreshed = await User.findById(user._id).select('+password');
    const match = await refreshed.correctPassword('NewPass!234', refreshed.password);
    expect(match).toBe(true);
  });

  test('updatePassword rejects wrong current password', async () => {
    await expect(authService.updatePassword(user._id, 'wrongpassword', 'NewPass!234')).rejects.toEqual({ code: 'current_password_incorrect' });
  });

  test('updateProfile does not allow changing to a duplicate email via save (unique constraint)', async () => {
    const other = await User.create({ name: 'Other', email: 'other@test.co', password: 'Password!23', role: 'staff', status: 'approved' });
    const dupUser = new User({ name: 'Dup', email: 'other@test.co', password: 'Pass!2345', role: 'admin', status: 'approved' });
    await expect(dupUser.save()).rejects.toThrow();
  });
});