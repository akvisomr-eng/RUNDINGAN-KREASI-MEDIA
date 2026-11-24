# ✅ No. 2 & No. 3 — Hasil Eksekusi Mandiri

Dikerjakan otomatis oleh agen. Semua berkas ada di branch `arena/82c43d8c-rundingan-kreasi-media`.

---

## No. 3 — Build Android `.apk` & `.aab` → **BERHASIL, BERKAS SUDAH ADA**

| Item | Hasil |
|---|---|
| Metode | GitHub Actions `ubuntu-latest` (JDK 17 + Android SDK + NDK bawaan) |
| Perintah build | `npx expo prebuild --platform android` → `./gradlew assembleRelease bundleRelease` |
| Durasi | **12 menit 8 detik**, status **✓ success**, 0 error |
| `WicaraSehat-Terapis-v1.0.0.apk` | **79,9 MB** — siap dipasang di HP/tablet terapis |
| `WicaraSehat-Terapis-v1.0.0.aab` | **54,4 MB** — siap unggah ke Google Play Console |
| Unduh (klik dari HP) | https://github.com/akvisomr-eng/RUNDINGAN-KREASI-MEDIA/releases |
| Riwayat build | https://github.com/akvisomr-eng/RUNDINGAN-KREASI-MEDIA/actions/workflows/build-android-apk.yml |

**Tidak diperlukan lagi di komputer Anda:** EAS CLI, akun Expo, `npm install`, `npx`, Java, Android Studio, maupun PowerShell. Build pertama bahkan sudah selesai tanpa Anda menjalankan apa pun — dipicu otomatis oleh push.

### Cara memasang di HP/tablet Android
1. Buka tautan **Releases** di atas dari browser HP.
2. Unduh `WicaraSehat-Terapis-v1.0.0.apk`.
3. Buka berkas → pilih **"Install anyway" / "Tetap pasang"**.
4. Sekali saja izinkan **"Install unknown apps"** untuk browser/File Manager.
5. Login uji terapis: `TW-2023-001`.

---

## No. 2 — Deploy Web ke Vercel → **SIAP DEPLOY 1 KLIK**

Aplikasi web sudah lolos `next build` produksi (**7 route, 0 error**): `/`, `/portal-pasien`, `/simklinik`, `/enterprise`, `/api/health`, `/_not-found`.

Konektor **Vercel di Arena masih `disconnected`**, sehingga agen tidak bisa menekan tombol deploy atas nama Anda. Dua jalur sudah disiapkan — **keduanya tanpa PowerShell**:

### Jalur A — tombol Deploy with Vercel (±60 detik)
```text
https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fakvisomr-eng%2FSIMKLINIK-RME&root-directory=apps%2Fterapi-wicara-web&project-name=simklinik-terapi-wicara
```
Login GitHub → **Deploy**. Isi Environment Variables:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://fawmudsaaotlqyryciwd.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_wRGUQNJKi5XUjMXHFpDxVw_hPAPyhUc` |
| `NEXT_PUBLIC_CLINIC_CODE` | `TW-2026` |
| `NEXT_PUBLIC_CLINIC_NAME` | `Klinik Terapi Wicara WicaraSehat` |

### Jalur B — GitHub Actions otomatis penuh
1. Token: https://vercel.com/account/tokens
2. Simpan sebagai secret `VERCEL_TOKEN` di https://github.com/akvisomr-eng/SIMKLINIK-RME/settings/secrets/actions
3. Tab **Actions** → **Deploy Web (SIMKLINIK + Portal + Enterprise HQ) ke Vercel** → **Run workflow**. URL produksi muncul di ringkasan run.

---

## Penyebab & Solusi 2 Error Windows Anda

| Error | Penyebab | Solusi yang sudah disiapkan |
|---|---|---|
| `npm.ps1 / npx.ps1 cannot be loaded ... PSSecurityException` | `ExecutionPolicy = Restricted` di PowerShell | Semua skrip baru memakai `npm.cmd` / `npx.cmd` / browser, **tidak pernah** `.ps1` npm. Untuk memperbaiki permanen: menu **[7]** di `MULAI-DI-SINI.cmd` (`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`). |
| `cd : Cannot find path 'C:\Windows\system32\SIMKLINIK-RME\...'` | PowerShell Administrator selalu mulai di `C:\Windows\system32`, lalu path ditulis relatif (dan terduplikasi `SIMKLINIK-RME\SIMKLINIK-RME`) | Semua skrip `.cmd` diawali `cd /d "%~dp0"` (selalu pindah ke folder skrip). Jangan jalankan `npm` dari PowerShell Administrator. |

### Skrip baru (klik 2×, tanpa terminal)
| Berkas | Fungsi |
|---|---|
| `tools\windows\MULAI-DI-SINI.cmd` | Menu 8 pilihan: build APK cloud, cek unduhan, deploy Vercel, jalankan web lokal, jalankan Expo, push Git, perbaiki PowerShell, cek versi Node/Git |
| `tools\windows\BUILD-APK-TANPA-ERROR.cmd` | Langsung memicu build APK/AAB di cloud + membuka halaman unduhan |

---

## Status akhir

| Tahap | Status |
|---|---|
| 1. Repo mandiri `akvisomr-eng/SIMKLINIK-RME` | ✅ 53 berkas, 0 secret bocor |
| 1b. Supabase `fawmudsaaotlqyryciwd` | ✅ 27 tabel RLS + 12 RPC `SECURITY DEFINER` |
| 2. Web Vercel | 🟡 Siap deploy — 1 klik tombol Vercel / 1 secret token |
| 3. Android `.apk` + `.aab` | ✅ **Sudah dibangun & diterbitkan** (79,9 MB / 54,4 MB) |
