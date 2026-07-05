module.exports = (sequelize, DataTypes) => {
  const UserAction = sequelize.define(
    "UserAction",
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      animeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      animeType: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      isFavorite: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      isWatchlist: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      watchlistStatus: {
        type: DataTypes.ENUM("watching", "plan_to_watch", "completed", "on_hold", "dropped"),
        allowNull: true,
      },

      rating: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["userId", "animeId", "animeType"],
        },
      ],
    }
  );

  return UserAction;
};