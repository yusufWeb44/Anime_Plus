module.exports = (sequelize, DataTypes) => {
  const UserList = sequelize.define(
    "UserList",
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["userId", "name"], // User cannot have two lists with the same name
        },
      ],
    }
  );

  return UserList;
};
