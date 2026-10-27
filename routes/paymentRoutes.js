const express = require("express");
const Order = require("../models/Order");

const router = express.Router();

router.post("/paystack/initialize", async (req, res, next) => {
  try {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      return res.status(503).json({ message: "Paystack secret key is not configured" });
    }
    const { orderId, callbackUrl } = req.body || {};
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.paymentMethod !== "paystack") {
      return res.status(400).json({ message: "This order is not configured for Paystack" });
    }

    const amount = Math.round((order.subtotal + order.deliveryFee) * 100);
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: order.customer.email, amount, reference: order.reference,
        callback_url: callbackUrl,
        metadata: { orderId: String(order._id), orderReference: order.reference }
      })
    });
    const data = await response.json();
    if (!response.ok || !data.status) {
      return res.status(502).json({ message: data.message || "Could not initialize payment" });
    }
    order.paystackReference = order.reference;
    await order.save();
    res.json({ authorizationUrl: data.data.authorization_url, reference: data.data.reference });
  } catch (err) { next(err); }
});

router.get("/paystack/verify/:reference", async (req, res, next) => {
  try {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      return res.status(503).json({ message: "Paystack secret key is not configured" });
    }
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(req.params.reference)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );
    const data = await response.json();
    if (!response.ok || !data.status) {
      return res.status(502).json({ message: data.message || "Could not verify payment" });
    }

    const transaction = data.data;
    const order = await Order.findOne({ reference: req.params.reference });
    if (!order) return res.status(404).json({ message: "Order not found" });

    const expected = Math.round((order.subtotal + order.deliveryFee) * 100);
    if (transaction.status !== "success" ||
        transaction.amount !== expected ||
        transaction.currency !== "NGN" ||
        transaction.customer?.email?.toLowerCase() !== order.customer.email.toLowerCase()) {
      return res.status(400).json({ message: "Payment is not verified against this order" });
    }

    order.paymentStatus = "paid";
    order.orderStatus = "processing";
    await order.save();
    res.json({
      verified: true, reference: order.reference,
      paymentStatus: order.paymentStatus, orderStatus: order.orderStatus
    });
  } catch (err) { next(err); }
});

module.exports = router;
