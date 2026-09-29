const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const User = require('../../src/domain/models/User');
const Ingredient = require('../../src/domain/models/Ingredient');
const inventoryRoutes = require('../../src/routes/inventory.routes');

let mongoServer, app, adminToken, customerToken;

function parseCsv(csv) {
    const lines = csv.split(/\r\n/).filter(l => l.length > 0);
    return lines.map(line => {
        const out = []; let cur = ''; let q = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (q) {
                if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
                else if (c === '"') q = false;
                else cur += c;
            } else if (c === '"') q = true;
            else if (c === ',') { out.push(cur); cur = ''; }
            else cur += c;
        }
        out.push(cur);
        return out;
    });
}

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
    app = express();
    app.use(express.json());
    app.use('/api/inventory', inventoryRoutes);
    const admin = await User.create({ name: 'A', email: 'a-invexport@x.com', password: 'pass1234', role: 'admin', status: 'approved' });
    const cust = await User.create({ name: 'C', email: 'c-invexport@x.com', password: 'pass1234', role: 'customer', status: 'approved' });
    adminToken = jwt.sign({ id: admin._id, version: admin.tokenVersion }, process.env.JWT_SECRET);
    customerToken = jwt.sign({ id: cust._id, version: cust.tokenVersion }, process.env.JWT_SECRET);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await Ingredient.deleteMany({});
});

describe('GET /api/inventory/export', () => {
    test('headers: Content-Type CSV + Content-Disposition', async () => {
        await Ingredient.create({ name: 'Tomato', quantity: 10, unit: 'kg', minStock: 2, costPerUnit: 5, expiryDate: new Date(Date.now() + 30 * 86400000) });
        const res = await request(app).get('/api/inventory/export').set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/csv/);
        expect(res.headers['content-disposition']).toMatch(/attachment;\s*filename="inventory-\d{4}-\d{2}-\d{2}\.csv"/);
    });

    test('SC-008: round-trip with comma/quote/newline ingredient names', async () => {
        await Ingredient.create({ name: 'Tomato, Fresh', quantity: 1, unit: 'kg', minStock: 1, costPerUnit: 5, expiryDate: new Date(Date.now() + 30 * 86400000) });
        await Ingredient.create({ name: 'Say "hi"', quantity: 1, unit: 'kg', minStock: 1, costPerUnit: 5, expiryDate: new Date(Date.now() + 30 * 86400000) });
        const res = await request(app).get('/api/inventory/export').set('Authorization', `Bearer ${adminToken}`);
        const rows = parseCsv(res.text);
        const names = rows.slice(1).map(r => r[0]).sort();
        expect(names).toEqual(['Say "hi"', 'Tomato, Fresh']);
    });

    test('FR-008: empty inventory returns header-only CSV', async () => {
        const res = await request(app).get('/api/inventory/export').set('Authorization', `Bearer ${adminToken}`);
        const lines = res.text.split('\r\n').filter(l => l.length > 0);
        expect(lines.length).toBe(1);
    });

    test('SC-008a: lowStock=true returns subset', async () => {
        await Ingredient.create({ name: 'Low1', quantity: 1, unit: 'kg', minStock: 5, costPerUnit: 5, expiryDate: new Date(Date.now() + 30 * 86400000) });
        await Ingredient.create({ name: 'OK', quantity: 9, unit: 'kg', minStock: 5, costPerUnit: 5, expiryDate: new Date(Date.now() + 30 * 86400000) });
        const res = await request(app).get('/api/inventory/export?lowStock=true').set('Authorization', `Bearer ${adminToken}`);
        const rows = parseCsv(res.text);
        const names = rows.slice(1).map(r => r[0]);
        expect(names).toEqual(['Low1']);
    });

    test('SC-008a: nearExpiry=true respects days param', async () => {
        await Ingredient.create({ name: 'Soon', quantity: 5, unit: 'kg', minStock: 1, costPerUnit: 5, expiryDate: new Date(Date.now() + 2 * 86400000) });
        await Ingredient.create({ name: 'Late', quantity: 5, unit: 'kg', minStock: 1, costPerUnit: 5, expiryDate: new Date(Date.now() + 60 * 86400000) });
        const res = await request(app).get('/api/inventory/export?nearExpiry=true&days=7').set('Authorization', `Bearer ${adminToken}`);
        const names = parseCsv(res.text).slice(1).map(r => r[0]);
        expect(names).toContain('Soon');
        expect(names).not.toContain('Late');
    });

    test('search filter restricts to matching name', async () => {
        await Ingredient.create({ name: 'Tomato', quantity: 1, unit: 'kg', minStock: 1, costPerUnit: 5, expiryDate: new Date(Date.now() + 30 * 86400000) });
        await Ingredient.create({ name: 'Onion', quantity: 1, unit: 'kg', minStock: 1, costPerUnit: 5, expiryDate: new Date(Date.now() + 30 * 86400000) });
        const res = await request(app).get('/api/inventory/export?search=tomato').set('Authorization', `Bearer ${adminToken}`);
        const names = parseCsv(res.text).slice(1).map(r => r[0]);
        expect(names).toEqual(['Tomato']);
    });

    test('customer role returns 403', async () => {
        const res = await request(app).get('/api/inventory/export').set('Authorization', `Bearer ${customerToken}`);
        expect(res.status).toBe(403);
    });

    test('no token returns 401', async () => {
        const res = await request(app).get('/api/inventory/export');
        expect(res.status).toBe(401);
    });
});