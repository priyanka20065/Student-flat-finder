// Utility functions for coordinates, images, and tours

function toOptionalCoordinatePair(latValue, lngValue) {
  const normalizedLat = String(latValue ?? "").trim()
  const normalizedLng = String(lngValue ?? "").trim()
  if (!normalizedLat || !normalizedLng) return null
  const lat = Number(normalizedLat)
  const lng = Number(normalizedLng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return [lat, lng]
}

function normalizeCoordinatePair(value) {
  if (!Array.isArray(value) || value.length < 2) return null
  const lat = Number(value[0])
  const lng = Number(value[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return [lat, lng]
}

function normalizeTourUrl(value) {
  const raw = String(value || "").trim()
  if (!raw) return null
  if (!/^https?:\/\//i.test(raw) && !raw.startsWith("/uploads/")) return null
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

module.exports = {
  toOptionalCoordinatePair,
  normalizeCoordinatePair,
  normalizeTourUrl,
  normalizeTourUrls,
  normalizeImageUrls
}
