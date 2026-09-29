const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    type:           { type: String, enum: ['low_stock', 'expiry', 'reorder', 'spoilage_risk', 'spoilage_recipe_failed', 'price_suggestion', 'system'], required: true },
    title:          { type: String, required: true, maxlength: 120 },
    message:        { type: String, required: true, maxlength: 500 },
    targetRole:     { type: String, enum: ['admin', 'staff', 'all'], default: 'admin' },
    relatedEntity:  { type: mongoose.Schema.Types.ObjectId, default: null },
    entityModel:    { type: String, enum: ['Ingredient', 'Dish', 'Order'], default: null },
    payload:        { type: Object, default: {} },
    readByAdmin:    { type: Boolean, default: false },
    readByAdminAt:  { type: Date, default: null },
    readByStaff:    { type: Boolean, default: false },
    readByStaffAt:  { type: Date, default: null },
    createdAt:      { type: Date, default: Date.now, immutable: true },
    lastSeenAt:     { type: Date, default: Date.now }
});

notificationSchema.index({ targetRole: 1, createdAt: -1 });
notificationSchema.index({ targetRole: 1, readByAdmin: 1, createdAt: -1 });
notificationSchema.index({ targetRole: 1, readByStaff: 1, createdAt: -1 });
notificationSchema.index({ type: 1, relatedEntity: 1, createdAt: -1 });
notificationSchema.index({ readByAdmin: 1, readByStaff: 1, readByAdminAt: 1, readByStaffAt: 1 });

notificationSchema.pre('validate', function (next) {
    const hasEntity = !!this.relatedEntity;
    const hasModel  = !!this.entityModel;
    if (hasEntity !== hasModel) return next(new Error('relatedEntity and entityModel must be set together'));
    next();
});

module.exports = mongoose.model('Notification', notificationSchema);