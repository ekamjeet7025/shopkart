const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const { getCart, addToCart, updateQuantity, removeFromCart } = require("../controllers/cart.controller");

const router = express.Router();
router.use(authMiddleware);
router.get("/", getCart);
router.post("/:productId", addToCart);
router.patch("/:productId", updateQuantity);
router.delete("/:productId", removeFromCart);

module.exports = router;
