/**
 * Migration script: Add missing columns to Users table
 * Run this ONCE on the production database to add Google OAuth columns.
 *
 * Usage: node migrate.js
 */

require("dotenv").config();
const { sequelize } = require("./models");
const { QueryInterface, DataTypes } = require("sequelize");

const qi = sequelize.getQueryInterface();

async function migrate() {
  console.log("Starting migration...");

  try {
    await sequelize.authenticate();
    console.log("✅ Database connected.");

    const tableDesc = await qi.describeTable("Users");
    console.log("Current columns:", Object.keys(tableDesc).join(", "));

    // Add googleId column if not exists
    if (!tableDesc.googleId) {
      await qi.addColumn("Users", "googleId", {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      });
      console.log("✅ Added column: googleId");
    } else {
      console.log("⏭️  Column already exists: googleId");
    }

    // Add coverImage column if not exists
    if (!tableDesc.coverImage) {
      await qi.addColumn("Users", "coverImage", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "../assets/default-cover.jpg",
      });
      console.log("✅ Added column: coverImage");
    } else {
      console.log("⏭️  Column already exists: coverImage");
    }

    // Add bio column if not exists
    if (!tableDesc.bio) {
      await qi.addColumn("Users", "bio", {
        type: DataTypes.TEXT,
        allowNull: true,
      });
      console.log("✅ Added column: bio");
    } else {
      console.log("⏭️  Column already exists: bio");
    }

    // Add location column if not exists
    if (!tableDesc.location) {
      await qi.addColumn("Users", "location", {
        type: DataTypes.STRING,
        allowNull: true,
      });
      console.log("✅ Added column: location");
    } else {
      console.log("⏭️  Column already exists: location");
    }

    // Add birthDate column if not exists
    if (!tableDesc.birthDate) {
      await qi.addColumn("Users", "birthDate", {
        type: DataTypes.DATEONLY,
        allowNull: true,
      });
      console.log("✅ Added column: birthDate");
    } else {
      console.log("⏭️  Column already exists: birthDate");
    }

    // Add resetPasswordToken column if not exists
    if (!tableDesc.resetPasswordToken) {
      await qi.addColumn("Users", "resetPasswordToken", {
        type: DataTypes.STRING,
        allowNull: true,
      });
      console.log("✅ Added column: resetPasswordToken");
    } else {
      console.log("⏭️  Column already exists: resetPasswordToken");
    }

    // Add resetPasswordExpires column if not exists
    if (!tableDesc.resetPasswordExpires) {
      await qi.addColumn("Users", "resetPasswordExpires", {
        type: DataTypes.DATE,
        allowNull: true,
      });
      console.log("✅ Added column: resetPasswordExpires");
    } else {
      console.log("⏭️  Column already exists: resetPasswordExpires");
    }

    console.log("\n✅ Migration completed successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    console.error(err.stack);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

migrate();
