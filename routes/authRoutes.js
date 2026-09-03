const express = require("express");
const passport = require("passport");
const router = express.Router();
const authController = require("../controllers/authController");
const { authLimiter } = require("../middleware/rateLimiter");
const requireAuth = require("../middleware/requireAuth");

// Local Auth
router.post("/register", authLimiter, authController.register);
router.post("/login", authLimiter, authController.login);
router.post("/logout", authController.logout);
router.post("/refresh", authController.refresh);
router.get("/me", requireAuth, authController.getMe);
router.post("/revoke-all", requireAuth, authController.revokeAll);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.get("/verify-email", authController.verifyEmail);

// Google OAuth - use a custom callback so we can forward the failure reason
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false, prompt: "select_account" }));

router.get("/google/callback", (req, res, next) => {
  passport.authenticate("google", { session: false }, (err, user, info) => {
    if (err) {
      console.error("[Google OAuth] Unexpected error:", err.message);
      return res.redirect("/views/home.html?error=oauth_error");
    }
    if (!user) {
      const msg = info && info.message === "no_email" ? "oauth_no_email" : "oauth_failed";
      return res.redirect(`/views/home.html?error=${msg}`);
    }
    req.user = user;
    next();
  })(req, res, next);
}, authController.googleCallback);

module.exports = router;
