const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const Product = require("../models/product.model");
const customerRoutes = require("../routes/customer.routes");
const productRoutes = require("../routes/product.routes");

test("logout requires a valid login and clears its cookie", async (t) => {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "submission-test-only-secret";

    const app = express();
    app.use(cookieParser());
    app.use("/customers", customerRoutes);
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        if (previousSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = previousSecret;
    });

    const url = `http://127.0.0.1:${server.address().port}/customers/logout`;
    const anonymous = await fetch(url, { method: "POST" });
    assert.equal(anonymous.status, 401);

    const token = jwt.sign({ id: "507f1f77bcf86cd799439011" }, process.env.JWT_SECRET);
    const authenticated = await fetch(url, {
        method: "POST",
        headers: { Cookie: `token=${token}` }
    });
    assert.equal(authenticated.status, 200);
    assert.match(authenticated.headers.get("set-cookie"), /token=;/);
});

test("product creation rejects invalid price and stock as client errors", async (t) => {
    const create = t.mock.method(Product, "create", async (product) => product);
    const app = express();
    app.use(express.json());
    app.use("/products", productRoutes);
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));

    const url = `http://127.0.0.1:${server.address().port}/products`;
    const product = {
        name: "Keyboard",
        description: "Mechanical keyboard",
        price: 2999,
        category: "Electronics",
        image: "/keyboard.jpg",
        stock: 5
    };
    const request = (changes) => fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...product, ...changes })
    });

    for (const changes of [
        { price: "abc" }, { price: "2999" }, { price: 0 },
        { stock: "abc" }, { stock: "5" }, { stock: -1 }
    ]) {
        const response = await request(changes);
        assert.equal(response.status, 400, JSON.stringify(changes));
    }
    assert.equal(create.mock.callCount(), 0);
    assert.equal((await request({ stock: 0 })).status, 201);
    assert.equal(create.mock.callCount(), 1);
});
