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

// Google OAuth
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false, prompt: "select_account" }));

router.get("/google/callback", passport.authenticate("google", { session: false, failureRedirect: "/views/home.html?error=oauth_failed" }), authController.googleCallback);

module.exports = router;
