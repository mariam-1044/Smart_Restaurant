const Joi = require('joi');
const validate = require('../../src/middlewares/validate.middleware');
const express = require('express');
const request = require('supertest');

describe('Validate Middleware', () => {
  let app;
  const schema = Joi.object({ name: Joi.string().required(), age: Joi.number().min(0) });

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.post('/test', validate(schema), (req, res) => res.json({ ok: true }));
  });

  test('passes through when body matches schema', async () => {
    const res = await request(app).post('/test').send({ name: 'Alice', age: 30 });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('returns 400 when body fails schema', async () => {
    const res = await request(app).post('/test').send({ age: -5 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 with descriptive error for missing fields', async () => {
    const res = await request(app).post('/test').send({});
    expect(res.status).toBe(400);
  });

  test('validate with params source', async () => {
    const paramSchema = Joi.object({ id: Joi.string().hex().length(24).required() });
    const app2 = express();
    app2.use(express.json());
    app2.patch('/test/:id', validate(paramSchema, 'params'), (req, res) => res.json({ ok: true }));
    const validId = '507f1f77bcf86cd799439011';
    const res = await request(app2).patch(`/test/${validId}`).send({});
    expect(res.status).toBe(200);
  });
});