// =====================================================================
// Gusteau — Comprehensive demo seed.
//
// Wipes Users / Dishes / Ingredients / Customers / Orders and repopulates
// with a rich, internally-consistent dataset that exercises EVERY feature:
//
//   • Dashboard / Sales ....... ~80 days of completed orders with weekday
//                               seasonality + per-dish popularity.
//   • Inventory / Waste ....... ingredients with varied cost, several below
//                               min-stock and several near/at expiry.
//   • POS / Orders ............ completed history + a few live pending/preparing.
//   • Forecasting ............. dense multi-day history for the core dishes
//                               (≥30 days) so Prophet has real signal.
//   • Dynamic Pricing ......... every dish has ingredient costs (so margins
//                               compute); a few are intentional loss-makers
//                               and thin-margin dishes to trigger "save from
//                               loss" / profit alerts.
//   • Recommendations ......... orders carry BOTH `user` and `customer`, with
//                               many diners sharing overlapping dishes.
//   • Market Basket ........... ~half the orders have ≥2 distinct dishes.
//   • Customers ............... Customer docs with backfilled spend/visits.
//
// Images use same-origin bundled SVGs (/dishes/<category>.svg) so dishes
// always render in the live deployment — no external image host required.
//
// Run inside the server container against the deployed Mongo:
//   docker compose exec server npm run seed:demo
// =====================================================================

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/domain/models/User');
const Dish = require('../src/domain/models/Dish');
const Ingredient = require('../src/domain/models/Ingredient');
const Customer = require('../src/domain/models/Customer');
const Order = require('../src/domain/models/Order');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smart-restaurant';
const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();

const imageFor = (category) => `/dishes/${String(category).toLowerCase()}.svg`;
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------------------------------------------------------------------
// 1. Ingredients — varied cost (drives pricing margins), varied stock
//    (some below minStock = low-stock alerts), varied expiry (some past /
//    near = waste + spoilage signals).
//    expiryInDays < 0 = already expired.
// ---------------------------------------------------------------------
const INGREDIENTS = [
    // name,            unit,  cost, qty, minStock, expiryInDays, waste
    ['Flour',          'kg',  1.2, 120, 20,  180, 3],
    ['Tomato',         'kg',  2.0,   8, 15,    4, 2],   // LOW + near expiry
    ['Mozzarella',     'kg',  6.5,  40, 10,   12, 1],
    ['Beef Patty',     'pcs', 1.8,  60, 20,    6, 2],
    ['Chicken Breast', 'kg',  5.0,   9, 15,    3, 1],   // LOW + near expiry
    ['Pasta',          'kg',  1.5, 150, 20,  365, 0],
    ['Cream',          'l',   3.2,  25,  8,   10, 0.5],
    ['Lettuce',        'kg',  1.6,  12, 10,   -1, 3],   // EXPIRED -> waste
    ['Burger Bun',     'pcs', 0.5, 200, 30,    8, 5],
    ['Cheddar',        'kg',  5.5,  30, 10,   20, 0.5],
    ['Potato',         'kg',  0.9, 100, 20,   30, 4],
    ['Sugar',          'kg',  0.8,  80, 10,  400, 0],
    ['Cocoa',          'kg',  9.0,   6,  5,  200, 0],   // LOW
    ['Orange',         'kg',  2.2,  40, 10,    7, 2],
    ['Coffee Beans',   'kg', 12.0,  18,  5,  150, 0],
    ['Olive Oil',      'l',   7.5,  22,  6,  300, 0],
    ['Garlic',         'kg',  3.0,  10,  3,   60, 0.5],
    ['Bell Pepper',    'kg',  2.8,  14,  8,    5, 1.5],
    ['Salmon Fillet',  'kg', 14.0,   7,  8,    2, 1],   // LOW + near expiry (premium)
    ['Rice',           'kg',  1.3,  90, 15,  365, 0],
];

// ---------------------------------------------------------------------
// 2. Dishes — name, category (must match Dish enum), price, ingredients.
//    A handful are deliberately under-priced (loss-makers / thin margin)
//    so the pricing engine raises "save from loss" / profit notifications.
// ---------------------------------------------------------------------
const DISHES = [
    // Pizza
    ['Margherita Pizza',   'Pizza',    11.99, [['Flour', 0.25], ['Tomato', 0.15], ['Mozzarella', 0.12]]],
    ['Pepperoni Pizza',    'Pizza',    13.99, [['Flour', 0.25], ['Tomato', 0.12], ['Mozzarella', 0.12], ['Beef Patty', 0.5]]],
    ['Quattro Formaggi',   'Pizza',    14.50, [['Flour', 0.25], ['Mozzarella', 0.15], ['Cheddar', 0.10], ['Cream', 0.05]]],
    ['Veggie Supreme',     'Pizza',    12.50, [['Flour', 0.25], ['Tomato', 0.10], ['Mozzarella', 0.10], ['Bell Pepper', 0.08]]],
    // Burgers
    ['Classic Cheeseburger', 'Burgers', 9.99, [['Burger Bun', 1], ['Beef Patty', 1], ['Cheddar', 0.05], ['Lettuce', 0.03]]],
    ['Double Bacon Burger',  'Burgers', 13.50, [['Burger Bun', 1], ['Beef Patty', 2], ['Cheddar', 0.06], ['Lettuce', 0.03]]],
    ['Crispy Chicken Burger','Burgers', 11.00, [['Burger Bun', 1], ['Chicken Breast', 0.18], ['Lettuce', 0.04]]],
    ['Veggie Burger',        'Burgers', 9.50, [['Burger Bun', 1], ['Potato', 0.10], ['Lettuce', 0.04], ['Tomato', 0.05]]],
    // Pasta
    ['Spaghetti Bolognese', 'Pasta', 13.00, [['Pasta', 0.20], ['Tomato', 0.15], ['Beef Patty', 0.5]]],
    ['Chicken Alfredo',     'Pasta', 14.50, [['Pasta', 0.20], ['Cream', 0.15], ['Chicken Breast', 0.15], ['Mozzarella', 0.05]]],
    ['Penne Arrabbiata',    'Pasta', 11.50, [['Pasta', 0.20], ['Tomato', 0.18], ['Garlic', 0.02], ['Olive Oil', 0.02]]],
    ['Seafood Linguine',    'Pasta', 18.00, [['Pasta', 0.20], ['Salmon Fillet', 0.12], ['Cream', 0.08], ['Garlic', 0.02]]],
    // Grills
    ['Grilled Chicken Platter', 'Grills', 15.00, [['Chicken Breast', 0.25], ['Olive Oil', 0.02], ['Bell Pepper', 0.08]]],
    ['BBQ Beef Ribs',           'Grills', 19.50, [['Beef Patty', 3], ['Olive Oil', 0.02], ['Garlic', 0.02]]],
    ['Grilled Salmon',          'Grills', 16.00, [['Salmon Fillet', 0.20], ['Olive Oil', 0.02], ['Lettuce', 0.05]]],
    ["Chef's Steak",            'Grills',  7.50, [['Beef Patty', 4], ['Olive Oil', 0.02], ['Garlic', 0.02]]], // THIN margin
    // Drinks
    ['Fresh Orange Juice', 'Drinks', 4.50, [['Orange', 0.40]]],
    ['Iced Coffee',        'Drinks', 4.00, [['Coffee Beans', 0.02], ['Cream', 0.05], ['Sugar', 0.02]]],
    ['Lemonade',           'Drinks', 3.50, [['Sugar', 0.03], ['Orange', 0.10]]],
    ['Cappuccino',         'Drinks', 3.80, [['Coffee Beans', 0.018], ['Cream', 0.05]]],
    // Desserts
    ['Chocolate Lava Cake', 'Desserts', 6.50, [['Flour', 0.10], ['Cocoa', 0.05], ['Sugar', 0.05], ['Cream', 0.05]]],
    ['Tiramisu',            'Desserts', 7.00, [['Cream', 0.10], ['Coffee Beans', 0.01], ['Cocoa', 0.02], ['Sugar', 0.04]]],
    ['Cheesecake',          'Desserts', 6.00, [['Cream', 0.12], ['Sugar', 0.05], ['Flour', 0.06]]],
    ['Vanilla Ice Cream',   'Desserts', 4.50, [['Cream', 0.12], ['Sugar', 0.04]]],
    // Sides
    ['French Fries', 'Sides', 3.50, [['Potato', 0.25], ['Olive Oil', 0.02]]],
    ['Garlic Bread', 'Sides', 4.00, [['Flour', 0.12], ['Garlic', 0.03], ['Olive Oil', 0.02]]],
    ['Onion Rings',  'Sides', 4.20, [['Potato', 0.10], ['Flour', 0.08], ['Olive Oil', 0.03]]],
    // Main
    ['Chicken Rice Bowl', 'Main', 12.50, [['Rice', 0.20], ['Chicken Breast', 0.18], ['Bell Pepper', 0.06]]],
    ['Beef Stir-fry',     'Main', 14.00, [['Rice', 0.20], ['Beef Patty', 1.5], ['Bell Pepper', 0.08], ['Garlic', 0.02]]],
    ['Salmon Teriyaki Bowl', 'Main', 3.99, [['Salmon Fillet', 0.30], ['Rice', 0.20], ['Olive Oil', 0.02]]], // LOSS-MAKER
];

// Core dishes get a higher popularity weight so their order history is dense
// enough for forecasting; everything else still sells, just less often.
const POPULAR = new Set([
    'Margherita Pizza', 'Pepperoni Pizza', 'Classic Cheeseburger', 'Double Bacon Burger',
    'Chicken Alfredo', 'Spaghetti Bolognese', 'Grilled Chicken Platter', 'Fresh Orange Juice',
    'Iced Coffee', 'French Fries', 'Chocolate Lava Cake', 'Chicken Rice Bowl',
]);

async function seed() {
    await mongoose.connect(MONGO_URI);
    console.log(`Connected to ${MONGO_URI} — seeding demo data...`);

    await Promise.all([
        User.deleteMany({}), Dish.deleteMany({}), Ingredient.deleteMany({}),
        Customer.deleteMany({}), Order.deleteMany({}),
    ]);

    // --- Staff users (known credentials) ---
    const admin = await User.create({ name: 'Admin User', email: 'admin@restaurant.com', password: 'password123', role: 'admin', status: 'approved' });
    const staff = await User.create({ name: 'Staff User', email: 'staff@restaurant.com', password: 'password123', role: 'staff', status: 'approved' });

    // --- Ingredients ---
    const ingDocs = await Ingredient.insertMany(INGREDIENTS.map(([name, unit, costPerUnit, quantity, minStock, expDays, wasteQuantity]) => ({
        name, unit, costPerUnit, quantity, minStock,
        expiryDate: new Date(now + expDays * DAY_MS),
        wasteQuantity,
        lastRestocked: new Date(now - randInt(2, 20) * DAY_MS),
    })));
    const ingByName = Object.fromEntries(ingDocs.map((i) => [i.name, i]));

    // --- Dishes ---
    const dishDocs = await Dish.insertMany(DISHES.map(([name, category, price, ings]) => ({
        name, category, price,
        description: `${name} — freshly prepared in-house.`,
        imageUrl: imageFor(category),
        isAvailable: true,
        ingredients: ings.map(([n, q]) => ({ ingredient: ingByName[n]._id, quantity: q })),
    })));
    const dishByName = Object.fromEntries(dishDocs.map((d) => [d.name, d]));

    // --- Customer users (for recommendations) + Customer records (for the
    //     customers page). Indices line up so each order links both. ---
    const NUM_DINERS = 40;
    const dinerUsers = [];
    const customers = [];
    // A primary diner with friendly creds for demoing the customer-facing flow.
    dinerUsers.push(await User.create({ name: 'Primary Diner', email: 'diner@restaurant.com', password: 'password123', role: 'customer', status: 'approved' }));
    customers.push(await Customer.create({ name: 'Primary Diner', phone: '+15550000000', lastVisit: new Date() }));
    for (let i = 1; i < NUM_DINERS; i++) {
        dinerUsers.push(await User.create({ name: `Diner ${i}`, email: `diner${i}@restaurant.com`, password: 'diner123', role: 'customer', status: 'approved' }));
        customers.push(await Customer.create({ name: `Diner ${i}`, phone: `+1555000${String(i).padStart(4, '0')}`, lastVisit: new Date(now - randInt(0, 30) * DAY_MS) }));
    }

    // --- Weighted dish pool for realistic popularity ---
    const weightedPool = [];
    for (const d of dishDocs) weightedPool.push(...Array(POPULAR.has(d.name) ? 5 : 2).fill(d));

    // Realistic "people who buy X also buy Y" affinities so the Apriori
    // market-basket engine surfaces strong, meaningful rules (confidence ≥ 0.5,
    // lift ≥ 1.0) at the default 10% support threshold. French Fries deliberately
    // anchors several combos so it emerges as a high-lift consequent.
    const COMBOS = [
        ['Classic Cheeseburger', 'French Fries'],
        ['Double Bacon Burger', 'French Fries'],
        ['Grilled Chicken Platter', 'French Fries'],
        ['Margherita Pizza', 'Fresh Orange Juice'],
        ['Spaghetti Bolognese', 'Garlic Bread'],
        ['Chocolate Lava Cake', 'Iced Coffee'],
    ];

    function buildItems() {
        const chosen = new Map();
        const add = (d) => { if (d && !chosen.has(String(d._id))) chosen.set(String(d._id), d); };
        if (Math.random() < 0.6) {
            // Combo order — guarantees recurring co-occurrence for market basket.
            const [a, b] = pick(COMBOS);
            add(dishByName[a]); add(dishByName[b]);
            if (Math.random() < 0.2) add(pick(weightedPool)); // occasional third item
        } else {
            // Otherwise a random 1–3 item basket weighted by popularity.
            const n = pick([1, 1, 2, 3]);
            let guard = 0;
            while (chosen.size < n && guard++ < 20) add(pick(weightedPool));
        }
        return [...chosen.values()].map((d) => ({
            dish: d._id, quantity: randInt(1, 2), priceAtTime: d.price, imageUrlAtTime: d.imageUrl,
        }));
    }

    // --- Orders: ~80 days of completed history with weekend uplift ---
    const HISTORY_DAYS = 80;
    const orderDocs = [];
    const salesByDish = new Map();
    const spendByDiner = new Map();
    const ordersByDiner = new Map();
    const favByDiner = new Map(); // dinerIdx -> Map(dishId -> count)

    for (let day = HISTORY_DAYS; day >= 0; day--) {
        const date = new Date(now - day * DAY_MS);
        const dow = date.getDay();
        const isWeekend = dow === 5 || dow === 6 || dow === 0;
        const count = randInt(3, 6) + (isWeekend ? randInt(2, 4) : 0);
        for (let k = 0; k < count; k++) {
            const dinerIdx = randInt(0, dinerUsers.length - 1);
            const items = buildItems();
            const totalPrice = Math.round(items.reduce((s, it) => s + it.priceAtTime * it.quantity, 0) * 100) / 100;
            const createdAt = new Date(date.getTime() + randInt(10, 22) * 60 * 60 * 1000);
            orderDocs.push({
                items, totalPrice, status: 'completed',
                source: pick(['POS', 'Online']),
                paymentMethod: pick(['Cash', 'Card', 'Online', 'Wallet']),
                isPaid: true, paidAt: createdAt,
                user: dinerUsers[dinerIdx]._id,
                customer: customers[dinerIdx]._id,
                createdAt, updatedAt: createdAt,
            });
            // aggregate trackers
            spendByDiner.set(dinerIdx, (spendByDiner.get(dinerIdx) || 0) + totalPrice);
            ordersByDiner.set(dinerIdx, (ordersByDiner.get(dinerIdx) || 0) + 1);
            if (!favByDiner.has(dinerIdx)) favByDiner.set(dinerIdx, new Map());
            const fav = favByDiner.get(dinerIdx);
            for (const it of items) {
                salesByDish.set(String(it.dish), (salesByDish.get(String(it.dish)) || 0) + it.quantity);
                fav.set(String(it.dish), (fav.get(String(it.dish)) || 0) + it.quantity);
            }
        }
    }

    // A few live (active) orders so the POS / Orders board isn't empty.
    for (let k = 0; k < 5; k++) {
        const dinerIdx = randInt(0, dinerUsers.length - 1);
        const items = buildItems();
        const totalPrice = Math.round(items.reduce((s, it) => s + it.priceAtTime * it.quantity, 0) * 100) / 100;
        const createdAt = new Date(now - randInt(5, 90) * 60 * 1000);
        orderDocs.push({
            items, totalPrice, status: pick(['pending', 'preparing']),
            source: 'POS', paymentMethod: 'Cash', isPaid: false,
            user: dinerUsers[dinerIdx]._id, customer: customers[dinerIdx]._id,
            createdAt, updatedAt: createdAt,
        });
    }

    await Order.insertMany(orderDocs);

    // --- Backfill dish.salesCount ---
    await Promise.all(dishDocs.map((d) =>
        Dish.updateOne({ _id: d._id }, { $set: { salesCount: salesByDish.get(String(d._id)) || 0 } })
    ));

    // --- Backfill customer aggregates so the Customers page shows real numbers ---
    await Promise.all(customers.map((c, idx) => {
        const favMap = favByDiner.get(idx) || new Map();
        const favorites = [...favMap.entries()].map(([dish, count]) => ({ dish, count }));
        return Customer.updateOne({ _id: c._id }, {
            $set: {
                totalOrders: ordersByDiner.get(idx) || 0,
                totalSpend: Math.round((spendByDiner.get(idx) || 0) * 100) / 100,
                lastOrderAt: new Date(),
                favorites,
                favoritesCount: favorites.length,
            },
        });
    }));

    const completed = orderDocs.filter((o) => o.status === 'completed').length;
    console.log('\n--- Demo seed complete ---');
    console.log(`Ingredients: ${ingDocs.length} (some low-stock / near-expiry for alerts)`);
    console.log(`Dishes:      ${dishDocs.length} across 8 categories (incl. loss-makers for pricing alerts)`);
    console.log(`Diners:      ${dinerUsers.length} users + ${customers.length} customer records`);
    console.log(`Orders:      ${completed} completed over ${HISTORY_DAYS} days + ${orderDocs.length - completed} live`);
    console.log('\nLogin credentials:');
    console.log('  admin@restaurant.com    / password123  (admin)');
    console.log('  staff@restaurant.com    / password123  (staff)');
    console.log('  diner@restaurant.com    / password123  (customer)');
    console.log('  diner1..39@restaurant.com / diner123    (customers)');

    await mongoose.disconnect();
    process.exit(0);
}

seed().catch((err) => {
    console.error('Demo seed failed:', err);
    process.exit(1);
});
