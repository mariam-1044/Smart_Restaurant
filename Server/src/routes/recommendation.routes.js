const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { auditMiddleware } = require('../interfaces/middleware/audit.middleware');
const {
    assertOwnCustomerOrStaff,
    assertOwnCustomerOnly
} = require('../interfaces/middleware/customer-self.middleware');
const recommendationController = require('../interfaces/controllers/recommendation.controller');

router.use(protect);

// Public (any authenticated user) — anonymised peer-endorsement feed.
// Declared before the /:customerId routes so "peer-endorsements" isn't
// swallowed as a customerId path parameter.
router.get(
    '/peer-endorsements',
    auditMiddleware('endorsement_feed_read'),
    recommendationController.peerEndorsements
);

// Customer-self: rate a published recipe's dish (auto-endorses on 4★+).
router.post(
    '/:userId/rate-recipe',
    assertOwnCustomerOnly('userId'),
    auditMiddleware('rate'),
    recommendationController.rateRecipe
);

router.get(
    '/:customerId',
    assertOwnCustomerOrStaff('customerId'),
    auditMiddleware('recommend'),
    recommendationController.getRecommendations
);

router.post(
    '/:customerId/rate',
    assertOwnCustomerOnly('customerId'),
    auditMiddleware('rate'),
    recommendationController.submitRating
);

router.post(
    '/:customerId/publish',
    assertOwnCustomerOnly('customerId'),
    auditMiddleware('publish'),
    recommendationController.publishEndorsement
);

router.delete(
    '/:customerId/publish/:dishId',
    assertOwnCustomerOnly('customerId'),
    auditMiddleware('unpublish'),
    recommendationController.unpublishEndorsement
);

module.exports = router;
