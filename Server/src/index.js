const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const logger = require('./infrastructure/config/logger');
const connectDB = require('./infrastructure/config/db');

// Load env vars
dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Import Routes
const authRoutes = require('./routes/auth.routes');
const customerRoutes = require('./routes/customer.routes');
const menuRoutes = require('./routes/menu.routes');
const orderRoutes = require('./routes/order.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const aiRoutes = require('./routes/ai.routes');
const recommendationRoutes = require('./routes/recommendation.routes');
const endorsementRoutes = require('./routes/endorsement.routes');
const pricingRoutes = require('./routes/pricing.routes');
const preferencesRoutes = require('./routes/preferences.routes');
const etlRoutes = require('./routes/etl.routes');
const posRoutes = require('./routes/pos.routes');
const salesRoutes = require('./routes/sales.routes');
const notificationRoutes = require('./routes/notification.routes');

app.use('/api/auth', authRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/v1/ai/pricing', pricingRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/recommendations', recommendationRoutes);
app.use('/api/v1/preferences', preferencesRoutes);
app.use('/api/v1/dishes', endorsementRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/etl', etlRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/notifications', notificationRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'success', message: 'Server is healthy' });
});

// Error handling middleware
const { errorHandler } = require('./middlewares/error.middleware');
app.use(errorHandler);

// Database Connection & Server Start
const PORT = process.env.PORT || 8080;

const startServer = async () => {
    try {
        await connectDB();
        // Schedule background AI cron jobs (spoilage 06:00, basket 03:30, pricing 04:00).
        try {
            const { scheduleSpoilageCron } = require('./infrastructure/cron/spoilage.cron');
            scheduleSpoilageCron();
            const { scheduleBasketCron } = require('./infrastructure/cron/basket.cron');
            scheduleBasketCron();
            const { schedulePricingAlertCron } = require('./infrastructure/cron/pricing-alert.cron');
            schedulePricingAlertCron();
        } catch (cronErr) {
            logger.warn(`Cron scheduling skipped: ${cronErr.message}`);
        }
        app.listen(PORT, () => {
            logger.info(`Server is running on port ${PORT}`);
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (err) {
        logger.error(`Failed to start server: ${err.message}`);
        process.exit(1);
    }
};

startServer();

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
    logger.error(`Unhandled Rejection: ${err.message}`);
    process.exit(1);
});
