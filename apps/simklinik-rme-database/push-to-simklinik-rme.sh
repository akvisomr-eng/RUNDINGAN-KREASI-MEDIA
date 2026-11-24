#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# SKRIP EKSTRAKSI & PUSH 1-PERINTAH KE REPOSITORI MANDIRI: SIMKLINIK-RME
# Target GitHub  : https://github.com/akvisomr-eng/SIMKLINIK-RME.git
# Target Supabase: https://fawmudsaaotlqyryciwd.supabase.co (SUDAH AKTIF & TERISI)
# ==============================================================================

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET_DIR="${1:-$(cd "$SOURCE_ROOT/.." && pwd)/SIMKLINIK-RME}"
REMOTE_URL="https://github.com/akvisomr-eng/SIMKLINIK-RME.git"

echo "==> [1/5] Menyiapkan direktori monorepo bersih di: $TARGET_DIR"
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR/apps" "$TARGET_DIR/supabase/migrations"

echo "==> [2/5] Menyalin Aplikasi Android Terapis Wicara & Web SIMKLINIK/Enterprise HQ (tanpa node_modules/.env.local)..."
tar -C "$SOURCE_ROOT" -cf - \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.expo' \
  --exclude='dist' \
  --exclude='web-build' \
  --exclude='out' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='.env.*.local' \
  --exclude='*.tsbuildinfo' \
  apps/terapi-wicara-android apps/terapi-wicara-web | tar -xf - -C "$TARGET_DIR"

cp "$SOURCE_ROOT"/apps/simklinik-rme-database/migrations/*.sql "$TARGET_DIR/supabase/migrations/"

# Workflow GitHub Actions (builder APK/AAB di cloud + deploy Vercel) & skrip .cmd Windows
mkdir -p "$TARGET_DIR/.github/workflows" "$TARGET_DIR/tools/windows"
cp "$SOURCE_ROOT"/.github/workflows/build-android-apk.yml \
   "$SOURCE_ROOT"/.github/workflows/deploy-web-vercel.yml \
   "$TARGET_DIR/.github/workflows/"
cp "$SOURCE_ROOT"/tools/windows/*.cmd "$TARGET_DIR/tools/windows/"

echo "==> [3/5] Membuat berkas konfigurasi root (.gitignore, package.json, README.md)..."
cat << 'EOF' > "$TARGET_DIR/.gitignore"
node_modules/
.next/
.expo/
dist/
web-build/
out/
.env
.env.local
.env.*.local
!.env.example
.vercel/
*.log
*.tsbuildinfo
.DS_Store
EOF

cat << 'EOF' > "$TARGET_DIR/package.json"
{
  "name": "simklinik-rme-enterprise",
  "version": "1.0.0",
  "private": true,
  "description": "Ekosistem Mandiri Klinik Terapi Wicara, RME, SIMKLINIK & Healthcare Enterprise HQ (UU Kesehatan 17/2023, Permenkes 24/2022, SATUSEHAT, UU PDP)",
  "scripts": {
    "dev:web": "npm --prefix apps/terapi-wicara-web run dev",
    "build:web": "npm --prefix apps/terapi-wicara-web run build",
    "typecheck:web": "npm --prefix apps/terapi-wicara-web run typecheck",
    "dev:android": "npm --prefix apps/terapi-wicara-android run start",
    "web:android": "npm --prefix apps/terapi-wicara-android run web"
  }
}
EOF

cat << 'EOF' > "$TARGET_DIR/README.md"
# SIMKLINIK, RME & Healthcare Enterprise Management System — Terapi Wicara

Monorepo mandiri (**Skenario A + Opsi 1**) khusus Fasyankes Klinik Terapi Wicara, Rehabilitasi Medik & Tumbuh Kembang yang patuh terhadap regulasi kesehatan Republik Indonesia:

- **UU No. 17 Tahun 2023 tentang Kesehatan & PP No. 28 Tahun 2024** (STR Seumur Hidup, Kuota Maksimal 3 SIP per Nakes/Named, Pantauan SKP Kolegium/KKI)
- **Permenkes No. 24 Tahun 2022 tentang Rekam Medis** (RME, Penguncian CPPT SOAP + TTE, Addendum Beraudit, Retensi 25 Tahun, Interoperabilitas FHIR R4 SATUSEHAT)
- **Permenkes No. 81 Tahun 2014 tentang Standar Pelayanan Terapi Wicara** (5 Domain: Bahasa, Bicara/Artikulasi, Suara GRBAS/MPT, Irama/Gagap `%SS`, Menelan/Disfagia IDDSI 0–7)
- **Permenkes No. 34 Tahun 2022 & Kepmenkes Standar Akreditasi Klinik** (TKK, PMKP/INM Kemenkes, PKP Kolaborasi Interprofesional, PPI Sterilisasi Alat Oral-Motor, MFK Kalibrasi)
- **UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)** (Row-Level Security penuh, pemisahan akses kasir vs klinis, persetujuan eksplisit pasien/wali)

---

## Arsitektur Modul

| Direktori | Fungsi Utama | Stack |
|---|---|---|
| `apps/terapi-wicara-android` | **Aplikasi Android Terapis Wicara** (Offline-First RME untuk ruang kedap suara, Kalkulator Trial SOAP + TTE, Instrumen Asesmen 5 Domain, Rujukan Kolaborasi Interprofesional Sp.KFR/OT/FT/Psikolog, Log Sterilisasi PPI & IKP) | Expo 58 (React Native + TypeScript + AsyncStorage + EAS Build APK/AAB) |
| `apps/terapi-wicara-web` | **1. Website Publik** (`/`): Edukasi 5 domain, Skrining Red Flags Tumbuh Kembang, Direktori SIP, Booking Online UU PDP<br>**2. Portal Pasien & Keluarga** (`/portal-pasien`): Verifikasi 2 Identitas, Program Latihan Rumah (HEP), Cetak Resume Sekolah<br>**3. SIMKLINIK Cabang 10 Menu** (`/simklinik`): Admisi, Antrean, RME, Kasir & Paket Sesi, Inventaris/MFK, INM Mutu, Bridging SATUSEHAT, Laporan Dinkes<br>**4. Healthcare Enterprise HQ 6 Menu** (`/enterprise`): Badan Hukum PT Khusus KBLI `86104`/`86901`, Multi-Cabang, Matriks 3-SIP, Akuntansi PSAK COA/Jurnal/Laba-Rugi/Neraca, Payroll Jasa Medis + PPh 21, Pengadaan Alkes Berizin PAK/NIE | Next.js 16 + React 19 + TypeScript |
| `supabase/migrations` | Skema PostgreSQL terisolasi `terapi_wicara`, kebijakan RLS UU PDP, dan 12 RPC `SECURITY DEFINER` beraudit penuh | PostgreSQL 17 (Supabase `fawmudsaaotlqyryciwd`) |

---

## Konfigurasi Infrastruktur Cloud (`SIMKLINIK & RME`)

1. Salin berkas environment di masing-masing aplikasi:
   ```bash
   cp apps/terapi-wicara-web/.env.example apps/terapi-wicara-web/.env.local
   cp apps/terapi-wicara-android/.env.example apps/terapi-wicara-android/.env.local
   ```
2. Isi `NEXT_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_URL` dengan `https://fawmudsaaotlqyryciwd.supabase.co` beserta Publishable Key dari Dashboard Supabase (`SIMKLINIK & RME`).
3. Jalankan aplikasi:
   ```bash
   # Web Portal + SIMKLINIK + Enterprise HQ (port 3002)
   cd apps/terapi-wicara-web && npm install && npm run dev

   # Aplikasi Android Terapis Wicara (Expo Metro / Android / Web)
   cd apps/terapi-wicara-android && npm install && npx expo start
   ```
EOF

echo "==> [4/5] Inisialisasi Git & Commit Awal..."
cd "$TARGET_DIR"
git init -b main
git add -A
git commit -m "feat: standalone SIMKLINIK, RME Android, Portal Pasien & Healthcare Enterprise HQ (Skenario A + Opsi 1)"

echo "==> [5/5] Push ke $REMOTE_URL (branch: main)..."
git remote add origin "$REMOTE_URL"
git push -u origin main

echo ""
echo "SELESAI! Repositori mandiri telah berhasil terbit di:"
echo "  https://github.com/akvisomr-eng/SIMKLINIK-RME"
