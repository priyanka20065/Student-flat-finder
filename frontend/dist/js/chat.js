const currentUser = window.AppUtils.ensureLoggedIn("/login")
const chatConversationList = document.getElementById("chatConversationList")
const chatThreadPanel = document.getElementById("chatThreadPanel")
const threadTitle = document.getElementById("threadTitle")
const threadRemaining = document.getElementById("threadRemaining")
const threadMessages = document.getElementById("threadMessages")
const chatInput = document.getElementById("chatInput")
const sendBtn = document.getElementById("sendBtn")
const chatForm = document.getElementById("chatForm")
const chatStatus = document.getElementById("chatStatus")
const planLabel = document.getElementById("planLabel")
const upgradeLink = document.getElementById("upgradeLink")
const messagesPlanMeta = document.getElementById("messagesPlanMeta")
const messagesSubtitle = document.getElementById("messagesSubtitle")

let activeFlatId = ""
let flatMap = new Map()
let roommateMap = new Map()
let chatStream
let activeRecipientUserId = ""
let activeRecipientEmail = ""
let conversationsCache = []
let activeConversationId = ""

const FREE_CHAT_LIMIT = 5

function attachChatStream(flatId) {
  if (chatStream) {
    chatStream.close()
  }

  if (!flatId) {
    return
  }

  chatStream = new EventSource(`/api/chat/${flatId}/stream`)
  chatStream.addEventListener("chat-message", () => {
    loadConversations()
    loadMessages()
  })
}

function getMySentCount(messages) {
  return messages.filter((message) => message.senderUserId === currentUser.id).length
}

function formatConversationTime(timestamp) {
  const value = new Date(timestamp || 0)
  if (Number.isNaN(value.getTime())) {
    return ""
  }

  const now = new Date()
  const isSameDay =
    value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth() && value.getDate() === now.getDate()

  return isSameDay
    ? value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : value.toLocaleDateString("en-IN")
}

function sortByNewest(conversations) {
  return [...conversations].sort((a, b) => {
    const aTime = new Date(a.last?.createdAt || 0).getTime()
    const bTime = new Date(b.last?.createdAt || 0).getTime()
    return bTime - aTime
  })
}

function buildOwnerConversations(flat, messages) {
  const threads = new Map()

  messages.forEach((message) => {
    const senderUserId = String(message.senderUserId || "")
    const recipientUserId = String(message.recipientUserId || "")
    const senderEmail = String(message.senderEmail || "").trim().toLowerCase()
    const recipientEmail = String(message.recipientEmail || "").trim().toLowerCase()

    const counterpartUserId = senderUserId === currentUser.id ? recipientUserId : senderUserId
    const counterpartEmail = senderUserId === currentUser.id ? recipientEmail : senderEmail

    if (!counterpartUserId && !counterpartEmail) {
      return
    }

    const counterpartKey = counterpartUserId || counterpartEmail
    const conversationId = `${flat.id}::${counterpartKey}`

    if (!threads.has(conversationId)) {
      threads.set(conversationId, {
        id: conversationId,
        flat,
        flatId: flat.id,
        isOwnerFlat: true,
        counterpartUserId: counterpartUserId || "",
        counterpartEmail: counterpartEmail || "",
        counterpartName: senderUserId === currentUser.id ? counterpartEmail || "Interested User" : message.senderName || "Interested User",
        messages: [],
      })
    }

    const thread = threads.get(conversationId)
    if (!thread.counterpartUserId && counterpartUserId) {
      thread.counterpartUserId = counterpartUserId
    }
    if (!thread.counterpartEmail && counterpartEmail) {
      thread.counterpartEmail = counterpartEmail
    }
    if (senderUserId !== currentUser.id && message.senderName) {
      thread.counterpartName = message.senderName
    }

    thread.messages.push(message)
  })

  return Array.from(threads.values())
    .filter((thread) => thread.messages.length)
    .map((thread) => ({
      ...thread,
      last: thread.messages[thread.messages.length - 1],
      count: thread.messages.length,
    }))
}

function buildViewerConversation(flat, messages) {
  const ownerId = String(flat.ownerId || "")
  const mine = messages.filter((message) => {
    const senderUserId = String(message.senderUserId || "")
    const recipientUserId = String(message.recipientUserId || "")
    const includesMe = senderUserId === currentUser.id || recipientUserId === currentUser.id
    const includesOwner = senderUserId === ownerId || recipientUserId === ownerId
    return includesMe && includesOwner
  })

  if (!mine.length) {
    return null
  }

  return {
    id: `${flat.id}::owner`,
    flat,
    flatId: flat.id,
    isOwnerFlat: false,
    counterpartUserId: ownerId,
    counterpartEmail: String(flat.ownerEmail || ""),
    counterpartName: flat.ownerName || "Property Owner",
    messages: mine,
    last: mine[mine.length - 1],
    count: mine.length,
  }
}

function buildRoommateViewerConversation(roommate, messages) {
  if (!Array.isArray(messages) || !messages.length) {
    return null
  }

  const relevant = messages.filter((message) => {
    const senderUserId = String(message.senderUserId || "")
    const recipientUserId = String(message.recipientUserId || "")
    return senderUserId === currentUser.id || recipientUserId === currentUser.id
  })

  if (!relevant.length) {
    return null
  }

  return {
    id: `roommate:${roommate.id}`,
    type: "roommate",
    flat: null,
    flatId: roommate.id,
    isOwnerFlat: false,
    counterpartUserId: String(roommate.createdByUserId || ""),
    counterpartEmail: "",
    counterpartName: roommate.name || "Listing Student",
    title: roommate.bio || "Roommate Listing",
    messages: relevant,
    last: relevant[relevant.length - 1],
    count: relevant.length,
  }
}

function buildRoommateOwnerConversations(roommate, messages) {
  const threads = new Map()
  const ownerUserId = String(roommate.createdByUserId || "")

  messages.forEach((message) => {
    const senderUserId = String(message.senderUserId || "")
    const recipientUserId = String(message.recipientUserId || "")
    const senderEmail = String(message.senderEmail || "").trim().toLowerCase()
    const recipientEmail = String(message.recipientEmail || "").trim().toLowerCase()

    const counterpartUserId = senderUserId === ownerUserId ? recipientUserId : senderUserId
    const counterpartEmail = senderUserId === ownerUserId ? recipientEmail : senderEmail

    if (!counterpartUserId && !counterpartEmail) {
      return
    }

    const counterpartKey = counterpartUserId || counterpartEmail
    const conversationId = `roommate:${roommate.id}::${counterpartKey}`

    if (!threads.has(conversationId)) {
      threads.set(conversationId, {
        id: conversationId,
        type: "roommate",
        flat: null,
        flatId: roommate.id,
        isOwnerFlat: false,
        isRoommateOwnerListing: true,
        counterpartUserId: counterpartUserId || "",
        counterpartEmail: counterpartEmail || "",
        counterpartName:
          senderUserId === ownerUserId ? counterpartEmail || "Interested Student" : message.senderName || "Interested Student",
        title: roommate.name || "Roommate Listing",
        messages: [],
      })
    }

    const thread = threads.get(conversationId)
    if (!thread.counterpartUserId && counterpartUserId) {
      thread.counterpartUserId = counterpartUserId
    }
    if (!thread.counterpartEmail && counterpartEmail) {
      thread.counterpartEmail = counterpartEmail
    }
    if (senderUserId !== ownerUserId && message.senderName) {
      thread.counterpartName = message.senderName
    }

    thread.messages.push(message)
  })

  return Array.from(threads.values())
    .filter((thread) => thread.messages.length)
    .map((thread) => ({
      ...thread,
      last: thread.messages[thread.messages.length - 1],
      count: thread.messages.length,
    }))
}

async function loadConversations() {
  const flats = await window.AppUtils.api("/api/flats")
  const roommates = await window.AppUtils.api("/api/roommates")
  flatMap = new Map(flats.map((flat) => [flat.id, flat]))
  roommateMap = new Map(roommates.map((roommate) => [roommate.id, roommate]))
  const requestedFlatId = new URLSearchParams(window.location.search).get("flatId")

  const conversations = []

  for (const flat of flats) {
    const messages = await window.AppUtils.api(`/api/chat/${flat.id}`)
    const isOwnerFlat = flat.ownerId === currentUser.id

    if (isOwnerFlat) {
      conversations.push(...buildOwnerConversations(flat, messages).map((item) => ({ ...item, type: "flat" })))
      continue
    }

    const viewerConversation = buildViewerConversation(flat, messages)
    if (viewerConversation) {
      conversations.push({ ...viewerConversation, type: "flat", title: flat.title || "Conversation" })
    }
  }

  const normalizedRole = String(currentUser.role || currentUser.intent || "").toLowerCase()
  const isNormalStudent = normalizedRole !== "owner"
  if (isNormalStudent) {
    for (const roommate of roommates) {
      const isMyRoommateListing = String(roommate.createdByUserId || "") === String(currentUser.id || "")
      const messages = await window.AppUtils.api(
        `/api/roommate-chat/${encodeURIComponent(roommate.id)}?userId=${encodeURIComponent(currentUser.id)}`,
      )

      if (isMyRoommateListing) {
        conversations.push(...buildRoommateOwnerConversations(roommate, messages))
      } else {
        const viewerConversation = buildRoommateViewerConversation(roommate, messages)
        if (viewerConversation) {
          conversations.push(viewerConversation)
        }
      }
    }
  }

  conversationsCache = sortByNewest(conversations)

  if (!conversationsCache.length) {
    chatConversationList.innerHTML = `
      <article class="card conversation-card muted">
        No conversations yet. Open any room and click <strong>Chat with Owner</strong>.
      </article>
    `
    chatThreadPanel.classList.add("hidden")
    return
  }

  chatConversationList.innerHTML = conversationsCache
    .map(
      (item) => `
        <button class="conversation-card" data-open-conversation="${item.id}" type="button">
          <div class="conversation-avatar">${String(item.counterpartName || "U").slice(0, 1).toUpperCase()}</div>
          <div class="conversation-content">
            <h3>${item.counterpartName}</h3>
            <p class="muted">${item.last?.senderUserId === currentUser.id ? "You: " : ""}${item.last?.message || ""}</p>
          </div>
          <p class="muted">${formatConversationTime(item.last?.createdAt)}</p>
        </button>
      `,
    )
    .join("")

  const openButtons = chatConversationList.querySelectorAll("[data-open-conversation]")
  openButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      activeConversationId = button.getAttribute("data-open-conversation") || ""
      const selected = conversationsCache.find((item) => item.id === activeConversationId)
      activeFlatId = selected?.flatId || ""
      if (selected && String(selected.type || "flat") === "flat") {
        attachChatStream(activeFlatId)
      } else if (chatStream) {
        chatStream.close()
        chatStream = null
      }
      await loadMessages()
    })
  })

  const currentConversationExists = conversationsCache.some((item) => item.id === activeConversationId)
  if (!currentConversationExists) {
    const requestedConversation = requestedFlatId
      ? conversationsCache.find((item) => String(item.flatId || "") === String(requestedFlatId || ""))
      : null
    activeConversationId = requestedConversation?.id || conversationsCache[0].id
  }

  const activeConversation = conversationsCache.find((item) => item.id === activeConversationId)
  if (activeConversation) {
    activeFlatId = activeConversation.flatId
    if (String(activeConversation.type || "flat") === "flat") {
      attachChatStream(activeFlatId)
    } else if (chatStream) {
      chatStream.close()
      chatStream = null
    }
    await loadMessages()
  }
}

async function loadMessages() {
  const conversation = conversationsCache.find((item) => item.id === activeConversationId)
  if (!conversation) {
    chatThreadPanel.classList.add("hidden")
    return
  }

  chatThreadPanel.classList.remove("hidden")

  const isFlatConversation = String(conversation.type || "flat") === "flat"
  const messages = isFlatConversation
    ? await window.AppUtils.api(`/api/chat/${conversation.flatId}`)
    : await window.AppUtils.api(
        `/api/roommate-chat/${encodeURIComponent(conversation.flatId)}?userId=${encodeURIComponent(currentUser.id)}`,
      )

  const flat = isFlatConversation ? flatMap.get(conversation.flatId) : null
  const roommate = !isFlatConversation ? roommateMap.get(conversation.flatId) : null
  const isOwnerFlat = Boolean(flat && flat.ownerId === currentUser.id)
  let filteredMessages = []

  activeRecipientUserId = ""
  activeRecipientEmail = ""

  if (isFlatConversation && isOwnerFlat) {
    const conversationUserId = String(conversation.counterpartUserId || "")
    const conversationEmail = String(conversation.counterpartEmail || "").trim().toLowerCase()

    filteredMessages = messages.filter((message) => {
      const senderUserId = String(message.senderUserId || "")
      const recipientUserId = String(message.recipientUserId || "")
      const senderEmail = String(message.senderEmail || "").trim().toLowerCase()
      const recipientEmail = String(message.recipientEmail || "").trim().toLowerCase()

      const matchesUser = conversationUserId && (senderUserId === conversationUserId || recipientUserId === conversationUserId)
      const matchesEmail = conversationEmail && (senderEmail === conversationEmail || recipientEmail === conversationEmail)
      return matchesUser || (!conversationUserId && matchesEmail)
    })

    activeRecipientUserId = conversationUserId
    activeRecipientEmail = conversationEmail
    threadTitle.textContent = `${conversation.counterpartName || "Interested User"} • ${flat?.title || "Conversation"}`
  } else if (isFlatConversation) {
    const ownerId = String(flat?.ownerId || "")
    filteredMessages = messages.filter((message) => {
      const senderUserId = String(message.senderUserId || "")
      const recipientUserId = String(message.recipientUserId || "")
      const includesMe = senderUserId === currentUser.id || recipientUserId === currentUser.id
      const includesOwner = senderUserId === ownerId || recipientUserId === ownerId
      return includesMe && includesOwner
    })

    activeRecipientUserId = ownerId
    activeRecipientEmail = String(flat?.ownerEmail || "")
    threadTitle.textContent = flat ? `${flat.ownerName || "Property Owner"} • ${flat.title}` : "Conversation"
  } else {
    const isRoommateListingOwner = Boolean(conversation.isRoommateOwnerListing)
    if (isRoommateListingOwner) {
      const conversationUserId = String(conversation.counterpartUserId || "")
      const conversationEmail = String(conversation.counterpartEmail || "").trim().toLowerCase()

      filteredMessages = messages.filter((message) => {
        const senderUserId = String(message.senderUserId || "")
        const recipientUserId = String(message.recipientUserId || "")
        const senderEmail = String(message.senderEmail || "").trim().toLowerCase()
        const recipientEmail = String(message.recipientEmail || "").trim().toLowerCase()

        const matchesUser = conversationUserId && (senderUserId === conversationUserId || recipientUserId === conversationUserId)
        const matchesEmail = conversationEmail && (senderEmail === conversationEmail || recipientEmail === conversationEmail)
        return matchesUser || (!conversationUserId && matchesEmail)
      })

      activeRecipientUserId = conversationUserId
      activeRecipientEmail = conversationEmail
      threadTitle.textContent = `${conversation.counterpartName || "Interested Student"} • ${roommate?.name || "Roommate Listing"}`
    } else {
      filteredMessages = messages.filter((message) => {
        const senderUserId = String(message.senderUserId || "")
        const recipientUserId = String(message.recipientUserId || "")
        return senderUserId === String(currentUser.id || "") || recipientUserId === String(currentUser.id || "")
      })

      activeRecipientUserId = String(roommate?.createdByUserId || "")
      activeRecipientEmail = ""
      threadTitle.textContent = roommate?.name || "Listing Student"
    }
  }

  const sentCount = getMySentCount(filteredMessages)
  const hasPremium = Boolean(currentUser.subscription?.active)
  const remaining = hasPremium ? null : Math.max(FREE_CHAT_LIMIT - sentCount, 0)
  threadRemaining.textContent = hasPremium ? "Premium plan • Unlimited messages" : `${remaining} messages remaining`

  chatInput.disabled = !hasPremium && remaining <= 0
  sendBtn.disabled = !hasPremium && remaining <= 0

  if (!filteredMessages.length) {
    threadMessages.innerHTML = "<p class='muted'>No messages yet.</p>"
    return
  }

  threadMessages.innerHTML = filteredMessages
    .map(
      (message) => `
        <div class="${message.senderUserId === currentUser.id ? "bubble bubble-own" : "bubble bubble-peer"}">
          <p>${message.message}</p>
          <small>${new Date(message.createdAt).toLocaleString()}</small>
        </div>
      `,
    )
    .join("")
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault()
  if (!activeFlatId) {
    return
  }

  const activeConversation = conversationsCache.find((item) => item.id === activeConversationId)
  const isFlatConversation = String(activeConversation?.type || "flat") === "flat"
  const activeFlat = isFlatConversation ? flatMap.get(activeFlatId) : null
  const isOwner = String(currentUser.role || currentUser.intent || "").toLowerCase() === "owner"
  const isOwnListing = Boolean(activeFlat && activeFlat.ownerId === currentUser.id)

  if (isFlatConversation && isOwner && !isOwnListing) {
    window.alert("Owners cannot message other listings.")
    return
  }

  if (isFlatConversation && isOwner && isOwnListing && !activeRecipientUserId && !activeRecipientEmail) {
    window.alert("You can only reply when a student has messaged you.")
    return
  }

  if (activeRecipientUserId && activeRecipientUserId === currentUser.id) {
    window.alert("You cannot message yourself.")
    return
  }

  const formData = new FormData(chatForm)
  const message = String(formData.get("message") || "").trim()

  if (!message) {
    return
  }

  try {
    const endpoint = isFlatConversation
      ? `/api/chat/${activeFlatId}`
      : `/api/roommate-chat/${encodeURIComponent(activeFlatId)}`

    const response = await window.AppUtils.api(endpoint, {
      method: "POST",
      body: JSON.stringify({
        senderName: currentUser.name,
        senderEmail: currentUser.email,
        senderUserId: currentUser.id,
        recipientUserId: activeRecipientUserId || undefined,
        recipientEmail: activeRecipientEmail || undefined,
        target: isFlatConversation ? (activeRecipientUserId ? "user" : "owner") : "roommate-owner",
        message,
      }),
    })

    chatForm.reset()
    if (typeof response.remaining === "number") {
      chatStatus.textContent = `Message sent. ${response.remaining} messages remaining.`
    } else {
      chatStatus.textContent = "Message sent."
    }
    await loadConversations()
    await loadMessages()
  } catch (error) {
    if (/cannot message yourself/i.test(error.message || "")) {
      window.alert(error.message)
    }
    chatStatus.textContent = error.message
  }
})

if (currentUser) {
  const isOwner = String(currentUser.role || currentUser.intent || "").toLowerCase() === "owner"

  if (isOwner) {
    if (messagesPlanMeta) {
      messagesPlanMeta.classList.add("hidden")
    }
    if (messagesSubtitle) {
      messagesSubtitle.textContent = "Messages from interested students"
    }
  } else {
    planLabel.textContent = currentUser.subscription?.active ? `${currentUser.subscription.plan} Plan` : "Free Plan"
    if (upgradeLink) {
      upgradeLink.classList.remove("hidden")
    }
  }

  loadConversations().catch((error) => {
    chatStatus.textContent = error.message
  })
}

window.addEventListener("beforeunload", () => {
  if (chatStream) {
    chatStream.close()
  }
})
