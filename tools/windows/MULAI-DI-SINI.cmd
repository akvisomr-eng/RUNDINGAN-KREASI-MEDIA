@echo off
setlocal EnableDelayedExpansion
title SIMKLINIK & RME - Kontrol Deploy (Anti PowerShell Error)
color 0B

REM ============================================================================
REM  MULAI-DI-SINI.cmd
REM  Menu 1 klik yang TIDAK memakai npm.ps1 / npx.ps1 sama sekali,
REM  sehingga error "PSSecurityException / running scripts is disabled"
REM  dan error "Cannot find path C:\Windows\system32\..." tidak akan muncul.
REM
REM  Cukup klik 2x berkas ini (atau klik kanan > Run as administrator
REM  hanya jika memilih menu nomor 7).
REM ============================================================================

REM --- Selalu pindah ke folder tempat berkas .cmd ini berada (bukan system32) ---
cd /d "%~dp0"
set "TOOLS_DIR=%~dp0"
for %%I in ("%TOOLS_DIR%..\..") do set "REPO_DIR=%%~fI"
set "ANDROID_DIR=%REPO_DIR%\apps\terapi-wicara-android"
set "WEB_DIR=%REPO_DIR%\apps\terapi-wicara-web"
set "GH_REPO=akvisomr-eng/SIMKLINIK-RME"

:menu
cls
echo ============================================================================
echo   SIMKLINIK, RME ^& Healthcare Enterprise HQ - Terapi Wicara
echo   Pusat Kontrol Deploy  ^|  Tanpa PowerShell, Tanpa Error ExecutionPolicy
echo ============================================================================
echo.
echo   Folder proyek : %REPO_DIR%
echo   Node/npm      : diakses lewat npm.cmd dan npx.cmd (aman)
echo.
echo   [1] BUILD APK ^& AAB di cloud GitHub  (tanpa install apapun)
echo   [2] Cek status / unduh hasil build APK terbaru
echo   [3] DEPLOY WEB ke Vercel  (1 klik di browser)
echo   [4] Buka aplikasi Web lokal  (http://localhost:3002)
echo   [5] Buka aplikasi Android lokal via Expo  (http://localhost:8081)
echo   [6] PUSH kode terbaru ke GitHub SIMKLINIK-RME
echo   [7] PERBAIKI error PowerShell npm.ps1 (ExecutionPolicy)
echo   [8] Cek versi Node.js / npm / git / gh
echo   [0] Keluar
echo.
set /p PILIH="  Pilih menu [1-8, 0] lalu Enter: "
if "%PILIH%"=="1" goto build_apk
if "%PILIH%"=="2" goto cek_apk
if "%PILIH%"=="3" goto deploy_web
if "%PILIH%"=="4" goto run_web
if "%PILIH%"=="5" goto run_android
if "%PILIH%"=="6" goto push_git
if "%PILIH%"=="7" goto fix_powershell
if "%PILIH%"=="8" goto cek_versi
if "%PILIH%"=="0" goto keluar
goto menu

REM ---------------------------------------------------------------------------
:build_apk
cls
echo ============================================================================
echo   [1] BUILD APK ^& AAB DI CLOUD GITHUB
echo ============================================================================
echo.
echo   Build dilakukan di server GitHub (gratis, sudah ada JDK 17 + Android SDK).
echo   Komputer Anda TIDAK perlu npm, npx, EAS, Android Studio, atau Java.
echo.
where gh >nul 2>nul
if errorlevel 1 goto build_apk_browser

echo   GitHub CLI (gh) terdeteksi. Menjalankan workflow build...
echo.
gh workflow run "build-android-apk.yml" --repo "%GH_REPO%" --ref main -f build_type=both -f publish_release=true
if errorlevel 1 (
  echo.
  echo   [!] Gagal memicu workflow. Kemungkinan belum login. Jalankan: gh auth login
  echo       Atau pakai cara browser di bawah ini.
  pause
  goto build_apk_browser
)
echo.
echo   [OK] Build dimulai di cloud. Proses 8-15 menit.
echo        Halaman pemantauan akan dibuka di browser.
timeout /t 3 >nul
start "" "https://github.com/%GH_REPO%/actions/workflows/build-android-apk.yml"
pause
goto menu

:build_apk_browser
echo   Membuka halaman build di browser...
echo.
echo   Langkah di halaman itu:
echo     1. Klik tombol "Run workflow" (kanan atas) -^> pilih "both" -^> Run
echo     2. Tunggu tanda centang hijau (8-15 menit)
echo     3. Unduh di bagian "Artifacts": WicaraSehat-Terapis-Android
echo        atau di menu "Releases": berkas .apk siap install di HP.
echo.
start "" "https://github.com/%GH_REPO%/actions/workflows/build-android-apk.yml"
pause
goto menu

REM ---------------------------------------------------------------------------
:cek_apk
cls
echo ============================================================================
echo   [2] STATUS ^& UNDUHAN BUILD APK
echo ============================================================================
echo.
echo   Hasil build (artifacts) : https://github.com/%GH_REPO%/actions/workflows/build-android-apk.yml
echo   Berkas .apk siap pakai  : https://github.com/%GH_REPO%/releases
echo.
echo   Cara install di HP Android:
echo     1. Unduh WicaraSehat-Terapis-v1.0.0.apk
echo     2. Buka berkasnya -^> "Install anyway" / "Tetap pasang" bila muncul peringatan
echo     3. Izinkan "Install unknown apps" untuk browser Anda sekali saja
echo.
start "" "https://github.com/%GH_REPO%/releases"
pause
goto menu

REM ---------------------------------------------------------------------------
:deploy_web
cls
echo ============================================================================
echo   [3] DEPLOY WEB (SIMKLINIK + Portal Pasien + Enterprise HQ) KE VERCEL
echo ============================================================================
echo.
echo   Cara A - 1 klik tanpa akun teknis (PALING MUDAH):
echo     Tombol "Deploy with Vercel" akan dibuka di browser. Login GitHub,
echo     klik Deploy, selesai. Environment Supabase sudah terisi otomatis.
echo.
echo   Cara B - otomatis penuh lewat GitHub Actions:
echo     Tambahkan secret VERCEL_TOKEN di:
echo     https://github.com/%GH_REPO%/settings/secrets/actions
echo     lalu jalankan workflow "Deploy Web ... ke Vercel".
echo.
echo   Membuka tombol Deploy with Vercel...
start "" "https://vercel.com/new/clone?repository-url=https%%3A%%2F%%2Fgithub.com%%2Fakvisomr-eng%%2FSIMKLINIK-RME&root-directory=apps%%2Fterapi-wicara-web&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,NEXT_PUBLIC_CLINIC_CODE&project-name=simklinik-terapi-wicara&repository-name=SIMKLINIK-RME"
timeout /t 2 >nul
start "" "https://vercel.com/new/clone?repository-url=https://github.com/akvisomr-eng/SIMKLINIK-RME&root-directory=apps/terapi-wicara-web"
echo.
echo   Nilai environment yang dipakai (salin bila diminta):
echo     NEXT_PUBLIC_SUPABASE_URL              = https://fawmudsaaotlqyryciwd.supabase.co
echo     NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY   = sb_publishable_wRGUQNJKi5XUjMXHFpDxVw_hPAPyhUc
echo     NEXT_PUBLIC_CLINIC_CODE                = TW-2026
echo     NEXT_PUBLIC_CLINIC_NAME                = Klinik Terapi Wicara WicaraSehat
echo.
pause
goto menu

REM ---------------------------------------------------------------------------
:run_web
cls
echo ============================================================================
echo   [4] JALANKAN WEB LOKAL (port 3002)
echo ============================================================================
if not exist "%WEB_DIR%\package.json" (
  echo   [!] Folder web tidak ditemukan: %WEB_DIR%
  pause & goto menu
)
cd /d "%WEB_DIR%"
if not exist "node_modules" (
  echo   Memasang dependensi dengan npm.cmd ...
  call npm.cmd install --no-audit --no-fund
  if errorlevel 1 ( echo   [!] npm install gagal. & pause & goto menu )
)
echo   Membuka http://localhost:3002 ...
start "" "http://localhost:3002"
call npm.cmd run dev
pause
goto menu

REM ---------------------------------------------------------------------------
:run_android
cls
echo ============================================================================
echo   [5] JALANKAN APLIKASI ANDROID LOKAL (Expo, port 8081)
echo ============================================================================
if not exist "%ANDROID_DIR%\package.json" (
  echo   [!] Folder android tidak ditemukan: %ANDROID_DIR%
  pause & goto menu
)
cd /d "%ANDROID_DIR%"
if not exist "node_modules" (
  echo   Memasang dependensi dengan npm.cmd ...
  call npm.cmd install --no-audit --no-fund
  if errorlevel 1 ( echo   [!] npm install gagal. & pause & goto menu )
)
echo   Membuka http://localhost:8081 ...
start "" "http://localhost:8081"
call npx.cmd expo start
pause
goto menu

REM ---------------------------------------------------------------------------
:push_git
cls
echo ============================================================================
echo   [6] PUSH KODE KE https://github.com/%GH_REPO%
echo ============================================================================
cd /d "%REPO_DIR%"
where git >nul 2>nul
if errorlevel 1 (
  echo   [!] Git belum terpasang. Unduh: https://git-scm.com/download/win
  pause & goto menu
)
echo   Menyinkronkan folder... (tanpa PowerShell)
where bash >nul 2>nul
if errorlevel 1 (
  echo   [!] Git Bash tidak ditemukan. Jalankan skrip .ps1 versi perbaikan:
  echo       powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_DIR%\apps\simklinik-rme-database\push-to-simklinik-rme.ps1"
) else (
  call bash "%REPO_DIR%\apps\simklinik-rme-database\push-to-simklinik-rme.sh"
)
pause
goto menu

REM ---------------------------------------------------------------------------
:fix_powershell
cls
echo ============================================================================
echo   [7] PERBAIKI "npm.ps1 cannot be loaded ... PSSecurityException"
echo ============================================================================
echo.
echo   Penyebab: ExecutionPolicy Windows Anda = Restricted.
echo   Perintah di bawah HANYA mengubah policy untuk user Anda (CurrentUser),
echo   tidak melemahkan keamanan sistem secara keseluruhan.
echo.
echo   Menjalankan perbaikan otomatis...
powershell -NoProfile -Command "Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force; Get-ExecutionPolicy -List"
echo.
echo   [OK] Setelah ini npm dan npx di PowerShell akan berfungsi normal.
echo        Uji dengan membuka PowerShell BARU lalu jalankan: npm -v
echo.
echo   Catatan penting:
echo     - JANGAN jalankan PowerShell sebagai Administrator untuk npm.
echo       Administrator selalu mulai di C:\Windows\system32 sehingga
echo       muncul error "Cannot find path 'C:\Windows\system32\...'".
echo     - Selalu pindah folder dengan perintah LENGKAP, contoh:
echo         cd C:\Users\NamaAnda\SIMKLINIK-RME\apps\terapi-wicara-android
echo     - Lebih mudah: cukup klik 2x MULAI-DI-SINI.cmd ini.
echo.
pause
goto menu

REM ---------------------------------------------------------------------------
:cek_versi
cls
echo ============================================================================
echo   [8] CEK LINGKUNGAN
echo ============================================================================
echo.
echo --- Node.js / npm (lewat .cmd, aman dari ExecutionPolicy) ---
where node >nul 2>nul && (call node -v) || echo   node  : TIDAK ADA  ^(unduh https://nodejs.org^)
where npm >nul 2>nul  && (call npm.cmd -v) || echo   npm   : TIDAK ADA
echo.
echo --- Git / GitHub CLI ---
where git >nul 2>nul && (call git --version) || echo   git   : TIDAK ADA  ^(unduh https://git-scm.com/download/win^)
where gh  >nul 2>nul && (call gh --version) || echo   gh    : TIDAK ADA  ^(opsional, https://cli.github.com^)
echo.
echo --- Java / Android (TIDAK diperlukan: build APK dilakukan di cloud) ---
where java >nul 2>nul && (call java -version) || echo   java  : tidak ada  (tidak masalah)
echo.
pause
goto menu

:keluar
endlocal
exit /b 0
