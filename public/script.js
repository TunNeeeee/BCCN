const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const messageEl = document.getElementById("message");

const openCreateBtn = document.getElementById("openCreateBtn");
const closeCreateBtn = document.getElementById("closeCreateBtn");
const createDialog = document.getElementById("createDialog");
const createForm = document.getElementById("createForm");
const createMessageEl = document.getElementById("createMessage");

const editDialog = document.getElementById("editDialog");
const editForm = document.getElementById("editForm");
const editMessageEl = document.getElementById("editMessage");

const tabFilters = document.getElementById("tabFilters");
const procedureTableBody = document.getElementById("procedureTableBody");
const listMessageEl = document.getElementById("listMessage");
const totalCountEl = document.getElementById("totalCount");
const tableCountEl = document.getElementById("tableCount");
const staffNameEl = document.getElementById("staffName");
const welcomeText = document.getElementById("welcomeText");
const userAvatarInitials = document.getElementById("userAvatarInitials");
const userAvatarImage = document.getElementById("userAvatarImage");
const userChip = document.getElementById("userChip");
const profilePage = document.getElementById("profilePage");
const profileMessage = document.getElementById("profileMessage");
const profileAvatarInput = document.getElementById("profileAvatarInput");
const profileAvatarButton = document.getElementById("profileAvatarButton");
const profileAvatarImage = document.getElementById("profileAvatarImage");
const profileAvatarInitials = document.getElementById("profileAvatarInitials");
const avatarPreviewDialog = document.getElementById("avatarPreviewDialog");
const avatarPreviewImage = document.getElementById("avatarPreviewImage");
const uploadAvatarBtn = document.getElementById("uploadAvatarBtn");
const changePasswordForm = document.getElementById("changePasswordForm");
const roleBadge = document.getElementById("roleBadge");
const historyPanel = document.getElementById("historyPanel");
const historyList = document.getElementById("historyList");
const historyApartment = document.getElementById("historyApartment");
const historySummary = document.getElementById("historySummary");
const lookupHistoryBtn = document.getElementById("lookupHistoryBtn");

const searchInput = document.getElementById("searchInput");
const columnFilterInputs = Array.from(document.querySelectorAll("[data-column-filter]"));
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const exportAccountBtn = document.getElementById("exportAccountBtn");
const exportFilteredBtn = document.getElementById("exportFilteredBtn");
const kiemSoatInput = document.getElementById("kiemSoatInput");
const transferBtn = document.getElementById("transferBtn");
const selectAll = document.getElementById("selectAll");
const controlNav = document.getElementById("controlNav");
const controlInboxBtn = document.getElementById("controlInboxBtn");
const departmentListBtn = document.getElementById("departmentListBtn");
const reportPanel = document.getElementById("reportPanel");
const reportEmployeeSelect = document.getElementById("reportEmployeeSelect");
const reportTypeSelect = document.getElementById("reportTypeSelect");
const reportResult = document.getElementById("reportResult");
const pendingControlTab = document.getElementById("pendingControlTab");
const resolvedControlTab = document.getElementById("resolvedControlTab");
const pendingControlCount = document.getElementById("pendingControlCount");
const resolvedControlCount = document.getElementById("resolvedControlCount");
const pagination = document.getElementById("pagination");
const paginationSummary = document.getElementById("paginationSummary");
const pageIndicator = document.getElementById("pageIndicator");
const previousPageBtn = document.getElementById("previousPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const controlReviewDialog = document.getElementById("controlReviewDialog");
const controlReviewForm = document.getElementById("controlReviewForm");
const reviewReasonInput = document.getElementById("reviewReasonInput");
const reviewMessage = document.getElementById("reviewMessage");

const loaiHoSoSelect = document.getElementById("loaiHoSo");
const editLoaiHoSo = document.getElementById("editLoaiHoSo");
const createBtn = document.getElementById("createBtn");
const ngayThucHienInput = document.getElementById("ngayThucHien");
const nhanVienInput = document.getElementById("nhanVienThucHien");

const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");
const importBtn = document.getElementById("importBtn");
const importDialog = document.getElementById("importDialog");
const importForm = document.getElementById("importForm");
const importFileInput = document.getElementById("importFileInput");
const importResult = document.getElementById("importResult");
const importMessage = document.getElementById("importMessage");
const submitImportBtn = document.getElementById("submitImportBtn");

let allRecords = [];
let currentUser = null;
let visibleRecords = [];
let procedureTypes = [];
let selectedType = "";
let isControlDashboard = false;
let currentMode = "personal";
let departmentRecords = [];
let controlNotificationTimer = null;
const pageSize = 10;
let currentPage = 1;
let controlStatusTab = "pending";
let reviewTarget = null;
const selectedRecordStts = new Set();
let pendingAvatarDataUrl = "";
const MAX_AVATAR_DATA_URL_LENGTH = 40000;
const DATE_FILTER_FIELDS = new Set([
  "ngayThucHien",
  "ngayChuyenKiemSoat",
  "ngayKiemSoatDuyet",
]);
const EXPORTABLE_RECORD_FIELDS = [
  "stt",
  "maCan",
  "tenKhachHang",
  "loaiHoSo",
  "nhanVienThucHien",
  "ngayThucHien",
  "trangThaiHoSo",
  "kiemSoat",
  "ngayChuyenKiemSoat",
  "ngayKiemSoatDuyet",
  "yeuCauBoSung",
  "yeuCauBoSung",
];

function canonicalText(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function setMessage(el, text, ok) {
  el.textContent = text;
  el.className = ok ? "message ok" : "message err";
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch (_error) {
    return null;
  }
}

function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateInputValue(value) {
  const text = String(value || "").trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return text;
  }

  const displayMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!displayMatch) {
    return "";
  }

  const [, day, month, year] = displayMatch;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function displayDate(value) {
  const inputValue = dateInputValue(value);
  if (!inputValue) {
    return value || "-";
  }
  const [year, month, day] = inputValue.split("-");
  return `${day}/${month}/${year}`;
}

function isSpecialistRole(user) {
  const role = canonicalText(user?.role);
  return role === canonicalText("admin") || role === canonicalText("chuyen vien thu tuc");
}

function isControlRole(user) {
  const role = canonicalText(user?.role);
  return [
    canonicalText("Kiem Soat"),
    canonicalText("Chuyen Vien Kiem Soat"),
  ].includes(role);
}

async function apiFetch(url, options = {}) {
  const token = localStorage.getItem("accessToken");
  const headers = {
    ...(options.headers || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMessage = body?.message || body || "Request failed";
    const error = new Error(errorMessage);
    error.details = body;
    throw error;
  }

  return body;
}

async function downloadProcedureExport(scope) {
  const button = scope === "account" ? exportAccountBtn : exportFilteredBtn;
  button.disabled = true;
  setMessage(
    listMessageEl,
    scope === "account" ? "Đang xuất hồ sơ tài khoản..." : "Đang xuất danh sách theo bộ lọc...",
    true
  );

  try {
    const token = localStorage.getItem("accessToken");
    const payload = {
      scope,
      view: currentMode,
      selectedType,
      search: searchInput.value,
      columnFilters: Object.fromEntries(
        columnFilterInputs.map((input) => [input.dataset.columnFilter, input.value])
      ),
      controlStatusTab,
      reportEmployee: currentMode === "report" ? reportEmployeeSelect.value : "",
      reportType: currentMode === "report" ? reportTypeSelect.value : "",
    };
    const response = await fetch("/procedures/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Không thể xuất danh sách Excel");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `BCCN_${scope === "account" ? "Tai_Khoan" : "Theo_Bo_Loc"}_${getTodayDate()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(listMessageEl, "Đã tải file Excel thành công.", true);
  } catch (error) {
    setMessage(listMessageEl, error.message || "Không thể xuất danh sách Excel", false);
  } finally {
    button.disabled = false;
  }
}

function setViewLoggedIn(isLoggedIn) {
  loginView.classList.toggle("hidden", isLoggedIn);
  dashboardView.classList.toggle("hidden", !isLoggedIn);
}

function getUserInitials(fullName) {
  return String(fullName || "NV")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function renderAvatar(image, initials, avatar, fullName) {
  initials.textContent = getUserInitials(fullName);
  if (avatar) {
    image.src = avatar;
    image.classList.remove("hidden");
    initials.classList.add("hidden");
  } else {
    image.removeAttribute("src");
    image.classList.add("hidden");
    initials.classList.remove("hidden");
  }
  if (image === profileAvatarImage) {
    profileAvatarButton.disabled = !avatar;
    profileAvatarButton.setAttribute(
      "aria-label",
      avatar ? "Xem ảnh đại diện kích thước lớn" : "Chưa có ảnh đại diện"
    );
  }
}

function applyProfileUser(user) {
  currentUser = { ...currentUser, ...user };
  welcomeText.textContent = `${user.fullName || "Nhân viên"} (${user.role || "User"})`;
  renderAvatar(userAvatarImage, userAvatarInitials, user.avatar, user.fullName);
  document.getElementById("profileFullName").textContent = user.fullName || "—";
  document.getElementById("profilePosition").textContent = user.position || "—";
  document.getElementById("profileUsername").textContent = user.username || "—";
  document.getElementById("profileRole").textContent = user.role || "—";
  renderAvatar(profileAvatarImage, profileAvatarInitials, user.avatar, user.fullName);
}

async function loadProfileData() {
  const data = await apiFetch("/auth/me", { method: "GET" });
  applyProfileUser(data.user);
}

async function compressAvatar(file) {
  const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!supportedTypes.has(file.type)) {
    throw new Error("Vui lòng chọn ảnh JPEG, PNG hoặc WebP");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Ảnh gốc không được lớn hơn 10 MB");
  }

  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 20000000) {
      throw new Error("Kích thước ảnh quá lớn để xử lý an toàn");
    }

    for (const maxDimension of [256, 192, 128]) {
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Trình duyệt không thể xử lý ảnh này");
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.78, 0.62, 0.46]) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (dataUrl.length <= MAX_AVATAR_DATA_URL_LENGTH) {
          return dataUrl;
        }
      }
    }
  } finally {
    bitmap.close();
  }

  throw new Error("Không thể nén ảnh xuống dưới 40 KB. Vui lòng chọn ảnh khác.");
}

async function openProfilePage() {
  document.querySelector(".report-card").classList.add("hidden");
  profilePage.classList.remove("hidden");
  setMessage(profileMessage, "Đang tải thông tin cá nhân...", true);
  try {
    await loadProfileData();
    setMessage(profileMessage, "", true);
  } catch (error) {
    setMessage(profileMessage, error.message || "Không thể tải thông tin cá nhân", false);
  }
}

function closeProfilePage() {
  profilePage.classList.add("hidden");
  document.querySelector(".report-card").classList.remove("hidden");
  profileAvatarInput.value = "";
  pendingAvatarDataUrl = "";
  uploadAvatarBtn.disabled = true;
  changePasswordForm.reset();
  setMessage(profileMessage, "", true);
}

function validateCreateForm() {
  const maCan = document.getElementById("maCan").value.trim();
  const tenKhachHang = document.getElementById("tenKhachHang").value.trim();
  const loaiHoSo = loaiHoSoSelect.value;
  const ngayThucHien = ngayThucHienInput.value;
  const today = getTodayDate();
  const isValid = Boolean(
    maCan && tenKhachHang && loaiHoSo && ngayThucHien && ngayThucHien <= today
  );
  createBtn.disabled = !isValid;
}

function fillTypeOptions(types) {
  procedureTypes = types;
  const previousCreate = loaiHoSoSelect.value;
  const previousEdit = editLoaiHoSo.value;

  loaiHoSoSelect.innerHTML = '<option value="">Chọn loại hồ sơ</option>';
  editLoaiHoSo.innerHTML = "";

  types.forEach((type) => {
    const createOption = document.createElement("option");
    createOption.value = type;
    createOption.textContent = type;
    loaiHoSoSelect.appendChild(createOption);

    const editOption = document.createElement("option");
    editOption.value = type;
    editOption.textContent = type;
    editLoaiHoSo.appendChild(editOption);
  });

  loaiHoSoSelect.value = previousCreate;
  editLoaiHoSo.value = previousEdit;
}

function getStatusClass(status) {
  const text = canonicalText(status);
  if (text.includes("chuyen kiem soat")) {
    return "status-transfer";
  }
  if (text.includes("duyet") || text.includes("da kiem soat")) {
    return "status-approved";
  }
  if (text.includes("bo sung") || text.includes("sua doi") || text.includes("tra thu tuc")) {
    return "status-fix";
  }
  return "status-draft";
}

function statusDisplay(status) {
  if (!status) {
    return "Đang soạn thảo";
  }
  return status;
}

function fillControlOptions(controls) {
  const previousValue = kiemSoatInput.value;
  kiemSoatInput.innerHTML = '<option value="">Chọn người kiểm soát</option>';

  controls.forEach((control) => {
    const option = document.createElement("option");
    option.value = control.fullName;
    option.textContent = control.fullName;
    kiemSoatInput.appendChild(option);
  });

  if (controls.some((control) => control.fullName === previousValue)) {
    kiemSoatInput.value = previousValue;
  }
  transferBtn.disabled = controls.length === 0;
}

function renderTabs() {
  const records = filteredRecords(false);
  const total = records.length;
  const counts = procedureTypes.map((type) => ({
    type,
    count: records.filter((item) => canonicalText(item.loaiHoSo) === canonicalText(type)).length,
  }));

  tabFilters.innerHTML = "";

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = `tab-btn ${selectedType ? "" : "active"}`;
  allButton.innerHTML = `Tất cả thủ tục <span class="tab-count">${total}</span>`;
  allButton.addEventListener("click", () => {
    selectedType = "";
    applyFilters();
  });
  tabFilters.appendChild(allButton);

  counts.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `tab-btn ${canonicalText(selectedType) === canonicalText(item.type) ? "active" : ""}`;
    btn.innerHTML = `${item.type} <span class="tab-count">${item.count}</span>`;
    btn.addEventListener("click", () => {
      selectedType = item.type;
      applyFilters();
    });
    tabFilters.appendChild(btn);
  });
}

function sortByCreationDate(records) {
  return [...records].sort((left, right) => {
    const leftDate = dateInputValue(left.ngayThucHien);
    const rightDate = dateInputValue(right.ngayThucHien);
    if (leftDate !== rightDate) {
      if (!leftDate) return 1;
      if (!rightDate) return -1;
      return rightDate.localeCompare(leftDate);
    }
    return String(right.stt || "").localeCompare(
      String(left.stt || ""),
      "vi",
      { numeric: true }
    );
  });
}

function canTransferToControl(record) {
  return canonicalText(record.trangThaiHoSo) !== canonicalText("ĐÃ KIỂM SOÁT");
}

function renderTable(records) {
  procedureTableBody.innerHTML = "";
  const controlView = currentMode !== "personal";
  const procedureTable = document.getElementById("procedureTable");
  procedureTable.classList.toggle("control-table", controlView);
  procedureTable.classList.toggle("personal-view", currentMode === "personal");
  procedureTable.classList.toggle("control-inbox-view", currentMode === "controlInbox");
  const selectableRecords = records.filter(canTransferToControl);
  document.getElementById("selectHeaderCell").classList.toggle(
    "hidden",
    controlView || selectableRecords.length === 0
  );
  document.getElementById("actionHeader").textContent =
    currentMode === "controlInbox" ? "Xử lý" : currentMode === "personal" ? "Thao tác" : "";

  if (!records.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 12;
    cell.textContent = "Không có dữ liệu";
    row.appendChild(cell);
    procedureTableBody.appendChild(row);
    selectAll.checked = false;
    selectAll.indeterminate = false;
    return;
  }

  records.forEach((record) => {
    const statusText = statusDisplay(record.trangThaiHoSo);
    const tr = document.createElement("tr");
    const selectionCell = document.createElement("td");
    selectionCell.className = "select-cell";
    if (currentMode === "personal" && canTransferToControl(record)) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.stt = record.stt;
      checkbox.className = "record-check";
      checkbox.checked = selectedRecordStts.has(String(record.stt));
      selectionCell.appendChild(checkbox);
    }
    tr.appendChild(selectionCell);

    [
      record.maCan || "-",
      record.tenKhachHang || "-",
      record.loaiHoSo || "-",
      record.nhanVienThucHien || "-",
      displayDate(record.ngayThucHien),
    ].forEach((value, index) => {
      const cell = document.createElement("td");
      if (index === 0) {
        const apartment = document.createElement("strong");
        apartment.textContent = value;
        cell.appendChild(apartment);
      } else {
        cell.textContent = value;
      }
      if (index === 1) {
        cell.className = "customer-name-column";
      }
      if (index === 3) {
        cell.className = "staff-col specialist-column";
      }
      tr.appendChild(cell);
    });

    const statusCell = document.createElement("td");
    const statusBadge = document.createElement("span");
    statusBadge.className = `status-badge ${getStatusClass(statusText)}`;
    statusBadge.textContent = statusText;
    statusCell.appendChild(statusBadge);
    tr.appendChild(statusCell);

    [
      record.kiemSoat || "-",
      displayDate(record.ngayChuyenKiemSoat),
      displayDate(record.ngayKiemSoatDuyet),
      record.yeuCauBoSung || "-",
    ].forEach((value, index) => {
      const cell = document.createElement("td");
      if (index === 0) {
        cell.className = "control-column";
      }
      cell.textContent = value;
      tr.appendChild(cell);
    });

    const actionCell = document.createElement("td");
    actionCell.className = "action-cell";
    if (
      currentMode === "controlInbox" &&
      canonicalText(record.trangThaiHoSo) === canonicalText("CHUYỂN KIỂM SOÁT")
    ) {
      const approveButton = document.createElement("button");
      approveButton.type = "button";
      approveButton.className = "review-btn review-approve";
      approveButton.dataset.approve = record.stt;
      approveButton.textContent = "Duyệt";
      const returnButton = document.createElement("button");
      returnButton.type = "button";
      returnButton.className = "review-btn review-return";
      returnButton.dataset.return = record.stt;
      returnButton.textContent = "Trả hồ sơ";
      actionCell.append(approveButton, returnButton);
    } else if (currentMode === "personal") {
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "edit-btn";
      editButton.dataset.edit = record.stt;
      editButton.textContent = "Sửa";
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "delete-btn";
      deleteButton.dataset.delete = record.stt;
      deleteButton.textContent = "Xóa";
      actionCell.append(editButton, deleteButton);
    }
    tr.appendChild(actionCell);
    procedureTableBody.appendChild(tr);
  });

  const checkboxes = Array.from(procedureTableBody.querySelectorAll(".record-check"));
  const checkedCount = checkboxes.filter((checkbox) => checkbox.checked).length;
  selectAll.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
  selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
}

function populateColumnFilterOptions() {
  columnFilterInputs.forEach((filter) => {
    if (filter.tagName !== "SELECT") {
      return;
    }

    const selectedValue = filter.value;
    const field = filter.dataset.columnFilter;
    const placeholder = filter.options[0]?.textContent || "Tất cả";
    const values = [...new Set(
      allRecords
        .map((record) => String(record[field] || "").trim())
        .filter(Boolean)
    )].sort((left, right) => left.localeCompare(right, "vi"));
    filter.replaceChildren(new Option(placeholder, ""));
    values.forEach((value) => filter.add(new Option(value, value)));
    filter.value = values.includes(selectedValue) ? selectedValue : "";
  });
}

function filteredRecords(includeType = true) {
  const keyword = canonicalText(searchInput.value);
  const activeColumnFilters = columnFilterInputs
    .map((input) => [input.dataset.columnFilter, input.value])
    .filter(([, value]) => value);

  return allRecords.filter((item) => {
    const status = canonicalText(item.trangThaiHoSo);
    const isPending = status === canonicalText("CHUYỂN KIỂM SOÁT");
    const isResolved =
      status === canonicalText("ĐÃ KIỂM SOÁT") ||
      status === canonicalText("TRẢ THỦ TỤC");
    const matchControlStatus =
      currentMode !== "controlInbox" ||
      (controlStatusTab === "pending" ? isPending : isResolved);
    const matchType = !includeType || !selectedType
      ? true
      : canonicalText(item.loaiHoSo) === canonicalText(selectedType);
    const matchSearch = keyword
      ? EXPORTABLE_RECORD_FIELDS.some((field) => canonicalText(item[field]).includes(keyword))
      : true;
    const matchColumns = activeColumnFilters.every(([field, value]) => {
      if (DATE_FILTER_FIELDS.has(field)) {
        return dateInputValue(item[field]) === value;
      }
      return canonicalText(item[field]) === canonicalText(value);
    });

    return matchControlStatus && matchType && matchSearch && matchColumns;
  });
}

function applyFilters(resetPage = true) {
  populateColumnFilterOptions();
  if (resetPage) {
    currentPage = 1;
  }
  visibleRecords = sortByCreationDate(filteredRecords());
  const totalPages = Math.max(1, Math.ceil(visibleRecords.length / pageSize));
  currentPage = Math.min(currentPage, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageRecords = visibleRecords.slice(startIndex, startIndex + pageSize);

  totalCountEl.textContent = String(visibleRecords.length);
  tableCountEl.textContent = String(pageRecords.length);
  pagination.classList.toggle("hidden", visibleRecords.length <= pageSize);
  paginationSummary.textContent = visibleRecords.length
    ? `Hiển thị ${startIndex + 1}–${Math.min(startIndex + pageSize, visibleRecords.length)} trong ${visibleRecords.length} hồ sơ`
    : "Không có hồ sơ";
  pageIndicator.textContent = `Trang ${currentPage} / ${totalPages}`;
  previousPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= totalPages;
  renderTabs();
  renderTable(pageRecords);
  setMessage(listMessageEl, `Đang hiển thị ${visibleRecords.length} hồ sơ`, true);
}

async function loadProcedureTypes() {
  const data = await apiFetch("/procedures/types", { method: "GET" });
  fillTypeOptions(data.types || []);
  renderTabs();
}

async function loadControlUsers() {
  const data = await apiFetch("/procedures/controls", { method: "GET" });
  fillControlOptions(data.controls || []);
}

async function loadMyProcedures() {
  const data = await apiFetch("/procedures/my", { method: "GET" });
  currentMode = "personal";
  allRecords = data.records || [];
  const availableRecords = new Map(
    allRecords.map((record) => [String(record.stt), record])
  );
  selectedRecordStts.forEach((stt) => {
    const record = availableRecords.get(stt);
    if (!record || !canTransferToControl(record)) {
      selectedRecordStts.delete(stt);
    }
  });
  applyFilters();
}

async function loadControlInbox() {
  const data = await apiFetch("/procedures/control/inbox", { method: "GET" });
  currentMode = "controlInbox";
  allRecords = data.records || [];
  pendingControlCount.textContent = String(data.pendingCount || 0);
  pendingControlCount.setAttribute("aria-label", `${data.pendingCount || 0} hồ sơ chờ kiểm soát`);
  const resolvedCount = allRecords.filter((record) => {
    const status = canonicalText(record.trangThaiHoSo);
    return status === canonicalText("ĐÃ KIỂM SOÁT") || status === canonicalText("TRẢ THỦ TỤC");
  }).length;
  resolvedControlCount.textContent = String(resolvedCount);
  document.getElementById("filterCaption").textContent = "Lọc hồ sơ được giao";
  applyFilters();
}

async function loadControlNotificationCount() {
  const data = await apiFetch("/procedures/control/notifications", { method: "GET" });
  const previousCount = Number(pendingControlCount.textContent);
  pendingControlCount.textContent = String(data.pendingCount || 0);
  pendingControlCount.setAttribute("aria-label", `${data.pendingCount || 0} hồ sơ chờ kiểm soát`);
  resolvedControlCount.textContent = String(data.resolvedCount || 0);
  if (Number(data.pendingCount || 0) !== previousCount) {
    await loadControlInbox();
  }
}

async function loadDepartmentRecords() {
  const data = await apiFetch("/procedures/department", { method: "GET" });
  departmentRecords = data.records || [];
  fillReportOptions();
}

function fillReportOptions() {
  const previousEmployee = reportEmployeeSelect.value;
  const previousType = reportTypeSelect.value;
  const employees = [...new Set(
    departmentRecords.map((record) => record.nhanVienThucHien).filter(Boolean)
  )].sort((left, right) => left.localeCompare(right, "vi"));
  const types = [...new Set(
    departmentRecords.map((record) => record.loaiHoSo).filter(Boolean)
  )].sort((left, right) => left.localeCompare(right, "vi"));

  reportEmployeeSelect.replaceChildren(new Option("Tất cả nhân viên", ""));
  reportTypeSelect.replaceChildren(new Option("Tất cả thủ tục", ""));
  employees.forEach((employee) => reportEmployeeSelect.add(new Option(employee, employee)));
  types.forEach((type) => reportTypeSelect.add(new Option(type, type)));
  reportEmployeeSelect.value = employees.includes(previousEmployee) ? previousEmployee : "";
  reportTypeSelect.value = types.includes(previousType) ? previousType : "";
}

async function showDepartmentList() {
  if (!departmentRecords.length) {
    await loadDepartmentRecords();
  }
  currentMode = "department";
  allRecords = departmentRecords;
  selectedType = "";
  searchInput.value = "";
  document.getElementById("controlStatusTabs").classList.add("hidden");
  document.getElementById("filterCaption").textContent = "Lọc danh sách phòng ban";
  reportPanel.classList.add("hidden");
  setActiveControlNav(departmentListBtn);
  applyFilters();
}

async function generateDepartmentReport() {
  const params = new URLSearchParams();
  if (reportEmployeeSelect.value) {
    params.set("employee", reportEmployeeSelect.value);
  }
  if (reportTypeSelect.value) {
    params.set("procedureType", reportTypeSelect.value);
  }

  const data = await apiFetch(`/procedures/department/report?${params.toString()}`, { method: "GET" });
  currentMode = "report";
  allRecords = data.records || [];
  selectedType = "";
  searchInput.value = "";
  document.getElementById("controlStatusTabs").classList.add("hidden");
  reportResult.textContent =
    `Tìm thấy ${data.total || 0} hồ sơ phù hợp với tiêu chí báo cáo.`;
  document.getElementById("filterCaption").textContent = "Kết quả báo cáo";
  applyFilters();
}

function setActiveControlNav(activeButton) {
  [controlInboxBtn, departmentListBtn].forEach((button) => {
    button.classList.toggle("active", button === activeButton);
  });
}

function setControlStatusTab(statusTab) {
  controlStatusTab = statusTab;
  pendingControlTab.classList.toggle("active", statusTab === "pending");
  resolvedControlTab.classList.toggle("active", statusTab === "resolved");
  document.getElementById("controlStatusTabs").classList.toggle(
    "hidden",
    currentMode !== "controlInbox"
  );
  applyFilters();
}

function showReviewRecordSummary(record) {
  const summary = document.getElementById("reviewRecordSummary");
  summary.replaceChildren();
  [
    ["Mã căn", record.maCan],
    ["Khách hàng", record.tenKhachHang],
    ["Loại hồ sơ", record.loaiHoSo],
    ["Nhân viên thực hiện", record.nhanVienThucHien],
    ["Ngày thực hiện", displayDate(record.ngayThucHien)],
  ].forEach(([label, value]) => {
    const line = document.createElement("p");
    const term = document.createElement("strong");
    term.textContent = `${label}: `;
    line.append(term, document.createTextNode(value || "-"));
    summary.appendChild(line);
  });
}

function appendHistoryText(parent, tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function showImportRowErrors(rowErrors) {
  importResult.replaceChildren();
  importResult.className = "import-result import-result-error";
  const title = document.createElement("strong");
  title.textContent = "Các dòng cần kiểm tra:";
  importResult.appendChild(title);

  const list = document.createElement("ul");
  rowErrors.forEach((item) => {
    const row = document.createElement("li");
    row.textContent = `Dòng ${item.row}: ${item.errors.join("; ")}`;
    list.appendChild(row);
  });
  importResult.appendChild(list);
}

async function downloadImportTemplate(event) {
  event.preventDefault();
  const token = localStorage.getItem("accessToken");
  const headers = {};
  if (token) {
    headers.Authorization = ["Bearer", token].join(" ");
  }

  try {
    const response = await fetch("/procedures/import/template", { headers });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || "Không thể tải file mẫu");
    }

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "BCCN_Mau_Import_Ho_So.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  } catch (error) {
    setMessage(importMessage, error.message || "Không thể tải file mẫu", false);
  }
}

function renderApartmentHistory(records) {
  historyList.replaceChildren();

  if (!records.length) {
    appendHistoryText(historyList, "p", "history-empty", "Chưa có hồ sơ nào được ghi nhận cho mã căn này.");
    historySummary.textContent = "Không tìm thấy hồ sơ trước đây";
    return;
  }

  historySummary.textContent = `${records.length} hồ sơ · sắp xếp ngày thực hiện mới nhất`;
  records.forEach((record) => {
    const item = document.createElement("article");
    item.className = "history-item";

    const itemHead = document.createElement("div");
    itemHead.className = "history-item-head";
    appendHistoryText(itemHead, "strong", "history-type", record.loaiHoSo || "Chưa phân loại");
    appendHistoryText(itemHead, "time", "history-date", displayDate(record.ngayThucHien));
    item.appendChild(itemHead);

    const details = document.createElement("div");
    details.className = "history-details";
    appendHistoryText(details, "span", "", `Khách hàng: ${record.tenKhachHang || "-"}`);
    appendHistoryText(details, "span", "", `Trạng thái: ${record.trangThaiHoSo || "Mới tạo"}`);
    appendHistoryText(details, "span", "", `Nhân viên: ${record.nhanVienThucHien || "-"}`);
    if (record.kiemSoat) {
      appendHistoryText(details, "span", "", `Kiểm soát: ${record.kiemSoat}`);
    }
    item.appendChild(details);
    if (record.tenKhachHang) {
      const selectCustomerButton = document.createElement("button");
      selectCustomerButton.type = "button";
      selectCustomerButton.className = "history-select-customer";
      selectCustomerButton.dataset.customerName = record.tenKhachHang;
      selectCustomerButton.textContent = `Dùng tên "${record.tenKhachHang}"`;
      item.appendChild(selectCustomerButton);
    }
    historyList.appendChild(item);
  });
}

async function lookupApartmentHistory() {
  const maCan = document.getElementById("maCan").value.trim();
  if (!maCan) {
    setMessage(createMessageEl, "Vui lòng nhập mã căn trước khi tra cứu", false);
    document.getElementById("maCan").focus();
    return;
  }

  historyPanel.classList.remove("hidden");
  lookupHistoryBtn.setAttribute("aria-expanded", "true");
  historyApartment.textContent = maCan;
  historySummary.textContent = "Đang tải lịch sử...";
  historyList.replaceChildren();
  lookupHistoryBtn.disabled = true;

  try {
    const data = await apiFetch(`/procedures/history/${encodeURIComponent(maCan)}`, { method: "GET" });
    renderApartmentHistory(data.records || []);
  } catch (error) {
    historySummary.textContent = "Không thể tải lịch sử hồ sơ";
    setMessage(createMessageEl, error.message || "Tra cứu lịch sử thất bại", false);
  } finally {
    lookupHistoryBtn.disabled = false;
  }
}

function openEditDialog(record) {
  document.getElementById("editStt").value = record.stt;
  document.getElementById("editMaCan").value = record.maCan;
  document.getElementById("editTenKhachHang").value = record.tenKhachHang;
  document.getElementById("editLoaiHoSo").value = record.loaiHoSo;
  document.getElementById("editNgayThucHien").value = dateInputValue(record.ngayThucHien);
  document.getElementById("editTrangThai").value = record.trangThaiHoSo || "";
  document.getElementById("editYeuCauBoSung").value = record.yeuCauBoSung || "";
  setMessage(editMessageEl, "", true);
  editDialog.showModal();
}

function openControlReviewDialog(stt, decision) {
  const record = allRecords.find((item) => String(item.stt) === String(stt));
  if (!record) {
    setMessage(listMessageEl, "Không tìm thấy hồ sơ cần kiểm soát", false);
    return;
  }

  reviewTarget = { stt, decision };
  const isApproval = decision === "approve";
  document.getElementById("reviewDialogTitle").textContent =
    isApproval ? "Xác nhận duyệt hồ sơ" : "Xác nhận trả hồ sơ";
  document.getElementById("reviewDialogDescription").textContent =
    isApproval
      ? "Hồ sơ sẽ được ghi nhận đã kiểm soát và lưu ngày duyệt hôm nay."
      : "Hồ sơ sẽ được chuyển lại cho chuyên viên thủ tục để bổ sung hoặc sửa đổi.";
  document.getElementById("reviewDialogIcon").textContent = isApproval ? "✓" : "↩";
  document.getElementById("confirmReviewBtn").textContent =
    isApproval ? "Duyệt hồ sơ" : "Trả hồ sơ";
  document.getElementById("confirmReviewBtn").className =
    isApproval ? "btn-primary" : "btn-warn";
  document.getElementById("returnReasonLabel").classList.toggle("hidden", isApproval);
  reviewReasonInput.value = "";
  reviewMessage.textContent = "";
  reviewMessage.className = "message";
  showReviewRecordSummary(record);
  controlReviewDialog.showModal();
}

async function initDashboard() {
  const user = getStoredUser();
  if (!user) {
    setViewLoggedIn(false);
    return;
  }

  currentUser = user;
  applyProfileUser(user);
  document.querySelector(".report-card").classList.remove("hidden");
  profilePage.classList.add("hidden");
  isControlDashboard = isControlRole(user);
  selectedRecordStts.clear();
  selectAll.checked = false;
  selectAll.indeterminate = false;
  if (!isSpecialistRole(user) && !isControlDashboard) {
    setMessage(messageEl, "Tài khoản không có quyền truy cập hệ thống", false);
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setViewLoggedIn(false);
    return;
  }

  const displayName = user.fullName || "Nhan vien";
  selectedType = "";
  departmentRecords = [];
  document.querySelector(".brand-title").textContent =
    isControlDashboard ? "KIỂM SOÁT HỒ SƠ" : "BÁO CÁO CÁ NHÂN";
  document.querySelector(".brand-sub").textContent =
    isControlDashboard
      ? "Tiếp nhận, duyệt và theo dõi hồ sơ được giao kiểm soát"
      : "Theo dõi tiến độ và quản lý hồ sơ thủ tục cá nhân";
  staffNameEl.textContent = displayName;
  roleBadge.textContent = user.role || "Chuyên viên thủ tục";
  document.querySelector(".scope-badge").textContent =
    isControlDashboard ? "Phạm vi hồ sơ được giao" : "Phạm vi dữ liệu cá nhân";
  document.querySelector(".context-copy h1").textContent =
    isControlDashboard ? "Hồ sơ được giao kiểm soát" : "Danh sách hồ sơ cá nhân";
  document.querySelector(".context-copy > p").firstChild.textContent =
    isControlDashboard ? "Chuyên viên kiểm soát: " : "Hồ sơ của ";
  nhanVienInput.value = displayName;
  openCreateBtn.classList.toggle("hidden", isControlDashboard);
  importBtn.classList.toggle("hidden", isControlDashboard);
  controlNav.classList.toggle("hidden", !isControlDashboard);
  document.getElementById("transferTools").classList.toggle("hidden", isControlDashboard);
  reportPanel.classList.add("hidden");

  ngayThucHienInput.max = getTodayDate();
  if (!ngayThucHienInput.value) {
    ngayThucHienInput.value = getTodayDate();
  }

  setViewLoggedIn(true);
  if (controlNotificationTimer) {
    clearInterval(controlNotificationTimer);
    controlNotificationTimer = null;
  }

  if (isControlDashboard) {
    currentMode = "controlInbox";
    controlStatusTab = "pending";
    setActiveControlNav(controlInboxBtn);
    document.getElementById("controlStatusTabs").classList.remove("hidden");
    await Promise.all([loadProcedureTypes(), loadControlInbox()]);
    controlNotificationTimer = setInterval(() => {
      loadControlNotificationCount().catch((error) => {
        setMessage(listMessageEl, error.message || "Không thể làm mới thông báo", false);
      });
    }, 30000);
  } else {
    await Promise.all([loadProcedureTypes(), loadControlUsers(), loadMyProcedures()]);
  }
  validateCreateForm();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(messageEl, "Đang đăng nhập...", true);

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  try {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    localStorage.setItem("user", JSON.stringify(data.user));

    setMessage(messageEl, `Đăng nhập thành công: ${data.user.fullName}`, true);
    await initDashboard();
  } catch (error) {
    setMessage(messageEl, error.message || "Đăng nhập thất bại", false);
  }
});

userChip.addEventListener("click", openProfilePage);
document.getElementById("backToDashboardBtn").addEventListener("click", closeProfilePage);

profileAvatarButton.addEventListener("click", () => {
  if (!profileAvatarImage.src) {
    return;
  }
  avatarPreviewImage.src = profileAvatarImage.src;
  avatarPreviewDialog.showModal();
});

document.getElementById("closeAvatarPreviewBtn").addEventListener("click", () => {
  avatarPreviewDialog.close();
});

avatarPreviewDialog.addEventListener("close", () => {
  avatarPreviewImage.removeAttribute("src");
});

avatarPreviewDialog.addEventListener("click", (event) => {
  if (event.target === avatarPreviewDialog) {
    avatarPreviewDialog.close();
  }
});

document.getElementById("chooseAvatarBtn").addEventListener("click", () => {
  profileAvatarInput.click();
});

profileAvatarInput.addEventListener("change", async () => {
  const [file] = profileAvatarInput.files || [];
  pendingAvatarDataUrl = "";
  uploadAvatarBtn.disabled = true;
  if (!file) {
    return;
  }

  setMessage(profileMessage, "Đang tối ưu ảnh đại diện...", true);
  try {
    pendingAvatarDataUrl = await compressAvatar(file);
    renderAvatar(
      profileAvatarImage,
      profileAvatarInitials,
      pendingAvatarDataUrl,
      currentUser?.fullName
    );
    uploadAvatarBtn.disabled = false;
    setMessage(profileMessage, "Ảnh đã sẵn sàng. Nhấn “Lưu ảnh” để cập nhật.", true);
  } catch (error) {
    profileAvatarInput.value = "";
    setMessage(profileMessage, error.message || "Không thể xử lý ảnh đại diện", false);
  }
});

uploadAvatarBtn.addEventListener("click", async () => {
  if (!pendingAvatarDataUrl) {
    setMessage(profileMessage, "Vui lòng chọn ảnh trước khi lưu", false);
    return;
  }

  uploadAvatarBtn.disabled = true;
  setMessage(profileMessage, "Đang lưu ảnh đại diện...", true);
  try {
    const data = await apiFetch("/auth/profile/avatar", {
      method: "PUT",
      body: JSON.stringify({ avatar: pendingAvatarDataUrl }),
    });
    applyProfileUser(data.user);
    localStorage.setItem("user", JSON.stringify(currentUser));
    profileAvatarInput.value = "";
    pendingAvatarDataUrl = "";
    setMessage(profileMessage, data.message || "Đã cập nhật ảnh đại diện", true);
  } catch (error) {
    uploadAvatarBtn.disabled = false;
    setMessage(profileMessage, error.message || "Không thể lưu ảnh đại diện", false);
  }
});

changePasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const oldPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmNewPassword = document.getElementById("confirmNewPassword").value;
  if (newPassword !== confirmNewPassword) {
    setMessage(profileMessage, "Mật khẩu mới nhập lại chưa khớp", false);
    return;
  }
  if (newPassword.length < 8) {
    setMessage(profileMessage, "Mật khẩu mới phải có ít nhất 8 ký tự", false);
    return;
  }

  const submitButton = document.getElementById("changePasswordBtn");
  submitButton.disabled = true;
  setMessage(profileMessage, "Đang cập nhật mật khẩu...", true);
  try {
    const data = await apiFetch("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    changePasswordForm.reset();
    setMessage(profileMessage, data.message || "Đã đổi mật khẩu thành công", true);
  } catch (error) {
    setMessage(profileMessage, error.message || "Không thể đổi mật khẩu", false);
  } finally {
    submitButton.disabled = false;
  }
});

openCreateBtn.addEventListener("click", () => {
  historyPanel.classList.add("hidden");
  lookupHistoryBtn.setAttribute("aria-expanded", "false");
  document.getElementById("maCan").value = "";
  document.getElementById("tenKhachHang").value = "";
  loaiHoSoSelect.value = "";
  ngayThucHienInput.value = getTodayDate();
  nhanVienInput.value = getStoredUser()?.fullName || "";
  setMessage(createMessageEl, "", true);
  validateCreateForm();
  createDialog.showModal();
  createDialog.scrollTop = 0;
});

closeCreateBtn.addEventListener("click", () => {
  createDialog.close();
});

["maCan", "tenKhachHang", "loaiHoSo", "ngayThucHien"].forEach((id) => {
  document.getElementById(id).addEventListener("input", validateCreateForm);
  document.getElementById(id).addEventListener("change", validateCreateForm);
});

document.getElementById("maCan").addEventListener("input", () => {
  historyPanel.classList.add("hidden");
  lookupHistoryBtn.setAttribute("aria-expanded", "false");
});

lookupHistoryBtn.addEventListener("click", lookupApartmentHistory);
document.getElementById("closeHistoryBtn").addEventListener("click", () => {
  historyPanel.classList.add("hidden");
  lookupHistoryBtn.setAttribute("aria-expanded", "false");
});

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    maCan: document.getElementById("maCan").value.trim(),
    tenKhachHang: document.getElementById("tenKhachHang").value.trim(),
    loaiHoSo: loaiHoSoSelect.value,
    ngayThucHien: ngayThucHienInput.value,
  };

  try {
    const data = await apiFetch("/procedures", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    setMessage(createMessageEl, data.message || "Tạo hồ sơ thành công", true);
    createForm.reset();
    historyPanel.classList.add("hidden");
    lookupHistoryBtn.setAttribute("aria-expanded", "false");
    nhanVienInput.value = getStoredUser()?.fullName || "";
    ngayThucHienInput.value = getTodayDate();
    validateCreateForm();
    createDialog.close();
    await loadMyProcedures();
  } catch (error) {
    setMessage(createMessageEl, error.message || "Tạo hồ sơ thất bại", false);
  }
});

searchInput.addEventListener("input", () => {
  applyFilters();
});

columnFilterInputs.forEach((input) => {
  input.addEventListener("change", () => applyFilters());
});

resetFiltersBtn.addEventListener("click", () => {
  searchInput.value = "";
  columnFilterInputs.forEach((input) => {
    input.value = "";
  });
  selectedType = "";
  applyFilters();
});

exportAccountBtn.addEventListener("click", () => {
  downloadProcedureExport("account");
});

exportFilteredBtn.addEventListener("click", () => {
  downloadProcedureExport("filtered");
});

previousPageBtn.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage -= 1;
    applyFilters(false);
  }
});

nextPageBtn.addEventListener("click", () => {
  const totalPages = Math.ceil(visibleRecords.length / pageSize);
  if (currentPage < totalPages) {
    currentPage += 1;
    applyFilters(false);
  }
});

selectAll.addEventListener("change", () => {
  const checkboxes = Array.from(document.querySelectorAll(".record-check"));
  checkboxes.forEach((el) => {
    el.checked = selectAll.checked;
    if (selectAll.checked) {
      selectedRecordStts.add(String(el.dataset.stt));
    } else {
      selectedRecordStts.delete(String(el.dataset.stt));
    }
  });
  selectAll.indeterminate = false;
});

procedureTableBody.addEventListener("change", (event) => {
  const checkbox = event.target.closest(".record-check");
  if (!checkbox) {
    return;
  }
  if (checkbox.checked) {
    selectedRecordStts.add(String(checkbox.dataset.stt));
  } else {
    selectedRecordStts.delete(String(checkbox.dataset.stt));
  }
  const checkboxes = Array.from(procedureTableBody.querySelectorAll(".record-check"));
  const checkedCount = checkboxes.filter((item) => item.checked).length;
  selectAll.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
  selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
});

procedureTableBody.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  if (button.dataset.approve) {
    openControlReviewDialog(button.dataset.approve, "approve");
    return;
  }
  if (button.dataset.return) {
    openControlReviewDialog(button.dataset.return, "return");
    return;
  }
  if (button.dataset.delete) {
    const record = allRecords.find(
      (item) => String(item.stt) === String(button.dataset.delete)
    );
    if (record) {
      deleteProcedure(record).catch((error) => {
        setMessage(listMessageEl, error.message || "Không thể xóa hồ sơ", false);
      });
    }
    return;
  }

  const record = allRecords.find(
    (item) => String(item.stt) === String(button.dataset.edit)
  );
  if (record && currentMode === "personal") {
    openEditDialog(record);
  }
});

historyList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-customer-name]");
  if (!button) {
    return;
  }
  const customerNameInput = document.getElementById("tenKhachHang");
  customerNameInput.value = button.dataset.customerName;
  validateCreateForm();
  customerNameInput.focus();
});

async function deleteProcedure(record) {
  if (!window.confirm(`Bạn có chắc muốn xóa hồ sơ ${record.stt} của căn ${record.maCan}?`)) {
    return;
  }

  const data = await apiFetch(`/procedures/${encodeURIComponent(record.stt)}`, {
    method: "DELETE",
  });
  selectedRecordStts.delete(String(record.stt));
  setMessage(listMessageEl, data.message || "Đã xóa hồ sơ", true);
  await loadMyProcedures();
}

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const stt = document.getElementById("editStt").value;

  const payload = {
    tenKhachHang: document.getElementById("editTenKhachHang").value.trim(),
    loaiHoSo: document.getElementById("editLoaiHoSo").value,
    ngayThucHien: document.getElementById("editNgayThucHien").value,
    trangThaiHoSo: document.getElementById("editTrangThai").value,
    yeuCauBoSung: document.getElementById("editYeuCauBoSung").value,
  };

  try {
    const data = await apiFetch(`/procedures/${encodeURIComponent(stt)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    setMessage(editMessageEl, data.message || "Cập nhật thành công", true);
    await loadMyProcedures();
    setTimeout(() => {
      editDialog.close();
    }, 250);
  } catch (error) {
    setMessage(editMessageEl, error.message || "Cập nhật thất bại", false);
  }
});

document.getElementById("closeEditBtn").addEventListener("click", () => {
  editDialog.close();
});

document.getElementById("cancelEditBtn").addEventListener("click", () => {
  editDialog.close();
});

transferBtn.addEventListener("click", async () => {
  const transferableStts = new Set(
    allRecords
      .filter(canTransferToControl)
      .map((record) => String(record.stt))
  );
  const checkedItems = Array.from(selectedRecordStts).filter((stt) =>
    transferableStts.has(stt)
  );
  selectedRecordStts.clear();
  checkedItems.forEach((stt) => selectedRecordStts.add(stt));
  const kiemSoat = kiemSoatInput.value;

  if (!checkedItems.length) {
    setMessage(listMessageEl, "Bạn chưa chọn hồ sơ để chuyển", false);
    return;
  }

  if (!kiemSoat) {
    setMessage(listMessageEl, "Vui lòng nhập tên kiểm soát", false);
    return;
  }

  try {
    const data = await apiFetch("/procedures/transfer-control", {
      method: "POST",
      body: JSON.stringify({ sttList: checkedItems, kiemSoat }),
    });

    const transferredStts = new Set(checkedItems);
    allRecords = allRecords.map((record) =>
      transferredStts.has(String(record.stt))
        ? {
            ...record,
            trangThaiHoSo: "CHUYỂN KIỂM SOÁT",
            ngayChuyenKiemSoat: displayDate(getTodayDate()),
            kiemSoat,
          }
        : record
    );
    selectedRecordStts.clear();
    selectAll.checked = false;
    selectAll.indeterminate = false;
    applyFilters();
    setMessage(
      listMessageEl,
      `${data.updatedCount || 0} hồ sơ đã chuyển kiểm soát`,
      true
    );
  } catch (error) {
    setMessage(listMessageEl, error.message || "Không thể chuyển kiểm soát", false);
  }
});

refreshBtn.addEventListener("click", async () => {
  try {
    if (isControlDashboard) {
      await loadProcedureTypes();
      if (currentMode === "department" || currentMode === "report") {
        departmentRecords = [];
        await loadDepartmentRecords();
        if (currentMode === "report") {
          await generateDepartmentReport();
        } else {
          await showDepartmentList();
        }
      } else {
        await loadControlInbox();
      }
      await loadControlNotificationCount();
    } else {
      await Promise.all([loadProcedureTypes(), loadControlUsers(), loadMyProcedures()]);
    }
    setMessage(listMessageEl, "Đã làm mới dữ liệu", true);
  } catch (error) {
    setMessage(listMessageEl, error.message, false);
  }
});

logoutBtn.addEventListener("click", async () => {
  const refreshToken = localStorage.getItem("refreshToken");

  try {
    if (refreshToken) {
      await apiFetch("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch (_error) {
    // Keep local logout behavior even if server logout fails.
  } finally {
    if (controlNotificationTimer) {
      clearInterval(controlNotificationTimer);
      controlNotificationTimer = null;
    }
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    selectedRecordStts.clear();
    setViewLoggedIn(false);
    setMessage(messageEl, "Đã đăng xuất", true);
  }
});

controlInboxBtn.addEventListener("click", async () => {
  reportPanel.classList.add("hidden");
  selectedType = "";
  searchInput.value = "";
  controlStatusTab = "pending";
  setActiveControlNav(controlInboxBtn);
  try {
    await loadControlInbox();
    setControlStatusTab("pending");
  } catch (error) {
    setMessage(listMessageEl, error.message || "Không thể tải hồ sơ được giao", false);
  }
});

departmentListBtn.addEventListener("click", () => {
  showDepartmentList().catch((error) => {
    setMessage(listMessageEl, error.message || "Không thể tải danh sách phòng ban", false);
  });
});

document.getElementById("reportToggleBtn").addEventListener("click", async () => {
  const opening = reportPanel.classList.contains("hidden");
  reportPanel.classList.toggle("hidden", !opening);
  if (!opening) {
    return;
  }

  setActiveControlNav(null);
  reportResult.textContent = "";
  try {
    if (!departmentRecords.length) {
      await loadDepartmentRecords();
    }
    currentMode = "report";
    allRecords = [];
    selectedType = "";
    searchInput.value = "";
    document.getElementById("filterCaption").textContent = "Kết quả báo cáo";
    applyFilters();
  } catch (error) {
    setMessage(listMessageEl, error.message || "Không thể tải dữ liệu báo cáo", false);
  }
});

document.getElementById("generateReportBtn").addEventListener("click", () => {
  generateDepartmentReport().catch((error) => {
    setMessage(listMessageEl, error.message || "Không thể tạo báo cáo", false);
  });
});

pendingControlTab.addEventListener("click", () => setControlStatusTab("pending"));
resolvedControlTab.addEventListener("click", () => setControlStatusTab("resolved"));

document.getElementById("cancelReviewBtn").addEventListener("click", () => {
  controlReviewDialog.close();
});

controlReviewForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!reviewTarget) {
    return;
  }

  const { stt, decision } = reviewTarget;
  const confirmButton = document.getElementById("confirmReviewBtn");
  confirmButton.disabled = true;
  setMessage(reviewMessage, "Đang lưu kết quả kiểm soát...", true);
  try {
    const data = await apiFetch(
      `/procedures/control/${encodeURIComponent(stt)}/${decision}`,
      {
        method: "POST",
        body: JSON.stringify({
          yeuCauBoSung: decision === "return" ? reviewReasonInput.value.trim() : "",
        }),
      }
    );
    controlReviewDialog.close();
    reviewTarget = null;
    allRecords = allRecords.map((record) =>
      String(record.stt) === String(data.record.stt)
        ? { ...record, ...data.record }
        : record
    );
    pendingControlCount.textContent = String(
      Math.max(0, Number(pendingControlCount.textContent) - 1)
    );
    resolvedControlCount.textContent = String(
      Number(resolvedControlCount.textContent) + 1
    );
    applyFilters();
    setMessage(listMessageEl, data.message, true);
  } catch (error) {
    setMessage(reviewMessage, error.message || "Không thể cập nhật kết quả kiểm soát", false);
  } finally {
    confirmButton.disabled = false;
  }
});

importBtn.addEventListener("click", () => {
  importForm.reset();
  importResult.replaceChildren();
  importResult.className = "import-result hidden";
  setMessage(importMessage, "", true);
  submitImportBtn.disabled = true;
  importDialog.showModal();
});

document.getElementById("closeImportBtn").addEventListener("click", () => {
  importDialog.close();
});

document.getElementById("downloadTemplateBtn").addEventListener("click", downloadImportTemplate);

importFileInput.addEventListener("change", () => {
  submitImportBtn.disabled = !importFileInput.files?.length;
  importResult.replaceChildren();
  importResult.className = "import-result hidden";
  setMessage(importMessage, "", true);
});

importForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = importFileInput.files?.[0];
  if (!file) {
    setMessage(importMessage, "Vui lòng chọn file Excel .xlsx", false);
    return;
  }

  submitImportBtn.disabled = true;
  submitImportBtn.textContent = "Đang kiểm tra...";
  setMessage(importMessage, "Đang kiểm tra và nhập dữ liệu...", true);
  importResult.classList.add("hidden");

  try {
    const formData = new FormData();
    formData.append("file", file);
    const data = await apiFetch("/procedures/import", {
      method: "POST",
      body: formData,
    });

    setMessage(importMessage, data.message, true);
    await loadMyProcedures();
    importForm.reset();
  } catch (error) {
    setMessage(importMessage, error.message || "Import Excel thất bại", false);
    if (error.details?.rowErrors?.length) {
      showImportRowErrors(error.details.rowErrors);
    } else {
      importResult.className = "import-result import-result-error";
      importResult.textContent = error.details?.failedRow
        ? `Lỗi tại dòng ${error.details.failedRow}. ${error.message}`
        : error.message;
    }
  } finally {
    submitImportBtn.textContent = "Kiểm tra & nhập";
    submitImportBtn.disabled = !importFileInput.files?.length;
  }
});

initDashboard().catch((error) => {
  setViewLoggedIn(false);
  setMessage(messageEl, error.message || "Khởi tạo giao diện thất bại", false);
});
