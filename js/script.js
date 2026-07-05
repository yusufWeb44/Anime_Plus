// js/script.js

// =====================
// Helpers
// =====================
function isHomePage() {
  // ✅ أنت عامل body class="home" بالـ home.html
  return document.body.classList.contains("home");
}

// =====================
// Helper: build correct details URL
// =====================
function getDetailsUrl(id, type) {
  const validTypes = new Set(["series", "movies", "coming", "airing"]);
  if (!id || !validTypes.has(type)) {
    console.warn("Invalid details params:", { id, type });
    return null;
  }

  const inViews = window.location.pathname.includes("/views/");
  const base = inViews ? "details.html" : "/views/details.html";
  return `${base}?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}`;
}

// =====================
// Global Spotlight State
// =====================
let spotlightData = [];
let spotlightIndex = 0;
let spotlightInterval;
let isTransitioning = false;

function showSpotlight(i) {
  if (!spotlightData.length || isTransitioning) return;

  const anime = spotlightData[i];
  const bg = document.querySelector(".spotlight-bg");
  const title = document.querySelector(".spotlight-title");
  const desc = document.querySelector(".spotlight-desc");
  const poster = document.querySelector(".spotlight-poster");
  const rating = document.getElementById("spotlightRating");
  const categoriesWrap = document.getElementById("spotlightCategories");
  const btn = document.getElementById("spotlightBtn");
  const info = document.querySelector(".spotlight-info");
  const posterWrap = document.querySelector(".spotlight-poster-wrap");
  const dots = document.querySelectorAll(".spotlight-dot");

  if (!bg || !title || !poster) return;

  const img = anime.src || anime.image || "../assets/placeholder-poster.jpg";
  const name = anime.name || anime.title || "Unknown";
  const description = anime.description || "No description available.";
  const ratingVal = anime.rating || "N/A";

  // Use genres if available
  const displayTags = anime.genres || anime.category || "Anime";
  const categories = displayTags.split(",").map(c => c.trim()).filter(Boolean);

  // Transition out
  isTransitioning = true;
  info.classList.add("transitioning");
  posterWrap.classList.add("transitioning");

  setTimeout(() => {
    // Update content
    bg.style.backgroundImage = `url(${img})`;
    title.textContent = name;
    desc.textContent = description;
    poster.src = img;
    poster.alt = name;
    rating.textContent = `${ratingVal}/10`;

    categoriesWrap.innerHTML = categories
      .filter(cat => categories.length === 1 || (cat.toLowerCase() !== "series" && cat.toLowerCase() !== "movies"))
      .map(c => `<span class="spotlight-category">${c}</span>`)
      .join("");

    // Update dots
    dots.forEach((d, idx) => {
      d.classList.toggle("active", idx === i);
    });

    // Update button click
    btn.onclick = () => {
      const detailsUrl = getDetailsUrl(anime.id, anime.type);
      if (detailsUrl) window.location.href = detailsUrl;
    };

    // Transition in
    info.classList.remove("transitioning");
    posterWrap.classList.remove("transitioning");

    // Re-trigger entrance animations
    info.style.animation = "none";
    posterWrap.style.animation = "none";
    void info.offsetHeight; // force reflow
    info.style.animation = "spotlightFadeIn 0.8s ease forwards";
    posterWrap.style.animation = "spotlightPosterIn 0.8s 0.15s ease forwards";

    isTransitioning = false;
  }, 400); // match CSS transition duration
}

function nextSpotlight() {
  if (!spotlightData.length) return;
  spotlightIndex = (spotlightIndex + 1) % spotlightData.length;
  showSpotlight(spotlightIndex);
}

function startSpotlightAuto() {
  stopSpotlightAuto();
  if (spotlightData.length > 1) {
    spotlightInterval = setInterval(nextSpotlight, 8000);
  }
}

function stopSpotlightAuto() {
  if (spotlightInterval) clearInterval(spotlightInterval);
}

async function loadHomeFeaturedSlider() {
  if (!document.body.classList.contains("home")) return;

  const dotsWrap = document.getElementById("spotlightDots");
  if (!dotsWrap) return;

  try {
    const res = await fetch("/api/home-featured");
    if (!res.ok) throw new Error("Failed to load featured");

    const featured = await res.json();
    if (!Array.isArray(featured) || featured.length === 0) return;

    spotlightData = featured;
    dotsWrap.innerHTML = "";

    // Create dots
    featured.forEach((_, i) => {
      const dot = document.createElement("span");
      dot.className = "spotlight-dot" + (i === 0 ? " active" : "");
      dot.addEventListener("click", (e) => {
        e.stopPropagation();
        spotlightIndex = i;
        showSpotlight(spotlightIndex);
        startSpotlightAuto();
      });
      dotsWrap.appendChild(dot);
    });

    // Show first spotlight immediately
    spotlightIndex = 0;

    // Set initial content without animation
    const anime = spotlightData[0];
    const img = anime.src || anime.image || "../assets/placeholder-poster.jpg";
    const bg = document.querySelector(".spotlight-bg");
    if (bg) bg.style.backgroundImage = `url(${img})`;

    const title = document.querySelector(".spotlight-title");
    if (title) title.textContent = anime.name || anime.title || "Unknown";

    const desc = document.querySelector(".spotlight-desc");
    if (desc) desc.textContent = anime.description || "No description available.";

    const poster = document.querySelector(".spotlight-poster");
    if (poster) {
      poster.src = img;
      poster.alt = anime.name || anime.title || "Unknown";
    }

    const rating = document.getElementById("spotlightRating");
    if (rating) rating.textContent = `${anime.rating || "N/A"}/10`;

    const categoriesWrap = document.getElementById("spotlightCategories");
    if (categoriesWrap) {
      const displayTags = anime.genres || anime.category || "Anime";
      const cats = displayTags.split(",").map(c => c.trim()).filter(Boolean);

      categoriesWrap.innerHTML = cats
        .filter(cat => cats.length === 1 || (cat.toLowerCase() !== "series" && cat.toLowerCase() !== "movies"))
        .map(c => `<span class="spotlight-category">${c}</span>`)
        .join("");
    }

    const btn = document.getElementById("spotlightBtn");
    if (btn) {
      btn.onclick = () => {
        const detailsUrl = getDetailsUrl(anime.id, anime.type);
        if (detailsUrl) window.location.href = detailsUrl;
      };
    }

    startSpotlightAuto();

  } catch (err) {
    console.error("Spotlight error:", err);
  }
}

// =====================
// Search Logic
// =====================
function initSearch() {
  const searchBox = document.getElementById("search");
  if (!searchBox) return;

  if (document.body.classList.contains("home")) {
    searchBox.disabled = true;
    searchBox.value = "";
    searchBox.style.opacity = "0.5";
    searchBox.style.cursor = "not-allowed";
  } else {
    searchBox.disabled = false;
    searchBox.style.opacity = "1";
    searchBox.style.cursor = "text";
  }

  searchBox.addEventListener("input", () => {
    const value = searchBox.value.toLowerCase();
    document.querySelectorAll(".anime-card").forEach((card) => {
      const h3 = card.querySelector("h3");
      const name = (h3 ? h3.textContent : "").toLowerCase();
      card.style.display = name.includes(value) ? "block" : "none";
    });
  });
}

// =====================
// Modal & Menu Logic
// =====================
function initMenuAndModal() {
  const loginBtn = document.querySelector("#login-and-search button");
  const modal = document.getElementById("loginModal");
  const closeBtn = document.querySelectorAll(".close");
  const signupform = document.getElementById("signupform");
  const loginform = document.getElementById("loginform");
  const noAccount = document.getElementById("gotosignup");
  const itm = document.getElementById("items");
  const menuIcon = document.getElementById("menuIcon");
  const menuContent = document.getElementById("menuContent");

  if (loginBtn && modal) {
    loginBtn.addEventListener("click", () => {
      modal.style.display = "flex";
      if (loginform) loginform.style.display = "block";
      if (signupform) signupform.style.display = "none";
      if (itm) itm.style.display = "block";
    });
  }

  closeBtn.forEach((btn) =>
    btn.addEventListener("click", () => {
      if (modal) modal.style.display = "none";
    })
  );

  window.addEventListener("click", (e) => {
    if (e.target == modal) modal.style.display = "none";
  });

  if (noAccount) {
    noAccount.addEventListener("click", (e) => {
      e.preventDefault();
      if (loginform) loginform.style.display = "none";
      if (signupform) signupform.style.display = "block";
      if (itm) itm.style.display = "none";
    });
  }

  const gotologinFromSignup = document.getElementById("gotologinFromSignup");
  if (gotologinFromSignup) {
    gotologinFromSignup.addEventListener("click", (e) => {
      e.preventDefault();
      if (loginform) loginform.style.display = "block";
      if (signupform) signupform.style.display = "none";
      if (itm) itm.style.display = "block";
    });
  }

  if (menuIcon && menuContent) {
    // === Mobile Responsive: Overlay, Cloned Nav, Close Button ===

    // Create overlay (CSS hides it on desktop via min-width:1025px)
    let overlay = document.getElementById("mobileMenuOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "mobileMenuOverlay";
      overlay.className = "mobile-menu-overlay";
      if (menuContent.parentNode) {
        menuContent.parentNode.insertBefore(overlay, menuContent);
      } else {
        document.body.appendChild(overlay);
      }
    }

    // Clone #homler nav links into sidebar (between #profile and #lists)
    const homler = document.getElementById("homler");
    if (homler && !document.getElementById("mobileHomler")) {
      const mobileHomler = document.createElement("div");
      mobileHomler.id = "mobileHomler";
      mobileHomler.className = "mobile-homler";
      mobileHomler.innerHTML = homler.innerHTML;

      // Strip ALL ids from cloned elements to prevent duplicate-ID bugs
      mobileHomler.querySelectorAll("[id]").forEach(el => el.removeAttribute("id"));

      // Insert between #profile and #lists
      const listsSection = document.getElementById("lists");
      if (listsSection) {
        menuContent.insertBefore(mobileHomler, listsSection);
      } else {
        menuContent.appendChild(mobileHomler);
      }
    }

    // Create close button
    let closeBtn = document.getElementById("mobileMenuClose");
    if (!closeBtn) {
      closeBtn = document.createElement("div");
      closeBtn.id = "mobileMenuClose";
      closeBtn.className = "mobile-menu-close";
      closeBtn.innerHTML = '&times;';
      menuContent.insertBefore(closeBtn, menuContent.firstChild);
    }

    // Close: remove classes, restore scroll
    const closeMenu = () => {
      menuContent.classList.remove("menu-open");
      overlay.classList.remove("active");
      document.body.style.overflow = "";
    };

    // Open: only works on mobile/tablet (<=1024px)
    const openMenu = () => {
      if (window.innerWidth > 1024) return; // safety: never open on desktop
      menuContent.classList.add("menu-open");
      overlay.classList.add("active");
      document.body.style.overflow = "hidden";
    };

    menuIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.innerWidth <= 1024) {
        openMenu();
      } else {
        // Desktop: toggle the original sidebar behavior
        menuContent.classList.toggle("menu-open");
      }
    });

    closeBtn.addEventListener("click", closeMenu);
    overlay.addEventListener("click", closeMenu);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menuContent.classList.contains("menu-open")) {
        closeMenu();
      }
    });

    // Click outside to close
    document.addEventListener("click", (e) => {
      if (!menuContent.contains(e.target) && !menuIcon.contains(e.target) && !overlay.contains(e.target)) {
        closeMenu();
      }
    });

    // Force close sidebar when resizing back to desktop
    window.addEventListener("resize", () => {
      if (window.innerWidth > 1024) {
        closeMenu();
      }
    });
  }

  const listButtons = document.querySelectorAll("#list1 button");
  const inViews = window.location.pathname.includes("/views/");
  const base = inViews ? "" : "/views/";

  listButtons.forEach(btn => {
    const text = btn.textContent.trim().toLowerCase();
    btn.addEventListener("click", () => {
      if (text.includes("my list")) window.location.href = `${base}mylist.html`;
      else if (text.includes("favorite")) window.location.href = `${base}favorites.html`;
      else if (text.includes("recommendations")) window.location.href = `${base}recommendations.html`;
      else if (text.includes("mood")) window.location.href = `${base}mood.html`;
      else if (text.includes("news")) window.location.href = `${base}news.html`;
    });
  });
}

// =====================
// Gallery Rendering & Filters
// =====================
let currentGalleryData = [];
let currentFilteredData = [];
let activeSortType = "";
let sortDirection = -1; // -1 for highest first, 1 for lowest first
let activeGenre = "";

async function initGalleries() {
  const seriesGallery = document.getElementById("seriesGallery");
  const movieGallery = document.getElementById("moviesGallery");
  const comingGallery = document.getElementById("comingGallery");
  const airingGallery = document.getElementById("airingGallery");

  let fetchUrl = null;
  let containerId = null;
  let type = null;

  if (seriesGallery) { fetchUrl = "/api/series"; containerId = "seriesGallery"; type = "series"; }
  else if (movieGallery) { fetchUrl = "/api/movies"; containerId = "moviesGallery"; type = "movies"; }
  else if (comingGallery) { fetchUrl = "/api/coming"; containerId = "comingGallery"; type = "coming"; }
  else if (airingGallery) { fetchUrl = "/api/airing"; containerId = "airingGallery"; type = "airing"; }

  if (fetchUrl) {
    try {
      const res = await fetch(fetchUrl);
      const data = await res.json();
      currentGalleryData = data;
      currentFilteredData = [...data];
      if (window.innerWidth <= 768) {
        renderMobileRows(currentFilteredData, containerId, type);
      } else {
        createCard(currentFilteredData, containerId, type);
      }
      setupFilters(containerId, type);
    } catch (err) {
      console.error("Failed to load gallery data:", err);
    }
  }
}

// Splits data into 3 non-overlapping horizontal-scroll rows for mobile
function renderMobileRows(data, containerId, type) {
  const wrapper = document.getElementById(containerId);
  if (!wrapper) return;

  // Clear old content (including any previous mobile rows)
  wrapper.innerHTML = "";
  // Also clear any sibling mobile rows that were previously injected
  const parent = wrapper.parentElement;
  parent.querySelectorAll(".mobile-row-section").forEach(el => el.remove());

  const totalItems = data.length;
  if (totalItems === 0) return;

  const rowLabels = ["Top Picks", "More to Explore", "Discover More"];
  // Divide evenly across 3 rows; if fewer items, use as many rows as needed
  const chunkSize = Math.ceil(totalItems / 3);
  const rows = [];
  for (let i = 0; i < 3; i++) {
    const chunk = data.slice(i * chunkSize, (i + 1) * chunkSize);
    if (chunk.length > 0) rows.push({ label: rowLabels[i], items: chunk });
  }

  // Hide the main gallery div (we inject rows into parent instead)
  wrapper.style.display = "none";

  rows.forEach(({ label, items }) => {
    const section = document.createElement("div");
    section.className = "mobile-row-section";

    const heading = document.createElement("h3");
    heading.className = "mobile-row-title";
    heading.textContent = label;

    const row = document.createElement("div");
    row.className = "mobile-row-gallery";

    items.forEach(anime => {
      const card = document.createElement("div");
      card.className = "anime-card";
      const img = anime.src || anime.image || "../assets/placeholder-poster.jpg";
      const title = anime.name || anime.title || "Unknown";
      const rating = anime.rating || "N/A";
      const displayTags = anime.genres || anime.category || "";
      const categories = displayTags ? displayTags.split(",").map(c => c.trim()) : [];
      let tagsHtml = '<div class="category-tags">';
      categories.forEach(cat => {
        if (categories.length > 1 && (cat.toLowerCase() === "series" || cat.toLowerCase() === "movies")) return;
        tagsHtml += `<span class="category-tag">${cat}</span>`;
      });
      tagsHtml += "</div>";
      card.innerHTML = `
        <img src="${img}" alt="${title}">
        <div class="anime-info">
          <h3>${title}</h3>
          <p>Rating: <i class="fa-solid fa-star" style="color: gold;"></i> ${rating}/10</p>
          ${tagsHtml}
        </div>
      `;
      card.addEventListener("click", () => {
        const url = getDetailsUrl(anime.id, type);
        if (url) window.location.href = url;
      });
      row.appendChild(card);
    });

    section.appendChild(heading);
    section.appendChild(row);
    parent.appendChild(section);
  });
}


function setupFilters(containerId, type) {
  // Dropdown Toggles
  const dropdowns = document.querySelectorAll('.custom-dropdown');

  dropdowns.forEach(dropdown => {
    const toggle = dropdown.querySelector('.dropdown-toggle');
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close others
        dropdowns.forEach(d => { if (d !== dropdown) d.classList.remove('active'); });
        dropdown.classList.toggle('active');
      });
    }
  });

  document.addEventListener('click', () => {
    dropdowns.forEach(d => d.classList.remove('active'));
  });

  // Sort Selection
  const sortItems = document.querySelectorAll('#sortDropdown .dropdown-menu li');
  sortItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const sortType = item.getAttribute('data-sort');
      if (activeSortType === sortType) {
        sortDirection *= -1; // toggle direction
      } else {
        activeSortType = sortType;
        sortDirection = -1; // default to highest/newest
      }

      // Update UI
      sortItems.forEach(li => {
        li.classList.remove('selected');
        const icon = li.querySelector('.sort-dir');
        if (icon) icon.className = 'fa-solid sort-dir'; // reset
      });
      item.classList.add('selected');
      const dirIcon = item.querySelector('.sort-dir');
      if (dirIcon) {
        dirIcon.className = sortDirection === -1
          ? 'fa-solid fa-arrow-down sort-dir'
          : 'fa-solid fa-arrow-up sort-dir';
      }

      applyFilters(containerId, type);
    });
  });

  // Genre Selection
  const genreItems = document.querySelectorAll('#genreDropdown .dropdown-menu li');
  genreItems.forEach(item => {
    item.addEventListener('click', (e) => {
      activeGenre = item.getAttribute('data-genre');

      // Update UI
      genreItems.forEach(li => li.classList.remove('selected'));
      item.classList.add('selected');

      applyFilters(containerId, type);
    });
  });
}

function applyFilters(containerId, type) {
  // 1. Filter by Genre
  if (activeGenre) {
    currentFilteredData = currentGalleryData.filter(anime => {
      const displayTags = anime.genres || anime.category || "";
      const categories = displayTags.split(",").map(c => c.trim().toLowerCase());
      return categories.includes(activeGenre.toLowerCase());
    });
  } else {
    currentFilteredData = [...currentGalleryData];
  }

  // 2. Sort Data
  if (activeSortType) {
    currentFilteredData.sort((a, b) => {
      let valA, valB;

      if (activeSortType === "rating") {
        valA = parseFloat(a.rating) || 0;
        valB = parseFloat(b.rating) || 0;
        return (valA - valB) * sortDirection;
      }
      else if (activeSortType === "date") {
        valA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
        valB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
        return (valA - valB) * sortDirection;
      }
      else if (activeSortType === "alpha") {
        valA = (a.name || a.title || "").toLowerCase();
        valB = (b.name || b.title || "").toLowerCase();
        if (valA < valB) return -1 * sortDirection;
        if (valA > valB) return 1 * sortDirection;
        return 0;
      }
      return 0;
    });
  }

  // 3. Render
  if (window.innerWidth <= 768) {
    renderMobileRows(currentFilteredData, containerId, type);
  } else {
    createCard(currentFilteredData, containerId, type);
  }
}

function createCard(data, containerId, type, append = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!append) container.innerHTML = "";

  data.forEach((anime) => {
    const card = document.createElement("div");
    card.className = "anime-card";
    const img = anime.src || anime.image || "../assets/placeholder-poster.jpg";
    const title = anime.name || anime.title || "Unknown";
    const rating = anime.rating || "N/A";

    // Use genres if available, otherwise fallback to category
    const displayTags = anime.genres || anime.category || "";
    const categories = displayTags ? displayTags.split(",").map((c) => c.trim()) : [];

    let tagsHtml = '<div class="category-tags">';
    categories.forEach((cat) => {
      // Don't show 'series' or 'movies' as a tag if we have other genres
      if (categories.length > 1 && (cat.toLowerCase() === "series" || cat.toLowerCase() === "movies")) return;
      tagsHtml += `<span class="category-tag">${cat}</span>`;
    });
    tagsHtml += "</div>";

    card.innerHTML = `
        <img src="${img}" alt="${title}">
        <div class="anime-info">
            <h3>${title}</h3>
            <p>Rating: <i class="fa-solid fa-star" style="color: gold;"></i> ${rating}/10</p>
            ${tagsHtml}
        </div>
    `;

    card.addEventListener("click", () => {
      const url = getDetailsUrl(anime.id, type);
      if (url) window.location.href = url;
    });

    container.appendChild(card);
  });
}

function renderHomeSection(data, containerId, type) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const sectionWrap = container.parentElement;

  // Clear container first
  container.innerHTML = "";

  // Remove existing show-more button if any
  const oldBtn = sectionWrap.querySelector(".show-more-btn");
  if (oldBtn) oldBtn.remove();

  const isMobile = window.innerWidth <= 768;
  const initialCount = isMobile ? data.length : 4;
  const initialData = data.slice(0, initialCount);
  createCard(initialData, containerId, type, true);

  if (!isMobile && data.length > initialCount) {
    const showMoreBtn = document.createElement("button");
    showMoreBtn.className = "show-more-btn";
    showMoreBtn.textContent = "Show More";
    showMoreBtn.onclick = () => {
      const currentCount = container.children.length;
      const nextData = data.slice(currentCount, currentCount + 4);
      createCard(nextData, containerId, type, true);

      if (container.children.length >= data.length) {
        showMoreBtn.remove();
      }
    };
    sectionWrap.appendChild(showMoreBtn);
  }
}

// =====================
// Boot
// =====================
async function boot() {
  await loadHomeFeaturedSlider();
  initSearch();
  initGalleries();
  initMenuAndModal();

  // Fetch and render top-rated content if on Home page
  if (isHomePage()) {
    try {
      const res = await fetch("/api/top-rated");
      if (res.ok) {
        const data = await res.json();
        if (data.series) renderHomeSection(data.series, "topSeriesGallery", "series");
        if (data.movies) renderHomeSection(data.movies, "topMoviesGallery", "movies");
        if (data.coming) renderHomeSection(data.coming, "topComingGallery", "coming");
        if (data.airing) renderHomeSection(data.airing, "topAiringGallery", "airing");
      }
    } catch (err) {
      console.error("Failed to load top-rated content:", err);
    }
  }
}

document.addEventListener("DOMContentLoaded", boot);
