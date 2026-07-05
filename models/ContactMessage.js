module.exports = (sequelize, DataTypes) => {
  const ContactMessage = sequelize.define(
    "ContactMessage",
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isEmail: true,
        },
      },
      subject: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("unread", "read", "replied"),
        allowNull: false,
        defaultValue: "unread",
      },
    },
    {
      timestamps: true,
    }
  );

  return ContactMessage;
};
