const axios = require("axios");

const ANILIST_URL = "https://graphql.anilist.co";

const ANIME_FRAGMENT = `
  id
  title {
    romaji
    english
    native
  }
  coverImage {
    large
    extraLarge
  }
  bannerImage
  description(asHtml: false)
  startDate {
    year
    month
    day
  }
  format
  status
  episodes
  averageScore
  popularity
  genres
  tags {
    name
    category
  }
  season
  studios(isMain: true) {
    nodes {
      name
    }
  }
  trailer {
    id
    site
  }
`;

/**
 * Genres/tags that must never be imported.
 */
const BLOCKED_CONTENT = ["hentai", "ecchi"];

/**
 * Returns true if raw AniList media contains any blocked genre or tag.
 * @param {object} media - Raw AniList media object
 * @returns {{ blocked: boolean, reason: string|null }}
 */
const checkBlocked = (media) => {
  const genres = (media.genres || []).map((g) => g.toLowerCase());
  const tags = (media.tags || []).map((t) => (t.name || "").toLowerCase());
  const combined = [...genres, ...tags];

  for (const term of BLOCKED_CONTENT) {
    if (combined.includes(term)) {
      return { blocked: true, reason: term };
    }
  }
  return { blocked: false, reason: null };
};

/**
 * Helper to sleep for a given amount of time.
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generic fetcher for AniList GraphQL API with retry logic for 429.
 */
const fetchAniList = async (query, variables = {}, retryCount = 0) => {
  try {
    const response = await axios.post(
      ANILIST_URL,
      { query, variables },
      {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "AnimePlus/1.0",
        },
        timeout: 20000,
      }
    );

    return response.data.data;
  } catch (error) {
    if (error.response && error.response.status === 429 && retryCount < 3) {
      const retryAfter = (retryCount + 1) * 10000;
      console.warn(`[AniList] Rate limited. Retrying after ${retryAfter / 1000}s...`);
      await sleep(retryAfter);
      return fetchAniList(query, variables, retryCount + 1);
    }
    throw error;
  }
};

/**
 * Cleans HTML/Markdown from AniList description.
 */
const cleanText = (text) => {
  if (!text) return null;
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?i>/gi, "")
    .replace(/<\/?b>/gi, "")
    .replace(/<\/?em>/gi, "")
    .replace(/<\/?strong>/gi, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

/**
 * Maps AniList Media object to our Local Anime model structure.
 */
const mapMediaToAnime = (media) => {
  const titleObj = media.title || {};
  const title = titleObj.english || titleObj.romaji || titleObj.native || "Unknown";
  
  // Mapping status
  let status = "released";
  if (media.status === "NOT_YET_RELEASED") status = "upcoming";
  else if (media.status === "RELEASING") status = "airing";

  // Mapping category/classification
  let category = "series";
  if (media.format === "MOVIE") category = "movies";
  else if (status === "upcoming") category = "coming";

  // Build release date
  let releaseDate = null;
  const startDate = media.startDate || {};
  if (startDate.year) {
    const month = String(startDate.month || 1).padStart(2, "0");
    const day = String(startDate.day || 1).padStart(2, "0");
    releaseDate = `${startDate.year}-${month}-${day}`;
  }

  // Build trailer link
  let trailer = null;
  if (media.trailer && media.trailer.site === "youtube") {
    trailer = `https://www.youtube.com/watch?v=${media.trailer.id}`;
  }

  // Safe access for nested objects
  const coverImage = media.coverImage || {};
  const studioNodes = (media.studios && media.studios.nodes) || [];

  return {
    name: title,
    src: coverImage.extraLarge || coverImage.large || null,
    bannerImage: media.bannerImage || null,
    category: category,
    type: media.format === "MOVIE" ? "movie" : "series",
    status: status,
    rating: media.averageScore ? (media.averageScore / 10).toFixed(1) : "0.0",
    description: cleanText(media.description),
    studio: studioNodes[0] ? studioNodes[0].name : null,
    year: startDate.year ? String(startDate.year) : null,
    releaseDate: releaseDate,
    anilistId: media.id,
    genres: media.genres ? media.genres.join(", ") : null,
    format: media.format,
    season: media.season,
    episodes: media.episodes,
    popularity: media.popularity,
    trailer: trailer,
  };
};

/**
 * Fetch trending anime.
 */
exports.getTrending = async (perPage = 25, page = 1) => {
  const query = `
    query ($perPage: Int, $page: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, sort: TRENDING_DESC) {
          ${ANIME_FRAGMENT}
        }
      }
    }
  `;
  const data = await fetchAniList(query, { perPage, page });
  return data.Page.media
    .filter((m) => {
      const { blocked, reason } = checkBlocked(m);
      if (blocked) {
        const title = (m.title?.english || m.title?.romaji || "Unknown");
        console.log(`[AniList][Trending] Skipped "${title}" — blocked content: ${reason}`);
      }
      return !blocked;
    })
    .map(mapMediaToAnime);
};

/**
 * Fetch upcoming anime (next season).
 */
exports.getUpcoming = async (perPage = 25, page = 1) => {
  const query = `
    query ($perPage: Int, $page: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, status: NOT_YET_RELEASED, sort: POPULARITY_DESC) {
          ${ANIME_FRAGMENT}
        }
      }
    }
  `;
  const data = await fetchAniList(query, { perPage, page });
  return data.Page.media
    .filter((m) => {
      const { blocked, reason } = checkBlocked(m);
      if (blocked) {
        const title = (m.title?.english || m.title?.romaji || "Unknown");
        console.log(`[AniList][Upcoming] Skipped "${title}" — blocked content: ${reason}`);
      }
      return !blocked;
    })
    .map(mapMediaToAnime);
};

/**
 * Fetch popular movies.
 */
exports.getPopularMovies = async (perPage = 25, page = 1) => {
  const query = `
    query ($perPage: Int, $page: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, format: MOVIE, sort: POPULARITY_DESC) {
          ${ANIME_FRAGMENT}
        }
      }
    }
  `;
  const data = await fetchAniList(query, { perPage, page });
  return data.Page.media
    .filter((m) => {
      const { blocked, reason } = checkBlocked(m);
      if (blocked) {
        const title = (m.title?.english || m.title?.romaji || "Unknown");
        console.log(`[AniList][Movies] Skipped "${title}" — blocked content: ${reason}`);
      }
      return !blocked;
    })
    .map(mapMediaToAnime);
};

/**
 * Fetch currently airing anime.
 */
exports.getAiring = async (perPage = 25, page = 1) => {
  const query = `
    query ($perPage: Int, $page: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC) {
          ${ANIME_FRAGMENT}
        }
      }
    }
  `;
  const data = await fetchAniList(query, { perPage, page });
  return data.Page.media
    .filter((m) => {
      const { blocked, reason } = checkBlocked(m);
      if (blocked) {
        const title = (m.title?.english || m.title?.romaji || "Unknown");
        console.log(`[AniList][Airing] Skipped "${title}" — blocked content: ${reason}`);
      }
      return !blocked;
    })
    .map(mapMediaToAnime);
};

/**
 * Fetch single anime details.
 */
exports.getDetails = async (anilistId) => {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        ${ANIME_FRAGMENT}
      }
    }
  `;
  const data = await fetchAniList(query, { id: anilistId });
  return mapMediaToAnime(data.Media);
};
