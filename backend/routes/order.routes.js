const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const { createPaymentOrder, verifyPayment, getOrders, getOrder } = require("../controllers/order.controller");

const router = express.Router();
router.use(authMiddleware);
router.post("/create-payment-order", createPaymentOrder);
router.post("/verify-payment", verifyPayment);
router.get("/", getOrders);
router.get("/:id", getOrder);

module.exports = router;
