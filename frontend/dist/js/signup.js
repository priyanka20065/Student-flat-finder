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
const universityLabel = document.getElementById("universityLabel");
const signupSubmitBtn = signupForm?.querySelector('button[type="submit"]');
let signupInProgress = false;

function syncUniversityRequirement() {
  const isOwner = intentInput?.value === "owner";
  if (!universityInput) {
    return;
  }

  universityInput.required = !isOwner;
  universityInput.disabled = isOwner;
  if (universityLabel) {
    universityLabel.style.display = isOwner ? "none" : "";
  }
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

function buildLoginRedirect(email = "", intent = "seeker") {
  const params = new URLSearchParams();
  if (email) {
    params.set("email", String(email).trim());
  }
  if (intent) {
    params.set("intent", String(intent).trim().toLowerCase());
  }
  params.set("next", "/personality-quiz?onboarding=1");
  return `/login?${params.toString()}`;
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
  if (signupInProgress) {
    return;
  }

  signupInProgress = true;
  if (signupSubmitBtn) {
    signupSubmitBtn.disabled = true;
    signupSubmitBtn.textContent = "SIGNING UP...";
  }

  // Collect all form data from both steps
  const formData = new FormData(signupForm);
  // Amenities: collect all checked
  const amenities = [];
  signupForm.querySelectorAll('input[name="amenities"]:checked').forEach(cb => amenities.push(cb.value));
  const payload = Object.fromEntries(formData.entries());
  if (payload.intent !== "owner" && !String(payload.university || "").trim()) {
    signupStatus.textContent = "College / University is required for student signup.";
    signupInProgress = false;
    if (signupSubmitBtn) {
      signupSubmitBtn.disabled = false;
      signupSubmitBtn.textContent = "SIGN UP";
    }
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
    const redirectUrl = resolveRedirect(user);
    signupStatus.textContent = "Signup successful. Redirecting...";
    window.location.replace(redirectUrl);
  } catch (error) {
    if (error?.status === 409) {
      try {
        const existingUser = await window.AppUtils.api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: payload.email,
            password: payload.password,
            intent: payload.intent,
          }),
        });
        window.AppUtils.setCurrentUser(existingUser);
        signupStatus.textContent = "Account already exists. Logging you in...";
        window.location.replace(resolveRedirect(existingUser));
      } catch (_loginError) {
        signupStatus.textContent = "This email is already registered. Redirecting you to Login...";
        setTimeout(() => {
          window.location.href = buildLoginRedirect(payload.email, payload.intent);
        }, 700);
      }
    } else {
      signupStatus.textContent = error.message || "Signup failed. Please try again.";
    }
  } finally {
    signupInProgress = false;
    if (signupSubmitBtn) {
      signupSubmitBtn.disabled = false;
      signupSubmitBtn.textContent = "SIGN UP";
    }
  }
});
