# Panduan Push 1-Perintah ke Repositori Mandiri `SIMKLINIK-RME`

## 1. Status Database Supabase Khusus (`SIMKLINIK & RME`) — **SELESAI 100%**
Seluruh skema, Row-Level Security (UU PDP No. 27/2022), 12 fungsi RPC `SECURITY DEFINER` beraudit, serta data klinis, SIMKLINIK, dan Enterprise HQ telah berhasil dimigrasikan secara langsung ke proyek khusus Anda:
- **Project Name**: `SIMKLINIK & RME`
- **Project Ref**: `fawmudsaaotlqyryciwd` (`ap-northeast-2`, PostgreSQL 17, `ACTIVE_HEALTHY`)
- **API URL**: `https://fawmudsaaotlqyryciwd.supabase.co`
- **Migrations Terpasang**:
  1. `0001_simklinik_rme_core_clinical_tables` (15 tabel inti RME, cabang, 3-SIP, rujukan interprofesional, PPI, IKP, audit trail)
  2. `0002_simklinik_billing_inventory_inm_enterprise_erp` (12 tabel tarif, paket sesi, kasir, inventaris/MFK, INM Kemenkes, SATUSEHAT FHIR, booking online, COA/Jurnal PSAK, Payroll Jasa Medis, PO Alkes PAK/NIE + RLS penuh)
  3. `0003_simklinik_enterprise_rpcs_and_seed` (12 gateway RPC `SECURITY DEFINER`)
  4. `0004_simklinik_enterprise_seed_and_rpc_alignment` (Data awal `PT Wicara Sehat Medika Nusantara`, 3 cabang Kediri/Surabaya/Malang, 5 praktisi lintas profesi, matriks 8 SIP, pasien, IEP, SOAP TTE, COA, Jurnal, Payroll, PO)
  5. `0005_align_patient_portal_and_booking_mrn_rpcs` (Verifikasi 2 Identitas Portal Pasien `RM-TW-2026-0041` + `2022-05-14`)

---

## 1a. 🤖 Multi-Agen AI Otonom & Formulir SIMKLINIK (Baru)

Ekosistem kini dilengkapi **7 agen AI otonom** (keamanan, penguji, pengetahuan, perbaikan bug, analisis, riset, supervisor) dan **AI Companion** chatbot di website yang pengetahuannya ditanam lokal lalu diperkaya daring.

SIMKLINIK juga **bukan lagi tampilan baca-saja**: 13 modul kini berupa formulir lengkap dengan navigasi **Entri Baru / Ubah / Hapus / Sebelumnya / Berikutnya / Cetak Laporan / Ekspor CSV**, sesuai Permenkes 24/2022, 81/2014, 34/2022, UU 17/2023, dan UU 27/2022.

📄 Detail lengkap: [`MULTI-AGEN-AI-DAN-FORMULIR.md`](./MULTI-AGEN-AI-DAN-FORMULIR.md)

---

## 1b. ⚡ Build & Deploy Tanpa PowerShell (Rekomendasi)

Kedua proses produksi dapat dijalankan **tanpa `npm.ps1` / `npx.ps1`**, sehingga error `PSSecurityException` dan `Cannot find path 'C:\Windows\system32\...'` tidak akan pernah muncul lagi.

| Kebutuhan | Cara tercepat | Tanpa terminal? |
|---|---|---|
| Build `.apk` / `.aab` Android | Klik 2× `tools\windows\BUILD-APK-TANPA-ERROR.cmd` **atau** buka [Actions → Build Android APK & AAB](https://github.com/akvisomr-eng/SIMKLINIK-RME/actions/workflows/build-android-apk.yml) lalu **Run workflow** | ✅ Ya |
| Deploy web ke Vercel | Klik [**Deploy with Vercel**](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fakvisomr-eng%2FSIMKLINIK-RME&root-directory=apps%2Fterapi-wicara-web) **atau** workflow `deploy-web-vercel.yml` | ✅ Ya |
| Menu lengkap (build, deploy, cek versi, perbaiki PowerShell) | Klik 2× `tools\windows\MULAI-DI-SINI.cmd` | ✅ Ya |

Build Android dijalankan di server GitHub (`ubuntu-latest` sudah berisi **JDK 17 + Android SDK + NDK**), memakai `gradlew assembleRelease` / `bundleRelease` — **tidak memerlukan EAS, akun Expo, Java, atau Android Studio di komputer Anda**. Hasil build pertama: **APK 79,9 MB + AAB 54,4 MB, selesai 12 menit, 0 error**.

Panduan lengkap berurutan: [`DEPLOYMENT-1-2-3.md`](./DEPLOYMENT-1-2-3.md)

---

## 2. Mengapa Push Otomatis ke `akvisomr-eng/SIMKLINIK-RME` Ditolak GitHub App (HTTP 403)?
Sesi Arena saat ini terikat ke repositori `akvisomr-eng/RUNDINGAN-KREASI-MEDIA`, sehingga token GitHub App sandbox hanya diberi izin tulis (*repository-scoped installation token*) ke repositori sesi aktif dan belum memiliki izin tulis ke repositori baru `akvisomr-eng/SIMKLINIK-RME` (`Resource not accessible by integration - HTTP 403`).

Agar `akvisomr-eng/SIMKLINIK-RME` dapat dikelola langsung oleh agen:
1. Buka pengaturan instalasi GitHub App Arena di akun GitHub Anda (**Settings → Applications → Installed GitHub Apps → Configure**), lalu tambahkan **`akvisomr-eng/SIMKLINIK-RME`** pada daftar *Repository access* (atau buka sesi baru Arena yang langsung memilih repo `SIMKLINIK-RME`).
2. **Atau**, bila Anda ingin mengekstrak dari branch ini di komputer lokal Anda sekarang juga:
   ```bash
   # Jalankan dari root checkout lokal Anda:
   mkdir -p ../SIMKLINIK-RME/apps ../SIMKLINIK-RME/supabase/migrations
   cp -R apps/terapi-wicara-android apps/terapi-wicara-web ../SIMKLINIK-RME/apps/
   cp apps/simklinik-rme-database/migrations/*.sql ../SIMKLINIK-RME/supabase/migrations/
   cd ../SIMKLINIK-RME
   rm -rf apps/*/.next apps/*/.expo apps/*/node_modules apps/*/.env.local
   git init -b main
   git add -A
   git commit -m "feat: standalone SIMKLINIK, RME Android, Portal Pasien & Healthcare Enterprise HQ"
   git remote add origin https://github.com/akvisomr-eng/SIMKLINIK-RME.git
   git push -u origin main
   ```
