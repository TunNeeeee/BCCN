const { getUsersRows, appendUserRow, updateRange } = require("../services/googleSheets");
const env = require("../config/env");

function normalizeUserRow(row) {
  const [stt = "", fullName = "", position = "", username = "", password = "", role = ""] = row;
  return {
    stt: String(stt).trim(),
    fullName: String(fullName),
    position: String(position),
    username: String(username).trim().toLowerCase(),
    password: String(password),
    role: String(role || "Chuyen Vien Thu Tuc"),
  };
}

function normalizeUsername(username) {
  return String(username).trim().toLowerCase();
}

function canonicalRole(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function listUsersByRole(role) {
  const usersRows = await getUsersRows();
  const requiredRole = canonicalRole(role);
  const acceptedRoles = requiredRole === canonicalRole("Kiem Soat")
    ? new Set([canonicalRole("Kiem Soat"), canonicalRole("Chuyên viên Kiểm soát")])
    : new Set([requiredRole]);
  const seenNames = new Set();

  return usersRows
    .map(normalizeUserRow)
    .filter((user) => {
      const fullName = user.fullName.trim();
      const normalizedName = canonicalRole(fullName);
      if (!acceptedRoles.has(canonicalRole(user.role)) || !normalizedName || seenNames.has(normalizedName)) {
        return false;
      }

      seenNames.add(normalizedName);
      return true;
    })
    .map(({ fullName, role: userRole }) => ({ fullName: fullName.trim(), role: userRole }));
}

async function findUserByUsername(username) {
  const usersRows = await getUsersRows();
  const normalizedInput = normalizeUsername(username);

  for (let index = 0; index < usersRows.length; index += 1) {
    const row = usersRows[index];
    const user = normalizeUserRow(row);
    if (user.username === normalizedInput) {
      return {
        ...user,
        rowIndex: index + 2,
      };
    }
  }

  return null;
}

async function createUser({ fullName, position, username, password, role }) {
  const usersRows = await getUsersRows();
  const maxStt = usersRows.reduce((currentMax, row) => {
    const value = Number.parseInt(String(row[0] || "0"), 10);
    return Number.isNaN(value) ? currentMax : Math.max(currentMax, value);
  }, 0);

  const nextStt = maxStt + 1;

  const row = [
    String(nextStt),
    fullName || "",
    position || "",
    normalizeUsername(username),
    password,
    role || "Chuyen Vien Thu Tuc",
  ];

  await appendUserRow(row);

  return {
    stt: row[0],
    fullName: row[1],
    position: row[2],
    username: row[3],
    password: row[4],
    role: row[5],
  };
}

async function updatePasswordByRowIndex(rowIndex, password) {
  const range = `${env.googleUsersSheetName}!E${rowIndex}`;
  await updateRange(range, [[password]]);
}

module.exports = {
  findUserByUsername,
  listUsersByRole,
  createUser,
  updatePasswordByRowIndex,
};
