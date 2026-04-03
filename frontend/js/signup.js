const signupForm = document.getElementById("signupForm");
const signupStatus = document.getElementById("signupStatus");
const signupStep1 = document.getElementById("signupStep1");
const signupStep2 = document.getElementById("signupStep2");
const nextStepBtn = document.getElementById("nextStepBtn");
const prevStepBtn = document.getElementById("prevStepBtn");

function resolveRedirect(user) {
  // Always redirect students to dashboard, only owners can list
  if (user && (user.role === "owner" || user.intent === "owner")) {
    return "/dashboard";
  }
  return "/dashboard";
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

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  // Collect all form data from both steps
  const formData = new FormData(signupForm);
  // Amenities: collect all checked
  const amenities = [];
  signupForm.querySelectorAll('input[name="amenities"]:checked').forEach(cb => amenities.push(cb.value));
  const payload = Object.fromEntries(formData.entries());
  payload.amenities = amenities;
  payload.preferredRoomType = payload.intent === "owner" ? null : payload.preferredRoomType || "room-only";
  payload.university = payload.intent === "owner" ? null : payload.university || "Not Specified";

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
