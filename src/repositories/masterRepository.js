const env = require("../config/env");
const { getUsersRows, appendUserRow, appendUserRows, updateRange } = require("../services/googleSheets");
const { toDisplayDate } = require("../utils/dateFormat");

function normalizeText(value) {
  return String(value || "").trim();
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
  return rows.map((row, index) => ({
    ...normalizeProcedureRow(row),
    rowIndex: index + 2,
  }));
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

  const range = `${env.googleMasterSheetName}!A:K`;
  await appendUserRow(range, row);

  return {
    ...normalizeProcedureRow(row),
    rowIndex: rows.length + 2,
  };
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

  await appendUserRows(`${env.googleMasterSheetName}!A:K`, newRows);

  return newRows.map((row, index) => ({
    ...normalizeProcedureRow(row),
    rowIndex: rows.length + index + 2,
  }));
}

async function updateProcedureByRowIndex(rowIndex, data) {
  const range = `${env.googleMasterSheetName}!A${rowIndex}:K${rowIndex}`;
  const row = [
    data.stt,
    data.nhanVienThucHien,
    data.maCan,
    data.tenKhachHang,
    data.loaiHoSo,
    data.ngayThucHien,
    data.trangThaiHoSo,
    data.ngayChuyenKiemSoat,
    data.kiemSoat,
    data.ngayKiemSoatDuyet,
    data.yeuCauBoSung,
  ];

  await updateRange(range, [row]);
}

module.exports = {
  listProcedures,
  findProcedureByStt,
  appendProcedure,
  appendProcedures,
  updateProcedureByRowIndex,
};
