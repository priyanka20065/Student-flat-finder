const loginForm = document.getElementById("loginForm")
const loginStatus = document.getElementById("loginStatus")
const loginIntentStudent = document.getElementById("loginIntentStudent")
const loginIntentOwner = document.getElementById("loginIntentOwner")
const loginStudentFlow = document.getElementById("loginStudentFlow")

function toggleStudentFlow() {
  const isStudent = Boolean(loginIntentStudent?.checked)
  loginStudentFlow?.classList.toggle("hidden", !isStudent)
}

function resolveRedirect(user, fallbackIntent = "") {
  const normalizedRole = String(user?.role || "").toLowerCase()
  const normalizedIntent = String(user?.intent || fallbackIntent || "").toLowerCase()
  const isOwner = normalizedRole === "owner" || normalizedIntent === "owner"

  return isOwner ? "/dashboard?mode=owner" : "/dashboard?mode=student"
}

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
      window.location.href = resolveRedirect(user, payload.intent)
    }, 700)
  } catch (error) {
    loginStatus.textContent = error.message
  }
})

loginIntentStudent?.addEventListener("change", toggleStudentFlow)
loginIntentOwner?.addEventListener("change", toggleStudentFlow)
toggleStudentFlow()
