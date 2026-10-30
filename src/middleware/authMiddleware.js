const jwt = require("jsonwebtoken");
const env = require("../config/env");

function canonicalRole(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [, token] = authHeader.split(" ");

  if (!token) {
    return res.status(401).json({ message: "Missing access token" });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
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
