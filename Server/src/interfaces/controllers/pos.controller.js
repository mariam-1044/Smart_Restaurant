
const posService = require("../../application/services/pos.service");
const Dish = require("../../domain/models/Dish");
const Ingredient = require("../../domain/models/Ingredient");
const logger = require("../../infrastructure/config/logger");


exports.processPOSTransaction = async (req, res) => {
    try {
        // The request body should contain all necessary order data, including items and customer info.
        const transactionData = req.body;
        const result = await posService.handleTransaction(transactionData);
        
        res.status(201).json({
            success: true,
            message: result.message,
            data: {
                orderId: result.order._id,
                totalPrice: result.order.totalPrice,
                paymentStatus: result.transactionId ? 'Paid' : 'Pending',
                transactionId: result.transactionId
            }
        });
    } catch (error) {
        logger.error(`Controller Error [processPOSTransaction]: ${error.message}`);
        // Differentiate between validation errors (400) and internal server errors (500)
        const statusCode = error.message.includes("Insufficient stock") || error.message.includes("not available") || error.message.includes("Payment processing failed") ? 400 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Seed demo data for dishes and ingredients.
 * This is useful for development and testing environments.
 */
exports.seedData = async (req, res) => {
    try {
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + 3);

        await Ingredient.deleteMany({});
        await Dish.deleteMany({});

        const ingredients = await Ingredient.insertMany([
            { name: "Tomato", quantity: 100, unit: "kg", minStock: 10, expiryDate, imageUrl: 'tomato.png' },
            { name: "Cheese", quantity: 50, unit: "kg", minStock: 5, expiryDate, imageUrl: 'cheese.png' },
            { name: "Dough", quantity: 200, unit: "pcs", minStock: 20, expiryDate, imageUrl: 'dough.png' },
            { name: "Chicken Breast", quantity: 80, unit: "kg", minStock: 15, expiryDate, imageUrl: 'chicken.png' },
            { name: "Lettuce", quantity: 30, unit: "kg", minStock: 5, expiryDate, imageUrl: 'lettuce.png' },
            { name: "Bun", quantity: 150, unit: "pcs", minStock: 30, expiryDate, imageUrl: 'bun.png' },
            { name: "Beef Patty", quantity: 120, unit: "pcs", minStock: 25, expiryDate, imageUrl: 'beef_patty.png' },
            { name: "Pasta", quantity: 60, unit: "kg", minStock: 10, expiryDate, imageUrl: 'pasta.png' },
            { name: "Cream", quantity: 40, unit: "liter", minStock: 5, expiryDate, imageUrl: 'cream.png' },
            { name: "Mushroom", quantity: 20, unit: "kg", minStock: 3, expiryDate, imageUrl: 'mushroom.png' },
            { name: "Onion", quantity: 50, unit: "kg", minStock: 10, expiryDate, imageUrl: 'onion.png' },
            { name: "Garlic", quantity: 10, unit: "kg", minStock: 2, expiryDate, imageUrl: 'garlic.png' },
            { name: "Salt", quantity: 20, unit: "kg", minStock: 5, expiryDate, imageUrl: 'salt.png' },
            { name: "Pepper", quantity: 5, unit: "kg", minStock: 1, expiryDate, imageUrl: 'pepper.png' },
            { name: "Olive Oil", quantity: 15, unit: "liter", minStock: 3, expiryDate, imageUrl: 'olive_oil.png' },
            { name: "Sugar", quantity: 25, unit: "kg", minStock: 5, expiryDate, imageUrl: 'sugar.png' },
            { name: "Flour", quantity: 50, unit: "kg", minStock: 10, expiryDate, imageUrl: 'flour.png' },
            { name: "Egg", quantity: 100, unit: "pcs", minStock: 20, expiryDate, imageUrl: 'egg.png' },
            { name: "Milk", quantity: 30, unit: "liter", minStock: 5, expiryDate, imageUrl: 'milk.png' },
            { name: "Butter", quantity: 10, unit: "kg", minStock: 2, expiryDate, imageUrl: 'butter.png' },
            { name: "Fish Fillet", quantity: 40, unit: "kg", minStock: 8, expiryDate, imageUrl: 'fish_fillet.png' },
            { name: "Shrimp", quantity: 20, unit: "kg", minStock: 4, expiryDate, imageUrl: 'shrimp.png' },
            { name: "Lemon", quantity: 10, unit: "kg", minStock: 2, expiryDate, imageUrl: 'lemon.png' },
            { name: "Rice", quantity: 50, unit: "kg", minStock: 10, expiryDate, imageUrl: 'rice.png' },
            { name: "Potato", quantity: 60, unit: "kg", minStock: 12, expiryDate, imageUrl: 'potato.png' }
        ]);

        await Dish.insertMany([
            { 
                name: "Pizza Margherita", 
                price: 120, 
                imageUrl: 'pizza.png',
                category: 'Pizza',
                isAvailable: true,
                ingredients: [
                    { ingredient: ingredients.find(i => i.name === "Tomato")._id, quantity: 0.2 },
                    { ingredient: ingredients.find(i => i.name === "Cheese")._id, quantity: 0.15 },
                    { ingredient: ingredients.find(i => i.name === "Dough")._id, quantity: 1 }
                ]
            },
            { 
                name: "Classic Beef Burger", 
                price: 150, 
                imageUrl: 'burger.png',
                category: 'Grills',
                isAvailable: true,
                ingredients: [
                    { ingredient: ingredients.find(i => i.name === "Beef Patty")._id, quantity: 1 },
                    { ingredient: ingredients.find(i => i.name === "Bun")._id, quantity: 1 },
                    { ingredient: ingredients.find(i => i.name === "Lettuce")._id, quantity: 0.05 },
                    { ingredient: ingredients.find(i => i.name === "Tomato")._id, quantity: 0.03 },
                    { ingredient: ingredients.find(i => i.name === "Cheese")._id, quantity: 0.02 }
                ]
            },
            { 
                name: "Chicken Alfredo Pasta", 
                price: 130, 
                imageUrl: 'pasta.png',
                category: 'Pasta',
                isAvailable: true,
                ingredients: [
                    { ingredient: ingredients.find(i => i.name === "Pasta")._id, quantity: 0.15 },
                    { ingredient: ingredients.find(i => i.name === "Chicken Breast")._id, quantity: 0.1 },
                    { ingredient: ingredients.find(i => i.name === "Cream")._id, quantity: 0.1 },
                    { ingredient: ingredients.find(i => i.name === "Garlic")._id, quantity: 0.01 },
                    { ingredient: ingredients.find(i => i.name === "Cheese")._id, quantity: 0.03 }
                ]
            },
            { 
                name: "Grilled Salmon", 
                price: 220, 
                imageUrl: 'salmon.png',
                category: 'Grills',
                isAvailable: true,
                ingredients: [
                    { ingredient: ingredients.find(i => i.name === "Fish Fillet")._id, quantity: 0.2 },
                    { ingredient: ingredients.find(i => i.name === "Lemon")._id, quantity: 0.05 },
                    { ingredient: ingredients.find(i => i.name === "Olive Oil")._id, quantity: 0.02 },
                    { ingredient: ingredients.find(i => i.name === "Salt")._id, quantity: 0.005 },
                    { ingredient: ingredients.find(i => i.name === "Pepper")._id, quantity: 0.002 }
                ]
            },
            { 
                name: "Shrimp Scampi", 
                price: 180, 
                imageUrl: 'shrimp_scampi.png',
                category: 'Seafood',
                isAvailable: true,
                ingredients: [
                    { ingredient: ingredients.find(i => i.name === "Shrimp")._id, quantity: 0.15 },
                    { ingredient: ingredients.find(i => i.name === "Pasta")._id, quantity: 0.1 },
                    { ingredient: ingredients.find(i => i.name === "Garlic")._id, quantity: 0.015 },
                    { ingredient: ingredients.find(i => i.name === "Butter")._id, quantity: 0.03 },
                    { ingredient: ingredients.find(i => i.name === "Lemon")._id, quantity: 0.03 }
                ]
            },
            { 
                name: "Vegetable Stir-fry", 
                price: 90, 
                imageUrl: 'stir_fry.png',
                category: 'Vegetarian',
                isAvailable: true,
                ingredients: [
                    { ingredient: ingredients.find(i => i.name === "Broccoli")._id, quantity: 0.1 }, // Assuming Broccoli is added to ingredients
                    { ingredient: ingredients.find(i => i.name === "Carrot")._id, quantity: 0.05 }, // Assuming Carrot is added to ingredients
                    { ingredient: ingredients.find(i => i.name === "Mushroom")._id, quantity: 0.05 },
                    { ingredient: ingredients.find(i => i.name === "Onion")._id, quantity: 0.05 },
                    { ingredient: ingredients.find(i => i.name === "Rice")._id, quantity: 0.2 }
                ]
            }
        ]);

        res.status(200).json({ success: true, message: "Demo data seeded successfully" });
    } catch (error) {
        logger.error(`Controller Error [seedData]: ${error.message}`);
        res.status(500).json({ success: false, message: 'Error seeding data', error: error.message });
    }
};
