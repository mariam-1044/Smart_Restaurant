const User = require('../../src/domain/models/User');

function randomId() {
  return Math.random().toString(36).slice(2, 8);
}

async function seedUser({
  role = 'staff',
  email,
  password = 'TestPass!23',
  status = 'approved',
  name,
  ...overrides
} = {}) {
  const finalEmail = email || `${role}-${randomId()}@test.co`;
  const finalName = name || `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`;
  const user = new User({
    email: finalEmail,
    password,
    role,
    status,
    name: finalName,
    ...overrides
  });
  await user.save();
  return user;
}

module.exports = { seedUser };