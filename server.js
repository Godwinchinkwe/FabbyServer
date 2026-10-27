require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const path = require("path");

const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");
const productRoutes = require("./routes/productRoutes");
const adminRoutes = require("./routes/adminRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const categoryRoutes = require("./routes/categoryRoutes");

const app = express();

app.get("/", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "FABBY LUXE API",
    message: "API server is running",
    health: "/api/health"
  });
});

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin: (process.env.CLIENT_URL || "http://localhost:3000")
    .split(",").map(value => value.trim()),
  credentials: true
}));
app.use(express.json({ limit: "8mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false
}));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "FABBY LUXE API",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

app.use("/api/products", productRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/products", require("./routes/adminProductRoutes"));
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);

app.use(errorHandler);

const port = Number(process.env.PORT) || 5000;
connectDB()
  .then(() => app.listen(port, () => console.log(`FABBY LUXE API listening on ${port}`)))
  .catch(err => {
    console.error("MongoDB connection failed. Check MONGODB_URI in server environment.", err.message);
    process.exit(1);
  });
