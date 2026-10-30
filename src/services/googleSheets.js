const { google } = require("googleapis");
const env = require("../config/env");

const auth = new google.auth.JWT({
  email: env.googleServiceAccountEmail,
  key: env.googlePrivateKey,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

async function getUsersRows(customRange) {
  const range = customRange || `${env.googleUsersSheetName}!A2:F`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: env.googleSheetId,
    range,
  });

  return response.data.values || [];
}

async function appendUserRow(customRangeOrRow, maybeRow) {
  const hasCustomRange = typeof customRangeOrRow === "string";
  const range = hasCustomRange ? customRangeOrRow : `${env.googleUsersSheetName}!A:F`;
  const row = hasCustomRange ? maybeRow : customRangeOrRow;

  await sheets.spreadsheets.values.append({
    spreadsheetId: env.googleSheetId,
    range,
    valueInputOption: "RAW",
    requestBody: {
      values: [row],
    },
  });
}

async function appendUserRows(customRange, rows) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: env.googleSheetId,
    range: customRange,
    valueInputOption: "RAW",
    requestBody: {
      values: rows,
    },
  });
}

async function updateRange(range, values) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: env.googleSheetId,
    range,
    valueInputOption: "RAW",
    requestBody: {
      values,
    },
  });
}

module.exports = {
  getUsersRows,
  appendUserRow,
  appendUserRows,
  updateRange,
};
