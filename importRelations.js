require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

async function importRelations() {
  console.log("⏳ Reading anime_relations.json...");
  const filePath = path.join(__dirname, 'anime_relations.json');
  if (!fs.existsSync(filePath)) {
    console.error("❌ Error: anime_relations.json not found!");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  console.log(`✅ Loaded ${data.length} relations from JSON.`);

  console.log("⏳ Connecting to Render Database...");
  // Connect using env variables. Make sure your .env has the Render DB credentials!
  const sequelize = new Sequelize(
    process.env.DB_NAME, 
    process.env.DB_USER, 
    process.env.DB_PASSWORD, 
    {
      host: process.env.DB_HOST,
      dialect: "mysql", // Change to postgres if Render DB is PostgreSQL
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    }
  );

  try {
    await sequelize.authenticate();
    console.log("✅ Connected to Render Database successfully.");

    // Initialize the AnimeRelation model
    const AnimeRelation = require('./models/AnimeRelation')(sequelize, DataTypes);

    const BATCH_SIZE = 500;
    let totalProcessed = 0;

    console.log("🚀 Starting Bulk Insert...");
    
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      
      // Remove 'id', 'createdAt', and 'updatedAt' to avoid conflicts
      const cleanedBatch = batch.map(rel => {
        const { id, createdAt, updatedAt, ...rest } = rel;
        return rest;
      });

      // ignoreDuplicates: true generates INSERT IGNORE in MySQL
      await AnimeRelation.bulkCreate(cleanedBatch, {
        ignoreDuplicates: true, 
        logging: false
      });

      totalProcessed += batch.length;
      console.log(`✅ Progress: Imported ${totalProcessed} / ${data.length} relations...`);
    }

    console.log("🎉 Successfully completed the import process to Render Database!");

  } catch (err) {
    console.error("❌ Error importing relations:", err.message);
  } finally {
    await sequelize.close();
  }
}

importRelations();
