const CustomerPreferences = require('../../domain/models/CustomerPreferences');

const SCHEMA = {
    cuisines: CustomerPreferences.CUISINES,
    dietary: CustomerPreferences.DIETARY,
    spiceLevels: CustomerPreferences.SPICE_LEVELS
};

async function getMine(userId) {
    if (!userId) return null;
    return CustomerPreferences.findOne({ user: userId }).lean();
}

function _sanitizeArray(input, allowed) {
    if (!Array.isArray(input)) return [];
    const out = [];
    for (const v of input) {
        if (typeof v !== 'string') continue;
        const trimmed = v.trim();
        if (!trimmed) continue;
        if (allowed && !allowed.includes(trimmed)) continue;
        out.push(trimmed);
    }
    return Array.from(new Set(out)).slice(0, 20);
}

async function upsert(userId, body) {
    if (!userId) {
        const err = new Error('user_required');
        err.code = 'user_required';
        throw err;
    }
    const cuisines = _sanitizeArray(body.cuisines, CustomerPreferences.CUISINES);
    const dietary = _sanitizeArray(body.dietary, CustomerPreferences.DIETARY);
    const spiceLevel = CustomerPreferences.SPICE_LEVELS.includes(body.spiceLevel)
        ? body.spiceLevel
        : 'medium';
    const allergies = _sanitizeArray(body.allergies);
    const favoriteIngredients = _sanitizeArray(body.favoriteIngredients);

    return CustomerPreferences.findOneAndUpdate(
        { user: userId },
        {
            $set: {
                cuisines,
                dietary,
                spiceLevel,
                allergies,
                favoriteIngredients,
                completedAt: new Date()
            },
            $setOnInsert: { user: userId }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
}

module.exports = { getMine, upsert, SCHEMA };
