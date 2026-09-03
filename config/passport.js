const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { User } = require("../models");

// Debug: confirm env var is loaded (no leading spaces, correct URL)
console.log("[Passport] Google Callback URL:", process.env.GOOGLE_CALLBACK_URL || "⚠️ NOT SET");

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
          // Return null user + false to trigger failureRedirect cleanly
          return done(null, false, { message: "no_email" });
        }

        const googleAvatar =
          profile.photos && profile.photos[0]
            ? profile.photos[0].value
            : null;

        // ── 1) Find by googleId (returning user) ──────────────────────────────
        let user = await User.findOne({ where: { googleId: profile.id } });
        if (user) {
          // Refresh avatar in case it changed, and ensure isVerified
          await user.update(
            { isVerified: true, avatar: user.avatar || googleAvatar },
            { validate: false }
          );
          return done(null, user);
        }

        // ── 2) Find by email (account linking) ────────────────────────────────
        user = await User.findOne({ where: { email } });
        if (user) {
          // Link Google to existing account; use update + { validate: false }
          // to avoid the Sequelize validator throwing on passwordHash = null
          const updates = {
            googleId: profile.id,
            isVerified: true,          // existing local users now verified too
          };
          if (!user.avatar && googleAvatar) updates.avatar = googleAvatar;

          await user.update(updates, { validate: false });
          return done(null, user);
        }

        // ── 3) Brand-new user via Google ─────────────────────────────────────
        let baseUsername = profile.displayName
          ? profile.displayName.replace(/\s+/g, "").toLowerCase()
          : email.split("@")[0];

        // Ensure username only contains safe characters
        baseUsername = baseUsername.replace(/[^a-z0-9_]/g, "").slice(0, 20) || "user";

        let uniqueUsername = baseUsername;
        let suffix = 1;
        while (await User.findOne({ where: { username: uniqueUsername } })) {
          uniqueUsername = `${baseUsername}${suffix}`;
          suffix++;
        }

        user = await User.create(
          {
            googleId: profile.id,
            username: uniqueUsername,
            email,
            authProvider: "google",
            avatar: googleAvatar,
            passwordHash: null,
            isVerified: true,
          },
          { validate: false }   // skip passwordHash length/pattern checks
        );

        return done(null, user);
      } catch (error) {
        console.error("[Passport Google Strategy ERROR]", error.message, error.stack);
        // Return false (not an Error) so Passport triggers failureRedirect
        // with a generic message instead of a raw 500.
        return done(null, false, { message: "server_error" });
      }
    }
  )
);

module.exports = passport;
