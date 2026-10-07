const Razorpay = require("razorpay");

function getTestClient() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId?.startsWith("rzp_test_") || !keySecret) {
        const error = new Error("Razorpay Test Mode keys are not configured");
        error.status = 503;
        throw error;
    }
    return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

async function createRazorpayOrder(amount, receipt) {
    return getTestClient().orders.create({ amount, currency: "INR", receipt, partial_payment: false });
}

module.exports = { createRazorpayOrder };
