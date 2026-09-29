const express = require('express');
const router = express.Router();
const salesController = require('../interfaces/controllers/sales.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');

router.use(protect);
router.use(restrictTo('admin'));

router.get('/report', salesController.getSalesReport);

module.exports = router;
