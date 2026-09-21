# PILOK - Armada Darat

Aplikasi web untuk membaca, membuat, dan memperbarui data Armada Darat PILOK. UI React berkomunikasi dengan API serverless pada origin yang sama; hanya server yang mengakses Google Sheets dan kredensial OAuth.

## Tech stack

- React, TypeScript strict, Vite, dan Tailwind CSS
- React Hook Form dan Zod
- Vercel TypeScript API routes
- Google APIs SDK dengan OAuth refresh token
- Vitest dan Testing Library

## Arsitektur

```text
React UI
  -> src/services/armadaRepository.ts (same-origin HTTP)
  -> api/* (Vercel routes)
  -> server/services/ArmadaService
  -> server/sheets/GoogleSheetsArmadaRepository
  -> Google Sheets API
```

Business logic server memvalidasi payload, mengambil Distributor Group dan District Name dari master, menghitung ulang Total, dan menentukan timestamp. Route tidak mengirim raw row Google Sheets kepada browser.

## Environment

Salin `.env.example` menjadi `.env` dan isi seluruh konfigurasi berikut:

```env
VITE_APP_NAME="PILOK - Armada Darat"

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_SPREADSHEET_ID=
GOOGLE_MASTER_SHEET_NAME=master_data
GOOGLE_SUBMISSION_SHEET_NAME=submission_pilok_armada_darat
```

Hanya `VITE_APP_NAME` yang dapat masuk ke bundle browser. Client secret, refresh token, access token, dan ID spreadsheet bersifat server-only. `.env` diabaikan Git dan `.env.example` tidak berisi credential nyata.

## Local Development

Prasyarat: Node.js 18+ dan npm.

```bash
npm install
copy .env.example .env
```

Frontend-only development:

```bash
npm run dev
```

Vite berjalan pada `http://localhost:5173`. Port dibuat strict agar Vite tidak diam-diam berpindah ke port lain yang mudah tertukar dengan aplikasi berbeda. Workflow ini hanya menjalankan UI; route `/api/*` dan operasi Google tidak tersedia. Form tetap dirender dan menampilkan status API tidak tersedia beserta tombol Retry.

Full-stack development:

```bash
npm run dev:full
```

Vercel runtime berjalan pada `http://localhost:3000` dan menjalankan frontend bersama TypeScript Functions di `api/`. Workflow ini memerlukan konfigurasi Google server-side di `.env`. Script `dev:full` tidak memanggil dirinya sendiri: Vercel menjalankan Vite sebagai frontend child process, sedangkan `npm run dev` tetap merupakan command frontend-only.

## API

- `GET /api/master` — seluruh master yang sudah dinormalisasi.
- `GET /api/master?query=...` — pencarian case-insensitive berdasarkan kode, distributor, atau district.
- `GET /api/submissions/:kodePilokArmada` — `{ exists: false, data: null }` untuk data baru atau record normal untuk data existing.
- `POST /api/submissions` — membuat tepat satu row baru; mengembalikan `409` bila kode sudah memiliki submission.
- `PUT /api/submissions/:kodePilokArmada` — memperbarui row existing secara terarah; tidak melakukan append pengganti.

Method yang tidak didukung menghasilkan `405`. Error API menggunakan bentuk `{ "error": { "code": "...", "message": "..." } }` tanpa stack trace atau credential.

## Struktur Google Sheets

Sheet master default `master_data` membutuhkan header:

```text
Kode Pilok Armada | DISTRIBUTOR GROUP | DISTRICT NAME
```

Sheet submission default `submission_pilok_armada_darat` membutuhkan:

```text
kode_pilok_armada
DISTRIBUTOR GROUP
DISTRICT NAME
2/4/6/8/10/16/24/32 Ton Milik
2/4/6/8/10/16/24/32 Ton Sewa
Total
created_at
updated_at
```

Integrasi membaca header terlebih dahulu, mendeteksi kolom wajib yang hilang atau terduplikasi, dan mempertahankan kolom tambahan ketika memperbarui row. Blank numeric cells dibaca sebagai nol; nilai negatif, desimal, non-finite, atau non-numeric dianggap kerusakan data.

Untuk kompatibilitas data legacy, header `Kode Pilok Armada` diterima sebagai alias tunggal bagi `kode_pilok_armada`. Jika kedua bentuk hadir sekaligus, validasi gagal sebagai header ambigu/duplikat.

## Identifier, create, dan update

`kode_pilok_armada` adalah satu-satunya business key dan identifier submission. Tidak ada `submission_id`, UUID, atau ID auto-increment.

- Create memeriksa master dan submission existing sebelum append.
- Update harus menemukan tepat satu row; nol row menghasilkan `404`, lebih dari satu menghasilkan `409` data-integrity conflict.
- Distributor Group dan District Name selalu diambil dari master terkini.
- Total selalu dihitung ulang dari 16 kuantitas oleh server.
- Create mengisi `created_at` dan `updated_at` dengan waktu yang sama.
- Update mempertahankan `created_at` dan memperbarui `updated_at`.
- Timestamp memakai `Asia/Jakarta` dan format `DD-MM-YYYY HH:mm:ss`, tanpa bergantung timezone runtime Vercel.

## Verification

Verifikasi otomatis tidak membutuhkan Google credential:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Verifikasi integrasi nyata bersifat read-only dan membutuhkan `.env` serta akses spreadsheet:

```bash
npm run verify:google
```

Script memeriksa OAuth, akses spreadsheet, keberadaan kedua sheet, header wajib, dan parsing sample master. Script tidak menulis atau mengubah row.

## Security

- OAuth dibuat hanya dalam modul `server/`.
- Payload browser tidak dipercaya untuk Distributor Group, District Name, Total, atau timestamp.
- Semua kuantitas divalidasi ulang oleh Zod pada server.
- Update menggunakan range row yang ditemukan dan menolak kode duplikat.
- Same-origin digunakan tanpa wildcard CORS.
- Error publik tidak membawa stack trace, token, secret, maupun objek Google mentah.

## Remaining work

Deployment memerlukan pengisian environment Vercel dan pemberian akses spreadsheet kepada akun OAuth yang dikonfigurasi. Migrasi atau pembersihan data legacy `data_pilok_armada` berada di luar Phase 2 dan tidak dijalankan otomatis. Tidak ada fitur upload atau Google Drive pada aplikasi ini.
