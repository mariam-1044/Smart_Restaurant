const { registerSchema, loginSchema, updateProfileSchema, changePasswordSchema } = require('../../src/application/validations/auth.validation');

describe('Auth Validation Schemas', () => {
  test('registerSchema accepts valid data', () => {
    const { error } = registerSchema.validate({ name: 'Test', email: 'test@test.co', password: 'Password!23' });
    expect(error).toBeUndefined();
  });

  test('registerSchema rejects missing name', () => {
    const { error } = registerSchema.validate({ email: 'test@test.co', password: 'Password!23' });
    expect(error).toBeDefined();
  });

  test('registerSchema rejects invalid email', () => {
    const { error } = registerSchema.validate({ name: 'Test', email: 'bad-email', password: 'Password!23' });
    expect(error).toBeDefined();
  });

  test('registerSchema rejects short password', () => {
    const { error } = registerSchema.validate({ name: 'Test', email: 'test@test.co', password: '123' });
    expect(error).toBeDefined();
  });

  test('loginSchema accepts valid data', () => {
    const { error } = loginSchema.validate({ email: 'test@test.co', password: 'Password!23' });
    expect(error).toBeUndefined();
  });

  test('loginSchema rejects missing password', () => {
    const { error } = loginSchema.validate({ email: 'test@test.co' });
    expect(error).toBeDefined();
  });

  test('updateProfileSchema requires at least one field', () => {
    const { error } = updateProfileSchema.validate({});
    expect(error).toBeDefined();
  });

  test('updateProfileSchema accepts partial update', () => {
    const { error } = updateProfileSchema.validate({ name: 'New Name' });
    expect(error).toBeUndefined();
  });

  test('changePasswordSchema rejects missing current password', () => {
    const { error } = changePasswordSchema.validate({ newPassword: 'NewPass!234' });
    expect(error).toBeDefined();
  });

  test('changePasswordSchema accepts valid data', () => {
    const { error } = changePasswordSchema.validate({ currentPassword: 'OldPass!23', newPassword: 'NewPass!234' });
    expect(error).toBeUndefined();
  });

  test('changePasswordSchema rejects missing new password', () => {
    const { error } = changePasswordSchema.validate({ currentPassword: 'OldPass!23' });
    expect(error).toBeDefined();
  });
});