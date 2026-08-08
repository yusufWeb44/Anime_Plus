async function loadRecommendationsPage() {
    const gallery = document.getElementById("recommendationsGallery");
    const emptyState = document.getElementById("emptyState");
    const subtitle = document.getElementById("recSubtitle");

    if (!gallery) return;

    // Check auth
    if (!window.AnimePlusAuth || !window.AnimePlusAuth.isLoggedIn()) {
        gallery.style.display = "none";
        if (emptyState) {
            emptyState.style.display = "flex";
            emptyState.innerHTML = `
                <i class="fa-solid fa-lock" style="font-size: 60px; color: #ac4a92; margin-bottom: 15px; opacity: 0.6;"></i>
                <h2>Login Required</h2>
                <p>Please log in to view your personalized recommendations.</p>
                <button onclick="window.AnimePlusAuth.openLoginModal()" class="explore-btn" style="border:none; cursor:pointer; margin-top: 15px;"><i class="fa-solid fa-arrow-right-to-bracket"></i> Login Now</button>
            `;
        }
        return;
    }

    try {
        const res = await fetch("/api/user/recommendations");
        if (!res.ok) throw new Error("Failed to fetch recommendations");
        
        const data = await res.json();

        if (!data.recommendations || data.recommendations.length === 0) {
            gallery.style.display = "none";
            if (emptyState) {
                emptyState.style.display = "flex";
                if (data.message) emptyState.querySelector("p").textContent = data.message;
            }
            return;
        }

        if (subtitle && data.message) {
            subtitle.textContent = data.message;
        }

        if (emptyState) emptyState.style.display = "none";
        renderRecCards(data.recommendations);

    } catch (err) {
        console.error("Error loading recommendations:", err);
        window.AnimePlusAuth.showToast("Failed to load recommendations. Please try again.", "error");
    }
}

function renderRecCards(list) {
    const gallery = document.getElementById("recommendationsGallery");
    if (!gallery) return;

    gallery.innerHTML = "";
    gallery.style.display = "grid";

    list.forEach((anime, index) => {
        const animeId = anime.id;
        let type = 'series';
        if (anime.status === 'upcoming') type = 'coming';
        else if (anime.status === 'airing') type = 'airing';
        else if (anime.type === 'movie') type = 'movies';
        
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

        // First 4 cards are visible above the fold — load eagerly
        const isEager = index < 4;
        const posterHtml = typeof getPosterHTML === "function"
            ? getPosterHTML(anime, isEager)
            : `<img src="${anime.src || "../assets/placeholder-poster.jpg"}" alt="${title}">`;

        card.innerHTML = `
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

// Boot dynamically waiting for Auth Check since loadCurrentUser calls `/auth/me` asynchronously
document.addEventListener("DOMContentLoaded", () => {
    // Poll until auth check finishes
    let checks = 0;
    const interval = setInterval(() => {
        if (window.AnimePlusAuth?.isAuthLoaded || checks > 40) { // wait up to 2 seconds
            clearInterval(interval);
            loadRecommendationsPage();
        }
        checks++;
    }, 50);
});
