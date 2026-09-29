const salesService = require('../../application/services/sales.service');
const logger = require('../../infrastructure/config/logger');

exports.getSalesReport = async (req, res) => {
    try {
        const { period } = req.query; // daily, weekly, monthly
        const report = await salesService.getSalesReport(period || 'daily');
        res.status(200).json({
            success: true,
            data: report
        });
    } catch (error) {
        logger.error(`Controller Error [getSalesReport]: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Error generating sales report',
            error: error.message
        });
    }
};
