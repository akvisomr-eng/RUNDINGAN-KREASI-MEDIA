# Panduan Operasional Berurutan: Sesi Repo Mandiri (1) • Deploy Vercel (2) • Build APK/AAB Android (3)

Seluruh kode sumber, skema database PostgreSQL 17 (`fawmudsaaotlqyryciwd`), build produksi Next.js 16, dan bundle aplikasi Android Expo 58 telah teruji lulus **0 error**. Ikuti 3 tahapan berurutan berikut:

---

## TAHAP 1 — Buka Sesi Mandiri di Repo `akvisomr-eng/SIMKLINIK-RME`

Agar pengembangan selanjutnya 100% terpisah dari `RUNDINGAN-KREASI-MEDIA`:

1. Sinkronkan pembaruan konfigurasi produksi (`vercel.json` & `eas.json`) ke repo lokal `SIMKLINIK-RME` Anda (jalankan di PowerShell pada folder induk tempat `SIMKLINIK-RME` berada):
   ```powershell
   git clone --depth 1 --branch arena/82c43d8c-rundingan-kreasi-media https://github.com/akvisomr-eng/RUNDINGAN-KREASI-MEDIA.git _tmp_sync
   Copy-Item .\_tmp_sync\apps\terapi-wicara-web\vercel.json .\SIMKLINIK-RME\apps\terapi-wicara-web\vercel.json -Force
   Copy-Item .\_tmp_sync\apps\terapi-wicara-android\eas.json .\SIMKLINIK-RME\apps\terapi-wicara-android\eas.json -Force
   Copy-Item .\_tmp_sync\apps\terapi-wicara-android\package.json .\SIMKLINIK-RME\apps\terapi-wicara-android\package.json -Force
   Copy-Item .\_tmp_sync\apps\simklinik-rme-database\DEPLOYMENT-1-2-3.md .\SIMKLINIK-RME\DEPLOYMENT.md -Force
   Remove-Item -Recurse -Force _tmp_sync
   cd .\SIMKLINIK-RME
   git add -A
   git commit -m "chore(deploy): add Vercel security config and EAS Android APK/AAB build profiles"
   git push origin main
   ```
2. Di **Arena.ai**, klik **New Chat / Agent Mode**, pilih repositori GitHub **`akvisomr-eng/SIMKLINIK-RME`** (branch `main`), dan aktifkan konektor **`supabase`** (serta **`vercel`** bila ingin agen mengelola deployment langsung).

---

## TAHAP 2 — Deploy Web SIMKLINIK, Portal Pasien & Enterprise HQ ke Vercel

*(Konektor Vercel di sesi ini berstatus `disconnected`, sehingga Anda dapat menghubungkan konektor `vercel` di Arena **atau** deploy langsung dalam 60 detik melalui Dashboard/CLI Vercel)*:

### Cara A: Via Dashboard Vercel (Tanpa CLI)
1. Buka **[https://vercel.com/new](https://vercel.com/new)** → pilih **Import Git Repository** → pilih **`akvisomr-eng/SIMKLINIK-RME`**.
2. Pada bagian **Root Directory**, klik **Edit** lalu pilih:
   ```text
   apps/terapi-wicara-web
   ```
3. Buka bagian **Environment Variables**, tambahkan 3 variabel berikut (berlaku untuk *Production, Preview, Development*):
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://fawmudsaaotlqyryciwd.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_wRGUQNJKi5XUjMXHFpDxVw_hPAPyhUc` |
   | `NEXT_PUBLIC_CLINIC_CODE` | `KLN-TW-KDR-01` |
4. Klik **Deploy**. Setelah live, keempat modul web langsung aktif di domain produksi Anda:
   - `/` — Website Resmi Klinik, Edukasi 5 Domain, Skrining *Red Flags* & Booking Online
   - `/portal-pasien` — Portal Pasien & Keluarga HEP (Uji verifikasi: `RM-TW-2026-0041` + `2022-05-14`)
   - `/simklinik` — Aplikasi Desktop Operasional SIMKLINIK Cabang (10 Menu)
   - `/enterprise` — Healthcare Enterprise HQ Multi-Cabang & Multi-Profesi (6 Menu)
   - `/api/health` — Endpoint pemantauan status kepatuhan & koneksi Supabase

### Cara B: Via Terminal Lokal (Vercel CLI)
```powershell
cd .\SIMKLINIK-RME\apps\terapi-wicara-web
npx vercel deploy --prod
```

---

## TAHAP 3 — Build File `.APK` / `.AAB` Aplikasi Android Terapis Wicara

Berkas `apps/terapi-wicara-android/eas.json` dan `app.json` (`package: id.wicarasehat.terapis.rme`) telah dikonfigurasi penuh untuk menghasilkan installer **`.apk`** (langsung pasang di tablet/HP Android terapis di ruang kedap suara) maupun **`.aab`** (unggah ke Google Play Console).

Jalankan perintah berikut di PowerShell komputer lokal Anda:

```powershell
cd .\SIMKLINIK-RME\apps\terapi-wicara-android

# 1. Instal dependensi (cukup sekali)
npm install

# 2. Login ke akun Expo Anda (buat gratis di https://expo.dev bila belum punya)
npx eas-cli@latest login

# 3. Simpan Publishable Key Supabase sebagai EAS Environment Variable yang aman
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value "sb_publishable_wRGUQNJKi5XUjMXHFpDxVw_hPAPyhUc" --environment preview --visibility plaintext

# 4. Build file .APK siap pasang untuk Tablet & HP Android Terapis Wicara
npm run build:apk:preview
```

- Setelah proses cloud build EAS selesai (~8–12 menit), terminal akan menampilkan **tautan unduhan langsung file `.apk` beserta QR Code** untuk di-scan dari tablet/HP Android Terapis Wicara.
- Untuk merilis ke **Google Play Store** dalam format Android App Bundle (`.aab`), jalankan:
  ```powershell
  npm run build:aab:production
  ```
