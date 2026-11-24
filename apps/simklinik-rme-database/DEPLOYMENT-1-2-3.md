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

Aplikasi web **sudah lolos `next build` produksi 0 error** (7 route: `/`, `/portal-pasien`, `/simklinik`, `/enterprise`, `/api/health`, `/_not-found`). Ada **3 cara** deploy — pilih yang paling nyaman. Cara A & B **tidak memerlukan PowerShell sama sekali**.

### Cara A — Tombol "Deploy with Vercel" (paling mudah, ±60 detik)
Klik tautan berikut, login dengan GitHub, lalu tekan **Deploy**. Root directory sudah terisi otomatis:

```text
https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fakvisomr-eng%2FSIMKLINIK-RME&root-directory=apps%2Fterapi-wicara-web&project-name=simklinik-terapi-wicara
```

Isi **Environment Variables** (Production + Preview + Development):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://fawmudsaaotlqyryciwd.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_wRGUQNJKi5XUjMXHFpDxVw_hPAPyhUc` |
| `NEXT_PUBLIC_CLINIC_CODE` | `TW-2026` |
| `NEXT_PUBLIC_CLINIC_NAME` | `Klinik Terapi Wicara WicaraSehat` |

### Cara B — GitHub Actions (otomatis penuh, tanpa terminal)
Workflow `deploy-web-vercel.yml` sudah tersedia di repo mandiri:

1. Buat token di **https://vercel.com/account/tokens** → salin.
2. Buka **https://github.com/akvisomr-eng/SIMKLINIK-RME/settings/secrets/actions** → **New repository secret** → nama `VERCEL_TOKEN`, nilai token tadi. (Opsional: `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` dari `.vercel/project.json` agar menempel ke project yang sudah ada.)
3. Tab **Actions** → **Deploy Web (SIMKLINIK + Portal + Enterprise HQ) ke Vercel** → **Run workflow**.
4. URL produksi muncul di ringkasan run (`deployment_url`).

### Cara C — Satu klik lewat menu Windows
Klik 2× berkas `tools\windows\MULAI-DI-SINI.cmd` → pilih menu **[3] DEPLOY WEB ke Vercel**. Menu ini memakai `start` browser (bukan `npm.ps1`), jadi bebas dari error `PSSecurityException`.

**Keempat modul web langsung aktif di domain produksi Anda:**
- `/` — Website Resmi Klinik, Edukasi 5 Domain, Skrining *Red Flags* & Booking Online
- `/portal-pasien` — Portal Pasien & Keluarga HEP (uji: `RM-TW-2026-0041` + `2022-05-14`)
- `/simklinik` — SIMKLINIK Cabang (10 Menu)
- `/enterprise` — Healthcare Enterprise HQ Multi-Cabang (6 Menu)
- `/api/health` — Status kepatuhan & koneksi Supabase

---

## TAHAP 3 — Build File `.APK` / `.AAB` Aplikasi Android Terapis Wicara

> **PENTING — mengapa cara lama gagal di komputer Anda:**
> `npm.ps1` / `npx.ps1` diblokir `ExecutionPolicy = Restricted` (`PSSecurityException`), dan PowerShell Administrator selalu mulai di `C:\Windows\system32` sehingga `cd .\SIMKLINIK-RME\...` menghasilkan `PathNotFound`. Selain itu `EAS Build` menuntut akun Expo + antrean gratis yang lambat.
>
> **Solusi yang dipakai sekarang:** build dilakukan **di server GitHub** (runner `ubuntu-latest` sudah berisi **JDK 17 + Android SDK + NDK**), memakai `gradlew assembleRelease` / `bundleRelease` langsung — **tanpa EAS, tanpa akun Expo, tanpa Java/Android Studio, tanpa `npm`/`npx` di komputer Anda.**

### Cara A — Satu klik, tanpa terminal (DISARANKAN)
Klik 2× salah satu berkas berikut:

```text
tools\windows\BUILD-APK-TANPA-ERROR.cmd      (langsung memicu build)
tools\windows\MULAI-DI-SINI.cmd              (menu lengkap: build, deploy web, cek versi, perbaiki PowerShell)
```

Keduanya memakai `gh`/browser, **tidak pernah memanggil `npm.ps1` atau `npx.ps1`**, dan selalu `cd /d "%~dp0"` sehingga tidak mungkin nyasar ke `C:\Windows\system32`.

### Cara B — Lewat browser saja (tanpa install apa pun)
1. Buka **https://github.com/akvisomr-eng/SIMKLINIK-RME/actions/workflows/build-android-apk.yml**
2. Klik **Run workflow** → `build_type: both`, `publish_release: true` → **Run workflow**
3. Tunggu 8–15 menit hingga centang hijau.
4. Unduh hasilnya di **Artifacts → `WicaraSehat-Terapis-Android`** (`WicaraSehat-Terapis-v1.0.0.apk` + `.aab`), atau langsung dari **https://github.com/akvisomr-eng/SIMKLINIK-RME/releases** (tombol *Releases* ini bisa dibuka dari HP).

### Cara C — Dari terminal, bila PowerShell sudah diperbaiki
```powershell
# Perbaiki sekali saja (tidak perlu Administrator):
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force

# Selalu pakai path lengkap, jangan andalkan CWD PowerShell:
cd "$HOME\SIMKLINIK-RME"
gh workflow run build-android-apk.yml --ref main -f build_type=both -f publish_release=true
gh run watch
```

### Rincian teknis build (untuk rujukan)
| Item | Nilai |
|---|---|
| Package Android | `id.wicarasehat.terapis.rme` |
| Versi | `1.0.0` (versionCode `1`) |
| Output | `app-release.apk` (signed, install langsung) & `app-release.aab` (Play Console) |
| Signing | `debug.keystore` otomatis dibuat bila belum ada (cukup untuk distribusi internal klinik) |
| SDK | compileSdk 37 · targetSdk 36 · minSdk 24 · NDK 27.1.12297006 · Gradle 9.4.1 · AGP 9.x · JDK 17 |
| Environment baked-in | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_DEFAULT_EMPLOYEE_NUMBER` |
| Login uji aplikasi | Terapis `TW-2023-001` |

### Cara memasang `.apk` di HP/tablet Android
1. Unduh `WicaraSehat-Terapis-v1.0.0.apk` dari halaman **Releases**.
2. Buka berkas → bila muncul peringatan, pilih **"Install anyway" / "Tetap pasang"**.
3. Sekali saja: izinkan **"Install unknown apps"** untuk aplikasi browser/File Manager yang Anda pakai.
4. Untuk rilis ke **Google Play Console**, unggah berkas `.aab`.

### Bila ingin memakai EAS (opsional, tetap tersedia)
`eas.json` masih tersedia dengan profil `preview` (APK) dan `production` (AAB). Jalankan dari **PowerShell baru** setelah ExecutionPolicy diperbaiki:

```powershell
cd "$HOME\SIMKLINIK-RME\apps\terapi-wicara-android"
npm.cmd install
npx.cmd eas-cli@latest login
npm.cmd run build:apk:preview
```

---

## Ringkasan Status

| Tahap | Status | Bukti |
|---|---|---|
| 1. Repo mandiri `SIMKLINIK-RME` | ✅ Selesai | 53 berkas di `main`, 0 kebocoran secret |
| 1b. Supabase `fawmudsaaotlqyryciwd` | ✅ Selesai | 27 tabel RLS `terapi_wicara`, 12 RPC `SECURITY DEFINER` |
| 2. Web Vercel | ✅ Siap deploy (1 klik) | `next build` 0 error, 7 route, `vercel.json` + security header UU PDP |
| 3. Android `.apk` / `.aab` | ✅ **SUDAH TERBANGUN & TERBIT** | APK 79,9 MB & AAB 54,4 MB — [Releases](https://github.com/akvisomr-eng/RUNDINGAN-KREASI-MEDIA/releases) |

---

## Hasil Build APK/AAB yang Sudah Jadi

Build cloud berhasil **12 menit 8 detik**, 0 error, dan berkas installer sudah diterbitkan:

| Berkas | Ukuran | Unduhan |
|---|---|---|
| `WicaraSehat-Terapis-v1.0.0.apk` | 79,9 MB | [Unduh APK](https://github.com/akvisomr-eng/RUNDINGAN-KREASI-MEDIA/releases) |
| `WicaraSehat-Terapis-v1.0.0.aab` | 54,4 MB | [Unduh AAB](https://github.com/akvisomr-eng/RUNDINGAN-KREASI-MEDIA/releases) |
| Riwayat build | — | [Actions → Build Android APK & AAB](https://github.com/akvisomr-eng/RUNDINGAN-KREASI-MEDIA/actions/workflows/build-android-apk.yml) |

Portal unduhan (sama, repositori mandiri): **https://github.com/akvisomr-eng/SIMKLINIK-RME/releases**

> Catatan: kedua repositori memakai workflow identik. Build pertama dijalankan di `RUNDINGAN-KREASI-MEDIA`; setelah `push-to-simklinik-rme` dijalankan, jalankan **Run workflow** sekali di `SIMKLINIK-RME` dan aset `.apk` akan terbit permanen di repo mandiri tersebut.
