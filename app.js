require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const path = require("path");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const passport = require("passport");
const compression = require("compression");
require("./config/passport");

// Import from models (initializes DB and models)
const { sequelize } = require("./models");
const { DataTypes } = require("sequelize");

// Auto-migration: safely add missing columns on every startup
async function runMigrations() {
  try {
    await sequelize.authenticate();
    console.log("Database connected...");

    // Create any missing tables safely without altering existing ones
    await sequelize.sync({ alter: false });
    console.log("[Migration] Ensured all missing tables are created.");

    const qi = sequelize.getQueryInterface();
    // استخدام users بالحروف الصغيرة
    const tableDesc = await qi.describeTable("users");

    const columnsToAdd = [
      { name: "googleId",             def: { type: DataTypes.STRING,   allowNull: true } },
      { name: "coverImage",           def: { type: DataTypes.STRING,   allowNull: true, defaultValue: "../assets/default-cover.jpg" } },
      { name: "bio",                  def: { type: DataTypes.TEXT,     allowNull: true } },
      { name: "location",             def: { type: DataTypes.STRING,   allowNull: true } },
      { name: "birthDate",            def: { type: DataTypes.DATEONLY, allowNull: true } },
      { name: "resetPasswordToken",   def: { type: DataTypes.STRING,   allowNull: true } },
      { name: "resetPasswordExpires", def: { type: DataTypes.DATE,     allowNull: true } },
      // Email verification columns (added in auth refactor)
      { name: "isVerified",           def: { type: DataTypes.BOOLEAN,  allowNull: false, defaultValue: false } },
      { name: "verificationToken",    def: { type: DataTypes.STRING,   allowNull: true } },
    ];

    for (const col of columnsToAdd) {
      if (!tableDesc[col.name]) {
        await qi.addColumn("users", col.name, col.def);
        console.log(`[Migration] Added column: ${col.name}`);
      }
    }

    // Fix authProvider ENUM to include 'google' if missing
    try {
      await sequelize.query(
        "ALTER TABLE `users` MODIFY COLUMN `authProvider` ENUM('local','google') NOT NULL DEFAULT 'local'"
      );
      console.log("[Migration] Ensured authProvider ENUM includes 'google'.");
    } catch (enumErr) {
      console.warn("[Migration] authProvider ENUM update skipped:", enumErr.message);
    }

    // Add unique index on googleId if not exists
    try {
      await qi.addIndex("users", ["googleId"], { unique: true, name: "users_google_id" });
      console.log("[Migration] Added unique index on googleId");
    } catch (_) {
      // Index already exists, ignore
    }

    // Data fix: ensure all existing Google OAuth users are marked as verified
    try {
      const [rowsUpdated] = await sequelize.query(
        "UPDATE `users` SET `isVerified` = 1 WHERE `authProvider` = 'google' AND (`isVerified` = 0 OR `isVerified` IS NULL)"
      );
      if (rowsUpdated > 0) {
        console.log(`[Migration] Marked ${rowsUpdated} existing Google user(s) as verified.`);
      }
    } catch (dataFixErr) {
      console.warn("[Migration] Google user isVerified fix skipped:", dataFixErr.message);
    }

    console.log("[Migration] Done.");

    // طباعة عدد الأنمي للتحقق
    const [results] = await sequelize.query("SELECT COUNT(*) AS count FROM animes");
    console.log(">>> TOTAL ANIMES IN DB:", results[0].count);

  } catch (err) {
    console.error("[Migration Error]", err.message);
  }
}

runMigrations();

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

// --- Cache-Busting Middleware ---
// Applies globally. Dynamic API routes and HTML endpoints will inherit this.
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// --- Refactored Static Asset Caching ---
// 1. Long-term caching for immutable static assets (images, fonts, css, etc.)
const longTermCacheOptions = {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res, path) => {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }
};
app.use("/assets", express.static(path.join(__dirname, "assets"), longTermCacheOptions));
app.use("/css", express.static(path.join(__dirname, "css"), longTermCacheOptions));
if (require("fs").existsSync(path.join(__dirname, "public"))) {
  app.use("/public", express.static(path.join(__dirname, "public"), longTermCacheOptions));
}

// 2. No caching for HTML views and client-side JS controllers
const noCacheOptions = {
  maxAge: 0,
  setHeaders: (res, path) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
};
app.use("/views", express.static(path.join(__dirname, "views"), noCacheOptions));
app.use("/js", express.static(path.join(__dirname, "js"), noCacheOptions));

// 3. Explicit route for index.html to prevent serving the entire root directory
app.get("/index.html", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use(cookieParser());
app.use(passport.initialize());

// Import Routes
const authRoutes = require("./routes/authRoutes");
const animeRoutes = require("./routes/animeRoutes");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const newsRoutes = require("./routes/newsRoutes");
const contactRoutes = require("./routes/contactRoutes");

// Use Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api", animeRoutes);

app.get("/", (req, res) => {
  res.redirect("/views/home.html");
});

// Global Error Handler - catches any unhandled errors in routes/middleware
app.use((err, req, res, next) => {
  console.error("[Global Error Handler]", err.stack || err.message || err);
  const isDev = process.env.NODE_ENV !== "production";
  res.status(500).json({ error: "Internal server error", ...(isDev && { detail: err.message }) });
});

// Prevent unhandled promise rejections from crashing the server
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Unhandled Rejection]", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[Uncaught Exception]", err);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/views/home.html`);
});