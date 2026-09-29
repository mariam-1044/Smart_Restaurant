const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    items: [{
        dish: { type: mongoose.Schema.Types.ObjectId, ref: 'Dish', required: true },
        quantity: { type: Number, required: true, min: 1 },
        priceAtTime: { type: Number, required: true },
        imageUrlAtTime: { type: String } 
    }],
    totalPrice: { type: Number, required: true, min: 0 },
    tableNumber: { type: String, trim: true },
status: {
        type: String, 
        enum: ['pending', 'preparing', 'completed', 'cancelled'], 
        default: 'pending'
    },
    source: { 
        type: String, 
        enum: ['POS', 'Online', 'POS_SIMULATOR'], 
        default: 'POS' 
    },
    paymentMethod: { 
        type: String, 
        enum: ['Cash', 'Card', 'Online', 'Wallet'], 
        default: 'Cash' 
    },
    isPaid: {
        type: Boolean,
        default: false
    },
    paidAt: {
        type: Date
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        // required: function() { return !this.user; } // Required if no user is associated
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        // required: function() { return !this.customer; } // Required if no customer is associated
    }
}, { timestamps: true });

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
