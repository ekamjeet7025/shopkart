const express = require("express");

const {
    createProduct,
    getAllProducts,
    getSingleProduct
} = require("../controllers/product.controller");

const router = express.Router();


// Create Product
router.post("/", createProduct);


// Get All Products
router.get("/", getAllProducts);


// Get Single Product
router.get("/:id", getSingleProduct);


module.exports = router;