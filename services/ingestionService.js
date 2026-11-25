const { Anime } = require("../models");
const anilistService = require("./anilistService");
const { Op } = require("sequelize");

/** Helper to sleep for a given amount of time. */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Terms that are never allowed to be saved. Case-insensitive. */
const BLOCKED_TERMS = ["hentai", "ecchi"];

/**
 * Normalizes a title for comparison.
 */
const normalizeTitle = (title) => {
  return (title || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
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
      // 2. Fallback: Try to find by name (exact match)
      anime = await Anime.findOne({ where: { name: animeData.name } });
    }

    if (anime) {
      // Check if any actual field changes
      anime.set(animeData);
      if (anime.changed()) {
        await anime.save();
        return { status: "updated", id: anime.id };
      } else {
        return { status: "unchanged", id: anime.id };
      }
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
      // Secondary content guard
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
      else if (res.status === "unchanged") results.skipped++;
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

/**
 * Imports classic anime (2005-2012) with persistent pagination progress.
 * Fetches 1 page (up to 50 anime) per run, rotating across year ranges
 * in round-robin order so all periods are imported evenly.
 * Progress is stored in the ClassicImportProgress table.
 */
exports.importClassics = async () => {
  // ── Configuration ──────────────────────────────────────────────────────────
  const CLASSICS_PER_PAGE = 50; // Total anime per batch/run (AniList max is 50)

  // Supported classic year ranges (2005-2012), from newest to oldest
  const YEAR_RANGES = [
    { startYear: 2011, endYear: 2012, key: "2011-2012" },
    { startYear: 2009, endYear: 2010, key: "2009-2010" },
    { startYear: 2007, endYear: 2008, key: "2007-2008" },
    { startYear: 2005, endYear: 2006, key: "2005-2006" },
  ];

  const { ClassicImportProgress } = require("../models");

  console.log(`[Ingestion] Starting Classics Import (max ${CLASSICS_PER_PAGE} anime per run, round-robin 2005-2012)...`);

  const totals = {
    rangesProcessed:  0,
    pagesFetched:     0,
    fetched:          0,
    created:          0,
    updated:          0,
    unchanged:        0,
    blocked:          0,
    errors:           0,
    completed:        false,
  };

  // Ensure progress records exist for all configured ranges and collect incomplete ones
  const incompleteCandidates = [];
  for (let idx = 0; idx < YEAR_RANGES.length; idx++) {
    const range = YEAR_RANGES[idx];
    const [progress] = await ClassicImportProgress.findOrCreate({
      where: { rangeKey: range.key },
      defaults: { rangeKey: range.key, nextPage: 1, completed: false },
    });

    if (!progress.completed) {
      incompleteCandidates.push({ range, progress, order: idx });
    }
  }

  // Round-robin: pick the incomplete range with the lowest nextPage (tie-break by YEAR_RANGES order)
  incompleteCandidates.sort((a, b) => {
    if (a.progress.nextPage !== b.progress.nextPage) {
      return a.progress.nextPage - b.progress.nextPage;
    }
    return a.order - b.order;
  });

  for (const candidate of incompleteCandidates) {
    const { range, progress } = candidate;
    const currentPage = progress.nextPage;
    totals.rangesProcessed++;

    try {
      const result = await anilistService.getClassicsPage(
        range.startYear,
        range.endYear,
        currentPage,
        CLASSICS_PER_PAGE
      );

      totals.pagesFetched++;
      totals.fetched += result.media.length;

      for (const item of result.media) {
        // Secondary content guard
        const genresLower = (item.genres || "").toLowerCase();
        const blockedTerm = BLOCKED_TERMS.find((t) => genresLower.includes(t));
        if (blockedTerm) {
          console.log(`[Ingestion][Classics] Blocked "${item.name}" — ${blockedTerm}`);
          totals.blocked++;
          continue;
        }

        const res = await syncAnimeRecord(item);
        if (res.status === "created")   totals.created++;
        else if (res.status === "updated")   totals.updated++;
        else if (res.status === "unchanged") totals.unchanged++;
        else totals.errors++;
      }

      if (!result.hasNextPage) {
        console.log(`[Ingestion][Classics] Range ${range.key} exhausted at page ${currentPage}.`);
        await progress.update({ nextPage: currentPage + 1, completed: true });
      } else {
        await progress.update({ nextPage: currentPage + 1 });
      }

      // Stop after fetching one page (up to 50 anime per run) unless this range is completely empty
      if (result.media.length > 0 || result.hasNextPage) {
        break;
      }

      // If this range ended with 0 items, wait briefly and try the next incomplete range
      await sleep(1500);
    } catch (error) {
      console.error(`[Ingestion][Classics] Error on range ${range.key} page ${currentPage}:`, error.message);
      totals.errors++;
      break;
    }
  }

  // Check if ALL configured ranges (2005-2012) are now completed
  const activeKeys = YEAR_RANGES.map((r) => r.key);
  const incompleteCount = await ClassicImportProgress.count({
    where: {
      rangeKey: { [Op.in]: activeKeys },
      completed: false,
    },
  });

  if (incompleteCount === 0 && YEAR_RANGES.length > 0) {
    totals.completed = true;
    console.log(`[Ingestion][Classics] All ranges (2005-2012) exhausted. Full classic library imported!`);
  }

  console.log(`[Ingestion] Finished Classics Import. Results:`, totals);
  return totals;
};



/**
 * Syncs relations for a single anime on demand.
 * Deduplicates and isolates relation creation counts from anime creation counts.
 */
exports.syncRelationsForAnime = async (sourceAnime, globalProcessedAnimeIds = new Set()) => {
  const results = { 
    processedSources: 0, 
    uniqueRelatedAnimeFound: 0, 
    created: 0, 
    updated: 0, 
    unchanged: 0, 
    relationsCreated: 0, 
    relationsExisting: 0, 
    blocked: 0, 
    errors: 0,
    rawEdges: 0
  };

  if (!sourceAnime || !sourceAnime.anilistId) return results;
  
  const AnimeRelation = require("../models").AnimeRelation;

  try {
    const relations = await anilistService.getRelations(sourceAnime.anilistId);
    results.rawEdges = relations.length;

    // 1. Deduplicate related AniList IDs per source anime
    const uniqueRelationsMap = new Map();
    for (const rel of relations) {
      if (!rel.media || !rel.media.anilistId) continue;
      // Keep the first encountered relation for this target anime
      if (!uniqueRelationsMap.has(rel.media.anilistId)) {
        uniqueRelationsMap.set(rel.media.anilistId, rel);
      }
    }

    const deduplicatedRelations = Array.from(uniqueRelationsMap.values());
    results.uniqueRelatedAnimeFound = deduplicatedRelations.length;

    for (const rel of deduplicatedRelations) {
      try {
        const anilistId = rel.media.anilistId;
        let targetAnime = null;
        
        // 5. Count each anime record only once per import execution
        const alreadyProcessed = globalProcessedAnimeIds.has(anilistId);

        if (!alreadyProcessed) {
          globalProcessedAnimeIds.add(anilistId);

          // Secondary content guard
          const genresLower = (rel.media.genres || "").toLowerCase();
          const blockedTerm = BLOCKED_TERMS.find((term) => genresLower.includes(term));
          if (blockedTerm) {
            console.log(`[Ingestion][Related] Skipped "${rel.media.name}" — blocked content: ${blockedTerm}`);
            results.blocked++;
            continue;
          }

          const syncResult = await syncAnimeRecord(rel.media);
          if (syncResult.status === "created") results.created++;
          else if (syncResult.status === "updated") results.updated++;
          else if (syncResult.status === "unchanged") results.unchanged++;
          else results.errors++;

          targetAnime = await Anime.findOne({ where: { anilistId } });
        } else {
          // Already processed in this batch, just lookup to establish the relation
          targetAnime = await Anime.findOne({ where: { anilistId } });
        }

        if (!targetAnime) {
          if (!alreadyProcessed) results.errors++;
          continue;
        }

        // Prevent self-relation
        if (sourceAnime.id === targetAnime.id) continue;

        // 6. Relationship counting must remain separate
        try {
          const [relation, created] = await AnimeRelation.findOrCreate({
            where: {
              sourceAnimeId: sourceAnime.id,
              targetAnimeId: targetAnime.id,
              relationType: rel.relationType,
            },
            defaults: {
              sourceAnimeId: sourceAnime.id,
              targetAnimeId: targetAnime.id,
              relationType: rel.relationType,
            },
          });
          
          if (created) results.relationsCreated++;
          else results.relationsExisting++;
        } catch (relError) {
          if (relError.name === "SequelizeUniqueConstraintError") {
            results.relationsExisting++;
          } else {
            console.error(`[Ingestion][Related] Error creating relation:`, relError.message);
            results.errors++;
          }
        }
      } catch (itemError) {
        console.error(`[Ingestion][Related] Error processing related item:`, itemError.message);
        results.errors++;
      }
    }

    // Mark this source anime as scanned
    await sourceAnime.update({ relationsCheckedAt: new Date() });
    results.processedSources = 1;
  } catch (sourceError) {
    console.error(`[Ingestion][Related] Error processing source "${sourceAnime.name}":`, sourceError.message);
    results.errors++;
    try {
      await sourceAnime.update({ relationsCheckedAt: new Date() });
    } catch (_) {}
  }
  
  return results;
};

/**
 * Imports related anime for the next batch of unscanned local anime.
 * Uses strict deduplication across the entire batch to ensure accurate metrics.
 */
exports.importRelated = async () => {
  const RELATED_IMPORT_BATCH_SIZE = 50;

  console.log(`[Ingestion] Starting Related Anime Import (batch: ${RELATED_IMPORT_BATCH_SIZE})...`);
  const totalResults = { 
    processedSources: 0, 
    uniqueRelatedAnimeFound: 0, 
    created: 0, 
    updated: 0, 
    unchanged: 0, 
    relationsCreated: 0, 
    relationsExisting: 0, 
    blocked: 0, 
    errors: 0 
  };
  let rawEdgesTotal = 0;

  // Find the next batch of anime that haven't been scanned yet
  const sourceAnimes = await Anime.findAll({
    where: {
      anilistId: { [Op.ne]: null },
    },
    order: [
      ["relationsCheckedAt", "ASC"], // NULLs first in MySQL
      ["createdAt", "ASC"],
    ],
    limit: RELATED_IMPORT_BATCH_SIZE,
  });

  if (sourceAnimes.length === 0) {
    console.log(`[Ingestion][Related] No anime with AniList IDs found.`);
    return totalResults;
  }

  console.log(`[Ingestion][Related] Processing ${sourceAnimes.length} source anime...`);

  const globalProcessedAnimeIds = new Set();

  for (const sourceAnime of sourceAnimes) {
    const res = await exports.syncRelationsForAnime(sourceAnime, globalProcessedAnimeIds);
    
    totalResults.processedSources += res.processedSources;
    totalResults.uniqueRelatedAnimeFound += res.uniqueRelatedAnimeFound;
    totalResults.created += res.created;
    totalResults.updated += res.updated;
    totalResults.unchanged += res.unchanged;
    totalResults.relationsCreated += res.relationsCreated;
    totalResults.relationsExisting += res.relationsExisting;
    totalResults.blocked += res.blocked;
    totalResults.errors += res.errors;
    rawEdgesTotal += (res.rawEdges || 0);

    // Delay between source anime to respect rate limits
    await sleep(1500);
  }

  console.log(`[Ingestion] Batch raw relation edges: ${rawEdgesTotal}`);
  console.log(`[Ingestion] Finished Related Import. Results:`, totalResults);
  return totalResults;
};
