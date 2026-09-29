const express = require("express");
const orderController = require("../interfaces/controllers/order.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { orderSchema } = require("../application/validations/order.validation");
const { verifyOrderExistence, verifyStockFulfillability } = require("../middlewares/order-existence.middleware");

const router = express.Router();

// All order routes require authentication
router.use(protect);

// Customers can create orders (with validation pipeline)
router.post("/", validate(orderSchema), verifyOrderExistence, verifyStockFulfillability, orderController.createOrder);

// Admin and Staff can manage orders
router.get("/", restrictTo("admin", "staff"), orderController.getOrders);
router.get("/integrity-report", restrictTo("admin"), orderController.integrityReport);
router.get("/:id", restrictTo("admin", "staff"), orderController.getOrderById);
// Confirm / change order status (e.g. mark a pending order completed + paid).
// Declared before PATCH /:id so the /status segment isn't swallowed by :id.
router.patch("/:id/status", restrictTo("admin", "staff"), orderController.updateOrderStatus);
router.patch("/:id", restrictTo("admin", "staff"), orderController.updateOrder);
router.delete("/:id", restrictTo("admin", "staff"), orderController.deleteOrder);

module.exports = router;
