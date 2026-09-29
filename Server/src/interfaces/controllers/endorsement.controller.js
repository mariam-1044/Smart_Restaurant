const endorsementService = require('../../application/services/endorsement.service');
const logger = require('../../infrastructure/config/logger');

exports.getDishSummary = async (req, res) => {
    try {
        const summary = await endorsementService.getDishSummary(req.params.dishId);
        return res.status(200).json(summary);
    } catch (err) {
        logger.error(`endorsement summary error: ${err.message}`);
        res.locals.errorCode = 'internal_error';
        return res.status(500).json({
            error: {
                code: 'internal_error',
                message: 'Unexpected error reading endorsements.',
                correlationId: (res.locals && res.locals.correlationId) || null
            }
        });
    }
};
