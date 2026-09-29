const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: [true, 'Ingredient name is required'], 
        unique: true, 
        trim: true 
    },
    quantity: { 
        type: Number, 
        required: [true, 'Quantity is required'], 
        min: 0, 
        default: 0 
    },
    unit: { 
        type: String, 
        required: [true, 'Unit is required'], 
        enum: ['kg', 'g', 'l', 'ml', 'pcs'] 
    },
    minStock: { 
        type: Number, 
        required: [true, 'Minimum stock level is required'], 
        min: 0 
    },
    costPerUnit: { 
        type: Number, 
        default: 0, 
        min: 0 
    },
    expiryDate: {
        type: Date,
        required: [true, 'Expiry date is required']
    },
    imageUrl: {
        type: String,
        default: '/default-ingredient.svg'
    },
    wasteQuantity: { 
        type: Number, 
        default: 0,
        min: 0
    }, // Recorded waste quantity , demaged expired
    lastRestocked: { 
        type: Date, 
        default: Date.now 
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// calculate the waste percentage for this ingredient
ingredientSchema.virtual('wastePercentage').get(function() {
    const totalUsedOrWasted = this.quantity + this.wasteQuantity;
    return totalUsedOrWasted > 0 ? ((this.wasteQuantity / totalUsedOrWasted) * 100).toFixed(2) : 0;
});

ingredientSchema.index({ name: 1 });
ingredientSchema.index({ expiryDate: 1 });

module.exports = mongoose.model('Ingredient', ingredientSchema);
