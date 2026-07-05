module.exports = (sequelize, DataTypes) => {
  const Anime = sequelize.define(
    "Anime",
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      src: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      category: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      rating: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "0.0",
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      studio: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      year: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      // series | movie
      type: {
        type: DataTypes.ENUM("series", "movie"),
        allowNull: false,
        defaultValue: "series",
      },

      // upcoming | airing | released
      status: {
        type: DataTypes.ENUM("upcoming", "airing", "released"),
        allowNull: false,
        defaultValue: "released",
      },

      releaseDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },

      anilistId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        unique: true,
      },

      bannerImage: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      genres: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Comma-separated genres",
      },

      format: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "TV, MOVIE, OVA, etc.",
      },

      season: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "WINTER, SPRING, SUMMER, FALL",
      },

      episodes: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      popularity: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      trailer: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "YouTube trailer link",
      },

      homeFeatured: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      homeOrder: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      lastSuccessfulRefreshAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      timestamps: true,
    }
  );

  return Anime;
};