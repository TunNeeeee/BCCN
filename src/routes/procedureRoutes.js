
const express = require("express");
const ExcelJS = require("exceljs");
const multer = require("multer");

const {
  requireAuth,
  requireAnyRole,
} = require("../middleware/authMiddleware");

const {
  listUsersByRole,
} = require("../repositories/userRepository");

const {
  listProcedures,
  findProcedureByStt,
  appendProcedure,
  appendProcedures,
  updateProceduresByRowIndex,
  deleteProcedureByStt,
} = require("../repositories/masterRepository");

const {
  parseDate,
  todayIsoDate,
} = require("../utils/dateFormat");

const router = express.Router();

// ==========================================
// 1. CẤU HÌNH
// ==========================================

const ALLOWED_ROLES = [
  "Admin",
  "Chuyen Vien Thu Tuc",
  "Kiem Soat",
  "Chuyen Vien Kiem Soat",
  "Giam Doc",
];

const SPECIALIST_ROLES = [
  "Admin",
  "Chuyen Vien Thu Tuc",
  "Giam Doc",
];

const CONTROL_ROLES = [
  "Kiem Soat",
  "Chuyen Vien Kiem Soat",
  "Giam Doc",
  "Admin",
];

const PROCEDURE_TYPES = [
  "HD.TTĐC",
  "HD.TTKQ",
  "HD.HĐMB",
  "CN.TTĐC",
  "CN.TTKQ",
  "CN.HĐMB",
  "PL.DIEUKHOAN",
  "PL.GIA",
  "PL.GIATIENDO",
  "PL.TIENDO",
  "PL.TTKH",
  "TL.HĐMB",
  "TL.TTĐC",
  "TL.TTKQ",
  "Khac_PTG",
  "Khac_XN.CONGNANG",
  "Khac_XN.TTCN",
  "Khac_XN.ĐKCN",
  "Khac_DN.THANHTOAN",
  "Khac_1",
  "Khac_2",
];

const RESTRICTED_DUPLICATE_TYPES = [
  "HD.TTĐC",
  "HD.TTKQ",
  "HD.HĐMB",
];

const MAX_IMPORT_ROWS = 1000;

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

// ==========================================
// 2. MIDDLEWARE UPLOAD EXCEL
// ==========================================

function handleExcelUpload(req, res, next) {
  uploadExcel.single("file")(req, res, (error) => {
    if (!error) {
      return next();
    }

    const message =
      error instanceof multer.MulterError &&
      error.code === "LIMIT_FILE_SIZE"
        ? "File Excel không được vượt quá 5 MB"
        : error.message;

    return res.status(400).json({
      message,
    });
  });
}

// ==========================================
// 3. HÀM XỬ LÝ CHUNG
// ==========================================

function canonicalText(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function hasDirectorPrivileges(user) {
  const role = canonicalText(user?.role);
  return role === canonicalText("Giam Doc") || role === canonicalText("Admin");
}

function isFutureDate(inputDateText) {
  const inputDate = parseDate(inputDateText);

  if (!inputDate) {
    return false;
  }

  return inputDate.iso > todayIsoDate();
}

function isProcedureTypeSupported(type) {
  const canonicalType = canonicalText(type);

  return PROCEDURE_TYPES.some(
    (item) => canonicalText(item) === canonicalType
  );
}

function isRestrictedType(type) {
  const canonicalType = canonicalText(type);

  return RESTRICTED_DUPLICATE_TYPES.some(
    (item) => canonicalText(item) === canonicalType
  );
}

function canManageRecord(user, record) {
  if (
    canonicalText(user.role) ===
      canonicalText("Admin") ||
    canonicalText(user.role) === canonicalText("Giam Doc")
  ) {
    return true;
  }

  return (
    canonicalText(user.fullName) ===
    canonicalText(record.nhanVienThucHien)
  );
}

function excelCellText(cell) {
  const value = cell.value;

  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "object") {
    throw new Error(
      "Không hỗ trợ ô công thức hoặc nội dung Excel đặc biệt"
    );
  }

  return String(value).trim();
}

function excelDateValue(cell) {
  const value = excelCellText(cell);

  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    return parseDate(`${year}-${month}-${day}`);
  }

  if (typeof cell.value === "number") {
    if (cell.value < 1) {
      return null;
    }

    const date = new Date(
      Date.UTC(1899, 11, 30) +
      cell.value * 86400000
    );

    return parseDate(
      `${date.getUTCFullYear()}-${String(
        date.getUTCMonth() + 1
      ).padStart(2, "0")}-${String(
        date.getUTCDate()
      ).padStart(2, "0")}`
    );
  }

  return parseDate(value);
}

function normalizedHeader(value) {
  return canonicalText(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

// ==========================================
// 4. TẠO FILE EXCEL MẪU 8 CỘT
// ==========================================

function buildImportTemplate() {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "BCCN";
  workbook.subject = "Mẫu nhập hồ sơ thủ tục";
  workbook.created = new Date();

  // SHEET HƯỚNG DẪN
  const guide = workbook.addWorksheet("HUONG_DAN");

  guide.columns = [
    {
      width: 110,
    },
  ];

  guide.addRows([
    ["HƯỚNG DẪN NHẬP HỒ SƠ BCCN"],
    ["1. Chỉ nhập dữ liệu tại sheet DATA_IMPORT, bắt đầu từ dòng 2."],
    ["2. Giữ nguyên đủ 8 cột và tên tiêu đề; mỗi dòng là một hồ sơ."],
    ["3. MÃ CĂN, TÊN KHÁCH HÀNG và LOẠI HỒ SƠ là khóa đối chiếu, bắt buộc nhập."],
    ["4. Hồ sơ được đối chiếu theo đúng bộ 3: MÃ CĂN + TÊN KHÁCH HÀNG + LOẠI HỒ SƠ."],
    ["5. Nếu tìm thấy hồ sơ trùng bộ 3, các cột còn lại chỉ cập nhật khi ô Excel có dữ liệu."],
    ["6. Ô trống hoặc chỉ có khoảng trắng sẽ giữ nguyên giá trị hiện tại, không ghi đè."],
    ["7. Nếu không tìm thấy hồ sơ trùng bộ 3, hệ thống tạo hồ sơ mới; NGÀY THỰC HIỆN phải có giá trị."],
    ["8. Nhân viên thực hiện tự động lấy từ tài khoản đang đăng nhập."],
    ["9. KIỂM SOÁT nếu nhập phải thuộc danh sách nhân viên có quyền kiểm soát."],
    ["10. NGÀY THỰC HIỆN, NGÀY CHUYỂN KIỂM SOÁT và NGÀY KIỂM SOÁT DUYỆT dùng DD/MM/YYYY."],
    ["11. Ngày thực hiện không được lớn hơn hôm nay. Các ngày cập nhật khác phải là ngày hợp lệ."],
    ["12. Chỉ ghi những trường có thay đổi; nếu không có thay đổi, hồ sơ được bỏ qua."],
    ["13. Tối đa 1.000 dòng dữ liệu mỗi lần nhập."],
    ["14. Hệ thống kiểm tra toàn bộ file trước khi ghi; nếu có lỗi, không ghi dòng nào."],
  ]);

  guide.getRow(1).font = {
    bold: true,
    size: 16,
    color: {
      argb: "FFFFFFFF",
    },
  };

  guide.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
      argb: "FF172554",
    },
  };

  guide.eachRow((row, rowNumber) => {
    row.height = rowNumber === 1 ? 30 : 25;

    row.alignment = {
      vertical: "middle",
      wrapText: true,
    };
  });

  // SHEET DATA_IMPORT
  const data = workbook.addWorksheet("DATA_IMPORT");

  data.columns = [
    {
      header: "MÃ CĂN",
      key: "maCan",
      width: 20,
    },
    {
      header: "TÊN KHÁCH HÀNG",
      key: "tenKhachHang",
      width: 32,
    },
    {
      header: "LOẠI HỒ SƠ",
      key: "loaiHoSo",
      width: 32,
    },
    {
      header: "NGÀY THỰC HIỆN",
      key: "ngayThucHien",
      width: 20,
    },
    {
      header: "TRẠNG THÁI HỒ SƠ",
      key: "trangThaiHoSo",
      width: 22,
    },
    {
      header: "NGÀY CHUYỂN KIỂM SOÁT",
      key: "ngayChuyenKiemSoat",
      width: 25,
    },
    {
      header: "KIỂM SOÁT",
      key: "kiemSoat",
      width: 28,
    },
    {
      header: "NGÀY KIỂM SOÁT DUYỆT",
      key: "ngayKiemSoatDuyet",
      width: 25,
    },
  ];

  data.getRow(1).height = 35;

  data.getRow(1).font = {
    bold: true,
    color: {
      argb: "FFFFFFFF",
    },
  };

  data.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
      argb: "FF1E3A8A",
    },
  };

  data.getRow(1).alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };

  data.views = [
    {
      state: "frozen",
      ySplit: 1,
    },
  ];

  data.autoFilter = "A1:H1";

  // Các cột định danh dạng Text để giữ nguyên mã có số 0 ở đầu.
  data.getColumn(1).numFmt = "@";
  data.getColumn(2).numFmt = "@";

  const procedureTypeList =
    `"${PROCEDURE_TYPES.join(",")}"`;

  for (
    let rowNumber = 2;
    rowNumber <= MAX_IMPORT_ROWS + 1;
    rowNumber++
  ) {
    data.getCell(`C${rowNumber}`).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [procedureTypeList],
      showErrorMessage: true,
      errorTitle: "Loại hồ sơ không hợp lệ",
      error: "Vui lòng chọn một loại hồ sơ trong danh sách.",
    };

    ["D", "F", "H"].forEach((column) => {
      data.getCell(`${column}${rowNumber}`).numFmt = "dd/mm/yyyy";
    });
  }

  return workbook;
}

// ==========================================
// 5. ĐỌC SHEET EXCEL IMPORT
// ==========================================

async function findImportWorksheet(buffer) {
  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.load(buffer);

  const requiredHeaders = [
    "ma_can",
    "ten_khach_hang",
    "loai_ho_so",
    "ngay_thuc_hien",
    "trang_thai_ho_so",
    "ngay_chuyen_kiem_soat",
    "kiem_soat",
    "ngay_kiem_soat_duyet",
  ];

  const worksheet = workbook.worksheets.find((sheet) => {
    const headerValues = sheet
      .getRow(1)
      .values
      .slice(1)
      .map((value) => normalizedHeader(value));

    return requiredHeaders.every((header) =>
      headerValues.includes(header)
    );
  });

  if (!worksheet) {
    throw new Error(
      "Không tìm thấy bảng dữ liệu đúng mẫu 8 cột. Hãy sử dụng sheet DATA_IMPORT."
    );
  }

  return worksheet;
}

// ==========================================
// 6. XÁC THỰC VÀ PHÂN QUYỀN
// ==========================================

router.use(
  requireAuth,
  requireAnyRole(ALLOWED_ROLES)
);

// ==========================================
// 7. API LẤY DANH SÁCH LOẠI HỒ SƠ
// ==========================================

router.get("/types", (_req, res) => {
  return res.json({
    types: PROCEDURE_TYPES,
  });
});

// ==========================================
// 8. API DOWNLOAD EXCEL TEMPLATE
// ==========================================

router.get(
  "/import/template",
  requireAnyRole(SPECIALIST_ROLES),
  async (_req, res) => {
  try {
    const workbook = buildImportTemplate();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="BCCN_Mau_Import_Ho_So.xlsx"'
    );

    await workbook.xlsx.write(res);

    return res.end();

  } catch (error) {
    return res.status(500).json({
      message: "Cannot create Excel template",
      error: error.message,
      }
    );
  }
});

// ==========================================
// 9. API IMPORT EXCEL
// ==========================================

router.post(
  "/import",
  requireAnyRole(SPECIALIST_ROLES),
  handleExcelUpload,
  async (req, res) => {

  // KIỂM TRA FILE
  if (!req.file) {
    return res.status(400).json({
      message: "Vui lòng chọn file Excel .xlsx",
      }
    );
  }

  if (!req.file.originalname.toLowerCase().endsWith(".xlsx")) {
    return res.status(400).json({
      message: "Chỉ hỗ trợ file Excel .xlsx",
    });
  }

  try {

    // BƯỚC 1: ĐỌC FILE EXCEL

    const worksheet = await findImportWorksheet(
      req.file.buffer
    );

    const headers = worksheet
      .getRow(1)
      .values
      .slice(1)
      .map((value) => normalizedHeader(value));

    const columns = new Map(
      headers.map((header, index) => [
        header,
        index + 1,
      ])
    );

    // LẤY CÁC DÒNG CÓ DỮ LIỆU

    const dataRows = [];

    worksheet.eachRow((row, rowNumber) => {
      if (
        rowNumber > 1 &&
        row.values
          .slice(1)
          .some(
            (value) =>
              value !== null &&
              value !== undefined &&
              String(value).trim() !== ""
          )
      ) {
        dataRows.push({
          row,
          rowNumber,
        });
      }
    });

    if (dataRows.length === 0) {
      return res.status(400).json({
        message: "File chưa có dòng dữ liệu để nhập",
      });
    }

    if (dataRows.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({
        message: `Mỗi lần chỉ nhập tối đa ${MAX_IMPORT_ROWS} dòng`,
      });
    }

    // BƯỚC 2: LẤY DỮ LIỆU HỆ THỐNG

    const allRecords = await listProcedures();

    const recordsByKey = new Map();

    allRecords.forEach((record) => {
      const key =
          `${canonicalText(record.maCan)}|${canonicalText(record.tenKhachHang)}|${canonicalText(record.loaiHoSo)}`;

      const matches = recordsByKey.get(key) || [];

      matches.push(record);

      recordsByKey.set(key, matches);
    });

    // BƯỚC 3: KIỂM TRA TOÀN BỘ FILE

    const errors = [];
    const imports = [];
    const seenKeys = new Set();
    let controlNames;

    try {
      const controls = await listUsersByRole("Kiem Soat");
      controlNames = new Set(
        controls.map((control) => canonicalText(control.fullName))
      );
    } catch (error) {
      return res.status(500).json({
        message: "Không thể tải danh sách nhân viên có quyền kiểm soát.",
        error: error.message,
      });
    }

    dataRows.forEach(({ row, rowNumber }) => {
      try {

        // ĐỌC DỮ LIỆU THEO TÊN CỘT

        const maCan = excelCellText(
          row.getCell(columns.get("ma_can"))
        );

        const tenKhachHang = excelCellText(
          row.getCell(columns.get("ten_khach_hang"))
        );

        const loaiHoSo = excelCellText(
          row.getCell(columns.get("loai_ho_so"))
        );

        const parsedNgayThucHien = excelDateValue(
          row.getCell(columns.get("ngay_thuc_hien"))
        );
        const trangThaiHoSo = excelCellText(
          row.getCell(columns.get("trang_thai_ho_so"))
        );
        const parsedNgayChuyenKiemSoat = excelDateValue(
          row.getCell(columns.get("ngay_chuyen_kiem_soat"))
        );
        const kiemSoat = excelCellText(
          row.getCell(columns.get("kiem_soat"))
        );
        const parsedNgayKiemSoatDuyet = excelDateValue(
          row.getCell(columns.get("ngay_kiem_soat_duyet"))
        );
        const hasNgayThucHien = Boolean(
          excelCellText(row.getCell(columns.get("ngay_thuc_hien")))
        );
        const hasNgayChuyenKiemSoat = Boolean(
          excelCellText(row.getCell(columns.get("ngay_chuyen_kiem_soat")))
        );
        const hasNgayKiemSoatDuyet = Boolean(
          excelCellText(row.getCell(columns.get("ngay_kiem_soat_duyet")))
        );

        const rowErrors = [];

        // KIỂM TRA MÃ CĂN

        if (!maCan) {
          rowErrors.push("Thiếu mã căn");
        }

        if (!tenKhachHang) {
          rowErrors.push("Thiếu tên khách hàng");
        }

        // KIỂM TRA LOẠI HỒ SƠ

        if (!isProcedureTypeSupported(loaiHoSo)) {
          rowErrors.push(
            "Loại hồ sơ không hợp lệ hoặc đang để trống"
          );
        }

        if (kiemSoat && !controlNames.has(canonicalText(kiemSoat))) {
          rowErrors.push(
            "Người kiểm soát phải thuộc danh sách nhân viên có quyền kiểm soát"
          );
        }

        // KIỂM TRA NGÀY THỰC HIỆN

        if (hasNgayThucHien && !parsedNgayThucHien) {
          rowErrors.push(
            "Ngày thực hiện không hợp lệ (dùng DD/MM/YYYY)"
          );
        } else if (
          parsedNgayThucHien &&
          isFutureDate(parsedNgayThucHien.display)
        ) {
          rowErrors.push(
            "Ngày thực hiện không được lớn hơn hôm nay"
          );
        }

        if (hasNgayChuyenKiemSoat && !parsedNgayChuyenKiemSoat) {
          rowErrors.push(
            "Ngày chuyển kiểm soát không hợp lệ (dùng DD/MM/YYYY)"
          );
        }

        if (hasNgayKiemSoatDuyet && !parsedNgayKiemSoatDuyet) {
          rowErrors.push(
            "Ngày kiểm soát duyệt không hợp lệ (dùng DD/MM/YYYY)"
          );
        }

        if (rowErrors.length > 0) {
          errors.push({
            row: rowNumber,
            errors: rowErrors,
          });

          return;
        }

        // TẠO KHÓA ĐỐI CHIẾU

        const key =
          `${canonicalText(maCan)}|${canonicalText(tenKhachHang)}|${canonicalText(loaiHoSo)}`;

        // KIỂM TRA TRÙNG TRONG FILE

        if (seenKeys.has(key)) {
          errors.push({
            row: rowNumber,
            errors: [
              "Trùng mã căn + tên khách hàng + loại hồ sơ với dòng khác trong file",
            ],
          });

          return;
        }

        seenKeys.add(key);

        // TÌM HỒ SƠ TRONG HỆ THỐNG

        const matches = recordsByKey.get(key) || [];

        if (matches.length > 1) {
          errors.push({
            row: rowNumber,
            errors: [
              "Có nhiều hồ sơ trùng mã căn + tên khách hàng + loại hồ sơ trên hệ thống, không thể xác định hồ sơ cần cập nhật",
            ],
          });

          return;
        }

        const existing = matches[0] || null;

        if (!existing && !parsedNgayThucHien) {
          errors.push({
            row: rowNumber,
            errors: [
              "Ngày thực hiện là bắt buộc khi tạo hồ sơ mới",
            ],
          });
          return;
        }

        // KIỂM TRA QUYỀN CẬP NHẬT

        if (
          existing &&
          !canManageRecord(req.user, existing)
        ) {
          errors.push({
            row: rowNumber,
            errors: [
              "Bạn không có quyền cập nhật hồ sơ này",
            ],
          });

          return;
        }

        // ĐƯA VÀO DANH SÁCH IMPORT

        imports.push({
          rowNumber,

          existing,

          data: {
            maCan: maCan.trim(),

            tenKhachHang: tenKhachHang.trim(),

            loaiHoSo,

            ngayThucHien: parsedNgayThucHien?.display || "",

            trangThaiHoSo: trangThaiHoSo.trim(),

            ngayChuyenKiemSoat: parsedNgayChuyenKiemSoat?.display || "",

            kiemSoat: kiemSoat.trim(),

            ngayKiemSoatDuyet: parsedNgayKiemSoatDuyet?.display || "",
          },
        });

      } catch (error) {
        errors.push({
          row: rowNumber,
          errors: [error.message],
        });
      }
    });

    // BƯỚC 4: NẾU CÓ LỖI THÌ DỪNG

    if (errors.length > 0) {
      return res.status(400).json({
        message:
          `File có ${errors.length} dòng lỗi. Chưa có dữ liệu nào được ghi.`,

        totalRows: dataRows.length,

        errorCount: errors.length,

        rowErrors: errors,
      });
    }

    // BƯỚC 5: PHÂN LOẠI THÊM MỚI VÀ CẬP NHẬT

    const updates = imports.filter(
      (item) => item.existing
    );

    const additions = imports.filter(
      (item) => !item.existing
    );

    let updatedCount = 0;
    let createdCount = 0;
    let unchangedCount = 0;
    let currentRow = null;

    // BƯỚC 6: CẬP NHẬT HỒ SƠ ĐÃ TỒN TẠI

    try {
      const procedureUpdates = [];
      for (const item of updates) {

        currentRow = item.rowNumber;

        const existing = item.existing;

        const updated = {
          ...existing,
        };

        let changed = false;
        const updateFields = [
          ["ngayThucHien", item.data.ngayThucHien],
          ["trangThaiHoSo", item.data.trangThaiHoSo],
          ["ngayChuyenKiemSoat", item.data.ngayChuyenKiemSoat],
          ["kiemSoat", item.data.kiemSoat],
          ["ngayKiemSoatDuyet", item.data.ngayKiemSoatDuyet],
        ];

        updateFields.forEach(([field, value]) => {
          if (value && value !== existing[field]) {
            updated[field] = value;
            changed = true;
          }
        });

        if (!changed) {
          unchangedCount++;
          continue;
        }

        procedureUpdates.push({
          rowIndex: existing.rowIndex,
          data: updated,
          previousEmployeeName: existing.nhanVienThucHien,
        });

        updatedCount++;
      }
      await updateProceduresByRowIndex(procedureUpdates);

      // BƯỚC 7: THÊM HỒ SƠ MỚI

      if (additions.length > 0) {

        const newRecords = additions.map((item) => ({
          nhanVienThucHien: req.user.fullName,

          maCan: item.data.maCan,

          tenKhachHang: item.data.tenKhachHang,

          loaiHoSo: item.data.loaiHoSo,

          ngayThucHien: item.data.ngayThucHien,

          trangThaiHoSo: item.data.trangThaiHoSo || "MỚI",

          ngayChuyenKiemSoat: item.data.ngayChuyenKiemSoat,

          kiemSoat: item.data.kiemSoat,

          ngayKiemSoatDuyet: item.data.ngayKiemSoatDuyet,

          yeuCauBoSung: "",
        }));

        const created = await appendProcedures(
          newRecords
        );

        createdCount = created.length;
      }

    } catch (error) {

      return res.status(500).json({
        message:
          "Có lỗi khi ghi dữ liệu Excel; một phần dữ liệu có thể đã được lưu.",

        createdCount,

        updatedCount,

        unchangedCount,

        failedRow: currentRow,

        error: error.message,
      });

    }

    // BƯỚC 8: TRẢ KẾT QUẢ

    return res.json({
      message:
        `Đã xử lý ${dataRows.length} hồ sơ: ${createdCount} thêm mới, ${updatedCount} cập nhật, ${unchangedCount} không thay đổi.`,

      totalRows: dataRows.length,

      total: createdCount + updatedCount,

      createdCount,

      updatedCount,

      unchangedCount,

      skippedCount: unchangedCount,
    });

  } catch (error) {

    return res.status(400).json({
      message:
        "Không đọc được file Excel. Hãy kiểm tra file và dùng đúng mẫu .xlsx.",

      error: error.message,
    });

  }
});

// ==========================================
// 10. API DANH SÁCH NHÂN VIÊN KIỂM SOÁT
// ==========================================

router.get("/controls", async (_req, res) => {
  try {
    const controls = await listUsersByRole("Kiem Soat");

    return res.json({
      controls,
    });

  } catch (error) {
    return res.status(500).json({
      message: "Cannot load control users",
      error: error.message,
    });
  }
});

// ==========================================
// 11. HỒ SƠ VÀ THÔNG BÁO KIỂM SOÁT
// ==========================================

router.get(
  "/control/inbox",
  requireAnyRole(CONTROL_ROLES),
  async (req, res) => {
    try {
      const allRecords = await listProcedures();
      const records = allRecords
        .filter(
          (item) =>
            hasDirectorPrivileges(req.user) ||
            canonicalText(item.kiemSoat) ===
            canonicalText(req.user.fullName)
        );

      const pendingCount = records.filter(
        (item) =>
          canonicalText(item.trangThaiHoSo) ===
          canonicalText("CHUYỂN KIỂM SOÁT")
      ).length;

      return res.json({
        total: records.length,
        pendingCount,
        records,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Không thể tải hồ sơ được giao kiểm soát.",
        error: error.message,
      });
    }
  }
);

router.get(
  "/control/notifications",
  requireAnyRole(CONTROL_ROLES),
  async (req, res) => {
    try {
      const records = await listProcedures();
      const assignedRecords = records.filter(
        (item) =>
          hasDirectorPrivileges(req.user) ||
          canonicalText(item.kiemSoat) === canonicalText(req.user.fullName)
      );
      const pendingCount = assignedRecords.filter(
        (item) =>
          canonicalText(item.trangThaiHoSo) ===
          canonicalText("CHUYỂN KIỂM SOÁT")
      ).length;
      const resolvedCount = assignedRecords.filter((item) => {
        const status = canonicalText(item.trangThaiHoSo);
        return (
          status === canonicalText("ĐÃ KIỂM SOÁT") ||
          status === canonicalText("TRẢ THỦ TỤC")
        );
      }).length;

      return res.json({ pendingCount, resolvedCount });
    } catch (error) {
      return res.status(500).json({
        message: "Không thể tải thông báo kiểm soát.",
        error: error.message,
      });
    }
  }
);

async function reviewAssignedControlRecord(req, res, decision) {
  try {
    const record = await findProcedureByStt(req.params.stt);

    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ." });
    }

    if (
      !hasDirectorPrivileges(req.user) &&
      canonicalText(record.kiemSoat) !==
      canonicalText(req.user.fullName)
    ) {
      return res.status(403).json({
        message: "Hồ sơ này không được giao cho tài khoản kiểm soát của bạn.",
      });
    }

    if (
      canonicalText(record.trangThaiHoSo) !==
      canonicalText("CHUYỂN KIỂM SOÁT")
    ) {
      return res.status(409).json({
        message: "Hồ sơ không còn ở trạng thái chờ kiểm soát.",
      });
    }

    const updated = {
      ...record,
      trangThaiHoSo:
        decision === "approve" ? "ĐÃ KIỂM SOÁT" : "TRẢ THỦ TỤC",
      ...(decision === "approve"
        ? { ngayKiemSoatDuyet: parseDate(todayIsoDate()).display }
        : {
            yeuCauBoSung: String(req.body?.yeuCauBoSung || "").trim(),
          }),
    };

    await updateProceduresByRowIndex([
      { rowIndex: record.rowIndex, data: updated },
    ]);

    return res.json({
      message:
        decision === "approve"
          ? "Đã duyệt hồ sơ kiểm soát."
          : "Đã trả hồ sơ về thủ tục.",
      record: updated,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Không thể cập nhật kết quả kiểm soát.",
      error: error.message,
    });
  }
}

router.post(
  "/control/:stt/approve",
  requireAnyRole(CONTROL_ROLES),
  (req, res) => reviewAssignedControlRecord(req, res, "approve")
);

router.post(
  "/control/:stt/return",
  requireAnyRole(CONTROL_ROLES),
  (req, res) => reviewAssignedControlRecord(req, res, "return")
);

// ==========================================
// 12. DANH SÁCH VÀ BÁO CÁO PHÒNG BAN
// ==========================================

router.get(
  "/department",
  requireAnyRole(["Admin", ...CONTROL_ROLES]),
  async (_req, res) => {
    try {
      const records = await listProcedures();
      return res.json({ total: records.length, records });
    } catch (error) {
      return res.status(500).json({
        message: "Không thể tải danh sách thủ tục phòng ban.",
        error: error.message,
      });
    }
  }
);

router.get(
  "/department/report",
  requireAnyRole(["Admin", ...CONTROL_ROLES]),
  async (req, res) => {
    try {
      const employee = String(req.query.employee || "").trim();
      const procedureType = String(req.query.procedureType || "").trim();
      const records = (await listProcedures()).filter((item) => {
        const matchesEmployee =
          !employee ||
          canonicalText(item.nhanVienThucHien) === canonicalText(employee);
        const matchesType =
          !procedureType ||
          canonicalText(item.loaiHoSo) === canonicalText(procedureType);
        return matchesEmployee && matchesType;
      });

      return res.json({
        total: records.length,
        employee,
        procedureType,
        records,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Không thể tạo báo cáo thủ tục phòng ban.",
        error: error.message,
      });
    }
  }
);

const EXPORT_FIELDS = [
  ["stt", "STT"],
  ["maCan", "MÃ CĂN"],
  ["tenKhachHang", "TÊN KHÁCH HÀNG"],
  ["loaiHoSo", "LOẠI HỒ SƠ"],
  ["nhanVienThucHien", "NHÂN VIÊN THỰC HIỆN"],
  ["ngayThucHien", "NGÀY THỰC HIỆN"],
  ["trangThaiHoSo", "TRẠNG THÁI HỒ SƠ"],
  ["kiemSoat", "NHÂN VIÊN KIỂM SOÁT"],
  ["ngayChuyenKiemSoat", "NGÀY CHUYỂN KIỂM SOÁT"],
  ["ngayKiemSoatDuyet", "NGÀY KIỂM SOÁT DUYỆT"],
  ["yeuCauBoSung", "YÊU CẦU BỔ SUNG / SỬA ĐỔI"],
];

function textIncludes(value, filter) {
  return canonicalText(value).includes(canonicalText(filter));
}

router.post("/export", async (req, res) => {
  try {
    const scope = String(req.body?.scope || "");
    const view = String(req.body?.view || "");
    const isSpecialist = SPECIALIST_ROLES.some(
      (role) => canonicalText(role) === canonicalText(req.user.role)
    );
    const isController = CONTROL_ROLES.some(
      (role) => canonicalText(role) === canonicalText(req.user.role)
    );
    const isDirector = hasDirectorPrivileges(req.user);

    if (!["account", "filtered"].includes(scope)) {
      return res.status(400).json({ message: "Phạm vi export không hợp lệ." });
    }

    let records = await listProcedures();
    if (scope === "account") {
      const ownerField = isSpecialist ? "nhanVienThucHien" : "kiemSoat";
      records = records.filter(
        (record) =>
          canonicalText(record[ownerField]) === canonicalText(req.user.fullName)
      );
    } else if (isDirector && ["department", "report", "controlInbox"].includes(view)) {
      if (view === "controlInbox") {
        records = records.filter((record) =>
          ["CHUYỂN KIỂM SOÁT", "ĐÃ KIỂM SOÁT", "TRẢ THỦ TỤC"].some(
            (status) => canonicalText(record.trangThaiHoSo) === canonicalText(status)
          )
        );
      }
    } else if (isSpecialist) {
      records = records.filter(
        (record) =>
          canonicalText(record.nhanVienThucHien) === canonicalText(req.user.fullName)
      );
    } else if (isController && view === "controlInbox") {
      records = records.filter(
        (record) => canonicalText(record.kiemSoat) === canonicalText(req.user.fullName)
      );
    } else if (!isController || !["department", "report"].includes(view)) {
      return res.status(403).json({ message: "Bạn không có quyền export danh sách này." });
    }

    if (scope === "filtered") {
      const selectedType = String(req.body?.selectedType || "").trim();
      const search = String(req.body?.search || "").trim();
      const columnFilters =
        req.body?.columnFilters && typeof req.body.columnFilters === "object"
          ? req.body.columnFilters
          : {};
      const allowedFilterKeys = new Set(EXPORT_FIELDS.map(([key]) => key));
      const controlStatusTab = String(req.body?.controlStatusTab || "");
      const reportEmployee = String(req.body?.reportEmployee || "").trim();
      const reportType = String(req.body?.reportType || "").trim();

      records = records.filter((record) => {
        if (selectedType && canonicalText(record.loaiHoSo) !== canonicalText(selectedType)) {
          return false;
        }
        if (
          search &&
          !EXPORT_FIELDS.some(([key]) => textIncludes(record[key], search))
        ) {
          return false;
        }
        if (
          Object.entries(columnFilters).some(
            ([key, value]) =>
              allowedFilterKeys.has(key) &&
              String(value || "").trim() &&
              !textIncludes(record[key], value)
          )
        ) {
          return false;
        }
        if (
          reportEmployee &&
          canonicalText(record.nhanVienThucHien) !== canonicalText(reportEmployee)
        ) {
          return false;
        }
        if (
          reportType &&
          canonicalText(record.loaiHoSo) !== canonicalText(reportType)
        ) {
          return false;
        }
        if (view === "controlInbox") {
          const status = canonicalText(record.trangThaiHoSo);
          const isPending = status === canonicalText("CHUYỂN KIỂM SOÁT");
          const isResolved =
            status === canonicalText("ĐÃ KIỂM SOÁT") ||
            status === canonicalText("TRẢ THỦ TỤC");
          if (controlStatusTab === "pending" && !isPending) return false;
          if (controlStatusTab === "resolved" && !isResolved) return false;
        }
        return true;
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Danh sách hồ sơ", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    worksheet.columns = EXPORT_FIELDS.map(([key, header]) => ({
      header,
      key,
      width: key === "yeuCauBoSung" ? 36 : key === "tenKhachHang" ? 26 : 20,
    }));
    worksheet.addRows(records);
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: EXPORT_FIELDS.length },
    };
    worksheet.getRow(1).height = 28;
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17365D" } };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.alignment = { vertical: "top", wrapText: true };
        if (rowNumber % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF1F6FC" },
            };
          });
        }
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const suffix = scope === "account" ? "Tai_Khoan" : "Theo_Bo_Loc";
    const timestamp = new Date().toISOString().slice(0, 10);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="BCCN_${suffix}_${timestamp}.xlsx"`
    );
    return res.send(Buffer.from(buffer));
  } catch (error) {
    return res.status(500).json({
      message: "Không thể xuất danh sách Excel.",
      error: error.message,
    });
  }
});

// ==========================================
// 13. API LỊCH SỬ HỒ SƠ THEO MÃ CĂN
// ==========================================

router.get("/history/:maCan", async (req, res) => {
  try {
    const maCan = String(
      req.params.maCan || ""
    ).trim();

    if (!maCan) {
      return res.status(400).json({
        message: "maCan is required",
      });
    }

    const records = (await listProcedures())
      .filter(
        (item) =>
          canonicalText(item.maCan) ===
          canonicalText(maCan)
      )
      .sort((left, right) => {
        const leftDate =
          parseDate(left.ngayThucHien)?.iso || "";

        const rightDate =
          parseDate(right.ngayThucHien)?.iso || "";

        return (
          rightDate.localeCompare(leftDate) ||
          right.stt.localeCompare(
            left.stt,
            undefined,
            { numeric: true }
          )
        );
      });

    return res.json({
      maCan,
      total: records.length,
      records,
    });

  } catch (error) {
    return res.status(500).json({
      message: "Cannot load apartment history",
      error: error.message,
    });
  }
});

// ==========================================
// 14. API HỒ SƠ CỦA NHÂN VIÊN ĐANG ĐĂNG NHẬP
// ==========================================

router.get("/my", async (req, res) => {
  try {
    const { loaiHoSo } = req.query;

    const allRecords = await listProcedures();

    let filtered = allRecords.filter(
      (item) =>
        canonicalText(item.nhanVienThucHien) ===
        canonicalText(req.user.fullName)
    );

    if (loaiHoSo) {
      filtered = filtered.filter(
        (item) =>
          canonicalText(item.loaiHoSo) ===
          canonicalText(loaiHoSo)
      );
    }

    return res.json({
      total: filtered.length,
      records: filtered,
    });

  } catch (error) {
    return res.status(500).json({
      message: "Cannot load procedure list",
      error: error.message,
    });
  }
});

// ==========================================
// 15. API TẠO HỒ SƠ MỚI
// ==========================================

router.post("/", requireAnyRole(SPECIALIST_ROLES), async (req, res) => {
  try {
    const {
      maCan,
      tenKhachHang,
      loaiHoSo,
      ngayThucHien,
    } = req.body;

    if (
      !String(maCan || "").trim() ||
      !String(tenKhachHang || "").trim() ||
      !loaiHoSo
    ) {
      return res.status(400).json({
        message: "maCan, tenKhachHang, and loaiHoSo are required",
      });
    }

    if (!isProcedureTypeSupported(loaiHoSo)) {
      return res.status(400).json({
        message: "loaiHoSo is not supported",
        supportedTypes: PROCEDURE_TYPES,
      });
    }

    const inputDate = ngayThucHien
      ? parseDate(ngayThucHien)
      : parseDate(todayIsoDate());

    if (!inputDate) {
      return res.status(400).json({
        message: "ngayThucHien must use a valid date",
      });
    }

    const finalNgayThucHien = inputDate.display;

    if (isFutureDate(finalNgayThucHien)) {
      return res.status(400).json({
        message: "ngayThucHien cannot be greater than today",
      });
    }

    const allRecords = await listProcedures();

    if (isRestrictedType(loaiHoSo)) {
      const duplicated = allRecords.find(
        (item) =>
          canonicalText(item.maCan) ===
            canonicalText(maCan) &&
          canonicalText(item.loaiHoSo) ===
            canonicalText(loaiHoSo)
      );

      if (duplicated) {
        return res.status(409).json({
          message: "maCan is duplicated for this loaiHoSo",
          duplicatedStt: duplicated.stt,
        });
      }
    }

    const created = await appendProcedure({
      nhanVienThucHien: req.user.fullName,

      maCan: String(maCan).trim(),

      tenKhachHang: String(
        tenKhachHang || ""
      ).trim(),

      loaiHoSo,

      ngayThucHien: finalNgayThucHien,

      trangThaiHoSo: "MỚI",

      ngayChuyenKiemSoat: "",

      kiemSoat: "",

      ngayKiemSoatDuyet: "",

      yeuCauBoSung: "",
    });

    return res.status(201).json({
      message: "Procedure created",
      record: created,
    });

  } catch (error) {
    return res.status(500).json({
      message: "Cannot create procedure",
      error: error.message,
    });
  }
});

// ==========================================
// 16. API CẬP NHẬT HỒ SƠ
// ==========================================

router.put("/:stt", requireAnyRole(SPECIALIST_ROLES), async (req, res) => {
  try {
    const { stt } = req.params;

    const record = await findProcedureByStt(stt);

    if (!record) {
      return res.status(404).json({
        message: "Record not found",
      });
    }

    if (!canManageRecord(req.user, record)) {
      return res.status(403).json({
        message: "You cannot edit this record",
      });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "maCan")) {
      return res.status(400).json({
        message: "maCan is locked and cannot be edited",
      });
    }

    const tenKhachHang = Object.prototype.hasOwnProperty.call(
      req.body,
      "tenKhachHang"
    )
      ? String(req.body.tenKhachHang || "").trim()
      : record.tenKhachHang;

    if (!tenKhachHang) {
      return res.status(400).json({
        message: "tenKhachHang is required",
      });
    }

    const requestedNgayThucHien =
      req.body.ngayThucHien ||
      record.ngayThucHien;

    const parsedNgayThucHien = parseDate(
      requestedNgayThucHien
    );

    if (!parsedNgayThucHien) {
      return res.status(400).json({
        message: "ngayThucHien must use a valid date",
      });
    }

    const updated = {
      ...record,

      tenKhachHang,

      loaiHoSo:
        req.body.loaiHoSo || record.loaiHoSo,

      ngayThucHien:
        parsedNgayThucHien.display,

      trangThaiHoSo:
        req.body.trangThaiHoSo ||
        record.trangThaiHoSo,

      yeuCauBoSung:
        req.body.yeuCauBoSung ||
        record.yeuCauBoSung,
    };

    if (!isProcedureTypeSupported(updated.loaiHoSo)) {
      return res.status(400).json({
        message: "loaiHoSo is not supported",
      });
    }

    if (isFutureDate(updated.ngayThucHien)) {
      return res.status(400).json({
        message: "ngayThucHien cannot be greater than today",
      });
    }

    await updateProceduresByRowIndex([
      { rowIndex: record.rowIndex, data: updated },
    ]);

    return res.json({
      message: "Procedure updated",
      record: updated,
    });

  } catch (error) {
    return res.status(500).json({
      message: "Cannot update procedure",
      error: error.message,
    });
  }
});

router.delete("/:stt", requireAnyRole(SPECIALIST_ROLES), async (req, res) => {
  try {
    const record = await findProcedureByStt(req.params.stt);
    if (!record) {
      return res.status(404).json({
        message: "Record not found",
      });
    }

    if (!canManageRecord(req.user, record)) {
      return res.status(403).json({
        message: "You cannot delete this record",
      });
    }

    const deleted = await deleteProcedureByStt(record.stt);
    if (!deleted) {
      return res.status(404).json({
        message: "Record not found",
      });
    }
    return res.json({
      message: "Đã xóa hồ sơ",
      stt: record.stt,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Không thể xóa hồ sơ",
      error: error.message,
    });
  }
});

// ==========================================
// 17. API CHUYỂN KIỂM SOÁT
// ==========================================

router.post(
  "/transfer-control",
  requireAnyRole(SPECIALIST_ROLES),
  async (req, res) => {
  try {
    const {
      sttList,
      kiemSoat,
    } = req.body;

    if (
      !Array.isArray(sttList) ||
      sttList.length === 0 ||
      !kiemSoat
    ) {
      return res.status(400).json({
        message: "sttList and kiemSoat are required",
      });
    }

    const allRecords = await listProcedures();

    const normalizedSet = new Set(
      sttList.map((item) => canonicalText(item))
    );

    const selected = allRecords.filter(
      (item) =>
        normalizedSet.has(canonicalText(item.stt))
    );

    if (selected.length === 0) {
      return res.status(404).json({
        message: "No matching records found",
      });
    }

    if (selected.length !== normalizedSet.size) {
      return res.status(404).json({
        message: "Some selected records were not found",
      });
    }

    const unauthorized = selected.find(
      (item) => !canManageRecord(req.user, item)
    );

    if (unauthorized) {
      return res.status(403).json({
        message:
          "Some records cannot be managed by current user",
      });
    }

    const controls = await listUsersByRole("Kiem Soat");

    const selectedControl = controls.find(
      (control) =>
        canonicalText(control.fullName) ===
        canonicalText(kiemSoat)
    );

    if (!selectedControl) {
      return res.status(400).json({
        message:
          "kiemSoat must be selected from the control user list",
      });
    }

    const ngayChuyenKiemSoat =
      parseDate(todayIsoDate()).display;

    const updates = selected.map((item) => ({
      rowIndex: item.rowIndex,
      data: {
        ...item,
        trangThaiHoSo: "CHUYỂN KIỂM SOÁT",
        ngayChuyenKiemSoat,
        kiemSoat: selectedControl.fullName,
      },
    }));
    await updateProceduresByRowIndex(updates);

    return res.json({
      message: "Transferred to control successfully",
      updatedCount: selected.length,
    });

  } catch (error) {
    return res.status(500).json({
      message: "Cannot transfer records",
      error: error.message,
    });
  }
  }
);

// ==========================================
// 18. EXPORT ROUTER
// ==========================================

module.exports = router;
