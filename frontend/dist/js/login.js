const loginForm = document.getElementById("loginForm")
const loginStatus = document.getElementById("loginStatus")
const intentInput = document.getElementById("intentInput")
const roleStudentBtn = document.getElementById("role-student")
const roleOwnerBtn = document.getElementById("role-owner")

function applyIntent(intentValue) {
  const normalized = String(intentValue || "seeker").trim().toLowerCase() === "owner" ? "owner" : "seeker"
  if (intentInput) {
    intentInput.value = normalized
  }
  roleStudentBtn?.classList.toggle("active", normalized !== "owner")
  roleOwnerBtn?.classList.toggle("active", normalized === "owner")
}

function sanitizeNextPath(nextRaw) {
  const value = String(nextRaw || "").trim()
  if (!value) {
    return ""
  }
  // Allow only internal paths to avoid open redirect vulnerabilities.
  if (!value.startsWith("/") || value.startsWith("//")) {
    return ""
  }
  return value
}

function resolveRedirect(user, fallbackIntent = "", nextPath = "") {
  if (nextPath) {
    return nextPath
  }

  const normalizedRole = String(user?.role || "").toLowerCase()
  const normalizedIntent = String(user?.intent || fallbackIntent || "").toLowerCase()
  const isOwner = normalizedRole === "owner" || normalizedIntent === "owner"

  return isOwner ? "/dashboard?mode=owner" : "/dashboard?mode=student"
}

const queryParams = new URLSearchParams(window.location.search)
const nextPathFromQuery = sanitizeNextPath(queryParams.get("next"))

const emailFromQuery = String(queryParams.get("email") || "").trim()
if (emailFromQuery) {
  const emailInput = loginForm?.querySelector('input[name="email"]')
  if (emailInput) {
    emailInput.value = emailFromQuery
  }
}

applyIntent(queryParams.get("intent") || intentInput?.value || "seeker")

roleStudentBtn?.addEventListener("click", () => applyIntent("seeker"))
roleOwnerBtn?.addEventListener("click", () => applyIntent("owner"))

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault()
  const formData = new FormData(loginForm)
  const payload = Object.fromEntries(formData.entries())

  payload.preferredRoomType = payload.intent === "owner" ? null : payload.preferredRoomType || "room-only"

  try {
    const user = await window.AppUtils.api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    })

    window.AppUtils.setCurrentUser(user)
    loginStatus.textContent = "Login successful. Redirecting..."
    setTimeout(() => {
      window.location.href = resolveRedirect(user, payload.intent, nextPathFromQuery)
    }, 700)
  } catch (error) {
    loginStatus.textContent = error.message
  }
})
