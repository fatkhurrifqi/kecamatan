# Website Pelayanan & Keuangan Kantor Kecamatan (MVP)

Aplikasi ini dibangun sesuai PRD: pengelolaan data layanan masyarakat (permohonan surat,
data penduduk, pengaduan) dan pencatatan pembayaran manual (tunai/transfer) beserta
riwayat & rekap kas — **tanpa payment gateway online**.

## Fitur yang sudah tersedia

**Fase 1 (MVP):**
- Login & role (Super Admin / Petugas / Bendahara)
- CRUD Jenis Layanan/Surat
- CRUD Permohonan Surat (nomor tiket otomatis, status: diajukan → diproses → selesai/ditolak)
- Pencatatan Pembayaran Manual (tunai/transfer) + upload bukti (opsional) + Riwayat Transaksi

**Fase 2:**
- Laporan & Rekap Kas (per hari, per jenis layanan, per petugas) + Export Excel
- CRUD Data Penduduk & Pengaduan Masyarakat
- Audit log (Log Aktivitas) untuk semua perubahan data pembayaran — transaksi **tidak pernah
  dihapus permanen**, hanya bisa diubah menjadi status "Dibatalkan" agar riwayat kas tetap utuh.

**Belum diimplementasikan (Fase 3, opsional untuk pengembangan lanjutan):**
- Halaman publik untuk warga (form pengajuan surat online, cek status, form pengaduan online)
- Modul Pengumuman/Berita (tabel & seed data sudah disiapkan di database, tinggal dibuatkan
  halaman CRUD & halaman publiknya)

## Teknologi

- **Backend:** Node.js + Express
- **Tampilan:** EJS (server-rendered) + Tailwind CSS (via CDN)
- **Database:** File JSON lokal (`data/db.json`) — dipilih agar staf kecamatan tidak perlu
  instalasi MySQL/PostgreSQL terpisah. Cukup untuk skala kecamatan (ratusan-ribuan data/tahun)
  sesuai kebutuhan non-fungsional di PRD. Backup = salin file `data/db.json`.
  > Jika di kemudian hari volume data sangat besar atau butuh multi-server, tabel `data/db.json`
  > bisa dimigrasikan ke MySQL/PostgreSQL — struktur data (lihat `lib/db.js`) sudah mengikuti
  > skema tabel di PRD (`users`, `penduduk`, `jenis_layanan`, `permohonan`, `pembayaran`,
  > `pengaduan`, `pengumuman`, `log_aktivitas`).
- **Upload bukti bayar:** Multer (disimpan di `public/uploads/`)
- **Export laporan:** ExcelJS

## Cara Menjalankan

Pastikan **Node.js** (versi 18 ke atas) sudah terinstall di komputer.

```bash
# 1. Masuk ke folder project
cd kecamatan-app

# 2. Install dependencies
npm install

# 3. (Opsional) copy file .env.example jadi .env untuk ganti secret session
cp .env.example .env

# 4. Jalankan aplikasi
npm start
```

Buka browser ke: **http://localhost:3000**

Saat pertama kali dijalankan, sistem otomatis membuat `data/db.json` berisi data contoh
(seed): akun login, beberapa jenis layanan, dan 2 data penduduk contoh.

## Akun Login Contoh (Seed)

| Username | Password | Role |
|---|---|---|
| admin | admin123 | Super Admin (Camat/Sekcam) — akses penuh |
| petugas1 | petugas123 | Petugas — CRUD permohonan & input pembayaran |
| kasir1 | kasir123 | Bendahara — kelola pembayaran & laporan keuangan |

**⚠️ Penting:** Ganti semua password default ini sebelum digunakan di lingkungan produksi
(lewat halaman database `data/db.json` sementara ini, atau tambahkan halaman "ganti password"
sebagai pengembangan lanjutan).

## Struktur Folder

```
kecamatan-app/
  server.js              # entry point aplikasi
  lib/db.js              # lapisan "database" (baca/tulis data/db.json)
  middleware/auth.js      # cek login & cek role
  routes/                 # semua route (auth, permohonan, pembayaran, laporan, dst)
  views/                  # tampilan EJS
  public/                 # CSS statis & folder upload bukti bayar
  data/db.json             # database (dibuat otomatis saat pertama kali run)
```

## Alur Penggunaan Singkat

1. Login sebagai **petugas1** → buat **Permohonan Surat** baru untuk warga (pilih dari daftar
   Data Penduduk, atau tambah data penduduk baru dulu jika belum ada).
2. Jika layanan berbayar, dari halaman detail permohonan klik **"Catat Pembayaran"** → isi
   nominal, metode bayar, upload bukti (opsional).
3. Login sebagai **kasir1** (Bendahara) untuk memverifikasi transaksi, edit jika ada kesalahan
   input, atau membatalkan transaksi (tidak dihapus permanen, demi audit).
4. Login sebagai **admin** (Super Admin) untuk melihat **Laporan & Rekap Kas** dan mengekspor
   ke Excel, serta meninjau **Log Aktivitas** (audit trail).

## Catatan Keamanan untuk Produksi

- Ganti `SESSION_SECRET` di file `.env` dengan string acak yang panjang.
- Jalankan di belakang HTTPS (misalnya via reverse proxy Nginx + Let's Encrypt) jika diakses
  dari luar jaringan lokal kantor.
- Jadwalkan backup rutin (harian/mingguan) untuk file `data/db.json` dan folder `public/uploads/`.
- Session saat ini disimpan di memori server (cukup untuk 1 proses/instance); jika perlu
  restart server tanpa memutus sesi pengguna, pertimbangkan session store berbasis file.
