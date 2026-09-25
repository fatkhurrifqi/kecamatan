const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../lib/db');
const { requireAuth, requireRole, setFlash } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.jpg', '.jpeg', '.png', '.pdf'].includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('Format file tidak didukung (gunakan JPG/PNG/PDF)'), ok);
  }
});

router.use(requireAuth);

function enrich(pb) {
  const permohonan = db.getById('permohonan', pb.permohonan_id);
  const petugas = db.getById('users', pb.petugas_id);
  let penduduk_nama = '-', jenis_layanan_nama = '-', nomor_tiket = '-';
  if (permohonan) {
    nomor_tiket = permohonan.nomor_tiket;
    const pd = db.getById('penduduk', permohonan.penduduk_id);
    const jl = db.getById('jenis_layanan', permohonan.jenis_layanan_id);
    penduduk_nama = pd ? pd.nama : '-';
    jenis_layanan_nama = jl ? jl.nama_layanan : '-';
  }
  return Object.assign({}, pb, {
    petugas_nama: petugas ? petugas.nama : '-',
    penduduk_nama, jenis_layanan_nama, nomor_tiket
  });
}

// Riwayat / daftar transaksi dengan filter
router.get('/', (req, res) => {
  const { tanggal, status, metode_bayar, q } = req.query;
  let list = db.getAll('pembayaran').map(enrich);
  if (tanggal) list = list.filter((p) => p.tanggal_bayar.slice(0, 10) === tanggal);
  if (status) list = list.filter((p) => p.status === status);
  if (metode_bayar) list = list.filter((p) => p.metode_bayar === metode_bayar);
  if (q) list = list.filter((p) => p.penduduk_nama.toLowerCase().includes(q.toLowerCase()) || p.nomor_tiket.toLowerCase().includes(q.toLowerCase()));
  list.sort((a, b) => new Date(b.tanggal_bayar) - new Date(a.tanggal_bayar));
  const total = list.filter((p) => p.status === 'Lunas').reduce((s, p) => s + Number(p.nominal), 0);
  res.render('pembayaran/index', {
    title: 'Riwayat Pembayaran', list, total,
    filter: { tanggal: tanggal || '', status: status || '', metode_bayar: metode_bayar || '', q: q || '' }
  });
});

router.get('/baru', (req, res) => {
  const { permohonan_id } = req.query;
  const permohonan = permohonan_id ? db.getById('permohonan', permohonan_id) : null;
  if (permohonan_id && !permohonan) return res.status(404).send('Permohonan tidak ditemukan');
  const permohonanDetail = permohonan ? Object.assign({}, permohonan, {
    penduduk_nama: (db.getById('penduduk', permohonan.penduduk_id) || {}).nama,
    jenis_layanan_nama: (db.getById('jenis_layanan', permohonan.jenis_layanan_id) || {}).nama_layanan,
    tarif: (db.getById('jenis_layanan', permohonan.jenis_layanan_id) || {}).tarif
  }) : null;
  const permohonanList = db.getAll('permohonan').filter((p) => p.status !== 'ditolak').map((p) => ({
    id: p.id, nomor_tiket: p.nomor_tiket,
    label: `${p.nomor_tiket} — ${(db.getById('penduduk', p.penduduk_id) || {}).nama} — ${(db.getById('jenis_layanan', p.jenis_layanan_id) || {}).nama_layanan}`
  }));
  res.render('pembayaran/form', { title: 'Catat Pembayaran', permohonanDetail, permohonanList, item: null });
});

router.post('/', upload.single('bukti_file'), (req, res) => {
  const { permohonan_id, nominal, metode_bayar, status, catatan } = req.body;
  if (!permohonan_id || !nominal || !metode_bayar) {
    setFlash(req, 'error', 'Permohonan, nominal, dan metode bayar wajib diisi.');
    return res.redirect('/pembayaran/baru' + (permohonan_id ? `?permohonan_id=${permohonan_id}` : ''));
  }
  const row = db.insert('pembayaran', {
    permohonan_id,
    nominal: Number(nominal),
    metode_bayar,
    tanggal_bayar: new Date().toISOString(),
    status: status || 'Lunas',
    petugas_id: req.session.user.id,
    bukti_file: req.file ? '/uploads/' + req.file.filename : null,
    catatan: catatan || ''
  });
  db.log(req.session.user.id, 'create', 'pembayaran', row.id, `Catat pembayaran Rp${row.nominal} (${row.metode_bayar})`);
  setFlash(req, 'success', 'Pembayaran berhasil dicatat.');
  res.redirect('/pembayaran');
});

router.get('/:id/edit', requireRole('superadmin', 'bendahara'), (req, res) => {
  const item = db.getById('pembayaran', req.params.id);
  if (!item) return res.status(404).send('Data tidak ditemukan');
  res.render('pembayaran/edit', { title: 'Edit Pembayaran', item: enrich(item) });
});

router.post('/:id', requireRole('superadmin', 'bendahara'), upload.single('bukti_file'), (req, res) => {
  const item = db.getById('pembayaran', req.params.id);
  if (!item) return res.status(404).send('Data tidak ditemukan');
  const { nominal, metode_bayar, status, catatan } = req.body;
  const fields = { nominal: Number(nominal), metode_bayar, status, catatan: catatan || '' };
  if (req.file) fields.bukti_file = '/uploads/' + req.file.filename;
  db.update('pembayaran', req.params.id, fields);
  db.log(req.session.user.id, 'update', 'pembayaran', req.params.id, `Edit pembayaran -> Rp${fields.nominal}, status ${fields.status}`);
  setFlash(req, 'success', 'Data pembayaran diperbarui.');
  res.redirect('/pembayaran');
});

// Sesuai catatan PRD: jangan hapus permanen, gunakan status "Dibatalkan" agar riwayat kas tetap utuh.
router.post('/:id/batalkan', requireRole('superadmin', 'bendahara'), (req, res) => {
  db.update('pembayaran', req.params.id, { status: 'Dibatalkan' });
  db.log(req.session.user.id, 'batalkan', 'pembayaran', req.params.id, 'Pembayaran dibatalkan (soft-cancel, tidak dihapus)');
  setFlash(req, 'success', 'Transaksi dibatalkan (tetap tersimpan untuk audit).');
  res.redirect('/pembayaran');
});

module.exports = router;
