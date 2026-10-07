// Real HTTP requests and MongoDB operations against disposable test records.
const assert = require("node:assert/strict");
const express = require("express");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const path = require("node:path");
const fs = require("node:fs");
require("dns").setServers(["8.8.8.8", "8.8.4.4"]);
require("dotenv").config({ quiet: true });
const Customer = require("../models/customer.model");
const Product = require("../models/product.model");
let phase = "connecting";

async function run() {
    const cachedBinary = path.join(__dirname, "../node_modules/.cache/mongodb-memory-server/mongod-test.exe");
    const memory = process.argv.includes("--memory")
        ? await MongoMemoryServer.create({ binary: fs.existsSync(cachedBinary) ? { systemBinary: cachedBinary } : undefined })
        : null;
    const uri = memory ? memory.getUri() : process.env.MONGO_URI;
    if (!uri || (!memory && !process.env.JWT_SECRET)) throw new Error("MONGO_URI and JWT_SECRET are required");
    if (memory) process.env.JWT_SECRET = "isolated-lab5-cart-test-secret";
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    phase = "starting HTTP server";

    const app = express();
    app.use(require("cors")({ origin: ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"], credentials: true }));
    app.use(express.json(), cookieParser());
    app.use("/customers", require("../routes/customer.routes"));
    app.use("/cart", require("../routes/cart.routes"));
    app.use("/products", require("../routes/product.routes"));
    app.use("/wishlist", require("../routes/wishlist.routes"));
    const server = app.listen(process.argv.includes("--browser") ? 3001 : 0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    phase = "creating disposable fixtures";
    const baseURL = `http://127.0.0.1:${server.address().port}`;
    const tag = new mongoose.Types.ObjectId().toString();
    const productId = new mongoose.Types.ObjectId();
    const customerIds = [];
    const password = "Lab5CartPassword!";
    const request = async (method, route, cookie, body) => {
        const headers = { "Content-Type": "application/json" };
        if (cookie) headers.Cookie = cookie;
        const response = await fetch(baseURL + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
        return { status: response.status, data: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
    };

    try {
        await Product.create({ _id: productId, name: `Lab5 Keyboard ${tag}`, description: "Disposable cart product", price: 2999, category: "Electronics", image: "/product-placeholder.svg", stock: 3 });
        phase = "testing cart requests";
        const cookies = [];
        for (const suffix of ["a", "b"]) {
            const email = `lab5-${tag}-${suffix}@example.com`;
            const registered = await request("POST", "/customers/register", null, { fullName: "Cart Test Customer", email, password, phone: "9999999999" });
            assert.equal(registered.status, 201);
            customerIds.push(registered.data.customer._id);
            const login = await request("POST", "/customers/login", null, { email, password });
            assert.equal(login.status, 200);
            cookies.push(login.cookie);
        }
        const [cookieA, cookieB] = cookies;

        if (process.argv.includes("--browser")) {
            console.log(`Browser API at ${baseURL}; account lab5-${tag}-a@example.com / ${password}`);
            await new Promise((resolve) => process.once("SIGINT", resolve));
            return;
        }

        await Customer.collection.updateOne({ _id: new mongoose.Types.ObjectId(customerIds[0]) }, { $unset: { cart: "" } });
        assert.deepEqual((await request("GET", "/cart", cookieA)).data.cart, []);
        for (const [method, route, body] of [["GET", "/cart"], ["POST", `/cart/${productId}`], ["PATCH", `/cart/${productId}`, { quantity: 2 }], ["DELETE", `/cart/${productId}`]]) {
            assert.equal((await request(method, route, null, body)).status, 401);
        }
        for (const method of ["POST", "PATCH", "DELETE"]) assert.equal((await request(method, "/cart/invalid", cookieA, { quantity: 2 })).status, 400);
        assert.equal((await request("POST", `/cart/${new mongoose.Types.ObjectId()}`, cookieA)).status, 404);
        console.log("PASS: old customer, auth and ID validation");

        const added = await request("POST", `/cart/${productId}`, cookieA, { userId: customerIds[1] });
        assert.equal(added.status, 200);
        assert.equal(added.data.cart[0].quantity, 1);
        assert.equal((await request("GET", "/cart", cookieB)).data.cart.length, 0);
        assert.equal((await request("POST", `/cart/${productId}`, cookieA)).data.cart[0].quantity, 2);
        assert.equal((await request("POST", `/cart/${productId}`, cookieA)).data.cart[0].quantity, 3);
        assert.equal((await request("POST", `/cart/${productId}`, cookieA)).status, 400);
        const stored = await Customer.collection.findOne({ _id: new mongoose.Types.ObjectId(customerIds[0]) });
        assert.equal(stored.cart.length, 1);
        assert.ok(stored.cart[0].product instanceof mongoose.Types.ObjectId);
        assert.equal(stored.cart[0].quantity, 3);
        console.log("PASS: repeated adds use one row, stock cap and customer isolation");

        for (const quantity of [0, -1, 1.5, "2", 4]) assert.equal((await request("PATCH", `/cart/${productId}`, cookieA, { quantity })).status, 400);
        assert.equal((await request("PATCH", `/cart/${new mongoose.Types.ObjectId()}`, cookieA, { quantity: 1 })).status, 404);
        assert.equal((await request("PATCH", `/cart/${productId}`, cookieB, { quantity: 1 })).status, 404);
        assert.equal((await request("PATCH", `/cart/${productId}`, cookieA, { quantity: 2 })).data.cart[0].quantity, 2);
        await Product.updateOne({ _id: productId }, { $set: { price: 3199, stock: 2 } });
        const current = await request("GET", "/cart", cookieA);
        assert.equal(current.data.cart[0].product.price, 3199);
        assert.equal(current.data.cart[0].product.stock, 2);
        assert.equal((await request("POST", `/cart/${productId}`, cookieA)).status, 400);
        const relogin = await request("POST", "/customers/login", null, { email: `lab5-${tag}-a@example.com`, password });
        assert.equal((await request("GET", "/cart", relogin.cookie)).data.cart[0].quantity, 2);
        console.log("PASS: quantity validation, live product data and login persistence");

        assert.equal((await request("DELETE", `/cart/${productId}`, cookieB)).status, 404);
        assert.equal((await request("DELETE", `/cart/${productId}`, cookieA)).data.cart.length, 0);
        assert.equal((await request("DELETE", `/cart/${productId}`, cookieA)).status, 404);
        await Product.updateOne({ _id: productId }, { $set: { stock: 3 } });
        const simultaneous = await Promise.all(Array.from({ length: 5 }, () => request("POST", `/cart/${productId}`, cookieA)));
        assert.equal(simultaneous.filter((result) => result.status === 200).length, 3);
        assert.equal((await request("GET", "/cart", cookieA)).data.cart[0].quantity, 3);
        assert.equal((await Customer.collection.findOne({ _id: new mongoose.Types.ObjectId(customerIds[0]) })).cart.length, 1);
        if (process.argv.includes("--postman")) {
            await request("DELETE", `/cart/${productId}`, cookieA);
            const collection = structuredClone(require("../../postman/Lab-05-Cart.postman_collection.json"));
            const variables = { baseUrl: baseURL, email: `lab5-${tag}-a@example.com`, password, productId: productId.toString() };
            for (const variable of collection.variable) if (Object.hasOwn(variables, variable.key)) variable.value = variables[variable.key];
            const summary = await new Promise((resolve, reject) => require("newman").run({ collection, reporters: "cli" }, (error, result) => error ? reject(error) : resolve(result)));
            assert.equal(summary.run.failures.length, 0, "Postman collection must pass");
            await request("POST", `/cart/${productId}`, cookieA);
            console.log("PASS: exported Lab 5 Postman collection");
        }
        await Product.deleteOne({ _id: productId });
        assert.deepEqual((await request("GET", "/cart", cookieA)).data.cart, []);
        assert.equal((await request("DELETE", `/cart/${productId}`, cookieA)).status, 200);
        console.log("PASS: removal, simultaneous saves and deleted-product cleanup");
    } finally {
        await Customer.deleteMany({ _id: { $in: customerIds.map((id) => new mongoose.Types.ObjectId(id)) } });
        await Product.deleteOne({ _id: productId });
        await new Promise((resolve) => server.close(resolve));
        await mongoose.disconnect();
        if (memory) await memory.stop();
    }
}

run().catch(async (error) => {
    console.error(`Cart integration failed while ${phase}: ${error.name} (${error.code || "no error code"})`);
    if (error.name === "AssertionError") console.error(error.message);
    process.exitCode = 1;
});
