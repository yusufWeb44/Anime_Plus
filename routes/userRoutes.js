const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const requireAuth = require("../middleware/requireAuth");
const upload = require("../middleware/upload");

// All user routes require authentication
router.use(requireAuth);

router.post("/favorites/add", userController.addFavorite);
router.delete("/favorites/remove", userController.removeFavorite);
router.get("/favorites", userController.getFavorites);

router.post("/watchlist/add", userController.addWatchlist);
router.delete("/watchlist/remove", userController.removeWatchlist);
router.get("/watchlist", userController.getWatchlist);

router.post("/rating", userController.updateRating);
router.get("/actions/:animeType/:animeId", userController.getActions);
router.get("/recommendations", userController.getRecommendations);

// Profile
router.get("/profile", userController.getProfile);
router.put(
  "/profile",
  (req, res, next) => {
    upload.fields([{ name: "avatar", maxCount: 1 }, { name: "coverImage", maxCount: 1 }])(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  userController.updateProfile
);

module.exports = router;
