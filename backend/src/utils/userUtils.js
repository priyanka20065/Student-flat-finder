// Utility functions extracted from index.js

function sanitizeUser(user) {
  if (!user) return null
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
  const SUBSCRIPTION_DAYS = {
    premium: 30,
    "premium yearly": 365,
  }
  const normalizedPlan = normalizeSubscriptionPlan(plan)
  if (SUBSCRIPTION_DAYS[normalizedPlan]) return SUBSCRIPTION_DAYS[normalizedPlan]
  if (normalizedPlan.includes("year")) return 365
  return 30
}

function getSubscriptionExpiry(activatedAt, plan) {
  const activatedDate = new Date(activatedAt || Date.now())
  if (Number.isNaN(activatedDate.getTime())) return null
  const expiryDate = new Date(activatedDate)
  expiryDate.setDate(expiryDate.getDate() + getSubscriptionDurationDays(plan))
  return expiryDate.toISOString()
}

function getSubscriptionLockState(user) {
  const subscription = user?.subscription
  if (!subscription?.active) return { active: false, expiresAt: null }
  const expiresAt = String(subscription.expiresAt || "").trim() || getSubscriptionExpiry(subscription.activatedAt, subscription.plan)
  if (!expiresAt) return { active: false, expiresAt: null }
  const expiryDate = new Date(expiresAt)
  if (Number.isNaN(expiryDate.getTime())) return { active: false, expiresAt: null }
  if (expiryDate.getTime() <= Date.now()) return { active: false, expiresAt }
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

module.exports = {
  sanitizeUser,
  makeId,
  toNumber,
  normalizeSubscriptionPlan,
  getSubscriptionDurationDays,
  getSubscriptionExpiry,
  getSubscriptionLockState,
  activateSubscription
}
