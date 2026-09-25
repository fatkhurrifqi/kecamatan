const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { requireAuth, setFlash } = require('../middleware/auth');

router.use(requireAuth);

function enrich(p) {
  const penduduk = db.getById('penduduk', p.penduduk_id);
  const layanan = db.getById('jenis_layanan', p.jenis_layanan_id);
  const petugas = db.getById('users', p.petugas_id);
  return Object.assign({}, p, {
    penduduk_nama: penduduk ? penduduk.nama : '(data dihapus)',
    jenis_layanan_nama: layanan ? layanan.nama_layanan : '(data dihapus)',
    tarif: layanan ? layanan.tarif : 0,
    petugas_nama: petugas ? petugas.nama : '-'
  });
}

function genNomorTiket() {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TIK-${ymd}-${rand}`;
}

router.get('/', (req, res) => {
  const { status, jenis_layanan_id, q } = req.query;
  let list = db.getAll('permohonan').map(enrich);
  if (status) list = list.filter((p) => p.status === status);
  if (jenis_layanan_id) list = list.filter((p) => String(p.jenis_layanan_id) === String(jenis_layanan_id));
  if (q) list = list.filter((p) => p.penduduk_nama.toLowerCase().includes(q.toLowerCase()) || p.nomor_tiket.toLowerCase().includes(q.toLowerCase()));
  list.sort((a, b) => new Date(b.tanggal_ajuan) - new Date(a.tanggal_ajuan));
  res.render('permohonan/index', {
    title: 'Permohonan Surat', list,
    jenisLayananList: db.getAll('jenis_layanan'),
    filter: { status: status || '', jenis_layanan_id: jenis_layanan_id || '', q: q || '' }
  });
});

router.get('/baru', (req, res) => {
  res.render('permohonan/form', {
    title: 'Permohonan Surat Baru',
    item: null,
    pendudukList: db.getAll('penduduk'),
    jenisLayananList: db.getAll('jenis_layanan')
  });
});

router.post('/', (req, res) => {
  const { penduduk_id, jenis_layanan_id, keterangan } = req.body;
  if (!penduduk_id || !jenis_layanan_id) {
    setFlash(req, 'error', 'Pemohon dan jenis layanan wajib dipilih.');
    return res.redirect('/permohonan/baru');
  }
  const row = db.insert('permohonan', {
    penduduk_id, jenis_layanan_id,
    nomor_tiket: genNomorTiket(),
    tanggal_ajuan: new Date().toISOString(),
    status: 'diajukan',
    petugas_id: req.session.user.id,
    keterangan: keterangan || ''
  });
  db.log(req.session.user.id, 'create', 'permohonan', row.id, `Buat permohonan ${row.nomor_tiket}`);
  setFlash(req, 'success', `Permohonan berhasil dibuat dengan No. Tiket ${row.nomor_tiket}.`);
  res.redirect(`/permohonan/${row.id}`);
});

router.get('/:id', (req, res) => {
  const item = db.getById('permohonan', req.params.id);
  if (!item) return res.status(404).send('Data tidak ditemukan');
  const pembayaran = db.getAll('pembayaran')
    .filter((p) => String(p.permohonan_id) === String(item.id))
    .map((p) => Object.assign({}, p, { petugas_nama: (db.getById('users', p.petugas_id) || {}).nama || '-' }));
  res.render('permohonan/show', { title: 'Detail Permohonan', item: enrich(item), pembayaran });
});

router.get('/:id/edit', (req, res) => {
  const item = db.getById('permohonan', req.params.id);
  if (!item) return res.status(404).send('Data tidak ditemukan');
  res.render('permohonan/form', {
    title: 'Edit Permohonan',
    item,
    pendudukList: db.getAll('penduduk'),
    jenisLayananList: db.getAll('jenis_layanan')
  });
});

router.post('/:id', (req, res) => {
  const { penduduk_id, jenis_layanan_id, keterangan } = req.body;
  db.update('permohonan', req.params.id, { penduduk_id, jenis_layanan_id, keterangan: keterangan || '' });
  db.log(req.session.user.id, 'update', 'permohonan', req.params.id, 'Edit data permohonan');
  setFlash(req, 'success', 'Permohonan diperbarui.');
  res.redirect(`/permohonan/${req.params.id}`);
});

router.post('/:id/status', (req, res) => {
  const { status } = req.body;
  const valid = ['diajukan', 'diproses', 'selesai', 'ditolak'];
  if (!valid.includes(status)) return res.redirect(`/permohonan/${req.params.id}`);
  db.update('permohonan', req.params.id, { status });
  db.log(req.session.user.id, 'update-status', 'permohonan', req.params.id, `Status -> ${status}`);
  setFlash(req, 'success', `Status permohonan diubah menjadi "${status}".`);
  res.redirect(`/permohonan/${req.params.id}`);
});

module.exports = router;
