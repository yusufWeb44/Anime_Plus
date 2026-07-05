module.exports = (sequelize, DataTypes) => {
  const RefreshToken = sequelize.define(
    "RefreshToken",
    {
      token: {
        type: DataTypes.STRING(500),
        allowNull: false,
        unique: true,
      },
      expiryDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      timestamps: true,
    }
  );

  return RefreshToken;
};
