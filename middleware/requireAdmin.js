const requireAuth = require("./requireAuth");

/**
 * Ensures the user is logged in AND has an 'admin' role.
 */
const requireAdmin = (req, res, next) => {
  requireAuth(req, res, () => {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin role required." });
    }
    next();
  });
};

module.exports = requireAdmin;
