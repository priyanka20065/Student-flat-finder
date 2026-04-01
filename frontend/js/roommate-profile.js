// Roommate Profile Page
window.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const email = urlParams.get("email");
  const profileContent = document.getElementById("profileContent");

  if (!email) {
    profileContent.textContent = "No roommate email provided.";
    return;
  }

  try {
    // Fetch all users and roommates (for demo, you may want to optimize this in real app)
    const res = await fetch(`/api/roommate/profile?email=${encodeURIComponent(email)}`);
    if (!res.ok) throw new Error("Roommate not found");
    const rm = await res.json();
    // Helper for missing info
    const badge = '<span class="profile-badge">Not specified</span>';
    const icon = (svg) => `<span class="icon">${svg}</span>`;
    profileContent.innerHTML = `
      <div class="profile-section"><span class="profile-label">${icon('👤')} Name:</span> <span class="profile-value">${rm.name || badge}</span></div>
      <div class="profile-section"><span class="profile-label">${icon('📧')} Email:</span> <span class="profile-value">${rm.email || badge}</span></div>
      <div class="profile-section"><span class="profile-label">${icon('🎂')} Age:</span> <span class="profile-value">${rm.age || badge}</span></div>
      <div class="profile-section"><span class="profile-label">${icon('⚧️')} Gender:</span> <span class="profile-value">${rm.gender || badge}</span></div>
      <div class="profile-section"><span class="profile-label">${icon('🎓')} Profession:</span> <span class="profile-value">${rm.profession || badge}</span></div>
      <div class="profile-section"><span class="profile-label">${icon('🎓')} Course:</span> <span class="profile-value">${rm.course || badge}</span></div>
      <div class="profile-section"><span class="profile-label">${icon('⏰')} Daily Schedule:</span> <span class="profile-value">${rm.schedule || badge}</span></div>
      <div class="profile-section"><span class="profile-label">${icon('🧹')} Cleanliness Level:</span> <span class="profile-value">${rm.cleanliness || badge}</span></div>
      <div class="profile-section"><span class="profile-label">${icon('🚬')} Habits:</span> <span class="profile-value">${rm.habits || badge}</span></div>
      <div class="profile-section"><span class="profile-label">${icon('🍽️')} Food Preferences:</span> <span class="profile-value">${rm.food || badge}</span></div>
      <div class="profile-section"><span class="profile-label">${icon('🤝')} Social Preferences:</span> <span class="profile-value">${rm.social || badge}</span></div>
      <div class="profile-section"><span class="profile-label">${icon('📝')} Bio:</span> <span class="profile-value">${rm.bio || badge}</span></div>
      <div class="profile-section"><span class="profile-label">${icon('⭐')} Interests:</span> <span class="profile-value chip-list">${(rm.interests || []).length ? (rm.interests || []).map(i => `<span class='chip'>${i}</span>`).join('') : badge}</span></div>
      <div class="profile-section"><span class="profile-label">${icon('📅')} Move-in Date:</span> <span class="profile-value">${rm.moveInDate || badge}</span></div>
      <div class="profile-section"><span class="profile-label">${icon('🧬')} Personality:</span> <span class="profile-value">${rm.personality ? `Cleanliness: ${rm.personality.cleanliness}, Social: ${rm.personality.socialLevel}, Study: ${rm.personality.studyHabits}` : badge}</span></div>
    `;
  } catch (err) {
    profileContent.textContent = err.message || "Failed to load profile.";
  }
});
