const express = require("express");
const requireAdminKey = require("../middlewares/admin.middleware");

const {
    createProduct,
    getAllProducts,
    getSingleProduct
} = require("../controllers/product.controller");

const router = express.Router();


// Create Product
router.post("/", requireAdminKey, createProduct);


// Get All Products
router.get("/", getAllProducts);


// Get Single Product
router.get("/:id", getSingleProduct);


module.exports = router;
