// Real HTTP + MongoDB verification. Only uniquely named test records are created
// and removed; existing customers/products are never changed.
const assert = require("node:assert/strict");
const express = require("express");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
require("dns").setServers(["8.8.8.8", "8.8.4.4"]);
require("dotenv").config({ quiet: true });
const Customer = require("../models/customer.model");
const Product = require("../models/product.model");
let memoryServer;

async function run() {
    if (process.argv.includes("--memory")) {
        const { MongoMemoryServer } = require("mongodb-memory-server");
        const cachedBinary = require("path").join(__dirname, "../node_modules/.cache/mongodb-memory-server/mongod-test.exe");
        const binary = require("fs").existsSync(cachedBinary) ? { systemBinary: cachedBinary } : undefined;
        memoryServer = await MongoMemoryServer.create({ binary });
        process.env.JWT_SECRET = "isolated-lab4-test-secret";
        await mongoose.connect(memoryServer.getUri());
    } else {
        if (!process.env.MONGO_URI || !process.env.JWT_SECRET) throw new Error("MONGO_URI and JWT_SECRET are required in backend/.env");
        await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    }
    if (process.argv.includes("--probe")) {
        console.log("MongoDB connection successful");
        await mongoose.disconnect();
        return;
    }

    const app = express();
    app.use(require("cors")({ origin: ["http://localhost:5173", "http://localhost:5174"], credentials: true }));
    app.use(express.json(), cookieParser());
    app.use("/customers", require("../routes/customer.routes"));
    app.use("/products", require("../routes/product.routes"));
    app.use("/wishlist", require("../routes/wishlist.routes"));
    const server = app.listen(process.argv.includes("--browser") ? 3001 : 0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const baseURL = `http://127.0.0.1:${server.address().port}`;
    const productId = new mongoose.Types.ObjectId();
    const customerIds = [];
    const tag = new mongoose.Types.ObjectId().toString();
    const password = "Lab4TestPassword!";
    const request = async (method, path, cookie, body) => {
        const headers = { "Content-Type": "application/json" };
        if (cookie) headers.Cookie = cookie;
        const response = await fetch(baseURL + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
        const data = response.headers.get("content-type")?.includes("application/json")
            ? await response.json() : await response.text();
        return { status: response.status, data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
    };

    try {
        await Product.create({ _id: productId, name: `Lab4 test ${tag}`, description: "Disposable API verification fixture", price: 2999, category: "Electronics", image: "/product-placeholder.svg", stock: 10 });
        const cookies = [];
        for (const suffix of ["a", "b"]) {
            const email = `lab4-${tag}-${suffix}@example.com`;
            const registered = await request("POST", "/customers/register", null, { fullName: "Lab4 Test Customer", email, password, phone: "9999999999" });
            assert.equal(registered.status, 201);
            customerIds.push(registered.data.customer._id);
            const login = await request("POST", "/customers/login", null, { email, password });
            assert.equal(login.status, 200);
            assert.ok(login.cookie);
            cookies.push(login.cookie);
        }
        const [cookieA, cookieB] = cookies;
        if (process.argv.includes("--browser")) {
            console.log("Isolated browser API ready at http://localhost:3001");
            console.log(`Test-only login: lab4-${tag}-a@example.com / ${password}`);
            console.log("Press Ctrl+C to stop and clean up the temporary database.");
            await new Promise((resolve) => process.once("SIGINT", resolve));
            return;
        }
        // Simulate an existing Lab-02 customer with no wishlist field.
        await Customer.collection.updateOne({ _id: new mongoose.Types.ObjectId(customerIds[0]) }, { $unset: { wishlist: "" } });
        assert.equal((await request("GET", "/wishlist", cookieA)).data.count, 0);
        console.log("PASS: registration/login and existing-user compatibility");

        for (const [method, path] of [["GET", "/wishlist"], ["POST", `/wishlist/${productId}`], ["DELETE", `/wishlist/${productId}`]]) {
            assert.equal((await request(method, path)).status, 401);
        }
        for (const method of ["POST", "DELETE"]) assert.equal((await request(method, "/wishlist/invalid", cookieA)).status, 400);
        assert.equal((await request("POST", `/wishlist/${new mongoose.Types.ObjectId()}`, cookieA)).status, 404);
        console.log("PASS: protected endpoints and invalid/missing product validation");

        const additions = await Promise.all([
            request("POST", `/wishlist/${productId}`, cookieA, { userId: customerIds[1] }),
            request("POST", `/wishlist/${productId}`, cookieA),
        ]);
        assert.deepEqual(additions.map((result) => result.status).sort(), [201, 409]);
        assert.equal((await request("POST", `/wishlist/${productId}`, cookieA)).status, 409);
        const stored = await Customer.collection.findOne({ _id: new mongoose.Types.ObjectId(customerIds[0]) });
        assert.equal(stored.wishlist.length, 1);
        assert.ok(stored.wishlist[0] instanceof mongoose.Types.ObjectId);
        console.log("PASS: atomic duplicate prevention and ObjectId-only storage");

        await Product.updateOne({ _id: productId }, { $set: { price: 3199 } });
        const list = await request("GET", "/wishlist", cookieA);
        assert.equal(list.data.count, 1);
        assert.equal(list.data.wishlist[0].price, 3199);
        assert.equal(list.data.wishlist[0].name, `Lab4 test ${tag}`);
        assert.equal(list.data.wishlist[0].stock, 10);
        assert.equal((await request("GET", "/wishlist", cookieB)).data.count, 0);
        assert.equal((await request("DELETE", `/wishlist/${productId}`, cookieB)).status, 404);
        assert.equal((await request("GET", `/wishlist/${customerIds[0]}`, cookieB)).status, 404);
        console.log("PASS: populate returns current product data and isolates customers");

        const relogin = await request("POST", "/customers/login", null, { email: `lab4-${tag}-a@example.com`, password });
        assert.equal((await request("GET", "/wishlist", relogin.cookie)).data.count, 1);
        assert.equal((await request("DELETE", `/wishlist/${productId}`, relogin.cookie)).status, 200);
        assert.equal((await request("DELETE", `/wishlist/${productId}`, relogin.cookie)).status, 404);
        assert.equal((await request("GET", "/wishlist", relogin.cookie)).data.count, 0);
        console.log("PASS: persistence across login, removal, repeated removal and empty state");

        if (process.argv.includes("--postman")) {
            const newman = require("newman");
            const variables = { baseUrl: baseURL, email: `lab4-${tag}-a@example.com`, password, otherEmail: `lab4-${tag}-b@example.com`, otherPassword: password, productId: productId.toString() };
            const collection = structuredClone(require("../../postman/Lab-04-Wishlist.postman_collection.json"));
            for (const variable of collection.variable) {
                if (Object.hasOwn(variables, variable.key)) variable.value = variables[variable.key];
            }
            const summary = await new Promise((resolve, reject) => {
                newman.run({
                    collection,
                    reporters: "cli"
                }, (error, result) => error ? reject(error) : resolve(result));
            });
            assert.equal(summary.run.failures.length, 0, "Postman collection must pass");
            console.log("PASS: exported Postman collection executed with Newman");
        }

        await request("POST", `/wishlist/${productId}`, cookieA);
        await Product.deleteOne({ _id: productId });
        assert.equal((await request("GET", "/wishlist", cookieA)).data.count, 0);
        assert.equal((await request("DELETE", `/wishlist/${productId}`, cookieA)).status, 200);
        console.log("PASS: deleted products do not break wishlist retrieval or removal");
    } finally {
        await Customer.deleteMany({ _id: { $in: customerIds.map((id) => new mongoose.Types.ObjectId(id)) } });
        await Product.deleteOne({ _id: productId });
        await new Promise((resolve) => server.close(resolve));
        await mongoose.disconnect();
        if (memoryServer) await memoryServer.stop();
        console.log("Temporary test records cleaned up");
    }
}

run().catch(async (error) => {
    // Do not print connection errors containing credentials or host details.
    console.error(`Integration verification failed: ${error.name} (${error.code || "no error code"})`);
    if (error.name === "AssertionError") console.error(error.message);
    await mongoose.disconnect();
    if (memoryServer) await memoryServer.stop();
    process.exitCode = 1;
});
