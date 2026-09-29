const preferencesService = require('../../application/services/preferences.service');
const logger = require('../../infrastructure/config/logger');

exports.schema = async (_req, res) => {
    return res.status(200).json({ success: true, data: preferencesService.SCHEMA });
};

exports.getMine = async (req, res) => {
    try {
        const prefs = await preferencesService.getMine(req.user._id);
        return res.status(200).json({ success: true, data: prefs });
    } catch (err) {
        logger.error(`getMine preferences error: ${err.message}`);
        return res.status(500).json({ success: false, message: 'Failed to fetch preferences.' });
    }
};

exports.upsert = async (req, res) => {
    try {
        const saved = await preferencesService.upsert(req.user._id, req.body || {});
        return res.status(200).json({ success: true, data: saved });
    } catch (err) {
        logger.error(`upsert preferences error: ${err.message}`);
        return res.status(400).json({ success: false, message: err.message || 'Failed to save preferences.' });
    }
};
