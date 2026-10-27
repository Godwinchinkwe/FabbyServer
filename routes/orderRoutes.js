const express = require("express");
const Product = require("../models/Product");
const Order = require("../models/Order");

const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    const {
      customer, items, deliveryMethod, address, city,
      paymentMethod, deliveryFee = 0, notes
    } = req.body || {};

    if (!customer?.name || !customer?.email || !customer?.phone ||
        !Array.isArray(items) || !items.length) {
      return res.status(400).json({
        message: "Customer details and at least one item are required"
      });
    }
    if (!["delivery", "pickup"].includes(deliveryMethod) ||
        !["paystack", "bank-transfer", "whatsapp"].includes(paymentMethod)) {
      return res.status(400).json({ message: "Invalid delivery or payment method" });
    }
    if (deliveryMethod === "delivery" && (!address || !city)) {
      return res.status(400).json({ message: "Delivery address and city are required" });
    }

    const ids = items.map(item => String(item.productId));
    const dbProducts = await Product.find({ _id: { $in: ids }, active: true }).lean();
    if (dbProducts.length !== new Set(ids).size) {
      return res.status(400).json({ message: "One or more products are unavailable" });
    }

    let subtotal = 0;
    const safeItems = items.map(item => {
      const product = dbProducts.find(p => String(p._id) === String(item.productId));
      const quantity = Math.max(1, Math.min(50, Math.floor(Number(item.quantity) || 1)));
      if (product.stock < quantity) {
        const error = new Error(`Insufficient stock for ${product.name}`);
        error.status = 409;
        throw error;
      }
      subtotal += product.price * quantity;
      return {
        productId: String(product._id), name: product.name, price: product.price,
        quantity, image: product.images?.[0] || ""
      };
    });

    const order = await Order.create({
      reference: "FL-" + Date.now().toString(36).toUpperCase(),
      customer, items: safeItems, subtotal,
      deliveryFee: deliveryMethod === "pickup" ? 0 : Math.max(0, Number(deliveryFee) || 0),
      deliveryMethod, address, city, paymentMethod, notes
    });

    res.status(201).json({
      order: {
        id: order._id, reference: order.reference, subtotal: order.subtotal,
        deliveryFee: order.deliveryFee, paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus
      }
    });
  } catch (err) { next(err); }
});

module.exports = router;
