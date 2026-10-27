const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");
const Order = require("../models/Order");

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD_HASH || !process.env.JWT_SECRET) {
    return res.status(503).json({ message: "Admin credentials are not configured in server environment" });
  }

  const emailMatches = String(email || "").toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();
  const passwordMatches = await bcrypt.compare(String(password || ""), process.env.ADMIN_PASSWORD_HASH);
  if (!emailMatches || !passwordMatches) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { email: process.env.ADMIN_EMAIL, role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
  res.json({ token, admin: { email: process.env.ADMIN_EMAIL, role: "admin" } });
});

router.get("/orders", auth, async (req, res, next) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(250).lean();
    res.json({ orders });
  } catch (err) { next(err); }
});

router.patch("/orders/:id", auth, async (req, res, next) => {
  try {
    const allowed = ["pending-confirmation", "processing", "dispatched", "delivered", "cancelled"];
    if (!allowed.includes(req.body.orderStatus)) {
      return res.status(400).json({ message: "Invalid order status" });
    }
    const order = await Order.findByIdAndUpdate(
      req.params.id, { orderStatus: req.body.orderStatus }, { new: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({ order });
  } catch (err) { next(err); }
});

module.exports = router;
