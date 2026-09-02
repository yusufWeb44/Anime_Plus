// js/userlist.js (Server-backed version)

let allWatchlistItems = [];
let activeFilterTab = "all";

function isMyListPage() {
    return document.body.classList.contains("mylist-page");
}

async function loadUserList() {
    const gallery = document.getElementById("userListGallery");
    const emptyState = document.getElementById("emptyState");

    if (!gallery) return;

    // Check auth
    if (!window.AnimePlusAuth || !window.AnimePlusAuth.isLoggedIn()) {
        gallery.style.display = "none";
        if (emptyState) {
            emptyState.style.display = "flex";
            emptyState.innerHTML = `
                <i class="fa-solid fa-lock" style="font-size: 60px; color: #ac4a92; margin-bottom: 15px; opacity: 0.6;"></i>
                <h2>Login Required</h2>
                <p>Please log in to manage and view your personal anime watchlist.</p>
                <button onclick="window.AnimePlusAuth.openLoginModal()" class="explore-btn" style="border:none; cursor:pointer; margin-top: 15px;"><i class="fa-solid fa-arrow-right-to-bracket"></i> Login Now</button>
            `;
        }
        return;
    }

    const endpoint = isMyListPage() ? "/api/user/watchlist" : "/api/user/favorites";

    try {
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error("Failed to fetch list");
        
        const animeList = await res.json();
        allWatchlistItems = animeList || [];

        if (isMyListPage()) {
            setupWatchlistTabs();
            renderFilteredWatchlist();
        } else {
            // Favorites fallback (Standard logic)
            if (!animeList || animeList.length === 0) {
                gallery.style.display = "none";
                if (emptyState) emptyState.style.display = "flex";
                return;
            }

            renderAnimeCards(animeList);
        }

        initListSearch();
    } catch (err) {
        console.error("Error loading list:", err);
        window.AnimePlusAuth.showToast("Failed to load list. Please try again.", "error");
    }
}

function setupWatchlistTabs() {
    // Calculate counts
    const counts = {
        all: allWatchlistItems.length,
        watching: 0,
        plan_to_watch: 0,
        completed: 0,
        on_hold: 0,
        dropped: 0
    };

    allWatchlistItems.forEach(item => {
        if (item.watchlistStatus && counts[item.watchlistStatus] !== undefined) {
            counts[item.watchlistStatus]++;
        }
    });

    // Update badges
    for (const [status, count] of Object.entries(counts)) {
        const idName = status === 'plan_to_watch' ? 'plan' : (status === 'on_hold' ? 'hold' : status);
        const badge = document.getElementById(`badge-${idName}`);
        if (badge) badge.textContent = count;
    }

    // Tab buttons event listeners
    const tabs = document.querySelectorAll(".mylist-tab");
    tabs.forEach(tab => {
        // Clone and replace to avoid multiple event listeners on reload
        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);
        
        newTab.addEventListener("click", () => {
            document.querySelectorAll(".mylist-tab").forEach(t => t.classList.remove("active"));
            newTab.classList.add("active");
            activeFilterTab = newTab.getAttribute("data-tab");
            renderFilteredWatchlist();
        });
    });
}

function renderFilteredWatchlist() {
    const gallery = document.getElementById("userListGallery");
    const emptyState = document.getElementById("emptyState");
    
    if (!gallery) return;

    // Filter items
    const filteredItems = activeFilterTab === "all" 
        ? allWatchlistItems 
        : allWatchlistItems.filter(item => item.watchlistStatus === activeFilterTab);

    if (filteredItems.length === 0) {
        gallery.style.display = "none";
        if (emptyState) {
            emptyState.style.display = "flex";
            // Custom empty state messages in English based on chosen tab
            const emptyMessages = {
                all: { title: "Your Watchlist is Empty", desc: "Start exploring series and movies to build your dream collection!" },
                watching: { title: "Not Watching Anything Right Now", desc: "Browse anime and mark them as 'Watching' to track your progress here!" },
                plan_to_watch: { title: "Your Watchlist is Clear", desc: "Looking for new adventures? Add upcoming or finished anime to 'Plan to Watch'!" },
                completed: { title: "No Completed Anime Yet", desc: "Finish watching your active shows and celebrate your milestones here!" },
                on_hold: { title: "No Anime on Hold", desc: "Everything is going smooth! No shows are currently paused." },
                dropped: { title: "Dropped List is Empty", desc: "Outstanding! You are thoroughly enjoying every single show you watch." }
            };
            const msg = emptyMessages[activeFilterTab] || emptyMessages.all;
            emptyState.querySelector("h2").textContent = msg.title;
            emptyState.querySelector("p").textContent = msg.desc;
        }
        return;
    }

    if (emptyState) emptyState.style.display = "none";
    renderAnimeCards(filteredItems);
}

function renderAnimeCards(list) {
    const gallery = document.getElementById("userListGallery");
    if (!gallery) return;

    gallery.innerHTML = "";
    gallery.style.display = "grid";

    list.forEach((anime, index) => {
        const animeId = anime.id;
        const type = anime.type === 'movie' ? 'movies' : (anime.status === 'upcoming' ? 'coming' : 'series');
        
        const title = (anime.name || "Unknown").replace(/"/g, "&quot;");
        const rating = anime.rating || "0.0";
        
        const displayTags = anime.genres || anime.category || "";
        const cats = displayTags ? displayTags.split(',').map(c => c.trim()) : [];

        const card = document.createElement("div");
        card.classList.add("anime-card");

        let tagsHtml = '<div class="category-tags">';
        cats.forEach((cat) => {
            tagsHtml += `<span class="category-tag">${cat.replace(/</g, "&lt;")}</span>`;
        });
        tagsHtml += "</div>";

        // Add a status indicator badge on the card when displaying "All" list
        let statusBadgeHtml = "";
        if (isMyListPage() && activeFilterTab === "all" && anime.watchlistStatus) {
            const statusLabels = {
                watching: { text: "Watching", color: "#3b82f6" },
                plan_to_watch: { text: "Plan to Watch", color: "#f59e0b" },
                completed: { text: "Completed", color: "#10b981" },
                on_hold: { text: "On Hold", color: "#8b5cf6" },
                dropped: { text: "Dropped", color: "#ef4444" }
            };
            const label = statusLabels[anime.watchlistStatus];
            if (label) {
                statusBadgeHtml = `<span style="position: absolute; top: 12px; left: 12px; background: rgba(15, 4, 15, 0.9); color: ${label.color}; border: 1px solid ${label.color}; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; z-index: 10;">${label.text}</span>`;
            }
        }

        // First 5 cards are likely visible above the fold — load eagerly
        const isEager = index < 5;
        const posterHtml = typeof getPosterHTML === "function"
            ? getPosterHTML(anime, isEager)
            : `<img src="${anime.src || "../assets/placeholder-poster.jpg"}" alt="${title}">`;

        card.innerHTML = `
        ${statusBadgeHtml}
        ${posterHtml}
        <div class="anime-info">
            <h3>${title}</h3>
            <p>Rating: <i class="fa-solid fa-star" style="color: gold;"></i> ${rating}/10</p>
            ${tagsHtml}
        </div>
        `;

        card.addEventListener("click", () => {
            const inViews = window.location.pathname.includes("/views/");
            const base = inViews ? "details.html" : "/views/details.html";
            window.location.href = `${base}?id=${encodeURIComponent(animeId)}&type=${encodeURIComponent(type)}`;
        });

        gallery.appendChild(card);
    });

    // Handle images already in browser cache
    if (typeof checkCachedImages === "function") checkCachedImages();
}

function initListSearch() {
    const searchBox = document.getElementById("search");
    if (!searchBox) return;

    searchBox.disabled = false;
    searchBox.style.opacity = "1";
    searchBox.style.cursor = "text";

    searchBox.addEventListener("input", () => {
        const value = searchBox.value.toLowerCase();
        document.querySelectorAll(".anime-card").forEach((card) => {
            const h3 = card.querySelector("h3");
            const name = (h3 ? h3.textContent : "").toLowerCase();
            if (name.includes(value)) {
                card.classList.remove("search-hidden");
            } else {
                card.classList.add("search-hidden");
            }
        });
    });
}

// Boot dynamically waiting for Auth Check since loadCurrentUser calls `/auth/me` asynchronously
document.addEventListener("DOMContentLoaded", () => {
    // Poll until auth check finishes
    let checks = 0;
    const interval = setInterval(() => {
        if (window.AnimePlusAuth?.isAuthLoaded || checks > 40) { // wait up to 2 seconds
            clearInterval(interval);
            loadUserList();
        }
        checks++;
    }, 50);
});
