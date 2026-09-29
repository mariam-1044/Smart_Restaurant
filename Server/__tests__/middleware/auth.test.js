const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const { seedUser } = require('../helpers/seedUser');
const { mintToken } = require('../helpers/mintToken');
const express = require('express');
const request = require('supertest');
const { protect, restrictTo } = require('../../src/middlewares/auth.middleware');

describe('Auth Middleware', () => {
  withInMemoryMongo();

  let app, user;
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.get('/test', protect, (req, res) => res.json({ user: req.user }));
    app.get('/admin-only', protect, restrictTo('admin'), (req, res) => res.json({ ok: true }));
  });

  test('no Authorization header returns 401', async () => {
    const res = await request(app).get('/test');
    expect(res.status).toBe(401);
  });

  test('malformed Authorization header returns 401', async () => {
    const res = await request(app).get('/test').set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
  });

  test('expired JWT returns 401', async () => {
    user = await seedUser({ role: 'admin' });
    const token = mintToken(user, { ttl: '-1s' });
    const res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  test('token signed with wrong secret returns 401', async () => {
    user = await seedUser({ role: 'admin' });
    const jwt = require('jsonwebtoken');
    const wrongToken = jwt.sign({ id: user._id, version: user.tokenVersion }, 'wrong-secret');
    const res = await request(app).get('/test').set('Authorization', `Bearer ${wrongToken}`);
    expect(res.status).toBe(401);
    expect(res.body.errorType).toBe('INVALID_TOKEN');
  });

  test('valid token with admin role populates req.user', async () => {
    user = await seedUser({ role: 'admin' });
    const token = mintToken(user);
    const res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
  });

  test('role guard rejects wrong role with 403', async () => {
    user = await seedUser({ role: 'staff' });
    const token = mintToken(user);
    const res = await request(app).get('/admin-only').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('role guard allows correct role', async () => {
    user = await seedUser({ role: 'admin' });
    const token = mintToken(user);
    const res = await request(app).get('/admin-only').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});