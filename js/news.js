// js/news.js

document.addEventListener("DOMContentLoaded", () => {
    loadNewsFeed();
    initNewsSearch();
});

let allNewsItems = [];

async function loadNewsFeed() {
    const loader = document.getElementById("newsLoader");
    const grid = document.getElementById("newsGrid");
    const errorState = document.getElementById("newsErrorState");

    if (!grid) return;

    try {
        // Fetch from our local backend API instead of rss2json
        const endpoint = `/api/news`;

        const res = await fetch(endpoint);
        if (!res.ok) throw new Error("Failed to fetch news feed");

        const data = await res.json();
        if (data.status !== "ok" || !Array.isArray(data.items)) {
            throw new Error("Invalid news API response");
        }

        allNewsItems = data.items;

        if (allNewsItems.length === 0) {
            showErrorState();
            return;
        }

        renderNewsGrid(allNewsItems);

        // Hide loader, show grid
        if (loader) loader.style.display = "none";
        grid.style.display = "grid";
        if (errorState) errorState.style.display = "none";

    } catch (err) {
        console.error("❌ Error loading news feed:", err);
        showErrorState();
    }
}

function renderNewsGrid(items) {
    const grid = document.getElementById("newsGrid");
    if (!grid) return;

    grid.innerHTML = "";

    items.forEach((item) => {
        // Extract a clean image thumbnail from rss2json
        let img = item.thumbnail;
        if (!img && item.enclosure && item.enclosure.link) {
            img = item.enclosure.link;
        }
        // Fallback: Check if description contains an img tag (in case it wasn't stripped)
        if (!img && item.description) {
            const match = item.description.match(/<img[^>]+src="([^">]+)"/);
            if (match && match[1]) {
                img = match[1];
            }
        }
        // Final fallback: Use a beautiful generic premium anime wallpaper placeholder
        if (!img) {
            img = "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=640&auto=format&fit=crop";
        }

        // Parse date beautifully
        const dateObj = new Date(item.pubDate.replace(/-/g, "/")); // sanitize date string for Safari/iOS
        const formattedDate = isNaN(dateObj.getTime()) 
            ? "Recently" 
            : dateObj.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
            });

        // Clean description excerpt (remove HTML if any left)
        let cleanDesc = item.description || "";
        cleanDesc = cleanDesc.replace(/<[^>]*>/g, "").trim();
        // Truncate to a solid 140 chars
        if (cleanDesc.length > 140) {
            cleanDesc = cleanDesc.substring(0, 137) + "...";
        }

        // Categories/Keywords
        const category = item.categories && item.categories.length > 0 ? item.categories[0] : "News";

        const card = document.createElement("div");
        card.className = "news-card";

        card.innerHTML = `
            <div class="news-img-wrap">
                <div class="news-badge">${category}</div>
                <img class="news-img" src="${img}" alt="${item.title}" loading="lazy" decoding="async" onerror="this.src='https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=640&auto=format&fit=crop'">
            </div>
            <div class="news-body">
                <h3 class="news-title">${item.title}</h3>
                <p class="news-desc">${cleanDesc}</p>
                <div class="news-footer">
                    <span class="news-date"><i class="fa-regular fa-clock"></i> ${formattedDate}</span>
                    <a href="news-details.html?url=${encodeURIComponent(item.link)}" class="news-link">Read Article <i class="fa-solid fa-book-open"></i></a>
                </div>
            </div>
        `;

        grid.appendChild(card);
    });
}

function showErrorState() {
    const loader = document.getElementById("newsLoader");
    const grid = document.getElementById("newsGrid");
    const errorState = document.getElementById("newsErrorState");

    if (loader) loader.style.display = "none";
    if (grid) grid.style.display = "none";
    if (errorState) errorState.style.display = "flex";
}

function initNewsSearch() {
    const searchBox = document.getElementById("search");
    if (!searchBox) return;

    searchBox.addEventListener("input", () => {
        const value = searchBox.value.toLowerCase();
        
        const filtered = allNewsItems.filter(item => {
            const title = (item.title || "").toLowerCase();
            const desc = (item.description || "").toLowerCase();
            return title.includes(value) || desc.includes(value);
        });

        renderNewsGrid(filtered);
    });
}
