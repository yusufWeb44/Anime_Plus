const ingestionService = require("../services/ingestionService");
const maintenanceService = require("../services/maintenanceService");

/**
 * Trigger Trending Anime Import
 */
exports.importTrending = async (req, res) => {
  try {
    const { count } = req.body;
    const results = await ingestionService.importTrending(count || 25);
    res.json({ message: "Trending import completed", results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Trigger Upcoming Anime Import
 */
exports.importUpcoming = async (req, res) => {
  try {
    const { count } = req.body;
    const results = await ingestionService.importUpcoming(count || 25);
    res.json({ message: "Upcoming import completed", results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Trigger Airing Anime Import
 */
exports.importAiring = async (req, res) => {
  try {
    const { count } = req.body;
    const results = await ingestionService.importAiring(count || 25);
    res.json({ message: "Airing import completed", results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Trigger Popular Movies Import
 */
exports.importMovies = async (req, res) => {
  try {
    const { count } = req.body;
    const results = await ingestionService.importMovies(count || 25);
    res.json({ message: "Movies import completed", results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Trigger Active Anime Metadata Refresh
 */
exports.refreshActive = async (req, res) => {
  try {
    const { batchSize } = req.body;
    const count = await maintenanceService.refreshActiveAnime(batchSize || 20);
    res.json({ message: "Active anime refresh completed", updated: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Trigger Global Metadata Refresh
 */
exports.refreshAll = async (req, res) => {
  try {
    const { batchSize } = req.body;
    const count = await maintenanceService.refreshMetadataAll(batchSize || 30);
    res.json({ message: "Global refresh completed", updated: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Trigger Series Metadata Refresh
 */
exports.refreshSeries = async (req, res) => {
  try {
    const { batchSize } = req.body;
    const count = await maintenanceService.refreshSeries(batchSize || 20);
    res.json({ message: "Series refresh completed", updated: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Trigger Movies Metadata Refresh
 */
exports.refreshMovies = async (req, res) => {
  try {
    const { batchSize } = req.body;
    const count = await maintenanceService.refreshMovies(batchSize || 20);
    res.json({ message: "Movies refresh completed", updated: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Trigger Upcoming Metadata Refresh
 */
exports.refreshUpcoming = async (req, res) => {
  try {
    const { batchSize } = req.body;
    const count = await maintenanceService.refreshUpcoming(batchSize || 20);
    res.json({ message: "Upcoming refresh completed", updated: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Trigger Airing Metadata Refresh
 */
exports.refreshAiring = async (req, res) => {
  try {
    const { batchSize } = req.body;
    const count = await maintenanceService.refreshAiring(batchSize || 20);
    res.json({ message: "Airing refresh completed", updated: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update Anime Status Manually
 */
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!["upcoming", "airing", "released"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value. Allowed: upcoming, airing, released" });
    }

    const { Anime } = require("../models");
    const anime = await Anime.findByPk(id);
    
    if (!anime) {
      return res.status(404).json({ error: "Anime not found" });
    }

    await anime.update({ status });
    res.json({ message: "Anime status updated successfully", status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Trigger Classic Anime Import (paginated, progress-persisted)
 */
exports.importClassics = async (req, res) => {
  try {
    const results = await ingestionService.importClassics();
    res.json({
      message: results.completed
        ? "All classic ranges fully imported. Use reset to restart."
        : "Classics import run completed — call again to continue.",
      results,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Reset Classic Import Progress (clears all pagination checkpoints)
 */
exports.resetClassicsProgress = async (req, res) => {
  try {
    const { ClassicImportProgress } = require("../models");
    const deleted = await ClassicImportProgress.destroy({ where: {} });
    res.json({ message: `Progress reset. ${deleted} range(s) cleared. Next import will start from page 1.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


/**
 * Trigger Related Anime Import
 */
exports.importRelated = async (req, res) => {
  try {
    const results = await ingestionService.importRelated();
    res.json({ message: "Related anime import completed", results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
