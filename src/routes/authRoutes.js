const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const env = require("../config/env");
const {
  findUserByUsername,
  findUserByStt,
  listUserAccounts,
  createUser,
  updateUserByRowIndex,
  clearUserByRowIndex,
  updatePasswordByRowIndex,
  updateAvatarByRowIndex,
  findAvatarByRowIndex,
} = require("../repositories/userRepository");
const { requireAuth, requireAnyRole } = require("../middleware/authMiddleware");
const { addToken, hasToken, removeToken } = require("../services/tokenStore");

const router = express.Router();
const PASSWORD_SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;
const MAX_AVATAR_DATA_URL_LENGTH = 40000;
const MANAGED_ROLES = [
  { value: "Chuyen Vien Thu Tuc", label: "Chuyên viên thủ tục" },
  { value: "Kiem Soat", label: "Chuyên viên kiểm soát" },
  { value: "Giam Doc", label: "Giám Đốc" },
];
const ACCOUNT_MANAGER_ROLES = ["Giam Doc", "Admin"];

function canonicalRole(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getManagedRole(value) {
  return MANAGED_ROLES.find((role) => canonicalRole(role.value) === canonicalRole(value));
}

function getManagedUser(user) {
  return {
    stt: user.stt,
    fullName: user.fullName.trim(),
    position: user.position.trim(),
    username: user.username,
    role: user.role,
    rowIndex: user.rowIndex,
  };
}

function isDirector(user) {
  return canonicalRole(user?.role) === canonicalRole("Giam Doc");
}

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

  if (/^\$2[aby]\$\d{2}\$/.test(storedPassword)) {
    return bcrypt.compare(inputPassword, storedPassword);
  }

  return inputPassword === storedPassword;
}

function getPublicUser(user, avatar = "") {
  return {
    stt: user.stt,
    username: user.username,
    fullName: user.fullName,
    position: user.position,
    role: user.role,
    avatar,
  };
}

function getPasswordValidationMessage(password, label = "Password") {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `${label} must contain at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    return `${label} must not exceed ${MAX_PASSWORD_BYTES} UTF-8 bytes`;
  }
  return "";
}

function isValidAvatarDataUrl(avatar) {
  if (
    typeof avatar !== "string" ||
    avatar.length > MAX_AVATAR_DATA_URL_LENGTH
  ) {
    return false;
  }

  const match = avatar.match(
    /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/
  );
  if (!match) {
    return false;
  }

  const [, imageType, encodedImage] = match;
  const image = Buffer.from(encodedImage, "base64");
  if (image.toString("base64") !== encodedImage) {
    return false;
  }

  if (imageType === "jpeg") {
    return image.length >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
  }
  if (imageType === "png") {
    return image.length >= 8 && image.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
  }
  return (
    image.length >= 12 &&
    image.toString("ascii", 0, 4) === "RIFF" &&
    image.toString("ascii", 8, 12) === "WEBP"
  );
}

router.get("/users", requireAuth, requireAnyRole(ACCOUNT_MANAGER_ROLES), async (_req, res) => {
  try {
    const users = await listUserAccounts();
    return res.json({ users: users.map(getManagedUser) });
  } catch (error) {
    return res.status(500).json({
      message: "Cannot load employee accounts",
      error: error.message,
    });
  }
});

router.post("/users", requireAuth, requireAnyRole(ACCOUNT_MANAGER_ROLES), async (req, res) => {
  try {
    const fullName = String(req.body?.fullName || "").trim();
    const position = String(req.body?.position || "").trim();
    const username = String(req.body?.username || "").trim().toLowerCase();
    const selectedRole = getManagedRole(req.body?.role);
    if (!fullName || fullName.length > 200 || !position || position.length > 100) {
      return res.status(400).json({
        message: "Full name (max 200) and position (max 100) are required",
      });
    }
    if (!/^[a-zA-Z0-9._-]{3,50}$/.test(username)) {
      return res.status(400).json({
        message: "Username must be 3-50 characters using letters, numbers, dot, underscore or hyphen",
      });
    }
    if (!selectedRole) {
      return res.status(400).json({ message: "Select a valid employee role" });
    }
    if (await findUserByUsername(username)) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const temporaryPassword = crypto.randomBytes(12).toString("hex");
    const hashedPassword = await bcrypt.hash(temporaryPassword, PASSWORD_SALT_ROUNDS);
    const user = await createUser({
      fullName,
      position,
      username,
      password: hashedPassword,
      role: selectedRole.value,
    });

    return res.status(201).json({
      message: "Employee account created. Share the temporary password securely.",
      user: getManagedUser(user),
      temporaryPassword,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Cannot create employee account",
      error: error.message,
    });
  }
});

router.put("/users/:stt", requireAuth, requireAnyRole(ACCOUNT_MANAGER_ROLES), async (req, res) => {
  try {
    const user = await findUserByStt(req.params.stt);
    if (!user) {
      return res.status(404).json({ message: "Employee account not found" });
    }
    if (user.stt === req.user.stt) {
      return res.status(400).json({
        message: "Use the personal profile page to update your own information",
      });
    }

    const fullName = String(req.body?.fullName || "").trim();
    const position = String(req.body?.position || "").trim();
    const username = String(req.body?.username || "").trim().toLowerCase();
    const selectedRole = getManagedRole(req.body?.role);
    if (!fullName || fullName.length > 200 || !position || position.length > 100) {
      return res.status(400).json({
        message: "Full name (max 200) and position (max 100) are required",
      });
    }
    if (!/^[a-zA-Z0-9._-]{3,50}$/.test(username)) {
      return res.status(400).json({
        message: "Username must be 3-50 characters using letters, numbers, dot, underscore or hyphen",
      });
    }
    if (!selectedRole) {
      return res.status(400).json({ message: "Select a valid employee role" });
    }
    const conflictingUser = await findUserByUsername(username);
    if (conflictingUser && conflictingUser.stt !== user.stt) {
      return res.status(409).json({ message: "Username already exists" });
    }
    if (
      isDirector(user) &&
      !isDirector({ role: selectedRole.value }) &&
      (await listUserAccounts()).filter(isDirector).length <= 1
    ) {
      return res.status(409).json({ message: "At least one director account must remain" });
    }

    await updateUserByRowIndex(user.rowIndex, {
      fullName,
      position,
      username,
      role: selectedRole.value,
    });
    return res.json({
      message: "Employee account updated",
      user: {
        ...getManagedUser(user),
        fullName,
        position,
        username,
        role: selectedRole.value,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Cannot update employee account",
      error: error.message,
    });
  }
});

router.post(
  "/users/:stt/reset-password",
  requireAuth,
  requireAnyRole(ACCOUNT_MANAGER_ROLES),
  async (req, res) => {
    try {
      const user = await findUserByStt(req.params.stt);
      if (!user) {
        return res.status(404).json({ message: "Employee account not found" });
      }
      if (user.stt === req.user.stt) {
        return res.status(400).json({
          message: "Use the personal profile page to change your own password",
        });
      }

      const temporaryPassword = crypto.randomBytes(12).toString("hex");
      const hashedPassword = await bcrypt.hash(temporaryPassword, PASSWORD_SALT_ROUNDS);
      await updatePasswordByRowIndex(user.rowIndex, hashedPassword);
      return res.json({
        message: "Password reset. Share the temporary password securely.",
        temporaryPassword,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Cannot reset employee password",
        error: error.message,
      });
    }
  }
);

router.delete("/users/:stt", requireAuth, requireAnyRole(ACCOUNT_MANAGER_ROLES), async (req, res) => {
  try {
    const user = await findUserByStt(req.params.stt);
    if (!user) {
      return res.status(404).json({ message: "Employee account not found" });
    }
    if (user.stt === req.user.stt) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }
    if (isDirector(user) && (await listUserAccounts()).filter(isDirector).length <= 1) {
      return res.status(409).json({ message: "At least one director account must remain" });
    }

    await clearUserByRowIndex(user.rowIndex);
    return res.json({ message: "Employee account deleted" });
  } catch (error) {
    return res.status(500).json({
      message: "Cannot delete employee account",
      error: error.message,
    });
  }
});

router.post("/register", requireAuth, requireAnyRole(ACCOUNT_MANAGER_ROLES), async (req, res) => {
  try {
    const { fullName, position, username, password } = req.body;
    const selectedRole = getManagedRole(req.body?.role);

    if (!fullName || !position || !username || !password) {
      return res.status(400).json({ message: "fullName, position, username, password are required" });
    }
    if (!selectedRole) {
      return res.status(400).json({ message: "Select a valid employee role" });
    }
    const passwordValidationMessage = getPasswordValidationMessage(password);
    if (passwordValidationMessage) {
      return res.status(400).json({
        message: passwordValidationMessage,
      });
    }

    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const finalPassword = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    const user = await createUser({
      fullName,
      position,
      username,
      password: finalPassword,
      role: selectedRole.value,
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

    if (!/^\$2[aby]\$\d{2}\$/.test(user.password)) {
      const migratedPassword = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
      await updatePasswordByRowIndex(user.rowIndex, migratedPassword);
    }

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);
    addToken(refreshToken);
    const avatar = await findAvatarByRowIndex(user.rowIndex);

    return res.json({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: getPublicUser(user, avatar),
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
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "oldPassword and newPassword are required" });
    }
    const passwordValidationMessage = getPasswordValidationMessage(
      newPassword,
      "New password"
    );
    if (passwordValidationMessage) {
      return res.status(400).json({
        message: passwordValidationMessage,
      });
    }
    if (oldPassword === newPassword) {
      return res.status(400).json({
        message: "New password must be different from the current password",
      });
    }

    const user = await findUserByUsername(req.user.username);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const oldMatched = await isPasswordMatched(oldPassword, user.password);
    if (!oldMatched) {
      return res.status(401).json({ message: "Old password is incorrect" });
    }

    const finalPassword = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
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
    const { username, fullName } = req.body;

    if (!username || !fullName) {
      return res.status(400).json({ message: "username and fullName are required" });
    }

    const user = await findUserByUsername(username);
    if (!user || user.fullName.trim().toLowerCase() !== String(fullName).trim().toLowerCase()) {
      return res.status(404).json({ message: "User information not matched" });
    }

    const temporaryPassword = crypto.randomBytes(4).toString("hex");
    const finalPassword = await bcrypt.hash(temporaryPassword, PASSWORD_SALT_ROUNDS);

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

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await findUserByUsername(req.user.username);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const avatar = await findAvatarByRowIndex(user.rowIndex);
    return res.json({ user: getPublicUser(user, avatar) });
  } catch (error) {
    return res.status(500).json({
      message: "Cannot load profile",
      error: error.message,
    });
  }
});

router.put("/profile/avatar", requireAuth, async (req, res) => {
  try {
    const { avatar } = req.body;
    if (!isValidAvatarDataUrl(avatar)) {
      return res.status(400).json({
        message: "Avatar must be a valid JPEG, PNG, or WebP image under 40 KB",
      });
    }

    const user = await findUserByUsername(req.user.username);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await updateAvatarByRowIndex(user.rowIndex, avatar);
    return res.json({
      message: "Avatar updated successfully",
      user: getPublicUser(user, avatar),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Cannot update avatar",
      error: error.message,
    });
  }
});

module.exports = router;
