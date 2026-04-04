function resolveFromAddress() {
  const smtpUser = String(process.env.SMTP_USER || "").trim()
  const configuredFrom = String(process.env.SMTP_FROM || "").trim()

  if (!smtpUser) {
    return configuredFrom || "no-reply@studentflatfinder.local"
  }

  const normalizedFrom = configuredFrom.toLowerCase()
  const isPlaceholderFrom =
    !configuredFrom ||
    normalizedFrom.includes("studentflatfinder.local") ||
    normalizedFrom.startsWith("no-reply@")

  return isPlaceholderFrom ? smtpUser : configuredFrom
}

const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || "false") === "true",
  user: process.env.SMTP_USER,
  pass: String(process.env.SMTP_PASS || "").replace(/\s+/g, ""),
  from: resolveFromAddress(),
}

module.exports = smtpConfig
