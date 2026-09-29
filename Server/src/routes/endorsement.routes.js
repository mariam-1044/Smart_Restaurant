const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { auditMiddleware } = require('../interfaces/middleware/audit.middleware');
const endorsementController = require('../interfaces/controllers/endorsement.controller');

router.use(protect);

router.get(
    '/:dishId/endorsements',
    auditMiddleware('endorsement_summary_read'),
    endorsementController.getDishSummary
);

module.exports = router;
