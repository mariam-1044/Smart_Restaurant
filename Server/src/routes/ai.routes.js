const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { requireRole } = require('../interfaces/middleware/role.middleware');
const { auditMiddleware } = require('../interfaces/middleware/audit.middleware');
const aiController = require('../interfaces/controllers/ai.controller');

router.use(protect);

// US1 — demand forecast (admin)
router.post('/forecast', requireRole('admin'), auditMiddleware('forecast'), aiController.forecast);

// US2 — recipe generation + lifecycle.
// Generation is available to staff and customers; publishing to the menu is staff-only.
router.post('/recipe', requireRole('admin', 'staff', 'customer'), auditMiddleware('recipe'), aiController.recipe);
router.post('/recipe/personalized', requireRole('admin', 'staff', 'customer'), auditMiddleware('recipe'), aiController.recipePersonalized);
router.get('/recipes', requireRole('admin', 'staff', 'customer'), aiController.listRecipes);
router.delete('/recipes/:id', requireRole('admin', 'staff', 'customer'), aiController.deleteRecipe);
router.post('/recipes/:id/publish', requireRole('admin', 'staff'), aiController.publishRecipe);
router.get('/customer-favorites', requireRole('admin', 'staff'), aiController.customerFavorites);

// Business "smart recommendations" insights for the admin dashboard.
router.get('/recommendations', requireRole('admin', 'staff'), aiController.recommendations);

// US4 — market basket (admin)
router.get('/market-basket', requireRole('admin'), auditMiddleware('market_basket_read'), aiController.marketBasket);

// US8 — ML health (admin)
router.get('/health', requireRole('admin'), auditMiddleware('health'), aiController.health);

module.exports = router;
