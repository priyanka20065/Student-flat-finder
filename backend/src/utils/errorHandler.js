// Utility for error handling middleware

function errorHandler(error, _req, res, next) {
  if (!error) {
    next()
    return
  }
  if (error.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ message: "Image is too large. Please upload files up to 25MB each." })
    return
  }
  if (error.name === "MulterError") {
    res.status(400).json({ message: error.message || "Image upload failed" })
    return
  }
  if (String(_req.path || "").startsWith("/api")) {
    res.status(500).json({ message: error.message || "Server error" })
    return
  }
  next(error)
}

module.exports = errorHandler
