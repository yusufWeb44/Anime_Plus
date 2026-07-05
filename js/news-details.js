// js/news-details.js

document.addEventListener("DOMContentLoaded", () => {
    loadArticle();
});

async function loadArticle() {
    const urlParams = new URLSearchParams(window.location.search);
    const articleUrl = urlParams.get('url');

    const loader = document.getElementById("articleLoader");
    const contentDiv = document.getElementById("articleContent");
    const titleEl = document.getElementById("articleTitle");
    const errorState = document.getElementById("articleErrorState");
    const originalLinkBtn = document.getElementById("originalSourceLink");

    if (!articleUrl) {
        titleEl.textContent = "Article Not Found";
        loader.style.display = "none";
        errorState.style.display = "flex";
        return;
    }

    try {
        const res = await fetch(`/api/news/article?url=${encodeURIComponent(articleUrl)}`);
        const data = await res.json();

        if (data.status !== "ok" || !data.data) {
            throw new Error(data.message || "Failed to load article");
        }

        const article = data.data;

        // Set Title
        titleEl.textContent = article.title || "Anime News";
        document.title = `${article.title || "News"} - AnimePlus`;

        // Render HTML content safely
        contentDiv.innerHTML = article.content;

        // Append Source Footer
        const sourceFooter = document.createElement('div');
        sourceFooter.className = "article-source-footer";
        sourceFooter.innerHTML = `
            <p>
                <i class="fa-solid fa-link"></i> <strong>Source:</strong> 
                <a href="${article.originalUrl}" target="_blank">
                    ${article.sourceName} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.8rem;"></i>
                </a>
            </p>
        `;
        contentDiv.appendChild(sourceFooter);

        loader.style.display = "none";
        contentDiv.style.display = "block";

    } catch (err) {
        console.error("Error loading article:", err);
        titleEl.textContent = "Error Loading Article";
        loader.style.display = "none";
        errorState.style.display = "flex";
        if (originalLinkBtn) {
            originalLinkBtn.href = articleUrl;
        }
    }
}
