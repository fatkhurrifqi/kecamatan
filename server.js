require('dotenv').config();
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const path = require('path');

const db = require('./lib/db');
const { requireAuth, requireRole } = require('./middleware/auth');
const { locals } = require('./middleware/auth');

db.load();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'ubah-secret-ini-di-produksi',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 8 * 60 * 60 * 1000 }, // 8 jam
  }),
);

app.use(locals);

// Routes
app.use('/', require('./routes/auth'));
app.use('/jenis-layanan', require('./routes/jenisLayanan'));
app.use('/permohonan', require('./routes/permohonan'));
app.use('/pembayaran', require('./routes/pembayaran'));
app.use('/laporan', require('./routes/laporan'));
app.use('/penduduk', require('./routes/penduduk'));
app.use('/pengaduan', require('./routes/pengaduan'));

// Dashboard
app.get('/', requireAuth, (req, res) => {
  const permohonanAll = db.getAll('permohonan');
  const now = new Date();
  const bulanIni = permohonanAll.filter((p) => {
    const t = new Date(p.tanggal_ajuan);
    return t.getMonth() === now.getMonth() && t.getFullYear() === now.getFullYear();
  });
  const pembayaranBulanIni = db.getAll('pembayaran').filter((p) => {
    const t = new Date(p.tanggal_bayar);
    return p.status === 'Lunas' && t.getMonth() === now.getMonth() && t.getFullYear() === now.getFullYear();
  });
  const kasBulanIni = pembayaranBulanIni.reduce((s, p) => s + Number(p.nominal), 0);
  const pengaduanAktif = db.getAll('pengaduan').filter((p) => p.status !== 'selesai').length;

  const permohonanTerbaru = permohonanAll
    .slice()
    .sort((a, b) => new Date(b.tanggal_ajuan) - new Date(a.tanggal_ajuan))
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      nomor_tiket: p.nomor_tiket,
      tanggal_ajuan: p.tanggal_ajuan,
      status: p.status,
      penduduk_nama: (db.getById('penduduk', p.penduduk_id) || {}).nama || '-',
      jenis_layanan_nama: (db.getById('jenis_layanan', p.jenis_layanan_id) || {}).nama_layanan || '-',
    }));

  res.render('dashboard', {
    title: 'Dashboard',
    stats: {
      totalPermohonanBulanIni: bulanIni.length,
      menunggu: permohonanAll.filter((p) => p.status === 'diajukan').length,
      pengaduanAktif,
      kasBulanIni,
      permohonanTerbaru,
    },
  });
});

// Log aktivitas (superadmin only)
app.get('/log-aktivitas', requireAuth, requireRole('superadmin'), (req, res) => {
  const list = db
    .getAll('log_aktivitas')
    .slice()
    .sort((a, b) => new Date(b.waktu) - new Date(a.waktu))
    .slice(0, 300)
    .map((l) => Object.assign({}, l, { user_nama: (db.getById('users', l.user_id) || {}).nama || '-' }));
  res.render('log-aktivitas/index', { title: 'Log Aktivitas', list });
});

// 404
app.use((req, res) => {
  res.status(404).send('Halaman tidak ditemukan');
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SIM Kecamatan berjalan di http://localhost:${PORT}`);
  });
}

module.exports = app;
