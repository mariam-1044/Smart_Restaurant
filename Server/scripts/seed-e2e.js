#!/usr/bin/env node
// Idempotent seed for Playwright E2E suite.
// Reads MONGODB_URI from env (defaults to mongodb://localhost:27017/smart_restaurant_e2e).
// Drops then re-inserts every seeded collection. Inserts via Mongoose so pre-save hooks run.

const mongoose = require('mongoose');
const User = require('../src/domain/models/User');
const Ingredient = require('../src/domain/models/Ingredient');
const Dish = require('../src/domain/models/Dish');
const Order = require('../src/domain/models/Order');
const Customer = require('../src/domain/models/Customer');
const Notification = require('../src/domain/models/Notification');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_restaurant_e2e';

async function main() {
  await mongoose.connect(MONGODB_URI);

  await Promise.all([
    User.deleteMany({}),
    Ingredient.deleteMany({}),
    Dish.deleteMany({}),
    Order.deleteMany({}),
    Customer.deleteMany({}),
    Notification.deleteMany({})
  ]);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);

  const admin = await new User({
    name: 'E2E Admin',
    email: 'admin@e2e.local',
    password: 'AdminPass!23',
    role: 'admin',
    status: 'approved'
  }).save();

  const staff = await new User({
    name: 'E2E Staff',
    email: 'staff@e2e.local',
    password: 'StaffPass!23',
    role: 'staff',
    status: 'approved'
  }).save();

  const pending = await new User({
    name: 'E2E Pending',
    email: 'pending@e2e.local',
    password: 'PendPass!23',
    role: 'staff',
    status: 'pending'
  }).save();

  const tomato = await new Ingredient({
    name: 'Tomato',
    quantity: 11,
    unit: 'kg',
    minStock: 10,
    costPerUnit: 1.5,
    expiryDate: nextMonth
  }).save();

  const cheese = await new Ingredient({
    name: 'Cheese',
    quantity: 50,
    unit: 'kg',
    minStock: 5,
    costPerUnit: 4.0,
    expiryDate: nextMonth
  }).save();

  const dough = await new Ingredient({
    name: 'Dough',
    quantity: 30,
    unit: 'kg',
    minStock: 10,
    costPerUnit: 2.0,
    expiryDate: nextMonth
  }).save();

  const oliveOil = await new Ingredient({
    name: 'Olive Oil',
    quantity: 20,
    unit: 'l',
    minStock: 5,
    costPerUnit: 8.0,
    expiryDate: nextYear
  }).save();

  const chicken = await new Ingredient({
    name: 'Chicken',
    quantity: 25,
    unit: 'kg',
    minStock: 8,
    costPerUnit: 6.0,
    expiryDate: nextMonth
  }).save();

  const lettuce = await new Ingredient({
    name: 'Lettuce',
    quantity: 15,
    unit: 'kg',
    minStock: 5,
    costPerUnit: 2.0,
    expiryDate: tomorrow
  }).save();

  const colaSyrup = await new Ingredient({
    name: 'Cola Syrup',
    quantity: 100,
    unit: 'l',
    minStock: 20,
    costPerUnit: 1.0,
    expiryDate: nextYear
  }).save();

  const salt = await new Ingredient({
    name: 'Salt',
    quantity: 5,
    unit: 'kg',
    minStock: 2,
    costPerUnit: 0.5,
    expiryDate: nextYear
  }).save();

  const margherita = await new Dish({
    name: 'Margherita',
    description: 'Classic cheese pizza',
    price: 12,
    category: 'Pizza',
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1200&auto=format&fit=crop',
    isAvailable: true,
    ingredients: [
      { ingredient: dough._id, quantity: 0.3 },
      { ingredient: tomato._id, quantity: 0.2 },
      { ingredient: cheese._id, quantity: 0.15 }
    ]
  }).save();

  const grilledChicken = await new Dish({
    name: 'Grilled Chicken',
    description: 'Juicy grilled chicken breast',
    price: 18,
    category: 'Grills',
    imageUrl: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?q=80&w=1200&auto=format&fit=crop',
    isAvailable: true,
    ingredients: [
      { ingredient: chicken._id, quantity: 0.4 },
      { ingredient: oliveOil._id, quantity: 0.05 },
      { ingredient: salt._id, quantity: 0.01 }
    ]
  }).save();

  const caesarSalad = await new Dish({
    name: 'Caesar Salad',
    description: 'Fresh Caesar salad',
    price: 10,
    category: 'Sides',
    imageUrl: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?q=80&w=1200&auto=format&fit=crop',
    isAvailable: true,
    ingredients: [
      { ingredient: lettuce._id, quantity: 0.2 },
      { ingredient: cheese._id, quantity: 0.05 }
    ]
  }).save();

  const cola = await new Dish({
    name: 'Cola',
    description: 'Refreshing cola drink',
    price: 4,
    category: 'Drinks',
    imageUrl: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?q=80&w=1200&auto=format&fit=crop',
    isAvailable: true,
    ingredients: [
      { ingredient: colaSyrup._id, quantity: 0.3 }
    ]
  }).save();

  const customer1 = await new Customer({
    name: 'John Doe',
    phone: '+201000000001',
    totalOrders: 3,
    totalSpend: 60
  }).save();

  const customer2 = await new Customer({
    name: 'Jane Smith',
    phone: '+201000000002',
    totalOrders: 1,
    totalSpend: 22
  }).save();

  const order1 = await new Order({
    items: [
      { dish: margherita._id, quantity: 2, priceAtTime: 12 },
      { dish: cola._id, quantity: 1, priceAtTime: 4 }
    ],
    totalPrice: 28,
    status: 'completed',
    source: 'POS',
    paymentMethod: 'Cash',
    isPaid: true,
    paidAt: new Date(),
    customer: customer1._id
  }).save();

  const order2 = await new Order({
    items: [
      { dish: grilledChicken._id, quantity: 1, priceAtTime: 18 }
    ],
    totalPrice: 18,
    status: 'pending',
    source: 'Online',
    paymentMethod: 'Card',
    user: staff._id
  }).save();

  await new Notification({
    type: 'low_stock',
    title: 'Low stock: Tomato',
    message: 'Tomato is below minimum stock level',
    targetRole: 'admin',
    readByAdmin: false,
    readByStaff: false
  }).save();

  await new Notification({
    type: 'expiry',
    title: 'Expiring soon: Lettuce',
    message: 'Lettuce is expiring soon',
    targetRole: 'admin',
    readByAdmin: false,
    readByStaff: false
  }).save();

  console.log(`[seed-e2e] DB=${mongoose.connection.name} users=3 ingredients=8 dishes=4 orders=2 customers=2 notifications=2`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[seed-e2e] FAILED', err);
  process.exit(1);
});