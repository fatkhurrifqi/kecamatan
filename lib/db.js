// lib/db.js
// Lapisan "database" sederhana berbasis file JSON.
// Cocok untuk skala kecamatan (ratusan-ribuan data/tahun) tanpa perlu
// instalasi server database terpisah (MySQL/PostgreSQL).
// Backup cukup dengan menyalin file data/db.json.

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');
const FALLBACK_DB_PATH = path.join('/tmp', 'kecamatan-app', 'db.json');

function resolveDbPath() {
  const primaryDir = path.dirname(DB_PATH);

  try {
    fs.mkdirSync(primaryDir, { recursive: true });
    fs.accessSync(primaryDir, fs.constants.W_OK | fs.constants.R_OK);
    return DB_PATH;
  } catch (error) {
    const fallbackDir = path.dirname(FALLBACK_DB_PATH);
    fs.mkdirSync(fallbackDir, { recursive: true });
    return FALLBACK_DB_PATH;
  }
}

const FINAL_DB_PATH = resolveDbPath();

function seedData() {
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: 1,
        username: 'admin',
        password_hash: bcrypt.hashSync('admin123', 8),
        nama: 'Camat / Sekretaris Kecamatan',
        role: 'superadmin',
      },
      {
        id: 2,
        username: 'petugas1',
        password_hash: bcrypt.hashSync('petugas123', 8),
        nama: 'Petugas Loket 1',
        role: 'petugas',
      },
      {
        id: 3,
        username: 'kasir1',
        password_hash: bcrypt.hashSync('kasir123', 8),
        nama: 'Bendahara / Kasir',
        role: 'bendahara',
      },
    ],
    penduduk: [
      { id: 1, nik: '3301012001990001', nama: 'Budi Santoso', alamat: 'Jl. Merdeka No. 1', rt_rw: '001/002', no_hp: '081234567890' },
      { id: 2, nik: '3301015505850002', nama: 'Siti Aminah', alamat: 'Jl. Kenanga No. 5', rt_rw: '003/001', no_hp: '081298765432' },
    ],
    jenis_layanan: [
      { id: 1, nama_layanan: 'Surat Keterangan Domisili', tarif: 10000, keterangan: 'Untuk keperluan administrasi domisili' },
      { id: 2, nama_layanan: 'Surat Keterangan Tidak Mampu (SKTM)', tarif: 0, keterangan: 'Gratis, untuk bantuan sosial/beasiswa' },
      { id: 3, nama_layanan: 'Surat Pengantar KTP/KK', tarif: 5000, keterangan: 'Pengantar pembuatan KTP/KK' },
      { id: 4, nama_layanan: 'Surat Keterangan Usaha', tarif: 15000, keterangan: 'Untuk keperluan usaha/UMKM' },
    ],
    permohonan: [],
    pembayaran: [],
    pengaduan: [],
    pengumuman: [{ id: 1, judul: 'Selamat Datang', isi: 'Website pelayanan Kantor Kecamatan resmi digunakan.', tanggal_publish: now, status: 'tampil' }],
    log_aktivitas: [],
    counters: {
      users: 3,
      penduduk: 2,
      jenis_layanan: 4,
      permohonan: 0,
      pembayaran: 0,
      pengaduan: 0,
      pengumuman: 1,
      log_aktivitas: 0,
    },
  };
}

let state = null;

function load() {
  const dbPath = resolveDbPath();

  if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  if (!fs.existsSync(dbPath)) {
    state = seedData();
    persist();
    return state;
  }

  try {
    state = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  } catch (error) {
    state = seedData();
    persist();
  }

  return state;
}

function persist() {
  const dbPath = resolveDbPath();
  fs.writeFileSync(dbPath, JSON.stringify(state, null, 2), 'utf-8');
}

function nextId(table) {
  state.counters[table] = (state.counters[table] || 0) + 1;
  persist();
  return state.counters[table];
}

function getAll(table) {
  return state[table];
}

function getById(table, id) {
  return state[table].find((r) => String(r.id) === String(id));
}

function insert(table, obj) {
  const row = Object.assign({ id: nextId(table) }, obj);
  state[table].push(row);
  persist();
  return row;
}

function update(table, id, fields) {
  const row = getById(table, id);
  if (!row) return null;
  Object.assign(row, fields);
  persist();
  return row;
}

function remove(table, id) {
  const idx = state[table].findIndex((r) => String(r.id) === String(id));
  if (idx === -1) return false;
  state[table].splice(idx, 1);
  persist();
  return true;
}

function log(userId, aksi, tabelTerkait, dataId, detail) {
  insertRaw('log_aktivitas', {
    user_id: userId,
    aksi,
    tabel_terkait: tabelTerkait,
    data_id: dataId,
    waktu: new Date().toISOString(),
    detail: detail || '',
  });
}

// insert but table already has counters key handled by insert(); keep name clarity
function insertRaw(table, obj) {
  return insert(table, obj);
}

module.exports = { load, getAll, getById, insert, update, remove, log, persist };
