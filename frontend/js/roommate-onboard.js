// Roommate Onboarding JS
window.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const flatId = urlParams.get("flatId");
  const userId = urlParams.get("userId");
  const nameInput = document.getElementById("nameInput");
  const emailInput = document.getElementById("emailInput");
  const bioInput = document.getElementById("bioInput");
  const ageInput = document.getElementById("ageInput");
  const genderInput = document.getElementById("genderInput");
  const professionInput = document.getElementById("professionInput");
  const scheduleInput = document.getElementById("scheduleInput");
  const cleanlinessInput = document.getElementById("cleanlinessInput");
  const habitsInput = document.getElementById("habitsInput");
  const foodInput = document.getElementById("foodInput");
  const interestsInput = document.getElementById("interestsInput");
  const socialInput = document.getElementById("socialInput");
  const onboardStatus = document.getElementById("onboardStatus");

  // Prefill with current user info if available
  let user = null;
  try {
    if (userId) {
      const res = await fetch(`/api/profile/${userId}`);
      if (res.ok) user = await res.json();
    }
  } catch {}
  if (user) {
    nameInput.value = user.name || "";
    emailInput.value = user.email || "";
    bioInput.value = user.bio || "";
    ageInput.value = user.age || "";
    genderInput.value = user.gender || "";
    professionInput.value = user.profession || user.course || "";
    scheduleInput.value = user.schedule || "";
    cleanlinessInput.value = user.cleanliness || "";
    habitsInput.value = user.habits || "";
    foodInput.value = user.food || "";
    interestsInput.value = Array.isArray(user.interests) ? user.interests.join(", ") : (user.interests || "");
    socialInput.value = user.social || "";
  }

  document.getElementById("onboardForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    onboardStatus.textContent = "";
    const payload = {
      flatId,
      userId,
      name: nameInput.value.trim(),
      email: emailInput.value.trim(),
      bio: bioInput.value.trim(),
      age: ageInput.value.trim(),
      gender: genderInput.value,
      profession: professionInput.value.trim(),
      schedule: scheduleInput.value.trim(),
      cleanliness: cleanlinessInput.value,
      habits: habitsInput.value,
      food: foodInput.value,
      interests: interestsInput.value.split(",").map(s => s.trim()).filter(Boolean),
      social: socialInput.value,
    };
    try {
      const res = await fetch("/api/roommate/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed to save");
      onboardStatus.textContent = "Profile saved! Redirecting back to flat details...";
      setTimeout(() => {
        if (flatId) {
          window.location.href = `/flat/${encodeURIComponent(flatId)}`;
          return;
        }

        window.location.href = "/dashboard";
      }, 700);
    } catch (err) {
      onboardStatus.textContent = err.message;
    }
  });
});
