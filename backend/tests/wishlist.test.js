const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const Customer = require("../models/customer.model");
const Product = require("../models/product.model");
const wishlistRoutes = require("../routes/wishlist.routes");

test("wishlist HTTP contract, JWT isolation, validation and failure states", async (t) => {
    // These tests exercise the real router/middleware/controller with a small
    // fake database. The separate integration script checks real MongoDB.
    const oldSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "lab4-test-only-secret";
    const customerId = "507f1f77bcf86cd799439011";
    const otherId = "507f1f77bcf86cd799439012";
    const productId = "507f1f77bcf86cd799439013";
    const missingId = "507f1f77bcf86cd799439014";
    const deletedCustomerId = "507f1f77bcf86cd799439015";
    const product = { _id: productId, name: "Keyboard", price: 2999, category: "Electronics", image: "/keyboard.jpg", stock: 10 };
    const lists = new Map([[customerId, []], [otherId, []]]);
    let failDatabase = false;
    let lastPopulate;

    t.mock.method(Product, "exists", async ({ _id }) => {
        if (failDatabase) throw new Error("Test database unavailable");
        return _id === productId ? { _id } : null;
    });
    t.mock.method(Customer, "exists", async ({ _id }) => lists.has(_id) ? { _id } : null);
    t.mock.method(Customer, "updateOne", async (query, update) => {
        if (failDatabase) throw new Error("Test database unavailable");
        const list = lists.get(query._id);
        if (!list) return { modifiedCount: 0 };
        if (update.$addToSet) {
            assert.equal(query.wishlist.$ne, productId);
            if (list.includes(productId)) return { modifiedCount: 0 };
            list.push(productId);
        } else {
            assert.equal(query.wishlist, productId);
            if (!list.includes(productId)) return { modifiedCount: 0 };
            lists.set(query._id, list.filter((id) => id !== productId));
        }
        return { modifiedCount: 1 };
    });
    t.mock.method(Customer, "findById", (id) => ({
        select: (fields) => {
            assert.equal(fields, "wishlist");
            return { populate: async (options) => {
                if (failDatabase) throw new Error("Test database unavailable");
                lastPopulate = options;
                return lists.has(id) ? { wishlist: lists.get(id).map(() => product) } : null;
            } };
        }
    }));
    t.mock.method(console, "error", () => {});

    const app = express();
    app.use(express.json(), cookieParser());
    app.use("/wishlist", wishlistRoutes);
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        if (oldSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = oldSecret;
    });
    const baseURL = `http://127.0.0.1:${server.address().port}`;
    const token = (id, options = {}) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1h", ...options });
    const request = async (method, path, customer = customerId, body) => {
        const headers = { "Content-Type": "application/json" };
        if (customer) headers.Cookie = `token=${token(customer)}`;
        const response = await fetch(baseURL + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
        const data = response.headers.get("content-type")?.includes("application/json")
            ? await response.json() : await response.text();
        return { status: response.status, data };
    };

    for (const [method, path] of [["GET", "/wishlist"], ["POST", `/wishlist/${productId}`], ["DELETE", `/wishlist/${productId}`]]) {
        assert.equal((await request(method, path, null)).status, 401);
    }
    for (const method of ["POST", "DELETE"]) {
        assert.equal((await request(method, "/wishlist/not-an-id")).status, 400);
    }
    assert.equal((await request("POST", `/wishlist/${missingId}`)).status, 404);
    const empty = await request("GET", "/wishlist");
    assert.deepEqual(empty.data, { success: true, count: 0, wishlist: [] });
    assert.equal(lastPopulate.path, "wishlist");
    assert.equal(lastPopulate.select, "name price category image stock");

    // Ignore a malicious client-provided userId.
    assert.equal((await request("POST", `/wishlist/${productId}`, customerId, { userId: otherId })).status, 201);
    assert.equal((await request("POST", `/wishlist/${productId}`)).status, 409);
    assert.equal((await request("GET", "/wishlist")).data.count, 1);
    assert.equal((await request("GET", "/wishlist", otherId)).data.count, 0);
    assert.equal((await request("DELETE", `/wishlist/${productId}`, otherId)).status, 404);
    assert.equal((await request("GET", `/wishlist/${customerId}`, otherId)).status, 404);
    assert.equal((await request("DELETE", `/wishlist/${productId}`)).status, 200);
    assert.equal((await request("DELETE", `/wishlist/${productId}`)).status, 404);
    assert.equal((await request("GET", "/wishlist")).data.count, 0);

    const concurrent = await Promise.all([request("POST", `/wishlist/${productId}`), request("POST", `/wishlist/${productId}`)]);
    assert.deepEqual(concurrent.map((response) => response.status).sort(), [201, 409]);
    assert.equal((await request("GET", "/wishlist")).data.count, 1);
    assert.equal((await request("GET", "/wishlist", deletedCustomerId)).status, 401);
    for (const method of ["POST", "DELETE"]) assert.equal((await request(method, `/wishlist/${productId}`, deletedCustomerId)).status, 401);

    const bearer = await fetch(baseURL + "/wishlist", { headers: { Authorization: `Bearer ${token(customerId)}` } });
    assert.equal(bearer.status, 200);
    for (const invalidToken of ["invalid", token(customerId, { expiresIn: -1 }), token("not-an-id")]) {
        assert.equal((await fetch(baseURL + "/wishlist", { headers: { Cookie: `token=${invalidToken}` } })).status, 401);
    }
    failDatabase = true;
    for (const [method, path] of [["GET", "/wishlist"], ["POST", `/wishlist/${productId}`], ["DELETE", `/wishlist/${productId}`]]) {
        assert.equal((await request(method, path)).status, 500);
    }
});

test("old customers default to an empty Product-reference array", () => {
    const customer = new Customer({ fullName: "Test", email: "test@example.com", password: "hashed", phone: "123" });
    assert.deepEqual(customer.wishlist.toObject(), []);
    assert.equal(Customer.schema.path("wishlist").embeddedSchemaType.options.ref, "Product");
});
