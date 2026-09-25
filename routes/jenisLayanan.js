const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { requireAuth, requireRole, setFlash } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', (req, res) => {
  res.render('jenis-layanan/index', { title: 'Jenis Layanan', list: db.getAll('jenis_layanan') });
});

router.get('/baru', requireRole('superadmin', 'petugas'), (req, res) => {
  res.render('jenis-layanan/form', { title: 'Tambah Jenis Layanan', item: null });
});

router.post('/', requireRole('superadmin', 'petugas'), (req, res) => {
  const { nama_layanan, tarif, keterangan } = req.body;
  if (!nama_layanan) {
    setFlash(req, 'error', 'Nama layanan wajib diisi.');
    return res.redirect('/jenis-layanan/baru');
  }
  db.insert('jenis_layanan', { nama_layanan, tarif: Number(tarif) || 0, keterangan: keterangan || '' });
  setFlash(req, 'success', 'Jenis layanan berhasil ditambahkan.');
  res.redirect('/jenis-layanan');
});

router.get('/:id/edit', requireRole('superadmin', 'petugas'), (req, res) => {
  const item = db.getById('jenis_layanan', req.params.id);
  if (!item) return res.status(404).send('Data tidak ditemukan');
  res.render('jenis-layanan/form', { title: 'Edit Jenis Layanan', item });
});

router.post('/:id', requireRole('superadmin', 'petugas'), (req, res) => {
  const { nama_layanan, tarif, keterangan } = req.body;
  db.update('jenis_layanan', req.params.id, { nama_layanan, tarif: Number(tarif) || 0, keterangan: keterangan || '' });
  setFlash(req, 'success', 'Jenis layanan berhasil diperbarui.');
  res.redirect('/jenis-layanan');
});

router.post('/:id/hapus', requireRole('superadmin'), (req, res) => {
  const dipakai = db.getAll('permohonan').some((p) => String(p.jenis_layanan_id) === String(req.params.id));
  if (dipakai) {
    setFlash(req, 'error', 'Tidak bisa dihapus, jenis layanan ini sudah dipakai pada permohonan.');
    return res.redirect('/jenis-layanan');
  }
  db.remove('jenis_layanan', req.params.id);
  setFlash(req, 'success', 'Jenis layanan dihapus.');
  res.redirect('/jenis-layanan');
});

module.exports = router;
