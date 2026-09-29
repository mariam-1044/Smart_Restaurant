const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { requireRole } = require('../interfaces/middleware/role.middleware');
const { auditMiddleware } = require('../interfaces/middleware/audit.middleware');
const pricingController = require('../interfaces/controllers/pricing.controller');

router.use(protect);

router.post('/suggest', requireRole('admin'), auditMiddleware('pricing_suggest'), pricingController.suggest);
router.post('/apply', requireRole('admin'), auditMiddleware('pricing_apply'), pricingController.apply);
router.post('/revert', requireRole('admin'), auditMiddleware('pricing_revert'), pricingController.revert);
router.get('/history/:dishId', requireRole('admin'), auditMiddleware('pricing_history_read'), pricingController.history);

module.exports = router;
