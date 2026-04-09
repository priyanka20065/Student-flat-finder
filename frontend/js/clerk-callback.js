(async function handleClerkCallback() {
  const statusNode = document.getElementById("authCallbackStatus")
  const publishableKey = String(window.CLERK_PUBLISHABLE_KEY || "").trim()

  function setStatus(text) {
    if (statusNode) statusNode.textContent = text
  }

  if (!publishableKey || publishableKey.includes("replace_with")) {
    setStatus("Set window.CLERK_PUBLISHABLE_KEY before using Clerk callback.")
    return
  }

  let attempts = 0
  while (!window.Clerk && attempts < 50) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    attempts += 1
  }

  if (!window.Clerk) {
    setStatus("Clerk script failed to load. Please try again.")
    return
  }

  try {
    await window.Clerk.load({ publishableKey })

    const session = window.Clerk.session
    if (!session || !window.Clerk.user) {
      setStatus("No active Clerk session found. Redirecting to login...")
      setTimeout(() => {
        window.location.href = "/login"
      }, 600)
      return
    }

    setStatus("Verifying Clerk session and syncing account...")

    const clerkToken = await session.getToken()
    if (!clerkToken) {
      throw new Error("Unable to get Clerk session token")
    }

    const intent = String(localStorage.getItem("sff_auth_intent") || "seeker").trim().toLowerCase() === "owner" ? "owner" : "seeker"
    const university = String(localStorage.getItem("sff_auth_university") || "").trim()
    const course = String(localStorage.getItem("sff_auth_course") || "").trim()

    const response = await fetch("/api/auth/clerk/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${clerkToken}`,
      },
      body: JSON.stringify({
        intent,
        preferredRoomType: intent === "owner" ? null : "room-only",
        university,
        course,
      }),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload.message || "Account sync failed")
    }

    localStorage.setItem("sff_user", JSON.stringify(payload))
    localStorage.removeItem("sff_auth_intent")
    localStorage.removeItem("sff_auth_university")
    localStorage.removeItem("sff_auth_course")

    const normalizedRole = String(payload?.role || "").toLowerCase()
    const normalizedIntent = String(payload?.intent || "").toLowerCase()
    const isOwner = normalizedRole === "owner" || normalizedIntent === "owner"

    setStatus("Authentication successful. Redirecting...")
    setTimeout(() => {
      window.location.href = isOwner ? "/dashboard?mode=owner" : "/dashboard?mode=student"
    }, 500)
  } catch (error) {
    setStatus(String(error?.message || "Authentication failed."))
  }
})()
