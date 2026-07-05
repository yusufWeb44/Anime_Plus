const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const requireAdmin = require("../middleware/requireAdmin");

// All routes here require Admin role
router.use(requireAdmin);

// Ingestion Routes
router.post("/import/trending", adminController.importTrending);
router.post("/import/upcoming", adminController.importUpcoming);
router.post("/import/airing", adminController.importAiring);
router.post("/import/movies", adminController.importMovies);

// Maintenance Routes
router.post("/maintenance/refresh-active", adminController.refreshActive);
router.post("/maintenance/refresh-all", adminController.refreshAll);
router.post("/maintenance/refresh-series", adminController.refreshSeries);
router.post("/maintenance/refresh-movies", adminController.refreshMovies);
router.post("/maintenance/refresh-upcoming", adminController.refreshUpcoming);
router.post("/maintenance/refresh-airing", adminController.refreshAiring);

// Manual update Routes
router.patch("/anime/:id/status", adminController.updateStatus);

module.exports = router;
