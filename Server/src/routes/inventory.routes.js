const express = require("express");
const inventoryController = require("../interfaces/controllers/inventory.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");

const router = express.Router();

// All inventory routes require authentication
router.use(protect);

// Admin and Staff can view inventory
router.get("/alerts", restrictTo("admin", "staff"), inventoryController.alerts);
router.get("/expired", restrictTo("admin", "staff"), inventoryController.expired);
router.get("/near-expiry", restrictTo("admin", "staff"), inventoryController.nearExpiry);
router.get("/low-stock", restrictTo("admin", "staff"), inventoryController.lowStock);
// MUST stay above /:id
router.get("/export", restrictTo("admin", "staff"), inventoryController.exportCsv);
router.get("/", restrictTo("admin", "staff"), inventoryController.getAll);
router.get("/:id", restrictTo("admin", "staff"), inventoryController.getOne);

// Admin only: Manage inventory
router.post("/", restrictTo("admin"), inventoryController.add);
router.patch("/:id", restrictTo("admin"), inventoryController.update);
router.delete("/:id", restrictTo("admin"), inventoryController.remove);

module.exports = router;
