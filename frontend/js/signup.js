const signupForm = document.getElementById("signupForm");
const signupStatus = document.getElementById("signupStatus");
const intentInput = document.getElementById("intentInput");
const roleStudentBtn = document.getElementById("role-student");
const roleOwnerBtn = document.getElementById("role-owner");
const signupStep1 = document.getElementById("signupStep1");
const signupStep2 = document.getElementById("signupStep2");
const nextStepBtn = document.getElementById("nextStepBtn");
const prevStepBtn = document.getElementById("prevStepBtn");
const universityInput = document.getElementById("universityInput");

function syncUniversityRequirement() {
  const isOwner = intentInput?.value === "owner";
  if (!universityInput) {
    return;
  }

  universityInput.required = !isOwner;
  universityInput.disabled = isOwner;
  if (isOwner) {
    universityInput.value = "";
    universityInput.placeholder = "Not required for owner signup";
  } else {
    universityInput.placeholder = "Your college or university";
  }
}

function resolveRedirect(user) {
  // Owners go to dashboard; students must complete onboarding questions first.
  if (user && (user.role === "owner" || user.intent === "owner")) {
    return "/dashboard";
  }
  return "/personality-quiz?onboarding=1";
}

if (nextStepBtn && signupStep1 && signupStep2) {
  nextStepBtn.addEventListener("click", () => {
    // Validate step 1 fields
    const name = signupForm.elements["name"].value.trim();
    const email = signupForm.elements["email"].value.trim();
    const password = signupForm.elements["password"].value;
    const confirmPassword = signupForm.elements["confirmPassword"].value;
    if (!name || !email || !password || !confirmPassword) {
      signupStatus.textContent = "Please fill all required fields.";
      return;
    }
    if (password !== confirmPassword) {
      signupStatus.textContent = "Passwords do not match.";
      return;
    }
    signupStatus.textContent = "";
    signupStep1.style.display = "none";
    signupStep2.style.display = "block";
  });
}

if (prevStepBtn && signupStep1 && signupStep2) {
  prevStepBtn.addEventListener("click", () => {
    signupStep2.style.display = "none";
    signupStep1.style.display = "block";
  });
}

roleStudentBtn?.addEventListener("click", () => {
  if (intentInput) intentInput.value = "seeker";
  syncUniversityRequirement();
});

roleOwnerBtn?.addEventListener("click", () => {
  if (intentInput) intentInput.value = "owner";
  syncUniversityRequirement();
});

syncUniversityRequirement();

signupForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  // Collect all form data from both steps
  const formData = new FormData(signupForm);
  // Amenities: collect all checked
  const amenities = [];
  signupForm.querySelectorAll('input[name="amenities"]:checked').forEach(cb => amenities.push(cb.value));
  const payload = Object.fromEntries(formData.entries());
  if (payload.intent !== "owner" && !String(payload.university || "").trim()) {
    signupStatus.textContent = "College / University is required for student signup.";
    return;
  }
  payload.amenities = amenities;
  payload.preferredRoomType = payload.intent === "owner" ? null : "room-only";

  try {
    const user = await window.AppUtils.api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    window.AppUtils.setCurrentUser(user);
    signupStatus.textContent = "Signup successful. Redirecting...";
    setTimeout(() => {
      window.location.href = resolveRedirect(user);
    }, 900);
  } catch (error) {
    signupStatus.textContent = error.message;
  }
});
