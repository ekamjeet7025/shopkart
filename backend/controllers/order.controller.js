const crypto = require("node:crypto");
const mongoose = require("mongoose");
const Customer = require("../models/customer.model");
const Product = require("../models/product.model");
const Order = require("../models/order.model");
const paymentService = require("../services/razorpay.service");

const fail = (res, status, message) => res.status(status).json({ success: false, message });

function validateAddress(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return null;
    const keys = ["fullName", "phone", "addressLine1", "city", "state", "pincode"];
    const address = {};
    for (const key of keys) {
        if (typeof input[key] !== "string") return null;
        address[key] = input[key].trim();
        if (!address[key] || address[key].length > 160) return null;
    }
    if (!/^[6-9]\d{9}$/.test(address.phone) || !/^\d{6}$/.test(address.pincode)) return null;
    return address;
}

async function createPaymentOrder(req, res) {
    const shippingAddress = validateAddress(req.body?.shippingAddress);
    if (!shippingAddress) return fail(res, 400, "Enter a valid shipping address, 10-digit phone and 6-digit pincode");
    if (!process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_") || !process.env.RAZORPAY_KEY_SECRET) {
        return fail(res, 503, "Razorpay Test Mode is not configured");
    }

    try {
        const customer = await Customer.findById(req.customerId).select("cart");
        if (!customer) return fail(res, 401, "Customer session is no longer valid");
        if (!customer.cart?.length) return fail(res, 400, "Your cart is empty");

        const ids = customer.cart.map((item) => item.product);
        const products = await Product.find({ _id: { $in: ids } }).select("name price image stock");
        const byId = new Map(products.map((product) => [String(product._id), product]));
        const items = [];
        let amountInPaise = 0;
        for (const cartItem of customer.cart) {
            const product = byId.get(String(cartItem.product));
            if (!product) return fail(res, 400, "A product in your cart is no longer available. Remove it before checkout.");
            if (!Number.isInteger(cartItem.quantity) || cartItem.quantity < 1) return fail(res, 400, "Your cart contains an invalid quantity");
            if (cartItem.quantity > product.stock) return fail(res, 400, `Insufficient stock for ${product.name}`);
            const priceInPaise = Math.round(product.price * 100);
            if (!Number.isSafeInteger(priceInPaise) || priceInPaise < 1) return fail(res, 400, "A product has an invalid price");
            amountInPaise += priceInPaise * cartItem.quantity;
            items.push({ product: product._id, name: product.name, price: priceInPaise / 100, quantity: cartItem.quantity, image: product.image });
        }
        if (!Number.isSafeInteger(amountInPaise) || amountInPaise < 100) return fail(res, 400, "Order total must be at least ₹1");

        // This order is only pending. The customer's cart stays intact until payment verification.
        const order = await Order.create({ user: req.customerId, items, shippingAddress, totalAmount: amountInPaise / 100 });
        try {
            const paymentOrder = await paymentService.createRazorpayOrder(amountInPaise, String(order._id));
            order.razorpayOrderId = paymentOrder.id;
            await order.save();
            return res.status(201).json({
                success: true,
                shopKartOrderId: order._id,
                razorpayOrderId: paymentOrder.id,
                amount: amountInPaise,
                currency: "INR",
                key: process.env.RAZORPAY_KEY_ID
            });
        } catch (error) {
            order.paymentStatus = "FAILED";
            await order.save();
            throw error;
        }
    } catch (error) {
        console.error("Create payment order error:", error.statusCode || error.status || error.name || "Unknown error");
        return fail(res, error.status === 503 ? 503 : 502, "Unable to start test payment. Please try again.");
    }
}

async function verifyPayment(req, res) {
    const { shopKartOrderId, razorpay_order_id: razorpayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    if (!mongoose.isObjectIdOrHexString(shopKartOrderId) || ![razorpayOrderId, paymentId, signature].every((value) => typeof value === "string" && value.length > 0)) {
        return fail(res, 400, "Valid payment details are required");
    }
    if (!process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_") || !process.env.RAZORPAY_KEY_SECRET) {
        return fail(res, 503, "Razorpay Test Mode is not configured");
    }

    try {
        const order = await Order.findOne({ _id: shopKartOrderId, user: req.customerId });
        if (!order) return fail(res, 404, "Order not found");
        if (order.razorpayOrderId !== razorpayOrderId) return fail(res, 400, "Payment order does not match");
        const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${order.razorpayOrderId}|${paymentId}`).digest("hex");
        const supplied = Buffer.from(signature, "hex");
        if (!/^[a-f0-9]{64}$/i.test(signature) || supplied.length !== 32 || !crypto.timingSafeEqual(Buffer.from(expected, "hex"), supplied)) {
            return fail(res, 400, "Invalid payment signature");
        }

        if (order.paymentStatus === "PAID") {
            if (order.razorpayPaymentId !== paymentId) return fail(res, 409, "Order already paid with another payment");
        } else {
            if (order.paymentStatus !== "PENDING") return fail(res, 409, "This payment order is no longer active");
            const updated = await Order.findOneAndUpdate(
                { _id: order._id, user: req.customerId, paymentStatus: "PENDING" },
                { $set: { paymentStatus: "PAID", status: "PLACED", razorpayPaymentId: paymentId } },
                { returnDocument: "after" }
            );
            if (!updated) return fail(res, 409, "Order status changed. Please reload your orders.");
        }

        // A retry can finish cart clearing if a database error occurred after payment was marked PAID.
        const paidOrder = await Order.findById(order._id);
        if (!paidOrder.cartClearedAt) {
            await Customer.updateOne({ _id: req.customerId }, { $set: { cart: [] } });
            paidOrder.cartClearedAt = new Date();
            await paidOrder.save();
        }
        return res.status(200).json({ success: true, message: "Payment verified and order placed", order: paidOrder });
    } catch (error) {
        console.error("Verify payment error:", error.name || "Unknown error");
        return fail(res, 500, "Unable to verify payment. Please retry verification.");
    }
}

async function getOrders(req, res) {
    try {
        const orders = await Order.find({ user: req.customerId }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, orders });
    } catch (error) {
        console.error("Get orders error:", error);
        return fail(res, 500, "Unable to load orders. Please try again.");
    }
}

async function getOrder(req, res) {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return fail(res, 400, "Invalid order ID");
    try {
        const order = await Order.findOne({ _id: req.params.id, user: req.customerId });
        if (!order) return fail(res, 404, "Order not found");
        return res.status(200).json({ success: true, order });
    } catch (error) {
        console.error("Get order error:", error);
        return fail(res, 500, "Unable to load order. Please try again.");
    }
}

module.exports = { createPaymentOrder, verifyPayment, getOrders, getOrder };
