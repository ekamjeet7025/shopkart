const dns = require("dns");
const path = require("path");
const fs = require("fs");

// Keep the local DNS workaround, but use the hosting provider's DNS in production.
if (process.env.NODE_ENV !== "production") dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const customerRoutes = require("./routes/customer.routes");
const productRoutes = require("./routes/product.routes");
const wishlistRoutes = require("./routes/wishlist.routes");
const cartRoutes = require("./routes/cart.routes");
const orderRoutes = require("./routes/order.routes");

const app = express();

const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && (!process.env.MONGO_URI || !process.env.JWT_SECRET || !process.env.ADMIN_API_KEY || !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)) {
    throw new Error("Missing required deployment environment variables. Check the README setup list.");
}
if (isProduction && (process.env.JWT_SECRET.length < 32 || process.env.ADMIN_API_KEY.length < 32)) {
    throw new Error("JWT_SECRET and ADMIN_API_KEY must each have at least 32 characters.");
}
if (isProduction && !process.env.RAZORPAY_KEY_ID.startsWith("rzp_test_")) {
    throw new Error("This project requires a Razorpay Test Mode key ID.");
}

// Middleware

if (!isProduction) app.use(cors({ origin: "http://localhost:5173", credentials: true }));

app.use(express.json());

app.use(cookieParser());

// Customer routes

app.use("/customers", customerRoutes);

// Product routes
app.use("/products", productRoutes);
app.use("/wishlist", wishlistRoutes);
app.use("/cart", cartRoutes);
app.use("/orders", orderRoutes);
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Render serves the built React app and API on the same domain.
if (isProduction) {
    const frontendDist = path.join(__dirname, "..", "frontend", "dist");
    if (!fs.existsSync(path.join(frontendDist, "index.html"))) {
        throw new Error("Frontend build is missing. Build frontend before starting the server.");
    }
    app.use(express.static(frontendDist));
    app.use((req, res, next) => {
        if (req.method !== "GET" || !req.accepts("html")) return next();
        res.sendFile(path.join(frontendDist, "index.html"));
    });
}

// Start accepting requests only after the database is ready.
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected");
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error("MongoDB connection failed:", error.message);
        process.exitCode = 1;
    });
