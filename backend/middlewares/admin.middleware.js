const crypto = require("crypto");

const requireAdminKey = (req, res, next) => {
    // Product creation is open for local practice, but protected on the public site.
    if (process.env.NODE_ENV !== "production") return next();

    const expected = process.env.ADMIN_API_KEY;
    const provided = req.get("x-admin-key");
    if (!expected || !provided) {
        return res.status(403).json({ success: false, message: "Admin key required" });
    }

    const expectedHash = crypto.createHash("sha256").update(expected).digest();
    const providedHash = crypto.createHash("sha256").update(provided).digest();
    if (!crypto.timingSafeEqual(expectedHash, providedHash)) {
        return res.status(403).json({ success: false, message: "Admin key required" });
    }

    next();
};

module.exports = requireAdminKey;
