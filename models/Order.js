const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  reference: { type: String, unique: true, index: true },
  customer: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true }
  },
  items: [{
    productId: String,
    name: String,
    price: Number,
    quantity: Number,
    image: String
  }],
  subtotal: { type: Number, required: true },
  deliveryFee: { type: Number, default: 0 },
  deliveryMethod: { type: String, enum: ["delivery", "pickup"], required: true },
  address: String,
  city: String,
  paymentMethod: { type: String, enum: ["paystack", "bank-transfer", "whatsapp"], required: true },
  paymentStatus: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
  orderStatus: {
    type: String,
    enum: ["pending-confirmation", "processing", "dispatched", "delivered", "cancelled"],
    default: "pending-confirmation"
  },
  paystackReference: String,
  notes: String
}, { timestamps: true });

module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);
