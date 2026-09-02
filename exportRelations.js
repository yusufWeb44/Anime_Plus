require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { AnimeRelation, sequelize } = require('./models');

async function exportRelations() {
  try {
    console.log("⏳ Connecting to the local database...");
    await sequelize.authenticate();
    console.log("✅ Connected successfully.");
    
    console.log("⏳ Fetching AnimeRelations data...");
    const relations = await AnimeRelation.findAll({ raw: true });
    
    console.log(`✅ Found ${relations.length} records. Saving to JSON...`);
    const outputPath = path.join(__dirname, 'anime_relations.json');
    fs.writeFileSync(outputPath, JSON.stringify(relations, null, 2), 'utf8');
    
    console.log(`🎉 Successfully exported all relations to: ${outputPath}`);
  } catch (err) {
    console.error("❌ Error exporting relations:", err);
  } finally {
    await sequelize.close();
  }
}

exportRelations();
