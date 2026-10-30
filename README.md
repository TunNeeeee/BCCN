# BCCN - Auth + Procedure Workflow with Google Sheets

Backend Node.js/Express using Google Sheets as database (no SQL).

## 1) Google Sheet structure

### Sheet DATA_NV

- A: STT
- B: HO TEN
- C: CHUC VU
- D: USERNAME
- E: PASSWORD
- F: PHAN QUYEN

Roles currently supported:

- Admin
- Giam Doc
- Kiem Soat
- Chuyen Vien Thu Tuc

### Sheet DATA_MASTER

- A: STT
- B: NHAN VIEN THUC HIEN
- C: MÃ CĂN
- D: TÊN KHÁCH HÀNG
- E: LOẠI HỒ SƠ
- F: NGÀY THỰC HIỆN
- G: TRANG THAI HO SO
- H: NGAY CHUYỂN KIỂM SOÁT
- I: KIEM SOAT
- J: NGAY KIEM SOAT DUYET
- K: YEU CAU BO SUNG SUA DOI

## 2) Service Account setup

1. Open Google Cloud Console.
2. Enable Google Sheets API.
3. Create Service Account and generate JSON key.
4. Share the sheet to Service Account email with Editor permission.

## 3) Environment

Copy `.env.example` to `.env` and fill:

- `JWT_SECRET`
- `REFRESH_SECRET` (or leave same as JWT secret)
- `GOOGLE_SHEET_ID`
- `GOOGLE_USERS_SHEET_NAME=DATA_NV`
- `GOOGLE_MASTER_SHEET_NAME=DATA_MASTER`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

Note: keep `GOOGLE_PRIVATE_KEY` as one line string with `\\n`.

## 4) Run

```bash
npm install
npm run start
```

Open browser: `http://localhost:3000`

This route serves a login UI, so there is no `Cannot GET /` anymore.

## 5) Deploy to Netlify

The repository includes `netlify.toml` and a Netlify Function adapter for the
Express API. Netlify serves the frontend from `public/` and rewrites `/auth`,
`/procedures`, and `/health` to that function.

1. Push the project to GitHub and import the repository in Netlify.
2. Keep the build settings from `netlify.toml`: publish directory `public`,
   functions directory `netlify/functions`, and Node.js 22.
3. In **Site configuration → Environment variables**, add the variables listed
   in `.env.example`. Copy the Google service account email and private key
   from its JSON key; enter the private key as one string with `\n` line breaks.
   Never commit `.env` or put credentials in frontend files.
4. Ensure the Google Sheet is shared with the service account email as an
   editor, then trigger a deploy.
5. Verify the deployment at `/health`; it should return `{"status":"ok"}`.

The API's Excel template download is configured as a binary Function response.
The existing 5 MB Excel upload limit should be tested against Netlify's
request-size limits for the selected plan.

## 6) Endpoints

### Login

`POST /auth/login`

```json
{
  "username": "admin",
  "password": "123456"
}
```

### Refresh token

`POST /auth/refresh-token`

```json
{
  "refreshToken": "<refresh-token>"
}
```

### Logout

`POST /auth/logout`

```json
{
  "refreshToken": "<refresh-token>"
}
```

### Current user

`GET /auth/me`

Header: `Authorization: Bearer <accessToken>`

### Change password

`POST /auth/change-password`

Header: `Authorization: Bearer <accessToken>`

```json
{
  "oldPassword": "123456",
  "newPassword": "654321"
}
```

### Forgot password

`POST /auth/forgot-password`

```json
{
  "username": "admin",
  "fullName": "Nguyen Van A"
}
```

Response returns a temporary password.

### Register (optional admin use)

`POST /auth/register`

```json
{
  "fullName": "Nguyen Van A",
  "position": "Can bo",
  "username": "admin",
  "password": "123456",
  "role": "Chuyen Vien Thu Tuc"
}
```

### Procedure types

`GET /procedures/types`

### Control users

`GET /procedures/controls`

Returns the names of users whose role is `Kiem Soat` (also accepts
`Chuyên viên Kiểm soát`) for the transfer-control dropdown.

### Control specialist workflow

Users with the `Kiem Soat` or `Chuyên viên Kiểm soát` role land on their
assigned-procedure inbox. It lists every record assigned to the signed-in
controller, sorted by execution date with the most recent first, and opens on
the `Chưa xử lý` tab. `Đã xử lý` contains approved and returned records. Both
tabs show at most 10 records per page, and the pending/resolved counts refresh
every 30 seconds.

- `GET /procedures/control/inbox` returns assigned records and `pendingCount`.
- `GET /procedures/control/notifications` returns the pending count.
- `POST /procedures/control/:stt/approve` approves a pending assigned record,
  sets its status to `ĐÃ KIỂM SOÁT`, and saves today's date as the approval date.
- `POST /procedures/control/:stt/return` sets its status to `TRẢ THỦ TỤC` and
  saves the optional `yeuCauBoSung` text.

Only the controller assigned to a pending record can approve or return it.
Both decisions require confirmation in the dashboard before they are saved.

### Department list and report

Control specialists can view the full shared sheet using
`GET /procedures/department`. `GET /procedures/department/report` accepts
optional `employee` and `procedureType` query parameters and returns the
matching records and count. The dashboard provides employee and procedure
dropdowns for generating this report. Department, report, and personal lists
are also sorted by execution date (most recent first) and paginated in groups
of 10.

### Apartment history

`GET /procedures/history/:maCan`

Returns all procedures for an apartment, ordered by `NGÀY THỰC HIỆN` descending.

### Excel import template

`GET /procedures/import/template`

Downloads `BCCN_Mau_Import_Ho_So.xlsx`. Fill the `DATA_IMPORT` sheet with
the nine columns `NHÂN VIÊN THỰC HIỆN`, `MÃ CĂN`, `TÊN KHÁCH HÀNG`,
`LOẠI HỒ SƠ`, `NGÀY THỰC HIỆN`, `TRẠNG THÁI HỒ SƠ`,
`NGÀY CHUYỂN KIỂM SOÁT`, `KIỂM SOÁT`, and `NGÀY KIỂM SOÁT DUYỆT`.
The template includes a guide and a dropdown for supported procedure types.
Dates use `DD/MM/YYYY`; a supplied control name must belong to a user with
control permissions.

### Import procedures

`POST /procedures/import` using `multipart/form-data` with the Excel file in the
`file` field. The system validates the entire workbook before writing. Rows are
matched by apartment code, customer name, and procedure type. On a match, every
non-empty value in the other six columns updates its corresponding field;
blank cells leave existing values unchanged. Rows with no changed values are
not written. New rows use the employee from Excel or default to the signed-in
user; their execution date is required. Rows the user cannot manage, ambiguous
matches, invalid dates/types, or duplicate keys in the same file are reported
without writing any rows.

### Personal list (for logged user)

`GET /procedures/my?loaiHoSo=Hop dong mua ban`

### Create procedure

`POST /procedures`

```json
{
  "maCan": "A-01",
  "loaiHoSo": "Thoa thuan ky quy",
  "ngayThucHien": "2026-10-29"
}
```

Business rules:

- `ngayThucHien` must not be greater than today.
- Procedure dates are stored and returned as `DD/MM/YYYY`; create/edit requests accept `YYYY-MM-DD` or `DD/MM/YYYY`.
- `nhanVienThucHien` is always taken from the authenticated account. `tenKhachHang` is optional.
- `maCan` cannot be duplicated in same `loaiHoSo` for: `Thoa thuan dat coc`, `Thoa thuan ky quy`, `Hop dong mua ban`.

### Edit procedure

`PUT /procedures/:stt`

Locked fields:

- `maCan`
- `tenKhachHang`

### Transfer control (bulk)

`POST /procedures/transfer-control`

```json
{
  "sttList": ["1", "2"],
  "kiemSoat": "Tran Van Kiem Soat"
}
```

This updates:

- `TRANG THAI HO SO` => `CHUYỂN KIỂM SOÁT`
- `NGAY CHUYỂN KIỂM SOÁT` => today
- `KIEM SOAT` => selected name

`kiemSoat` must match a user returned by `GET /procedures/controls`.

### Health check

`GET /health`
