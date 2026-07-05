// Fetch Movies Data from MySQL API
let moviesData = [];

async function fetchMovies() {
  try {
    const response = await fetch("/api/movies");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    moviesData = await response.json();

    // wait until createCard is available (script.js loaded)
    const tryRender = () => {
      if (typeof window.createCard === "function") {
        window.createCard(moviesData, "moviesGallery", "movies");
      } else {
        setTimeout(tryRender, 50);
      }
    };

    tryRender();
  } catch (error) {
    console.error("Error fetching movies:", error);
  }
}

fetchMovies();
