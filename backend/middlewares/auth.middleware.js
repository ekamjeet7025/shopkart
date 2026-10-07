const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const authMiddleware = (req, res, next) => {
    try {
        // The React app uses a cookie; Postman can also send a Bearer token.
        const authorization = req.headers.authorization;
        const bearerToken = authorization?.startsWith("Bearer ")
            ? authorization.slice(7)
            : undefined;
        const token = req.cookies?.token || bearerToken;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Not authenticated"
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        if (!mongoose.isObjectIdOrHexString(decoded.id)) {
            return res.status(401).json({ success: false, message: "Invalid or expired token" });
        }

        req.customerId = decoded.id;

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
};

module.exports = authMiddleware;
