const jwt = require('jsonwebtoken');

function mintToken(user, { ttl = '1h' } = {}) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  const payload = {
    id: user._id.toString(),
    version: user.tokenVersion ?? 0
  };
  return jwt.sign(payload, secret, { expiresIn: ttl });
}

module.exports = { mintToken };