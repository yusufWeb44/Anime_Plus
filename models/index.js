const { Sequelize, DataTypes, Op } = require("sequelize");

require("dotenv").config();

const sequelize = new Sequelize(
  process.env.DB_NAME || "anime_plus", 
  process.env.DB_USER || "root", 
  process.env.DB_PASSWORD || "", 
  {
    host: process.env.DB_HOST || "localhost",
    dialect: "mysql",
    logging: false,
  }
);

const Anime = require("./Anime")(sequelize, DataTypes);
const User = require("./User")(sequelize, DataTypes);
const UserAction = require("./UserAction")(sequelize, DataTypes);
const UserList = require("./UserList")(sequelize, DataTypes);
const UserListItem = require("./UserListItem")(sequelize, DataTypes);
const RefreshToken = require("./RefreshToken")(sequelize, DataTypes);
const ContactMessage = require("./ContactMessage")(sequelize, DataTypes);
const AnimeRelation = require("./AnimeRelation")(sequelize, DataTypes);
const ClassicImportProgress = require("./ClassicImportProgress")(sequelize, DataTypes);

// User -> UserAction
User.hasMany(UserAction, {
  foreignKey: "userId",
  onDelete: "CASCADE",
});
UserAction.belongsTo(User, {
  foreignKey: "userId",
});

// User -> RefreshToken
User.hasMany(RefreshToken, {
  foreignKey: "userId",
  onDelete: "CASCADE",
});
RefreshToken.belongsTo(User, {
  foreignKey: "userId",
});

// User -> UserList
User.hasMany(UserList, {
  foreignKey: "userId",
  onDelete: "CASCADE",
});
UserList.belongsTo(User, {
  foreignKey: "userId",
});

// UserList -> UserListItem
UserList.hasMany(UserListItem, {
  foreignKey: "listId",
  onDelete: "CASCADE",
});
UserListItem.belongsTo(UserList, {
  foreignKey: "listId",
});

// UserAction -> Anime
UserAction.belongsTo(Anime, {
  foreignKey: "animeId",
});
Anime.hasMany(UserAction, {
  foreignKey: "animeId",
});

// Anime -> AnimeRelation (source)
Anime.hasMany(AnimeRelation, {
  foreignKey: "sourceAnimeId",
  as: "relationsAsSource",
  onDelete: "CASCADE",
});
AnimeRelation.belongsTo(Anime, {
  foreignKey: "sourceAnimeId",
  as: "sourceAnime",
});

// Anime -> AnimeRelation (target)
Anime.hasMany(AnimeRelation, {
  foreignKey: "targetAnimeId",
  as: "relationsAsTarget",
  onDelete: "CASCADE",
});
AnimeRelation.belongsTo(Anime, {
  foreignKey: "targetAnimeId",
  as: "targetAnime",
});

module.exports = {
  sequelize,
  Anime,
  User,
  UserAction,
  UserList,
  UserListItem,
  RefreshToken,
  ContactMessage,
  AnimeRelation,
  ClassicImportProgress,
  Op
};
