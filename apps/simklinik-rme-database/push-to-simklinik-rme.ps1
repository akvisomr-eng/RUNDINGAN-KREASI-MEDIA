# ==============================================================================
# SKRIP POWERSHELL (WINDOWS) — PUSH 1-PERINTAH KE REPO MANDIRI: SIMKLINIK-RME
# Target GitHub  : https://github.com/akvisomr-eng/SIMKLINIK-RME.git
# Target Supabase: https://fawmudsaaotlqyryciwd.supabase.co (SUDAH AKTIF & TERISI)
# ==============================================================================

$ErrorActionPreference = "Stop"

$SourceRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$ParentDir  = Split-Path -Parent $SourceRoot
$TargetDir  = Join-Path $ParentDir "SIMKLINIK-RME"
$RemoteUrl  = "https://github.com/akvisomr-eng/SIMKLINIK-RME.git"

Write-Host "==> [1/5] Menyiapkan direktori monorepo bersih di: $TargetDir" -ForegroundColor Cyan
if (Test-Path $TargetDir) { Remove-Item -Recurse -Force $TargetDir }
New-Item -ItemType Directory -Force -Path (Join-Path $TargetDir "apps") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $TargetDir "supabase\migrations") | Out-Null

Write-Host "==> [2/5] Menyalin Aplikasi Android Terapis Wicara & Web SIMKLINIK/Enterprise HQ..." -ForegroundColor Cyan
$ExcludeDirs  = @("node_modules", ".next", ".expo", "dist", "web-build", "out")
$ExcludeFiles = @(".env", ".env.local", "*.tsbuildinfo")

robocopy (Join-Path $SourceRoot "apps\terapi-wicara-android") (Join-Path $TargetDir "apps\terapi-wicara-android") /E /XD $ExcludeDirs /XF $ExcludeFiles /NFL /NDL /NJH /NJS | Out-Null
robocopy (Join-Path $SourceRoot "apps\terapi-wicara-web")     (Join-Path $TargetDir "apps\terapi-wicara-web")     /E /XD $ExcludeDirs /XF $ExcludeFiles /NFL /NDL /NJH /NJS | Out-Null
Copy-Item (Join-Path $SourceRoot "apps\simklinik-rme-database\migrations\*.sql") (Join-Path $TargetDir "supabase\migrations\")

# Salin workflow GitHub Actions (builder APK/AAB di cloud + deploy Vercel) & skrip .cmd Windows
New-Item -ItemType Directory -Force -Path (Join-Path $TargetDir ".github\workflows") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $TargetDir "tools\windows") | Out-Null
Copy-Item (Join-Path $SourceRoot ".github\workflows\*.yml") (Join-Path $TargetDir ".github\workflows\")
Copy-Item (Join-Path $SourceRoot "tools\windows\*.cmd") (Join-Path $TargetDir "tools\windows\")

Write-Host "==> [3/5] Membuat berkas konfigurasi root (.gitignore, package.json, README.md)..." -ForegroundColor Cyan
@"
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
"@ | Set-Content -Path (Join-Path $TargetDir ".gitignore") -Encoding UTF8

@"
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
"@ | Set-Content -Path (Join-Path $TargetDir "package.json") -Encoding UTF8

Copy-Item (Join-Path $SourceRoot "apps\simklinik-rme-database\README.md") (Join-Path $TargetDir "README.md")

Write-Host "==> [4/5] Inisialisasi Git & Commit Awal..." -ForegroundColor Cyan
Push-Location $TargetDir
git init -b main
if ($LASTEXITCODE -ne 0) { throw "git init gagal" }
git add -A
if ($LASTEXITCODE -ne 0) { throw "git add gagal" }
git commit -m "feat: standalone SIMKLINIK, RME Android, Portal Pasien & Healthcare Enterprise HQ (Skenario A + Opsi 1)"
if ($LASTEXITCODE -ne 0) { throw "git commit gagal (pastikan git config user.name dan user.email sudah diset)" }

Write-Host "==> [5/5] Push ke $RemoteUrl (branch: main)..." -ForegroundColor Cyan
git remote add origin $RemoteUrl
git push -u origin main
if ($LASTEXITCODE -ne 0) {
  Pop-Location
  throw "git push gagal! Pastikan Git di komputer Anda sudah login ke GitHub (akvisomr-eng)."
}
Pop-Location

Write-Host "`nSELESAI! Repositori mandiri telah berhasil terbit di: https://github.com/akvisomr-eng/SIMKLINIK-RME" -ForegroundColor Green
