const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const contactController = require("../controllers/contactController");

// Anti-spam rate limiter for contact form submissions
// Allows 5 requests per 15 minutes per IP
const contactRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, 
  message: { error: "Too many requests from this IP, please try again after 15 minutes." },
  standardHeaders: true, 
  legacyHeaders: false, 
});

// POST /api/contact
router.post("/", contactRateLimiter, contactController.submitContactForm);

module.exports = router;
