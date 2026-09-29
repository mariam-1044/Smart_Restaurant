const express = require("express");
const posController = require("../interfaces/controllers/pos.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");

const router = express.Router();

// Protect all POS routes
router.use(protect);

// Route for processing a single POS transaction
router.post("/transaction", restrictTo("staff", "admin"), posController.processPOSTransaction);

// Route for seeding demo data (admin only)
router.post("/seed", restrictTo("admin"), posController.seedData);

module.exports = router;
