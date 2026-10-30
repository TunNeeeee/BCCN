const dotenv = require("dotenv");

dotenv.config();

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: getRequiredEnv("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  refreshSecret: process.env.REFRESH_SECRET || getRequiredEnv("JWT_SECRET"),
  refreshExpiresIn: process.env.REFRESH_EXPIRES_IN || "7d",
  googleSheetId: getRequiredEnv("GOOGLE_SHEET_ID"),
  googleUsersSheetName: process.env.GOOGLE_USERS_SHEET_NAME || "DATA",
  googleMasterSheetName: process.env.GOOGLE_MASTER_SHEET_NAME || "DATA_MASTER",
  googleServiceAccountEmail: getRequiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
  googlePrivateKey: getRequiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
};
