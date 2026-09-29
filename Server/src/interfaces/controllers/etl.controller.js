const etlService = require("../../application/services/etl.service");
const logger = require('../../infrastructure/config/logger');

exports.getAnalyticsReport = async (req, res) => {
    try {
        const report = await etlService.runAnalyticsPipeline();
        res.status(200).json({ success: true, data: report });
    } catch (error) {
        logger.error(`ETL getAnalyticsReport Error: ${error.message}`);
        res.status(500).json({ success: false, message: 'Error generating analytics report', error: error.message });
    }
};

exports.exportToCSV = async (req, res) => {
    try {
        const report = await etlService.runAnalyticsPipeline();
        
        // Simple CSV simulation
        let csv = "Metric,Value\n";
        if (report.salesTrends) {
            report.salesTrends.forEach(trend => {
                csv += `${trend.period},${trend.revenue}\n`;
            });
        }
        
        res.setHeader('Content-Type', 'text/csv');
        res.attachment('sales_report.csv');
        res.status(200).send(csv);
    } catch (error) {
        logger.error(`ETL exportToCSV Error: ${error.message}`);
        res.status(500).json({ success: false, message: 'Error exporting CSV', error: error.message });
    }
};
