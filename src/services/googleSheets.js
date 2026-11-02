const { google } = require("googleapis");
const env = require("../config/env");

const auth = new google.auth.JWT({
  email: env.googleServiceAccountEmail,
  key: env.googlePrivateKey,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
const worksheetNames = new Set();
const worksheetHeaders = new Set();
let worksheetNamesInitialized = false;

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

async function batchUpdateRanges(data) {
  if (!data.length) {
    return;
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: env.googleSheetId,
    requestBody: {
      valueInputOption: "RAW",
      data,
    },
  });
}

function quoteSheetName(sheetName) {
  return `'${String(sheetName).replace(/'/g, "''")}'`;
}

async function ensureWorksheet(sheetName, headers) {
  if (!worksheetNamesInitialized) {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: env.googleSheetId,
      fields: "sheets.properties.title",
    });
    (response.data.sheets || []).forEach((sheet) => {
      if (sheet.properties?.title) {
        worksheetNames.add(sheet.properties.title);
      }
    });
    worksheetNamesInitialized = true;
  }

  const isNewWorksheet = !worksheetNames.has(sheetName);
  if (isNewWorksheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: env.googleSheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      },
    });
    worksheetNames.add(sheetName);
  }

  if (worksheetHeaders.has(sheetName)) {
    return;
  }

  const range = `${quoteSheetName(sheetName)}!A1:K1`;
  if (isNewWorksheet) {
    await updateRange(range, [headers]);
  }
  worksheetHeaders.add(sheetName);
}

async function replaceWorksheetRows(sheetName, rows) {
  const range = `${quoteSheetName(sheetName)}!A2:K`;
  await sheets.spreadsheets.values.clear({
    spreadsheetId: env.googleSheetId,
    range,
  });

  if (rows.length) {
    await updateRange(`${quoteSheetName(sheetName)}!A2:K`, rows);
  }
}

async function upsertWorksheetRow(sheetName, row) {
  const range = `${quoteSheetName(sheetName)}!A:K`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: env.googleSheetId,
    range,
  });
  const rows = response.data.values || [];
  const existingIndex = rows.findIndex(
    (existing, index) => index > 0 && String(existing[0] || "") === String(row[0])
  );

  if (existingIndex >= 0) {
    const rowNumber = existingIndex + 1;
    await updateRange(
      `${quoteSheetName(sheetName)}!A${rowNumber}:K${rowNumber}`,
      [row]
    );
    return;
  }

  await appendUserRow(range, row);
}

async function clearWorksheetRow(sheetName, rowNumber) {
  await sheets.spreadsheets.values.clear({
    spreadsheetId: env.googleSheetId,
    range: `${quoteSheetName(sheetName)}!A${rowNumber}:K${rowNumber}`,
  });
}

module.exports = {
  getUsersRows,
  appendUserRow,
  appendUserRows,
  updateRange,
  batchUpdateRanges,
  ensureWorksheet,
  replaceWorksheetRows,
  upsertWorksheetRow,
  quoteSheetName,
};
