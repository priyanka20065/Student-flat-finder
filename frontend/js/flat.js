// Helper to resolve image URLs for backend-served uploads
function resolveImageUrl(url) {
  if (!url) return "/assets/modern-apartment-living.png";
  if (url.startsWith("/uploads/")) {
    return window.AppUtils.resolveBackendUrl(url);
  }
  return url;
}

// Utility to clean all types of quotes from start/end of a string
function cleanQuotes(str) {
  return String(str || '').replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
}

const container = document.getElementById("flatDetail")
const modalBackdrop = document.getElementById("modalBackdrop")
const chatModal = document.getElementById("chatModal")
const bookModal = document.getElementById("bookModal")

const FREE_CHAT_LIMIT = 5
let activeFlat = null
let currentUser = window.AppUtils.getCurrentUser()
let galleryTimer = null
let galleryIndex = 0
let galleryImages = []
let galleryAutoplayStopped = false
let galleryDragStartX = null
let panoramaViewer = null
let panoramaResumeTimer = null
let panoramaFullscreenHandler = null

const PANORAMA_AUTO_ROTATE_SPEED = -2
const PANORAMA_RESUME_DELAY_MS = 1200
const PANORAMA_DEFAULT_VIEW = {
  yaw: 0,
  pitch: 0,
  hfov: 110,
}

function isImageTourUrl(url) {
  if (!url) {
    return false
  }

  const normalized = String(url).toLowerCase().split("?")[0].split("#")[0]
  return normalized.endsWith(".jpg") || normalized.endsWith(".jpeg") || normalized.endsWith(".png")
}

function closeModal() {
  modalBackdrop.classList.add("hidden")
  chatModal.classList.add("hidden")
  bookModal.classList.add("hidden")
}

function openModal(modal) {
  modalBackdrop.classList.remove("hidden")
  modal.classList.remove("hidden")
}

function getChatCountForCurrentUser(messages) {
  if (!currentUser?.id) {
    return 0
  }
  return messages.filter((message) => message.senderUserId === currentUser.id).length
}

function getVisibleFlatChatMessages(flat, messages) {
  if (!Array.isArray(messages) || !currentUser?.id) {
    return []
  }

  const isOwnListingOwner = String(currentUser.id || "") === String(flat.ownerId || "")
  if (isOwnListingOwner) {
    return messages
  }

  return messages.filter((message) => {
    const senderUserId = String(message.senderUserId || "")
    const recipientUserId = String(message.recipientUserId || "")
    return (
      senderUserId === String(currentUser.id || "") ||
      recipientUserId === String(currentUser.id || "") ||
      (senderUserId === String(flat.ownerId || "") && recipientUserId === String(currentUser.id || ""))
    )
  })
}

function stopGalleryAutoplay() {
  galleryAutoplayStopped = true
  if (galleryTimer) {
    clearInterval(galleryTimer)
    galleryTimer = null
  }
}

function openImageLightbox(imageUrl, title) {
  const lightbox = document.getElementById("flatImageLightbox")
  const lightboxImage = document.getElementById("flatLightboxImage")
  if (!lightbox || !lightboxImage) {
    return
  }
  lightboxImage.src = imageUrl
  lightboxImage.alt = title
  lightbox.classList.remove("hidden")
}

function closeImageLightbox() {
  const lightbox = document.getElementById("flatImageLightbox")
  lightbox?.classList.add("hidden")
}

function renderGalleryFrame(title) {
  const mainImage = document.getElementById("flatMainImage")
  const thumbButtons = Array.from(document.querySelectorAll(".flat-thumb-item"))
  if (!mainImage || !galleryImages.length) {
    return
  }

  const activeImage = galleryImages[galleryIndex]
  mainImage.src = activeImage
  mainImage.alt = title
  thumbButtons.forEach((button, index) => {
    button.classList.toggle("active-thumb", index === galleryIndex)
  })
}

function moveGallery(step, title) {
  if (!galleryImages.length) {
    return
  }
  galleryIndex = (galleryIndex + step + galleryImages.length) % galleryImages.length
  renderGalleryFrame(title)
}

function startGalleryAutoplay(title) {
  if (galleryImages.length <= 1 || galleryAutoplayStopped) {
    return
  }

  if (galleryTimer) {
    clearInterval(galleryTimer)
  }

  galleryTimer = setInterval(() => {
    moveGallery(1, title)
  }, 3500)
}

function setupGallery(flat) {
  galleryImages = Array.isArray(flat.images) && flat.images.length ? flat.images : ["/assets/modern-apartment-living.png"]
  galleryIndex = 0
  galleryAutoplayStopped = false
  if (galleryTimer) {
    clearInterval(galleryTimer)
    galleryTimer = null
  }

  renderGalleryFrame(flat.title)

  const prevButton = document.getElementById("flatPrevImage")
  const nextButton = document.getElementById("flatNextImage")
  const mainImage = document.getElementById("flatMainImage")
  const mediaViewport = document.getElementById("flatMediaViewport")
  const thumbButtons = Array.from(document.querySelectorAll(".flat-thumb-item"))
  const lightbox = document.getElementById("flatImageLightbox")
  const lightboxClose = document.getElementById("flatLightboxClose")

  prevButton?.addEventListener("click", () => {
    stopGalleryAutoplay()
    moveGallery(-1, flat.title)
  })

  nextButton?.addEventListener("click", () => {
    stopGalleryAutoplay()
    moveGallery(1, flat.title)
  })

  mainImage?.addEventListener("click", () => {
    stopGalleryAutoplay()
    openImageLightbox(galleryImages[galleryIndex], flat.title)
  })

  thumbButtons.forEach((button) => {
    button.addEventListener("click", () => {
      stopGalleryAutoplay()
      galleryIndex = Number(button.dataset.index || 0)
      renderGalleryFrame(flat.title)
    })
  })

  mediaViewport?.addEventListener("pointerdown", (event) => {
    stopGalleryAutoplay()
    galleryDragStartX = event.clientX
  })

  mediaViewport?.addEventListener("pointerup", (event) => {
    if (galleryDragStartX === null) {
      return
    }
    const deltaX = event.clientX - galleryDragStartX
    galleryDragStartX = null
    if (Math.abs(deltaX) < 40) {
      return
    }
    if (deltaX < 0) {
      moveGallery(1, flat.title)
    } else {
      moveGallery(-1, flat.title)
    }
  })

  mediaViewport?.addEventListener("pointerleave", () => {
    galleryDragStartX = null
  })

  lightboxClose?.addEventListener("click", closeImageLightbox)
  lightbox?.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      closeImageLightbox()
    }
  })

  startGalleryAutoplay(flat.title)
}

function setupPanoramaAutoRotate(tourUrls, activeSceneIndex = 0) {
  if (!Array.isArray(tourUrls) || !tourUrls.length || !window.pannellum || !isImageTourUrl(tourUrls[0])) {
    return
  }

  const panoramaContainer = document.getElementById("panoramaViewer")
  if (!panoramaContainer) {
    return
  }

  if (panoramaViewer && typeof panoramaViewer.destroy === "function") {
    panoramaViewer.destroy()
  }

  const sceneIndex = Math.max(0, Math.min(activeSceneIndex, tourUrls.length - 1))
  const activeSceneUrl = tourUrls[sceneIndex]

  panoramaViewer = window.pannellum.viewer("panoramaViewer", {
    type: "equirectangular",
    panorama: resolveImageUrl(activeSceneUrl),
    autoLoad: true,
    showControls: true,
    autoRotate: PANORAMA_AUTO_ROTATE_SPEED,
    yaw: PANORAMA_DEFAULT_VIEW.yaw,
    pitch: PANORAMA_DEFAULT_VIEW.pitch,
    hfov: PANORAMA_DEFAULT_VIEW.hfov,
  })

  const stopAutoRotate = () => {
    if (panoramaResumeTimer) {
      clearTimeout(panoramaResumeTimer)
      panoramaResumeTimer = null
    }

    if (panoramaViewer && typeof panoramaViewer.stopAutoRotate === "function") {
      panoramaViewer.stopAutoRotate()
    }
  }

  const startAutoRotate = () => {
    if (!panoramaViewer || typeof panoramaViewer.startAutoRotate !== "function") {
      return
    }
    panoramaViewer.startAutoRotate(PANORAMA_AUTO_ROTATE_SPEED)
  }

  const scheduleAutoRotate = () => {
    if (panoramaResumeTimer) {
      clearTimeout(panoramaResumeTimer)
    }

    panoramaResumeTimer = setTimeout(() => {
      startAutoRotate()
    }, PANORAMA_RESUME_DELAY_MS)
  }

  const resetToDefaultView = () => {
    if (!panoramaViewer) {
      return
    }

    if (typeof panoramaViewer.setYaw === "function") {
      panoramaViewer.setYaw(PANORAMA_DEFAULT_VIEW.yaw, 1000)
    }
    if (typeof panoramaViewer.setPitch === "function") {
      panoramaViewer.setPitch(PANORAMA_DEFAULT_VIEW.pitch, 1000)
    }
    if (typeof panoramaViewer.setHfov === "function") {
      panoramaViewer.setHfov(PANORAMA_DEFAULT_VIEW.hfov, 1000)
    }
  }

  panoramaContainer.addEventListener("pointerdown", stopAutoRotate)
  panoramaContainer.addEventListener("pointermove", (event) => {
    if (event.buttons > 0) {
      stopAutoRotate()
    }
  })
  panoramaContainer.addEventListener("pointerup", scheduleAutoRotate)
  panoramaContainer.addEventListener("pointercancel", scheduleAutoRotate)
  panoramaContainer.addEventListener("mouseleave", scheduleAutoRotate)
  panoramaContainer.addEventListener("wheel", stopAutoRotate, { passive: true })
  panoramaContainer.addEventListener("wheel", scheduleAutoRotate, { passive: true })

  if (panoramaFullscreenHandler) {
    document.removeEventListener("fullscreenchange", panoramaFullscreenHandler)
  }

  panoramaFullscreenHandler = () => {
    const isViewerFullscreen = Boolean(document.fullscreenElement && panoramaContainer.contains(document.fullscreenElement))
    if (!isViewerFullscreen) {
      stopAutoRotate()
      resetToDefaultView()
      scheduleAutoRotate()
    }
  }

  document.addEventListener("fullscreenchange", panoramaFullscreenHandler)
}

function buildFlatPage(flat) {
  currentUser = window.AppUtils.getCurrentUser()

  // Prepare roommate info variables before using them
  const roommatesInfo = Array.isArray(flat.roommatesInfo) ? flat.roommatesInfo : [];
  const displayRoommates = [...roommatesInfo]
  const currentOccupants = Number.isFinite(Number(flat.stats?.currentOccupants))
    ? Number(flat.stats.currentOccupants)
    : displayRoommates.length
  let roommateTable = '';
  if (flat.flatType === "room-with-roommates") {
    const noRoommateMsg = "No roommates yet";

    roommateTable = `
      <h4 style=\"margin-top:1em;\">Current Roommates</h4>
      <table class=\"roommate-table\">
        <thead><tr>
          <th>Name</th><th>Email</th><th>Profile</th>
        </tr></thead>
        <tbody>
          ${displayRoommates.length === 0 ? `<tr><td colspan=\"3\" class=\"muted\">${noRoommateMsg}</td></tr>` :
            displayRoommates.map(rm => `
              <tr>
                <td>${cleanQuotes(rm.name) || '-'}</td>
                <td>${rm.email || '-'}</td>
                <td>${rm.email ? `<a class='btn btn-secondary btn-profile' href='/roommate/profile.html?email=${encodeURIComponent(rm.email)}'>View Profile</a>` : '-'}</td>
              </tr>
            `).join('')}
        </tbody>
      </table>
    `;
  }
  const isOwnerViewingOwnFlat = Boolean(currentUser && currentUser.role === "owner" && currentUser.id === flat.ownerId)
  const isBoughtByCurrentUser = Boolean(currentUser?.id && String(flat.stats?.purchasedByUserId || "") === String(currentUser.id))
  const isSharedBookedByCurrentUser = Boolean(
    flat.flatType === "room-with-roommates" &&
      currentUser?.id &&
      Array.isArray(flat.stats?.roommateBookedUserIds) &&
      flat.stats.roommateBookedUserIds.includes(String(currentUser.id)),
  )
  // For shared rooms, do not block booking if sold; only block for single rooms
  const isSoldToAnotherUser = flat.flatType === "room-only" ? Boolean(flat.stats?.isSold && !isBoughtByCurrentUser) : false;
  const shouldDisableBookButton = isSoldToAnotherUser || isSharedBookedByCurrentUser
  const maxOccupants = flat.maxOccupants || 1;
  const vacancies = Math.max(0, maxOccupants - currentOccupants);
  const sharedStatusLabel = isSharedBookedByCurrentUser
    ? "✅ Seat Booked by You"
    : vacancies <= 0
      ? "✅ Full"
      : currentOccupants > 0
        ? `🟠 Booked (${currentOccupants}/${maxOccupants})`
        : "🟢 Available"
  const saleStatusLabel = flat.flatType === "room-with-roommates"
    ? (flat.stats?.isSold ? "✅ Sold" : "🟢 Available")
    : (flat.stats?.isSold ? `✅ Sold to ${flat.stats?.purchasedByName || "buyer"}` : "🟢 Available")
  // Already declared above, do not redeclare here
  // For shared rooms, booking is always enabled if vacancies > 0
  const shouldShowPremiumCta = (flat.flatType === "room-only" ? !flat.stats?.isSold : vacancies > 0) && !isBoughtByCurrentUser && !isSharedBookedByCurrentUser && !currentUser?.subscription?.active
  const amenities = (flat.amenities || []).map((item) => `<span class="chip">${item}</span>`).join("")
  const roomBadge = flat.flatType === "room-only" ? "Room Only" : "Room with Roommates"
  const ownerActionStack = `
    <button class="btn btn-light" type="button">💬 Users Messaged: ${Number(flat.stats?.uniqueMessageUsers || 0)}</button>
    <button class="btn btn-light" type="button">❤️ Users Liked: ${Number(flat.stats?.likes || 0)}</button>
    <button class="btn btn-light" type="button">👁️ Views: ${Number(flat.stats?.views || 0)}</button>
    <button class="btn btn-dark" type="button">${saleStatusLabel}</button>
  `
  const studentActionStack = `
    <button id="chatOwnerBtn" class="btn btn-primary" type="button">💬 Chat with Owner</button>
    <button id="bookRoomBtn" class="btn btn-secondary" type="button" ${shouldDisableBookButton ? "disabled" : ""}>${
      isSharedBookedByCurrentUser
        ? "✅ Already Booked"
        : isBoughtByCurrentUser
          ? "✅ You Bought This Room"
          : isSoldToAnotherUser
            ? "✅ Sold"
            : "🏠 Book Room"
    }</button>
    <button id="likeFlatBtn" class="btn btn-light" type="button">❤️ Like Flat</button>
    <button id="scheduleVisitBtn" class="btn btn-dark" type="button">📞 Schedule Visit</button>
    <button class="btn btn-dark" type="button">${
      flat.flatType === "room-with-roommates"
        ? sharedStatusLabel
        : isBoughtByCurrentUser
          ? "✅ Bought by You"
          : isSoldToAnotherUser
            ? `✅ Sold to ${flat.stats?.purchasedByName || "buyer"}`
            : "🟢 Available"
    }</button>
    ${shouldShowPremiumCta ? '<a class="btn btn-premium" href="/subscription">⭐ Get Premium for 10% Off</a>' : ""}
  `

  const tourUrls = Array.isArray(flat.virtualTourUrls)
    ? flat.virtualTourUrls
    : flat.virtualTourUrl
      ? [flat.virtualTourUrl]
      : []
  const useImageTourViewer = tourUrls.length > 0 && isImageTourUrl(tourUrls[0])
  const mediaImages = Array.isArray(flat.images) && flat.images.length ? flat.images : ["/assets/modern-apartment-living.png"]
  const roommateCards = (flat.roommateProfiles || []).map(
    (roommate) => `
      <article class="flat-roommate-card ${roommate.images?.[0] ? "" : "no-avatar"}">
        ${roommate.images?.[0] ? `<img src="${resolveImageUrl(roommate.images[0])}" alt="${roommate.name}" class="flat-roommate-avatar" onerror="this.onerror=null;this.src='/assets/modern-apartment-living.png';" />` : ""}
        <div>
          <h4>${roommate.name}</h4>
          <p class="muted">${roommate.age || "-"} years • ${roommate.course || "Student"}</p>
          <p class="muted">${roommate.bio || ""}</p>
          <div class="chip-list">${(roommate.interests || []).map((interest) => `<span class="chip">${interest}</span>`).join("")}</div>
        </div>
      </article>
    `,
  )

  container.innerHTML = `
    <section class="flat-hero-card">
      <div class="flat-media-shell">
        <div class="flat-thumb-rail">
          ${mediaImages
            .map(
              (imageUrl, index) => `
                <button type="button" class="flat-thumb-item ${index === 0 ? "active-thumb" : ""}" data-index="${index}" aria-label="Open image ${index + 1}">
                  <img src="${resolveImageUrl(imageUrl)}" alt="${flat.title} thumbnail ${index + 1}" class="flat-thumb-image" onerror="this.onerror=null;this.src='/assets/modern-apartment-living.png';" />
                </button>
              `,
            )
            .join("")}
        </div>
        <div class="flat-main-media" id="flatMediaViewport">
          ${mediaImages.length > 1 ? '<button type="button" class="flat-gallery-nav flat-gallery-prev" id="flatPrevImage" aria-label="Previous image">❮</button>' : ""}
          <img id="flatMainImage" src="${resolveImageUrl(mediaImages[0])}" alt="${flat.title}" class="flat-hero-image" draggable="false" onerror="this.onerror=null;this.src='/assets/modern-apartment-living.png';" />
          ${mediaImages.length > 1 ? '<button type="button" class="flat-gallery-nav flat-gallery-next" id="flatNextImage" aria-label="Next image">❯</button>' : ""}
          <div class="flat-open-hint">Click image to open • Drag left/right to change</div>
        </div>
      </div>
    </section>

    <div id="flatImageLightbox" class="flat-image-lightbox hidden" aria-hidden="true">
      <button type="button" id="flatLightboxClose" class="flat-lightbox-close" aria-label="Close image">✕</button>
      <img id="flatLightboxImage" src="" alt="${flat.title}" class="flat-lightbox-image" />
    </div>

    <section class="flat-layout">
      <article class="card">
        <h1 class="flat-title-dark">${cleanQuotes(flat.title)}</h1>
        <p class="flat-desc-black">${cleanQuotes(flat.description)}</p>
        <p class="muted">👤 Owner: ${flat.ownerName || "Owner"}</p>
        <p><strong>${window.AppUtils.formatINR(flat.rent)}</strong> <span class="muted">per month</span></p>
        <div class="chip-list"><span class="chip">${roomBadge}</span></div>
        ${roommateTable}
      </article>

      <aside class="card">
        <h3>Interested?</h3>
        <div class="action-stack">
          ${isOwnerViewingOwnFlat ? ownerActionStack : studentActionStack}
        </div>
      </aside>
    </section>

    <section class="flat-layout">
      <article class="card">
        <h3>Amenities</h3>
        <div class="chip-list">${amenities}</div>
      </article>
      <article class="card">
        <h3>Quick Info</h3>
        <p><span class="muted">Available From:</span> <strong>${flat.availableFrom}</strong></p>
        <p><span class="muted">Room Type:</span> <strong>${flat.maxOccupants && flat.maxOccupants > 1 ? "Shared" : "Single"}</strong></p>
        <p><span class="muted">Sale Status:</span> <strong>${saleStatusLabel}</strong></p>
        ${flat.flatType === "room-with-roommates" ? `<p><span class="muted">Current Occupants:</span> <strong>${currentOccupants}</strong></p>` : ""}
        ${flat.flatType === "room-with-roommates" ? `<p><span class="muted">Vacancies:</span> <strong>${vacancies}</strong></p>` : ""}
      </article>
    </section>

    ${
      tourUrls.length
        ? useImageTourViewer
          ? `<section class="card">
               <h3>360° Virtual Tour</h3>
               <div id="panoramaViewer" style="width:100%; height:420px; border-radius:12px; overflow:hidden;"></div>
               <div class="tour-scene-strip" id="tourSceneRail">
                 ${tourUrls
                   .map(
                     (tourUrl, index) => `
                       <button type="button" class="tour-scene-thumb ${index === 0 ? "active-scene" : ""}" data-scene-index="${index}" aria-label="Open 360 scene ${index + 1}">
                         <img src="${resolveImageUrl(tourUrl)}" alt="${flat.title} 360 scene ${index + 1}" onerror="this.onerror=null;this.src='/assets/modern-apartment-living.png';" />
                         <span>Scene ${index + 1}</span>
                       </button>
                     `,
                   )
                   .join("")}
               </div>
             </section>`
          : `<section class="card">
               <h3>360° Virtual Tour</h3>
               <iframe
                 src="${tourUrls[0]}"
                 title="${flat.title} 360 tour"
                 width="100%"
                 height="420"
                 style="border:0; border-radius:12px"
                 allowfullscreen
                 loading="lazy"
                 referrerpolicy="no-referrer-when-downgrade"
               ></iframe>
             </section>`
        : ""
    }
  `

  setupGallery(flat)
  if (useImageTourViewer) {
    setupPanoramaAutoRotate(tourUrls, 0)

    const sceneButtons = Array.from(document.querySelectorAll(".tour-scene-thumb"))
    sceneButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const sceneIndex = Number(button.dataset.sceneIndex || 0)
        sceneButtons.forEach((item, index) => {
          item.classList.toggle("active-scene", index === sceneIndex)
        })
        setupPanoramaAutoRotate(tourUrls, sceneIndex)
      })
    })
  }

  if (!isOwnerViewingOwnFlat) {
    document.getElementById("chatOwnerBtn")?.addEventListener("click", () => openChatModal(flat))
    document.getElementById("bookRoomBtn")?.addEventListener("click", () => openBookModal(flat))
    document.getElementById("likeFlatBtn")?.addEventListener("click", () => toggleLike(flat))
    document.getElementById("scheduleVisitBtn")?.addEventListener("click", () => {
      window.location.href = `/chat?flatId=${flat.id}`
    })
  }
}

async function toggleLike(flat) {
  currentUser = window.AppUtils.getCurrentUser()
  if (!currentUser?.id) {
    window.location.href = "/login"
    return
  }

  if (currentUser.id === flat.ownerId) {
    window.alert("You cannot like your own listing.")
    return
  }

  try {
    const result = await window.AppUtils.api(`/api/flats/${flat.id}/like`, {
      method: "POST",
      body: JSON.stringify({ userId: currentUser.id }),
    })

    const button = document.getElementById("likeFlatBtn")
    if (button) {
      button.textContent = result.liked ? "💚 Liked" : "❤️ Like Flat"
    }
  } catch (error) {
    window.alert(error.message)
  }
}

async function openChatModal(flat) {
  currentUser = window.AppUtils.getCurrentUser()
  if (!currentUser) {
    window.location.href = "/login"
    return
  }

  if (currentUser.role === "owner" && currentUser.id === flat.ownerId) {
    window.alert("You cannot message yourself. Open Messages to reply to students for your listing.")
    window.location.href = `/chat?flatId=${flat.id}`
    return
  }

  if (currentUser.role === "owner" && currentUser.id !== flat.ownerId) {
    window.alert("As an owner, you cannot message other owners/listings. You can only reply to students on your own flat.")
    return
  }

  const allMessages = await window.AppUtils.api(`/api/chat/${flat.id}`)
  const messages = getVisibleFlatChatMessages(flat, allMessages)
  const sentCount = getChatCountForCurrentUser(messages)
  const remaining = Math.max(FREE_CHAT_LIMIT - sentCount, 0)
  const hasPremium = Boolean(currentUser.subscription?.active)

  chatModal.innerHTML = `
    <div class="modal-card">
      <div class="modal-head">
        <div>
          <h3>Chat with Property Owner</h3>
          <p class="muted">${hasPremium ? "Unlimited messages (Premium)" : `${remaining} messages remaining`}</p>
        </div>
        <button class="icon-btn" id="closeChatModal" type="button">✕</button>
      </div>
      <div class="modal-body" id="chatMessages">
        ${messages
          .slice(-20)
          .map(
            (message) => `
              <div class="${message.senderUserId === currentUser.id ? "bubble bubble-own" : "bubble bubble-peer"}">
                <p>${message.message}</p>
                <small>${new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
              </div>
            `,
          )
          .join("")}
      </div>
      <form id="chatModalForm" class="modal-form">
        <input id="chatModalInput" type="text" placeholder="Message" ${!hasPremium && remaining <= 0 ? "disabled" : ""} />
        <button class="btn btn-primary" type="submit" ${!hasPremium && remaining <= 0 ? "disabled" : ""}>Send</button>
      </form>
      <p id="chatModalStatus" class="status-text"></p>
      ${!hasPremium && remaining <= 0 ? '<p class="muted">Free limit reached. <a href="/subscription">Upgrade to premium</a> to continue.</p>' : ""}
    </div>
  `

  document.getElementById("closeChatModal")?.addEventListener("click", closeModal)

  const chatModalForm = document.getElementById("chatModalForm")
  const chatModalInput = document.getElementById("chatModalInput")
  const chatModalStatus = document.getElementById("chatModalStatus")

  chatModalForm?.addEventListener("submit", async (event) => {
    event.preventDefault()
    const message = String(chatModalInput.value || "").trim()
    if (!message) {
      return
    }

    try {
      await window.AppUtils.api(`/api/chat/${flat.id}`, {
        method: "POST",
        body: JSON.stringify({
          senderName: currentUser.name,
          senderEmail: currentUser.email,
          senderUserId: currentUser.id,
          recipientUserId: flat.ownerId || undefined,
          recipientEmail: flat.ownerEmail || undefined,
          target: "owner",
          message,
        }),
      })

      chatModalInput.value = ""
      openChatModal(flat)
    } catch (error) {
      if (/cannot message yourself/i.test(error.message || "")) {
        window.alert(error.message)
      }
      chatModalStatus.textContent = error.message
    }
  })

  openModal(chatModal)
}

async function openBookModal(flat) {
  currentUser = window.AppUtils.getCurrentUser()
  if (!currentUser) {
    window.location.href = "/login"
    return
  }


  if (flat.flatType === "room-with-roommates") {
    const alreadyBookedFromMetrics = Boolean(
      currentUser?.id &&
      Array.isArray(flat.stats?.roommateBookedUserIds) &&
      flat.stats.roommateBookedUserIds.includes(String(currentUser.id)),
    )
    if (alreadyBookedFromMetrics) {
      window.alert("You have already booked a seat in this flat.")
      return
    }

    const currentOccupants = Number.isFinite(Number(flat.stats?.currentOccupants))
      ? Number(flat.stats.currentOccupants)
      : (Array.isArray(flat.roommatesInfo) ? flat.roommatesInfo.length : (Array.isArray(flat.roommates) ? flat.roommates.length : 0));
    const maxOccupants = flat.maxOccupants || 1;
    if (currentOccupants >= maxOccupants) {
      window.alert("All seats in this shared flat are filled.");
      return;
    }
    // Block duplicate booking by the same user for this shared flat.
    const alreadyInRoommateProfiles = Array.isArray(flat.roommateProfiles)
      && flat.roommateProfiles.some((rm) => String(rm.createdByUserId || rm.purchasedByUserId || "") === String(currentUser.id || ""));
    const alreadyInRoommatesInfo = Array.isArray(flat.roommatesInfo)
      && flat.roommatesInfo.some((rm) => String(rm.createdByUserId || rm.purchasedByUserId || "") === String(currentUser.id || ""));
    if (alreadyInRoommateProfiles || alreadyInRoommatesInfo) {
      window.alert("You have already booked a seat in this flat.");
      return;
    }
  } else {
    if (String(flat.stats?.purchasedByUserId || "") === String(currentUser.id || "")) {
      window.alert("You have already bought this room.");
      return;
    }
    if (flat.stats?.isSold) {
      window.alert(`This flat is already sold${flat.stats?.purchasedByName ? ` to ${flat.stats.purchasedByName}` : ""}.`);
      return;
    }
  }

  const hasPremium = Boolean(currentUser.subscription?.active)
  const rentAmount = Number(flat.rent) || 0
  const payableAmount = hasPremium ? Math.max(Math.round(rentAmount * 0.9), 0) : rentAmount

  bookModal.innerHTML = `
    <div class="modal-card">
      <div class="modal-head">
        <h3>Book Room</h3>
        <button class="icon-btn" id="closeBookModal" type="button">✕</button>
      </div>
      <div class="modal-body">
        <h4>${flat.title}</h4>
        <p class="muted">Secure your booking with a payment</p>
        <div class="modal-price-row">
          <span>Monthly Rent:</span>
          <strong>${window.AppUtils.formatINR(flat.rent)}</strong>
        </div>
        ${hasPremium ? `<p class="status-text">Premium discount applied. You pay ${window.AppUtils.formatINR(payableAmount)}.</p>` : ""}
        ${
          hasPremium
            ? ""
            : `<div class="premium-warning">
                 <p><strong>💡 Premium Optional</strong></p>
                 <p>You can book now. Upgrade to premium to get 10% off.</p>
                 <a href="/subscription">Upgrade to Premium</a>
               </div>`
        }
      </div>
      <div class="modal-actions">
        <button class="btn btn-light" id="cancelBookBtn" type="button">Cancel</button>
        <button class="btn btn-primary" id="payBookBtn" type="button">Pay ${window.AppUtils.formatINR(payableAmount)}</button>
      </div>
      <p id="bookStatus" class="status-text"></p>
    </div>
  `

  document.getElementById("closeBookModal")?.addEventListener("click", closeModal)
  document.getElementById("cancelBookBtn")?.addEventListener("click", closeModal)

  const payBookBtn = document.getElementById("payBookBtn")
  const bookStatus = document.getElementById("bookStatus")

  payBookBtn?.addEventListener("click", async () => {
    if (payBookBtn.disabled) {
      return
    }

    payBookBtn.disabled = true
    payBookBtn.textContent = "Processing..."

    try {
      console.log("[booking] starting payment flow", {
        flatId: flat.id,
        flatType: flat.flatType,
        userId: currentUser?.id,
        payableAmount,
      })

      const config = await window.AppUtils.api("/api/payment/config")
      if (!config.enabled || !config.keyId) {
        bookStatus.textContent = "Payment is not configured. Please configure Razorpay keys."
        payBookBtn.disabled = false
        payBookBtn.textContent = `Pay ${window.AppUtils.formatINR(payableAmount)}`
        return
      }

      const order = await window.AppUtils.api("/api/payment/create-order", {
        method: "POST",
        body: JSON.stringify({
          amount: payableAmount * 100,
          currency: "INR",
          receipt: `book_${flat.id}_${Date.now()}`,
          notes: {
            userId: currentUser.id,
            flatId: flat.id,
            type: "room-booking",
          },
        }),
      })

      const razorpay = new window.Razorpay({
        key: config.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Student Flat Finder",
        description: `Booking for ${flat.title}`,
        order_id: order.id,
        handler: async (response) => {
          console.log("[booking] razorpay handler payload", response)
          try {
            const verify = await window.AppUtils.api("/api/payment/verify", {
              method: "POST",
              body: JSON.stringify(response),
            })
            console.log("[booking] verify response", verify)
            if (verify.verified) {
              if (flat.flatType === "room-with-roommates") {
                const targetFlatId = encodeURIComponent(verify.bookingOnboarding?.flatId || flat.id)
                const targetUserId = encodeURIComponent(verify.bookingOnboarding?.userId || currentUser.id)
                bookStatus.textContent = "Payment successful. Redirecting to roommate details form..."
                setTimeout(() => {
                  window.location.href = `/roommate-onboard.html?flatId=${targetFlatId}&userId=${targetUserId}`
                }, 500)
                return
              }

              bookStatus.textContent = "Booking payment successful ✅";
              setTimeout(async () => {
                const parts = window.location.pathname.split("/").filter(Boolean);
                const flatId = parts[1];
                if (flatId) {
                  const response = await fetch(`/api/flats/${flatId}`);
                  if (response.ok) {
                    activeFlat = await response.json();
                    buildFlatPage(activeFlat);
                  } else {
                    window.location.reload();
                  }
                } else {
                  window.location.reload();
                }
              }, 1000);
              return
            }

            bookStatus.textContent = "Payment verification failed";
          } catch (error) {
            console.error("[booking] verify failed", {
              message: error?.message,
              flatId: flat.id,
              userId: currentUser?.id,
              response,
              error,
            })
            bookStatus.textContent = error.message || "Payment verification failed"
            if (/already booked|already joined|filled|one normal student can buy only one room/i.test(String(error.message || ""))) {
              setTimeout(async () => {
                const response = await fetch(`/api/flats/${flat.id}`)
                if (response.ok) {
                  activeFlat = await response.json()
                  buildFlatPage(activeFlat)
                } else {
                  window.location.reload()
                }
              }, 700)
            }
            payBookBtn.disabled = false
            payBookBtn.textContent = `Pay ${window.AppUtils.formatINR(payableAmount)}`
          }
        },
        modal: {
          ondismiss: () => {
            payBookBtn.disabled = false
            payBookBtn.textContent = `Pay ${window.AppUtils.formatINR(payableAmount)}`
          },
        },
      })

      razorpay.open()
    } catch (error) {
      console.error("[booking] create-order/config failed", {
        message: error?.message,
        flatId: flat.id,
        userId: currentUser?.id,
        payableAmount,
        error,
      })
      bookStatus.textContent = error.message
      payBookBtn.disabled = false
      payBookBtn.textContent = `Pay ${window.AppUtils.formatINR(payableAmount)}`
    }
  })

  openModal(bookModal)
}

async function openBuyModal(flat) {
  currentUser = window.AppUtils.getCurrentUser()
  if (!currentUser) {
    window.location.href = "/login"
    return
  }

  if (flat.stats?.isSold) {
    window.alert("This flat is already sold.")
    return
  }

  if (currentUser.id === flat.ownerId) {
    window.alert("You cannot buy your own listing.")
    return
  }

  const buyAmount = Number(flat.rent) || 0

  bookModal.innerHTML = `
    <div class="modal-card">
      <div class="modal-head">
        <h3>Buy Flat</h3>
        <button class="icon-btn" id="closeBuyModal" type="button">✕</button>
      </div>
      <div class="modal-body">
        <h4>${flat.title}</h4>
        <p class="muted">Confirm purchase payment to buy this property.</p>
        <div class="modal-price-row">
          <span>Purchase Amount:</span>
          <strong>${window.AppUtils.formatINR(buyAmount)}</strong>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-light" id="cancelBuyBtn" type="button">Cancel</button>
        <button class="btn btn-primary" id="payBuyBtn" type="button">Pay ${window.AppUtils.formatINR(buyAmount)}</button>
      </div>
      <p id="buyStatus" class="status-text"></p>
    </div>
  `

  document.getElementById("closeBuyModal")?.addEventListener("click", closeModal)
  document.getElementById("cancelBuyBtn")?.addEventListener("click", closeModal)

  const payBuyBtn = document.getElementById("payBuyBtn")
  const buyStatus = document.getElementById("buyStatus")

  payBuyBtn?.addEventListener("click", async () => {
    try {
      const config = await window.AppUtils.api("/api/payment/config")
      if (!config.enabled || !config.keyId) {
        buyStatus.textContent = "Payment is not configured. Please configure Razorpay keys."
        return
      }

      const order = await window.AppUtils.api("/api/payment/create-order", {
        method: "POST",
        body: JSON.stringify({
          amount: buyAmount * 100,
          currency: "INR",
          receipt: `buy_${flat.id}_${Date.now()}`,
          notes: {
            userId: currentUser.id,
            flatId: flat.id,
            type: "flat-purchase",
          },
        }),
      })

      const razorpay = new window.Razorpay({
        key: config.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Student Flat Finder",
        description: `Purchase for ${flat.title}`,
        order_id: order.id,
        handler: async (response) => {
          const verify = await window.AppUtils.api("/api/payment/verify", {
            method: "POST",
            body: JSON.stringify(response),
          })

          buyStatus.textContent = verify.verified
            ? "Purchase payment successful ✅ The owner will contact you shortly."
            : "Payment verification failed"
        },
      })

      razorpay.open()
    } catch (error) {
      buyStatus.textContent = error.message
    }
  })

  openModal(bookModal)
}

async function loadFlat() {
  const parts = window.location.pathname.split("/").filter(Boolean)
  const flatId = parts[1]

  if (!flatId) {
    container.innerHTML = "<p>Flat not found.</p>"
    return
  }

  const response = await fetch(`/api/flats/${flatId}`)
  if (!response.ok) {
    container.innerHTML = "<p>Flat not found.</p>"
    return
  }

  activeFlat = await response.json()

  if (currentUser?.id && currentUser.id !== activeFlat.ownerId) {
    try {
      const viewed = await window.AppUtils.api(`/api/flats/${flatId}/view`, {
        method: "POST",
        body: JSON.stringify({ viewerUserId: currentUser.id }),
      })
      activeFlat = viewed
    } catch {
      // Ignore view tracking failures for end-user experience
    }
  }

  buildFlatPage(activeFlat)
}

modalBackdrop?.addEventListener("click", closeModal)
window.addEventListener("DOMContentLoaded", loadFlat)
window.addEventListener("beforeunload", () => {
  if (galleryTimer) {
    clearInterval(galleryTimer)
  }
})
