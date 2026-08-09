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
router.post("/import/classics", adminController.importClassics);
router.post("/import/classics/reset", adminController.resetClassicsProgress);
router.post("/import/related", adminController.importRelated);

// Maintenance Routes
router.post("/maintenance/refresh-active", adminController.refreshActive);
router.post("/maintenance/refresh-all", adminController.refreshAll);
router.get("/maintenance/refresh-all/status", adminController.getRefreshAllStatus);
router.post("/maintenance/refresh-series", adminController.refreshSeries);
router.post("/maintenance/refresh-movies", adminController.refreshMovies);
router.post("/maintenance/refresh-upcoming", adminController.refreshUpcoming);
router.post("/maintenance/refresh-airing", adminController.refreshAiring);

// Manual update Routes
router.patch("/anime/:id/status", adminController.updateStatus);

// Fill Missing Trailers Routes
router.post("/maintenance/fill-trailers", adminController.fillMissingTrailers);
router.post("/maintenance/fill-trailers/stop", adminController.stopFillMissingTrailers);
router.get("/maintenance/fill-trailers/status", adminController.getFillTrailersStatus);

module.exports = router;
