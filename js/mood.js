document.addEventListener("DOMContentLoaded", () => {
    // Only run if we are actually on the mood page or the elements exist
    const cardsContainer = document.getElementById("moodCards");
    const resultsContainer = document.getElementById("moodResults");
    if (!cardsContainer || !resultsContainer) return;

    const moodCards = document.querySelectorAll(".mood-card");
    const backBtn = document.getElementById("backToMoodsBtn");
    const resultsTitle = document.getElementById("moodResultsTitle");
    const gallery = document.getElementById("moodGallery");

    // Back button
    if (backBtn) {
        backBtn.addEventListener("click", resetMoodView);
    }

    // Mood Cards Click
    moodCards.forEach(card => {
        card.addEventListener("click", async () => {
            const mood = card.getAttribute("data-mood");
            const moodText = card.querySelector("h3").textContent;
            
            // Show loading state
            cardsContainer.style.display = "none";
            resultsContainer.style.display = "block";
            resultsTitle.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Finding ${moodText} Anime...`;
            gallery.innerHTML = "";

            if (window.showGlobalLoader) window.showGlobalLoader();

            try {
                const res = await fetch(`/api/anime/mood/${mood}`);
                if (!res.ok) throw new Error("Failed to fetch mood");
                
                const data = await res.json();
                
                resultsTitle.innerHTML = `Here are some ${moodText} Anime for you!`;
                renderMoodCards(data);

            } catch (err) {
                console.error("Failed to load mood anime:", err);
                resultsContainer.innerHTML = `<div class="error-msg" style="text-align:center; padding:40px; color:#ef4444;">Failed to load data. Please try again.</div>`;
            } finally {
                if (window.hideGlobalLoader) window.hideGlobalLoader();
            }
        });
    });

    function resetMoodView() {
        cardsContainer.style.display = "grid";
        resultsContainer.style.display = "none";
        gallery.innerHTML = "";
    }

    function renderMoodCards(list) {
        gallery.innerHTML = "";
        
        if (!list || list.length === 0) {
            gallery.innerHTML = "<p>No anime found for this mood.</p>";
            return;
        }

        list.forEach((anime, index) => {
            const animeId = anime.id;
            const type = anime.type || 'series';
            const title = (anime.name || "Unknown").replace(/"/g, "&quot;");
            const rating = anime.rating || "0.0";

            const displayTags = anime.genres || anime.category || "";
            const cats = displayTags ? displayTags.split(',').map(c => c.trim()) : [];

            const card = document.createElement("div");
            card.classList.add("anime-card");

            let tagsHtml = '<div class="category-tags">';
            cats.slice(0, 3).forEach((cat) => {
                tagsHtml += `<span class="category-tag">${cat.replace(/</g, "&lt;")}</span>`;
            });
            tagsHtml += "</div>";

            // Mood results appear after a click — all cards start below fold,
            // but first 5 are immediately visible after the panel switches
            const isEager = index < 5;
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
});
