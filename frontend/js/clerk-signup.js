(function clerkSignupPrefillCapture() {
  const prepForm = document.getElementById("clerkProfilePrep")
  const statusNode = document.getElementById("signupStatus")
  const mountNode = document.getElementById("clerkSignUpMount")
  const intentInput = document.getElementById("intentInput")
  const universityInput = document.getElementById("universityInput")
  const courseInput = document.getElementById("courseInput")
  const publishableKey = String(window.CLERK_PUBLISHABLE_KEY || "").trim()

  if (!prepForm || !mountNode) return

  async function mountSignUpWidget() {
    let attempts = 0
    while (!window.Clerk && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      attempts += 1
    }

    if (!window.Clerk) {
      throw new Error("Clerk script failed to load")
    }

    await window.Clerk.load({ publishableKey })

    if (window.Clerk.user) {
      window.location.href = "/auth/callback?flow=signup"
      return
    }

    window.Clerk.mountSignUp(mountNode, {
      signInUrl: "/login",
      forceRedirectUrl: "/auth/callback?flow=signup",
    })
  }

  prepForm.addEventListener("submit", async (event) => {
    event.preventDefault()

    if (!publishableKey || publishableKey.includes("replace_with")) {
      if (statusNode) {
        statusNode.textContent = "Set window.CLERK_PUBLISHABLE_KEY in signup page before using Clerk."
      }
      return
    }

    const intent = String(intentInput?.value || "seeker").trim().toLowerCase() === "owner" ? "owner" : "seeker"
    const university = String(universityInput?.value || "").trim()
    const course = String(courseInput?.value || "").trim()

    if (intent !== "owner" && !university) {
      if (statusNode) {
        statusNode.textContent = "College / University is required for student signup."
      }
      return
    }

    localStorage.setItem("sff_auth_intent", intent)
    localStorage.setItem("sff_auth_university", university)
    localStorage.setItem("sff_auth_course", course)

    prepForm.style.display = "none"
    mountNode.style.display = "block"

    try {
      await mountSignUpWidget()
    } catch (error) {
      prepForm.style.display = "block"
      mountNode.style.display = "none"
      if (statusNode) {
        statusNode.textContent = String(error?.message || "Failed to initialize Clerk sign up.")
      }
    }
  })
})()
