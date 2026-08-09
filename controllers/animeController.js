const { Anime, Op, sequelize } = require("../models");

function parseRatingOrder() {
  return [[sequelize.literal("CAST(rating AS DECIMAL(10,2))"), "DESC"]];
}

exports.getSeries = async (req, res) => {
  try {
    const series = await Anime.findAll({
      where: {
        type: "series",
        status: "released",
      },
      order: sequelize.random(),
    });
    res.json(series.map((x) => x.toJSON()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAiring = async (req, res) => {
  try {
    const airing = await Anime.findAll({
      where: {
        status: "airing",
      },
      order: sequelize.random(),
    });
    res.json(airing.map((x) => ({ ...x.toJSON(), type: "airing" })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMovies = async (req, res) => {
  try {
    const movies = await Anime.findAll({
      where: {
        type: "movie",
        status: "released",
      },
      order: sequelize.random(),
    });
    res.json(movies.map((x) => x.toJSON()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getComing = async (req, res) => {
  try {
    const coming = await Anime.findAll({
      where: {
        status: "upcoming",
      },
      order: [
        ["releaseDate", "ASC"],
        ["createdAt", "DESC"],
      ],
    });
    res.json(
      coming.map((x) => ({
        ...x.toJSON(),
        type: x.type === "movie" ? "movies" : "coming",
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDetails = async (req, res) => {
  const { type, id } = req.params;

  try {
    const anime = await Anime.findByPk(id);
    if (!anime) {
      return res.status(404).json({ error: "Anime not found" });
    }

    const item = anime.toJSON();

    let returnedType = "series";
    if (item.status === "upcoming") {
      returnedType = "coming";
    } else if (item.status === "airing") {
      returnedType = "airing";
    } else if (item.type === "movie") {
      returnedType = "movies";
    }

    // Removed strict type validation so items in MyList that change status do not throw errors
    // Instead we just return the dynamically computed `returnedType`

    res.json({
      ...item,
      type: returnedType,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getHomeFeatured = async (req, res) => {
  try {
    const featured = await Anime.findAll({
      where: { homeFeatured: true },
      order: [["homeOrder", "ASC"]],
    });

    const result = featured.map((x) => {
      const item = x.toJSON();
      let type = "series";
      if (item.status === "upcoming") type = "coming";
      else if (item.status === "airing") type = "airing";
      else if (item.type === "movie") type = "movies";

      return {
        ...item,
        type,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTopRated = async (req, res) => {
  try {
    const [series, movies, coming, airing] = await Promise.all([
      Anime.findAll({
        where: {
          type: "series",
          status: "released",
        },
        order: parseRatingOrder(),
        limit: 48,
      }),
      Anime.findAll({
        where: {
          type: "movie",
          status: "released",
        },
        order: parseRatingOrder(),
        limit: 48,
      }),
      Anime.findAll({
        where: {
          status: "upcoming",
        },
        order: [["releaseDate", "ASC"]],
        limit: 48,
      }),
      Anime.findAll({
        where: {
          status: "airing",
        },
        order: parseRatingOrder(),
        limit: 48,
      }),
    ]);

    res.json({
      series: series.map((x) => ({ ...x.toJSON(), type: "series" })),
      movies: movies.map((x) => ({ ...x.toJSON(), type: "movies" })),
      coming: coming.map((x) => ({ ...x.toJSON(), type: "coming" })),
      airing: airing.map((x) => ({ ...x.toJSON(), type: "airing" })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAnimeByMood = async (req, res) => {
  try {
    const { Op } = require("sequelize");
    const { Anime } = require("../models");
    const mood = (req.query.m || req.params.mood || "").trim().toLowerCase();

    if (!mood) {
      return res.status(400).json({ error: "Mood parameter is required" });
    }

    const moodMap = {
      exciting: ["Action", "Adventure", "Thriller", "Sports"],
      funny: ["Comedy", "Parody"],
      emotional: ["Drama", "Psychological", "Tragedy"],
      relaxing: ["Slice of Life", "Fantasy", "Iyashikei"],
      spooky: ["Horror", "Mystery", "Supernatural"],
      romantic: ["Romance"],
      mind_bending: ["Sci-Fi", "Psychological", "Mecha"],
      dark: ["Dark Fantasy", "Psychological", "Action", "Seinen"],
      cozy: ["Slice of Life", "Iyashikei", "Family", "Light Comedy"],
      inspirational: ["Sports", "Adventure", "Drama", "Shounen"]
    };

    const targetGenres = moodMap[mood];
    if (!targetGenres) {
      return res.status(400).json({ error: "Invalid mood" });
    }

    const conditions = targetGenres.map(g => ({
      genres: { [Op.like]: `%${g}%` }
    }));

    const animes = await Anime.findAll({
      where: {
        [Op.or]: conditions
      },
      order: require('sequelize').literal('RAND()'), // MySQL specific
      limit: 48
    });

    const result = animes.map(x => {
      const item = x.toJSON();
      let type = "series";
      if (item.status === "upcoming") type = "coming";
      else if (item.status === "airing") type = "airing";
      else if (item.type === "movie") type = "movies";
      return { ...item, type };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Helper to find all IDs belonging to the same franchise safely.
// Uses STRICT unidirectional BFS to prevent crossover bridges
// (e.g., festival specials that link two unrelated franchises).
const getFranchiseIds = async (Anime, AnimeRelation, Op, currentAnime) => {
  const visitedIds = new Set([currentAnime.id]);
  const queue = [currentAnime.id];
  const relationTypesMap = {};

  // DIRECTIONAL: these expand "outward" from the current anime (source → target)
  const FORWARD_ONLY = ['SEQUEL', 'PREQUEL', 'PARENT', 'SIDE_STORY', 'SPIN_OFF', 'ALTERNATIVE', 'COMPILATION', 'CONTAINS', 'SUMMARY'];
  // BIDIRECTIONAL: safe to traverse both ways
  const BIDIRECTIONAL = ['ADAPTATION', 'FRANCHISE'];

  while (queue.length > 0) {
    const currentBatch = [...queue];
    queue.length = 0;

    // 1. Forward edges (source = current batch → target)
    const forwardEdges = await AnimeRelation.findAll({
      where: {
        sourceAnimeId: { [Op.in]: currentBatch },
        relationType: { [Op.in]: FORWARD_ONLY }
      }
    });
    for (const edge of forwardEdges) {
      if (!visitedIds.has(edge.targetAnimeId)) {
        visitedIds.add(edge.targetAnimeId);
        queue.push(edge.targetAnimeId);
        if (!relationTypesMap[edge.targetAnimeId]) relationTypesMap[edge.targetAnimeId] = edge.relationType;
      }
    }

    // 2. Reverse edges (target = current batch ← source) for FORWARD types
    //    This allows finding "parent" when we started from a child
    const reverseEdges = await AnimeRelation.findAll({
      where: {
        targetAnimeId: { [Op.in]: currentBatch },
        relationType: { [Op.in]: FORWARD_ONLY }
      }
    });
    for (const edge of reverseEdges) {
      if (!visitedIds.has(edge.sourceAnimeId)) {
        // GUARD: Only accept if the source name is actually related to the root anime
        visitedIds.add(edge.sourceAnimeId);
        queue.push(edge.sourceAnimeId);
        if (!relationTypesMap[edge.sourceAnimeId]) relationTypesMap[edge.sourceAnimeId] = edge.relationType;
      }
    }

    // 3. Bidirectional (ADAPTATION, FRANCHISE) - follow both directions
    const biEdges = await AnimeRelation.findAll({
      where: {
        [Op.or]: [
          { sourceAnimeId: { [Op.in]: currentBatch } },
          { targetAnimeId: { [Op.in]: currentBatch } }
        ],
        relationType: { [Op.in]: BIDIRECTIONAL }
      }
    });
    for (const edge of biEdges) {
      if (!visitedIds.has(edge.targetAnimeId)) {
        visitedIds.add(edge.targetAnimeId);
        queue.push(edge.targetAnimeId);
        if (!relationTypesMap[edge.targetAnimeId]) relationTypesMap[edge.targetAnimeId] = edge.relationType;
      }
      if (!visitedIds.has(edge.sourceAnimeId)) {
        visitedIds.add(edge.sourceAnimeId);
        queue.push(edge.sourceAnimeId);
        if (!relationTypesMap[edge.sourceAnimeId]) relationTypesMap[edge.sourceAnimeId] = edge.relationType;
      }
    }
  }

  // Post-filter: remove any IDs whose anime name has NO word overlap with the current anime's name
  // This is the final guard against crossover bridges
  const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'from', 'movie', 'special', 'episode', 'chapter', 'part', 'season', 'ova', 'ona']);
  const getSignificantWords = (name) => {
    return new Set(
      name.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !STOP_WORDS.has(w))
    );
  };

  const rootWords = getSignificantWords(currentAnime.name);

  const allVisited = Array.from(visitedIds);
  allVisited.shift(); // remove the current anime itself (already added)

  const safeIds = [];
  if (allVisited.length > 0) {
    const candidates = await Anime.findAll({
      where: { id: { [Op.in]: allVisited } },
      attributes: ['id', 'name']
    });

    for (const c of candidates) {
      const cWords = getSignificantWords(c.name);
      // Check if there is at least 1 significant word in common
      const intersection = [...rootWords].filter(w => cWords.has(w));
      if (intersection.length > 0) {
        safeIds.push(c.id);
      } else {
        delete relationTypesMap[c.id];
      }
    }
  }

  // Always include current anime id in the franchise set
  const finalIds = [currentAnime.id, ...safeIds];
  return { franchiseIds: finalIds, relationTypesMap };
};


exports.getRelatedAnime = async (req, res) => {
  const { id } = req.params;
  try {
    const { Anime, AnimeRelation, Op } = require("../models");

    const currentAnime = await Anime.findByPk(id);
    if (!currentAnime) {
      return res.status(404).json({ error: "Anime not found" });
    }

    // --- JIT Relation Fetching ---
    // If we haven't checked relations for this anime yet, fetch them on-demand!
    if (!currentAnime.relationsCheckedAt && currentAnime.anilistId) {
      try {
        const ingestionService = require("../services/ingestionService");
        await ingestionService.syncRelationsForAnime(currentAnime, new Set());
        // The DB now has the edges, getFranchiseIds will find them!
      } catch (err) {
        console.error(`[JIT] Error fetching relations for ${currentAnime.name}:`, err.message);
      }
    }

    const { franchiseIds, relationTypesMap } = await getFranchiseIds(Anime, AnimeRelation, Op, currentAnime);

    // Remove the current anime itself from the related display
    const relatedIds = franchiseIds.filter(fId => fId !== currentAnime.id);

    if (relatedIds.length === 0) {
      return res.json([]);
    }

    const relatedAnimesRaw = await Anime.findAll({
      where: { id: { [Op.in]: relatedIds } }
    });

    const relatedAnimes = relatedAnimesRaw.map(item => {
      const itemJSON = item.toJSON();
      let type = "series";
      if (itemJSON.status === "upcoming") type = "coming";
      else if (itemJSON.status === "airing") type = "airing";
      else if (itemJSON.type === "movie") type = "movies";

      return {
        ...itemJSON,
        type: type,
        relationType: relationTypesMap[item.id] || "OTHER"
      };
    });

    // Sort chronologically 
    relatedAnimes.sort((a, b) => {
      const dateA = a.releaseDate ? new Date(a.releaseDate) : new Date("1970-01-01");
      const dateB = b.releaseDate ? new Date(b.releaseDate) : new Date("1970-01-01");
      return dateA - dateB;
    });

    res.json(relatedAnimes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAnimeRecommendations = async (req, res) => {
  const { id } = req.params;
  try {
    const { Anime, AnimeRelation, Op } = require("../models");

    const currentAnime = await Anime.findByPk(id);
    if (!currentAnime) {
      return res.status(404).json({ error: "Anime not found" });
    }

    // --- JIT Relation Fetching ---
    // Ensure relations are fetched so we accurately exclude the entire franchise
    if (!currentAnime.relationsCheckedAt && currentAnime.anilistId) {
      try {
        const ingestionService = require("../services/ingestionService");
        await ingestionService.syncRelationsForAnime(currentAnime, new Set());
      } catch (err) {
        console.error(`[JIT] Error fetching relations for ${currentAnime.name}:`, err.message);
      }
    }

    // 1. Get all IDs that belong to the SAME franchise to exclude them
    const { franchiseIds } = await getFranchiseIds(Anime, AnimeRelation, Op, currentAnime);

    const ignoredGenres = ["shounen", "shoujo", "seinen", "josei", "award winning"];
    let currentGenres = [];
    let conditions = [];

    if (currentAnime.genres) {
      currentGenres = currentAnime.genres.split(",").map(g => g.trim()).filter(Boolean);
      const meaningfulGenres = currentGenres.filter(g => !ignoredGenres.includes(g.toLowerCase()));
      const genresToUse = meaningfulGenres.length > 0 ? meaningfulGenres : currentGenres;

      conditions = genresToUse.map(g => ({
        genres: { [Op.like]: `%${g}%` }
      }));
    }

    if (conditions.length === 0) {
      conditions = [{ type: currentAnime.type }];
    }

    // 2. Fetch candidates excluding ANY part of the same franchise
    const candidates = await Anime.findAll({
      where: {
        [Op.or]: conditions,
        id: { [Op.notIn]: franchiseIds }
      },
      limit: 100
    });

    // Score candidates by how many genres overlap exactly
    const scoredCandidates = candidates.map(anime => {
      let score = 0;
      if (anime.genres) {
        const candidateGenres = anime.genres.split(",").map(g => g.trim().toLowerCase());
        const sourceGenres = currentGenres.map(g => g.toLowerCase());

        candidateGenres.forEach(g => {
          if (sourceGenres.includes(g)) {
            score += ignoredGenres.includes(g) ? 1 : 3;
          }
        });
      }
      return { anime, score };
    });

    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Take top 50, shuffle them to add variety, then take 12
    let topCandidates = scoredCandidates.slice(0, 50).map(x => x.anime);
    topCandidates.sort(() => 0.5 - Math.random());
    const recommendations = topCandidates.slice(0, 12);

    const result = recommendations.map(x => {
      const item = x.toJSON();
      let type = "series";
      if (item.status === "upcoming") type = "coming";
      else if (item.status === "airing") type = "airing";
      else if (item.type === "movie") type = "movies";
      return { ...item, type };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
