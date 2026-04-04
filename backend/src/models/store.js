const { MongoClient } = require("mongodb");
const { flats: seedFlats, roommates: seedRoommates } = require("../data/flats");
const { stripMongoId, normalizeFlat, normalizeRoommate } = require("../utils/mongoUtils");
const { normalizeFlatMetrics } = require("../utils/metricsUtils");
const { normalizeCoordinatePair } = require("../utils/geoUtils");
const { haversineDistanceKm } = require("../utils/distanceUtils");
const { toNumber } = require("../utils/userUtils");

const FREE_CHAT_LIMIT = 5;
const CAMPUS = { lat: 28.6692, lng: 77.2065 };

const state = {
  flats: [...seedFlats],
  roommates: [...seedRoommates],
  users: new Map(),
  chats: {},
  flatMetrics: {},
};

const mongoUri = String(process.env.MONGODB_URI || "").trim();
const mongoAutoSeed = String(process.env.MONGO_AUTO_SEED || "false") === "true";
let mongoEnabled = false;

const dbCollections = {
  flats: null,
  roommates: null,
  users: null,
  chats: null,
  flatMetrics: null,
};

function getMongoState() {
  return mongoEnabled;
}

function setMongoState(enabled) {
  mongoEnabled = enabled;
}

function isAppGeneratedListingId(id, prefix) {
  const value = String(id || "").trim()
  return new RegExp(`^${prefix}(-\\d{13}-[a-z0-9]{6}$|\\d+$)`).test(value)
}

function isActiveOwnerListing(flat) {
  const ownerId = String(flat?.ownerId || "").trim()
  if (!ownerId) {
    return false
  }

  const ownerUser = state.users.get(ownerId)
  if (!ownerUser) {
    return Boolean(flat.ownerName)
  }

  const normalizedRole = String(ownerUser.role || ownerUser.intent || "").toLowerCase()
  return normalizedRole === "owner"
}

function isActiveRoommateListing(roommate) {
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
    require('fs').writeFileSync('/tmp/mongo-error.log', error.stack);
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

module.exports = {
  state,
  dbCollections,
  mongoUri,
  get mongoEnabled() { return getMongoState(); },
  FREE_CHAT_LIMIT,
  CAMPUS,
  initializeMongoState,
  persistUser,
  persistFlat,
  deleteFlat,
  deleteChat,
  persistRoommate,
  persistChatMessages,
  persistFlatMetrics,
  deleteFlatMetrics,
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
  backfillRoommateLocationData
};
