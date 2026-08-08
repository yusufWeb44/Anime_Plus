const { UserAction, Anime, User } = require("../models");

// Helpers
async function findOrCreateAction(userId, animeId, animeType) {
  let [action] = await UserAction.findOrCreate({
    where: { userId, animeId, animeType },
    defaults: {
      userId,
      animeId,
      animeType,
      isFavorite: false,
      isWatchlist: false,
      rating: null,
    },
  });
  return action;
}

// ----------------------
// FAVORITES
// ----------------------
exports.addFavorite = async (req, res) => {
  try {
    const { animeId, animeType } = req.body;
    if (!animeId || !animeType) return res.status(400).json({ error: "animeId and animeType required" });

    const action = await findOrCreateAction(req.userId, animeId, animeType);
    action.isFavorite = true;
    await action.save();

    res.json({ message: "Added to favorites", action });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.removeFavorite = async (req, res) => {
  try {
    const { animeId, animeType } = req.body;
    if (!animeId || !animeType) return res.status(400).json({ error: "animeId and animeType required" });

    const action = await UserAction.findOne({
      where: { userId: req.userId, animeId, animeType },
    });

    if (action) {
      action.isFavorite = false;
      await action.save();
    }

    res.json({ message: "Removed from favorites", action });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getFavorites = async (req, res) => {
  try {
    const actions = await UserAction.findAll({
      where: { userId: req.userId, isFavorite: true },
      include: [{ model: Anime }],
    });

    // Map to just return the anime details for easy frontend usage
    const animes = actions.map(act => act.Anime);
    res.json(animes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// WATCHLIST (My List)
// ----------------------
exports.addWatchlist = async (req, res) => {
  try {
    const { animeId, animeType, status } = req.body;
    if (!animeId || !animeType) return res.status(400).json({ error: "animeId and animeType required" });

    const validStatuses = new Set(["watching", "plan_to_watch", "completed", "on_hold", "dropped"]);
    const chosenStatus = status && validStatuses.has(status) ? status : "plan_to_watch";

    const action = await findOrCreateAction(req.userId, animeId, animeType);
    action.isWatchlist = true;
    action.watchlistStatus = chosenStatus;
    await action.save();

    res.json({ message: `Added to list: ${chosenStatus}`, action });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.removeWatchlist = async (req, res) => {
  try {
    const { animeId, animeType } = req.body;
    if (!animeId || !animeType) return res.status(400).json({ error: "animeId and animeType required" });

    const action = await UserAction.findOne({
      where: { userId: req.userId, animeId, animeType },
    });

    if (action) {
      action.isWatchlist = false;
      action.watchlistStatus = null;
      await action.save();
    }

    res.json({ message: "Removed from watchlist", action });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getWatchlist = async (req, res) => {
  try {
    const { status } = req.query;
    const whereClause = { userId: req.userId, isWatchlist: true };
    if (status) {
      whereClause.watchlistStatus = status;
    }

    const actions = await UserAction.findAll({
      where: whereClause,
      include: [{ model: Anime }],
    });

    const animes = actions.map(act => {
      if (!act.Anime) return null;
      const animeJSON = act.Anime.toJSON();
      animeJSON.watchlistStatus = act.watchlistStatus;
      return animeJSON;
    }).filter(Boolean);

    res.json(animes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// RATING
// ----------------------
exports.updateRating = async (req, res) => {
  try {
    const { animeId, animeType, rating } = req.body;
    if (!animeId || !animeType || rating === undefined) {
      return res.status(400).json({ error: "animeId, animeType, and rating required" });
    }

    const action = await findOrCreateAction(req.userId, animeId, animeType);
    action.rating = Number(rating);
    await action.save();

    res.json({ message: "Rating updated", action });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// GET USER ACTIONS (Details view)
// ----------------------
exports.getActions = async (req, res) => {
  try {
    const { animeId, animeType } = req.params;
    if (!animeId || !animeType) return res.status(400).json({ error: "animeId and animeType required" });

    const action = await UserAction.findOne({
      where: { userId: req.userId, animeId, animeType },
    });

    res.json({ action: action || { isFavorite: false, isWatchlist: false, rating: null } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// USER PROFILE
// ----------------------
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, {
      attributes: { exclude: ['passwordHash'] }
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const { bio, location, birthDate } = req.body;

    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (birthDate !== undefined) user.birthDate = birthDate || null; // Handle empty date string

    if (req.files) {
      if (req.files.avatar && req.files.avatar.length > 0) {
        user.avatar = "/public/uploads/avatars/" + req.files.avatar[0].filename;
      }
      if (req.files.coverImage && req.files.coverImage.length > 0) {
        user.coverImage = "/public/uploads/covers/" + req.files.coverImage[0].filename;
      }
    }

    await user.save();

    const updatedUser = user.toJSON();
    delete updatedUser.passwordHash;
    res.json({ message: "Profile updated successfully", user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// RECOMMENDATIONS
// ----------------------
exports.getRecommendations = async (req, res) => {
  try {
    const { Op } = require("sequelize");

    // 1. Get all anime the user has interacted with (favorites or watchlist)
    const userActions = await UserAction.findAll({
      where: {
        userId: req.userId,
        [Op.or]: [{ isFavorite: true }, { isWatchlist: true }],
      },
      include: [{ model: Anime }],
    });

    if (!userActions.length) {
      return res.json({ recommendations: [], message: "Add anime to your favorites or watchlist to get personalized recommendations!" });
    }

    // 2. Extract genre frequencies from the user's anime
    const genreCount = {};
    const interactedIds = new Set();

    for (const action of userActions) {
      if (!action.Anime) continue;
      interactedIds.add(action.Anime.id);

      const genres = action.Anime.genres;
      if (!genres) continue;

      const genreList = genres.split(",").map(g => g.trim()).filter(Boolean);
      // Favorites count double weight
      const weight = action.isFavorite ? 2 : 1;
      for (const genre of genreList) {
        genreCount[genre] = (genreCount[genre] || 0) + weight;
      }
    }

    // 3. Sort genres by frequency to find top preferences
    const topGenres = Object.entries(genreCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre]) => genre);

    if (!topGenres.length) {
      return res.json({ recommendations: [], message: "Not enough genre data to generate recommendations." });
    }

    // 4. Find anime that match these genres but user hasn't interacted with
    const allCandidates = await Anime.findAll({
      where: {
        id: { [Op.notIn]: [...interactedIds] },
      },
      order: [["popularity", "DESC"]],
    });

    // 5. Score each candidate by how many top genres it matches
    const scored = allCandidates
      .map(anime => {
        const item = anime.toJSON();
        const animeGenres = (item.genres || "").split(",").map(g => g.trim()).filter(Boolean);
        let score = 0;
        for (const genre of animeGenres) {
          const idx = topGenres.indexOf(genre);
          if (idx !== -1) {
            score += (topGenres.length - idx); // higher rank = more points
          }
        }
        // Determine display type
        let type = "series";
        if (item.status === "upcoming") type = "coming";
        else if (item.status === "airing") type = "airing";
        else if (item.type === "movie") type = "movies";

        return { ...item, type, _score: score };
      })
      .filter(a => a._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 100) // take top 100 matches
      .sort(() => 0.5 - Math.random()) // shuffle for variety
      .slice(0, 40); // return 40

    // Remove internal score from response
    const recommendations = scored.map(({ _score, ...rest }) => rest);

    res.json({
      recommendations,
      topGenres,
      message: recommendations.length
        ? `Based on your love for ${topGenres.slice(0, 3).join(", ")}`
        : "We couldn't find new recommendations. Try adding more anime to your list!",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
