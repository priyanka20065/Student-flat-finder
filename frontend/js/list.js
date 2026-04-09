// Roommate image/tour file inputs and counters (may not exist if roommate form is removed)
const roommateImagesInput = null;
const roommateTourInput = null;
const roommateImagesCount = null;
const roommateTourCount = null;
// Owner image/tour file inputs and counters (may not exist if only using links)
const ownerImagesInput = document.getElementById('ownerImagesInput');
const ownerTourInput = document.getElementById('ownerTourInput');
const ownerImagesCount = document.getElementById('ownerImagesCount');
const ownerTourCount = document.getElementById('ownerTourCount');
// No-op switchTab to prevent ReferenceError (tabs not used)
function switchTab(_tab) {}
// These elements do not exist, so define as null to prevent ReferenceError
const listHeroTitle = null;
const listHeroSubtitle = null;
// Get current user from AppUtils (localStorage)
const currentUser = window.AppUtils?.getCurrentUser ? window.AppUtils.getCurrentUser() : null;
// Roommate form (may not exist if roommate listing is removed)
const roommateForm = document.getElementById('roommateForm');
// Roommate location button and address input (may not exist if roommate form is removed)
const selectRoommateLocationBtn = document.getElementById('selectRoommateLocationBtn');
const roommateAddressInput = document.getElementById('roommateAddressInput');
// Tab elements for switching between owner and roommate listing (if present)
const ownerTab = document.getElementById('ownerTab');
const roommateTab = document.getElementById('roommateTab');
// Student flat listing panel logic
const studentListingsPanel = document.getElementById("studentListingsPanel");
const studentListingsList = document.getElementById("studentListingsList");
// ...existing code...
// Prevent ReferenceErrors for editable media arrays
let ownerExistingImages = [];
let ownerExistingTours = [];
let editingImages = [];
let editingTourUrls = [];
// Prevent ReferenceErrors for roommate-related variables (even if not used)
let roommateExistingImages = [];
let roommateExistingTours = [];
let editingRoommateImages = [];
let editingRoommateTourUrls = [];
let roommateSelectedImageFiles = [];
let roommateSelectedTourFiles = [];
let editingRoommateId = "";
// Prevent ReferenceError for editingFlatId
let editingFlatId = "";
// Stub for missing function to prevent ReferenceError
function renderEditableMediaChips() {}

function renderOwnerEditableMedia() {
  renderEditableMediaChips(ownerExistingImages, editingImages, "owner-image")
  renderEditableMediaChips(ownerExistingTours, editingTourUrls, "owner-tour")
}

function renderRoommateEditableMedia() {
  renderEditableMediaChips(roommateExistingImages, editingRoommateImages, "roommate-image")
  renderEditableMediaChips(roommateExistingTours, editingRoommateTourUrls, "roommate-tour")
}

function fileKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}`
}

function mergeSelectedFiles(existing, incoming, maxCount = 20) {
  const map = new Map(existing.map((file) => [fileKey(file), file]))
  incoming.forEach((file) => {
    map.set(fileKey(file), file)
  })
  return Array.from(map.values()).slice(0, maxCount)
}

function updateOwnerFileCounters() {
  if (ownerImagesCount) {
    const existingCount = editingFlatId ? editingImages.length : 0
    ownerImagesCount.textContent = `${ownerSelectedImageFiles.length} new${editingFlatId ? ` • ${existingCount} existing` : ""}`
  }
  if (ownerTourCount) {
    const existingCount = editingFlatId ? editingTourUrls.length : 0
    ownerTourCount.textContent = `${ownerSelectedTourFiles.length} new${editingFlatId ? ` • ${existingCount} existing` : ""}`
  }
}

function bindOwnerFileInputs() {
  ownerImagesInput?.addEventListener("change", () => {
    const picked = Array.from(ownerImagesInput.files || [])
    ownerSelectedImageFiles = mergeSelectedFiles(ownerSelectedImageFiles, picked, 20)
    if (ownerImagesInput) {
      ownerImagesInput.value = ""
    }
    updateOwnerFileCounters()
  })

  ownerTourInput?.addEventListener("change", () => {
    const picked = Array.from(ownerTourInput.files || [])
    ownerSelectedTourFiles = mergeSelectedFiles(ownerSelectedTourFiles, picked, 20)
    if (ownerTourInput) {
      ownerTourInput.value = ""
    }
    updateOwnerFileCounters()
  })

  updateOwnerFileCounters()
}

function updateRoommateFileCounters() {
  if (roommateImagesCount) {
    const existingCount = editingRoommateId ? editingRoommateImages.length : 0
    roommateImagesCount.textContent = `${roommateSelectedImageFiles.length} new${editingRoommateId ? ` • ${existingCount} existing` : ""}`
  }
  if (roommateTourCount) {
    const existingCount = editingRoommateId ? editingRoommateTourUrls.length : 0
    roommateTourCount.textContent = `${roommateSelectedTourFiles.length} new${editingRoommateId ? ` • ${existingCount} existing` : ""}`
  }
}

function bindRoommateFileInputs() {
  roommateImagesInput?.addEventListener("change", () => {
    const picked = Array.from(roommateImagesInput.files || [])
    roommateSelectedImageFiles = mergeSelectedFiles(roommateSelectedImageFiles, picked, 20)
    if (roommateImagesInput) {
      roommateImagesInput.value = ""
    }
    updateRoommateFileCounters()
  })

  roommateTourInput?.addEventListener("change", () => {
    const picked = Array.from(roommateTourInput.files || [])
    roommateSelectedTourFiles = mergeSelectedFiles(roommateSelectedTourFiles, picked, 20)
    if (roommateTourInput) {
      roommateTourInput.value = ""
    }
    updateRoommateFileCounters()
  })

  updateRoommateFileCounters()
}

function resolveListingMode() {
  const role = String(currentUser?.role || "").toLowerCase();
  const intent = String(currentUser?.intent || "").toLowerCase();
  const preferredRoomType = String(currentUser?.preferredRoomType || "").toLowerCase();
  
  if (role === "owner" || intent === "owner") {
    return "owner";
  }
  
  if (role === "student" || (intent === "seeker" && preferredRoomType === "room-only")) {
    return "student";
  }
  
  if (role === "roommate" || preferredRoomType === "room-with-roommates") {
    return "roommate";
  }
  
  return "student";
}

function lockTabsForMode(mode) {
  if (mode === "owner") {
    if (ownerTab) ownerTab.classList.remove("hidden");
    if (roommateTab) roommateTab.classList.add("hidden");
    if (ownerForm) ownerForm.classList.remove("hidden");
    if (roommateForm) roommateForm.classList.add("hidden");
    if (listHeroTitle) listHeroTitle.textContent = "List Your Property";
    if (listHeroSubtitle) listHeroSubtitle.textContent = "Owner listing form";
    return;
  }
  
  if (mode === "roommate") {
    if (ownerTab) ownerTab.classList.add("hidden");
    if (roommateTab) roommateTab.classList.remove("hidden");
    if (ownerForm) ownerForm.classList.add("hidden");
    if (roommateForm) roommateForm.classList.remove("hidden");
    if (ownerListingsPanel) ownerListingsPanel.classList.add("hidden");
    if (listHeroTitle) listHeroTitle.textContent = "Create Roommate Profile";
    if (listHeroSubtitle) listHeroSubtitle.textContent = "Roommate listing form";
    prefillRoommateFormFromProfile();
    loadMyRoommateListing();
  }
}

function applyRoommateListingToForm(listing) {
  if (!roommateForm || !listing) {
    return
  }

  editingRoommateId = listing.id
  editingRoommateImages = Array.isArray(listing.images) ? listing.images : []
  editingRoommateTourUrl = listing.virtualTourUrl || null
  editingRoommateTourUrls = Array.isArray(listing.virtualTourUrls)
    ? listing.virtualTourUrls
    : listing.virtualTourUrl
      ? [listing.virtualTourUrl]
      : []
  roommateSelectedImageFiles = []
  roommateSelectedTourFiles = []
  updateRoommateFileCounters()

  const setValue = (name, value) => {
    const node = roommateForm.querySelector(`[name="${name}"]`)
    if (!node) {
      return
    }
    node.value = value ?? ""
  }

  setValue("name", listing.name)
  setValue("age", listing.age)
  setValue("course", listing.course)
  setValue("bio", listing.bio)
  setValue("preferredRentMax", listing.preferredRentMax)
  setValue("maxOccupants", listing.maxOccupants ?? 1)
  setValue("cleanliness", listing.personality?.cleanliness ?? 5)
  setValue("socialLevel", listing.personality?.socialLevel ?? 5)
  setValue("studyHabits", listing.personality?.studyHabits ?? 5)
  setValue("address", listing.location?.address || listing.address || "")
  setValue("moveInDate", listing.moveInDate || todayDateISO())

  const [lat, lng] = listing.location?.coordinates || []
  setValue("lat", lat ?? "")
  setValue("lng", lng ?? "")

  const interests = Array.isArray(listing.interests) ? listing.interests : []
  roommateForm.querySelectorAll('input[name="interest"]').forEach((checkbox) => {
    checkbox.checked = interests.includes(checkbox.value)
  })

  if (roommateSubmitBtn) {
    roommateSubmitBtn.textContent = "Update Profile"
  }

  renderRoommateEditableMedia()
}

async function loadMyRoommateListing() {
  if (!currentUser?.id) {
    return
  }

  try {
    const listings = await window.AppUtils.api(`/api/list/roommate/${encodeURIComponent(currentUser.id)}`)
    if (!Array.isArray(listings) || !listings.length) {
      editingRoommateId = ""
      editingRoommateImages = []
      editingRoommateTourUrl = null
      editingRoommateTourUrls = []
      roommateSelectedImageFiles = []
      roommateSelectedTourFiles = []
      updateRoommateFileCounters()
      if (roommateSubmitBtn) {
        roommateSubmitBtn.textContent = "Create Profile"
      }
      renderRoommateEditableMedia()
      return
    }

    applyRoommateListingToForm(listings[0])
    listStatus.textContent = "You already have one roommate listing. You can update it below."
  } catch {
    // Keep form usable if listing lookup fails
  }
}

async function prefillRoommateFormFromProfile() {
  if (!currentUser?.id || !roommateForm) {
    return
  }

  try {
    const profile = await window.AppUtils.api(`/api/profile/${currentUser.id}`)

    const setValue = (name, value) => {
      const node = roommateForm.querySelector(`[name="${name}"]`)
      if (!node || value === undefined || value === null) {
        return
      }
      node.value = value
    }

    setValue("name", profile.name || "")
    setValue("course", profile.course || "")
    setValue("bio", profile.bio || "")
    setValue("cleanliness", profile.personality?.cleanliness ?? 5)
    setValue("socialLevel", profile.personality?.socialLevel ?? 5)
    setValue("studyHabits", profile.personality?.studyHabits ?? 5)

    const profileInterests = Array.isArray(profile.interests) ? profile.interests.map((item) => String(item)) : []
    if (profileInterests.length) {
      roommateForm.querySelectorAll('input[name="interest"]').forEach((checkbox) => {
        checkbox.checked = profileInterests.includes(checkbox.value)
      })
    }
  } catch {
    // Keep form editable even if profile prefill fails
  }
}

// switchTab: roommate logic removed

function applyUserFlow() {
  if (!currentUser?.id) {
    window.location.href = "/login";
    return;
  }
  
  const listingMode = resolveListingMode();
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  
  // Always try to load student flat listing if user is a student or roommate
  if (listingMode === "student" || listingMode === "roommate") {
    loadStudentFlatListing();
  }
  
  if (mode === "owner" && listingMode === "owner") {
    lockTabsForMode("owner");
    switchTab("owner");
    loadOwnerListings();
    return;
  }
  
  if (mode === "roommate" && listingMode === "roommate") {
    lockTabsForMode("roommate");
    switchTab("roommate");
    return;
  }
  
  if (listingMode === "owner") {
    lockTabsForMode("owner");
    switchTab("owner");
    loadOwnerListings();
    return;
  }
  
  if (listingMode === "roommate") {
    lockTabsForMode("roommate");
    switchTab("roommate");
  }
}

async function loadOwnerListings() {
  if (!currentUser?.id || currentUser.intent !== "owner") {
    ownerListingsPanel?.classList.add("hidden")
    return
  }

  ownerListingsPanel?.classList.remove("hidden")

  try {
    const listings = await window.AppUtils.api(`/api/list/owner/${currentUser.id}`)
    if (!Array.isArray(listings) || !listings.length) {
      ownerListingsList.innerHTML = '<p class="muted">No flats listed yet.</p>'
      return
    }

    ownerListingsList.innerHTML = listings
      .map(
        (flat) => {
          // Debug log to inspect flat object
          console.log('[DEBUG] Rendering owner listing card:', flat);
          const isShared = flat.maxOccupants && flat.maxOccupants > 1;
          // Only count students (roommates), never owner
          const current = Number.isFinite(Number(flat.stats?.currentOccupants))
            ? Number(flat.stats.currentOccupants)
            : (Array.isArray(flat.roommates) ? flat.roommates.length : 0)
          const max = flat.maxOccupants || 1;
          const vacancies = Math.max(0, max - current);
          const saleStatusLabel = isShared
            ? (flat.stats?.isSold ? "✅ Sold" : "🟢 Available")
            : (flat.stats?.isSold ? `✅ Sold to ${flat.stats?.purchasedByName || "buyer"}` : "🟢 Available")
          // Add a direct URL to view the flat listing
          const flatUrl = `/browse?flatId=${encodeURIComponent(flat.id)}`;
          return `
          <article class="conversation-card" data-flat-id="${flat.id}">
            <div class="conversation-content">
              <h3>${flat.title}</h3>
              <p class="muted">${flat.location.address}</p>
              <p><strong>${window.AppUtils.formatINR(flat.rent)}</strong> / month</p>
              <p>Room Type: <strong>${isShared ? "Shared" : "Single"}</strong></p>
              <p>Sale Status: <strong>${saleStatusLabel}</strong></p>
              ${isShared ? `<p>Current Occupants: <strong>${current}</strong></p>` : ""}
              ${isShared ? `<p>Vacancies: <strong>${vacancies}</strong></p>` : ""}
              <p><a href="${flatUrl}" class="btn btn-link" target="_blank">View Your Listing</a></p>
            </div>
            <div class="chip-list">
              <button class="btn btn-light small-btn" type="button" data-edit-flat="${flat.id}">Update</button>
              <button class="btn btn-dark small-btn" type="button" data-delete-flat="${flat.id}">Delete</button>
            </div>
          </article>
          `;
        }
      )
      .join("")

    ownerListingsList.querySelectorAll("[data-edit-flat]").forEach((button) => {
      button.addEventListener("click", () => {
        const flat = listings.find((item) => item.id === button.dataset.editFlat)
        if (!flat) {
          return
        }

        // Set owner name field so it is not lost on update (now in correct scope)
        const ownerNameInput = ownerForm.querySelector('input[name="ownerName"]')
        if (ownerNameInput) {
          ownerNameInput.value = flat.ownerName || currentUser?.name || "Owner"
        }

        editingFlatId = flat.id
        editingImages = Array.isArray(flat.images) ? flat.images : []
        editingTourUrls = Array.isArray(flat.virtualTourUrls)
          ? flat.virtualTourUrls
          : flat.virtualTourUrl
            ? [flat.virtualTourUrl]
            : []

        ownerForm.querySelector('input[name="title"]').value = flat.title || ""
        ownerForm.querySelector('textarea[name="description"]').value = flat.description || ""
        ownerForm.querySelector('input[name="address"]').value = flat.location?.address || ""
        ownerForm.querySelector('input[name="rent"]').value = flat.rent || ""
        // Set the correct radio button for flatType
        const flatTypeValue = flat.flatType || "room-only";
        // Map backend value to frontend value for radio selection
        let frontendFlatType = flatTypeValue;
        if (flatTypeValue === 'room-with-roommates') frontendFlatType = 'shared-room';
        ownerForm.querySelectorAll('input[name="flatType"]').forEach(radio => {
          radio.checked = radio.value === frontendFlatType;
        });
        // Show/hide shared room fields and set maxOccupants if shared
        const sharedRoomFields = document.getElementById('sharedRoomFields');
        if (flatTypeValue === 'shared-room') {
          if (sharedRoomFields) sharedRoomFields.style.display = '';
          const maxOccInput = sharedRoomFields?.querySelector('input[name="maxOccupants"]');
          if (maxOccInput) maxOccInput.value = flat.maxOccupants || 2;
        } else {
          if (sharedRoomFields) sharedRoomFields.style.display = 'none';
        }
        ownerForm.querySelector('input[name="availableFrom"]').value = flat.availableFrom || ""

        const [lat, lng] = flat.location?.coordinates || []
        ownerForm.querySelector('input[name="lat"]').value = lat ?? ""
        ownerForm.querySelector('input[name="lng"]').value = lng ?? ""

        ownerForm.querySelectorAll('input[name="amenities"]').forEach((checkbox) => {
          checkbox.checked = (flat.amenities || []).includes(checkbox.value)
        })

        // Populate image and tour URL fields with current values
        const ownerImagesLinks = document.getElementById("ownerImagesLinks")
        if (ownerImagesLinks) {
          ownerImagesLinks.value = (Array.isArray(flat.images) ? flat.images : []).join(", ")
        }
        const ownerTourLinks = document.getElementById("ownerTourLinks")
        if (ownerTourLinks) {
          ownerTourLinks.value = (Array.isArray(flat.virtualTourUrls)
            ? flat.virtualTourUrls
            : flat.virtualTourUrl
              ? [flat.virtualTourUrl]
              : []
          ).join(", ")
        }

        if (ownerSubmitBtn) {
          ownerSubmitBtn.textContent = "Update Property"
        }

        ownerSelectedImageFiles = []
        ownerSelectedTourFiles = []
        updateOwnerFileCounters()
        renderOwnerEditableMedia()

        listStatus.textContent = "Editing listing. Keep minimum 2 normal photos and 2 panoramic photos."
        switchTab("owner")
        window.scrollTo({ top: 0, behavior: "smooth" })
      })
    })

    ownerListingsList.querySelectorAll("[data-delete-flat]").forEach((button) => {
      button.addEventListener("click", async () => {
        const flatId = button.dataset.deleteFlat
        if (!flatId) {
          return
        }

        if (!window.confirm("Delete this listing? This will also remove related chats.")) {
          return
        }

        try {
          await window.AppUtils.api(`/api/list/owner/${flatId}?ownerId=${encodeURIComponent(currentUser.id)}`, {
            method: "DELETE",
          })

          if (editingFlatId === flatId) {
            editingFlatId = ""
            editingImages = []
            editingTourUrls = []
            ownerSelectedImageFiles = []
            ownerSelectedTourFiles = []
            ownerForm.reset()
            updateOwnerFileCounters()
            renderOwnerEditableMedia()
            if (ownerSubmitBtn) {
              ownerSubmitBtn.textContent = "List Property"
            }
          }

          listStatus.textContent = "Listing deleted successfully."
          loadOwnerListings()
        } catch (error) {
          listStatus.textContent = error.message
        }
      })
    })
  } catch (error) {
    ownerListingsList.innerHTML = `<p class="muted">${error.message}</p>`
  }
}

if (ownerTab) ownerTab.addEventListener("click", () => switchTab("owner"))
if (roommateTab) roommateTab.addEventListener("click", () => switchTab("roommate"))

document.addEventListener("click", (event) => {
  const target = event.target
  if (!(target instanceof HTMLElement)) {
    return
  }

  const removeType = target.dataset.removeType
  const removeIndex = Number(target.dataset.removeIndex)
  if (!removeType || Number.isNaN(removeIndex)) {
    return
  }

  if (removeType === "owner-image") {
    editingImages = editingImages.filter((_item, index) => index !== removeIndex)
    updateOwnerFileCounters()
    renderOwnerEditableMedia()
    return
  }

  if (removeType === "owner-tour") {
    editingTourUrls = editingTourUrls.filter((_item, index) => index !== removeIndex)
    updateOwnerFileCounters()
    renderOwnerEditableMedia()
    return
  }

  if (removeType === "roommate-image") {
    editingRoommateImages = editingRoommateImages.filter((_item, index) => index !== removeIndex)
    updateRoommateFileCounters()
    renderRoommateEditableMedia()
    return
  }

  if (removeType === "roommate-tour") {
    editingRoommateTourUrls = editingRoommateTourUrls.filter((_item, index) => index !== removeIndex)
    editingRoommateTourUrl = editingRoommateTourUrls[0] || null
    updateRoommateFileCounters()
    renderRoommateEditableMedia()
  }
})

async function uploadImages(files, tourFiles) {
  const formData = new FormData()
  files.slice(0, 20).forEach((file) => {
    formData.append("images", file)
  })

  tourFiles.slice(0, 20).forEach((file) => {
    formData.append("tour360", file)
  })

  const response = await fetch(window.AppUtils.resolveBackendUrl("/api/upload/images"), {
    method: "POST",
    body: formData,
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.message || "Image upload failed")
  }

  return payload
}

function parseOptionalNumber(value) {
  const normalized = String(value || "").trim()
  if (!normalized) {
    return undefined
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

selectLocationBtn?.addEventListener("click", () => {
  const address = String(ownerAddressInput?.value || "").trim()
  const target = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : "https://www.google.com/maps"

  window.open(target, "_blank", "noopener,noreferrer")
  listStatus.textContent = "Map opened. Copy coordinates and paste in Latitude/Longitude if needed."
})

selectRoommateLocationBtn?.addEventListener("click", () => {
  const address = String(roommateAddressInput?.value || "").trim()
  const target = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : "https://www.google.com/maps"

  window.open(target, "_blank", "noopener,noreferrer")
  listStatus.textContent = "Map opened. Copy coordinates and paste in Latitude/Longitude if needed."
})

ownerForm.addEventListener("submit", async (event) => {
  console.log("[DEBUG] OWNER FORM SUBMIT HANDLER TRIGGERED");
  event.preventDefault()
  const formData = new FormData(ownerForm)
  const selectedAmenities = Array.from(ownerForm.querySelectorAll('input[name="amenities"]:checked')).map(
    (checkbox) => checkbox.value,
  )

  // Get selected flatType
  const flatType = formData.get("flatType") || "room-only";
  // Map frontend value to backend value
  let backendFlatType = flatType;
  if (flatType === "shared-room") backendFlatType = "room-with-roommates";
  // Log for debugging mapping
  console.log("[OWNER LISTING] Selected flatType:", flatType, "| Backend flatType:", backendFlatType);
  // Get maxOccupants if shared-room, else default to 1
  let maxOccupants = 1;
  if (flatType === "shared-room") {
    maxOccupants = Number(formData.get("maxOccupants")) || 2;
  }

  // Parse image links robustly
  const images = (ownerImagesLinks.value || "")
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.length > 0)
  // Debug output
  console.log("[DEBUG] OWNER FORM SUBMIT. Parsed images array:", images)
  const virtualTourUrls = (ownerTourLinks.value || "")
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.length > 0)

  const payload = {
    ownerId: String(currentUser?.id || "").trim() || undefined,
    ownerEmail: String(currentUser?.email || "").trim() || undefined,
    ownerName: String(formData.get("ownerName") || currentUser?.name || "Owner").trim(),
    title: String(formData.get("title") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    address: String(formData.get("address") || "").trim(),
    lat: parseOptionalNumber(formData.get("lat")),
    lng: parseOptionalNumber(formData.get("lng")),
    rent: Number(formData.get("rent") || 0),
    flatType: backendFlatType,
    maxOccupants,
    availableFrom: String(formData.get("availableFrom") || ""),
    amenities: selectedAmenities,
    images,
    virtualTourUrls,
    virtualTourUrl: virtualTourUrls[0] || null,
  }

  try {
    if (payload.images.length < 2) {
      listStatus.textContent = "Please provide at least 2 flat photo links (comma separated)."
      return
    }
    if (payload.virtualTourUrls.length < 2) {
      listStatus.textContent = "Please provide at least 2 panoramic 360 photo links (comma separated)."
      return
    }

    if (editingFlatId) {
      await window.AppUtils.api(`/api/list/owner/${editingFlatId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
      listStatus.textContent = "Listing updated successfully."
      // Do NOT reset form or clear editing state after update
      // Optionally, reload listings to reflect changes
      loadOwnerListings()
    } else {
      await window.AppUtils.api("/api/list/owner", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      listStatus.textContent = "Owner listing submitted. It is now visible in Browse → Rooms."
      ownerForm.reset()
      editingFlatId = ""
      editingImages = []
      editingTourUrls = []
      if (ownerSubmitBtn) {
        ownerSubmitBtn.textContent = "List Property"
      }
      switchTab("owner")
      loadOwnerListings()
    }
  } catch (error) {
    listStatus.textContent = error.message
  }
})




applyUserFlow()
bindOwnerFileInputs()
bindRoommateFileInputs()
renderOwnerEditableMedia()
renderRoommateEditableMedia()

applyUserFlow()
bindOwnerFileInputs()
bindRoommateFileInputs()
renderOwnerEditableMedia()
renderRoommateEditableMedia()

// Robust: Show/hide shared room fields based on property type
function setupSharedRoomFields() {
  const flatTypeRadios = document.querySelectorAll('input[name="flatType"]');
  const sharedRoomFields = document.getElementById('sharedRoomFields');
  if (!flatTypeRadios.length || !sharedRoomFields) return;
  function updateSharedRoomFields() {
    const selected = Array.from(flatTypeRadios).find(r => r.checked)?.value;
    sharedRoomFields.style.display = selected === 'shared-room' ? '' : 'none';
    // Toggle required attribute for maxOccupants
    const maxOccupantsInput = sharedRoomFields.querySelector('input[name="maxOccupants"]');
    if (maxOccupantsInput) {
      if (selected === 'shared-room') {
        maxOccupantsInput.required = true;
      } else {
        maxOccupantsInput.required = false;
        maxOccupantsInput.value = '';
      }
    }
  }
  flatTypeRadios.forEach(radio => {
    radio.addEventListener('change', updateSharedRoomFields);
  });
  updateSharedRoomFields();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupSharedRoomFields);
} else {
  setupSharedRoomFields();
}
