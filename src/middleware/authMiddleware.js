const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { findUserByUsername } = require("../repositories/userRepository");

function canonicalRole(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [, token] = authHeader.split(" ");

  if (!token) {
    return res.status(401).json({ message: "Missing access token" });
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (_error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  try {
    const user = await findUserByUsername(payload.username);
    if (!user) {
      return res.status(401).json({ message: "Account is no longer available" });
    }

    req.user = {
      ...payload,
      stt: user.stt,
      username: user.username,
      fullName: user.fullName,
      position: user.position,
      role: user.role,
      rowIndex: user.rowIndex,
    };
    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Unable to validate account",
      error: error.message,
    });
  }
}

function requireAnyRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: "Role is required" });
    }

    const normalizedUserRole = canonicalRole(req.user.role);
    const normalizedAllowedRoles = allowedRoles.map((role) => canonicalRole(role));

    if (!normalizedAllowedRoles.includes(normalizedUserRole)) {
      return res.status(403).json({ message: "You do not have permission for this action" });
    }

    return next();
  };
}

module.exports = {
  requireAuth,
  requireAnyRole,
};
