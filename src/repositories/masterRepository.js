const env = require("../config/env");
const {
  getUsersRows,
  updateRange,
  batchUpdateRanges,
  ensureWorksheet,
  replaceWorksheetRows,
  quoteSheetName,
} = require("../services/googleSheets");
const { toDisplayDate } = require("../utils/dateFormat");

const PROCEDURE_HEADERS = [
  "STT",
  "NHÂN VIÊN THỰC HIỆN",
  "MÃ CĂN",
  "TÊN KHÁCH HÀNG",
  "LOẠI HỒ SƠ",
  "NGÀY THỰC HIỆN",
  "TRẠNG THÁI HỒ SƠ",
  "NGÀY CHUYỂN KIỂM SOÁT",
  "KIỂM SOÁT",
  "NGÀY KIỂM SOÁT DUYỆT",
  "YÊU CẦU BỔ SUNG SỬA ĐỔI",
];

function normalizeText(value) {
  return String(value || "").trim();
}

function employeeSheetName(employeeName) {
  const cleanedName = normalizeText(employeeName)
    .replace(/[\\/?*\[\]:]/g, " ")
    .replace(/^'+|'+$/g, "")
    .replace(/\s+/g, " ");
  return `HS - ${cleanedName || "Chưa phân công"}`.slice(0, 100);
}

function procedureToRow(record, stt = record.stt) {
  return [
    stt,
    record.nhanVienThucHien,
    record.maCan,
    record.tenKhachHang,
    record.loaiHoSo,
    record.ngayThucHien,
    record.trangThaiHoSo,
    record.ngayChuyenKiemSoat,
    record.kiemSoat,
    record.ngayKiemSoatDuyet,
    record.yeuCauBoSung,
  ];
}

async function syncEmployeeSheet(employeeName, records) {
  const sheetName = employeeSheetName(employeeName);
  const range = `${quoteSheetName(sheetName)}!A2:K`;
  await ensureWorksheet(sheetName, PROCEDURE_HEADERS);

  const expectedRows = records.map((record, index) =>
    procedureToRow(record, String(index + 1))
  );
  const existingRows = await getUsersRows(range);
  const isSynchronized =
    existingRows.length === expectedRows.length &&
    expectedRows.every((row, rowIndex) =>
      row.every(
        (value, columnIndex) =>
          normalizeText(existingRows[rowIndex]?.[columnIndex]) === normalizeText(value)
      )
    );

  if (!isSynchronized) {
    await replaceWorksheetRows(sheetName, expectedRows);
  }
}

function normalizeProcedureRow(row) {
  const [
    stt = "",
    nhanVienThucHien = "",
    maCan = "",
    tenKhachHang = "",
    loaiHoSo = "",
    ngayThucHien = "",
    trangThaiHoSo = "",
    ngayChuyenKiemSoat = "",
    kiemSoat = "",
    ngayKiemSoatDuyet = "",
    yeuCauBoSung = "",
  ] = row;

  return {
    stt: normalizeText(stt),
    nhanVienThucHien: normalizeText(nhanVienThucHien),
    maCan: normalizeText(maCan),
    tenKhachHang: normalizeText(tenKhachHang),
    loaiHoSo: normalizeText(loaiHoSo),
    ngayThucHien: toDisplayDate(ngayThucHien),
    trangThaiHoSo: normalizeText(trangThaiHoSo),
    ngayChuyenKiemSoat: toDisplayDate(ngayChuyenKiemSoat),
    kiemSoat: normalizeText(kiemSoat),
    ngayKiemSoatDuyet: toDisplayDate(ngayKiemSoatDuyet),
    yeuCauBoSung: normalizeText(yeuCauBoSung),
  };
}

async function getMasterRows() {
  const range = `${env.googleMasterSheetName}!A2:K`;
  const rows = await getUsersRows(range);
  return rows;
}

async function listProcedures() {
  const rows = await getMasterRows();
  const records = rows
    .map((row, index) => ({
      ...normalizeProcedureRow(row),
      rowIndex: index + 2,
    }))
    .filter((record) => record.stt)
    .sort((left, right) => {
      const leftNumber = Number(left.stt);
      const rightNumber = Number(right.stt);
      if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
        return leftNumber - rightNumber;
      }
      return left.stt.localeCompare(right.stt, "vi", { numeric: true });
    });

  const employeePositions = new Map();
  return records.map((record) => {
      const employeeKey = employeeSheetName(record.nhanVienThucHien);
      const employeePosition = employeePositions.get(employeeKey) || 0;
      record.employeeRowIndex = employeePosition + 2;
      employeePositions.set(employeeKey, employeePosition + 1);
      return record;
    });
}

async function findProcedureByStt(stt) {
  const normalizedStt = normalizeText(stt);
  const rows = await listProcedures();

  return rows.find((item) => item.stt === normalizedStt) || null;
}

async function appendProcedure(data) {
  const rows = await listProcedures();
  const maxStt = rows.reduce((maxValue, item) => {
    const current = Number.parseInt(item.stt, 10);
    if (Number.isNaN(current)) {
      return maxValue;
    }
    return Math.max(maxValue, current);
  }, 0);

  const nextStt = String(maxStt + 1);
  const row = [
    nextStt,
    data.nhanVienThucHien,
    data.maCan,
    data.tenKhachHang,
    data.loaiHoSo,
    data.ngayThucHien,
    data.trangThaiHoSo || "MỚI",
    data.ngayChuyenKiemSoat || "",
    data.kiemSoat || "",
    data.ngayKiemSoatDuyet || "",
    data.yeuCauBoSung || "",
  ];

  const created = {
    ...normalizeProcedureRow(row),
    rowIndex: rows.length + 2,
  };
  const employeeRecords = rows.filter(
    (record) =>
      employeeSheetName(record.nhanVienThucHien) ===
      employeeSheetName(data.nhanVienThucHien)
  );
  created.employeeRowIndex = employeeRecords.length + 2;
  const employeeSheet = employeeSheetName(data.nhanVienThucHien);
  await ensureWorksheet(employeeSheet, PROCEDURE_HEADERS);
  await batchUpdateRanges([
    {
      range: `${env.googleMasterSheetName}!A${created.rowIndex}:K${created.rowIndex}`,
      values: [row],
    },
    {
      range: `${quoteSheetName(employeeSheet)}!A${created.employeeRowIndex}:K${created.employeeRowIndex}`,
      values: [procedureToRow(created, String(employeeRecords.length + 1))],
    },
  ]);
  return created;
}

async function appendProcedures(dataList) {
  if (!dataList.length) {
    return [];
  }

  const rows = await listProcedures();
  const maxStt = rows.reduce((maxValue, item) => {
    const current = Number.parseInt(item.stt, 10);
    return Number.isNaN(current) ? maxValue : Math.max(maxValue, current);
  }, 0);

  const newRows = dataList.map((data, index) => [
    String(maxStt + index + 1),
    data.nhanVienThucHien,
    data.maCan,
    data.tenKhachHang || "",
    data.loaiHoSo,
    data.ngayThucHien,
    data.trangThaiHoSo || "MỚI",
    data.ngayChuyenKiemSoat || "",
    data.kiemSoat || "",
    data.ngayKiemSoatDuyet || "",
    data.yeuCauBoSung || "",
  ]);

  const created = newRows.map((row, index) => ({
    ...normalizeProcedureRow(row),
    rowIndex: rows.length + index + 2,
  }));

  const recordsByEmployee = new Map();
  rows.forEach((record) => {
    const key = employeeSheetName(record.nhanVienThucHien);
    if (!recordsByEmployee.has(key)) {
      recordsByEmployee.set(key, {
        employeeName: record.nhanVienThucHien,
        records: [],
      });
    }
    recordsByEmployee.get(key).records.push(record);
  });

  const changedEmployeeKeys = new Set();
  const batchData = created.map((record) => ({
    range: `${env.googleMasterSheetName}!A${record.rowIndex}:K${record.rowIndex}`,
    values: [procedureToRow(record)],
  }));
  created.forEach((record) => {
    const key = employeeSheetName(record.nhanVienThucHien);
    if (!recordsByEmployee.has(key)) {
      recordsByEmployee.set(key, {
        employeeName: record.nhanVienThucHien,
        records: [],
      });
    }
    const employeeRecords = recordsByEmployee.get(key).records;
    const employeeRowIndex = employeeRecords.length + 2;
    record.employeeRowIndex = employeeRowIndex;
    employeeRecords.push(record);
    changedEmployeeKeys.add(key);
    const localRow = procedureToRow(record, String(employeeRowIndex - 1));
    batchData.push({
      range: `${quoteSheetName(key)}!A${employeeRowIndex}:K${employeeRowIndex}`,
      values: [localRow],
    });
  });

  await Promise.all(
    [...changedEmployeeKeys].map((key) => {
      const sheet = recordsByEmployee.get(key);
      return ensureWorksheet(key, PROCEDURE_HEADERS);
    })
  );
  await batchUpdateRanges(batchData);
  return created;
}

async function updateProceduresByRowIndex(updates) {
  if (!updates.length) {
    return;
  }

  const movedUpdates = updates.filter(({ data, previousEmployeeName }) =>
    previousEmployeeName &&
    employeeSheetName(previousEmployeeName) !== employeeSheetName(data.nhanVienThucHien)
  );
  const stableUpdates = updates.filter((update) => !movedUpdates.includes(update));
  const employeeNames = new Set(
    stableUpdates.map(({ data }) => data.nhanVienThucHien).filter(Boolean)
  );

  await Promise.all(
    [...employeeNames].map((employeeName) =>
      ensureWorksheet(employeeSheetName(employeeName), PROCEDURE_HEADERS)
    )
  );

  const batchData = [];
  stableUpdates.forEach(({ rowIndex, data }) => {
    if (!data.employeeRowIndex) {
      throw new Error(`Employee sheet row for procedure ${data.stt} was not found`);
    }
    const row = procedureToRow(data);
    batchData.push({
      range: `${env.googleMasterSheetName}!A${rowIndex}:K${rowIndex}`,
      values: [row],
    });
    batchData.push({
      range: `${quoteSheetName(employeeSheetName(data.nhanVienThucHien))}!A${data.employeeRowIndex}:K${data.employeeRowIndex}`,
      values: [procedureToRow(data, String(data.employeeRowIndex - 1))],
    });
  });
  movedUpdates.forEach(({ rowIndex, data }) => {
    batchData.push({
      range: `${env.googleMasterSheetName}!A${rowIndex}:K${rowIndex}`,
      values: [procedureToRow(data)],
    });
  });
  await batchUpdateRanges(batchData);

  if (movedUpdates.length) {
    const records = await listProcedures();
    const updatedRecords = records.map((record) => {
      const update = movedUpdates.find(({ data }) => data.stt === record.stt);
      return update ? { ...record, ...update.data } : record;
    });
    const affectedEmployeeNames = new Set(
      movedUpdates.flatMap(({ data, previousEmployeeName }) => [
        previousEmployeeName,
        data.nhanVienThucHien,
      ])
    );
    for (const employeeName of affectedEmployeeNames) {
      await syncEmployeeSheet(
        employeeName,
        updatedRecords.filter(
          (record) =>
            employeeSheetName(record.nhanVienThucHien) ===
            employeeSheetName(employeeName)
        )
      );
    }
  }
}

async function updateProcedureByRowIndex(rowIndex, data, previousEmployeeName) {
  await updateProceduresByRowIndex([
    { rowIndex, data, previousEmployeeName },
  ]);
}

async function deleteProcedureByStt(stt) {
  const records = await listProcedures();
  const target = records.find((record) => record.stt === normalizeText(stt));
  if (!target) {
    return null;
  }

  const remainingRecords = records.filter((record) => record.stt !== target.stt);
  await replaceWorksheetRows(
    env.googleMasterSheetName,
    remainingRecords.map((record) => procedureToRow(record))
  );
  await syncEmployeeSheet(
    target.nhanVienThucHien,
    remainingRecords.filter(
      (record) =>
        employeeSheetName(record.nhanVienThucHien) ===
        employeeSheetName(target.nhanVienThucHien)
    )
  );
  return target;
}

async function syncEmployeeProcedures(employeeName, records) {
  await syncEmployeeSheet(employeeName, records);
}

async function syncAllEmployeeProcedures(records, employeeNames = []) {
  const recordsByEmployee = new Map();
  employeeNames.forEach((employeeName) => {
    const key = employeeSheetName(employeeName);
    if (!recordsByEmployee.has(key)) {
      recordsByEmployee.set(key, { employeeName, records: [] });
    }
  });
  records.forEach((record) => {
    const key = employeeSheetName(record.nhanVienThucHien);
    if (!recordsByEmployee.has(key)) {
      recordsByEmployee.set(key, {
        employeeName: record.nhanVienThucHien,
        records: [],
      });
    }
    recordsByEmployee.get(key).records.push(record);
  });

  for (const { employeeName, records: employeeRecords } of recordsByEmployee.values()) {
    await syncEmployeeSheet(employeeName, employeeRecords);
  }
}

module.exports = {
  listProcedures,
  findProcedureByStt,
  appendProcedure,
  appendProcedures,
  updateProcedureByRowIndex,
  updateProceduresByRowIndex,
  deleteProcedureByStt,
  syncEmployeeProcedures,
  syncAllEmployeeProcedures,
};
