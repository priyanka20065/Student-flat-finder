const currentUser = window.AppUtils.ensureLoggedIn("/login")
const dashboardStatus = document.getElementById("dashboardStatus")
const welcomeTitle = document.getElementById("welcomeTitle")
const activityList = document.getElementById("activityList")
const profileRole = document.getElementById("profileRole")
const memberSince = document.getElementById("memberSince")
const subscriptionStatus = document.getElementById("subscriptionStatus")
const dashboardRecommendations = document.getElementById("dashboardRecommendations")

function resolveDashboardMode(user) {
  const role = String(user?.role || "").toLowerCase()
  const intent = String(user?.intent || "").toLowerCase()
  const preferredRoomType = String(user?.preferredRoomType || "").toLowerCase()

  if (role === "owner" || intent === "owner") {
    return "owner"
  }

  if (preferredRoomType === "room-only") {
    return "student"
  }

  if (preferredRoomType === "room-with-roommates") {
    return "roommate"
  }

  if (role === "roommate" || preferredRoomType === "room-with-roommates") {
    return "roommate"
  }

  return "student"
}

function buildRoommateListingCard(profile) {
  const chips = (profile.interests || []).slice(0, 4).map((item) => `<span class="chip">${item}</span>`).join("")
  const roommateDetailUrl = `/roommate/${encodeURIComponent(profile.id)}`
  const imageUrl = resolveImageUrl(profile.images?.[0] || "/assets/modern-apartment-living.png")
  return `
    <article class="dashboard-reco-card">
      <div class="dashboard-reco-image-wrap">
        <img src="${resolveImageUrl(profile.images?.[0])}" alt="${profile.name}" class="dashboard-reco-image" onerror="this.onerror=null;this.src='/assets/modern-apartment-living.png';" />
        <span class="dashboard-type">Roommate Profile</span>
      </div>
      <div class="dashboard-reco-content">
        <h3>${profile.name}</h3>
        <p class="muted">${profile.course || "Student"}</p>
        <p class="muted text-justify">${profile.bio || "Roommate profile"}</p>
        <div class="chip-list">${chips}</div>
        <div class="dashboard-reco-bottom">
          <p><strong>Budget:</strong> <span class="muted">${window.AppUtils.formatINR(profile.preferredRentMax)} / month</span></p>
          <a class="btn btn-primary" href="${roommateDetailUrl}">View Details</a>
        </div>
      </div>
    </article>
  `
}

function normalizeCollegeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/university|college|institute|campus|school/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function scoreRoommateMatch(roommate, studentProfile) {
  const preferred = {
    cleanliness: Number(studentProfile?.personality?.cleanliness || 5),
    socialLevel: Number(studentProfile?.personality?.socialLevel || 5),
    studyHabits: Number(studentProfile?.personality?.studyHabits || 5),
  }

  const roommatePersonality = roommate?.personality || {}
  const personalityScore =
    Math.max(0, 10 - Math.abs(Number(roommatePersonality.cleanliness || 5) - preferred.cleanliness)) +
    Math.max(0, 10 - Math.abs(Number(roommatePersonality.socialLevel || 5) - preferred.socialLevel)) +
    Math.max(0, 10 - Math.abs(Number(roommatePersonality.studyHabits || 5) - preferred.studyHabits))

  const myInterests = Array.isArray(studentProfile?.interests)
    ? studentProfile.interests.map((item) => String(item || "").toLowerCase()).filter(Boolean)
    : []
  const roommateInterests = Array.isArray(roommate?.interests)
    ? roommate.interests.map((item) => String(item || "").toLowerCase()).filter(Boolean)
    : []
  const sharedInterests = [...new Set(myInterests.filter((item) => roommateInterests.includes(item)))]
  const interestScore = Math.min(sharedInterests.length * 2, 10)

  const myCollege = normalizeCollegeText(studentProfile?.university)
  const roommateCollege = normalizeCollegeText(roommate?.institution?.address || roommate?.address)
  const sameCollege =
    Boolean(myCollege) && Boolean(roommateCollege) && (roommateCollege.includes(myCollege) || myCollege.includes(roommateCollege))

  const baseScore = personalityScore + interestScore
  const include = sameCollege || (myInterests.length ? sharedInterests.length > 0 : baseScore >= 18)

  return {
    include,
    sameCollege,
    baseScore,
    matchPercent: Math.max(0, Math.min(100, Math.round((baseScore / 40) * 100))),
    sharedInterests,
  }
}

function buildMatchedStudentListingCard(profile, match) {
  const chips = (match?.sharedInterests || []).slice(0, 4).map((item) => `<span class="chip">${item}</span>`).join("")
  const roommateDetailUrl = `/roommate/${encodeURIComponent(profile.id)}`
  const imageUrl = resolveImageUrl(profile.images?.[0] || "/assets/modern-apartment-living.png")
  return `
    <article class="dashboard-reco-card">
      <div class="dashboard-reco-image-wrap">
        <img src="${imageUrl}" alt="${profile.name}" class="dashboard-reco-image" onerror="this.onerror=null;this.src='/assets/modern-apartment-living.png';" />
        <span class="dashboard-type">Student Listing</span>
      </div>
      <div class="dashboard-reco-content">
        <h3>${profile.name}</h3>
        <p class="muted">${profile.course || "Student"}</p>
        <p class="muted text-justify">${profile.bio || "Student listing"}</p>
        <div class="chip-list">${chips}</div>
        <div class="dashboard-reco-bottom">
          <p><strong>Budget:</strong> <span class="muted">${window.AppUtils.formatINR(profile.preferredRentMax)} / month</span></p>
          <a class="btn btn-primary" href="${roommateDetailUrl}">View Details</a>
        </div>
      </div>
    </article>
  `
}

function buildRecommendationCard(flat, isOwner = false) {
  const chips = (flat.amenities || []).slice(0, 3).map((item) => `<span class="chip">${item}</span>`).join("")
  const badge = flat.flatType === "room-only" ? "Room Only" : "Room with Roommates"
  const stats = flat.stats || {}
  // Show current occupants for shared rooms (students only)
  let occupantInfo = ""
  if (flat.flatType === "room-with-roommates") {
    const current = Array.isArray(flat.roommates) ? flat.roommates.length : 0;
    const max = flat.maxOccupants || 1;
    occupantInfo = `<p>Current Occupants: <strong>${current}</strong></p><p>Vacancies: <strong>${Math.max(0, max - current)}</strong></p>`
  }
  const ownerStats = isOwner
    ? `
      <div class="chip-list">
        <button class="btn btn-light small-btn" type="button">💬 ${Number(stats.uniqueMessageUsers || 0)} users messaged</button>
        <button class="btn btn-light small-btn" type="button">👁️ ${Number(stats.views || 0)} views</button>
        <button class="btn btn-light small-btn" type="button">❤️ ${Number(stats.likes || 0)} likes</button>
        <button class="btn btn-light small-btn" type="button">${
          stats.isSold ? `✅ Sold to ${stats.purchasedByName || "buyer"}` : "🟢 Available"
        }</button>
      </div>
    `
    : ""

  const matchBadge = isOwner ? "Your Listing" : ""
  const imageUrl = resolveImageUrl(flat.images?.[0] || "/assets/modern-apartment-living.png")
  return `
    <article class="dashboard-reco-card">
      <div class="dashboard-reco-image-wrap">
        <img src="${imageUrl}" alt="${cleanQuotes(flat.title)}" class="dashboard-reco-image" onerror="this.onerror=null;this.src='/assets/modern-apartment-living.png';" />
        ${isOwner ? `<span class="dashboard-match">${matchBadge}</span>` : ""}
        <span class="dashboard-type">${badge}</span>
      </div>
      <div class="dashboard-reco-content">
        <h3>${cleanQuotes(flat.title)}</h3>
        <p class="muted text-justify">${cleanQuotes(flat.description)}</p>
        <p class="muted">📍 ${flat.location?.address || ""}</p>
        ${occupantInfo}
        ${ownerStats}
        <div class="chip-list">${chips}</div>
        <div class="dashboard-reco-bottom">
          <p><strong>${window.AppUtils.formatINR(flat.rent)}</strong> <span class="muted">per month</span></p>
          <a class="btn btn-primary" href="/flat/${flat.id}">View Details</a>
        </div>
      </div>
    </article>
  `
}

// Helper to resolve image URLs for backend-served uploads
function resolveImageUrl(url) {
  if (!url) return "/assets/modern-apartment-living.png";
  if (url.startsWith("/uploads/")) {
    return "http://localhost:4001" + url;
  }
  return url;
}

// Utility to clean all types of quotes from anywhere in a string
function cleanQuotes(str) {
  return String(str || '').replace(/["'“”‘’]/g, '').trim();
}

async function loadDashboard() {
  if (!currentUser) {
    return
  }

  try {
    const profile = await window.AppUtils.api(`/api/profile/${currentUser.id}`)
    let activity = {
      profileViews: 0,
      savedFlats: 0,
      messages: 0,
    }
    try {
      activity = await window.AppUtils.api(`/api/dashboard/activity/${currentUser.id}`)
    } catch {
      activity = {
        profileViews: 0,
        savedFlats: 0,
        messages: 0,
      }
    }
    const dashboardMode = resolveDashboardMode({
      role: profile.role || currentUser.role,
      intent: profile.intent || currentUser.intent,
      preferredRoomType: profile.preferredRoomType || currentUser.preferredRoomType,
    });
    const isOwner = dashboardMode === "owner";
    let data = [];
    if (isOwner) {
      data = await window.AppUtils.api(`/api/list/owner/${encodeURIComponent(currentUser.id)}`);
    } else {
      data = await window.AppUtils.api("/api/flats");
    }

    welcomeTitle.textContent = `Welcome back, ${profile.name || "Student"}!`
    profileRole.textContent = profile.role === "owner" ? "Owner" : "Student"
    memberSince.textContent = new Date().toLocaleDateString("en-IN")
    subscriptionStatus.textContent = profile.subscription?.active ? profile.subscription.plan : "Free"

    activityList.innerHTML = `
      <li>👁️ Profile Views <strong>${Number(activity?.profileViews || 0)}</strong></li>
      <li>💚 Saved Flats <strong>${Number(activity?.savedFlats || 0)}</strong></li>
      <li>💬 Messages <strong>${Number(activity?.messages || 0)}</strong></li>
    `

    if (!data.length) {
      dashboardRecommendations.innerHTML = isOwner
        ? "<p class='muted'>You have not listed any property yet.</p>"
        : "<p class='muted'>No owner listings available yet.</p>";
      return;
    }

    const titleNode = document.querySelector(".dashboard-main-col .results-header h2")
    const subtitleNode = document.querySelector(".dashboard-main-col .results-header .status-text")
    const descNode = document.querySelector(".dashboard-main-col .muted")

    if (isOwner) {
      if (titleNode) {
        titleNode.textContent = "Your Listings";
      }
      if (subtitleNode) {
        subtitleNode.textContent = "Owner dashboard";
      }
      if (descNode) {
        descNode.textContent = "Only your posted properties are shown here";
      }
      dashboardRecommendations.innerHTML = data.map((flat) => buildRecommendationCard(flat, true)).join("");
    } else {
      if (titleNode) {
        titleNode.textContent = "Owner Listings";
      }
      if (subtitleNode) {
        subtitleNode.textContent = "Student dashboard";
      }
      if (descNode) {
        descNode.textContent = "All owner-listed flats are shown here";
      }
      dashboardRecommendations.innerHTML = data.map((flat) => buildRecommendationCard(flat, false)).join("");
    }
  } catch (error) {
    dashboardStatus.textContent = error.message
  }
}

loadDashboard()
