const express = require("express");

const {
    registerCustomer,
    loginCustomer,
    getCurrentCustomer,
    logoutCustomer
} = require("../controllers/customer.controller");

const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();


// Register
router.post("/register", registerCustomer);


// Login
router.post("/login", loginCustomer);


// Get logged-in customer
router.get("/me", authMiddleware, getCurrentCustomer);


// Logout
router.post("/logout", authMiddleware, logoutCustomer);


module.exports = router;
