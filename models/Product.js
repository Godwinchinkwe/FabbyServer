const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, trim: true, index: true },
  description: { type: String, default: "" },
  category: { type: String, default: "uncategorized", trim: true, lowercase: true, index: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
  price: { type: Number, required: true, min: 0 },
  oldPrice: { type: Number, min: 0, default: null },
  compareAtPrice: { type: Number, min: 0, default: null },
  image: { type: String, default: "" },
  images: { type: [String], default: [] },
  sku: { type: String, unique: true, sparse: true, trim: true },
  stock: { type: Number, default: 0, min: 0 },
  sizes: { type: [String], default: [] },
  colors: { type: [String], default: [] },
  featured: { type: Boolean, default: false },
  newArrival: { type: Boolean, default: false },
  bestSeller: { type: Boolean, default: false },
  badge: { type: String, enum: ["none", "new", "sale", "bestseller"], default: "none" },
  status: { type: String, enum: ["published", "draft"], default: "published" },
  active: { type: Boolean, default: true },
  inStock: { type: Boolean, default: true },
  rating: { type: Number, default: 0 },
  reviews: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  specifications: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

productSchema.pre("validate", function(next) {
  if (!this.slug && this.name) {
    this.slug = this.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  if (this.oldPrice == null && this.compareAtPrice != null) this.oldPrice = this.compareAtPrice;
  if (this.compareAtPrice == null && this.oldPrice != null) this.compareAtPrice = this.oldPrice;
  if (!this.image && this.images && this.images.length) this.image = this.images[0];
  if (this.image && (!this.images || !this.images.length)) this.images = [this.image];
  if (this.stock <= 0) this.inStock = false;
  else if (this.inStock === undefined || this.inStock === null) this.inStock = true;
  next();
});

module.exports = mongoose.models.Product || mongoose.model("Product", productSchema);
