const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../../domain/models/User');
const Dish = require('../../domain/models/Dish');
const Ingredient = require('../../domain/models/Ingredient');
const Customer = require('../../domain/models/Customer');
const Order = require('../../domain/models/Order');
const bcrypt = require('bcryptjs');
dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smart-restaurant';
const seedData = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB for seeding...');

        // Clear existing data
        await User.deleteMany({});
        await Dish.deleteMany({});
        await Ingredient.deleteMany({});
        await Customer.deleteMany({});
        await Order.deleteMany({});

        // 1. Create Admin, Staff, and Customer Users
        const admin = await User.create({
            name: 'Admin User',
            email: 'admin@restaurant.com',
            password: 'password123',
            role: 'admin',
            status: 'approved'
        });
        
        const staff = await User.create({
            name: 'Staff User',
            email: 'staff@restaurant.com',
            password: 'password123',
            role: 'staff',
            status: 'approved'
        });

        const customerUser = await User.create({
            name: 'Customer User',
            email: 'customer@restaurant.com',
            password: 'password123',
            role: 'customer',
            status: 'approved'
        });

        // 2. Create Ingredients
        const ingredients = await Ingredient.insertMany([
            { name: 'Tomato', quantity: 100, unit: 'kg', minStock: 10, expiryDate: new Date('2026-06-01'), wasteQuantity: 2 },
            { name: 'Cheese', quantity: 5, unit: 'kg', minStock: 10, expiryDate: new Date('2026-05-15'), wasteQuantity: 0.5 }, // Low stock
            { name: 'Dough', quantity: 200, unit: 'pcs', minStock: 20, expiryDate: new Date('2026-04-10'), wasteQuantity: 5 },
            { name: 'Chicken Breast', quantity: 80, unit: 'kg', minStock: 15, expiryDate: new Date('2026-03-20'), wasteQuantity: 1 },
            { name: 'Pasta', quantity: 150, unit: 'kg', minStock: 20, expiryDate: new Date('2027-01-01'), wasteQuantity: 0 },
            { name: 'Garlic', quantity: 10, unit: 'kg', minStock: 2, expiryDate: new Date('2026-08-01'), wasteQuantity: 0.2 }
        ]);

        // 3. Create Dishes
        const dishes = await Dish.insertMany([
            {
                name: 'Margherita Pizza',
                description: 'Classic pizza with tomato and cheese',
                price: 12.99,
                category: 'Pizza',
                ingredients: [
                    { ingredient: ingredients[0]._id, quantity: 0.2 },
                    { ingredient: ingredients[1]._id, quantity: 0.1 },
                    { ingredient: ingredients[2]._id, quantity: 1 }
                ],
                isAvailable: true,
                salesCount: 150,
                imageUrl: 'https://images.unsplash.com/photo-1593560704563-f176a2eb61db?q=80&w=1935&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
            },
            {
                name: 'Cheese Burger',
                description: 'Juicy burger with extra cheese',
                price: 9.99,
                category: 'Burgers',
                ingredients: [
                    { ingredient: ingredients[1]._id, quantity: 0.05 }
                ],
                isAvailable: true,
                salesCount: 200,
                imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=1935&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
            },
            {
                name: 'Chicken Alfredo',
                description: 'Creamy pasta with grilled chicken',
                price: 15.50,
                category: 'Pasta',
                ingredients: [
                    { ingredient: ingredients[3]._id, quantity: 0.2 },
                    { ingredient: ingredients[4]._id, quantity: 0.15 },
                    { ingredient: ingredients[1]._id, quantity: 0.05 }
                ],
                isAvailable: true,
                salesCount: 120,
                imageUrl: 'https://images.unsplash.com/photo-1612874742118-a2498278631d?q=80&w=1935&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
            },
            {
                name: 'Spicy Chicken Stir-fry',
                description: 'Tender chicken breast strips sautéed with crisp vegetables in a savory spicy sauce.',
                price: 14.00,
                category: 'Main',
                ingredients: [
                    { ingredient: ingredients[3]._id, quantity: 0.2 },
                    { ingredient: ingredients[0]._id, quantity: 0.1 },
                    { ingredient: ingredients[5]._id, quantity: 0.01 }
                ],
                isAvailable: true,
                salesCount: 90,
                imageUrl: 'https://images.unsplash.com/photo-1598511757313-ee206011a61f?q=80&w=1935&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
            },
            {
                name: 'Fresh Orange Juice',
                description: 'Freshly squeezed orange juice.',
                price: 4.50,
                category: 'Drinks',
                ingredients: [],
                isAvailable: true,
                salesCount: 250,
                imageUrl: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?q=80&w=1935&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
            }
        ]);

        // 4. Create Customers (aggregates are filled in after the orders below
        //    so the numbers shown in the UI match the actual order documents).
        const customer = await Customer.create({
            name: 'John Doe',
            phone: '1234567890',
            lastVisit: new Date()
        });

        // 5. Create Sample Orders — 2 completed & paid, 1 pending & unpaid.
        const orders = await Order.create([
            {
                items: [{ dish: dishes[0]._id, quantity: 1, priceAtTime: 12.99 }],
                totalPrice: 12.99,
                customer: customer._id,
                status: 'completed',
                isPaid: true,
                paidAt: new Date(),
                source: 'POS'
            },
            {
                items: [{ dish: dishes[1]._id, quantity: 2, priceAtTime: 9.99 }],
                totalPrice: 19.98,
                customer: customer._id,
                status: 'completed',
                isPaid: true,
                paidAt: new Date(),
                source: 'Online'
            },
            {
                items: [{ dish: dishes[2]._id, quantity: 1, priceAtTime: 15.50 }],
                totalPrice: 15.50,
                customer: customer._id,
                status: 'pending',
                isPaid: false,
                source: 'POS'
            }
        ]);

        // 6. Backfill the customer's derived stats from the orders we just made.
        const paidTotal = orders
            .filter((o) => o.isPaid && o.status !== 'cancelled')
            .reduce((s, o) => s + o.totalPrice, 0);
        const favCounts = new Map();
        orders.forEach((o) => o.items.forEach((it) => {
            favCounts.set(String(it.dish), (favCounts.get(String(it.dish)) || 0) + it.quantity);
        }));
        customer.orderHistory = orders.map((o) => o._id);
        customer.totalOrders = orders.length;
        customer.totalSpend = Math.round(paidTotal * 100) / 100;
        customer.lastOrderAt = new Date();
        customer.favorites = [...favCounts.entries()].map(([dish, count]) => ({ dish, count }));
        customer.favoritesCount = customer.favorites.length;
        await customer.save();

        console.log('Seeding completed successfully with realistic data!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding data:', error.message);
        process.exit(1);
    }
};

seedData();
