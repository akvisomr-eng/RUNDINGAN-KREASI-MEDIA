/**
 * Skema formulir Healthcare Enterprise HQ (holding PT, akuntansi PSAK,
 * payroll jasa medis & PPh 21, pengadaan alkes berizin).
 */

import { FormSchema } from '../components/FormulirCrud';

export const SCHEMA_HOLDING: FormSchema = {
  table: 'clinics',
  title: 'Formulir Data Entitas Hukum PT & Cabang Klinik',
  subtitle:
    'Pendataan badan hukum (KBLI 86104 / 86901), akta AHU, NPWP, NIB OSS, dan klasifikasi tiap cabang fasyankes.',
  regulation: 'UU No. 17 Tahun 2023 • KBLI 86104/86901 • Permenkes No. 34 Tahun 2022',
  primaryField: 'name',
  secondaryField: 'code',
  statusField: 'accreditation_status',
  columns: [
    { key: 'code', label: 'Kode Cabang', width: '130px' },
    { key: 'name', label: 'Nama Fasyankes' },
    { key: 'city', label: 'Kota', width: '120px' },
    { key: 'accreditation_status', label: 'Akreditasi', width: '120px' },
    { key: 'dinkes_license_number', label: 'Izin Dinkes' },
    { key: 'head_of_clinic_name', label: 'Kepala Klinik', width: '180px' },
  ],
  fields: [
    { key: 'code', label: 'Kode Cabang', type: 'text', section: 'A. Identitas Cabang', required: true, placeholder: 'KLN-TW-KDR-01' },
    { key: 'name', label: 'Nama Fasyankes', type: 'text', section: 'A. Identitas Cabang', required: true, span: 2 },
    { key: 'clinic_classification', label: 'Klasifikasi Klinik', type: 'select', section: 'A. Identitas Cabang', options: [{ value: 'KLINIK_PRATAMA', label: 'Klinik Pratama' }, { value: 'KLINIK_UTAMA', label: 'Klinik Utama' }, { value: 'KLINIK_UTAMA_REHABILITASI_MEDIK', label: 'Klinik Utama Rehabilitasi Medik' }] },
    { key: 'accreditation_status', label: 'Status Akreditasi', type: 'select', section: 'A. Identitas Cabang', required: true, options: [{ value: 'BELUM_AKREDITASI', label: 'Belum Akreditasi' }, { value: 'MADYA', label: 'Madya' }, { value: 'UTAMA', label: 'Utama' }, { value: 'PARIPURNA', label: 'Paripurna' }], regulation: 'Permenkes 34/2022' },
    { key: 'dinkes_license_number', label: 'Nomor Izin Operasional Dinkes', type: 'text', section: 'B. Legalitas', required: true, span: 2 },
    { key: 'oss_nib', label: 'NIB OSS', type: 'text', section: 'B. Legalitas' },
    { key: 'fasyankes_code', label: 'Kode Fasyankes Kemenkes', type: 'text', section: 'B. Legalitas', required: true },
    { key: 'satusehat_org_id', label: 'Organization ID SATUSEHAT', type: 'text', section: 'B. Legalitas' },
    { key: 'head_of_clinic_name', label: 'Nama Kepala Klinik / Dokter PJ', type: 'text', section: 'C. Penanggung Jawab', required: true, span: 2 },
    { key: 'phone', label: 'Telepon', type: 'text', section: 'C. Penanggung Jawab' },
    { key: 'address', label: 'Alamat', type: 'textarea', section: 'C. Penanggung Jawab', span: 3 },
    { key: 'city', label: 'Kota/Kabupaten', type: 'text', section: 'C. Penanggung Jawab', required: true },
    { key: 'province', label: 'Provinsi', type: 'text', section: 'C. Penanggung Jawab', required: true },
    { key: 'monthly_revenue_target_idr', label: 'Target Pendapatan Bulanan (Rp)', type: 'money', section: 'D. Target Kinerja', min: 0 },
  ],
};

export const SCHEMA_JURNAL: FormSchema = {
  table: 'finance_journal_entries',
  title: 'Formulir Jurnal Umum Akuntansi (PSAK)',
  subtitle:
    'Setiap transaksi dicatat ganda (debit-kredit) dengan nomor jurnal, modul sumber, dan akun COA yang seimbang.',
  regulation: 'PSAK 1 & PSAK 72 • SAK Indonesia',
  primaryField: 'description',
  secondaryField: 'journal_number',
  statusField: 'source_module',
  autoNumber: { field: 'journal_number', prefix: 'JU/2026/' },
  columns: [
    { key: 'journal_number', label: 'No. Jurnal', width: '140px' },
    { key: 'entry_date', label: 'Tanggal', type: 'date', width: '110px' },
    { key: 'description', label: 'Keterangan' },
    { key: 'debit_account_code', label: 'Debit', width: '100px' },
    { key: 'credit_account_code', label: 'Kredit', width: '100px' },
    { key: 'amount_idr', label: 'Nominal', type: 'money', width: '130px' },
  ],
  fields: [
    { key: 'journal_number', label: 'Nomor Jurnal', type: 'text', section: 'A. Identitas Jurnal', required: true },
    { key: 'entry_date', label: 'Tanggal Entri', type: 'date', section: 'A. Identitas Jurnal', required: true },
    { key: 'source_module', label: 'Modul Sumber', type: 'select', section: 'A. Identitas Jurnal', options: [{ value: 'KASIR', label: 'Kasir & Tagihan' }, { value: 'PAKET', label: 'Paket Sesi' }, { value: 'PAYROLL', label: 'Payroll Jasa Medis' }, { value: 'PENGADAAN', label: 'Pengadaan Alkes' }, { value: 'MANUAL', label: 'Jurnal Manual' }] },
    { key: 'description', label: 'Keterangan Transaksi', type: 'textarea', section: 'B. Pencatatan Ganda', span: 3, required: true },
    { key: 'debit_account_code', label: 'Kode Akun Debit', type: 'text', section: 'B. Pencatatan Ganda', required: true, placeholder: '1-1001' },
    { key: 'credit_account_code', label: 'Kode Akun Kredit', type: 'text', section: 'B. Pencatatan Ganda', required: true, placeholder: '4-4001' },
    { key: 'amount_idr', label: 'Nominal (Rp)', type: 'money', section: 'B. Pencatatan Ganda', required: true, min: 0 },
    { key: 'posted_by', label: 'Diposting Oleh', type: 'text', section: 'C. Otorisasi', required: true },
  ],
};

export const SCHEMA_SUPPLIER: FormSchema = {
  table: 'procurement_suppliers',
  title: 'Formulir Master Pemasok Alkes Berizin (PAK/NIE)',
  subtitle:
    'Pemasok alat kesehatan wajib memiliki izin PAK (Penyalur Alat Kesehatan) dan produknya memiliki NIE Kemenkes.',
  regulation: 'Permenkes No. 14 Tahun 2021 • Izin PAK & NIE Kemenkes',
  primaryField: 'supplier_name',
  secondaryField: 'supplier_code',
  statusField: 'category_supplied',
  columns: [
    { key: 'supplier_code', label: 'Kode', width: '110px' },
    { key: 'supplier_name', label: 'Nama Pemasok' },
    { key: 'pak_alkes_license', label: 'Izin PAK', width: '170px' },
    { key: 'category_supplied', label: 'Kategori' },
    { key: 'contact_person', label: 'Kontak', width: '160px' },
    { key: 'phone', label: 'Telepon', width: '140px' },
  ],
  fields: [
    { key: 'supplier_code', label: 'Kode Pemasok', type: 'text', section: 'A. Identitas Pemasok', required: true, placeholder: 'SUP-001' },
    { key: 'supplier_name', label: 'Nama Perusahaan Pemasok', type: 'text', section: 'A. Identitas Pemasok', required: true, span: 2 },
    { key: 'pak_alkes_license', label: 'Nomor Izin PAK Alkes', type: 'text', section: 'A. Identitas Pemasok', required: true, regulation: 'Wajib berizin Kemenkes' },
    { key: 'category_supplied', label: 'Kategori Barang', type: 'select', section: 'A. Identitas Pemasok', options: [{ value: 'ALAT_TERAPI_WICARA', label: 'Alat Terapi Wicara' }, { value: 'ALKES_MEDIS', label: 'Alkes Medis' }, { value: 'BAHAN_HABIS_PAKAI', label: 'Bahan Habis Pakai' }, { value: 'APD', label: 'APD' }] },
    { key: 'contact_person', label: 'Nama Kontak Person', type: 'text', section: 'B. Kontak', required: true },
    { key: 'phone', label: 'Nomor Telepon', type: 'text', section: 'B. Kontak', required: true },
  ],
};

export const SCHEMA_PO: FormSchema = {
  table: 'procurement_purchase_orders',
  title: 'Formulir Purchase Order (PO) Pengadaan Alkes Pusat',
  subtitle:
    'PO pusat untuk cabang dengan verifikasi NIE Kemenkes dan persetujuan berjenjang sebelum penerbitan.',
  regulation: 'Permenkes No. 14 Tahun 2021 • Pengadaan Barang Fasyankes',
  primaryField: 'items_summary',
  secondaryField: 'po_number',
  statusField: 'status',
  autoNumber: { field: 'po_number', prefix: 'PO/2026/' },
  columns: [
    { key: 'po_number', label: 'No. PO', width: '130px' },
    { key: 'items_summary', label: 'Rincian Barang' },
    { key: 'total_amount_idr', label: 'Nilai', type: 'money', width: '140px' },
    { key: 'nie_kemenkes_verified', label: 'NIE ✓', type: 'boolean', width: '70px' },
    { key: 'status', label: 'Status', width: '130px' },
    { key: 'ordered_at', label: 'Tanggal', type: 'datetime', width: '150px' },
  ],
  fields: [
    { key: 'po_number', label: 'Nomor PO', type: 'text', section: 'A. Identitas PO', required: true },
    { key: 'ordered_at', label: 'Tanggal Pemesanan', type: 'datetime', section: 'A. Identitas PO', required: true },
    { key: 'status', label: 'Status PO', type: 'select', section: 'A. Identitas PO', required: true, options: [{ value: 'DRAFT', label: 'Draft' }, { value: 'DISETUJUI', label: 'Disetujui' }, { value: 'DIKIRIM', label: 'Dikirim ke Pemasok' }, { value: 'DITERIMA', label: 'Diterima' }, { value: 'DIBATALKAN', label: 'Dibatalkan' }] },
    { key: 'items_summary', label: 'Rincian Barang & Jumlah', type: 'textarea', section: 'B. Rincian', span: 3, required: true, placeholder: '15 Set Probe Oromotor Steril, 50 Box Masker Medis…' },
    { key: 'total_amount_idr', label: 'Total Nilai PO (Rp)', type: 'money', section: 'B. Rincian', required: true, min: 0 },
    { key: 'nie_kemenkes_verified', label: 'NIE Kemenkes Terverifikasi', type: 'boolean', section: 'C. Kepatuhan', regulation: 'Wajib sebelum penerimaan barang' },
  ],
};

export const ENTERPRISE_SCHEMAS: Record<string, FormSchema> = {
  holding: SCHEMA_HOLDING,
  jurnal: SCHEMA_JURNAL,
  supplier: SCHEMA_SUPPLIER,
  po: SCHEMA_PO,
};
