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
 * Imports classic anime with persistent pagination progress.
 * Each execution resumes from where the previous one left off.
 * Progress is stored in the ClassicImportProgress table.
 */
exports.importClassics = async () => {
  // ── Configuration ──────────────────────────────────────────────────────────
  const CLASSICS_PAGES_PER_RUN = 3;  // pages to process per range per run
  const CLASSICS_PER_PAGE      = 50; // AniList max is 50

  // All supported year ranges, from newest classic to oldest
  const YEAR_RANGES = [
    { startYear: 2011, endYear: 2012, key: "2011-2012" },
    { startYear: 2009, endYear: 2010, key: "2009-2010" },
    { startYear: 2007, endYear: 2008, key: "2007-2008" },
    { startYear: 2005, endYear: 2006, key: "2005-2006" },
    { startYear: 2001, endYear: 2004, key: "2001-2004" },
    { startYear: 1996, endYear: 2000, key: "1996-2000" },
    { startYear: 1990, endYear: 1995, key: "1990-1995" },
    { startYear: 1985, endYear: 1989, key: "1985-1989" },
    { startYear: 1980, endYear: 1984, key: "1980-1984" },
    { startYear: 1975, endYear: 1979, key: "1975-1979" },
    { startYear: 1970, endYear: 1974, key: "1970-1974" },
    { startYear: 1900, endYear: 1969, key: "1900-1969" },
  ];

  const { ClassicImportProgress } = require("../models");

  console.log(`[Ingestion] Starting Classics Import (${CLASSICS_PAGES_PER_RUN} pages/range per run)...`);

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

  let allRangesCompleted = true;

  for (const range of YEAR_RANGES) {
    // Load or create progress record for this range
    let [progress] = await ClassicImportProgress.findOrCreate({
      where: { rangeKey: range.key },
      defaults: { rangeKey: range.key, nextPage: 1, completed: false },
    });

    // Skip already-exhausted ranges
    if (progress.completed) {
      console.log(`[Ingestion][Classics] Range ${range.key} already completed — skipping.`);
      continue;
    }

    allRangesCompleted = false;
    totals.rangesProcessed++;

    let currentPage = progress.nextPage;
    let pagesThisRun = 0;

    while (pagesThisRun < CLASSICS_PAGES_PER_RUN) {
      try {
        const result = await anilistService.getClassicsPage(
          range.startYear,
          range.endYear,
          currentPage,
          CLASSICS_PER_PAGE
        );

        totals.pagesFetched++;
        pagesThisRun++;
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
          // No more pages for this range
          console.log(`[Ingestion][Classics] Range ${range.key} exhausted at page ${currentPage}.`);
          await progress.update({ nextPage: currentPage + 1, completed: true });
          break;
        }

        currentPage++;
        await progress.update({ nextPage: currentPage });

        // Respect AniList rate limits between pages
        await sleep(1500);

      } catch (error) {
        console.error(`[Ingestion][Classics] Error on range ${range.key} page ${currentPage}:`, error.message);
        totals.errors++;
        break;
      }
    }

    // Respect rate limits between ranges
    await sleep(1500);
  }

  // Check if ALL ranges are now completed
  const incomplete = await ClassicImportProgress.count({ where: { completed: false } });
  if (incomplete === 0 && YEAR_RANGES.length > 0) {
    // Check if all our ranges have a row
    const total = await ClassicImportProgress.count();
    if (total >= YEAR_RANGES.length) {
      totals.completed = true;
      console.log(`[Ingestion][Classics] All ranges exhausted. Full classic library imported!`);
    }
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
