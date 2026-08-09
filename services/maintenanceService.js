const { Anime, Op } = require("../models");
const anilistService = require("./anilistService");
const { Sequelize } = require("sequelize");
const ytSearch = require("yt-search");

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
 * Returns detailed status string.
 */
const refreshAnimeRecordDetailed = async (anime) => {
  if (!anime.anilistId) {
    console.warn(`[Maintenance] Skipping ${anime.name} - No AniList ID.`);
    return 'skipped';
  }

  if (activeRefreshes.has(anime.id)) {
    console.warn(`[Maintenance] Skipping ${anime.name} - Already refreshing concurrently.`);
    return 'skipped';
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
      return 'unchanged';
    }

    // Meaningful changes detected, update all data
    await anime.update({
      ...updatedData,
      updatedAt: new Date(),
      lastSuccessfulRefreshAt: new Date()
    });
    console.log(`[Maintenance] Refreshed: ${anime.name}`);
    return 'updated';
  } catch (error) {
    const msg = (error.message || "").toLowerCase();
    console.error(`[Maintenance] Failed to refresh ${anime.name}:`, error.message);
    
    if (msg.includes('403') || msg.includes('429') || msg.includes('timeout') || msg.includes('network error')) {
      return 'rate_limit';
    }
    
    // Normal error (e.g. 404, parsing error). Update timestamp so we don't infinitely retry it in the same run.
    try {
      await anime.update({ lastSuccessfulRefreshAt: new Date() });
    } catch (e) {}
    
    return 'error';
  } finally {
    activeRefreshes.delete(anime.id);
  }
};

/**
 * Backwards compatible wrapper for refreshAnimeRecord
 */
const refreshAnimeRecord = async (anime) => {
  const status = await refreshAnimeRecordDetailed(anime);
  if (status === 'skipped') return null;
  if (status === 'error' || status === 'rate_limit') return false;
  return true;
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
 * Job state for background refresh-all
 */
const refreshAllJob = {
  isRunning: false,
  status: 'idle', // idle, running, completed, error
  total: 0,
  processed: 0,
  remaining: 0,
  updated: 0,
  unchanged: 0,
  skipped: 0,
  errors: 0
};

/**
 * Maintenance Engine: Start background refresh for all anime.
 */
exports.startBackgroundRefreshAll = async () => {
  if (refreshAllJob.isRunning) {
    throw new Error("A refresh-all job is already running.");
  }

  // Preserve progress if resuming from paused state
  if (refreshAllJob.status !== 'paused_rate_limit' && refreshAllJob.status !== 'paused') {
    refreshAllJob.processed = 0;
    refreshAllJob.updated = 0;
    refreshAllJob.unchanged = 0;
    refreshAllJob.skipped = 0;
    refreshAllJob.errors = 0;

    const totalItems = await Anime.count({
      where: {
        anilistId: { [Op.ne]: null },
        ...getRefreshWhereClause(),
      }
    });

    refreshAllJob.total = totalItems;
    refreshAllJob.remaining = totalItems;
  } else {
    console.log("[Maintenance] Resuming paused refresh-all job...");
  }

  refreshAllJob.isRunning = true;
  refreshAllJob.status = 'running';

  runRefreshAllLoop().catch(err => {
    console.error("[Maintenance] Background refresh all failed:", err);
    refreshAllJob.status = 'error';
    refreshAllJob.isRunning = false;
  });

  return refreshAllJob;
};

const runRefreshAllLoop = async () => {
  const batchSize = 50;
  const perAnimeDelay = 2500;
  const batchDelay = 45000;

  let rateLimitRetries = 0;
  const retryDelays = [30000, 60000, 120000];

  let currentPhase = 0;
  const phases = ["airing", "upcoming", "other"];

  while (refreshAllJob.isRunning) {
    let whereClause = {
      anilistId: { [Op.ne]: null },
      ...getRefreshWhereClause(),
    };

    if (phases[currentPhase] === "airing") {
      whereClause.status = "airing";
    } else if (phases[currentPhase] === "upcoming") {
      whereClause.status = "upcoming";
    } else {
      whereClause.status = {
        [Op.notIn]: ["airing", "upcoming"]
      };
    }

    const items = await Anime.findAll({
      where: whereClause,
      limit: batchSize,
      order: [
        ["lastSuccessfulRefreshAt", "ASC"],
        ["updatedAt", "ASC"],
      ],
    });

    if (items.length === 0) {
      if (currentPhase < phases.length - 1) {
        currentPhase++;
        continue;
      } else {
        refreshAllJob.status = "completed";
        refreshAllJob.isRunning = false;
        refreshAllJob.remaining = 0;

        console.log("[Maintenance] Refresh-all completed.");
        break;
      }
    }

    for (let i = 0; i < items.length; i++) {
      if (!refreshAllJob.isRunning) {
        break;
      }

      const item = items[i];
      const status = await refreshAnimeRecordDetailed(item);

      if (status === "rate_limit") {
        if (rateLimitRetries < retryDelays.length) {
          const delay = retryDelays[rateLimitRetries];

          console.log(
            `[Maintenance] Rate limited (403/429). Pausing for ${
              delay / 1000
            }s...`
          );

          refreshAllJob.status = "paused";
          await sleep(delay);

          rateLimitRetries++;
          refreshAllJob.status = "running";

          i--; // إعادة محاولة نفس الأنمي
          continue;
        }

        console.log(
          "[Maintenance] Rate limit persisted. Stopping job safely."
        );

        refreshAllJob.status = "paused_rate_limit";
        refreshAllJob.isRunning = false;
        break;
      }

      // إعادة عداد الـrate limit بعد أي نتيجة طبيعية
      rateLimitRetries = 0;

      refreshAllJob.processed++;

      if (status === "updated") {
        refreshAllJob.updated++;
      } else if (status === "unchanged") {
        refreshAllJob.unchanged++;
      } else if (status === "skipped") {
        refreshAllJob.skipped++;
      } else if (status === "error") {
        refreshAllJob.errors++;
      }

      refreshAllJob.remaining = Math.max(
        0,
        refreshAllJob.total - refreshAllJob.processed
      );

      await sleep(perAnimeDelay);
    }

    if (refreshAllJob.isRunning) {
      console.log(
        `[Maintenance] Batch complete. Waiting ${
          batchDelay / 1000
        }s before next batch...`
      );

      await sleep(batchDelay);
    }
  }
};
/**
 * Get status of the background refresh-all job
 */
exports.getRefreshAllStatus = () => {
  return refreshAllJob;
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

/**
 * Job state for fill-missing-trailers background job
 */
const fillTrailersJob = {
  isRunning: false,
  status: 'idle',   // idle | running | completed | error
  total: 0,
  processed: 0,
  found: 0,
  notFound: 0,
  errors: 0,
};

exports.getFillTrailersStatus = () => fillTrailersJob;

/**
 * Searches YouTube for the best trailer video for a given anime name.
 * Returns a YouTube watch URL or null if nothing found.
 */
const searchYouTubeTrailer = async (animeName) => {
  try {
    const query = `${animeName} anime official trailer`;
    const result = await ytSearch(query);
    const videos = (result && result.videos) || [];

    // Pick first video that looks like a trailer and is short enough (< 10 min)
    const candidate = videos.find((v) => {
      const title = (v.title || "").toLowerCase();
      const seconds = v.seconds || 0;
      return (
        seconds > 30 &&
        seconds < 600 &&
        (title.includes("trailer") || title.includes("pv") || title.includes("promo"))
      );
    }) || videos[0]; // fallback: just first result

    if (candidate && candidate.videoId) {
      return `https://www.youtube.com/watch?v=${candidate.videoId}`;
    }
    return null;
  } catch (err) {
    console.error(`[FillTrailers] YouTube search failed for "${animeName}":`, err.message);
    return null;
  }
};

/**
 * Background loop: fills missing trailers for all anime that have no trailer.
 */
const runFillTrailersLoop = async () => {
  const batchSize = 30;
  const delayBetween = 2000; // 2s between each search to avoid rate limits

  while (fillTrailersJob.isRunning) {
    const items = await Anime.findAll({
      where: {
        [Op.or]: [
          { trailer: null },
          { trailer: '' },
        ],
        anilistId: { [Op.ne]: null },
      },
      limit: batchSize,
      order: [['updatedAt', 'ASC']],
    });

    if (items.length === 0) {
      fillTrailersJob.status = 'completed';
      fillTrailersJob.isRunning = false;
      console.log('[FillTrailers] All anime now have trailers. Job complete.');
      break;
    }

    for (const anime of items) {
      if (!fillTrailersJob.isRunning) break;

      try {
        const url = await searchYouTubeTrailer(anime.name);
        if (url) {
          await anime.update({ trailer: url });
          fillTrailersJob.found++;
          console.log(`[FillTrailers] ✓ Found trailer for "${anime.name}": ${url}`);
        } else {
          // Mark with a placeholder so we don't keep retrying it endlessly
          await anime.update({ trailer: 'NOT_FOUND' });
          fillTrailersJob.notFound++;
          console.log(`[FillTrailers] ✗ No trailer found for "${anime.name}"`);
        }
      } catch (err) {
        fillTrailersJob.errors++;
        console.error(`[FillTrailers] Error processing "${anime.name}":`, err.message);
      }

      fillTrailersJob.processed++;
      fillTrailersJob.total = Math.max(fillTrailersJob.total, fillTrailersJob.processed);

      await sleep(delayBetween);
    }
  }

  fillTrailersJob.isRunning = false;
};

/**
 * Starts the fill-missing-trailers background job.
 */
exports.startFillMissingTrailers = async () => {
  if (fillTrailersJob.isRunning) {
    throw new Error('A fill-trailers job is already running.');
  }

  // Count how many anime are missing trailers
  const total = await Anime.count({
    where: {
      [Op.or]: [
        { trailer: null },
        { trailer: '' },
      ],
      anilistId: { [Op.ne]: null },
    },
  });

  fillTrailersJob.isRunning = true;
  fillTrailersJob.status = 'running';
  fillTrailersJob.total = total;
  fillTrailersJob.processed = 0;
  fillTrailersJob.found = 0;
  fillTrailersJob.notFound = 0;
  fillTrailersJob.errors = 0;

  console.log(`[FillTrailers] Starting — ${total} anime need trailers.`);

  runFillTrailersLoop().catch((err) => {
    console.error('[FillTrailers] Job crashed:', err.message);
    fillTrailersJob.status = 'error';
    fillTrailersJob.isRunning = false;
  });

  return fillTrailersJob;
};

/**
 * Stops the fill-missing-trailers background job.
 */
exports.stopFillMissingTrailers = () => {
  fillTrailersJob.isRunning = false;
  fillTrailersJob.status = 'idle';
  return fillTrailersJob;
};
