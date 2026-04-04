const mapList = document.getElementById("mapList")
const mapSearch = document.getElementById("mapSearch")
const mapCount = document.getElementById("mapCount")
const mapFrame = document.getElementById("mapFrame")
const routeFlatAddress = document.getElementById("routeFlatAddress")
const routeOriginInput = document.getElementById("routeOriginInput")

const CAMPUS = { lat: 28.6692, lng: 77.2065 }

let allFlats = []
let filteredFlats = []
let activeFlatId = ""
let studentCollege = ""
let routeOriginOverride = ""
let routeOriginDebounceTimer
let stream

function normalizeCoordinates(entry) {
  if (Array.isArray(entry?.coordinates) && entry.coordinates.length === 2) {
    const lat = Number(entry.coordinates[0])
    const lng = Number(entry.coordinates[1])
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return [lat, lng]
    }
  }

  return null
}

function toDistanceFromCampus(item) {
  if (!Array.isArray(item.coordinates) || item.coordinates.length !== 2) {
    return null
  }

  return window.AppUtils.haversineDistanceKm([CAMPUS.lat, CAMPUS.lng], item.coordinates)
}

function toMapItem(entry, type = "flat") {
  if (type === "roommate") {
    const [lat, lng] = Array.isArray(entry.mapCoordinates)
      ? entry.mapCoordinates
      : Array.isArray(entry.location?.coordinates)
        ? entry.location.coordinates
        : []

    const hasCoordinates = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
    return {
      id: `roommate:${entry.id}`,
      rawId: entry.id,
      type,
      title: `${entry.name} (Roommate)`,
      address: entry.address || entry.location?.address || entry.displayAddress || entry.linkedFlatAddress || "Campus Area",
      prefersAddressQuery: Boolean(entry.address || entry.location?.address),
      rentText: `${window.AppUtils.formatINR(entry.preferredRentMax)} max budget / month`,
      coordinates: hasCoordinates ? [Number(lat), Number(lng)] : null,
      distanceFromCampusKm: hasCoordinates ? window.AppUtils.haversineDistanceKm([CAMPUS.lat, CAMPUS.lng], [Number(lat), Number(lng)]) : null,
    }
  }

  const [lat, lng] = Array.isArray(entry.location?.coordinates) ? entry.location.coordinates : []
  return {
    id: `flat:${entry.id}`,
    rawId: entry.id,
    type,
    title: entry.title,
    address: entry.location?.address || "Address not available",
    prefersAddressQuery: true,
    rentText: `${window.AppUtils.formatINR(entry.rent)} / month`,
    coordinates: Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? [Number(lat), Number(lng)] : null,
    distanceFromCampusKm:
      Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
        ? window.AppUtils.haversineDistanceKm([CAMPUS.lat, CAMPUS.lng], [Number(lat), Number(lng)])
        : null,
  }
}

function mapEmbedUrl(item) {
  if (item.prefersAddressQuery && item.address) {
    return `https://www.google.com/maps?q=${encodeURIComponent(item.address)}&z=14&output=embed`
  }

  if (Array.isArray(item.coordinates) && item.coordinates.length === 2) {
    const [lat, lng] = item.coordinates
    return `https://www.google.com/maps?q=${lat},${lng}&z=14&output=embed`
  }
  return `https://www.google.com/maps?q=${encodeURIComponent(item.address)}&z=14&output=embed`
}

function toCityHint(address) {
  const parts = String(address || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length < 2) {
    return ""
  }

  // Common listing format is "street, locality, city, pincode".
  return parts[parts.length - 2] || ""
}

function toOriginForRoute(destinationAddress) {
  const baseOrigin = String(routeOriginOverride || studentCollege || "").trim()
  if (!baseOrigin) {
    return `${CAMPUS.lat},${CAMPUS.lng}`
  }

  // If user entered only college name, append destination city to avoid wrong-city routing.
  const hasCityLikeSuffix = /,/.test(baseOrigin)
  const cityHint = toCityHint(destinationAddress)
  if (!hasCityLikeSuffix && cityHint) {
    return `${baseOrigin}, ${cityHint}`
  }

  return baseOrigin
}

function routeEmbedUrl(item) {
  const destination = item.prefersAddressQuery && item.address
    ? String(item.address)
    : Array.isArray(item.coordinates) && item.coordinates.length === 2
      ? `${item.coordinates[0]},${item.coordinates[1]}`
      : String(item.address || "")

  const origin = toOriginForRoute(item.address)

  if (!destination) {
    return mapEmbedUrl(item)
  }

  return `https://www.google.com/maps?output=embed&saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(destination)}&dirflg=d&travelmode=driving`
}

function formatDistance(distance) {
  if (!Number.isFinite(Number(distance))) {
    return null
  }

  const numeric = Number(distance)
  if (numeric <= 0.05) {
    return null
  }

  return `${numeric.toFixed(1)} km from campus`
}

function setSelectedFlat(item) {
  if (!item) {
    return
  }

  // When switching listings, always reset route origin to the student's saved college.
  routeOriginOverride = ""
  if (routeOriginInput) {
    routeOriginInput.value = studentCollege
  }

  activeFlatId = item.id
  mapFrame.src = routeEmbedUrl(item)
  if (routeFlatAddress) {
    routeFlatAddress.textContent = item.address || "-"
  }

  const items = mapList.querySelectorAll("li")
  items.forEach((item) => {
    item.classList.toggle("active-map-item", item.dataset.id === activeFlatId)
  })
}

function refreshActiveRoute() {
  if (!activeFlatId) {
    return
  }

  const activeFlat = allFlats.find((flat) => flat.id === activeFlatId)
  if (activeFlat) {
    setSelectedFlat(activeFlat)
  }
}

function renderList(flats) {
  filteredFlats = flats
  mapCount.textContent = `${flats.length} listing${flats.length === 1 ? "" : "s"}`

  if (!flats.length) {
    mapList.innerHTML = '<li class="muted">No listings found.</li>'
    mapFrame.removeAttribute("src")
    if (routeFlatAddress) {
      routeFlatAddress.textContent = "-"
    }
    return
  }

  mapList.innerHTML = flats
    .map(
      (flat) => {
        const distanceBadge = formatDistance(flat.distanceFromCampusKm)
        return `
      <li data-id="${flat.id}" class="map-item-card">
        <strong>${flat.title}</strong>
        <p class="muted">${flat.address}</p>
        <p>${flat.rentText}</p>
        ${distanceBadge ? `<span class="map-distance-badge">${distanceBadge}</span>` : ""}
      </li>
    `
      },
    )
    .join("")

  mapList.querySelectorAll("li[data-id]").forEach((item) => {
    item.addEventListener("click", () => {
      const flat = flats.find((entry) => entry.id === item.dataset.id)
      setSelectedFlat(flat)
    })
  })

  const selectedFromCurrent = flats.find((flat) => flat.id === activeFlatId)
  setSelectedFlat(selectedFromCurrent || flats[0])
}

function applyFilter() {
  const query = mapSearch.value.trim().toLowerCase()
  const source = [...allFlats].sort((a, b) => {
    const aDistance = Number.isFinite(Number(a.distanceFromCampusKm)) ? Number(a.distanceFromCampusKm) : Number.MAX_SAFE_INTEGER
    const bDistance = Number.isFinite(Number(b.distanceFromCampusKm)) ? Number(b.distanceFromCampusKm) : Number.MAX_SAFE_INTEGER
    return aDistance - bDistance
  })

  if (!query) {
    renderList(source)
    return
  }

  const results = source.filter(
    (flat) =>
      flat.title.toLowerCase().includes(query) ||
      flat.address.toLowerCase().includes(query),
  )

  renderList(results)
}

async function loadStudentCollege() {
  const currentUser = window.AppUtils.getCurrentUser?.()
  studentCollege = String(currentUser?.university || currentUser?.college || "").trim()

  if (routeOriginInput) {
    routeOriginInput.value = studentCollege
  }

  if (!currentUser?.id) {
    return
  }

  try {
    const profile = await window.AppUtils.api(`/api/profile/${encodeURIComponent(currentUser.id)}`)
    const profileCollege = String(profile?.university || profile?.college || "").trim()
    if (profileCollege) {
      studentCollege = profileCollege
      if (routeOriginInput) {
        routeOriginInput.value = studentCollege
      }

      refreshActiveRoute()
    }
  } catch {
    // Keep fallback value from local storage or campus anchor.
  }
}

async function loadMapData() {
  const [flatResponse, roommateResponse] = await Promise.all([fetch("/api/flats"), fetch("/api/roommates")])
  if (!flatResponse.ok || !roommateResponse.ok) {
    mapCount.textContent = "Failed to load listings"
    mapList.innerHTML = '<li class="muted">Could not load map data.</li>'
    return
  }

  const [flats, roommates] = await Promise.all([flatResponse.json(), roommateResponse.json()])
  const flatItems = Array.isArray(flats) ? flats.map((entry) => toMapItem(entry, "flat")) : []
  const roommateItems = Array.isArray(roommates) ? roommates.map((entry) => toMapItem(entry, "roommate")) : []
  allFlats = [...flatItems, ...roommateItems].sort((a, b) => {
    const aDistance = Number.isFinite(Number(a.distanceFromCampusKm)) ? Number(a.distanceFromCampusKm) : Number.MAX_SAFE_INTEGER
    const bDistance = Number.isFinite(Number(b.distanceFromCampusKm)) ? Number(b.distanceFromCampusKm) : Number.MAX_SAFE_INTEGER
    return aDistance - bDistance
  })
  applyFilter()
}

window.addEventListener("DOMContentLoaded", () => {
  loadStudentCollege()
  loadMapData()
  mapSearch.addEventListener("input", applyFilter)

  if (routeOriginInput) {
    routeOriginInput.addEventListener("input", () => {
      routeOriginOverride = String(routeOriginInput.value || "").trim()
      window.clearTimeout(routeOriginDebounceTimer)
      routeOriginDebounceTimer = window.setTimeout(() => {
        refreshActiveRoute()
      }, 350)
    })

    routeOriginInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault()
        routeOriginOverride = String(routeOriginInput.value || "").trim()
        refreshActiveRoute()
      }
    })
  }

  stream = new EventSource("/api/stream/browse")
  stream.addEventListener("browse-update", () => {
    loadMapData()
  })
})

window.addEventListener("beforeunload", () => {
  if (stream) {
    stream.close()
  }
})
