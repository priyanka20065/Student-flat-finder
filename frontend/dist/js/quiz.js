const quizForm = document.getElementById("quizForm")
const quizStatus = document.getElementById("quizStatus")
const recommendations = document.getElementById("recommendations")

const currentUser = window.AppUtils.ensureLoggedIn("/login")
let currentProfile = null

function prefillQuizForm(userProfile) {
  if (!quizForm || !userProfile) {
    return
  }

  const setField = (name, value) => {
    const node = quizForm.querySelector(`[name="${name}"]`)
    if (!node || value === undefined || value === null) {
      return
    }
    node.value = value
  }

  setField("cleanliness", Number(userProfile.personality?.cleanliness || 5))
  setField("socialLevel", Number(userProfile.personality?.socialLevel || 5))
  setField("studyHabits", Number(userProfile.personality?.studyHabits || 5))
  setField("interests", Array.isArray(userProfile.interests) ? userProfile.interests.join(", ") : "")
  setField("budget", Number(userProfile.preferredRentMax || 15000))
  const roomTypeInput = quizForm.querySelector(
    `input[name="roomType"][value="${
      String(userProfile.preferredRoomType || "").toLowerCase() === "room-with-roommates" ? "shared-room" : "room-only"
    }"]`,
  )
  if (roomTypeInput) {
    roomTypeInput.checked = true
  }

  setField("houseRules", String(userProfile.houseRulesPreference || ""))
}

if (currentUser) {
  const onboardingMode = new URLSearchParams(window.location.search).get("onboarding") === "1"

  window.AppUtils
    .api(`/api/profile/${currentUser.id}`)
    .then((profile) => {
      currentProfile = profile
      prefillQuizForm(profile)
      if (onboardingMode) {
        quizStatus.textContent = "Complete your preferences to get personalized room matches."
      }
    })
    .catch(() => {
      prefillQuizForm(currentUser)
    })

  quizForm.addEventListener("submit", async (event) => {
    event.preventDefault()

    const formData = new FormData(quizForm)
    // Budget (slider)
    const budget = Number(formData.get("budget") || 15000)
    // Room type (radio)
    const roomType = formData.get("roomType") || "room-only"
    const amenities = Array.isArray(currentProfile?.preferredAmenities)
      ? currentProfile.preferredAmenities
      : Array.isArray(currentUser?.preferredAmenities)
        ? currentUser.preferredAmenities
        : []
    // House rules (textarea)
    const houseRules = formData.get("houseRules") || ""

    const payload = {
      budget,
      roomType,
      amenities,
      houseRules,
      interests: Array.isArray(currentProfile?.interests)
        ? currentProfile.interests
        : Array.isArray(currentUser?.interests)
          ? currentUser.interests
          : [],
      cleanliness: Number(currentProfile?.personality?.cleanliness || currentUser?.personality?.cleanliness || 5),
      socialLevel: Number(currentProfile?.personality?.socialLevel || currentUser?.personality?.socialLevel || 5),
      studyHabits: Number(currentProfile?.personality?.studyHabits || currentUser?.personality?.studyHabits || 5),
      university: String(currentProfile?.university || currentUser?.university || "").trim(),
    }

    try {
      const result = await window.AppUtils.api("/api/quiz/match", {
        method: "POST",
        body: JSON.stringify(payload),
      })

      const updatedUser = {
        ...(currentProfile || currentUser),
        preferredRoomType: roomType === "shared-room" ? "room-with-roommates" : "room-only",
        preferredRentMax: budget,
        preferredAmenities: amenities,
        houseRulesPreference: houseRules,
      }

      await window.AppUtils.api(`/api/profile/${currentUser.id}`, {
        method: "PUT",
        body: JSON.stringify(updatedUser),
      })

      window.AppUtils.setCurrentUser(updatedUser)
      quizStatus.textContent = onboardingMode
        ? "Preferences saved. Redirecting to your matched dashboard..."
        : "AI matching complete. Top recommendations below."

      recommendations.innerHTML = result.recommendations
        .map(
          (flat) => `
          <article class="card">
            <h3>${flat.title}</h3>
            <p class="muted">${flat.location.address}</p>
            <p>${window.AppUtils.formatINR(flat.rent)} / month</p>
            <p class="muted">Match score: ${flat.matchScore}</p>
            <a class="btn btn-secondary small-btn" href="/flat/${flat.id}">View Room</a>
          </article>
        `,
        )
        .join("")

      if (onboardingMode) {
        setTimeout(() => {
          window.location.href = "/dashboard"
        }, 900)
      }
    } catch (error) {
      quizStatus.textContent = error.message
    }
  })
}
