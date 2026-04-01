// Subscription plan durations (in days)
const SUBSCRIPTION_DAYS = {
  basic: 30,
  standard: 90,
  premium: 365,
  monthly: 30,
  quarterly: 90,
  yearly: 365
};
// --- Define sendEmail for use in API routes ---
const sendEmail = async ({ to, subject, text, html }) => {
  if (!mailEnabled) return false;
  const nodemailer = require("nodemailer");
  try {
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    });
    await transporter.sendMail({ from: smtpConfig.from, to, subject, text, html });
    return true;
  } catch (error) {
    console.error("Email send failed:", error.message);
    return false;
  }
};
require("dotenv").config()
const express = require("express")
const cors = require("cors")
const { MongoClient } = require("mongodb")
const { uploadsDir } = require("./config/paths")
const smtpConfig = require("./config/smtp")
const { razorpayEnabled, razorpay } = require("./config/razorpay")
const { imageUpload } = require("./utils/dependencies")
const { flats: seedFlats, roommates: seedRoommates } = require("./data/flats")

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

// State and config
const state = {
  flats: [...seedFlats],
  roommates: [...seedRoommates],
  users: new Map(),
  chats: {},
  flatMetrics: {},
}
const mongoUri = String(process.env.MONGODB_URI || "").trim()
const mongoAutoSeed = String(process.env.MONGO_AUTO_SEED || "false") === "true"
let mongoEnabled = false
const dbCollections = {
  flats: null,
  roommates: null,
  users: null,
  chats: null,
  flatMetrics: null,
}
const FREE_CHAT_LIMIT = 5
const browseSubscribers = new Set()
const chatSubscribers = {}
const mailEnabled = Boolean(smtpConfig.host && smtpConfig.user && smtpConfig.pass)

// Utility imports
const userUtils = require("./utils/userUtils")
const geoUtils = require("./utils/geoUtils")
const mongoUtils = require("./utils/mongoUtils")
const metricsUtils = require("./utils/metricsUtils")
const distanceUtils = require("./utils/distanceUtils")
const eventUtils = require("./utils/eventUtils")
const profileUtils = require("./utils/profileUtils")
const errorHandler = require("./utils/errorHandler")

// Route setup

require("./controllers/api")(app, {
  state,
  dbCollections,
  FREE_CHAT_LIMIT,
  mongoUri,
  mongoEnabled,
  imageUpload,
  razorpayEnabled,
  razorpay,
  mailEnabled,
  sendEmail: async ({ to, subject, text, html }) => {
    if (!mailEnabled) return false
    const nodemailer = require("nodemailer")
    try {
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.pass,
        },
      })
      await transporter.sendMail({ from: smtpConfig.from, to, subject, text, html })
      return true
    } catch (error) {
      console.error("Email send failed:", error.message)
      return false
    }
  },
  crypto: require("crypto"),
  CAMPUS: { lat: 28.6692, lng: 77.2065 },
  ...userUtils,
  ...geoUtils,
  ...mongoUtils,
  ...metricsUtils,
  ...distanceUtils,
  ...eventUtils,
  ...profileUtils,
  // Persistence functions
  persistUser,
  persistFlat,
  deleteFlat,
  deleteChat,
  persistRoommate,
  persistChatMessages,
  persistFlatMetrics,
  deleteFlatMetrics,
  browseSubscribers,
  chatSubscribers
})

// Error handler
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
  // pruneUnsupportedListingsFromState and DB init can be added here if needed
  startServer(PORT)
}

bootstrap()

function sanitizeUser(user) {
  if (!user) {
    return null
  }

  const { password, ...safeUser } = user
  return safeUser
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeSubscriptionPlan(plan) {
  return String(plan || "").trim().toLowerCase()
}

function getSubscriptionDurationDays(plan) {
  const normalizedPlan = normalizeSubscriptionPlan(plan)
  if (SUBSCRIPTION_DAYS[normalizedPlan]) {
    return SUBSCRIPTION_DAYS[normalizedPlan]
  }
  if (normalizedPlan.includes("year")) {
    return 365
  }
  return 30
}

function getSubscriptionExpiry(activatedAt, plan) {
  const activatedDate = new Date(activatedAt || Date.now())
  if (Number.isNaN(activatedDate.getTime())) {
    return null
  }

  const expiryDate = new Date(activatedDate)
  expiryDate.setDate(expiryDate.getDate() + getSubscriptionDurationDays(plan))
  return expiryDate.toISOString()
}

function getSubscriptionLockState(user) {
  const subscription = user?.subscription
  if (!subscription?.active) {
    return { active: false, expiresAt: null }
  }

  const expiresAt = String(subscription.expiresAt || "").trim() || getSubscriptionExpiry(subscription.activatedAt, subscription.plan)
  if (!expiresAt) {
    return { active: false, expiresAt: null }
  }

  const expiryDate = new Date(expiresAt)
  if (Number.isNaN(expiryDate.getTime())) {
    return { active: false, expiresAt: null }
  }

  if (expiryDate.getTime() <= Date.now()) {
    return { active: false, expiresAt }
  }

  return { active: true, expiresAt }
}

function activateSubscription(user, plan) {
  const activatedAt = new Date().toISOString()
  user.subscription = {
    plan,
    active: true,
    activatedAt,
    expiresAt: getSubscriptionExpiry(activatedAt, plan),
  }
}

function toOptionalCoordinatePair(latValue, lngValue) {
  const normalizedLat = String(latValue ?? "").trim()
  const normalizedLng = String(lngValue ?? "").trim()
  if (!normalizedLat || !normalizedLng) {
    return null
  }

  const lat = Number(normalizedLat)
  const lng = Number(normalizedLng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }

  return [lat, lng]
}

function normalizeCoordinatePair(value) {
  if (!Array.isArray(value) || value.length < 2) {
    return null
  }

  const lat = Number(value[0])
  const lng = Number(value[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }

  return [lat, lng]
}

function normalizeTourUrl(value) {
  const raw = String(value || "").trim()
  if (!raw) {
    return null
  }

  if (!/^https?:\/\//i.test(raw) && !raw.startsWith("/uploads/")) {
    return null
  }

  return raw
}

function normalizeTourUrls(value, limit = 20) {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
      .split(",")
      .map((item) => item.trim())

  return source
    .map((item) => normalizeTourUrl(item))
    .filter(Boolean)
    .slice(0, limit)
}

function normalizeImageUrls(value, limit = 20) {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
      .split(",")
      .map((item) => item.trim())

  return source
    .map((item) => String(item || "").trim())
    .filter((item) => /^https?:\/\//i.test(item) || item.startsWith("/assets/") || item.startsWith("/uploads/"))
    .slice(0, limit)
}

function stripMongoId(document) {
  if (!document || typeof document !== "object") {
    return document
  }

  const { _id, ...rest } = document
  return rest
}

function normalizeFlat(flat) {
  const images = normalizeImageUrls(flat.images)
  const virtualTourUrls = normalizeTourUrls(flat.virtualTourUrls || flat.virtualTourUrl)
  return {
    ...flat,
    maxOccupants: Math.max(1, toNumber(flat.maxOccupants, 1)),
    images: images.length ? images : ["/assets/modern-apartment-living.png"],
    roommates: Array.isArray(flat.roommates) ? flat.roommates : [],
    virtualTourUrls,
    virtualTourUrl: virtualTourUrls[0] || null,
  }
}

function normalizeRoommate(roommate) {
  const virtualTourUrls = normalizeTourUrls(roommate.virtualTourUrls || roommate.virtualTourUrl)
  const normalizedLocationCoordinates = normalizeCoordinatePair(roommate.location?.coordinates)
  const normalizedInstitutionCoordinates = normalizeCoordinatePair(roommate.institution?.coordinates)
  const normalizedAddress = String(roommate.location?.address || roommate.address || "").trim()
  const currentRoommateUserIds = Array.isArray(roommate.currentRoommateUserIds)
    ? [...new Set(roommate.currentRoommateUserIds.map((item) => String(item || "").trim()).filter(Boolean))]
    : []
  return {
    ...roommate,
    address: normalizedAddress,
    interests: Array.isArray(roommate.interests) ? roommate.interests : [],
    images: normalizeImageUrls(roommate.images),
    maxOccupants: Math.max(1, toNumber(roommate.maxOccupants, 1)),
    moveInDate: String(roommate.moveInDate || "").trim() || null,
    currentRoommateUserIds,
    location: {
      address: normalizedAddress,
      coordinates: normalizedLocationCoordinates,
    },
    institution: {
      address: String(roommate.institution?.address || roommate.institutionAddress || "").trim(),
      coordinates: normalizedInstitutionCoordinates,
    },
    virtualTourUrls,
    virtualTourUrl: virtualTourUrls[0] || null,
  }
}

function normalizeFlatMetrics(metrics = {}) {
  const viewedBy = Array.isArray(metrics.viewedBy)
    ? metrics.viewedBy.map((item) => String(item || "").trim()).filter(Boolean)
    : []
  const likedBy = Array.isArray(metrics.likedBy)
    ? metrics.likedBy.map((item) => String(item || "").trim()).filter(Boolean)
    : []
  const purchasedByUserId = String(metrics.purchasedByUserId || "").trim() || null

  return {
    viewedBy: [...new Set(viewedBy)],
    likedBy: [...new Set(likedBy)],
    purchasedByUserId,
    purchasedAt: metrics.purchasedAt || null,
  }
}

async function initializeMongoState() {
  if (!mongoUri) {
    console.warn("MONGODB_URI is not configured. Running with in-memory state.")
    return
  }

  try {
    const mongoClient = new MongoClient(mongoUri)
    await mongoClient.connect()
    const database = mongoClient.db(process.env.MONGODB_DB || "student-flat-finder")

    dbCollections.flats = database.collection("flats")
    dbCollections.roommates = database.collection("roommates")
    dbCollections.users = database.collection("users")
    dbCollections.chats = database.collection("chats")
    dbCollections.flatMetrics = database.collection("flatMetrics")

    const [existingFlatCount, existingRoommateCount] = await Promise.all([
      dbCollections.flats.countDocuments(),
      dbCollections.roommates.countDocuments(),
    ])

    if (mongoAutoSeed && existingFlatCount === 0 && seedFlats.length) {
      await dbCollections.flats.insertMany(seedFlats.map((flat) => normalizeFlat(flat)))
    }

    if (mongoAutoSeed && existingRoommateCount === 0 && seedRoommates.length) {
      await dbCollections.roommates.insertMany(seedRoommates.map((roommate) => normalizeRoommate(roommate)))
    }

    const [flats, roommates, users, chats, flatMetrics] = await Promise.all([
      dbCollections.flats.find({}).toArray(),
      dbCollections.roommates.find({}).toArray(),
      dbCollections.users.find({}).toArray(),
      dbCollections.chats.find({}).toArray(),
      dbCollections.flatMetrics.find({}).toArray(),
    ])

    state.flats = flats.map(stripMongoId).map(normalizeFlat)
    state.roommates = roommates.map(stripMongoId).map(normalizeRoommate)
    state.users = new Map(users.map(stripMongoId).map((user) => [user.id, user]))
    state.chats = chats.reduce((accumulator, chatRecord) => {
      const item = stripMongoId(chatRecord)
      accumulator[item.flatId] = Array.isArray(item.messages) ? item.messages : []
      return accumulator
    }, {})
    state.flatMetrics = flatMetrics.reduce((accumulator, metricsRecord) => {
      const item = stripMongoId(metricsRecord)
      if (item?.flatId) {
        accumulator[item.flatId] = normalizeFlatMetrics(item)
      }
      return accumulator
    }, {})

    pruneUnsupportedListingsFromState()

    mongoEnabled = true
    console.log("MongoDB connected. Data loaded from database.")
  } catch (error) {
    console.error("MongoDB connection failed. Running with in-memory state:", error.message)
    mongoEnabled = false
  }
}

async function persistUser(user) {
  if (!mongoEnabled || !dbCollections.users) {
    return
  }

  await dbCollections.users.updateOne({ id: user.id }, { $set: user }, { upsert: true })
}

async function persistFlat(flat) {
  if (!mongoEnabled || !dbCollections.flats) {
    return
  }

  await dbCollections.flats.updateOne({ id: flat.id }, { $set: normalizeFlat(flat) }, { upsert: true })
}

async function deleteFlat(flatId) {
  if (!mongoEnabled || !dbCollections.flats) {
    return
  }

  await dbCollections.flats.deleteOne({ id: flatId })
}

async function deleteChat(flatId) {
  if (!mongoEnabled || !dbCollections.chats) {
    return
  }

  await dbCollections.chats.deleteOne({ flatId })
}

async function persistRoommate(roommate) {
  if (!mongoEnabled || !dbCollections.roommates) {
    return
  }

  await dbCollections.roommates.updateOne({ id: roommate.id }, { $set: normalizeRoommate(roommate) }, { upsert: true })
}

async function persistChatMessages(flatId, messages) {
  if (!mongoEnabled || !dbCollections.chats) {
    return
  }

  await dbCollections.chats.updateOne({ flatId }, { $set: { flatId, messages } }, { upsert: true })
}

async function persistFlatMetrics(flatId) {
  if (!mongoEnabled || !dbCollections.flatMetrics || !flatId) {
    return
  }

  const metrics = normalizeFlatMetrics(state.flatMetrics[flatId] || {})
  await dbCollections.flatMetrics.updateOne({ flatId }, { $set: { flatId, ...metrics } }, { upsert: true })
}

async function deleteFlatMetrics(flatId) {
  if (!mongoEnabled || !dbCollections.flatMetrics || !flatId) {
    return
  }

  await dbCollections.flatMetrics.deleteOne({ flatId })
}

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const CAMPUS = {
  lat: 28.6692,
  lng: 77.2065,
}

function getFlatMetrics(flatId) {
  if (!flatId) {
    return normalizeFlatMetrics({})
  }

  const existing = state.flatMetrics[flatId]
  if (!existing) {
    const baseline = normalizeFlatMetrics({})
    state.flatMetrics[flatId] = baseline
    return baseline
  }

  const normalized = normalizeFlatMetrics(existing)
  state.flatMetrics[flatId] = normalized
  return normalized
}

function getUniqueUserMessageCount(flat) {
  if (!flat?.id) {
    return 0
  }

  const messages = Array.isArray(state.chats[flat.id]) ? state.chats[flat.id] : []
  const ownerId = String(flat.ownerId || "").trim()
  const uniqueSenders = new Set()

  messages.forEach((message) => {
    const senderUserId = String(message?.senderUserId || "").trim()
    if (!senderUserId || senderUserId === ownerId) {
      return
    }
    uniqueSenders.add(senderUserId)
  })

  return uniqueSenders.size
}

function getOwnerFlatStats(flat) {
  const metrics = getFlatMetrics(flat?.id)
  const buyerUser = metrics.purchasedByUserId ? state.users.get(metrics.purchasedByUserId) : null
  return {
    uniqueMessageUsers: getUniqueUserMessageCount(flat),
    views: metrics.viewedBy.length,
    likes: metrics.likedBy.length,
    purchasedByUserId: metrics.purchasedByUserId,
    purchasedByName: buyerUser?.name || null,
    isSold: Boolean(metrics.purchasedByUserId),
  }
}

function getPurchasedFlatIdByUser(userId) {
  const normalizedUserId = String(userId || "").trim()
  if (!normalizedUserId) {
    return null
  }

  const purchasedRecord = Object.entries(state.flatMetrics).find(([, metrics]) => {
    return String(metrics?.purchasedByUserId || "") === normalizedUserId
  })

  return purchasedRecord ? purchasedRecord[0] : null
}

function getRoommateJoinedUserIds(roommate) {
  const fromArray = Array.isArray(roommate?.currentRoommateUserIds)
    ? roommate.currentRoommateUserIds.map((item) => String(item || "").trim()).filter(Boolean)
    : []
  const primary = String(roommate?.purchasedByUserId || "").trim()
  return [...new Set([...(primary ? [primary] : []), ...fromArray])]
}

function hasUserBookedAnyRoommate(userId) {
  const normalizedUserId = String(userId || "").trim()
  if (!normalizedUserId) {
    return false
  }

  return state.roommates.some((roommate) => getRoommateJoinedUserIds(roommate).includes(normalizedUserId))
}

function isEligibleStudentBuyer(userId) {
  const user = state.users.get(String(userId || "").trim())
  if (!user) {
    return false
  }

  const normalizedRole = String(user.role || user.intent || "").toLowerCase()
  return normalizedRole !== "owner"
}

function hasAnyRoomBookedByUser(userId) {
  const normalizedUserId = String(userId || "").trim()
  if (!normalizedUserId) {
    return false
  }

  return Boolean(getPurchasedFlatIdByUser(normalizedUserId)) || hasUserBookedAnyRoommate(normalizedUserId)
}

function hasRoommateSeatAvailable(roommate) {
  const capacity = Math.max(1, toNumber(roommate?.maxOccupants, 1))
  const occupied = 1 + getRoommateJoinedUserIds(roommate).length
  return occupied < capacity
}

function getUserActivityCounts(userId) {
  const normalizedUserId = String(userId || "").trim()
  if (!normalizedUserId) {
    return {
      profileViews: 0,
      savedFlats: 0,
      messages: 0,
    }
  }

  const ownFlatIds = new Set(
    state.flats
      .filter((flat) => String(flat.ownerId || "") === normalizedUserId)
      .map((flat) => flat.id),
  )
  const ownRoommateIds = new Set(
    state.roommates
      .filter((roommate) => String(roommate.createdByUserId || "") === normalizedUserId)
      .map((roommate) => roommate.id),
  )

  let profileViews = 0
  let savedFlats = 0

  Object.entries(state.flatMetrics).forEach(([flatId, rawMetrics]) => {
    const metrics = normalizeFlatMetrics(rawMetrics)
    if (ownFlatIds.has(flatId)) {
      profileViews += metrics.viewedBy.length
    } else if (metrics.viewedBy.includes(normalizedUserId)) {
      profileViews += 1
    }

    if (metrics.likedBy.includes(normalizedUserId)) {
      savedFlats += 1
    }
  })

  let messages = 0
  Object.entries(state.chats).forEach(([chatKey, chatMessages]) => {
    const list = Array.isArray(chatMessages) ? chatMessages : []
    if (!list.length) {
      return
    }

    const isOwnedFlatChat = ownFlatIds.has(chatKey)
    const isOwnedRoommateChat = chatKey.startsWith("roommate-")
      ? ownRoommateIds.has(chatKey.slice("roommate-".length))
      : false

    if (isOwnedFlatChat || isOwnedRoommateChat) {
      messages += list.length
      return
    }

    messages += list.filter((item) => {
      const senderUserId = String(item?.senderUserId || "").trim()
      const recipientUserId = String(item?.recipientUserId || "").trim()
      return senderUserId === normalizedUserId || recipientUserId === normalizedUserId
    }).length
  })

  return {
    profileViews,
    savedFlats,
    messages,
  }
}

function enrichFlat(flat) {
  const roommateProfiles = flat.roommates
    .map((roommateId) => state.roommates.find((roommate) => roommate.id === roommateId))
    .filter(Boolean)

  const [lat, lng] = flat.location.coordinates
  return {
    ...flat,
    roommateProfiles,
    distanceFromCampusKm: Number(haversineDistanceKm(CAMPUS.lat, CAMPUS.lng, lat, lng).toFixed(1)),
    stats: getOwnerFlatStats(flat),
  }
}

function enrichRoommate(roommate) {
  if (!roommate) {
    return roommate
  }

  const linkedFlat = state.flats
    .filter((flat) => isActiveOwnerListing(flat))
    .find((flat) => Array.isArray(flat.roommates) && flat.roommates.includes(roommate.id))

  const user = state.users.get(String(roommate.createdByUserId || ""))
  const roommateCoordinates = normalizeCoordinatePair(roommate.location?.coordinates)
  const linkedFlatCoordinates = normalizeCoordinatePair(linkedFlat?.location?.coordinates)
  const institutionCoordinates = normalizeCoordinatePair(roommate.institution?.coordinates) || null
  const mapCoordinates = roommateCoordinates || linkedFlatCoordinates || institutionCoordinates || null
  const institutionAddress =
    String(roommate.institution?.address || user?.university || user?.officeAddress || "").trim() || null
  const displayAddress =
    String(roommate.address || roommate.location?.address || linkedFlat?.location?.address || institutionAddress || "").trim() ||
    "Campus Area"
  const distanceToInstitutionKm = roommateCoordinates
    ? Number(
      haversineDistanceKm(
        roommateCoordinates[0],
        roommateCoordinates[1],
        (institutionCoordinates || [CAMPUS.lat, CAMPUS.lng])[0],
        (institutionCoordinates || [CAMPUS.lat, CAMPUS.lng])[1],
      ).toFixed(1),
    )
    : null

  return {
    ...roommate,
    linkedFlatId: linkedFlat?.id || null,
    linkedFlatAddress: linkedFlat?.location?.address || null,
    linkedFlatCoordinates: linkedFlat?.location?.coordinates || null,
    displayAddress,
    mapCoordinates,
    institutionAddress,
    distanceToInstitutionKm,
  }
}

function isAppGeneratedListingId(id, prefix) {
  const value = String(id || "").trim()
  // Accept both app-generated IDs (flat-<timestamp>-<hex>) and seed IDs (flat1, rm1, etc.)
  return new RegExp(`^${prefix}(-\\d{13}-[a-z0-9]{6}$|\\d+$)`).test(value)
}

function isActiveOwnerListing(flat) {
  if (!isAppGeneratedListingId(flat?.id, "flat")) {
    return false
  }

  const ownerId = String(flat?.ownerId || "").trim()
  if (!ownerId) {
    return false
  }

  // For seed data, owner may not be a registered user
  const ownerUser = state.users.get(ownerId)
  if (!ownerUser) {
    // Accept seed/demo listings that have an ownerName
    return Boolean(flat.ownerName)
  }

  const normalizedRole = String(ownerUser.role || ownerUser.intent || "").toLowerCase()
  return normalizedRole === "owner"
}

function isActiveRoommateListing(roommate) {
  // Always show seed roommates (no createdByUserId)
  if (!roommate?.createdByUserId) {
    return Boolean(roommate.name);
  }

  if (!isAppGeneratedListingId(roommate?.id, "rm")) {
    return false;
  }

  const createdByUserId = String(roommate?.createdByUserId || "").trim();
  const user = state.users.get(createdByUserId);
  if (!user) {
    return false;
  }
  const normalizedRole = String(user.role || user.intent || "").toLowerCase();
  return normalizedRole !== "owner";
}

function pruneUnsupportedListingsFromState() {
  state.flats = state.flats.filter((flat) => isActiveOwnerListing(flat))
  state.roommates = state.roommates.filter((roommate) => isActiveRoommateListing(roommate))
}

async function backfillRoommateLocationData() {
  let updatedCount = 0

  for (const roommate of state.roommates) {
    const user = state.users.get(String(roommate.createdByUserId || ""))
    const linkedFlat = state.flats.find((flat) => Array.isArray(flat.roommates) && flat.roommates.includes(roommate.id))

    const existingAddress = String(roommate.location?.address || roommate.address || "").trim()
    const fallbackAddress =
      String(existingAddress || linkedFlat?.location?.address || roommate.institution?.address || user?.university || user?.officeAddress || "").trim() ||
      "Campus Area"

    const existingCoordinates = normalizeCoordinatePair(roommate.location?.coordinates)
    const fallbackCoordinates =
      existingCoordinates ||
      normalizeCoordinatePair(linkedFlat?.location?.coordinates) ||
      normalizeCoordinatePair(roommate.institution?.coordinates) ||
      null

    const institutionAddress =
      String(roommate.institution?.address || user?.university || user?.officeAddress || "").trim() || ""
    const institutionCoordinates = normalizeCoordinatePair(roommate.institution?.coordinates)

    const nextRoommate = {
      ...roommate,
      address: fallbackAddress,
      location: {
        address: fallbackAddress,
        coordinates: fallbackCoordinates,
      },
      institution: {
        address: institutionAddress,
        coordinates: institutionCoordinates,
      },
    }

    const shouldPersist =
      String(roommate.address || "").trim() !== nextRoommate.address ||
      String(roommate.location?.address || "").trim() !== nextRoommate.location.address ||
      String(roommate.institution?.address || "").trim() !== nextRoommate.institution.address ||
      JSON.stringify(normalizeCoordinatePair(roommate.location?.coordinates)) !== JSON.stringify(nextRoommate.location.coordinates) ||
      JSON.stringify(normalizeCoordinatePair(roommate.institution?.coordinates)) !==
      JSON.stringify(nextRoommate.institution.coordinates)

    if (!shouldPersist) {
      continue
    }

    Object.assign(roommate, nextRoommate)

    try {
      await persistRoommate(roommate)
    } catch (error) {
      console.error("Failed to backfill roommate location data:", error.message)
    }

    updatedCount += 1
  }

  if (updatedCount > 0) {
    console.log(`Backfilled roommate location data for ${updatedCount} listing(s).`)
  }
}

function profileToScore(target, preferences) {
  const cleanlinessScore = 10 - Math.abs(target.cleanliness - preferences.cleanliness)
  const socialScore = 10 - Math.abs(target.socialLevel - preferences.socialLevel)
  const studyScore = 10 - Math.abs(target.studyHabits - preferences.studyHabits)
  return cleanlinessScore + socialScore + studyScore
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



require('./routes/api')(app, {
  state,
  dbCollections,
  FREE_CHAT_LIMIT,
  mongoUri,
  mongoEnabled,
  imageUpload,
  razorpayEnabled,
  razorpay,
  mailEnabled,
  sendEmail,
  crypto,
  CAMPUS,
  sanitizeUser,
  makeId,
  toNumber,
  normalizeSubscriptionPlan,
  getSubscriptionDurationDays,
  getSubscriptionExpiry,
  getSubscriptionLockState,
  activateSubscription,
  toOptionalCoordinatePair,
  normalizeCoordinatePair,
  normalizeTourUrl,
  normalizeTourUrls,
  normalizeImageUrls,
  stripMongoId,
  normalizeFlat,
  normalizeRoommate,
  normalizeFlatMetrics,
  haversineDistanceKm,
  getFlatMetrics,
  getUniqueUserMessageCount,
  getOwnerFlatStats,
  getPurchasedFlatIdByUser,
  getRoommateJoinedUserIds,
  hasUserBookedAnyRoommate,
  isEligibleStudentBuyer,
  hasAnyRoomBookedByUser,
  hasRoommateSeatAvailable,
  getUserActivityCounts,
  enrichFlat,
  enrichRoommate,
  isAppGeneratedListingId,
  isActiveOwnerListing,
  isActiveRoommateListing,
  pruneUnsupportedListingsFromState,
  profileToScore,
  pushSseEvent,
  broadcastBrowseUpdate,
  broadcastChatUpdate,
  persistUser,
  persistFlat,
  deleteFlat,
  deleteChat,
  persistRoommate,
  persistChatMessages,
  persistFlatMetrics,
  deleteFlatMetrics,
  browseSubscribers,
  chatSubscribers
});




app.use((error, _req, res, next) => {
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
})

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
  pruneUnsupportedListingsFromState()
  await initializeMongoState()
  await backfillRoommateLocationData()
  startServer(PORT)
}

bootstrap()
