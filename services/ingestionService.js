const { Anime } = require("../models");
const anilistService = require("./anilistService");
const { Op } = require("sequelize");

/** Terms that are never allowed to be saved. Case-insensitive. */
const BLOCKED_TERMS = ["hentai", "ecchi"];

/**
 * Normalizes a title for comparison.
 */
const normalizeTitle = (title) => {
  return (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
};

/**
 * Saves or updates an anime record in the database.
 * Strategy:
 * 1. Check by anilistId.
 * 2. Fallback: check by normalized name.
 */
const syncAnimeRecord = async (animeData) => {
  try {
    // 1. Try to find by anilistId
    let anime = await Anime.findOne({ where: { anilistId: animeData.anilistId } });

    if (!anime) {
      // 2. Fallback: Try to find by name (fuzzy match)
      // We search for exact match first to be safe
      anime = await Anime.findOne({ where: { name: animeData.name } });
    }

    if (anime) {
      // Update existing record
      // We don't overwrite the 'src' (local image) if it exists and looks like a local path
      // but AniList images are usually better, so we might want to update anyway.
      // For this implementation, we prioritize enriched data.
      await anime.update(animeData);
      return { status: "updated", id: anime.id };
    } else {
      // Create new record
      const newAnime = await Anime.create(animeData);
      return { status: "created", id: newAnime.id };
    }
  } catch (error) {
    console.error(`[Ingestion] Error syncing ${animeData.name}:`, error.message);
    return { status: "error", error: error.message };
  }
};

/**
 * Generic multi-page importer.
 * Fetches pages from AniList until 'count' NEW records are created,
 * or until there are no more results from the API.
 */
const multiPageImport = async (fetchFn, label, count = 25) => {
  console.log(`[Ingestion] Starting ${label} Import (target: ${count} new)...`);
  const results = { created: 0, updated: 0, skipped: 0, errors: 0 };
  let page = 1;
  const maxPages = 5; // safety limit

  while (results.created < count && page <= maxPages) {
    const list = await fetchFn(count, page);
    if (!list || list.length === 0) break; // no more results

    for (const item of list) {
      // Secondary content guard — catches anything that slipped past anilistService
      const genresLower = (item.genres || "").toLowerCase();
      const blockedTerm = BLOCKED_TERMS.find((term) => genresLower.includes(term));
      if (blockedTerm) {
        console.log(`[Ingestion][${label}] Skipped "${item.name}" — blocked content: ${blockedTerm}`);
        results.skipped++;
        continue;
      }

      const res = await syncAnimeRecord(item);
      if (res.status === "created") results.created++;
      else if (res.status === "updated") results.updated++;
      else results.errors++;
    }

    page++;
  }

  console.log(`[Ingestion] Finished ${label}. Results:`, results);
  return results;
};

/**
 * Imports trending anime.
 */
exports.importTrending = async (count = 25) => {
  return multiPageImport(anilistService.getTrending, "Trending", count);
};

/**
 * Imports upcoming anime.
 */
exports.importUpcoming = async (count = 25) => {
  return multiPageImport(anilistService.getUpcoming, "Upcoming", count);
};

/**
 * Imports popular movies.
 */
exports.importMovies = async (count = 25) => {
  return multiPageImport(anilistService.getPopularMovies, "Movies", count);
};

/**
 * Imports currently airing anime.
 */
exports.importAiring = async (count = 25) => {
  return multiPageImport(anilistService.getAiring, "Airing", count);
};
