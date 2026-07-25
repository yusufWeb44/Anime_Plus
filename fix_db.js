const { sequelize } = require("./models");

async function fixDB() {
  try {
    console.log("Adding relationsCheckedAt column to Animes table...");
    await sequelize.query(
      "ALTER TABLE Animes ADD COLUMN relationsCheckedAt DATETIME DEFAULT NULL COMMENT 'Timestamp of last relations scan for batch tracking';"
    );
    console.log("Column added successfully!");
  } catch (error) {
    if (error.message.includes("Duplicate column name")) {
      console.log("Column already exists.");
    } else {
      console.error("Error adding column:", error.message);
    }
  }

  // Also manually sync AnimeRelation to ensure it exists
  try {
    const { AnimeRelation } = require("./models");
    await AnimeRelation.sync();
    console.log("AnimeRelation table synced successfully!");
  } catch (err) {
    console.error("Error syncing AnimeRelation:", err.message);
  }

  process.exit(0);
}

fixDB();
