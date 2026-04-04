// MVC Refactored: Server Setup
require("dotenv").config()
const express = require("express")
const cors = require("cors")
const crypto = require("crypto")

// Config & File Upload dependencies
const { uploadsDir } = require("./config/paths")
const smtpConfig = require("./config/smtp")
const { razorpayEnabled, razorpay } = require("./config/razorpay")
const { imageUpload } = require("./utils/dependencies")

// Generic utility dependencies
const userUtils = require("./utils/userUtils")
const geoUtils = require("./utils/geoUtils")
const mongoUtils = require("./utils/mongoUtils")
const metricsUtils = require("./utils/metricsUtils")
const distanceUtils = require("./utils/distanceUtils")
const eventUtils = require("./utils/eventUtils")
const profileUtils = require("./utils/profileUtils")
const errorHandler = require("./utils/errorHandler")

// State/Model Store Layer
const store = require("./models/store")

const app = express()
app.use(cors())
const PORT = process.env.PORT || 4000

app.use(express.json())

const staticNoCacheOptions = {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
    res.setHeader("Pragma", "no-cache")
    res.setHeader("Expires", "0")
    res.setHeader("Surrogate-Control", "no-store")
    res.setHeader("Access-Control-Allow-Origin", "*");
  },
}
// Add CORS headers for /uploads static files
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
}, express.static(uploadsDir, staticNoCacheOptions));

// App Socket/Event State
const browseSubscribers = new Set()
const chatSubscribers = {}

function getSmtpTransportOptions() {
  const timeoutMs = Number(process.env.SMTP_TIMEOUT_MS || 15000)
  const base = {
    host: smtpConfig.host,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
    tls: {
      minVersion: "TLSv1.2",
    },
  }

  const attempts = [
    {
      ...base,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
    },
  ]

  // Gmail frequently works better on 465 from cloud hosts when 587 is throttled.
  if (String(smtpConfig.host || "").toLowerCase() === "smtp.gmail.com") {
    attempts.push({ ...base, port: 465, secure: true })
    attempts.push({ ...base, port: 587, secure: false })
  }

  const deduped = []
  const seen = new Set()
  attempts.forEach((item) => {
    const key = `${item.host}:${item.port}:${item.secure}`
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(item)
    }
  })

  return deduped
}

// Mailer Service Setup
const mailEnabled = Boolean(smtpConfig.host && smtpConfig.user && smtpConfig.pass)
const sendEmail = async ({ to, subject, text, html }) => {
  if (!mailEnabled) return false
  const nodemailer = require("nodemailer")
  let lastError = null

  const transports = getSmtpTransportOptions()
  for (const transportOptions of transports) {
    try {
      const transporter = nodemailer.createTransport(transportOptions)
      await transporter.sendMail({ from: smtpConfig.from, to, subject, text, html })
      return true
    } catch (error) {
      lastError = error
    }
  }

  try {
    const reason = String(lastError?.message || "Unknown email transport failure")
    console.error("Email send failed:", reason)
    return false
  } catch (error) {
    console.error("Email send failed:", error.message)
    return false
  }
}

function pushSseEvent(response, event, data) {
  response.write(`event: ${event}\n`)
  response.write(`data: ${JSON.stringify(data)}\n\n`)
}

function broadcastBrowseUpdate(type) {
  for (const client of browseSubscribers) {
    pushSseEvent(client, "browse-update", { type, time: Date.now() })
  }
}

function broadcastChatUpdate(flatId, message) {
  const subscribers = chatSubscribers[flatId] || new Set()
  for (const client of subscribers) {
    pushSseEvent(client, "chat-message", message)
  }
}

// Assemble application context for the routes
const ctx = {
  // Pass in generic utils
  ...userUtils,
  ...geoUtils,
  ...mongoUtils,
  ...metricsUtils,
  ...distanceUtils,
  ...eventUtils,
  ...profileUtils,
  
  // Pass in global state models and state methods
  ...store,

  // mongoEnabled must be a live getter (not a stale spread value)
  get mongoEnabled() { return store.mongoEnabled; },

  // App-level functionality
  imageUpload,
  razorpayEnabled,
  razorpay,
  mailEnabled,
  sendEmail,
  crypto,

  // Event handlers
  pushSseEvent,
  broadcastBrowseUpdate,
  broadcastChatUpdate,
  browseSubscribers,
  chatSubscribers,
}

// Register full route mappings
require('./routes/api')(app, ctx)

// Error handler must come AFTER routes to catch route errors
app.use(errorHandler)

// Server bootstrap
function startServer(portArg, maxRetries = 5) {
  const currentPort = Number(portArg)
  const server = app
    .listen(currentPort, () => {
      console.log(`Express server running at http://localhost:${currentPort}`)
    })
    .on("error", (error) => {
      if (error.code === "EADDRINUSE" && maxRetries > 0) {
        const nextPort = currentPort + 1
        console.warn(`Port ${currentPort} is in use. Trying ${nextPort}...`)
        startServer(nextPort, maxRetries - 1)
        return
      }
      throw error
    })
  return server
}

async function bootstrap() {
  await store.initializeMongoState()
  await store.backfillRoommateLocationData()
  startServer(PORT)
}

bootstrap()
