const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { User, RefreshToken, Op } = require("../models");

const generateTokens = (userId, role) => {
  const accessToken = jwt.sign(
    { userId, role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m" }
  );

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
  );

  return { accessToken, refreshToken };
};

const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const saveRefreshToken = async (userId, refreshToken) => {
  const expiryDate = new Date();
  // Decode JWT to get exact expiry if needed, or just add 7 days
  expiryDate.setDate(expiryDate.getDate() + 7);

  const hashedToken = hashToken(refreshToken);

  await RefreshToken.create({
    token: hashedToken,
    userId,
    expiryDate,
  });
};

const setRefreshTokenCookie = (res, refreshToken) => {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

// Register
exports.register = async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: "Please fill in all the required fields." });
    }

    // Basic email validation regex before hitting the database (Only allow @gmail.com)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Only valid @gmail.com email addresses are allowed for registration." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "The passwords you entered do not match." });
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        error: "Password must be at least 8 characters, with 1 uppercase letter and 1 number.",
      });
    }

    const existingUserByEmail = await User.findOne({ where: { email } });
    if (existingUserByEmail) {
      return res.status(400).json({ error: "This email address is already registered. Please login instead." });
    }

    const existingUserByUsername = await User.findOne({ where: { username } });
    if (existingUserByUsername) {
      return res.status(400).json({ error: "This username is already taken. Please choose another one." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      passwordHash,
      authProvider: "local",
    });

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    await saveRefreshToken(user.id, refreshToken);
    setRefreshTokenCookie(res, refreshToken);

    return res.json({
      message: "Registration successful.",
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        authProvider: user.authProvider,
      },
    });
  } catch (err) {
    if (err.name === "SequelizeValidationError") {
      return res.status(400).json({ error: "Invalid email format." });
    }
    return res.status(500).json({ error: err.message });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Please enter your email and password." });
    }

    const user = await User.findOne({ where: { email } });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    if (!user.passwordHash) {
      return res.status(401).json({
        error: "This account was created via Google. Please use 'Sign in with Google' or set a password via 'Forgot password'."
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    await saveRefreshToken(user.id, refreshToken);
    setRefreshTokenCookie(res, refreshToken);

    return res.json({
      message: "Login successful.",
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        authProvider: user.authProvider,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Google OAuth Callback
exports.googleCallback = async (req, res) => {
  try {
    const user = req.user; // Provided by passport

    if (!user) {
      return res.redirect("/views/home.html?error=oauth_failed");
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    await saveRefreshToken(user.id, refreshToken);
    setRefreshTokenCookie(res, refreshToken);

    // Redirect to frontend with the token in the URL.
    // The frontend will grab it, save it, and clean the URL.
    return res.redirect(`/views/home.html?token=${accessToken}`);
  } catch (err) {
    console.error("Google OAuth Callback Error:", err);
    return res.redirect("/views/home.html?error=oauth_error");
  }
};

// Refresh
exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token is missing." });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      const hashedToken = hashToken(refreshToken);
      await RefreshToken.destroy({ where: { token: hashedToken } });
      res.clearCookie("refreshToken");
      return res.status(401).json({ error: "Refresh token is invalid or expired." });
    }

    const hashedToken = hashToken(refreshToken);
    const dbToken = await RefreshToken.findOne({ where: { token: hashedToken } });

    if (!dbToken) {
      await RefreshToken.destroy({ where: { userId: decoded.userId } }); // Revoke all
      res.clearCookie("refreshToken");
      return res.status(401).json({ error: "Invalid refresh token. Potential reuse detected." });
    }

    const user = await User.findByPk(decoded.userId);
    if (!user || !user.isActive) {
      await dbToken.destroy();
      res.clearCookie("refreshToken");
      return res.status(401).json({ error: "User not found or inactive." });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id, user.role);

    await dbToken.destroy(); // Rotate token
    await saveRefreshToken(user.id, newRefreshToken);
    setRefreshTokenCookie(res, newRefreshToken);

    return res.json({ accessToken });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Logout
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    if (refreshToken) {
      const hashedToken = hashToken(refreshToken);
      await RefreshToken.destroy({ where: { token: hashedToken } });
    }

    res.clearCookie("refreshToken");
    return res.json({ message: "Logout successful." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to logout." });
  }
};

// Revoke All
exports.revokeAll = async (req, res) => {
  try {
    const userId = req.userId;
    await RefreshToken.destroy({ where: { userId } });
    res.clearCookie("refreshToken");
    return res.json({ message: "Logged out from all devices successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to revoke tokens." });
  }
};

// Current User (Me)
exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, {
      attributes: ["id", "username", "email", "role", "avatar", "authProvider"],
    });

    if (!user) {
      return res.json({ user: null });
    }

    return res.json({ user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const emailService = require("../services/emailService");

// Forgot Password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      // Return same message to prevent email enumeration
      return res.json({ message: "If an account with that email exists, we have sent a reset link." });
    }

    // Allow Google users to set a password if they want to login normally as well.
    // Removed the block that prevented authProvider === 'google' from resetting password.

    // Generate Token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 3600000); // 1 hour

    user.resetPasswordToken = token;
    user.resetPasswordExpires = expires;
    await user.save();

    // Reset Link
    const host = req.get("host");
    // Force HTTP on local dev environments to avoid SSL/HTTPS protocol mismatches
    const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : req.protocol;
    const resetUrl = `${protocol}://${host}/views/reset-password.html?token=${token}`;

    // Print the reset URL to the console so the admin can copy it from Render logs
    // since Render Free tier blocks outbound SMTP ports (587).
    console.log("\n=======================================================");
    console.log(`🔑 PASSWORD RESET LINK FOR ${user.email}:`);
    console.log(resetUrl);
    console.log("=======================================================\n");

    // Send Email
    try {
      await emailService.sendResetPasswordEmail(user.email, user.username, resetUrl);
    } catch (mailErr) {
      console.warn("⚠️ Email sending failed:", mailErr.message);
      return res.status(500).json({ 
        error: "Failed to send reset email. Please ensure email service is properly configured." 
      });
    }

    return res.json({ message: "If an account with that email exists, we have sent a reset link." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
      return res.status(400).json({ error: "All fields are required." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        error: "Password must be at least 8 characters, with 1 uppercase letter and 1 number.",
      });
    }

    const user = await User.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          [Op.gt]: new Date(),
        },
      },
    });

    if (!user) {
      return res.status(400).json({ error: "Password reset token is invalid or has expired." });
    }

    // Update password
    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    // Revoke all refresh tokens
    await RefreshToken.destroy({ where: { userId: user.id } });

    return res.json({ message: "Password reset successful. You can now login with your new password." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
