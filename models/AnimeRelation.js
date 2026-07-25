module.exports = (sequelize, DataTypes) => {
  const AnimeRelation = sequelize.define(
    "AnimeRelation",
    {
      sourceAnimeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Animes",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      targetAnimeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Animes",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      relationType: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "SEQUEL, PREQUEL, SIDE_STORY, SPIN_OFF, PARENT, ALTERNATIVE, etc.",
      },
    },
    {
      timestamps: true,
      indexes: [
        {
          fields: ["sourceAnimeId"],
        },
        {
          fields: ["targetAnimeId"],
        },
        {
          unique: true,
          fields: ["sourceAnimeId", "targetAnimeId", "relationType"],
          name: "unique_anime_relation",
        },
      ],
      validate: {
        noSelfRelation() {
          if (this.sourceAnimeId === this.targetAnimeId) {
            throw new Error("An anime cannot be related to itself.");
          }
        },
      },
    }
  );

  return AnimeRelation;
};
