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

      // Fetch and render MyList Stats
      await loadMyListStats();
    } catch (err) {
      console.error(err);
      window.AnimePlusAuth.showToast("Failed to load profile", "error");
    }
  }

  async function loadMyListStats() {
    try {
      const [watchlistRes, favoritesRes] = await Promise.all([
        fetch("/api/user/watchlist"),
        fetch("/api/user/favorites")
      ]);

      const watchlist = watchlistRes.ok ? await watchlistRes.json() : [];
      const favorites = favoritesRes.ok ? await favoritesRes.json() : [];

      const stats = {
        favorites: favorites.length || 0,
        watching: 0,
        plan_to_watch: 0,
        completed: 0,
        on_hold: 0,
        dropped: 0
      };

      if (Array.isArray(watchlist)) {
        watchlist.forEach(item => {
          if (item.watchlistStatus && stats[item.watchlistStatus] !== undefined) {
            stats[item.watchlistStatus]++;
          }
        });
      }

      renderStatsChart(stats);
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  }

  function renderStatsChart(stats) {
    const canvas = document.getElementById('mylistStatsChart');
    const legendEl = document.getElementById('statsLegend');
    const totalEl = document.getElementById('statsTotal');
    if (!canvas || !legendEl) return;

    if (window.mylistChart instanceof Chart) {
      window.mylistChart.destroy();
    }

    const items = [
      { label: 'My Favorites', value: stats.favorites, color: '#5dade2' },
      { label: 'Currently Watching', value: stats.watching, color: '#27ae60' },
      { label: 'Plan to Watch', value: stats.plan_to_watch, color: '#e74c3c' },
      { label: 'Completed', value: stats.completed, color: '#8e44ad' },
      { label: 'On Hold', value: stats.on_hold, color: '#c471ed' },
      { label: 'Dropped', value: stats.dropped, color: '#e67e22' }
    ];

    const total = items.reduce((sum, i) => sum + i.value, 0);

    // Build custom legend
    legendEl.innerHTML = '';
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'legend-item';
      row.innerHTML = `
        <span class="legend-color" style="background: ${item.color};"></span>
        <span class="legend-label">${item.label}</span>
        <span class="legend-value" style="color: ${item.color};">${item.value}</span>
      `;
      legendEl.appendChild(row);
    });

    // Total line
    if (totalEl) {
      totalEl.innerHTML = `Total: <strong>${total}</strong> anime in your list`;
    }

    // Set explicit pixel size on canvas
    const container = document.getElementById('chartContainer');
    const size = container.offsetWidth || 280;
    canvas.width = size;
    canvas.height = size;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';

    window.mylistChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: items.map(i => i.label),
        datasets: [{
          data: items.map(i => i.value),
          backgroundColor: items.map(i => i.color),
          borderWidth: 0,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.85)',
            titleFont: { size: 14, family: 'Arial' },
            bodyFont: { size: 14, family: 'Arial' },
            padding: 14,
            cornerRadius: 10,
            displayColors: true
          }
        },
        animation: {
          animateRotate: true,
          animateScale: true,
          duration: 1200,
          easing: 'easeOutQuart'
        }
      }
    });
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
