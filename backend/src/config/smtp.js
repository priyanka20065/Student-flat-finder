const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || "false") === "true",
  user: process.env.SMTP_USER,
  pass: String(process.env.SMTP_PASS || "").replace(/\s+/g, ""),
  from: process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@studentflatfinder.local",
}

module.exports = smtpConfig
