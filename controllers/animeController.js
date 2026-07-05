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

    if (
      (type === "series" && !(item.type === "series" && item.status === "released")) ||
      (type === "movies" && !(item.type === "movie" && item.status === "released")) ||
      (type === "coming" && item.status !== "upcoming") ||
      (type === "airing" && item.status !== "airing")
    ) {
      return res.status(400).json({
        error: "Type does not match anime category",
      });
    }

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
        limit: 16,
      }),
      Anime.findAll({
        where: {
          type: "movie",
          status: "released",
        },
        order: parseRatingOrder(),
        limit: 16,
      }),
      Anime.findAll({
        where: {
          status: "upcoming",
        },
        order: [["releaseDate", "ASC"]],
        limit: 16,
      }),
      Anime.findAll({
        where: {
          status: "airing",
        },
        order: parseRatingOrder(),
        limit: 16,
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
      limit: 12
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

exports.getRelatedAnime = async (req, res) => {
  const { id } = req.params;
  try {
    const currentAnime = await Anime.findByPk(id);
    if (!currentAnime) {
      return res.status(404).json({ error: "Anime not found" });
    }

    const allAnimes = await Anime.findAll({
      where: { id: { [Op.ne]: id } }
    });

    const nameA = currentAnime.name.toLowerCase().trim();
    const genresA = currentAnime.genres ? currentAnime.genres.toLowerCase() : "";

    function getBigrams(str) {
      let bigrams = new Set();
      for (let i = 0; i < str.length - 1; i++) {
        bigrams.add(str.slice(i, i + 2));
      }
      return bigrams;
    }
    const bgA = getBigrams(nameA);

    const scoredAnimes = allAnimes.map(anime => {
      const nameB = anime.name.toLowerCase().trim();
      const genresB = anime.genres ? anime.genres.toLowerCase() : "";
      
      let score = 0;

      let prefixMatch = false;
      const longer = nameA.length > nameB.length ? nameA : nameB;
      const shorter = nameA.length > nameB.length ? nameB : nameA;
      
      if (shorter.length >= 3 && longer.startsWith(shorter)) {
        const nextChar = longer[shorter.length];
        if (!nextChar || nextChar === ' ' || nextChar === ':' || nextChar === '-') {
          prefixMatch = true;
        }
      }

      const bgB = getBigrams(nameB);
      let intersection = 0;
      for (let bg of bgA) {
        if (bgB.has(bg)) intersection++;
      }
      const dice = (bgA.size + bgB.size) === 0 ? 0 : (2 * intersection) / (bgA.size + bgB.size);
      
      score += dice * 50; 
      
      if (prefixMatch) {
        score += 30; 
      }

      if (genresA && genresB) {
        const gA = genresA.split(',').map(g => g.trim()).filter(Boolean);
        const gB = genresB.split(',').map(g => g.trim()).filter(Boolean);
        let shared = 0;
        gA.forEach(g => {
          if (gB.includes(g)) shared++;
        });
        if (shared > 0) {
          score += (shared / Math.max(gA.length, gB.length)) * 20; 
        } else {
          score -= 40;
        }
      }

      if (nameA === nameB) score = 0;

      return { anime, score };
    });

    const validRelated = scoredAnimes.filter(x => x.score >= 40);
    validRelated.sort((a, b) => b.score - a.score);

    const related = validRelated.slice(0, 12).map(x => x.anime);

    const result = related.map(x => {
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

exports.getAnimeRecommendations = async (req, res) => {
  const { id } = req.params;
  try {
    const currentAnime = await Anime.findByPk(id);
    if (!currentAnime) {
      return res.status(404).json({ error: "Anime not found" });
    }

    const ignoredGenres = ["shounen", "shoujo", "seinen", "josei", "award winning"];
    let currentGenres = [];
    let conditions = [];

    if (currentAnime.genres) {
      currentGenres = currentAnime.genres.split(",").map(g => g.trim()).filter(Boolean);
      
      const meaningfulGenres = currentGenres.filter(g => !ignoredGenres.includes(g.toLowerCase()));
      
      // If we filtered out everything (unlikely), fallback to original
      const genresToUse = meaningfulGenres.length > 0 ? meaningfulGenres : currentGenres;

      conditions = genresToUse.map(g => ({
        genres: { [Op.like]: `%${g}%` }
      }));
    }

    if (conditions.length === 0) {
       conditions = [{ type: currentAnime.type }];
    }

    // Fetch up to 100 candidates that share at least one meaningful genre
    const candidates = await Anime.findAll({
      where: {
        [Op.or]: conditions,
        id: { [Op.ne]: id }
      },
      limit: 100
    });

    const nameA = currentAnime.name.toLowerCase().trim();
    function getBigrams(str) {
      let bigrams = new Set();
      for (let i = 0; i < str.length - 1; i++) {
        bigrams.add(str.slice(i, i + 2));
      }
      return bigrams;
    }
    const bgA = getBigrams(nameA);

    const isRelated = (nameB) => {
      nameB = nameB.toLowerCase().trim();
      if (nameA === nameB) return true;
      const longer = nameA.length > nameB.length ? nameA : nameB;
      const shorter = nameA.length > nameB.length ? nameB : nameA;
      if (shorter.length >= 3 && longer.startsWith(shorter)) {
        const nextChar = longer[shorter.length];
        if (!nextChar || nextChar === ' ' || nextChar === ':' || nextChar === '-') {
          return true;
        }
      }
      const bgB = getBigrams(nameB);
      let intersection = 0;
      for (let bg of bgA) {
        if (bgB.has(bg)) intersection++;
      }
      const dice = (bgA.size + bgB.size) === 0 ? 0 : (2 * intersection) / (bgA.size + bgB.size);
      if (dice > 0.5) return true;
      return false;
    };

    const filteredCandidates = candidates.filter(anime => !isRelated(anime.name));

    // Score candidates by how many genres overlap exactly
    const scoredCandidates = filteredCandidates.map(anime => {
      let score = 0;
      if (anime.genres) {
        const candidateGenres = anime.genres.split(",").map(g => g.trim().toLowerCase());
        const sourceGenres = currentGenres.map(g => g.toLowerCase());
        
        // Count overlaps
        candidateGenres.forEach(g => {
          if (sourceGenres.includes(g)) {
            // Give less weight to demographics, more to actual genres
            score += ignoredGenres.includes(g) ? 1 : 3;
          }
        });
      }
      return { anime, score };
    });

    // Sort by score descending, then shuffle the top ones slightly
    scoredCandidates.sort((a, b) => b.score - a.score);
    
    // Take top 20, shuffle them to add variety, then take 12
    let topCandidates = scoredCandidates.slice(0, 20).map(x => x.anime);
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
