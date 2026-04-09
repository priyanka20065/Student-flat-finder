const statusText = document.getElementById("paymentStatus")

function normalizePlanName(plan) {
  return String(plan || "").trim().toLowerCase()
}

function getDurationDays(plan) {
  const normalized = normalizePlanName(plan)
  if (normalized === "premium yearly") {
    return 365
  }
  return 30
}

function getSubscriptionExpiry(subscription) {
  if (!subscription) {
    return null
  }

  const explicitExpiry = String(subscription.expiresAt || "").trim()
  if (explicitExpiry) {
    const parsed = new Date(explicitExpiry)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  const activatedAt = new Date(subscription.activatedAt || Date.now())
  if (Number.isNaN(activatedAt.getTime())) {
    return null
  }
  const expiry = new Date(activatedAt)
  expiry.setDate(expiry.getDate() + getDurationDays(subscription.plan))
  return expiry
}

function getSubscriptionLock(subscription) {
  if (!subscription?.active) {
    return { active: false, expiresAt: null }
  }

  const expiry = getSubscriptionExpiry(subscription)
  if (!expiry) {
    return { active: false, expiresAt: null }
  }

  if (expiry.getTime() <= Date.now()) {
    return { active: false, expiresAt: expiry }
  }

  return { active: true, expiresAt: expiry }
}

function updatePlanUi(user) {
  const lock = getSubscriptionLock(user?.subscription)
  const activePlan = String(user?.subscription?.plan || "").trim()
  const activePlanNormalized = normalizePlanName(activePlan)
  const cards = document.querySelectorAll("[data-plan-card]")
  const buttons = document.querySelectorAll("[data-plan-btn]")

  cards.forEach((card) => {
    const cardPlan = String(card.getAttribute("data-plan-card") || "")
    const isActive = lock.active && normalizePlanName(cardPlan) === activePlanNormalized
    card.classList.toggle("plan-active", isActive)
  })

  buttons.forEach((button) => {
    const buttonPlan = String(button.dataset.plan || "")
    const isCurrentPlan = lock.active && normalizePlanName(buttonPlan) === activePlanNormalized
    button.disabled = lock.active

    if (isCurrentPlan) {
      button.textContent = "Current Plan"
      button.classList.remove("btn-primary", "btn-dark")
      button.classList.add("btn-light")
      return
    }

    if (normalizePlanName(buttonPlan) === "premium") {
      button.textContent = lock.active ? "Locked" : "Get Premium"
      button.classList.remove("btn-dark", "btn-light")
      button.classList.add("btn-primary")
      return
    }

    button.textContent = lock.active ? "Locked" : "Get Yearly Plan"
    button.classList.remove("btn-primary", "btn-light")
    button.classList.add("btn-dark")
  })

  if (lock.active && lock.expiresAt) {
    statusText.textContent = `Your ${activePlan} plan is active until ${lock.expiresAt.toLocaleDateString("en-IN")}.`
  }
}

async function loadPaymentConfig() {
  const config = await window.AppUtils.api("/api/payment/config")
  return config
}

function attachPlanButtons(config) {
  const buttons = document.querySelectorAll("[data-plan-btn]")

  buttons.forEach((button) => {
    button.addEventListener("click", async () => {
      const plan = button.dataset.plan
      const amount = Number(button.dataset.amount || 0)
      const user = window.AppUtils.getCurrentUser()
      const lock = getSubscriptionLock(user?.subscription)

      if (!user?.id) {
        statusText.textContent = "Please login first to activate a subscription plan."
        window.location.href = "/login"
        return
      }

      if (lock.active && lock.expiresAt) {
        statusText.textContent = `You already have an active plan until ${lock.expiresAt.toLocaleDateString("en-IN")}.`
        updatePlanUi(user)
        return
      }

      if (!config.enabled || !config.keyId) {
        statusText.textContent = "Payment is not configured. Please set Razorpay env variables."
        return
      }

      try {
        statusText.textContent = "Creating payment order..."
        const order = await window.AppUtils.api("/api/payment/create-order", {
          method: "POST",
          body: JSON.stringify({
            amount,
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
            notes: {
              plan,
              userId: user?.id || "guest",
            },
          }),
        })

        const options = {
          key: config.keyId,
          amount: order.amount,
          currency: order.currency,
          name: "Student Flat Finder",
          description: `${plan} subscription`,
          order_id: order.id,
          handler: async (response) => {
            try {
              const verify = await window.AppUtils.api("/api/payment/verify", {
                method: "POST",
                body: JSON.stringify({
                  ...response,
                  userId: user.id,
                  plan,
                }),
              })

              if (verify.verified && verify.user) {
                window.AppUtils.setCurrentUser(verify.user)
                statusText.textContent = `Payment successful. ${plan} plan activated ✅`
                updatePlanUi(verify.user)
                return
              }

              if (verify.verified) {
                const updatedUser = await window.AppUtils.api("/api/subscription/activate", {
                  method: "POST",
                  body: JSON.stringify({
                    userId: user.id,
                    plan,
                  }),
                })
                window.AppUtils.setCurrentUser(updatedUser)
                statusText.textContent = `Payment successful. ${plan} plan activated ✅`
                updatePlanUi(updatedUser)
                return
              }

              statusText.textContent = "Payment verification failed"
            } catch (error) {
              statusText.textContent = error.message || "Payment succeeded but subscription update failed"
            }
          },
          prefill: {
            name: user?.name || "Student User",
            email: user?.email || "",
          },
          theme: {
            color: "#2563eb",
          },
        }

        const paymentObject = new window.Razorpay(options)
        paymentObject.on("payment.failed", (error) => {
          statusText.textContent = error.error?.description || "Payment failed"
        })
        paymentObject.open()
      } catch (error) {
        statusText.textContent = error.message
      }
    })
  })
}

window.addEventListener("DOMContentLoaded", async () => {
  try {
    window.AppUtils.ensureLoggedIn("/login")
    const currentUser = window.AppUtils.getCurrentUser()
    updatePlanUi(currentUser)
    const config = await loadPaymentConfig()
    attachPlanButtons(config)
    if (!config.enabled && !getSubscriptionLock(currentUser?.subscription).active) {
      statusText.textContent = "Payment not active yet. Configure Razorpay env variables to enable checkout."
    }
  } catch (error) {
    statusText.textContent = error.message
  }
})
