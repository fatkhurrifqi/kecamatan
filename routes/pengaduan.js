const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { requireAuth, setFlash } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', (req, res) => {
  const list = db.getAll('pengaduan').slice().sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  res.render('pengaduan/index', { title: 'Pengaduan Masyarakat', list });
});

router.get('/baru', (req, res) => {
  res.render('pengaduan/form', { title: 'Tambah Pengaduan' });
});

router.post('/', (req, res) => {
  const { nama, kategori, isi } = req.body;
  if (!nama || !isi) {
    setFlash(req, 'error', 'Nama dan isi pengaduan wajib diisi.');
    return res.redirect('/pengaduan/baru');
  }
  db.insert('pengaduan', { nama, kategori: kategori || 'umum', isi, status: 'diterima', tanggal: new Date().toISOString() });
  setFlash(req, 'success', 'Pengaduan tercatat.');
  res.redirect('/pengaduan');
});

router.post('/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['diterima', 'diproses', 'selesai'].includes(status)) return res.redirect('/pengaduan');
  db.update('pengaduan', req.params.id, { status });
  setFlash(req, 'success', 'Status pengaduan diperbarui.');
  res.redirect('/pengaduan');
});

module.exports = router;
