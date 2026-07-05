document.addEventListener("DOMContentLoaded", () => {
  const checkAuth = setInterval(() => {
    if (window.AnimePlusAuth && window.AnimePlusAuth.isAuthLoaded) {
      clearInterval(checkAuth);
      if (!window.AnimePlusAuth.currentUser) {
        window.location.href = "home.html"; // Redirect non-logged users
      } else {
        loadUserProfile();
      }
    }
  }, 100);

  async function loadUserProfile() {
    try {
      const res = await fetch("/api/user/profile");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      document.getElementById("profileUsername").textContent = data.username;
      document.getElementById("profileAvatar").src = data.avatar;
      document.getElementById("profileCover").style.backgroundImage = `url('${data.coverImage}')`;
      
      const joinedDate = new Date(data.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });
      document.getElementById("profileJoined").textContent = joinedDate;

      // Handle placeholders visually better if absent
      document.getElementById("profileLocation").textContent = data.location || "Not specified";
      document.getElementById("profileBirthday").textContent = data.birthDate || "Not specified";
      
      const bioEl = document.getElementById("profileBio");
      if (data.bio) {
        bioEl.textContent = data.bio;
        bioEl.style.fontStyle = "normal";
      } else {
        bioEl.textContent = "No bio added yet.";
        bioEl.style.fontStyle = "italic";
        bioEl.style.color = "rgba(255,255,255,0.4)";
      }
    } catch (err) {
      console.error(err);
      window.AnimePlusAuth.showToast("Failed to load profile", "error");
    }
  }

  const editBtn = document.getElementById("editProfileBtn");
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      window.location.href = "edit-profile.html";
    });
  }

  const logoutBtn = document.getElementById("logoutProfileBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        localStorage.setItem("isLoggedIn", "false");
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "home.html";
      } catch (err) {
        window.AnimePlusAuth.showToast("Failed to logout", "error");
      }
    });
  }
});
