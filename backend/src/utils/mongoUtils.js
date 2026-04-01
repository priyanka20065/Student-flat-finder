// Utility functions for MongoDB and state

function stripMongoId(document) {
  if (!document || typeof document !== "object") return document
  const { _id, ...rest } = document
  return rest
}

function normalizeFlat(flat) {
  const { normalizeImageUrls, normalizeTourUrls } = require("./geoUtils")
  const images = normalizeImageUrls(flat.images)
  const virtualTourUrls = normalizeTourUrls(flat.virtualTourUrls || flat.virtualTourUrl)
  return {
    ...flat,
    images: images.length ? images : ["/assets/modern-apartment-living.png"],
    roommates: Array.isArray(flat.roommates) ? flat.roommates : [],
    virtualTourUrls,
    virtualTourUrl: virtualTourUrls[0] || null,
  }
}

function normalizeRoommate(roommate) {
  const { normalizeTourUrls, normalizeCoordinatePair, normalizeImageUrls } = require("./geoUtils")
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
    maxOccupants: Math.max(1, Number(roommate.maxOccupants) || 1),
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

module.exports = {
  stripMongoId,
  normalizeFlat,
  normalizeRoommate
}
