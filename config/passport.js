const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { User, Op, sequelize } = require("../models");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      proxy: true,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        
        if (!email) {
          return done(new Error("No email associated with this Google account."));
        }

        // Try to find user by googleId
        let user = await User.findOne({ where: { googleId: profile.id } });

        if (user) {
          return done(null, user);
        }

        // If not found by googleId, check if email exists (Account Linking)
        user = await User.findOne({ 
          where: { email: sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), email.toLowerCase()) } 
        });

        if (user) {
          // Explicitly link the googleId to the existing account
          user.googleId = profile.id;
          // We don't overwrite authProvider if they were 'local' to preserve their password usage,
          // but they can now login via Google too.
          await user.save();
          return done(null, user);
        }

        // Create new user
        // Generate a username from the email if not provided by Google nicely
        let baseUsername = profile.displayName ? profile.displayName.replace(/\s+/g, "").toLowerCase() : email.split("@")[0];
        
        // Ensure username is unique
        let uniqueUsername = baseUsername;
        let suffix = 1;
        while (await User.findOne({ where: { username: uniqueUsername } })) {
          uniqueUsername = `${baseUsername}${suffix}`;
          suffix++;
        }

        user = await User.create({
          googleId: profile.id,
          username: uniqueUsername,
          email,
          authProvider: "google",
          avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : "../assets/default-avatar.png",
          passwordHash: null, // OAuth users have no password
        });

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

module.exports = passport;
