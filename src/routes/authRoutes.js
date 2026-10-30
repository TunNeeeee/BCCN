const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const env = require("../config/env");
const {
  findUserByUsername,
  createUser,
  updatePasswordByRowIndex,
} = require("../repositories/userRepository");
const { requireAuth } = require("../middleware/authMiddleware");
const { addToken, hasToken, removeToken } = require("../services/tokenStore");

const router = express.Router();

function createAccessToken(user) {
  return jwt.sign(
    {
      stt: user.stt,
      username: user.username,
      fullName: user.fullName,
      position: user.position,
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

function createRefreshToken(user) {
  return jwt.sign(
    {
      username: user.username,
      tokenType: "refresh",
    },
    env.refreshSecret,
    { expiresIn: env.refreshExpiresIn }
  );
}

async function isPasswordMatched(inputPassword, storedPassword) {
  if (!storedPassword) {
    return false;
  }

  if (storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$") || storedPassword.startsWith("$2y$")) {
    return bcrypt.compare(inputPassword, storedPassword);
  }

  return inputPassword === storedPassword;
}

router.post("/register", async (req, res) => {
  try {
    const { fullName, position, username, password, role, hashPassword } = req.body;

    if (!fullName || !position || !username || !password) {
      return res.status(400).json({ message: "fullName, position, username, password are required" });
    }

    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const finalPassword = hashPassword ? await bcrypt.hash(password, 10) : password;
    const user = await createUser({
      fullName,
      position,
      username,
      password: finalPassword,
      role,
    });

    return res.status(201).json({
      message: "Register successful",
      user: {
        stt: user.stt,
        fullName: user.fullName,
        position: user.position,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Register failed",
      error: error.message,
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    const user = await findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordMatched = await isPasswordMatched(password, user.password);
    if (!passwordMatched) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);
    addToken(refreshToken);

    return res.json({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: {
        stt: user.stt,
        username: user.username,
        fullName: user.fullName,
        position: user.position,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Login failed",
      error: error.message,
    });
  }
});

router.post("/refresh-token", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: "refreshToken is required" });
    }

    if (!hasToken(refreshToken)) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const payload = jwt.verify(refreshToken, env.refreshSecret);
    if (payload.tokenType !== "refresh") {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const user = await findUserByUsername(payload.username);
    if (!user) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    removeToken(refreshToken);
    const newRefreshToken = createRefreshToken(user);
    addToken(newRefreshToken);

    const accessToken = createAccessToken(user);

    return res.json({
      message: "Token refreshed",
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired refresh token",
      error: error.message,
    });
  }
});

router.post("/logout", (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    removeToken(refreshToken);
  }

  return res.json({ message: "Logout successful" });
});

router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword, hashPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "oldPassword and newPassword are required" });
    }

    const user = await findUserByUsername(req.user.username);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const oldMatched = await isPasswordMatched(oldPassword, user.password);
    if (!oldMatched) {
      return res.status(401).json({ message: "Old password is incorrect" });
    }

    const finalPassword = hashPassword ? await bcrypt.hash(newPassword, 10) : newPassword;
    await updatePasswordByRowIndex(user.rowIndex, finalPassword);

    return res.json({ message: "Password changed successfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Change password failed",
      error: error.message,
    });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { username, fullName, hashPassword } = req.body;

    if (!username || !fullName) {
      return res.status(400).json({ message: "username and fullName are required" });
    }

    const user = await findUserByUsername(username);
    if (!user || user.fullName.trim().toLowerCase() !== String(fullName).trim().toLowerCase()) {
      return res.status(404).json({ message: "User information not matched" });
    }

    const temporaryPassword = crypto.randomBytes(4).toString("hex");
    const finalPassword = hashPassword ? await bcrypt.hash(temporaryPassword, 10) : temporaryPassword;

    await updatePasswordByRowIndex(user.rowIndex, finalPassword);

    return res.json({
      message: "Temporary password has been reset",
      temporaryPassword,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Forgot password failed",
      error: error.message,
    });
  }
});

router.get("/me", requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

module.exports = router;
