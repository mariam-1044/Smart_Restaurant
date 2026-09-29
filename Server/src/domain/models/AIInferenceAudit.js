const mongoose = require('mongoose');

const aiInferenceAuditSchema = new mongoose.Schema({
    callerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    callerRole: {
        type: String,
        enum: ['admin', 'staff', 'customer', 'public'],
        required: true
    },
    capability: { type: String, required: true, index: true },
    route: { type: String, required: true },
    method: { type: String, required: true },
    outcome: {
        type: String,
        required: true,
        enum: [
            'success',
            'error_validation',
            'error_authz',
            'error_inference',
            'error_upstream',
            'error_internal'
        ]
    },
    latencyMs: { type: Number, required: true, min: 0 },
    inputSummary: { type: Object, default: {} },
    errorCode: { type: String, default: null },
    correlationId: { type: String, index: true },
    createdAt: { type: Date, default: Date.now, index: true }
});

aiInferenceAuditSchema.index({ capability: 1, createdAt: -1 });
aiInferenceAuditSchema.index({ callerId: 1, createdAt: -1 });

module.exports = mongoose.model('AIInferenceAudit', aiInferenceAuditSchema);
