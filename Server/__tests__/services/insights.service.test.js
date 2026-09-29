const mongoose = require('mongoose');
const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const insightsService = require('../../src/application/services/insights.service');
const Order = require('../../src/domain/models/Order');
const Dish = require('../../src/domain/models/Dish');
const Ingredient = require('../../src/domain/models/Ingredient');

function daysFromNow(n) {
    return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

describe('insights.service.getBusinessInsights', () => {
    withInMemoryMongo();

    test('returns the "not enough data" placeholder when collections are empty', async () => {
        const out = await insightsService.getBusinessInsights();
        expect(out.data).toHaveLength(1);
        expect(out.data[0].title).toMatch(/Not enough data/i);
        expect(out.didYouKnow).toBeNull();
    });

    test('derives menu-optimization, waste-prevention, stock-alert and a pairing insight from real data', async () => {
        const burger = await Dish.create({ name: 'Classic Burger', price: 90, category: 'Burgers' });
        const fries = await Dish.create({ name: 'House Fries', price: 30, category: 'Sides' });

        // Two completed orders, both pairing burger + fries; burger is the top seller.
        await Order.create([
            {
                items: [
                    { dish: burger._id, quantity: 3, priceAtTime: 90 },
                    { dish: fries._id, quantity: 1, priceAtTime: 30 }
                ],
                totalPrice: 300, status: 'completed', source: 'POS', paymentMethod: 'Cash'
            },
            {
                items: [
                    { dish: burger._id, quantity: 2, priceAtTime: 90 },
                    { dish: fries._id, quantity: 2, priceAtTime: 30 }
                ],
                totalPrice: 240, status: 'completed', source: 'POS', paymentMethod: 'Cash'
            }
        ]);

        // One ingredient about to expire, one running low.
        await Ingredient.create([
            { name: 'Lettuce', quantity: 8, unit: 'kg', minStock: 2, costPerUnit: 15, expiryDate: daysFromNow(2) },
            { name: 'Beef Patties', quantity: 1, unit: 'kg', minStock: 10, costPerUnit: 120, expiryDate: daysFromNow(20) }
        ]);

        const out = await insightsService.getBusinessInsights();
        const titles = out.data.map((d) => d.title);
        expect(titles).toEqual(expect.arrayContaining(['Menu Optimization', 'Waste Prevention', 'Stock Alert']));

        const menu = out.data.find((d) => d.title === 'Menu Optimization');
        expect(menu.type).toBe('marketing');
        expect(menu.description).toMatch(/Classic Burger/);

        const waste = out.data.find((d) => d.title === 'Waste Prevention');
        expect(waste.type).toBe('waste');
        expect(waste.description).toMatch(/Lettuce/);

        const stock = out.data.find((d) => d.title === 'Stock Alert');
        expect(stock.type).toBe('alert');
        expect(stock.description).toMatch(/Beef Patties/);

        expect(out.didYouKnow).toMatch(/Classic Burger|House Fries/);
    });
});
