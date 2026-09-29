const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const User = require('../../src/domain/models/User');

describe('User Model', () => {
  withInMemoryMongo();

  test('password is hashed on save', async () => {
    const user = await User.create({ name: 'Test', email: 'hash@test.co', password: 'PlainText!23', role: 'admin', status: 'approved' });
    expect(user.password).not.toBe('PlainText!23');
    expect(user.password).toMatch(/^\$2[aby]?\$\d+\$/);
  });

  test('re-hashing password on update', async () => {
    const user = await User.create({ name: 'Test', email: 'rehash@test.co', password: 'OldPass!23', role: 'admin', status: 'approved' });
    user.password = 'NewPass!234';
    await user.save();
    expect(user.password).not.toBe('NewPass!234');
    expect(user.password).toMatch(/^\$2[aby]?\$\d+\$/);
  });

  test('role enum rejects invalid value', async () => {
    await expect(User.create({ name: 'Bad', email: 'badrole@test.co', password: 'Pass!2345', role: 'superadmin', status: 'approved' })).rejects.toThrow();
  });

  test('email validator rejects malformed email', async () => {
    await expect(User.create({ name: 'Bad', email: 'not-an-email', password: 'Pass!2345', role: 'admin', status: 'approved' })).rejects.toThrow();
  });

  test('duplicate email throws error', async () => {
    await User.create({ name: 'D1', email: 'dup@test.com', password: 'Pass!2345', role: 'admin', status: 'approved' });
    await expect(User.create({ name: 'D2', email: 'dup@test.com', password: 'Pass!2345', role: 'staff', status: 'approved' })).rejects.toThrow();
  });
});