const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const bcrypt = require("bcrypt");
const Customer = require("../models/customer.model");
const Product = require("../models/product.model");
const customerRoutes = require("../routes/customer.routes");
const productRoutes = require("../routes/product.routes");

test("production login cookie and product creation protection", async (t) => {
    const previous = {
        NODE_ENV: process.env.NODE_ENV,
        JWT_SECRET: process.env.JWT_SECRET,
        ADMIN_API_KEY: process.env.ADMIN_API_KEY
    };
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "test-only-jwt-secret-at-least-32-chars";
    process.env.ADMIN_API_KEY = "test-only-admin-key-at-least-32-chars";
    t.after(() => {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });

    t.mock.method(Customer, "findOne", async () => ({
        _id: "507f1f77bcf86cd799439011",
        fullName: "Test Customer",
        email: "test@example.com",
        phone: "9876543210",
        password: "hashed"
    }));
    t.mock.method(bcrypt, "compare", async () => true);
    t.mock.method(Product, "create", async (details) => ({ _id: "507f1f77bcf86cd799439012", ...details }));

    const app = express();
    app.use(express.json());
    app.use("/customers", customerRoutes);
    app.use("/products", productRoutes);
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const baseURL = `http://127.0.0.1:${server.address().port}`;

    const login = await fetch(`${baseURL}/customers/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com", password: "password" })
    });
    assert.equal(login.status, 200);
    assert.match(login.headers.get("set-cookie"), /; Secure;/);
    assert.match(login.headers.get("set-cookie"), /; HttpOnly/);
    assert.match(login.headers.get("set-cookie"), /; SameSite=Lax/);

    const product = { name: "Keyboard", description: "Test", price: 1499, category: "Electronics", image: "/product-placeholder.svg", stock: 2 };
    const create = (key) => fetch(`${baseURL}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(key ? { "x-admin-key": key } : {}) },
        body: JSON.stringify(product)
    });
    assert.equal((await create()).status, 403);
    assert.equal((await create("wrong-key")).status, 403);
    assert.equal((await create(process.env.ADMIN_API_KEY)).status, 201);
});
