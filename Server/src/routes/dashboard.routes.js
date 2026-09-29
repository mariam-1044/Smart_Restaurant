const express = require('express');
const dashboardController = require('../interfaces/controllers/dashboard.controller');
const { protect , restrictTo} = require('../middlewares/auth.middleware');

const router = express.Router();

// All dashboard routes require authentication
router.use(protect);

// Dashboard stats route
router.get('/stats', dashboardController.getAdminDashboard);

// Admin only routes
router.get('/admin', restrictTo('admin'), dashboardController.getAdminDashboard);

module.exports = router;
