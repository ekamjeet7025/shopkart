const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const { addToWishlist, getWishlist, removeFromWishlist } = require("../controllers/wishlist.controller");

const router = express.Router();

// Every endpoint uses the customer ID supplied by JWT middleware.
router.use(authMiddleware);
router.get("/", getWishlist);
router.post("/:productId", addToWishlist);
router.delete("/:productId", removeFromWishlist);

module.exports = router;
