// Utility for metrics

function normalizeFlatMetrics(metrics = {}) {
  const viewedBy = Array.isArray(metrics.viewedBy)
    ? metrics.viewedBy.map((item) => String(item || "").trim()).filter(Boolean)
    : []
  const likedBy = Array.isArray(metrics.likedBy)
    ? metrics.likedBy.map((item) => String(item || "").trim()).filter(Boolean)
    : []
  const roommateBookedUserIds = Array.isArray(metrics.roommateBookedUserIds)
    ? metrics.roommateBookedUserIds.map((item) => String(item || "").trim()).filter(Boolean)
    : []
  const purchasedByUserId = String(metrics.purchasedByUserId || "").trim() || null

  return {
    viewedBy: [...new Set(viewedBy)],
    likedBy: [...new Set(likedBy)],
    roommateBookedUserIds: [...new Set(roommateBookedUserIds)],
    purchasedByUserId,
    purchasedAt: metrics.purchasedAt || null,
  }
}

module.exports = {
  normalizeFlatMetrics
}
