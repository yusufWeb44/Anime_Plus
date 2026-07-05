const { Anime, Op } = require("../models");
const anilistService = require("./anilistService");
const { Sequelize } = require("sequelize");

/**
 * Cooldown period before an anime can be refreshed again.
 * Defaults to 60 minutes.
 */
const REFRESH_COOLDOWN_MS = process.env.REFRESH_COOLDOWN_MS 
  ? parseInt(process.env.REFRESH_COOLDOWN_MS, 10) 
  : 60 * 60 * 1000;

/**
 * In-memory lock to prevent concurrent refreshes of the same anime record.
 */
const activeRefreshes = new Set();

/**
 * Helper to sleep for a given amount of time.
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Checks if the incoming AniList data represents a meaningful change compared to the DB record.
 */
const hasMeaningfulChanges = (anime, updatedData) => {
  // Define fields that are considered "meaningful" changes
  const checkFields = [
    "status", "category", "type", "rating", "description", 
    "studio", "year", "releaseDate", "bannerImage", "genres", 
    "format", "season", "episodes", "trailer"
  ];

  for (const field of checkFields) {
    // Treat undefined/null/empty string equivalence
    const oldValue = anime[field] || null;
    const newValue = updatedData[field] || null;
    if (oldValue !== newValue) {
      return true;
    }
  }
  return false;
};

/**
 * Refreshes metadata for a specific anime record idempotently.
 */
const refreshAnimeRecord = async (anime) => {
  if (!anime.anilistId) {
    console.warn(`[Maintenance] Skipping ${anime.name} - No AniList ID.`);
    return null;
  }

  if (activeRefreshes.has(anime.id)) {
    console.warn(`[Maintenance] Skipping ${anime.name} - Already refreshing concurrently.`);
    return null;
  }

  activeRefreshes.add(anime.id);

  try {
    const updatedData = await anilistService.getDetails(anime.anilistId);
    
    if (!hasMeaningfulChanges(anime, updatedData)) {
      // Idempotent: No meaningful changes, just update the timestamp
      await anime.update({
        lastSuccessfulRefreshAt: new Date()
      });
      console.log(`[Maintenance] Skipped (No changes): ${anime.name}`);
      return true;
    }

    // Meaningful changes detected, update all data
    await anime.update({
      ...updatedData,
      updatedAt: new Date(),
      lastSuccessfulRefreshAt: new Date()
    });
    console.log(`[Maintenance] Refreshed: ${anime.name}`);
    return true;
  } catch (error) {
    console.error(`[Maintenance] Failed to refresh ${anime.name}:`, error.message);
    return false;
  } finally {
    activeRefreshes.delete(anime.id);
  }
};

/**
 * Generates the WHERE clause to filter out recently refreshed items.
 */
const getRefreshWhereClause = () => {
  const cutoffDate = new Date(Date.now() - REFRESH_COOLDOWN_MS);
  return {
    [Op.or]: [
      { lastSuccessfulRefreshAt: null },
      { lastSuccessfulRefreshAt: { [Op.lt]: cutoffDate } }
    ]
  };
};

/**
 * Maintenance Engine: Refreshes active or upcoming anime.
 * Useful for catching status transitions (Upcoming -> Airing -> Released).
 */
exports.refreshActiveAnime = async (batchSize = 20) => {
  console.log(`[Maintenance] Starting Active Anime Refresh...`);

  // Find anime that are likely to change: upcoming or currently airing
  const items = await Anime.findAll({
    where: {
      status: {
        [Op.in]: ["upcoming", "airing"],
      },
      anilistId: {
        [Op.ne]: null,
      },
      ...getRefreshWhereClause(),
    },
    limit: batchSize,
    order: [
      ["lastSuccessfulRefreshAt", "ASC"],
      ["updatedAt", "ASC"]
    ], // Process oldest refreshed first, nulls first
  });

  console.log(`[Maintenance] Found ${items.length} items to check.`);

  let count = 0;
  for (const item of items) {
    const success = await refreshAnimeRecord(item);
    if (success) count++;
    await sleep(2000); // 2s delay between updates to stay safe
  }

  console.log(`[Maintenance] Finished. Updated ${count} items.`);
  return count;
};

/**
 * Maintenance Engine: Refreshes ratings/popularity for all anime.
 * Can be run less frequently.
 */
exports.refreshMetadataAll = async (batchSize = 30) => {
  console.log(`[Maintenance] Starting Global Metadata Refresh...`);

  const items = await Anime.findAll({
    where: {
      anilistId: {
        [Op.ne]: null,
      },
      ...getRefreshWhereClause(),
    },
    limit: batchSize,
    order: [
      ["lastSuccessfulRefreshAt", "ASC"],
      ["updatedAt", "ASC"]
    ],
  });

  let count = 0;
  for (const item of items) {
    const success = await refreshAnimeRecord(item);
    if (success) count++;
    await sleep(2000);
  }

  console.log(`[Maintenance] Finished global refresh. Updated ${count} items.`);
  return count;
};

/**
 * Maintenance Engine: Refreshes metadata for series only.
 */
exports.refreshSeries = async (batchSize = 20) => {
  console.log(`[Maintenance] Starting Series Metadata Refresh...`);

  const items = await Anime.findAll({
    where: {
      type: "series",
      status: {
        [Op.ne]: "upcoming",
      },
      anilistId: {
        [Op.ne]: null,
      },
      ...getRefreshWhereClause(),
    },
    limit: batchSize,
    order: [
      ["lastSuccessfulRefreshAt", "ASC"],
      ["updatedAt", "ASC"]
    ],
  });

  let count = 0;
  for (const item of items) {
    const success = await refreshAnimeRecord(item);
    if (success) count++;
    await sleep(2000);
  }

  console.log(`[Maintenance] Finished series refresh. Updated ${count} items.`);
  return count;
};

/**
 * Maintenance Engine: Refreshes metadata for movies only.
 */
exports.refreshMovies = async (batchSize = 20) => {
  console.log(`[Maintenance] Starting Movies Metadata Refresh...`);

  const items = await Anime.findAll({
    where: {
      type: "movie",
      status: {
        [Op.ne]: "upcoming",
      },
      anilistId: {
        [Op.ne]: null,
      },
      ...getRefreshWhereClause(),
    },
    limit: batchSize,
    order: [
      ["lastSuccessfulRefreshAt", "ASC"],
      ["updatedAt", "ASC"]
    ],
  });

  let count = 0;
  for (const item of items) {
    const success = await refreshAnimeRecord(item);
    if (success) count++;
    await sleep(2000);
  }

  console.log(`[Maintenance] Finished movies refresh. Updated ${count} items.`);
  return count;
};

/**
 * Maintenance Engine: Refreshes metadata for upcoming items only.
 */
exports.refreshUpcoming = async (batchSize = 20) => {
  console.log(`[Maintenance] Starting Upcoming Metadata Refresh...`);

  const items = await Anime.findAll({
    where: {
      status: "upcoming",
      anilistId: {
        [Op.ne]: null,
      },
      ...getRefreshWhereClause(),
    },
    limit: batchSize,
    order: [
      ["lastSuccessfulRefreshAt", "ASC"],
      ["updatedAt", "ASC"]
    ],
  });

  let count = 0;
  for (const item of items) {
    const success = await refreshAnimeRecord(item);
    if (success) count++;
    await sleep(2000);
  }

  console.log(`[Maintenance] Finished upcoming refresh. Updated ${count} items.`);
  return count;
};

/**
 * Maintenance Engine: Refreshes metadata for currently airing items only.
 */
exports.refreshAiring = async (batchSize = 20) => {
  console.log(`[Maintenance] Starting Airing Metadata Refresh...`);

  const items = await Anime.findAll({
    where: {
      status: "airing",
      anilistId: {
        [Op.ne]: null,
      },
      ...getRefreshWhereClause(),
    },
    limit: batchSize,
    order: [
      ["lastSuccessfulRefreshAt", "ASC"],
      ["updatedAt", "ASC"]
    ],
  });

  let count = 0;
  for (const item of items) {
    const success = await refreshAnimeRecord(item);
    if (success) count++;
    await sleep(2000);
  }

  console.log(`[Maintenance] Finished airing refresh. Updated ${count} items.`);
  return count;
};

