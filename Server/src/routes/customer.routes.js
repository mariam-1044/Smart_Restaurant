const express = require("express");
const customerController = require("../interfaces/controllers/customer.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");

const router = express.Router();

// Admin/staff: list all customers with tags
router.get('/', protect, restrictTo('admin', 'staff'), customerController.listAll);
router.get('/:id', protect, restrictTo('admin', 'staff'), customerController.getById);
// Unlink a single favorite dish from a customer (non-destructive — keeps the
// dish and the customer, just removes the favorite marking).
router.delete('/:id/favorites/:dishId', protect, restrictTo('admin', 'staff'), customerController.removeFavorite);

// Customer Smart Flow: Load profile, history, favorites, and recommendations by phone
router.post("/profile", customerController.getCustomerProfile);

// Place an order directly from the menu without login
router.post("/order", customerController.placeCustomerOrder);

// Get recommendations by phone
router.get("/recommendations/:phone", customerController.getCustomerRecommendations);

module.exports = router;