const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { User } = require("../models");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email =
          profile.emails && profile.emails[0]
            ? profile.emails[0].value
            : null;

        if (!email) {
          return done(new Error("No email associated with this Google account."));
        }

        // 1) Try to find user by googleId
        let user = await User.findOne({ where: { googleId: profile.id } });
        if (user) {
          return done(null, user);
        }

        // 2) Check if email already exists (account linking)
        user = await User.findOne({ where: { email } });
        if (user) {
          // Link the Google account to existing user
          user.googleId = profile.id;
          if (!user.avatar && profile.photos && profile.photos[0]) {
            user.avatar = profile.photos[0].value;
          }
          await user.save();
          return done(null, user);
        }

        // 3) Create new user - generate a unique username
        let baseUsername = profile.displayName
          ? profile.displayName.replace(/\s+/g, "").toLowerCase()
          : email.split("@")[0];

        let uniqueUsername = baseUsername;
        let suffix = 1;
        while (await User.findOne({ where: { username: uniqueUsername } })) {
          uniqueUsername = `${baseUsername}${suffix}`;
          suffix++;
        }

        const avatar =
          profile.photos && profile.photos[0]
            ? profile.photos[0].value
            : null;

        user = await User.create({
          googleId: profile.id,
          username: uniqueUsername,
          email,
          authProvider: "google",
          avatar,
          passwordHash: null,
          isVerified: true,
        });

        return done(null, user);
      } catch (error) {
        // Log the full error so we can see it in Render logs
        console.error("[Passport Google Strategy ERROR]", error.message, error.stack);
        return done(error, null);
      }
    }
  )
);

module.exports = passport;
