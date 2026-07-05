// Fetch Coming Soon Data from MySQL API
let comingData = [];

async function fetchComing() {
  try {
    const response = await fetch("/api/coming");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    comingData = await response.json();

    const tryRender = () => {
      if (typeof window.createCard === "function") {
        window.createCard(comingData, "comingGallery", "coming");
      } else {
        setTimeout(tryRender, 50);
      }
    };

    tryRender();
  } catch (error) {
    console.error("Error fetching coming soon:", error);
  }
}

fetchComing();
