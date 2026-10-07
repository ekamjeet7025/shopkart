const Product = require("../models/product.model");


// Create Product
const createProduct = async (req, res) => {
    try {
        const {
            name,
            description,
            price,
            category,
            image,
            stock
        } = req.body;

        // Check required fields
        if (
            !name ||
            !description ||
            price === undefined ||
            !category ||
            !image ||
            stock === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        // Validate price
        if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
            return res.status(400).json({
                success: false,
                message: "Price must be a number greater than 0"
            });
        }

        // Validate stock
        if (typeof stock !== "number" || !Number.isFinite(stock) || stock < 0) {
            return res.status(400).json({
                success: false,
                message: "Stock must be a non-negative number"
            });
        }

        // Create product
        const product = await Product.create({
            name,
            description,
            price,
            category,
            image,
            stock
        });

        return res.status(201).json({
            success: true,
            message: "Product created successfully",
            product
        });

    } catch (error) {
        console.log("Create product error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// Get All Products
const getAllProducts = async (req, res) => {
    try {

        const { search, category } = req.query;

        // Create an empty query
        const query = {};

        // Search by name, category, or description
        if (search) {
            query.$or = [
                {
                    name: {
                        $regex: search,
                        $options: "i"
                    }
                },
                {
                    category: {
                        $regex: search,
                        $options: "i"
                    }
                },
                {
                    description: {
                        $regex: search,
                        $options: "i"
                    }
                }
            ];
        }

        // Filter by category
        if (category) {
            query.category = category;
        }

        // Find products
        const products = await Product.find(query);

        return res.status(200).json({
            success: true,
            count: products.length,
            products
        });

    } catch (error) {
        console.log("Get products error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// Get Single Product
const getSingleProduct = async (req, res) => {
    try {

        const { id } = req.params;

        const product = await Product.findById(id);

        // Product not found
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        return res.status(200).json({
            success: true,
            product
        });

    } catch (error) {
        console.log("Get single product error:", error);

        return res.status(400).json({
            success: false,
            message: "Invalid product ID"
        });
    }
};


module.exports = {
    createProduct,
    getAllProducts,
    getSingleProduct
};
