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
