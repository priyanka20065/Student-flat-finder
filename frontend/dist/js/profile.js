const currentUser = window.AppUtils.ensureLoggedIn("/login")

const profileForm = document.getElementById("profileForm")
const profileStatus = document.getElementById("profileStatus")
// const studentPersonalityFields = document.getElementById("studentPersonalityFields")
const studentPreferenceFields = document.getElementById("studentPreferenceFields")
const profileIntroText = document.getElementById("profileIntroText")
const profileTabs = Array.from(document.querySelectorAll("[data-profile-tab]"))
const profilePanels = Array.from(document.querySelectorAll("[data-profile-panel]"))

function resolveIsOwner(user) {
  return String(user?.role || user?.intent || "").toLowerCase() === "owner"
}

function resolveIsNormalStudent(user) {
  const preferredRoomType = String(user?.preferredRoomType || "").toLowerCase()
  return !resolveIsOwner(user) && preferredRoomType === "room-only"
}

let isOwner = resolveIsOwner(currentUser)
let isNormalStudent = resolveIsNormalStudent(currentUser)
let activeProfileTab = "personal"

function setInputValue(id, value) {
  const node = document.getElementById(id)
  if (!node) {
    return
  }
  node.value = value ?? ""
}

function normalizePreferredRoomType(value) {
  const normalized = String(value || "").trim().toLowerCase()
  if (normalized === "both") {
    return "all"
  }
  if (normalized === "all" || normalized === "room-only" || normalized === "room-with-roommates") {
    return normalized
  }
  return "room-only"
}

function applyRoleSpecificProfile() {
  studentPreferenceFields?.classList.toggle("hidden", isOwner || activeProfileTab !== "personal")

  const preferredRoomTypeInput = document.getElementById("profilePreferredRoomType")
  const preferredRentMaxInput = document.getElementById("profilePreferredRentMax")
  if (preferredRoomTypeInput) {
    preferredRoomTypeInput.disabled = Boolean(isOwner)
  }
  if (preferredRentMaxInput) {
    preferredRentMaxInput.disabled = Boolean(isOwner)
  }

  profileTabs.forEach((tab, index) => {
    tab.classList.toggle("hidden", index > 0)
  })

  if (profileIntroText) {
    profileIntroText.textContent = isOwner ? "Manage owner account settings" : "Manage student account settings"
  }
}

function setActiveProfileTab(tabName) {
  activeProfileTab = tabName

  profileTabs.forEach((tab) => {
    const tabKey = String(tab.dataset.profileTab || "")
    tab.classList.toggle("active-tab", tabKey === tabName)
  })

  profilePanels.forEach((panel) => {
    const panelKey = String(panel.dataset.profilePanel || "")
    panel.classList.toggle("hidden", panelKey !== tabName)
  })

  applyRoleSpecificProfile()
}

function bindProfileTabs() {
  profileTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabKey = String(tab.dataset.profileTab || "personal")
      if (isOwner && tabKey !== "personal") {
        return
      }
      setActiveProfileTab(tabKey)
    })
  })
}

async function loadProfile() {
  if (!currentUser?.id) {
    return
  }

  try {
    const profile = await window.AppUtils.api(`/api/profile/${currentUser.id}`)
    isOwner = resolveIsOwner(profile) || resolveIsOwner(currentUser)
    isNormalStudent = resolveIsNormalStudent(profile) || resolveIsNormalStudent(currentUser)
    applyRoleSpecificProfile()

    setInputValue("profileName", profile.name)
    setInputValue("profileEmail", profile.email)
    setInputValue("profilePhone", profile.phone)
    setInputValue("profileUniversity", profile.university)
    setInputValue("profileCourse", profile.course)
    setInputValue("profilePreferredRoomType", normalizePreferredRoomType(profile.preferredRoomType || "room-only"))
    setInputValue("profilePreferredRentMax", profile.preferredRentMax)
    setInputValue("profileYear", profile.year)
    setInputValue("profileBio", profile.bio)
    // Removed personality fields from profile

  } catch (error) {
    profileStatus.textContent = error.message
  }
}

profileForm?.addEventListener("submit", async (event) => {
  event.preventDefault()

  if (!currentUser?.id) {
    window.location.href = "/login"
    return
  }

  const payload = {
    name: String(document.getElementById("profileName")?.value || "").trim(),
    phone: String(document.getElementById("profilePhone")?.value || "").trim(),
    university: String(document.getElementById("profileUniversity")?.value || "").trim(),
    course: String(document.getElementById("profileCourse")?.value || "").trim(),
    year: String(document.getElementById("profileYear")?.value || "").trim(),
    bio: String(document.getElementById("profileBio")?.value || "").trim(),
  }

  if (!isOwner) {
    payload.preferredRoomType = normalizePreferredRoomType(document.getElementById("profilePreferredRoomType")?.value || "room-only")
    payload.preferredRentMax = Number(document.getElementById("profilePreferredRentMax")?.value || 0)
  }

  // Removed personality fields from profile

  try {
    const updatedUser = await window.AppUtils.api(`/api/profile/${currentUser.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    })

    window.AppUtils.setCurrentUser(updatedUser)
    profileStatus.textContent = "Profile updated successfully."
  } catch (error) {
    profileStatus.textContent = error.message
  }
})

applyRoleSpecificProfile()
bindProfileTabs()
setActiveProfileTab("personal")
loadProfile()
