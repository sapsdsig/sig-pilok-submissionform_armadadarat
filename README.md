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

### Full-stack development

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Ini adalah workflow lokal normal karena frontend membutuhkan Vercel Functions `/api/*` pada origin yang sama. Credential Google tetap berada di environment server lokal (`.env` atau `.env.local`) dan tidak pernah diekspos melalui variabel `VITE_*`.

Script `npm run dev` memakai launcher lokal untuk memulai Vercel CLI, sedangkan Vercel runtime secara eksplisit menjalankan `npm run dev:vite` sebagai frontend child process. Pemisahan ini menghindari recursive-invocation guard Vercel. Port `5173` bersifat strict: startup gagal bila port sedang dipakai dan tidak diam-diam berpindah ke port lain.

### Frontend-only development

```bash
npm run dev:vite
```

Open [http://localhost:5173](http://localhost:5173). Mode ini hanya untuk UI/debugging. Vercel Functions dan route Google API tidak tersedia, sehingga master load dapat gagal secara expected. Form tetap dirender dan menampilkan status API tidak tersedia beserta tombol Retry.

## API

- `GET /api/master` — seluruh master yang sudah dinormalisasi.
- `GET /api/master?query=...` — pencarian case-insensitive berdasarkan kode, distributor, atau district.
- `GET /api/submissions/:kodePilokArmada` — `{ exists: false, data: null }` untuk data baru atau record normal untuk data existing.
- `POST /api/submissions` — membuat tepat satu row baru; mengembalikan `409` bila kode sudah memiliki submission.
- `PUT /api/submissions/:kodePilokArmada` — memperbarui row existing secara terarah; tidak melakukan append pengganti.

Method yang tidak didukung menghasilkan `405`. Error API menggunakan bentuk `{ "error": { "code": "...", "message": "..." } }` tanpa stack trace atau credential.

## Legacy Submission Migration

Audit migrasi secara read-only terlebih dahulu:

```bash
npm run migrate:legacy -- --dry-run
```

Setelah statistik diperiksa, jalankan migrasi non-destruktif dengan:

```bash
npm run migrate:legacy -- --apply
```

Mode apply membuat backup tab terverifikasi sebelum menambahkan header wajib yang hilang dan mengisi hanya timestamp legacy yang masih kosong. Nilai existing dan kolom tambahan dipertahankan; menjalankan ulang script pada data yang sudah lengkap tidak menulis perubahan baru.

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
