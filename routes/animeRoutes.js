const express = require("express");
const router = express.Router();
const animeController = require("../controllers/animeController");

router.get("/series", animeController.getSeries);
router.get("/movies", animeController.getMovies);
router.get("/coming", animeController.getComing);
router.get("/airing", animeController.getAiring);
router.get("/anime/mood", animeController.getAnimeByMood);
router.get("/anime/mood/:mood", animeController.getAnimeByMood);
router.get("/anime/:type/:id", animeController.getDetails);
router.get("/home-featured", animeController.getHomeFeatured);
router.get("/top-rated", animeController.getTopRated);
router.get("/anime/:type/:id/related", animeController.getRelatedAnime);
router.get("/anime/:type/:id/recommendations", animeController.getAnimeRecommendations);

module.exports = router;
