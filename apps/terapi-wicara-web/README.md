# WicaraSehat Web & SIMKLINIK Desktop — Modul Mandiri Terapi Wicara

Modul terpisah (*standalone module*) berbasis **Next.js (App Router + TypeScript)** yang menyediakan **dua bagian utama ekosistem Terapi Wicara** dan terhubung langsung ke skema database yang sama (`terapi_wicara`) dengan **Aplikasi Android Terapis Wicara** (`apps/terapi-wicara-android`):

1. **Website Publik & Portal Pasien/Keluarga (`/`, `/portal-pasien`)**:
   - Profil legalitas fasyankes, nomor izin operasional Dinas Kesehatan, kode fasyankes Kemenkes, dan status akreditasi klinik.
   - Direktori Terapis Wicara lengkap dengan nomor **SIP aktif** & cakupan kewenangan klinis (transparansi UU Kesehatan No. 17/2023).
   - Katalog edukatif **5 Ruang Lingkup Terapi Wicara** (Permenkes No. 81/2014) & transparansi tarif resmi tanpa klaim berlebihan (*overclaim*).
   - **Skrining Awal Mandiri (*Red Flags* Non-Diagnostik)** komunikasi & menelan.
   - **Formulir Reservasi Online & Pra-Anamnesis** dengan persetujuan eksplisit **UU PDP No. 27/2022**.
   - **Portal Pasien & Keluarga (`/portal-pasien`)** dengan verifikasi **2 Identitas Pasien** (No. RM + Tanggal Lahir sesuai Permenkes 24/2022) untuk memantau IEP, instruksi **Home Exercise Program (HEP)** dari terapis, sisa kuota paket sesi, dan cetak ringkasan terapi.

2. **Web Aplikasi Desktop Manajemen Lengkap Klinik Terapi Wicara (`/simklinik`)**:
   Memiliki **10 Menu Regulasi Terstandar**:
   1. Dashboard Eksekutif & Matriks Ruang/Terapis
   2. Meja Admisi, Verifikasi 2 Identitas, *General Consent* & Konversi Booking Online $\rightarrow$ No. RM
   3. Rekam Medis Elektronik (RME) Terintegrasi, CPPT SOAP TTE & Retensi 25 Tahun
   4. Modul Bridging **SATUSEHAT Kemenkes (HL7 FHIR R4)**
   5. Master **SOP Klinis** & *Clinical Pathway*
   6. Manajemen SDM, Kredensialing **STR Seumur Hidup, SIP Dinkes, SKP & RKK**
   7. Kasir, Billing Multi-Metode & Akuntansi Paket Sesi (*Unearned* $\rightarrow$ *Earned Revenue*)
   8. Sarana Prasarana (Akustik Ruang `<35 dB`), Kalibrasi MFK & Log Sterilisasi Alat Oral **PPI**
   9. Indikator Mutu Nasional (**INM Kemenkes**), IKP & Generator Laporan **10 Besar Kasus ICD-10 Dinas Kesehatan**
   10. Hak Akses **RBAC** (contoh: Peran Kasir otomatis diblokir dari isi klinis SOAP pasien) & **Immutable Audit Trail UU PDP**.

## Menjalankan Modul Web & SIMKLINIK

```bash
cd apps/terapi-wicara-web
cp .env.example .env.local
npm install
npm run dev
```
