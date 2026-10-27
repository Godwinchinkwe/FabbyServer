function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.name === "ValidationError" || err.code === 11000) {
    return res.status(400).json({ message: err.message });
  }

  return res.status(err.status || 500).json({
    message: process.env.NODE_ENV === "production"
      ? "Request failed"
      : (err.message || "Internal server error")
  });
}

module.exports = errorHandler;
