(async function initClerkLogin() {
  const mountNode = document.getElementById("clerkSignInMount")
  const statusNode = document.getElementById("loginStatus")
  const publishableKey = String(window.CLERK_PUBLISHABLE_KEY || "").trim()

  if (!mountNode) return

  if (!publishableKey || publishableKey.includes("replace_with")) {
    if (statusNode) {
      statusNode.textContent = "Set window.CLERK_PUBLISHABLE_KEY in login page before using Clerk."
    }
    return
  }

  let attempts = 0
  while (!window.Clerk && attempts < 50) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    attempts += 1
  }

  if (!window.Clerk) {
    if (statusNode) {
      statusNode.textContent = "Clerk script failed to load. Refresh and try again."
    }
    return
  }

  try {
    await window.Clerk.load({ publishableKey })
    const shouldSignOut = new URLSearchParams(window.location.search).get("signout") === "1"
    if (shouldSignOut && window.Clerk.user) {
      await window.Clerk.signOut()
    }

    if (window.Clerk.user) {
      window.location.href = "/auth/callback?flow=signin"
      return
    }

    window.Clerk.mountSignIn(mountNode, {
      signUpUrl: "/signup",
      forceRedirectUrl: "/auth/callback?flow=signin",
    })
  } catch (error) {
    if (statusNode) {
      statusNode.textContent = String(error?.message || "Failed to initialize Clerk sign in.")
    }
  }
})()
