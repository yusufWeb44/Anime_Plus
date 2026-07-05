// js/details.js (Server-backed version)

// ========= DOM Ready =========
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const animeId = urlParams.get("id");
  const animeType = urlParams.get("type");

  const validTypes = new Set(["series", "movies", "coming", "airing"]);

  if (!animeId || !animeType || !validTypes.has(animeType)) {
    alert("Anime not found.");
    window.location.href = "home.html";
    return;
  }

  // Elements
  const addBtn = document.getElementById("addBtn");
  const favBtn = document.getElementById("favBtn");
  const ratingRange = document.getElementById("userRatingRange");
  const ratingDisplay = document.getElementById("ratingDisplay");
  const backBtn = document.getElementById("backToGallery");
  const trailerBtn = document.getElementById("trailerBtn");

  // Load basic details
  fetchAnimeDetails(animeType, animeId);

  // Load user actions from server (if logged in)
  let checks = 0;
  const interval = setInterval(() => {
    if (window.AnimePlusAuth?.isAuthLoaded || checks > 40) { // wait up to 2 seconds
      clearInterval(interval);
      loadUserActionsUI(animeType, animeId);
    }
    checks++;
  }, 50);

  // Event Listeners
  const dropdownMenu = document.getElementById("watchlistDropdown");
  if (addBtn && dropdownMenu) {
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle("show");
    });

    // Close dropdown on click outside
    document.addEventListener("click", () => {
      dropdownMenu.classList.remove("show");
    });

    // Setup dropdown status items click
    dropdownMenu.querySelectorAll("button[data-status]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const status = btn.getAttribute("data-status");
        await setWatchlistStatus(animeType, animeId, status);
      });
    });

    const removeBtn = document.getElementById("removeWatchlistBtn");
    if (removeBtn) {
      removeBtn.addEventListener("click", async () => {
        await removeWatchlist(animeType, animeId);
      });
    }
  }

  if (favBtn) {
    favBtn.addEventListener("click", () => {
      toggleRemoteAction(animeType, animeId, "favorite", favBtn);
    });
  }

  if (ratingRange) {
    ratingRange.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value).toFixed(1);
      if (ratingDisplay) ratingDisplay.textContent = val;
      updateSliderGradient(ratingRange);
    });
    ratingRange.addEventListener("change", (e) => {
      const val = parseFloat(e.target.value).toFixed(1);
      saveRemoteRating(animeType, animeId, val);
    });
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => window.history.back());
  }

  // Trailer button event
  if (trailerBtn) {
    trailerBtn.addEventListener("click", () => openTrailerModal(animeType, animeId));
  }


  // Trailer modal close event
  const trailerModal = document.getElementById("trailerModal");
  const trailerClose = document.querySelector(".trailer-close");
  if (trailerClose && trailerModal) {
    trailerClose.addEventListener("click", closeTrailerModal);
    trailerModal.addEventListener("click", (e) => {
      if (e.target === trailerModal) closeTrailerModal();
    });
  }

  // Load related and recommendations sections
  loadRelatedContent(animeId, animeType);
  loadRecommendationsContent(animeId, animeType);
});

// ========= Fetch anime details from backend =========
async function fetchAnimeDetails(type, id) {
  try {
    const response = await fetch(`/api/anime/${type}/${id}`);
    if (!response.ok) {
      alert("Error loading anime details.");
      return;
    }
    const anime = await response.json();

    // Populate Page
    const name = anime.name || anime.title || "Unknown Title";
    const rating = anime.rating || "0.0";
    const image = anime.src || anime.image || "../assets/placeholder-poster.jpg";

    let synopsis = anime.description || "No description available for this anime.";
    synopsis = synopsis.replace(/\(Source:.*?\)/gi, "").replace(/\[Written by.*?\]/gi, "").trim();
    const studio = anime.studio || "Not yet determined";
    const year = anime.year || "Unknown year";

    document.title = `${name} - AnimePlus`;

    const els = {
      detailTitle: name,
      detailRating: rating,
      detailSynopsis: synopsis,
      studioName: studio,
      releaseYear: year
    };

    for (let [id, val] of Object.entries(els)) {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    }

    const posterEl = document.getElementById("detailPoster");
    const backEl = document.getElementById("detailsBackdrop");
    if (posterEl) posterEl.src = image;
    if (backEl) backEl.style.backgroundImage = `url(${image})`;

    // Store trailer URL for later use
    if (anime.trailer) {
      window.currentTrailerUrl = anime.trailer;
    } else {
      // Disable trailer button if no trailer available
      const trailerBtn = document.getElementById("trailerBtn");
      if (trailerBtn) {
        trailerBtn.disabled = true;
        trailerBtn.style.opacity = "0.5";
        trailerBtn.style.cursor = "not-allowed";
      }
    }

    // Categories (Genres)
    const categoryContainer = document.getElementById("detailCategories");
    if (categoryContainer) {
      categoryContainer.innerHTML = "";

      const displayTags = anime.genres || anime.category || "";
      if (displayTags) {
        const cats = displayTags.split(",").map((c) => c.trim()).filter(Boolean);
        cats.forEach((cat) => {
          // Don\'t show \'series\' or \'movies\' as a tag if we have other genres
          if (cats.length > 1 && (cat.toLowerCase() === "series" || cat.toLowerCase() === "movies")) return;

          const span = document.createElement("span");
          span.className = "category-tag";
          span.innerText = cat;
          categoryContainer.appendChild(span);
        });
      }
    }
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

// ========= Server Actions =========
async function loadUserActionsUI(type, id) {
  // If we\'re not logged in, we reset the UI
  if (!window.AnimePlusAuth || !window.AnimePlusAuth.isLoggedIn()) {
    applyUIState({ isFavorite: false, isWatchlist: false, rating: null }, type, id);
    return;
  }

  try {
    const res = await fetch(`/api/user/actions/${type}/${id}`);
    if (res.ok) {
      const data = await res.json();
      applyUIState(data.action, type, id);
    }
  } catch (err) {
    console.error("Failed to load user actions", err);
  }
}

function applyUIState(action, type, id) {
  const addBtn = document.getElementById("addBtn");
  const favBtn = document.getElementById("favBtn");
  const dropdownMenu = document.getElementById("watchlistDropdown");

  if (addBtn) {
    // Reset active item inside dropdown
    if (dropdownMenu) {
      dropdownMenu.querySelectorAll("button[data-status]").forEach(btn => {
        btn.classList.remove("active-item");
      });
    }

    if (action.isWatchlist && action.watchlistStatus) {
      addBtn.classList.add("active");
      addBtn.dataset.active = "true";

      // Update dropdown item to active
      if (dropdownMenu) {
        const activeBtn = dropdownMenu.querySelector(`button[data-status="${action.watchlistStatus}"]`);
        if (activeBtn) activeBtn.classList.add("active-item");
      }

      // Map status to English title and icon
      const statusMaps = {
        watching: { text: "Watching", icon: "fa-circle-play" },
        plan_to_watch: { text: "Plan to Watch", icon: "fa-calendar-days" },
        completed: { text: "Completed", icon: "fa-circle-check" },
        on_hold: { text: "On Hold", icon: "fa-pause" },
        dropped: { text: "Dropped", icon: "fa-circle-xmark" }
      };

      const match = statusMaps[action.watchlistStatus] || { text: "In My List", icon: "fa-check" };
      addBtn.innerHTML = `<i class="fa-solid ${match.icon}"></i> ${match.text}`;
    } else {
      addBtn.classList.remove("active");
      addBtn.innerHTML = `<i class="fa-solid fa-plus"></i> My List`;
      addBtn.dataset.active = "false";
    }
  }

  if (favBtn) {
    if (action.isFavorite) {
      favBtn.classList.add("active");
      favBtn.innerHTML = `<i class="fa-solid fa-heart"></i> Favorite`;
      favBtn.dataset.active = "true";
    } else {
      favBtn.classList.remove("active");
      favBtn.innerHTML = `<i class="fa-regular fa-heart"></i> Add Favorite`;
      favBtn.dataset.active = "false";
    }
  }

  // Rating slider
  const ratingRange = document.getElementById("userRatingRange");
  const ratingDisplay = document.getElementById("ratingDisplay");
  if (action.rating !== null && action.rating !== undefined) {
    if (ratingRange) {
      ratingRange.value = action.rating;
      updateSliderGradient(ratingRange);
    }
    if (ratingDisplay) ratingDisplay.textContent = parseFloat(action.rating).toFixed(1);
    updateUserRatingBadge(action.rating);
  } else {
    if (ratingRange) {
      ratingRange.value = 0;
      updateSliderGradient(ratingRange);
    }
    if (ratingDisplay) ratingDisplay.textContent = "0.0";
    updateUserRatingBadge(null);
  }
}

async function toggleRemoteAction(type, id, actionType, btnElement) {
  if (!window.AnimePlusAuth || !window.AnimePlusAuth.isLoggedIn()) {
    window.AnimePlusAuth.openLoginModal();
    return;
  }

  const isCurrentlyActive = btnElement.dataset.active === "true";
  const endpointBase = actionType === "watchlist" ? "/api/user/watchlist" : "/api/user/favorites";
  const url = isCurrentlyActive ? `${endpointBase}/remove` : `${endpointBase}/add`;
  const method = isCurrentlyActive ? "DELETE" : "POST";

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ animeId: id, animeType: type })
    });

    if (res.ok) {
      // Reload UI state from server
      await loadUserActionsUI(type, id);
      window.AnimePlusAuth.showToast(`Successfully updated ${actionType}`, "success");
    } else {
      const data = await res.json();
      window.AnimePlusAuth.showToast(data.error || "Action failed", "error");
    }
  } catch (err) {
    window.AnimePlusAuth.showToast("Network error", "error");
  }
}

async function saveRemoteRating(type, id, rating) {
  if (!window.AnimePlusAuth || !window.AnimePlusAuth.isLoggedIn()) {
    window.AnimePlusAuth.openLoginModal();
    // Reset visual state
    loadUserActionsUI(type, id);
    return;
  }

  try {
    const res = await fetch("/api/user/rating", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ animeId: id, animeType: type, rating })
    });

    if (res.ok) {
      updateUserRatingBadge(rating);
      window.AnimePlusAuth.showToast("Rating saved successfully", "success");
    } else {
      window.AnimePlusAuth.showToast("Failed to save rating", "error");
      loadUserActionsUI(type, id); // revert
    }
  } catch (err) {
    window.AnimePlusAuth.showToast("Network error", "error");
  }
}

function updateUserRatingBadge(rating) {
  const badge = document.getElementById("userRatingBadge");
  const valueEl = document.getElementById("userRatingValue");
  if (!badge || !valueEl) return;

  if (rating !== null) {
    valueEl.textContent = parseFloat(rating).toFixed(1);
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }
}

function updateSliderGradient(slider) {
  const min = parseFloat(slider.min);
  const max = parseFloat(slider.max);
  const val = parseFloat(slider.value);
  const percent = ((val - min) / (max - min)) * 100;
  slider.style.background = `linear-gradient(to right, #ac4a92 ${percent}%, #333 ${percent}%)`;
}

async function setWatchlistStatus(type, id, status) {
  if (!window.AnimePlusAuth || !window.AnimePlusAuth.isLoggedIn()) {
    window.AnimePlusAuth.openLoginModal();
    return;
  }

  try {
    const res = await fetch("/api/user/watchlist/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ animeId: id, animeType: type, status })
    });

    if (res.ok) {
      await loadUserActionsUI(type, id);
      window.AnimePlusAuth.showToast("Successfully added to list", "success");
    } else {
      const data = await res.json();
      window.AnimePlusAuth.showToast(data.error || "Action failed", "error");
    }
  } catch (err) {
    window.AnimePlusAuth.showToast("Network connection error", "error");
  }
}

async function removeWatchlist(type, id) {
  if (!window.AnimePlusAuth || !window.AnimePlusAuth.isLoggedIn()) {
    window.AnimePlusAuth.openLoginModal();
    return;
  }

  try {
    const res = await fetch("/api/user/watchlist/remove", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ animeId: id, animeType: type })
    });

    if (res.ok) {
      await loadUserActionsUI(type, id);
      window.AnimePlusAuth.showToast("Successfully removed from list", "success");
    } else {
      const data = await res.json();
      window.AnimePlusAuth.showToast(data.error || "Action failed", "error");
    }
  } catch (err) {
    window.AnimePlusAuth.showToast("Network connection error", "error");
  }
}

// ========= Trailer Modal Functions =========
let ytPlayer = null;
let ytApiReady = false;

// Load YouTube IFrame API
(function loadYoutubeApi() {
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName('script')[0];
  if (firstScriptTag) {
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  } else {
    document.head.appendChild(tag);
  }
})();

window.onYouTubeIframeAPIReady = function () {
  ytApiReady = true;
};

function extractYouTubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

function openTrailerModal(type, id) {
  const modal = document.getElementById("trailerModal");
  const container = document.getElementById("trailerContainer");
  const fallback = document.getElementById("trailerFallback");
  const watchBtn = document.getElementById("watchOnYoutubeBtn");

  if (!window.currentTrailerUrl) {
    alert("No trailer available for this anime.");
    return;
  }

  const videoId = extractYouTubeId(window.currentTrailerUrl);

  const showFallback = (url) => {
    if (container) container.style.display = "none";
    if (fallback) fallback.style.display = "flex";
    if (watchBtn) watchBtn.href = url || window.currentTrailerUrl;
  };

  if (!videoId) {
    // Not a valid YouTube URL
    showFallback(window.currentTrailerUrl);
  } else {
    if (container) container.style.display = "block";
    if (fallback) fallback.style.display = "none";

    if (ytApiReady) {
      if (ytPlayer) {
        ytPlayer.loadVideoById(videoId);
      } else {
        ytPlayer = new YT.Player('trailerFrame', {
          videoId: videoId,
          playerVars: { 'autoplay': 1, 'rel': 0 },
          events: {
            'onError': function (event) {
              console.warn("YouTube Player Error:", event.data);
              showFallback(`https://www.youtube.com/watch?v=${videoId}`);
            }
          }
        });
      }
    } else {
      // Fallback if API hasn't loaded: inject iframe directly
      const frameContainer = document.getElementById("trailerFrame");
      if (frameContainer) {
        if (frameContainer.tagName === "DIV") {
          frameContainer.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}?autoplay=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
        } else if (frameContainer.tagName === "IFRAME") {
          frameContainer.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        }
      }
    }
  }

  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeTrailerModal() {
  const modal = document.getElementById("trailerModal");

  if (ytPlayer && typeof ytPlayer.stopVideo === 'function') {
    ytPlayer.stopVideo();
  } else {
    // If we used the innerHTML fallback
    const frameContainer = document.getElementById("trailerFrame");
    if (frameContainer && frameContainer.tagName === "DIV") {
      frameContainer.innerHTML = "";
    } else if (frameContainer && frameContainer.tagName === "IFRAME") {
      frameContainer.src = "";
    }
  }

  modal.style.display = "none";
  document.body.style.overflow = "auto";
}

// ========= Section Galleries & Pagination =========
const galleryStates = {
  related: { data: [], currentCount: 0 },
  recommendations: { data: [], currentCount: 0 }
};

function renderLocalCards(newDataList, containerId, btnId, stateKey, isAppend) {
  const container = document.getElementById(containerId);
  const btn = document.getElementById(btnId);
  if (!container || !btn) return;

  const html = newDataList.map(anime => {
    const type = anime.type || "series";
    const img = anime.src || anime.image || "../assets/placeholder-poster.jpg";
    const title = anime.name || anime.title || "Unknown";
    const rating = anime.rating || "N/A";
    const displayTags = anime.genres || anime.category || "";
    const categories = displayTags ? displayTags.split(",").map((c) => c.trim()) : [];

    let tagsHtml = '<div class="category-tags">';
    categories.forEach((cat) => {
      if (categories.length > 1 && (cat.toLowerCase() === "series" || cat.toLowerCase() === "movies")) return;
      tagsHtml += `<span class="category-tag">${cat}</span>`;
    });
    tagsHtml += "</div>";

    const detailsUrl = `details.html?id=${anime.id}&type=${type}`;

    return `
      <div class="anime-card" onclick="window.location.href='${detailsUrl}'" style="cursor: pointer;">
          <img src="${img}" alt="${title}">
          <div class="anime-info">
              <h3>${title}</h3>
              <p>Rating: <i class="fa-solid fa-star" style="color: gold;"></i> ${rating}/10</p>
              ${tagsHtml}
          </div>
      </div>
    `;
  }).join("");

  if (isAppend) {
    container.insertAdjacentHTML('beforeend', html);
  } else {
    container.innerHTML = html;
  }

  if (galleryStates[stateKey].currentCount >= galleryStates[stateKey].data.length) {
    btn.style.display = "none";
  } else {
    btn.style.display = "inline-block";
  }
}

function setupGalleryShowMore(data, containerId, btnId, stateKey) {
  const btn = document.getElementById(btnId);
  if (!btn) return;

  galleryStates[stateKey].data = data;
  const isMobile = window.innerWidth <= 768;
  galleryStates[stateKey].currentCount = isMobile ? data.length : 4;

  const initialData = galleryStates[stateKey].data.slice(0, galleryStates[stateKey].currentCount);
  renderLocalCards(initialData, containerId, btnId, stateKey, false);

  btn.onclick = () => {
    const prevCount = galleryStates[stateKey].currentCount;
    galleryStates[stateKey].currentCount += 4;
    const newData = galleryStates[stateKey].data.slice(prevCount, galleryStates[stateKey].currentCount);
    renderLocalCards(newData, containerId, btnId, stateKey, true);
  };
}

// ========= Related Content Functions =========
async function loadRelatedContent(animeId, animeType) {
  const section = document.getElementById("relatedSection");
  if (!section) return;

  try {
    const response = await fetch(`/api/anime/${animeType}/${animeId}/related`);
    if (!response.ok) {
      section.style.display = "none";
      return;
    }
    const relatedAnime = await response.json();
    if (relatedAnime && relatedAnime.length > 0) {
      section.style.display = "block";
      setupGalleryShowMore(relatedAnime, "relatedContent", "relatedShowMore", "related");
    } else {
      section.style.display = "none";
    }
  } catch (err) {
    console.error("Error fetching related content:", err);
    section.style.display = "none";
  }
}

// ========= Recommendations Functions =========
async function loadRecommendationsContent(animeId, animeType) {
  const section = document.getElementById("recommendationsSection");
  if (!section) return;

  try {
    const response = await fetch(`/api/anime/${animeType}/${animeId}/recommendations`);
    if (!response.ok) {
      section.style.display = "none";
      return;
    }
    const recommendedAnime = await response.json();
    if (recommendedAnime && recommendedAnime.length > 0) {
      section.style.display = "block";
      setupGalleryShowMore(recommendedAnime, "recommendationsContent", "recommendationsShowMore", "recommendations");
    } else {
      section.style.display = "none";
    }
  } catch (err) {
    console.error("Error fetching recommendations:", err);
    section.style.display = "none";
  }
}
