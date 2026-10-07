const mongoose = require("mongoose");
const Customer = require("../models/customer.model");
const Product = require("../models/product.model");

const invalidId = (id) => !mongoose.isObjectIdOrHexString(id);
const failed = (res, status, message) => res.status(status).json({ success: false, message });

// MongoDB keeps references and quantities; populate reads the latest product data.
async function readCart(customerId) {
    const customer = await Customer.findById(customerId).select("cart").populate({
        path: "cart.product",
        select: "name price category image stock"
    });
    if (!customer) return null;
    return (customer.cart || []).filter((item) => item.product);
}

async function sendCart(res, customerId, message = "Cart loaded") {
    const cart = await readCart(customerId);
    if (!cart) return failed(res, 401, "Customer session is no longer valid");
    return res.status(200).json({ success: true, message, cart });
}

const getCart = async (req, res) => {
    try {
        return await sendCart(res, req.customerId);
    } catch (error) {
        console.error("Get cart error:", error);
        return failed(res, 500, "Unable to load cart. Please try again.");
    }
};

const addToCart = async (req, res) => {
    const { productId } = req.params;
    if (invalidId(productId)) return failed(res, 400, "Invalid product ID");

    try {
        const product = await Product.findById(productId).select("stock");
        if (!product) return failed(res, 404, "Product not found");
        if (product.stock < 1) return failed(res, 400, "Product is out of stock");

        // Conditional updates keep one row per product and prevent concurrent adds
        // from pushing quantity beyond the stock available when the request began.
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const increased = await Customer.updateOne(
                { _id: req.customerId, cart: { $elemMatch: { product: productId, quantity: { $lt: product.stock } } } },
                { $inc: { "cart.$.quantity": 1 } }
            );
            if (increased.modifiedCount) return await sendCart(res, req.customerId, "Cart updated");

            const inserted = await Customer.updateOne(
                { _id: req.customerId, "cart.product": { $ne: productId } },
                { $push: { cart: { product: productId, quantity: 1 } } }
            );
            if (inserted.modifiedCount) return await sendCart(res, req.customerId, "Cart updated");

            const customer = await Customer.findById(req.customerId).select("cart");
            if (!customer) return failed(res, 401, "Customer session is no longer valid");
            const item = (customer.cart || []).find((entry) => String(entry.product) === productId);
            if (item && item.quantity >= product.stock) return failed(res, 400, "Only available stock can be added");
        }
        return failed(res, 409, "Cart changed during this request. Please try again.");
    } catch (error) {
        console.error("Add cart error:", error);
        return failed(res, 500, "Unable to add product. Please try again.");
    }
};

const updateQuantity = async (req, res) => {
    const { productId } = req.params;
    if (invalidId(productId)) return failed(res, 400, "Invalid product ID");
    const { quantity } = req.body || {};
    if (!Number.isInteger(quantity) || quantity < 1) return failed(res, 400, "Quantity must be a whole number of at least 1");

    try {
        const product = await Product.findById(productId).select("stock");
        if (!product) return failed(res, 404, "Product not found");
        if (quantity > product.stock) return failed(res, 400, "Quantity exceeds available stock");

        const result = await Customer.updateOne(
            { _id: req.customerId, "cart.product": productId },
            { $set: { "cart.$.quantity": quantity } }
        );
        if (!result.matchedCount) {
            if (!await Customer.exists({ _id: req.customerId })) return failed(res, 401, "Customer session is no longer valid");
            return failed(res, 404, "Product not in cart");
        }
        return await sendCart(res, req.customerId, "Cart updated");
    } catch (error) {
        console.error("Update cart error:", error);
        return failed(res, 500, "Unable to update quantity. Please try again.");
    }
};

const removeFromCart = async (req, res) => {
    const { productId } = req.params;
    if (invalidId(productId)) return failed(res, 400, "Invalid product ID");
    try {
        // An orphaned cart row can still be removed after its Product is deleted.
        const result = await Customer.updateOne(
            { _id: req.customerId, "cart.product": productId },
            { $pull: { cart: { product: productId } } }
        );
        if (!result.modifiedCount) {
            if (!await Customer.exists({ _id: req.customerId })) return failed(res, 401, "Customer session is no longer valid");
            return failed(res, 404, "Product not in cart");
        }
        return await sendCart(res, req.customerId, "Product removed from cart");
    } catch (error) {
        console.error("Remove cart error:", error);
        return failed(res, 500, "Unable to remove product. Please try again.");
    }
};

module.exports = { getCart, addToCart, updateQuantity, removeFromCart };
