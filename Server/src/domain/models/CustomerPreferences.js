const mongoose = require('mongoose');

const CUISINES = ['Italian', 'Middle Eastern', 'Asian', 'American', 'Mexican', 'Mediterranean', 'Indian', 'French'];
const DIETARY = ['none', 'vegetarian', 'vegan', 'pescatarian', 'gluten_free', 'halal', 'kosher'];
const SPICE_LEVELS = ['mild', 'medium', 'hot', 'extra_hot'];

const customerPreferencesSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },
    cuisines: [{ type: String, enum: CUISINES }],
    dietary: [{ type: String, enum: DIETARY }],
    spiceLevel: { type: String, enum: SPICE_LEVELS, default: 'medium' },
    allergies: [{ type: String, trim: true, maxlength: 60 }],
    favoriteIngredients: [{ type: String, trim: true, maxlength: 60 }],
    completedAt: { type: Date, default: null }
}, { timestamps: true });

const CustomerPreferences = mongoose.model('CustomerPreferences', customerPreferencesSchema);
CustomerPreferences.CUISINES = CUISINES;
CustomerPreferences.DIETARY = DIETARY;
CustomerPreferences.SPICE_LEVELS = SPICE_LEVELS;

module.exports = CustomerPreferences;
