document.addEventListener("DOMContentLoaded", () => {
  const checkAuth = setInterval(() => {
    if (window.AnimePlusAuth && window.AnimePlusAuth.isAuthLoaded) {
      clearInterval(checkAuth);
      if (!window.AnimePlusAuth.currentUser) {
        window.location.href = "home.html"; // Kick out guests
      } else {
        loadCurrentData();
      }
    }
  }, 100);

  const avatarInput = document.getElementById("avatarInput");
  const coverInput = document.getElementById("coverInput");

  // Custom File Click Logic
  document.getElementById("avatarPreviewBox").addEventListener("click", () => avatarInput.click());
  document.getElementById("coverPreviewBox").addEventListener("click", () => coverInput.click());

  avatarInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      document.getElementById("avatarPreview").src = URL.createObjectURL(e.target.files[0]);
    }
  });

  coverInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      document.getElementById("coverPreviewBox").style.backgroundImage = `url('${URL.createObjectURL(e.target.files[0])}')`;
    }
  });

  async function loadCurrentData() {
    try {
      const res = await fetch("/api/user/profile");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      document.getElementById("avatarPreview").src = data.avatar;
      document.getElementById("coverPreviewBox").style.backgroundImage = `url('${data.coverImage}')`;
      document.getElementById("locationInput").value = data.location || "";
      document.getElementById("birthdayInput").value = data.birthDate || "";
      document.getElementById("bioInput").value = data.bio || "";
    } catch (err) {
      window.AnimePlusAuth.showToast("Failed to load profile details", "error");
    }
  }

  document.getElementById("editProfileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById("saveProfileBtn");
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    const formData = new FormData(e.target);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        body: formData,
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);

      window.AnimePlusAuth.showToast("Profile updated successfully!", "success");
      setTimeout(() => {
        window.location.href = "profile.html";
      }, 1000);
    } catch (err) {
      window.AnimePlusAuth.showToast(err.message || "Failed to save profile", "error");
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Save Changes';
    }
  });
});
