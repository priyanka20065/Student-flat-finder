// Helper to resolve image URLs for backend-served uploads
function resolveImageUrl(url) {
  if (!url) return "/assets/modern-apartment-living.png";
  if (url.startsWith("/uploads/")) {
    return "http://localhost:4001" + url;
  }
  return url;
}

const flatGrid = document.getElementById("flatGrid")
const resultCount = document.getElementById("resultCount")
const applyFiltersButton = document.getElementById("applyFilters")
let browseStream

const controls = {
  searchInput: document.getElementById("searchInput"),
  flatType: document.getElementById("flatType"),
  minRent: document.getElementById("minRent"),
  maxRent: document.getElementById("maxRent"),
}

function applyQueryPreferences() { 
  const params = new URLSearchParams(window.location.search)
  const flatType = params.get("flatType")
  const query = String(params.get("q") || "").trim()

  if (flatType && controls.flatType) {
    controls.flatType.value = flatType
  }

  if (query && controls.searchInput) {
    controls.searchInput.value = query
  }
}

function renderRooms(flats) {
  if (!Array.isArray(flats) || !flats.length) {
    flatGrid.innerHTML = '<p class="empty-state">No rooms found. Try different filters.</p>';
    resultCount.textContent = "0 results";
    return;
  }

  flatGrid.innerHTML = flats
    .map((flat) => {
      const mapHref = flat.location && flat.location.coordinates && flat.location.coordinates.length === 2
        ? `https://www.google.com/maps/search/?api=1&query=${flat.location.coordinates[0]},${flat.location.coordinates[1]}`
        : flat.location && flat.location.address
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(flat.location.address)}`
          : "#";
      return `
      <article class="flat-card">
        <img src="${resolveImageUrl(flat.images?.[0])}" alt="${flat.title}" class="flat-image" onerror="this.onerror=null;this.src='/assets/modern-apartment-living.png';" />
        <div class="flat-content">
          <h3>${flat.title || "Untitled Flat"}</h3>
          <p class="muted" style="margin-top: -0.25rem;"><small>${flat.location?.address || "Location not specified"}</small></p>
          <p class="text-justify" style="font-size: 0.9rem; line-height: 1.4;">${flat.description || "No description provided."}</p>
          <div style="margin: 0.5rem 0;">
            <span class="muted" style="font-size: 0.8rem;">Rent:</span>
            <span class="price-tag">${window.AppUtils.formatINR(flat.rent)}</span>
          </div>
          <div class="card-footer">
            <a class="btn btn-secondary small-btn" style="flex: 1; text-align: center;" href="${mapHref}" target="_blank" rel="noreferrer">Map</a>
            <a class="btn btn-primary small-btn" style="flex: 1.5; text-align: center; margin-left: 0.5rem;" href="/flat/${encodeURIComponent(flat.id)}">Details</a>
          </div>
        </div>
      </article>
      `;
    })
    .join("");

  resultCount.textContent = `${flats.length} result${flats.length > 1 ? "s" : ""}`;
}

// Patch for roommate card: add 'Shared Room' label
function renderRoommates(roommates) {
  if (!Array.isArray(roommates) || !roommates.length) {
    flatGrid.innerHTML = '<p class="empty-state">No roommates found. Try different filters.</p>';
    resultCount.textContent = "0 results";
    return;
  }

  flatGrid.innerHTML = roommates
    .map((roommate) => {
      return `
      <article class="flat-card">
        <img src="${resolveImageUrl(roommate.images?.[0])}" alt="${roommate.name}" class="flat-image" onerror="this.onerror=null;this.src='/assets/modern-apartment-living.png';" />
        <div class="flat-content">
          <h3>${roommate.name}</h3>
          <span class="trait-label" style="color: #007bff; font-weight: bold;">Shared Room</span>
          <p class="muted" style="margin-top: -0.25rem;"><small>${roommate.address || "Location not specified"}</small></p>
          <p class="text-justify" style="font-size: 0.9rem; line-height: 1.4;">${roommate.bio || "No bio provided."}</p>
          <div style="margin: 0.5rem 0;">
            <span class="muted" style="font-size: 0.8rem;">Max Budget:</span>
            <span class="price-tag">${window.AppUtils.formatINR(roommate.preferredRentMax)}</span>
          </div>
          <div class="card-footer">
            <a class="btn btn-primary small-btn" style="flex: 1.5; text-align: center;" href="/roommate/${encodeURIComponent(roommate.id)}">Details</a>
          </div>
        </div>
      </article>
      `;
    })
    .join("");

  resultCount.textContent = `${roommates.length} result${roommates.length > 1 ? "s" : ""}`;
}



async function loadData() {
  const params = new URLSearchParams({
    q: controls.searchInput.value.trim(),
    minRent: controls.minRent.value || "0",
    maxRent: controls.maxRent.value || "999999",
    flatType: controls.flatType.value
  })
  const response = await fetch(`/api/flats?${params.toString()}`)
  if (!response.ok) {
    flatGrid.innerHTML = '<p class="empty-state">Failed to load rooms.</p>'
    resultCount.textContent = "Error"
    return
  }
  const flats = await response.json()
  renderRooms(flats)
}


applyFiltersButton.addEventListener("click", loadData)

window.addEventListener("DOMContentLoaded", async () => {
  // Prefill filters from user profile if available
  const user = window.AppUtils?.getCurrentUser?.() || null;
  if (user && user.id) {
    try {
      const profile = await window.AppUtils.api(`/api/profile/${user.id}`);
      if (profile) {
        if (controls.cleanliness && profile.personality?.cleanliness)
          controls.cleanliness.value = profile.personality.cleanliness;
        if (controls.socialLevel && profile.personality?.socialLevel)
          controls.socialLevel.value = profile.personality.socialLevel;
        if (controls.studyHabits && profile.personality?.studyHabits)
          controls.studyHabits.value = profile.personality.studyHabits;
        if (controls.interest && Array.isArray(profile.interests))
          controls.interest.value = profile.interests.join(", ");
        if (controls.minRent && profile.preferredRentMin)
          controls.minRent.value = profile.preferredRentMin;
        if (controls.maxRent && profile.preferredRentMax)
          controls.maxRent.value = profile.preferredRentMax;
        if (controls.flatType && profile.preferredRoomType) {
          const preferred = String(profile.preferredRoomType || "").toLowerCase();
          controls.flatType.value = preferred === "both" ? "all" : preferred;
        }
      }
    } catch {}
  }
  applyQueryPreferences();
  loadData();

  browseStream = new EventSource("/api/stream/browse");
  browseStream.addEventListener("browse-update", () => {
    loadData();
  });
});

window.addEventListener("beforeunload", () => {
  if (browseStream) {
    browseStream.close()
  }
})
