const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");

const router = express.Router();

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function publicProduct(p) {
  const product = p.toObject ? p.toObject() : p;
  return {
    ...product,
    id: String(product._id || product.id),
    image: product.image || (product.images && product.images[0]) || "",
    oldPrice: product.oldPrice ?? product.compareAtPrice ?? null,
    reviews: product.reviews ?? product.reviewCount ?? 0,
    inStock: product.stock > 0 && product.inStock !== false,
    badge: product.badge || (product.bestSeller ? "bestseller" : product.newArrival ? "new" : product.oldPrice && product.oldPrice > product.price ? "sale" : "none")
  };
}

router.get("/", async (req, res, next) => {
  try {
    const filter = { active: true, status: { $ne: "draft" } };
    if (req.query.category) filter.category = String(req.query.category).toLowerCase();
    if (req.query.q) {
      const query = new RegExp(escapeRegex(req.query.q), "i");
      filter.$or = [{ name: query }, { description: query }];
    }
    if (req.query.featured === "true") filter.featured = true;
    if (req.query.newArrival === "true") filter.newArrival = true;
    if (req.query.bestSeller === "true") filter.bestSeller = true;
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 200));
    const products = await Product.find(filter).sort({ featured: -1, createdAt: -1 }).limit(limit).lean();
    res.json({ products: products.map(publicProduct) });
  } catch (err) { next(err); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const filter = { active: true, status: { $ne: "draft" } };
    let product;
    if (mongoose.isValidObjectId(req.params.id)) {
      product = await Product.findOne({ ...filter, _id: req.params.id });
    } else {
      product = await Product.findOne({ ...filter, slug: req.params.id });
      if (!product) product = await Product.findOne({ ...filter, _id: req.params.id });
    }
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ product: publicProduct(product) });
  } catch (err) { next(err); }
});

module.exports = router;
