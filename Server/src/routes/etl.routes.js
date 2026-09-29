const express = require('express');
const router = express.Router();
const etlController = require('../interfaces/controllers/etl.controller');
const { protect , restrictTo} = require('../middlewares/auth.middleware');

router.use(protect);
router.use(restrictTo('admin'));

router.get('/report', etlController.getAnalyticsReport);
router.get('/export', etlController.exportToCSV);

module.exports = router;
