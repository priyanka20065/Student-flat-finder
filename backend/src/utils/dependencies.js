const crypto = require("crypto")
const { MongoClient } = require("mongodb")
const nodemailer = require("nodemailer")
const multer = require("multer")
const { uploadsDir } = require("../config/paths")

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, uploadsDir)
    },
    filename: (_req, file, callback) => {
      const extension = require("path").extname(file.originalname || "").toLowerCase() || ".jpg"
      const safeName = require("path")
        .basename(file.originalname || "image", extension)
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, "-")
        .slice(0, 32)
      callback(null, `${safeName || "image"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`)
    },
  }),
  fileFilter: (_req, file, callback) => {
    if (String(file.mimetype || "").startsWith("image/")) {
      callback(null, true)
      return
    }
    callback(new Error("Only image files are allowed"))
  },
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
})

module.exports = {
  crypto,
  MongoClient,
  nodemailer,
  imageUpload
}
