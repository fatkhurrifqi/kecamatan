const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { requireAuth, requireRole, setFlash } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', (req, res) => {
  const { q } = req.query;
  let list = db.getAll('penduduk');
  if (q) list = list.filter((p) => p.nama.toLowerCase().includes(q.toLowerCase()) || p.nik.includes(q));
  res.render('penduduk/index', { title: 'Data Penduduk', list, q: q || '' });
});

router.get('/baru', (req, res) => {
  res.render('penduduk/form', { title: 'Tambah Data Penduduk', item: null });
});

router.post('/', (req, res) => {
  const { nik, nama, alamat, rt_rw, no_hp } = req.body;
  if (!nik || !nama) {
    setFlash(req, 'error', 'NIK dan nama wajib diisi.');
    return res.redirect('/penduduk/baru');
  }
  db.insert('penduduk', { nik, nama, alamat: alamat || '', rt_rw: rt_rw || '', no_hp: no_hp || '' });
  setFlash(req, 'success', 'Data penduduk ditambahkan.');
  res.redirect('/penduduk');
});

router.get('/:id/edit', (req, res) => {
  const item = db.getById('penduduk', req.params.id);
  if (!item) return res.status(404).send('Data tidak ditemukan');
  res.render('penduduk/form', { title: 'Edit Data Penduduk', item });
});

router.post('/:id', (req, res) => {
  const { nik, nama, alamat, rt_rw, no_hp } = req.body;
  db.update('penduduk', req.params.id, { nik, nama, alamat: alamat || '', rt_rw: rt_rw || '', no_hp: no_hp || '' });
  setFlash(req, 'success', 'Data penduduk diperbarui.');
  res.redirect('/penduduk');
});

router.post('/:id/hapus', requireRole('superadmin'), (req, res) => {
  const dipakai = db.getAll('permohonan').some((p) => String(p.penduduk_id) === String(req.params.id));
  if (dipakai) {
    setFlash(req, 'error', 'Tidak bisa dihapus, penduduk ini memiliki riwayat permohonan.');
    return res.redirect('/penduduk');
  }
  db.remove('penduduk', req.params.id);
  setFlash(req, 'success', 'Data penduduk dihapus.');
  res.redirect('/penduduk');
});

module.exports = router;
