const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const Product = require("../models/Product");
const Category = require("../models/Category");
const auth = require("../middleware/auth");

const router = express.Router();
const slugify = (value) => String(value || "").toLowerCase().trim()
  .replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function normalizePayload(body) {
  const payload = { ...body };
  if (payload.name) payload.slug = slugify(payload.name);
  if (payload.category && typeof payload.category === "string") payload.category = slugify(payload.category);
  if (payload.price !== undefined) payload.price = Number(payload.price);
  if (payload.oldPrice === "" || payload.oldPrice === undefined) payload.oldPrice = null;
  else if (payload.oldPrice !== null) payload.oldPrice = Number(payload.oldPrice);
  if (payload.compareAtPrice === "" || payload.compareAtPrice === undefined) payload.compareAtPrice = payload.oldPrice;
  if (payload.stock !== undefined) payload.stock = Number(payload.stock);
  if (payload.image) payload.images = Array.isArray(payload.images) && payload.images.length ? payload.images : [payload.image];
  if (payload.images && !payload.image) payload.image = payload.images[0] || "";
  if (payload.sizes && typeof payload.sizes === "string") payload.sizes = payload.sizes.split(",").map(v => v.trim()).filter(Boolean);
  if (payload.colors && typeof payload.colors === "string") payload.colors = payload.colors.split(",").map(v => v.trim()).filter(Boolean);
  if (payload.badge === "sales") payload.badge = "sale";
  if (payload.badge === "new") payload.newArrival = payload.newArrival !== undefined ? payload.newArrival : true;
  if (payload.badge === "bestseller") payload.bestSeller = payload.bestSeller !== undefined ? payload.bestSeller : true;
  if (payload.status === "draft") payload.active = false;
  else if (payload.status === "published") payload.active = true;
  return payload;
}

router.get("/", auth, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status === "published") filter.status = "published";
    if (req.query.status === "draft") filter.status = "draft";
    if (req.query.search) filter.name = { $regex: String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const products = await Product.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ products: products.map(p => ({ ...p, id: String(p._id), image: p.image || p.images?.[0] || "", oldPrice: p.oldPrice ?? p.compareAtPrice ?? null })) });
  } catch (err) { next(err); }
});

router.get("/:id", auth, async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ product: { ...product, image: product.image || product.images?.[0] || "", oldPrice: product.oldPrice ?? product.compareAtPrice ?? null } });
  } catch (err) { next(err); }
});

router.post("/", auth, async (req, res, next) => {
  try {
    const payload = normalizePayload(req.body);
    if (payload.category && payload.category !== "uncategorized") {
      const category = await Category.findOne({ slug: payload.category });
      if (!category) return res.status(400).json({ message: "Select a valid product category." });
      payload.categoryId = category._id;
    } else if (payload.category === "uncategorized") {
      payload.categoryId = null;
    }
    const product = await Product.create(payload);
    res.status(201).json({ product });
  } catch (err) { next(err); }
});

router.post("/import-legacy", auth, async (req, res, next) => {
  try {
    if (!Array.isArray(req.body.products) || req.body.products.length > 300) {
      return res.status(400).json({ message: "Send a products array with no more than 300 products." });
    }
    const categories = new Map();
    for (const item of req.body.products) {
      const name = String(item.category || "uncategorized").trim();
      if (name.toLowerCase() === "uncategorized") continue;
      const slug = slugify(name);
      if (!categories.has(slug)) {
        let category = await Category.findOne({ slug });
        if (!category) category = await Category.create({ name: name.charAt(0).toUpperCase() + name.slice(1), slug });
        categories.set(slug, category);
      }
    }
    let imported = 0, skipped = 0;
    for (const item of req.body.products) {
      const name = String(item.name || "").trim();
      if (!name) { skipped++; continue; }
      const slug = slugify(name);
      const exists = await Product.findOne({ name, category: slugify(item.category || "uncategorized") });
      if (exists) { skipped++; continue; }
      const image = item.image || (Array.isArray(item.images) ? item.images[0] : "");
      await Product.create(normalizePayload({
        name, slug, description: item.description || "", category: slugify(item.category || "uncategorized"),
        price: Number(item.price || 0), oldPrice: item.oldPrice ?? null, image, images: image ? [image] : [],
        stock: item.stock ?? (item.inStock === false ? 0 : 10), rating: item.rating || 0,
        reviews: item.reviews || 0, featured: Boolean(item.featured), badge: ["new", "sale", "bestseller"].includes(item.badge) ? item.badge : "none",
        newArrival: item.badge === "new", bestSeller: item.badge === "bestseller",
        status: "published", active: true, specifications: item.specifications || {}
      }));
      imported++;
    }
    res.json({ ok: true, imported, skipped, message: `Imported ${imported} products; skipped ${skipped} existing or invalid products.` });
  } catch (err) { next(err); }
});

router.post("/upload", auth, async (req, res, next) => {
  try {
    const { imageData, fileName = "product-image.jpg", mimeType = "image/jpeg" } = req.body || {};
    if (!imageData || typeof imageData !== "string") {
      return res.status(400).json({ message: "Choose an image file first." });
    }
    if (!/^image\/(jpeg|png|webp|gif)$/.test(mimeType)) {
      return res.status(400).json({ message: "Upload a JPG, PNG, WEBP, or GIF image." });
    }
    const match = imageData.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return res.status(400).json({ message: "The image data is invalid." });
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > 5 * 1024 * 1024) return res.status(413).json({ message: "Each image must be 5MB or smaller." });

    const hasCloudinary = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;
    if (process.env.NODE_ENV === "production" && !hasCloudinary) {
      return res.status(503).json({ message: "Image uploads need Cloudinary configured in the backend environment. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET." });
    }
    if (hasCloudinary) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const folder = "fabby-luxe/products";
      const signatureBase = `folder=${folder}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`;
      const signature = crypto.createHash("sha1").update(signatureBase).digest("hex");
      const form = new FormData();
      form.append("file", new Blob([buffer], { type: mimeType }), path.basename(fileName));
      form.append("api_key", process.env.CLOUDINARY_API_KEY);
      form.append("timestamp", timestamp);
      form.append("folder", folder);
      form.append("signature", signature);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: form
      });
      const result = await response.json();
      if (!response.ok) return res.status(502).json({ message: result.error?.message || "Cloudinary could not store the image." });
      return res.status(201).json({ url: result.secure_url });
    }

    const uploadDir = path.join(__dirname, "..", "uploads");
    fs.mkdirSync(uploadDir, { recursive: true });
    const ext = (path.extname(fileName).toLowerCase() || ".jpg").replace(/[^.a-z0-9]/g, "");
    const filename = `${crypto.randomUUID()}${ext}`;
    fs.writeFileSync(path.join(uploadDir, filename), buffer);
    return res.status(201).json({ url: `${req.protocol}://${req.get("host")}/uploads/${filename}` });
  } catch (err) { next(err); }
});

router.patch("/:id", auth, async (req, res, next) => {
  try {
    const payload = normalizePayload(req.body);
    if (payload.category && payload.category !== "uncategorized") {
      const category = await Category.findOne({ slug: payload.category });
      if (!category) return res.status(400).json({ message: "Select a valid product category." });
      payload.categoryId = category._id;
    } else if (payload.category === "uncategorized") {
      payload.categoryId = null;
    }
    const product = await Product.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ product });
  } catch (err) { next(err); }
});

router.delete("/:id", auth, async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { active: false, status: "draft" }, { new: true });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
