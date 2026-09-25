const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const db = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('superadmin', 'bendahara'));

function getFilteredPembayaran(req) {
  const { dari, sampai } = req.query;
  let list = db.getAll('pembayaran');
  if (dari) list = list.filter((p) => p.tanggal_bayar.slice(0, 10) >= dari);
  if (sampai) list = list.filter((p) => p.tanggal_bayar.slice(0, 10) <= sampai);
  return list.map((p) => {
    const permohonan = db.getById('permohonan', p.permohonan_id);
    const jl = permohonan ? db.getById('jenis_layanan', permohonan.jenis_layanan_id) : null;
    return Object.assign({}, p, {
      nomor_tiket: permohonan ? permohonan.nomor_tiket : '-',
      jenis_layanan_nama: jl ? jl.nama_layanan : '-',
      petugas_nama: (db.getById('users', p.petugas_id) || {}).nama || '-'
    });
  });
}

router.get('/', (req, res) => {
  const list = getFilteredPembayaran(req);
  const lunas = list.filter((p) => p.status === 'Lunas');
  const totalKas = lunas.reduce((s, p) => s + Number(p.nominal), 0);
  const totalTunai = lunas.filter((p) => p.metode_bayar === 'tunai').reduce((s, p) => s + Number(p.nominal), 0);
  const totalTransfer = lunas.filter((p) => p.metode_bayar === 'transfer').reduce((s, p) => s + Number(p.nominal), 0);

  const perJenis = {};
  lunas.forEach((p) => {
    perJenis[p.jenis_layanan_nama] = (perJenis[p.jenis_layanan_nama] || 0) + Number(p.nominal);
  });
  const perPetugas = {};
  lunas.forEach((p) => {
    perPetugas[p.petugas_nama] = (perPetugas[p.petugas_nama] || 0) + Number(p.nominal);
  });

  const perHari = {};
  lunas.forEach((p) => {
    const tgl = p.tanggal_bayar.slice(0, 10);
    perHari[tgl] = (perHari[tgl] || 0) + Number(p.nominal);
  });

  const permohonanList = db.getAll('permohonan');
  const rekapPermohonan = {};
  permohonanList.forEach((p) => {
    rekapPermohonan[p.status] = (rekapPermohonan[p.status] || 0) + 1;
  });

  res.render('laporan/index', {
    title: 'Laporan & Rekap Kas',
    filter: { dari: req.query.dari || '', sampai: req.query.sampai || '' },
    totalKas, totalTunai, totalTransfer,
    perJenis, perPetugas, perHari, rekapPermohonan,
    jumlahTransaksi: lunas.length
  });
});

router.get('/export', async (req, res) => {
  const list = getFilteredPembayaran(req);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Rekap Kas');
  sheet.columns = [
    { header: 'Tanggal', key: 'tanggal', width: 20 },
    { header: 'No. Tiket', key: 'tiket', width: 20 },
    { header: 'Jenis Layanan', key: 'layanan', width: 30 },
    { header: 'Nominal', key: 'nominal', width: 15 },
    { header: 'Metode', key: 'metode', width: 12 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Petugas', key: 'petugas', width: 20 }
  ];
  sheet.getRow(1).font = { bold: true };
  list.forEach((p) => {
    sheet.addRow({
      tanggal: new Date(p.tanggal_bayar).toLocaleString('id-ID'),
      tiket: p.nomor_tiket,
      layanan: p.jenis_layanan_nama,
      nominal: Number(p.nominal),
      metode: p.metode_bayar,
      status: p.status,
      petugas: p.petugas_nama
    });
  });
  const totalLunas = list.filter((p) => p.status === 'Lunas').reduce((s, p) => s + Number(p.nominal), 0);
  sheet.addRow({});
  const totalRow = sheet.addRow({ layanan: 'TOTAL (Lunas)', nominal: totalLunas });
  totalRow.font = { bold: true };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=rekap-kas-${Date.now()}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router;
