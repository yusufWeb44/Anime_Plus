/**
 * ClassicImportProgress
 *
 * Tracks pagination progress for each classic year range so that
 * each importClassics() execution continues from where it left off
 * instead of re-fetching the same first page of results.
 */
module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    "ClassicImportProgress",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      // e.g. "1990-1995", "1985-1989"
      rangeKey: {
        type: DataTypes.STRING(32),
        allowNull: false,
        unique: true,
      },
      // The next page number to fetch on the following run
      nextPage: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        allowNull: false,
      },
      // true when AniList has no more pages for this range
      completed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
    },
    {
      tableName: "classic_import_progress",
      timestamps: true,
      updatedAt: "updatedAt",
      createdAt: "createdAt",
    }
  );
