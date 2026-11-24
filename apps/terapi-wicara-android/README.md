# WicaraSehat Terapis — Aplikasi Android Terapis Wicara (Standalone Module)

Modul mandiri (*standalone specialist workspace*) untuk **Aplikasi Android Point-of-Care Terapis Wicara** yang dibangun menggunakan **Expo React Native (TypeScript)** + **Supabase PostgreSQL RME (`terapi_wicara` isolated schema)** + **Offline-First Sync Queue** untuk ruang terapi kedap suara.

Folder ini terisolasi sepenuhnya dari aplikasi inti repositori dan siap diekstrak menjadi repositori/APK/AAB mandiri kapan saja.

## Kepatuhan Regulasi Kesehatan Indonesia
1. **UU No. 17 Tahun 2023 tentang Kesehatan & PP No. 28 Tahun 2024**:
   - Pemantauan **STR Seumur Hidup**, masa aktif **SIP Dinas Kesehatan**, poin **SKP Kemenkes**, dan penguncian otomatis hak input klinis bila SIP kedaluwarsa.
2. **Permenkes No. 24 Tahun 2022 tentang Rekam Medis**:
   - Pencatatan **CPPT SOAP** digital, penguncian **Tanda Tangan Elektronik (TTE)**, kesiapan koding **SATUSEHAT (ICD-10, ICD-9-CM, IHS Number)**, dan retensi arsip RME 25 tahun.
3. **Permenkes No. 81 Tahun 2014 tentang Standar Pelayanan Terapi Wicara & Standar Profesi IKATWI**:
   - Instrumen asesmen baku 5 area: **Bahasa**, **Bicara/Artikulasi (PCC)**, **Suara (GRBAS, MPT, Rasio S/Z)**, **Irama/Kelancaran (%SS Stuttering Counter)**, **Menelan/Disfagia (IDDSI Level 0–7 & Oximetry SpO2)**, serta **Pemeriksaan Oromotor (OPE & Diadokokinetik /pataka/)**.
4. **UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)**:
   - Sampel rekaman suara klinis disimpan ke brankas RME terenkripsi (bukan galeri publik HP), Row-Level Security (RLS) ketat di PostgreSQL, dan **Immutable Audit Trail** setiap akses rekam medis.
5. **Permenkes No. 34 Tahun 2022 (Akreditasi Klinik) & Permenkes No. 27 Tahun 2017 (PPI)**:
   - Gate wajib **INM Kemenkes** (Identifikasi 2 parameter, Hand Hygiene 5 Momen WHO, APD, Sterilitas Alat Oral Motor), **Log Sterilisasi Autoclave/DTT**, dan pelaporan **Insiden Keselamatan Pasien (IKP)**.

## Menjalankan Aplikasi

```bash
cd apps/terapi-wicara-android
cp .env.example .env.local
npm install

# Jalankan di Android Emulator / Perangkat Fisik (Expo Go / Dev Client)
npm run android

# Jalankan Live Preview Web Mobile
npx expo start --web --port 8081
```

## Build APK / AAB Android Produksi
```bash
npx eas-cli build --platform android --profile preview   # Menghasilkan file .apk untuk pengujian internal klinik
npx eas-cli build --platform android --profile production # Menghasilkan file .aab untuk Google Play Store
```
