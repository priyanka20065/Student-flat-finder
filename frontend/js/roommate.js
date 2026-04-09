// Helper to resolve image URLs for backend-served uploads
function resolveImageUrl(url) {
  if (!url) return "/assets/modern-apartment-living.png";
  if (url.startsWith("/uploads/")) {
    return window.AppUtils.resolveBackendUrl(url);
  }
  return url;
}

const container = document.getElementById("roommateDetail")
const roommateModalBackdrop = document.getElementById("roommateModalBackdrop")
const roommateChatModal = document.getElementById("roommateChatModal")
let currentUser = window.AppUtils.getCurrentUser()

let galleryIndex = 0
let galleryImages = []
let panoramaViewer = null
let activeRoommateThreadKey = ""

function closeRoommateModal() {
  roommateModalBackdrop?.classList.add("hidden")
  roommateChatModal?.classList.add("hidden")
}

function openRoommateModal() {
  roommateModalBackdrop?.classList.remove("hidden")
  roommateChatModal?.classList.remove("hidden")
}

async function openRoommateChatModal(roommate, prefillMessage = "") {
  currentUser = window.AppUtils.getCurrentUser()
  if (!currentUser?.id) {
    window.location.href = "/login"
    return
  }

  const isListingOwner = String(roommate.createdByUserId || "") === String(currentUser.id || "")
  if (isListingOwner) {
    return
  }

  const query = `?userId=${encodeURIComponent(currentUser.id)}`
  const messages = await window.AppUtils.api(`/api/roommate-chat/${encodeURIComponent(roommate.id)}${query}`)
  const sentCount = messages.filter((message) => String(message.senderUserId || "") === String(currentUser.id || "")).length
  const hasPremium = Boolean(currentUser.subscription?.active)
  const FREE_CHAT_LIMIT = 5
  const remaining = hasPremium ? null : Math.max(FREE_CHAT_LIMIT - sentCount, 0)

  roommateChatModal.innerHTML = `
    <div class="modal-card">
      <div class="modal-head">
        <div>
          <h3>Chat with Listing Student</h3>
          <p class="muted">${hasPremium ? "Unlimited messages (Premium)" : `${remaining} messages remaining`}</p>
        </div>
        <button class="icon-btn" id="closeRoommateChatModal" type="button">✕</button>
      </div>
      <div class="modal-body" id="roommateChatMessages">
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
          .join("") || '<p class="muted">No messages yet.</p>'}
      </div>
      <form id="roommateChatModalForm" class="modal-form">
        <input id="roommateChatModalInput" type="text" placeholder="Message" ${!hasPremium && remaining <= 0 ? "disabled" : ""} />
        <button class="btn btn-primary" type="submit" ${!hasPremium && remaining <= 0 ? "disabled" : ""}>Send</button>
      </form>
      <p id="roommateChatModalStatus" class="status-text"></p>
      ${!hasPremium && remaining <= 0 ? '<p class="muted">Free limit reached. <a href="/subscription">Upgrade to premium</a> to continue.</p>' : ""}
    </div>
  `

  document.getElementById("closeRoommateChatModal")?.addEventListener("click", closeRoommateModal)

  const chatForm = document.getElementById("roommateChatModalForm")
  const chatInput = document.getElementById("roommateChatModalInput")
  const chatStatus = document.getElementById("roommateChatModalStatus")

  if (chatInput && prefillMessage && !chatInput.disabled) {
    chatInput.value = prefillMessage
  }

  chatForm?.addEventListener("submit", async (event) => {
    event.preventDefault()
    const message = String(chatInput?.value || "").trim()
    if (!message) {
      return
    }

    try {
      await window.AppUtils.api(`/api/roommate-chat/${encodeURIComponent(roommate.id)}`, {
        method: "POST",
        body: JSON.stringify({
          senderName: String(currentUser.name || "Student"),
          senderEmail: String(currentUser.email || ""),
          senderUserId: String(currentUser.id || ""),
          message,
        }),
      })

      await openRoommateChatModal(roommate)
    } catch (error) {
      if (chatStatus) {
        chatStatus.textContent = error.message
      }
    }
  })

  openRoommateModal()
}

async function openRoommateBookModal(roommate) {
  currentUser = window.AppUtils.getCurrentUser()
  if (!currentUser?.id) {
    window.location.href = "/login"
    return
  }

  const isListingOwner = String(roommate.createdByUserId || "") === String(currentUser.id || "")
  if (isListingOwner) {
    window.alert("You cannot book your own listing.")
    return
  }

  const joinedUserIds = Array.isArray(roommate.currentRoommateUserIds)
    ? roommate.currentRoommateUserIds.map((item) => String(item || ""))
    : []
  const alreadyJoined =
    String(roommate.purchasedByUserId || "") === String(currentUser.id || "") || joinedUserIds.includes(String(currentUser.id || ""))
  if (alreadyJoined) {
    window.alert("You have already joined this roommate listing.")
    return
  }

  const maxOccupants = Math.max(1, Number(roommate.maxOccupants || 1))
  const occupiedSeats = 1 + joinedUserIds.length
  if (occupiedSeats >= maxOccupants) {
    window.alert("This roommate listing is full.")
    return
  }

  const hasPremium = Boolean(currentUser.subscription?.active)
  const baseAmount = Number(roommate.preferredRentMax || 0)
  const payableAmount = hasPremium ? Math.max(Math.round(baseAmount * 0.9), 0) : baseAmount

  roommateChatModal.innerHTML = `
    <div class="modal-card">
      <div class="modal-head">
        <h3>Book Room</h3>
        <button class="icon-btn" id="closeRoommateBookModal" type="button">✕</button>
      </div>
      <div class="modal-body">
        <h4>${roommate.name || "Roommate Listing"}</h4>
        <p class="muted">Secure your room with a booking payment.</p>
        <div class="modal-price-row">
          <span>Amount:</span>
          <strong>${window.AppUtils.formatINR(baseAmount)}</strong>
        </div>
        ${hasPremium ? `<p class="status-text">Premium discount applied. You pay ${window.AppUtils.formatINR(payableAmount)}.</p>` : ""}
      </div>
      <div class="modal-actions">
        <button class="btn btn-light" id="cancelRoommateBookBtn" type="button">Cancel</button>
        <button class="btn btn-primary" id="payRoommateBookBtn" type="button">Pay ${window.AppUtils.formatINR(payableAmount)}</button>
      </div>
      <p id="roommateBookStatus" class="status-text"></p>
    </div>
  `

  document.getElementById("closeRoommateBookModal")?.addEventListener("click", closeRoommateModal)
  document.getElementById("cancelRoommateBookBtn")?.addEventListener("click", closeRoommateModal)

  const payButton = document.getElementById("payRoommateBookBtn")
  const statusNode = document.getElementById("roommateBookStatus")

  payButton?.addEventListener("click", async () => {
    try {
      const config = await window.AppUtils.api("/api/payment/config")
      if (!config.enabled || !config.keyId) {
        statusNode.textContent = "Payment is not configured. Please configure Razorpay keys."
        return
      }

      const order = await window.AppUtils.api("/api/payment/create-order", {
        method: "POST",
        body: JSON.stringify({
          amount: payableAmount * 100,
          currency: "INR",
          receipt: `rm_book_${roommate.id}_${Date.now()}`,
          notes: {
            userId: currentUser.id,
            roommateId: roommate.id,
            type: "roommate-booking",
          },
        }),
      })

      const razorpay = new window.Razorpay({
        key: config.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Student Flat Finder",
        description: `Roommate booking for ${roommate.name || "Listing"}`,
        order_id: order.id,
        handler: async (response) => {
          const verify = await window.AppUtils.api("/api/payment/verify", {
            method: "POST",
            body: JSON.stringify(response),
          })

          statusNode.textContent = verify.verified ? "Booking payment successful ✅" : "Payment verification failed"
          if (verify.verified) {
            setTimeout(() => {
              closeRoommateModal()
              window.location.reload()
            }, 800)
          }
        },
      })

      razorpay.open()
    } catch (error) {
      statusNode.textContent = error.message
    }
  })

  openRoommateModal()
}

function getRoommateIdFromPath() {
  const parts = window.location.pathname.split("/").filter(Boolean)
  return parts[1] || ""
}

function isImageTourUrl(url) {
  if (!url) {
    return false
  }
  const normalized = String(url).toLowerCase().split("?")[0].split("#")[0]
  return normalized.endsWith(".jpg") || normalized.endsWith(".jpeg") || normalized.endsWith(".png")
}

function renderGalleryFrame(title) {
  const mainImage = document.getElementById("roommateMainImage")
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

function openImageLightbox(imageUrl, title) {
  const lightbox = document.getElementById("roommateImageLightbox")
  const lightboxImage = document.getElementById("roommateLightboxImage")
  if (!lightbox || !lightboxImage) {
    return
  }
  lightboxImage.src = imageUrl
  lightboxImage.alt = title
  lightbox.classList.remove("hidden")
}

function closeImageLightbox() {
  document.getElementById("roommateImageLightbox")?.classList.add("hidden")
}

function setupGallery(title) {
  renderGalleryFrame(title)

  document.getElementById("roommatePrevImage")?.addEventListener("click", () => moveGallery(-1, title))
  document.getElementById("roommateNextImage")?.addEventListener("click", () => moveGallery(1, title))

  document.getElementById("roommateMainImage")?.addEventListener("click", () => {
    openImageLightbox(galleryImages[galleryIndex], title)
  })

  Array.from(document.querySelectorAll(".flat-thumb-item")).forEach((button) => {
    button.addEventListener("click", () => {
      galleryIndex = Number(button.dataset.index || 0)
      renderGalleryFrame(title)
    })
  })

  document.getElementById("roommateLightboxClose")?.addEventListener("click", closeImageLightbox)
  document.getElementById("roommateImageLightbox")?.addEventListener("click", (event) => {
    if (event.target?.id === "roommateImageLightbox") {
      closeImageLightbox()
    }
  })
}

function setupPanorama(tourUrls, activeSceneIndex = 0) {
  if (!Array.isArray(tourUrls) || !tourUrls.length || !window.pannellum || !isImageTourUrl(tourUrls[0])) {
    return
  }

  if (panoramaViewer && typeof panoramaViewer.destroy === "function") {
    panoramaViewer.destroy()
  }

  const sceneIndex = Math.max(0, Math.min(activeSceneIndex, tourUrls.length - 1))
  // Always resolve the panorama URL to use the backend server
  panoramaViewer = window.pannellum.viewer("panoramaViewer", {
    type: "equirectangular",
    panorama: resolveImageUrl(tourUrls[sceneIndex]),
    autoLoad: true,
    showControls: true,
    autoRotate: -2,
  })
}

function renderRoommateMessages(messages) {
  const listNode = document.getElementById("roommateMessageList")
  if (!listNode) {
    return
  }

  if (!Array.isArray(messages) || !messages.length) {
    listNode.innerHTML = '<p class="muted">No messages yet.</p>'
    return
  }

  listNode.innerHTML = messages
    .map(
      (message) => `
        <div class="${message.senderUserId === currentUser?.id ? "bubble bubble-own" : "bubble bubble-peer"}">
          <p>${message.message}</p>
          <small>${new Date(message.createdAt).toLocaleString()}</small>
        </div>
      `,
    )
    .join("")
}

function getRoommateThreadKey(message, listingOwnerId) {
  const senderUserId = String(message.senderUserId || "")
  const recipientUserId = String(message.recipientUserId || "")
  const senderEmail = String(message.senderEmail || "").trim().toLowerCase()
  const recipientEmail = String(message.recipientEmail || "").trim().toLowerCase()

  if (senderUserId === listingOwnerId) {
    return recipientUserId || (recipientEmail ? `email:${recipientEmail}` : "")
  }

  return senderUserId || (senderEmail ? `email:${senderEmail}` : "")
}

function buildRoommateThreads(messages, listingOwnerId) {
  const threads = new Map()

  messages.forEach((message) => {
    const threadKey = getRoommateThreadKey(message, listingOwnerId)
    if (!threadKey) {
      return
    }

    const senderUserId = String(message.senderUserId || "")
    const recipientUserId = String(message.recipientUserId || "")
    const senderEmail = String(message.senderEmail || "").trim().toLowerCase()
    const recipientEmail = String(message.recipientEmail || "").trim().toLowerCase()
    const isOwnerSender = senderUserId === listingOwnerId

    const userId = isOwnerSender ? recipientUserId : senderUserId
    const email = isOwnerSender ? recipientEmail : senderEmail
    const name = !isOwnerSender ? message.senderName || "Interested Student" : email || "Interested Student"

    if (!threads.has(threadKey)) {
      threads.set(threadKey, {
        key: threadKey,
        userId: userId || "",
        email: email || "",
        name,
        messages: [],
      })
    }

    const thread = threads.get(threadKey)
    if (!thread.userId && userId) {
      thread.userId = userId
    }
    if (!thread.email && email) {
      thread.email = email
    }
    if (!isOwnerSender && message.senderName) {
      thread.name = message.senderName
    }

    thread.messages.push(message)
  })

  return Array.from(threads.values()).sort((a, b) => {
    const aTime = new Date(a.messages[a.messages.length - 1]?.createdAt || 0).getTime()
    const bTime = new Date(b.messages[b.messages.length - 1]?.createdAt || 0).getTime()
    return bTime - aTime
  })
}

function renderRoommateThreadList(threads) {
  const listNode = document.getElementById("roommateThreadList")
  if (!listNode) {
    return
  }

  if (!threads.length) {
    listNode.innerHTML = '<p class="muted">No users have messaged yet.</p>'
    return
  }

  listNode.innerHTML = threads
    .map((thread) => {
      const last = thread.messages[thread.messages.length - 1]
      return `
        <button type="button" class="conversation-card" data-roommate-thread="${thread.key}">
          <div class="conversation-avatar">${String(thread.name || "U").slice(0, 1).toUpperCase()}</div>
          <div class="conversation-content">
            <h3>${thread.name}</h3>
            <p class="muted">${last?.message || ""}</p>
          </div>
          <p class="muted">${thread.messages.length} msg</p>
        </button>
      `
    })
    .join("")
}

async function loadRoommateMessages(roommate) {
  if (!currentUser?.id) {
    return { messages: [], threads: [] }
  }

  const query = `?userId=${encodeURIComponent(currentUser.id)}`
  const messages = await window.AppUtils.api(`/api/roommate-chat/${encodeURIComponent(roommate.id)}${query}`)
  const listingOwnerId = String(roommate.createdByUserId || "")
  const isListingOwner = listingOwnerId === String(currentUser.id || "")
  const threads = isListingOwner ? buildRoommateThreads(messages, listingOwnerId) : []

  if (isListingOwner) {
    if (!activeRoommateThreadKey || !threads.some((thread) => thread.key === activeRoommateThreadKey)) {
      activeRoommateThreadKey = threads[0]?.key || ""
    }

    renderRoommateThreadList(threads)

    const selectedThread = threads.find((thread) => thread.key === activeRoommateThreadKey)
    renderRoommateMessages(selectedThread?.messages || [])

    const threadTitle = document.getElementById("roommateThreadTitle")
    if (threadTitle) {
      threadTitle.textContent = selectedThread
        ? `Messages with ${selectedThread.name}`
        : "Messages from interested students"
    }

    Array.from(document.querySelectorAll("[data-roommate-thread]"))
      .forEach((button) => {
        button.addEventListener("click", () => {
          activeRoommateThreadKey = String(button.getAttribute("data-roommate-thread") || "")
          const activeThread = threads.find((thread) => thread.key === activeRoommateThreadKey)
          renderRoommateMessages(activeThread?.messages || [])
          const titleNode = document.getElementById("roommateThreadTitle")
          if (titleNode) {
            titleNode.textContent = activeThread
              ? `Messages with ${activeThread.name}`
              : "Messages from interested students"
          }
        })
      })
  } else {
    renderRoommateMessages(messages)
    const threadTitle = document.getElementById("roommateThreadTitle")
    if (threadTitle) {
      threadTitle.textContent = "Message listing student"
    }
  }

  const countNode = document.getElementById("roommateMessageCount")
  if (countNode) {
    if (isListingOwner) {
      countNode.textContent = String(threads.length)
    } else {
      countNode.textContent = String(messages.length)
    }
  }

  return { messages, threads }
}

function bindRoommateMessageForm(roommate) {
  const form = document.getElementById("roommateMessageForm")
  const statusNode = document.getElementById("roommateMessageStatus")
  if (!form || !currentUser?.id) {
    return
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault()
    const formData = new FormData(form)
    const message = String(formData.get("message") || "").trim()
    if (!message) {
      return
    }

    try {
      const isListingOwner = String(roommate.createdByUserId || "") === String(currentUser.id || "")
      let recipientUserId = ""
      let recipientEmail = ""

      if (isListingOwner) {
        const latestState = await loadRoommateMessages(roommate)
        const selectedThread = (latestState.threads || []).find((thread) => thread.key === activeRoommateThreadKey)
        if (!selectedThread) {
          if (statusNode) {
            statusNode.textContent = "Select a user thread to reply."
          }
          return
        }
        recipientUserId = String(selectedThread.userId || "")
        recipientEmail = String(selectedThread.email || "")
      }

      const payload = {
        senderName: String(currentUser.name || "Student"),
        senderEmail: String(currentUser.email || ""),
        senderUserId: String(currentUser.id || ""),
        recipientUserId: recipientUserId || undefined,
        recipientEmail: recipientEmail || undefined,
        message,
      }

      const response = await window.AppUtils.api(`/api/roommate-chat/${encodeURIComponent(roommate.id)}`, {
        method: "POST",
        body: JSON.stringify(payload),
      })

      form.reset()
      if (statusNode) {
        statusNode.textContent =
          typeof response.remaining === "number"
            ? `Message sent. ${response.remaining} messages remaining.`
            : "Message sent."
      }
      await loadRoommateMessages(roommate)
    } catch (error) {
      if (statusNode) {
        statusNode.textContent = error.message
      }
    }
  })
}

function bindRoommateInterestedActions(roommate) {
  if (!currentUser?.id || String(roommate.createdByUserId || "") === String(currentUser.id || "")) {
    return
  }

  document.getElementById("roommateChatBtn")?.addEventListener("click", () => {
    openRoommateChatModal(roommate).catch((error) => {
      window.alert(error.message)
    })
  })

  document.getElementById("roommateBookBtn")?.addEventListener("click", () => {
    openRoommateBookModal(roommate).catch((error) => {
      window.alert(error.message)
    })
  })

  document.getElementById("roommateScheduleBtn")?.addEventListener("click", () => {
    openRoommateChatModal(roommate, "Hi, can we schedule a visit?").catch((error) => {
      window.alert(error.message)
    })
  })

  document.getElementById("roommateLikeBtn")?.addEventListener("click", (event) => {
    const button = event.currentTarget
    if (!button) {
      return
    }

    const liked = button.getAttribute("data-liked") === "true"
    button.setAttribute("data-liked", liked ? "false" : "true")
    button.textContent = liked ? "💖 Like Flat" : "💚 Liked"
  })
}

function renderRoommateDetail(roommate) {
  if (!container) {
    return
  }

  const interests = Array.isArray(roommate.interests) ? roommate.interests : []
  const chips = interests.map((item) => `<span class="chip">${item}</span>`).join("")
  const images = Array.isArray(roommate.images) && roommate.images.length ? roommate.images : ["/assets/modern-apartment-living.png"]
  // Debug log for troubleshooting image URLs
  console.log("[Roommate Images]", images, "Raw images:", roommate.images);
  const tourUrls = Array.isArray(roommate.virtualTourUrls)
    ? roommate.virtualTourUrls
    : roommate.virtualTourUrl
      ? [roommate.virtualTourUrl]
      : []
  const useImageTourViewer = tourUrls.length > 0 && isImageTourUrl(tourUrls[0])
  const maxOccupants = Math.max(1, Number(roommate.maxOccupants || 1))
  const isListingOwner = Boolean(currentUser?.id && String(currentUser.id) === String(roommate.createdByUserId || ""))
  // Only count actual roommates, not the owner, for shared flats
  let currentRoommates = [];
  if (Array.isArray(roommate.currentRoommates)) {
    currentRoommates = roommate.currentRoommates
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .map((name) => ({ name, role: "Joined" }));
  }
  // If purchasedByName exists, add as joined
  if (roommate.purchasedByName && String(roommate.purchasedByName).trim()) {
    currentRoommates.unshift({ name: String(roommate.purchasedByName).trim(), role: "Joined" });
  }
  // For new listings with no roommates, currentRoommates will be empty
  const seatsLeft = Math.max(maxOccupants - currentRoommates.length, 0);
  const isBoughtByCurrentUser = Boolean(
    currentUser?.id &&
      (String(roommate.purchasedByUserId || "") === String(currentUser.id || "") ||
        (Array.isArray(roommate.currentRoommateUserIds) &&
          roommate.currentRoommateUserIds.map((item) => String(item || "")).includes(String(currentUser.id || "")))),
  )
  const isRoomFull = seatsLeft <= 0
  const statusLabel = isListingOwner
    ? "✅ Your Listing"
    : isBoughtByCurrentUser
      ? "✅ Joined by You"
      : isRoomFull
        ? "✅ Full"
        : "🟢 Seats Available"

  galleryImages = images
  galleryIndex = 0

  container.innerHTML = `
    <section class="flat-hero-card">
      <div class="flat-media-shell">
        <div class="flat-thumb-rail">
          ${images
            .map(
              (imageUrl, index) => `
                <button type="button" class="flat-thumb-item ${index === 0 ? "active-thumb" : ""}" data-index="${index}" aria-label="Open image ${index + 1}">
                  <img src="${resolveImageUrl(imageUrl)}" alt="${roommate.name || 'Roommate'} thumbnail ${index + 1}" class="flat-thumb-image" onerror="this.onerror=null;this.src='/assets/modern-apartment-living.png';" />
                </button>
              `,
            )
            .join("")}
        </div>
        <div class="flat-main-media">
          ${images.length > 1 ? '<button type="button" class="flat-gallery-nav flat-gallery-prev" id="roommatePrevImage" aria-label="Previous image">❮</button>' : ""}
          <img id="roommateMainImage" src="${resolveImageUrl(images[0])}" alt="${roommate.name || "Roommate"}" class="flat-hero-image" draggable="false" onerror="this.onerror=null;this.src='/assets/modern-apartment-living.png';" />
          ${images.length > 1 ? '<button type="button" class="flat-gallery-nav flat-gallery-next" id="roommateNextImage" aria-label="Next image">❯</button>' : ""}
          <div class="flat-open-hint">Click image to open • Use arrows to change</div>
        </div>
      </div>
    </section>

    <section class="flat-layout">
      <article class="card">
        <h1>${roommate.name || "Student Listing"}</h1>
        <p class="muted text-justify">${roommate.bio || "Student roommate listing"}</p>
        <p class="muted">🎓 ${roommate.course || "Student"} • ${roommate.age || "-"} years</p>
        <p><strong>${window.AppUtils.formatINR(roommate.preferredRentMax || 0)}</strong> <span class="muted">max budget / month</span></p>
        <div class="chip-list"><span class="chip">Roommate Listing</span></div>
      </article>

      <aside class="card">
        ${
          isListingOwner
            ? `<h3>Listing Summary</h3>
               <div class="action-stack">
                 <a class="btn btn-primary" href="/chat">💬 Open Messages</a>
                 <button class="btn btn-light" type="button">👥 ${currentRoommates.length}/${maxOccupants} roommates</button>
                 <button class="btn btn-light" type="button">🪑 ${seatsLeft} seats left</button>
                 <button class="btn btn-light" type="button">🧹 Cleanliness ${roommate.personality?.cleanliness ?? "-"}/10</button>
                 <button class="btn btn-dark" type="button">${statusLabel}</button>
               </div>`
            : `<h3>Interested?</h3>
               <div class="action-stack">
                 <button id="roommateChatBtn" class="btn btn-primary" type="button">💬 Chat with Student</button>
                 <button id="roommateBookBtn" class="btn btn-secondary" type="button" ${isRoomFull || isBoughtByCurrentUser ? "disabled" : ""}>${
                   isBoughtByCurrentUser ? "✅ You Joined" : isRoomFull ? "✅ Full" : "🏠 Book Room"
                 }</button>
                 <button id="roommateLikeBtn" class="btn btn-light" type="button" data-liked="false">💖 Like Flat</button>
                 <button id="roommateScheduleBtn" class="btn btn-dark" type="button">📞 Schedule Visit</button>
                 <button class="btn btn-dark" type="button">${statusLabel}</button>
               </div>`
        }
      </aside>
    </section>

    <section class="flat-layout">
      <article class="card">
        <h3>Interests</h3>
        <div class="chip-list">${chips || '<span class="muted">No interests added</span>'}</div>
      </article>
      <article class="card">
        <h3>Quick Info</h3>
        
        <p><span class="muted">Students Capacity:</span> <strong>${maxOccupants}</strong></p>
        <p><span class="muted">Listing Type:</span> <strong>Roommate Listing (Owner Only)</strong></p>
        <p><span class="muted">Actions:</span> ${
          isListingOwner
            ? '<a class="btn btn-primary small-btn" href="/list?mode=roommate">Update Listing</a>'
            : '<strong>Contact listing owner</strong>'
        }</p>
      </article>
    </section>

    <section class="card">
      <h3>Listing Owner</h3>
      <div class="flat-roommate-list">
        <article class="flat-roommate-card no-avatar">
          <div>
            <h4>${roommate.name || "Listing Owner"}</h4>
            <p class="muted">Listed by</p>
          </div>
        </article>
      </div>
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
                         <img src="${tourUrl}" alt="${roommate.name || "Roommate"} 360 scene ${index + 1}" onerror="this.onerror=null;this.src='/assets/modern-apartment-living.png';" />
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
                 title="${roommate.name || "Roommate"} 360 tour"
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

  setupGallery(roommate.name || "Roommate")

  if (useImageTourViewer) {
    setupPanorama(tourUrls, 0)
    const sceneButtons = Array.from(document.querySelectorAll(".tour-scene-thumb"))
    sceneButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const sceneIndex = Number(button.dataset.sceneIndex || 0)
        sceneButtons.forEach((item, index) => {
          item.classList.toggle("active-scene", index === sceneIndex)
        })
        setupPanorama(tourUrls, sceneIndex)
      })
    })
  }

  bindRoommateInterestedActions(roommate)

}

async function loadRoommateDetail() {
  const roommateId = getRoommateIdFromPath()
  if (!roommateId) {
    if (container) {
      container.innerHTML = '<section class="card"><p class="muted">Roommate id missing in URL.</p></section>'
    }
    return
  }

  if (container) {
    container.innerHTML = '<section class="card"><p class="muted">Loading listing details...</p></section>'
  }

  try {
    const roommate = await window.AppUtils.api(`/api/roommates/${encodeURIComponent(roommateId)}`)
    renderRoommateDetail(roommate)
  } catch (error) {
    if (container) {
      container.innerHTML = `<section class="card"><p class="muted">${error.message || "Unable to load roommate detail."}</p></section>`
    }
  }
}

loadRoommateDetail()

roommateModalBackdrop?.addEventListener("click", closeRoommateModal)
