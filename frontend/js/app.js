const path = window.location.pathname
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/$/, "")

function injectGlobalFooter() {
  if (document.querySelector("[data-global-footer]")) {
    return
  }

  const footer = document.createElement("footer")
  footer.setAttribute("data-global-footer", "true")
  footer.className = "site-footer"
  footer.innerHTML = `
    <div class="footer-wrap">
      <div class="footer-grid">
        <div>
          <h3>Student Flat Finder</h3>
          <p>Find your perfect student accommodation with ease.</p>
        </div>
        <div>
          <h4>Quick Links</h4>
          <ul>
            <li><a href="/browse">Browse Flats</a></li>
            <li><a href="/list">List Your Flat</a></li>
            <li><a href="/subscription">Subscription</a></li>
          </ul>
        </div>
        <div>
          <h4>Support</h4>
          <ul>
            <li><a href="/community">Help Center</a></li>
            <li><a href="/feedback">Feedback</a></li>
            <li><a href="mailto:support@studentflatfinder.com">Contact Us</a></li>
          </ul>
        </div>
        <div>
          <h4>Connect</h4>
          <div class="footer-social">
            <a href="#">Facebook</a>
            <a href="#">Twitter</a>
            <a href="#">Instagram</a>
          </div>
        </div>
      </div>
      <div class="footer-bottom">© 2024 Student Flat Finder. All rights reserved.</div>
    </div>
  `

  document.body.appendChild(footer)
}

function formatINR(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`
}

const GEO_CACHE_VERSION = "v2"

function getCurrentUser() {
  const raw = localStorage.getItem("sff_user")
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function setCurrentUser(user) {
  localStorage.setItem("sff_user", JSON.stringify(user))
}

function logout() {
  localStorage.removeItem("sff_user")
  window.location.href = "/login"
}

function ensureLoggedIn(redirectTo = "/login") {
  const user = getCurrentUser()
  if (!user) {
    window.location.href = redirectTo
    return null
  }
  return user
}

async function api(pathname, options = {}) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`
  const targetUrl = pathname.startsWith("http") ? pathname : `${API_BASE_URL}${normalizedPath}` || normalizedPath

  const response = await fetch(targetUrl, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(payload.message || "Request failed")
    error.status = response.status
    error.payload = payload
    throw error
  }

  return payload
}

function resolveBackendUrl(pathname) {
  if (!pathname) {
    return pathname
  }

  if (pathname.startsWith("http")) {
    return pathname
  }

  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`
  return `${API_BASE_URL}${normalizedPath}` || normalizedPath
}

function applyUnifiedNav() {
  const navContainer = document.querySelector(".nav nav")
  if (!navContainer) {
    return
  }

  const currentUser = getCurrentUser()
  const role = String(currentUser?.role || "").toLowerCase()
  const intent = String(currentUser?.intent || "").toLowerCase()

  const isOwner = role === "owner" || intent === "owner"
  const isStudent = Boolean(currentUser) && !isOwner
  let roleLinks = `
    <a data-nav href="/">Home</a>
    <a data-nav href="/browse">Browse</a>
    <a data-nav href="/browse/map">Map View</a>
  `;
  if (isOwner) {
    roleLinks = `
      <a data-nav href="/">Home</a>
      <a data-nav href="/list?mode=owner">Listing</a>
      <a data-nav href="/dashboard">Dashboard</a>
      <a data-nav href="/chat">Messages</a>
    `;
  } else if (isStudent) {
    roleLinks = `
      <a data-nav href="/">Home</a>
      <a data-nav href="/browse">Browse</a>
      <a data-nav href="/browse/map">Map View</a>
      <a data-nav href="/dashboard">Dashboard</a>
      <a data-nav href="/chat">Messages</a>
    `;
  }

  navContainer.innerHTML = `
    ${roleLinks}
    ${
      currentUser
        ? `<div class="account-menu" id="accountMenu">
             <button id="accountMenuBtn" class="account-menu-btn" type="button" aria-expanded="false" aria-haspopup="menu">
               <span class="welcome-text">Welcome, ${currentUser.name}</span>
               <span class="account-caret">⌄</span>
             </button>
             <div class="account-dropdown hidden" id="accountDropdown" role="menu">
               <a href="/profile" role="menuitem">Edit Profile</a>
               <a href="/subscription" role="menuitem">Subscription</a>
               <a href="/feedback" role="menuitem">Feedback</a>
               <button id="logoutBtn" class="account-logout" type="button" role="menuitem">Logout</button>
             </div>
           </div>`
        : `<a class="btn btn-primary small-btn" href="/login">Login</a>
           <a class="btn btn-secondary small-btn" href="/signup">Sign Up</a>`
    }
  `

  const navLinks = navContainer.querySelectorAll("[data-nav]")
  navLinks.forEach((link) => {
    const href = link.getAttribute("href")
    const hrefPath = String(href || "").split("?")[0]
    if (hrefPath === path) {
      link.classList.add("active-link")
    }
  })

  const accountMenuBtn = document.getElementById("accountMenuBtn")
  const accountDropdown = document.getElementById("accountDropdown")
  if (accountMenuBtn && accountDropdown) {
    accountMenuBtn.addEventListener("click", (event) => {
      event.stopPropagation()
      const expanded = accountMenuBtn.getAttribute("aria-expanded") === "true"
      accountMenuBtn.setAttribute("aria-expanded", expanded ? "false" : "true")
      accountDropdown.classList.toggle("hidden", expanded)
    })

    window.addEventListener("click", (event) => {
      const accountMenu = document.getElementById("accountMenu")
      if (!accountMenu?.contains(event.target)) {
        accountDropdown.classList.add("hidden")
        accountMenuBtn.setAttribute("aria-expanded", "false")
      }
    })
  }

  const logoutBtn = document.getElementById("logoutBtn")
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout)
  }

  // Only owners can see the listing link. Students cannot list flats.
  if (!isOwner) {
    const listingLinks = document.querySelectorAll('a[href="/list"], a[href^="/list?"]')
    listingLinks.forEach((link) => {
      link.classList.add("hidden")
      link.setAttribute("aria-hidden", "true")
      link.setAttribute("tabindex", "-1")
    });
  }
}

function haversineDistanceKm(fromCoordinates, toCoordinates) {
  if (!Array.isArray(fromCoordinates) || !Array.isArray(toCoordinates) || fromCoordinates.length < 2 || toCoordinates.length < 2) {
    return null
  }

  const lat1 = Number(fromCoordinates[0])
  const lng1 = Number(fromCoordinates[1])
  const lat2 = Number(toCoordinates[0])
  const lng2 = Number(toCoordinates[1])

  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) {
    return null
  }

  const earthRadiusKm = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Number((earthRadiusKm * c).toFixed(1))
}

async function getRoadDistanceKm(fromCoordinates, toCoordinates) {
  if (!Array.isArray(fromCoordinates) || !Array.isArray(toCoordinates) || fromCoordinates.length < 2 || toCoordinates.length < 2) {
    return null
  }

  const fromLat = Number(fromCoordinates[0])
  const fromLng = Number(fromCoordinates[1])
  const toLat = Number(toCoordinates[0])
  const toLng = Number(toCoordinates[1])

  if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite)) {
    return null
  }

  const roundedKey = `sff_route_${GEO_CACHE_VERSION}_${fromLat.toFixed(4)}_${fromLng.toFixed(4)}_${toLat.toFixed(4)}_${toLng.toFixed(4)}`
  const cached = localStorage.getItem(roundedKey)
  if (cached) {
    const cachedValue = Number(cached)
    if (Number.isFinite(cachedValue)) {
      return cachedValue
    }
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false&alternatives=false&steps=false`
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      return null
    }

    const payload = await response.json()
    const meters = Number(payload?.routes?.[0]?.distance)
    if (!Number.isFinite(meters) || meters <= 0) {
      return null
    }

    const km = Number((meters / 1000).toFixed(1))
    localStorage.setItem(roundedKey, String(km))
    return km
  } catch {
    return null
  }
}

async function geocodeAddress(address) {
  const normalized = String(address || "").trim()
  if (!normalized) {
    return null
  }

  const cacheKey = `sff_geo_${GEO_CACHE_VERSION}_${normalized.toLowerCase()}`
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    try {
      const parsed = JSON.parse(cached)
      if (Array.isArray(parsed) && parsed.length >= 2) {
        return [Number(parsed[0]), Number(parsed[1])]
      }
    } catch {
      // ignore cache parse errors
    }
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=in&limit=1&q=${encodeURIComponent(normalized)}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    )

    if (!response.ok) {
      return null
    }

    const payload = await response.json()
    const first = Array.isArray(payload) ? payload[0] : null
    const lat = Number(first?.lat)
    const lng = Number(first?.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null
    }

    const coordinates = [lat, lng]
    localStorage.setItem(cacheKey, JSON.stringify(coordinates))
    return coordinates
  } catch {
    return null
  }
}

async function geocodeAddressNearest(address, referenceCoordinates) {
  const normalized = String(address || "").trim()
  if (!normalized) {
    return null
  }

  if (!Array.isArray(referenceCoordinates) || referenceCoordinates.length < 2) {
    return geocodeAddress(normalized)
  }

  const refLat = Number(referenceCoordinates[0])
  const refLng = Number(referenceCoordinates[1])
  if (!Number.isFinite(refLat) || !Number.isFinite(refLng)) {
    return geocodeAddress(normalized)
  }

  const cacheKey = `sff_geo_near_${GEO_CACHE_VERSION}_${normalized.toLowerCase()}_${refLat.toFixed(3)}_${refLng.toFixed(3)}`
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    try {
      const parsed = JSON.parse(cached)
      if (Array.isArray(parsed) && parsed.length >= 2) {
        return [Number(parsed[0]), Number(parsed[1])]
      }
    } catch {
      // ignore cache parse errors
    }
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=in&limit=5&q=${encodeURIComponent(normalized)}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    )

    if (!response.ok) {
      return geocodeAddress(normalized)
    }

    const payload = await response.json()
    const candidates = Array.isArray(payload)
      ? payload
          .map((item) => [Number(item?.lat), Number(item?.lon)])
          .filter((coords) => Number.isFinite(coords[0]) && Number.isFinite(coords[1]))
      : []

    if (!candidates.length) {
      return geocodeAddress(normalized)
    }

    const ranked = candidates
      .map((coords) => ({
        coords,
        distance: haversineDistanceKm(referenceCoordinates, coords),
      }))
      .filter((item) => typeof item.distance === "number")
      .sort((a, b) => a.distance - b.distance)

    const best = ranked[0]?.coords || candidates[0]
    localStorage.setItem(cacheKey, JSON.stringify(best))
    return best
  } catch {
    return geocodeAddress(normalized)
  }
}

document.body.classList.add("site-theme")
if (path === "/login" || path === "/signup") {
  document.body.classList.add("auth-screen")
}
applyUnifiedNav()

window.AppUtils = {
  formatINR,
  getCurrentUser,
  setCurrentUser,
  logout,
  ensureLoggedIn,
  api,
  resolveBackendUrl,
  haversineDistanceKm,
  getRoadDistanceKm,
  geocodeAddress,
  geocodeAddressNearest,
}

document.addEventListener("DOMContentLoaded", function () {
  const profileIcon = document.getElementById("profileIcon");
  const profileDropdown = document.getElementById("profileDropdown");
  if (profileIcon && profileDropdown) {
    profileIcon.addEventListener("click", function (e) {
      e.stopPropagation();
      profileDropdown.classList.toggle("hidden");
    });
    document.addEventListener("click", function (e) {
      if (!profileDropdown.classList.contains("hidden") && !profileDropdown.contains(e.target) && e.target !== profileIcon) {
        profileDropdown.classList.add("hidden");
      }
    });
    // Optional: Hide dropdown on ESC key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        profileDropdown.classList.add("hidden");
      }
    });
  }
});
