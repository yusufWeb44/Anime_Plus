require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const path = require("path");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const passport = require("passport");
require("./config/passport");

// Import from models (initializes DB and models)
const { sequelize } = require("./models");
const { DataTypes } = require("sequelize");

// Auto-migration: safely add missing columns on every startup
async function runMigrations() {
  try {
    await sequelize.authenticate();
    console.log("Database connected...");

    // Create any missing tables (e.g., RefreshTokens) safely without altering existing ones
    await sequelize.sync({ alter: false });
    console.log("[Migration] Ensured all missing tables are created.");

    const qi = sequelize.getQueryInterface();
    const tableDesc = await qi.describeTable("Users");

    const columnsToAdd = [
      { name: "googleId",              def: { type: DataTypes.STRING,  allowNull: true } },
      { name: "coverImage",            def: { type: DataTypes.STRING,  allowNull: true, defaultValue: "../assets/default-cover.jpg" } },
      { name: "bio",                   def: { type: DataTypes.TEXT,    allowNull: true } },
      { name: "location",              def: { type: DataTypes.STRING,  allowNull: true } },
      { name: "birthDate",             def: { type: DataTypes.DATEONLY, allowNull: true } },
      { name: "resetPasswordToken",    def: { type: DataTypes.STRING,  allowNull: true } },
      { name: "resetPasswordExpires",  def: { type: DataTypes.DATE,    allowNull: true } },
    ];

    for (const col of columnsToAdd) {
      if (!tableDesc[col.name]) {
        await qi.addColumn("Users", col.name, col.def);
        console.log(`[Migration] Added column: ${col.name}`);
      }
    }

    // Fix authProvider ENUM to include 'google' if missing
    try {
      await sequelize.query(
        "ALTER TABLE `Users` MODIFY COLUMN `authProvider` ENUM('local','google') NOT NULL DEFAULT 'local'"
      );
      console.log("[Migration] Ensured authProvider ENUM includes 'google'.");
    } catch (enumErr) {
      console.warn("[Migration] authProvider ENUM update skipped:", enumErr.message);
    }

    // Add unique index on googleId if not exists
    try {
      await qi.addIndex("Users", ["googleId"], { unique: true, name: "users_google_id" });
      console.log("[Migration] Added unique index on googleId");
    } catch (_) {
      // Index already exists, ignore
    }

    console.log("[Migration] Done.");
  } catch (err) {
    console.error("[Migration Error]", err.message);
  }
}

runMigrations();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(express.static(path.join(__dirname, ".")));

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