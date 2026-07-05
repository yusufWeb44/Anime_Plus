// Fetch Series Data from MySQL API
let seriesData = [];

async function fetchSeries() {
  try {
    const response = await fetch("/api/series");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    seriesData = await response.json();

    const tryRender = () => {
      if (typeof window.createCard === "function") {
        window.createCard(seriesData, "seriesGallery", "series");
      } else {
        setTimeout(tryRender, 50);
      }
    };

    tryRender();
  } catch (error) {
    console.error("Error fetching series:", error);
  }
}

fetchSeries();
