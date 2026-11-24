@echo off
REM ============================================================================
REM  BUILD-APK-TANPA-ERROR.cmd
REM  Satu klik untuk memicu build .apk + .aab di cloud GitHub.
REM  Tidak memakai npm.ps1 / npx.ps1 / EAS / Java / Android Studio.
REM ============================================================================
setlocal
cd /d "%~dp0"
set "GH_REPO=akvisomr-eng/SIMKLINIK-RME"
title Build APK WicaraSehat Terapis (Cloud GitHub)

echo ============================================================================
echo   BUILD APK ^& AAB - WicaraSehat Terapis
echo   Repositori : https://github.com/%GH_REPO%
echo ============================================================================
echo.

where gh >nul 2>nul
if errorlevel 1 goto browser

gh auth status >nul 2>nul
if errorlevel 1 (
  echo   [i] GitHub CLI belum login. Membuka panduan login...
  echo       Jalankan di jendela ini:  gh auth login
  echo       Pilih: GitHub.com -^> HTTPS -^> Login with a web browser
  echo.
  gh auth login
)

echo   Memicu workflow build di cloud...
gh workflow run "build-android-apk.yml" --repo "%GH_REPO%" --ref main -f build_type=both -f publish_release=true
if errorlevel 1 goto browser

echo.
echo   [OK] Build berjalan di server GitHub. Estimasi 8-15 menit.
timeout /t 3 >nul
start "" "https://github.com/%GH_REPO%/actions/workflows/build-android-apk.yml"
echo.
echo   Setelah selesai, unduh .apk di:
echo     https://github.com/%GH_REPO%/releases
pause
exit /b 0

:browser
echo   Membuka halaman Actions. Klik "Run workflow" ^(kanan atas^) lalu Run.
start "" "https://github.com/%GH_REPO%/actions/workflows/build-android-apk.yml"
echo.
echo   Hasil akhir .apk juga tersedia di:
echo     https://github.com/%GH_REPO%/releases
pause
exit /b 0
