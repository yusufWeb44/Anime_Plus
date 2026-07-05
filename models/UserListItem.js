module.exports = (sequelize, DataTypes) => {
  const UserListItem = sequelize.define(
    "UserListItem",
    {
      listId: {
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
    },
    {
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["listId", "animeId", "animeType"], // Prevents duplicate anime in same list
        },
      ],
    }
  );

  return UserListItem;
};
