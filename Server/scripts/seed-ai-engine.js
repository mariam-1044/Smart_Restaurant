// Seed the AI engine pilot dataset (quickstart.md §4).
// Creates: 5 categories' worth of dishes (30 dishes), 50 customer Users,
// 200 completed orders across the trailing 60 days, and 1 admin / 1 staff /
// 1 customer user with known credentials.
//
// Idempotent-ish: re-running upserts users by email and clears prior
// seeded orders before inserting fresh ones.

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../src/infrastructure/config/db');

const User = require('../src/domain/models/User');
const Customer = require('../src/domain/models/Customer');
const Dish = require('../src/domain/models/Dish');
const Ingredient = require('../src/domain/models/Ingredient');
const Order = require('../src/domain/models/Order');

const DAY_MS = 24 * 60 * 60 * 1000;

const CATEGORIES = ['Pizza', 'Burgers', 'Pasta', 'Drinks', 'Desserts'];

// Category → rotating pool of real food photos so generated dishes are never
// blank placeholders. Each dish picks a photo by its index within the category.
const CATEGORY_PHOTOS = {
    Pizza: [
        'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1200&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=1200&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1593560704563-f176a2eb61db?q=80&w=1200&auto=format&fit=crop'
    ],
    Burgers: [
        'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=1200&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=1200&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=1200&auto=format&fit=crop'
    ],
    Pasta: [
        'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?q=80&w=1200&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1612874742118-a2498278631d?q=80&w=1200&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?q=80&w=1200&auto=format&fit=crop'
    ],
    Drinks: [
        'https://images.unsplash.com/photo-1600271886742-f049cd451bba?q=80&w=1200&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1437418747212-8d9709afab22?q=80&w=1200&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1551024601-bec78aea704b?q=80&w=1200&auto=format&fit=crop'
    ],
    Desserts: [
        'https://images.unsplash.com/photo-1551024506-0bccd828d307?q=80&w=1200&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=1200&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1565958011703-44f9829ba187?q=80&w=1200&auto=format&fit=crop'
    ]
};

function photoFor(category, index) {
    const pool = CATEGORY_PHOTOS[category] || CATEGORY_PHOTOS.Drinks;
    return pool[index % pool.length];
}

async function upsertUser(email, name, role, password) {
    let user = await User.findOne({ email });
    if (user) {
        user.name = name;
        user.role = role;
        user.password = await bcrypt.hash(password, 12);
        user.markModified('password');
        // bypass pre-save hash by setting via save (the hook will skip if !modified)
        await user.save();
        return user;
    }
    return await User.create({ name, email, password, role });
}

async function ensureIngredients() {
    const names = ['flour', 'cheese', 'tomato', 'beef', 'lettuce', 'pasta', 'cream', 'sugar', 'cocoa'];
    const ingredients = [];
    for (const n of names) {
        let ing = await Ingredient.findOne({ name: n });
        if (!ing) {
            ing = await Ingredient.create({
                name: n,
                quantity: 100,
                unit: 'kg',
                minStock: 10,
                costPerUnit: 1.5,
                expiryDate: new Date(Date.now() + 7 * DAY_MS)
            });
        }
        ingredients.push(ing);
    }
    return ingredients;
}

async function ensureDishes(ingredients) {
    const ingByName = Object.fromEntries(ingredients.map((i) => [i.name, i]));
    const blueprint = [];
    let counter = 1;
    for (const cat of CATEGORIES) {
        for (let i = 0; i < 6; i++) {
            blueprint.push({
                name: `${cat} #${counter++}`,
                category: cat,
                price: 8 + i * 2,
                imageUrl: photoFor(cat, i),
                ingredients: [
                    { ingredient: ingByName[i % 2 === 0 ? 'cheese' : 'tomato']._id, quantity: 0.1 },
                    { ingredient: ingByName['flour']._id, quantity: 0.2 }
                ]
            });
        }
    }
    const dishes = [];
    for (const dishSpec of blueprint) {
        let dish = await Dish.findOne({ name: dishSpec.name });
        if (!dish) {
            dish = await Dish.create(dishSpec);
        } else if (!dish.imageUrl || dish.imageUrl === 'default-dish.png') {
            // Backfill a photo onto dishes seeded before photos were added.
            dish.imageUrl = dishSpec.imageUrl;
            await dish.save();
        }
        dishes.push(dish);
    }
    return dishes;
}

async function ensureCustomerUsers(count) {
    const out = [];
    for (let i = 0; i < count; i++) {
        const email = `diner${i}@example.com`;
        const user = await upsertUser(email, `Diner ${i}`, 'customer', 'diner123');
        out.push(user);
    }
    return out;
}

async function ensureCustomers(count) {
    const out = [];
    for (let i = 0; i < count; i++) {
        const phone = `+1555000${String(i).padStart(4, '0')}`;
        let c = await Customer.findOne({ phone });
        if (!c) {
            c = await Customer.create({ name: `Walk-in ${i}`, phone });
        }
        out.push(c);
    }
    return out;
}

async function seedOrders(customerUsers, dishes) {
    // Clear seeded orders (only ones created by this script — we tag via source=POS_SIMULATOR).
    await Order.deleteMany({ source: 'POS_SIMULATOR' });

    const totalOrders = 200;
    const now = Date.now();

    function pickItems() {
        const k = 1 + Math.floor((Math.random() * 1) + (Math.random() * 1) + (Math.random() * 1));
        const chosen = new Set();
        const items = [];
        while (chosen.size < k) {
            const idx = Math.floor(Math.random() * dishes.length);
            if (chosen.has(idx)) continue;
            chosen.add(idx);
            const d = dishes[idx];
            items.push({
                dish: d._id,
                quantity: 1 + Math.floor(Math.random() * 2),
                priceAtTime: d.price
            });
        }
        return items;
    }

    const docs = [];
    for (let i = 0; i < totalOrders; i++) {
        const ageDays = Math.floor(Math.random() * 60);
        const at = new Date(now - ageDays * DAY_MS);
        const items = pickItems();
        const totalPrice = items.reduce((s, it) => s + it.priceAtTime * it.quantity, 0);
        const customerUser = customerUsers[i % customerUsers.length];
        docs.push({
            items,
            totalPrice,
            status: 'completed',
            source: 'POS_SIMULATOR',
            paymentMethod: 'Cash',
            isPaid: true,
            paidAt: at,
            user: customerUser._id,
            createdAt: at,
            updatedAt: at
        });
    }
    await Order.insertMany(docs);
    return docs.length;
}

async function main() {
    await connectDB();
    console.log('Seeding AI engine pilot data...');

    const admin = await upsertUser('admin@example.com', 'Admin', 'admin', 'admin123');
    const staff = await upsertUser('staff@example.com', 'Staff', 'staff', 'staff123');
    const diner = await upsertUser('diner@example.com', 'Primary Diner', 'customer', 'diner123');

    const ingredients = await ensureIngredients();
    const dishes = await ensureDishes(ingredients);
    const customerUsers = await ensureCustomerUsers(50);
    await ensureCustomers(50);
    const ordersInserted = await seedOrders([diner, ...customerUsers], dishes);

    console.log('--- seeded ---');
    console.log('admin@example.com / admin123  (role=admin) id=' + admin._id);
    console.log('staff@example.com / staff123  (role=staff) id=' + staff._id);
    console.log('diner@example.com / diner123  (role=customer) customerId=' + diner._id);
    console.log(`dishes=${dishes.length} customer-users=${customerUsers.length} orders=${ordersInserted}`);

    await mongoose.disconnect();
    process.exit(0);
}

main().catch((err) => {
    console.error('seed-ai-engine failed:', err.message);
    process.exit(1);
});
