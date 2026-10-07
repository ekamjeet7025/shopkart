// Isolated HTTP + MongoDB checks. Razorpay network calls are replaced with a test stub.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config({ quiet: true });
const Customer = require("../models/customer.model");
const Product = require("../models/product.model");
const Order = require("../models/order.model");
const paymentService = require("../services/razorpay.service");

async function run() {
    const cachedBinary = path.join(__dirname, "../node_modules/.cache/mongodb-memory-server/mongod-test.exe");
    const memory = await MongoMemoryServer.create({ binary: fs.existsSync(cachedBinary) ? { systemBinary: cachedBinary } : undefined });
    process.env.JWT_SECRET = "isolated-lab6-jwt-test-secret";
    process.env.RAZORPAY_KEY_ID = "rzp_test_isolated_lab6";
    process.env.RAZORPAY_KEY_SECRET = "isolated-lab6-payment-secret";
    await mongoose.connect(memory.getUri());
    const tag = new mongoose.Types.ObjectId().toString();
    let callCount = 0;
    paymentService.createRazorpayOrder = async (amount, receipt) => {
        callCount += 1;
        assert.equal(typeof amount, "number");
        assert.ok(receipt);
        return { id: `order_test_${tag}_${callCount}`, amount, currency: "INR" };
    };

    const app = express();
    app.use(require("cors")({ origin: ["http://127.0.0.1:5174", "http://localhost:5174"], credentials: true }));
    app.use(express.json(), cookieParser());
    app.use("/customers", require("../routes/customer.routes"));
    app.use("/products", require("../routes/product.routes"));
    app.use("/cart", require("../routes/cart.routes"));
    app.use("/wishlist", require("../routes/wishlist.routes"));
    app.use("/orders", require("../routes/order.routes"));
    const server = app.listen(process.argv.includes("--browser") ? 3001 : 0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const baseURL = `http://127.0.0.1:${server.address().port}`;
    const ids = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
    const customers = [];
    const password = "Lab6TestPassword!";
    const address = { fullName: "Test Customer", phone: "9876543210", addressLine1: "22 MG Road", city: "Bengaluru", state: "Karnataka", pincode: "560001" };
    const request = async (method, route, cookie, body) => {
        const headers = { "Content-Type": "application/json" };
        if (cookie) headers.Cookie = cookie;
        const response = await fetch(baseURL + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
        return { status: response.status, data: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
    };

    try {
        await Product.create({ _id: ids[0], name: `Lab6 Keyboard ${tag}`, description: "Disposable", price: 2999, category: "Electronics", image: "/product-placeholder.svg", stock: 3 });
        await Product.create({ _id: ids[1], name: `Lab6 Mouse ${tag}`, description: "Disposable", price: 1499, category: "Electronics", image: "/product-placeholder.svg", stock: 1 });
        const cookies = [];
        for (const suffix of ["a", "b"]) {
            const email = `lab6-${tag}-${suffix}@example.com`;
            const registered = await request("POST", "/customers/register", null, { fullName: `Lab6 ${suffix}`, email, password, phone: "9999999999" });
            assert.equal(registered.status, 201);
            customers.push(registered.data.customer._id);
            const login = await request("POST", "/customers/login", null, { email, password });
            assert.equal(login.status, 200);
            cookies.push(login.cookie);
        }
        const [cookieA, cookieB] = cookies;

        if (process.argv.includes("--browser")) {
            console.log(`Browser API at ${baseURL}; account lab6-${tag}-a@example.com / ${password}; signature secret is test-only`);
            await new Promise((resolve) => process.once("SIGINT", resolve));
            return;
        }

        for (const [method, route] of [["POST", "/orders/create-payment-order"], ["POST", "/orders/verify-payment"], ["GET", "/orders"], ["GET", `/orders/${new mongoose.Types.ObjectId()}`]]) {
            assert.equal((await request(method, route, null, method === "POST" ? {} : undefined)).status, 401);
        }
        assert.equal((await request("POST", "/orders/create-payment-order", cookieA, { shippingAddress: address })).status, 400);
        for (const bad of [{ ...address, fullName: " " }, { ...address, phone: "123" }, { ...address, pincode: "12345" }]) {
            assert.equal((await request("POST", "/orders/create-payment-order", cookieA, { shippingAddress: bad })).status, 400);
        }
        console.log("PASS: protected APIs, empty cart and address validation");

        await request("POST", `/cart/${ids[0]}`, cookieA);
        await request("POST", `/cart/${ids[0]}`, cookieA);
        await request("POST", `/cart/${ids[1]}`, cookieA);
        await Product.updateOne({ _id: ids[0] }, { $set: { price: 3199 } });
        const created = await request("POST", "/orders/create-payment-order", cookieA, { shippingAddress: address, totalAmount: 1, userId: customers[1] });
        assert.equal(created.status, 201);
        assert.equal(created.data.amount, 789700);
        assert.equal(created.data.currency, "INR");
        assert.equal(created.data.key, "rzp_test_isolated_lab6");
        assert.equal(Object.hasOwn(created.data, "keySecret"), false);
        const orderId = created.data.shopKartOrderId;
        const dbOrder = await Order.findById(orderId);
        assert.equal(dbOrder.paymentStatus, "PENDING");
        assert.equal(dbOrder.status, "PENDING_PAYMENT");
        assert.equal(dbOrder.items[0].price, 3199);
        assert.equal(dbOrder.items[0].quantity, 2);
        assert.equal(dbOrder.user.toString(), customers[0]);
        assert.equal((await request("GET", "/cart", cookieA)).data.cart.length, 2);
        assert.equal((await request("GET", `/orders/${orderId}`, cookieB)).status, 404);
        assert.equal((await request("GET", "/orders", cookieB)).data.orders.length, 0);
        console.log("PASS: server total, snapshots, pending state, retained cart and ownership");

        const paymentId = `pay_test_${tag}`;
        const correctSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${created.data.razorpayOrderId}|${paymentId}`).digest("hex");
        const verification = { shopKartOrderId: orderId, razorpay_order_id: created.data.razorpayOrderId, razorpay_payment_id: paymentId, razorpay_signature: correctSignature };
        assert.equal((await request("POST", "/orders/verify-payment", cookieB, verification)).status, 404);
        assert.equal((await request("POST", "/orders/verify-payment", cookieA, { ...verification, razorpay_order_id: "order_wrong" })).status, 400);
        assert.equal((await request("POST", "/orders/verify-payment", cookieA, { ...verification, razorpay_signature: "0".repeat(64) })).status, 400);
        assert.equal((await request("GET", "/cart", cookieA)).data.cart.length, 2);
        assert.equal((await Order.findById(orderId)).paymentStatus, "PENDING");
        const paid = await request("POST", "/orders/verify-payment", cookieA, verification);
        assert.equal(paid.status, 200);
        assert.equal(paid.data.order.paymentStatus, "PAID");
        assert.equal(paid.data.order.status, "PLACED");
        assert.equal(paid.data.order.razorpayPaymentId, paymentId);
        assert.equal((await request("GET", "/cart", cookieA)).data.cart.length, 0);
        assert.equal((await request("POST", "/orders/verify-payment", cookieA, verification)).status, 200);
        await Product.updateOne({ _id: ids[0] }, { $set: { price: 3599 } });
        assert.equal((await request("GET", `/orders/${orderId}`, cookieA)).data.order.items[0].price, 3199);
        assert.equal((await request("GET", "/orders", cookieA)).data.orders[0]._id, orderId);
        console.log("PASS: signature verification, cart clearing, idempotency and historical price");

        await request("POST", `/cart/${ids[0]}`, cookieA);
        await Product.updateOne({ _id: ids[0] }, { $set: { stock: 0 } });
        assert.equal((await request("POST", "/orders/create-payment-order", cookieA, { shippingAddress: address })).status, 400);
        await Product.deleteOne({ _id: ids[0] });
        assert.equal((await request("POST", "/orders/create-payment-order", cookieA, { shippingAddress: address })).status, 400);
        assert.equal((await request("GET", "/cart", cookieA)).data.cart.length, 0);
        console.log("PASS: latest stock and missing products block new orders");
    } finally {
        await Order.deleteMany({ user: { $in: customers } });
        await Customer.deleteMany({ _id: { $in: customers } });
        await Product.deleteMany({ _id: { $in: ids } });
        await new Promise((resolve) => server.close(resolve));
        await mongoose.disconnect();
        await memory.stop();
    }
}

run().catch((error) => {
    console.error(`Order integration failed: ${error.name} (${error.code || "no error code"})`);
    console.error(error.stack);
    process.exitCode = 1;
});
