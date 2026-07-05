module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },

      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },

      passwordHash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      
      googleId: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },

      authProvider: {
        type: DataTypes.ENUM("local", "google"),
        allowNull: false,
        defaultValue: "local",
      },

      avatar: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "../assets/default-avatar.png",
      },

      coverImage: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "../assets/default-cover.jpg",
      },

      bio: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      location: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      birthDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },

      role: {
        type: DataTypes.ENUM("user", "admin"),
        allowNull: false,
        defaultValue: "user",
      },

      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      resetPasswordToken: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      resetPasswordExpires: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      timestamps: true,
    }
  );

  return User;
};