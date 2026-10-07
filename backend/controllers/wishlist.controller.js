const mongoose = require("mongoose");
const Customer = require("../models/customer.model");
const Product = require("../models/product.model");

const isValidProductId = (id) => mongoose.isObjectIdOrHexString(id);

const addToWishlist = async (req, res) => {
    const { productId } = req.params;
    if (!isValidProductId(productId)) {
        return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    try {
        if (!await Product.exists({ _id: productId })) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Check and insert in one atomic database operation. Even simultaneous
        // requests cannot add the same product twice.
        const result = await Customer.updateOne(
            { _id: req.customerId, wishlist: { $ne: productId } },
            { $addToSet: { wishlist: productId } }
        );
        if (result.modifiedCount === 0) {
            if (!await Customer.exists({ _id: req.customerId })) {
                return res.status(401).json({ success: false, message: "Customer session is no longer valid" });
            }
            return res.status(409).json({ success: false, message: "Product already in wishlist" });
        }
        return res.status(201).json({ success: true, message: "Product added to wishlist" });
    } catch (error) {
        console.error("Add wishlist error:", error);
        return res.status(500).json({ success: false, message: "Unable to save product. Please try again." });
    }
};

const getWishlist = async (req, res) => {
    try {
        const customer = await Customer.findById(req.customerId)
            .select("wishlist")
            .populate({ path: "wishlist", select: "name price category image stock" });

        if (!customer) {
            return res.status(401).json({ success: false, message: "Customer session is no longer valid" });
        }
        // A product might have been deleted after being saved.
        const wishlist = (customer.wishlist || []).filter(Boolean);
        return res.status(200).json({ success: true, count: wishlist.length, wishlist });
    } catch (error) {
        console.error("Get wishlist error:", error);
        return res.status(500).json({ success: false, message: "Unable to load wishlist. Please try again." });
    }
};

const removeFromWishlist = async (req, res) => {
    const { productId } = req.params;
    if (!isValidProductId(productId)) {
        return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    try {
        // Remove the reference even if the original product no longer exists.
        const result = await Customer.updateOne(
            { _id: req.customerId, wishlist: productId },
            { $pull: { wishlist: productId } }
        );
        if (result.modifiedCount === 0) {
            if (!await Customer.exists({ _id: req.customerId })) {
                return res.status(401).json({ success: false, message: "Customer session is no longer valid" });
            }
            return res.status(404).json({ success: false, message: "Product not in wishlist" });
        }
        return res.status(200).json({ success: true, message: "Product removed from wishlist" });
    } catch (error) {
        console.error("Remove wishlist error:", error);
        return res.status(500).json({ success: false, message: "Unable to remove product. Please try again." });
    }
};

module.exports = { addToWishlist, getWishlist, removeFromWishlist };
