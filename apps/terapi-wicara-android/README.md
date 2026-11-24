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

## Struktur Navigasi Aplikasi (7 Tab)

Aplikasi ini dirancang seperti aplikasi klinis sungguhan, bukan sekadar daftar formulir:

| Tab | Isi |
|---|---|
| **Beranda** | Dasbor terapis: sesi berikutnya, statistik harian, aksi cepat, capaian SKP, catatan terakhir |
| **Agenda** | Jadwal & ruang terapi, gate INM (identifikasi 2 parameter), verifikasi consent |
| **Asesmen** | Instrumen baku 5 domain (Bahasa, Bicara/PCC, Suara/GRBAS, Irama/%SS, Menelan/IDDSI) |
| **Terapi** | Sesi aktif + CPPT SOAP, kunci TTE, penghitungan akurasi target |
| **Riwayat** | **Semua catatan yang Anda simpan**: filter per jenis, pencarian pasien/No. RM, status sinkronisasi, hapus |
| **Pasien** | RME pasien, rencana terapi, riwayat SOAP, rujukan interprofesional |
| **SOP/PPI** | SOP klinis, log sterilisasi, kepatuhan PPI & IKP |
| **Profil** | Kredensial STR/SIP/IHS/SKP, **ubah PIN sesi klinis**, biometrik, kunci sesi, kelola data lokal |

### Autentikasi & Persistensi
- **PIN sesi klinis wajib** sebelum RME dapat dibuka (`@wicarasehat_pin_v1`). PIN bawaan `240826`, dapat diubah di tab Profil.
- Sesi dapat dikunci manual dari *app bar* ("Kunci") atau dari tab Profil — sesuai prinsip *minimum necessary access* UU PDP.
- Catatan klinis disimpan di perangkat lewat `src/services/localRecordStore.ts` (`@wicarasehat_rme_records_v1`) sehingga **tetap ada setelah aplikasi ditutup** dan tetap terbaca saat offline.
- Sinkronisasi: `flushOfflineQueue()` mengirim antrean ke Supabase RME melalui RPC `tw_android_submit_*`; catatan yang gagal tetap di antrean.
- Tab Riwayat menandai setiap catatan **TERKIRIM** atau **ANTREAN**.

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
