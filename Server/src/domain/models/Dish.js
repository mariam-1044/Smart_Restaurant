const mongoose = require('mongoose');

const dishSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: [true, 'Dish name is required'], 
        unique: true, 
        trim: true 
    },
    description: { 
        type: String 
    },
    price: { 
        type: Number, 
        required: [true, 'Price is required'], 
        min: 0 
    },
    category: { 
        type: String, 
        enum: ['Pizza', 'Grills', 'Drinks', 'Desserts', 'Sides','Burgers','Pasta','Main'], 
        default: 'Drinks' 
    },
    imageUrl: {
        type: String,
        // Same-origin bundled asset (served by the client/nginx). Guarantees a
        // visible image even when a dish has no photo, instead of a broken
        // relative 'default-dish.png' that the SPA router would 404.
        default: '/default-dish.svg'
    },
    ingredients: [{
        ingredient: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Ingredient', 
            required: true 
        },
        quantity: { 
            type: Number, 
            required: true, 
            min: 0 
        }
    }],
    salesCount: { 
        type: Number, 
        default: 0 
    },
    isAvailable: { 
        type: Boolean, 
        default: true 
    },
    priceHistory: [{
        price: { type: Number, required: true },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
    }],
    version: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

dishSchema.index({ category: 1, isAvailable: 1 });

module.exports = mongoose.model('Dish', dishSchema);
