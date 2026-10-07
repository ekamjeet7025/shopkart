const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const fs = require("node:fs");
const { MongoMemoryServer } = require("mongodb-memory-server");

async function unusedPort() {
    const server = net.createServer();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    await new Promise((resolve) => server.close(resolve));
    return port;
}

async function waitForServer(url, child) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (child.exitCode !== null) throw new Error("Production server exited before becoming ready");
        try {
            const response = await fetch(`${url}/health`);
            if (response.ok) return;
        } catch { /* The database and HTTP server are still starting. */ }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Production server did not become ready");
}

async function main() {
    const cachedBinary = path.join(__dirname, "..", "node_modules", ".cache", "mongodb-memory-server", "mongod-test.exe");
    const mongo = await MongoMemoryServer.create({ binary: fs.existsSync(cachedBinary) ? { systemBinary: cachedBinary } : undefined });
    const port = await unusedPort();
    const baseURL = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, [path.join(__dirname, "..", "index.js")], {
        env: {
            ...process.env,
            NODE_ENV: "production",
            MONGO_URI: mongo.getUri(),
            JWT_SECRET: "deployment-test-only-jwt-secret-32-characters",
            ADMIN_API_KEY: "deployment-test-only-admin-key-32-characters",
            RAZORPAY_KEY_ID: "rzp_test_deployment_check",
            RAZORPAY_KEY_SECRET: "deployment-test-only-razorpay-secret",
            PORT: String(port)
        },
        stdio: "ignore"
    });

    try {
        await waitForServer(baseURL, child);
        const [home, checkout, catalog, blocked] = await Promise.all([
            fetch(baseURL),
            fetch(`${baseURL}/checkout`),
            fetch(`${baseURL}/products`),
            fetch(`${baseURL}/products`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
        ]);
        assert.equal(home.status, 200);
        assert.match(await home.text(), /<div id="root"><\/div>/);
        assert.equal(checkout.status, 200);
        assert.match(await checkout.text(), /<div id="root"><\/div>/);
        assert.equal(catalog.status, 200);
        assert.deepEqual((await catalog.json()).products, []);
        assert.equal(blocked.status, 403);

        const product = await fetch(`${baseURL}/products`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-admin-key": "deployment-test-only-admin-key-32-characters" },
            body: JSON.stringify({ name: "Keyboard", description: "Test", price: 1499, category: "Electronics", image: "/product-placeholder.svg", stock: 2 })
        });
        assert.equal(product.status, 201);
        assert.equal((await (await fetch(`${baseURL}/products`)).json()).products.length, 1);
        console.log("PASS: production server serves React routes and protects the catalog API");
    } finally {
        child.kill();
        await mongo.stop();
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
