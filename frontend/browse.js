const flatGrid = document.getElementById("flatGrid")
const resultCount = document.getElementById("resultCount")
const applyFiltersButton = document.getElementById("applyFilters")

const controls = {
  searchInput: document.getElementById("searchInput"),
  flatType: document.getElementById("flatType"),
  minRent: document.getElementById("minRent"),
  maxRent: document.getElementById("maxRent"),
}

function renderFlats(flats) {
  if (!flats.length) {
    flatGrid.innerHTML = '<p class="empty-state">No flats found. Try different filters.</p>'
    resultCount.textContent = "0 results"
    return
  }

  flatGrid.innerHTML = flats
    .map(
      (flat) => {
        const isShared = flat.maxOccupants && flat.maxOccupants > 1;
        const current = flat.currentOccupants || 1;
        const max = flat.maxOccupants || 1;
        const vacancies = Math.max(0, max - current);
        return `
      <article class="flat-card">
        <img src="${flat.images[0]}" alt="${flat.title}" class="flat-image" />
        <div class="flat-content">
          <h3>${flat.title}</h3>
          <p class="muted">${flat.location.address}</p>
          <p>${flat.description}</p>
          <p><strong>₹${flat.rent.toLocaleString("en-IN")}</strong> / month</p>
          <p class="muted">Room Type: <strong>${isShared ? "Shared" : "Single"}</strong></p>
          <p>Current Occupants: <strong>${current}</strong></p>
          <p>Vacancies: <strong>${vacancies}</strong></p>
        </div>
      </article>
      `;
      }
    )
    .join("")

  resultCount.textContent = `${flats.length} result${flats.length > 1 ? "s" : ""}`
}

async function loadFlats() {
  const params = new URLSearchParams({
    q: controls.searchInput.value.trim(),
    flatType: controls.flatType.value,
    minRent: controls.minRent.value || "0",
    maxRent: controls.maxRent.value || "999999",
  })

  const response = await fetch(`/api/flats?${params.toString()}`)
  if (!response.ok) {
    flatGrid.innerHTML = '<p class="empty-state">Failed to load flats.</p>'
    resultCount.textContent = "Error"
    return
  }

  const flats = await response.json()
  renderFlats(flats)
}

applyFiltersButton.addEventListener("click", loadFlats)
window.addEventListener("DOMContentLoaded", loadFlats)
