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

const allowedOrigins = (
  process.env.CLIENT_URL ||
  "https://fabbyluxe.vercel.app,http://localhost:3000"
)
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin.replace(/\/+$/, ""))) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 204,
  })
);


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
