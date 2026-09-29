const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Customer name is required'],
        trim: true,
    },
    phone: {
        type: String,
        required: [true, 'Customer phone number is required'],
        unique: true,
        trim: true,
        index: true
    },
    orderHistory: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order'
        }
    ],
    favorites: [
        {
            dish: { type: mongoose.Schema.Types.ObjectId, ref: 'Dish' },
            count: { type: Number, default: 0 }
        }
    ],
    totalOrders: {
        type: Number,
        default: 0
    },
    totalSpend: {
        type: Number,
        default: 0
    },
    lastVisit: {
        type: Date,
        default: Date.now
    },
    lastOrderAt: {
        type: Date,
        default: null
    },
    favoritesCount: {
        type: Number,
        default: 0
    },
    version: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
