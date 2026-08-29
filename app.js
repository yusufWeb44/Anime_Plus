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

sequelize
  .authenticate()
  .then(() => console.log("Database connected..."))
  .catch((err) => console.log("Error: " + err));

// Sync tables manually if needed, disabled auto-alter to fix "Too many keys" error
/*sequelize
  .sync({ alter: false })
  .then(() => console.log("Tables synced..."))
  .catch((err) => console.log("Sync Error: ", err));*/

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
  res.status(500).json({ error: "Internal server error" });
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