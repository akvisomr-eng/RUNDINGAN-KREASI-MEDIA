# Laporan Lanjutan — Otonomi Agen yang Benar-Benar Berjalan

Tanggal: 24 November 2026
Branch: `arena/82c43d8c-rundingan-kreasi-media`
Commit terakhir: `c20fbdf`

---

## Ringkasan dalam satu paragraf

Saya menemukan bahwa **ketujuh agen AI tidak pernah berjalan sendiri**. Sistem
mengklaim "otonom", tetapi ketiga jalur penjadwalannya semuanya buntu: GitHub
Actions menolak workflow-nya sendiri, Vercel Cron menunggu deploy, dan runtime
hanya mengerjakan tugas yang sudah ada di antrean — antrean yang tidak pernah
diisi karena tidak ada yang mengisinya. Saya perbaiki akar masalahnya dengan
memindahkan penjadwalan **ke dalam basis data** memakai `pg_cron`, dan kini
sudah terbukti berjalan: basis data mendaftarkan tugas agen sendiri setiap
15 menit tanpa bantuan siapa pun.

---

## 1. Tiga kebuntuan yang ditemukan

### 1.1 Workflow GitHub Actions tidak pernah bisa dijalankan

```
could not create workflow dispatch event: HTTP 422:
Unrecognized named-value: 'secrets'
(Line: 46, Col: 13) ... expr: secrets.AGENT_APP_URL != ''
```

GitHub **melarang** `secrets` di dalam `if:` pada level step. Artinya
`.github/workflows/ai-agents-cycle.yml` bukan sekadar belum jalan — file itu
**ditolak utuh oleh GitHub** sejak awal. Setiap kali saya coba memicunya, gagal.

**Perbaikan:** rahasia dipetakan ke `env:` level job, kondisi memakai
`env.AGENT_APP_URL`. Setelah itu workflow berhasil di-dispatch (`run
45384088509`, 7 detik, sukses).

### 1.2 Bahkan setelah diperbaiki, tetap tidak jalan

Workflow lolos, tetapi semua langkahnya *skipped* karena `AGENT_APP_URL` belum
diisi. Secret itu ada di organisasi `akvisomr-eng/SIMKLINIK-RME`, sedangkan
token sandbox ini hanya berwenang atas repositori ini. Saya **tidak bisa**
mengisi secret tersebut, dan berpura-pura sebaliknya tidak akan membantu.

### 1.3 Runtime hanya mengklaim, tidak pernah mendaftarkan

`/api/agents/run` memanggil `claimAndRun()` untuk tiap agen. Fungsi itu mencari
baris `ai_agent_runs` berstatus `ANTREAN`. Kalau tidak ada — dan tidak ada,
karena tidak ada yang membuatnya — hasilnya `DILEWATI` untuk ketujuh agen.

Jadi urutannya begini: cron memanggil endpoint → endpoint mencari tugas →
tidak ada tugas → selesai tanpa melakukan apa pun. Tampak sehat di log,
sebenarnya lumpuh.

---

## 2. Solusi: penjadwalan pindah ke dalam basis data

Kalau penjadwal bergantung pada situs yang hidup atau akun Vercel, ia akan
selalu punya titik kegagalan di luar kendali. `pg_cron` menghilangkan
ketergantungan itu — basis data yang menyimpan data pasien juga yang
menjadwalkan pemeliharaannya sendiri.

### Yang dibangun

| Fungsi / objek | Tugas |
|---|---|
| `tw_ai_cron_interval(text)` | Menerjemahkan ekspresi cron menjadi interval nyata |
| `tw_ai_dispatch_due(force)` | Mendaftarkan tugas untuk agen yang jatuh tempo (batas 25 antrean/agen) |
| `tw_ai_heartbeat(minutes)` | Menandai tugas menggantung sebagai `GAGAL`, agen senyap sebagai `DEGRADASI` |
| `tw_ai_prepare_cycle(force)` | Denyut nadi + dispatch dalam satu panggilan |
| `tw_ai_agent_health()` | Kesehatan per agen (success rate, kedalaman antrean, dsb.) |
| `tw_ai_scheduler_status()` | Status job cron + hasil eksekusi terakhir |
| `postgres-tw_ai_dispatch_15m` | **Cron tiap 15 menit** → `tw_ai_dispatch_due` |
| `postgres-tw_ai_heartbeat_hourly` | **Cron tiap jam** → `tw_ai_heartbeat(120)` |

### Jebakan yang hampir membuat saya salah lapor

Ini bagian yang perlu Anda tahu, karena saya sempat hampir mengklaim sukses
padahal belum:

Job pertama saya beri nama `tw_ai_dispatch_15m`. Job itu **terdaftar**,
`active = true`, dan tampak sempurna di `cron.job`. Saya tunggu 25 menit —
**tidak pernah dieksekusi sekali pun**. `cron.job_run_details` kosong.

Ternyata pada Supabase, pg_cron hanya menjalankan job yang namanya **diawali
nama database**. Nama database di sini `postgres`, jadi job harus bernama
`postgres-tw_ai_dispatch_15m`. Setelah diganti, job langsung berjalan.

Kalau saya hanya memeriksa `cron.job` dan tidak menunggu bukti eksekusi, saya
akan melaporkan "penjadwal aktif" untuk sesuatu yang diam.

---

## 3. Bukti bahwa sekarang benar-benar berjalan

### 3.1 Eksekusi cron nyata

```
jobname                       : postgres-tw_ai_dispatch_15m
status                        : succeeded
start_time                    : 2026-11-24 11:45:00.047428+00
return_message                : 1 row
```

### 3.2 Tugas yang dibuatnya

```
agent_key  : AGEN_SUPERVISOR
task_type  : ORKESTRASI_RUTIN
status     : ANTREAN
source     : AUTO_DISPATCH          ← dibuat mesin, bukan manusia
created_at : 2026-11-24 11:45:00.047453+00
```

Timestamp tugas sama persis dengan timestamp eksekusi cron. Tidak ada satu pun
manusia yang menekan tombol pada saat itu.

### 3.3 Uji penjadwalan manual (7 agen sekaligus)

`tw_ai_prepare_cycle(true)` → `dispatched: 7`, masing-masing dengan jenis tugas
yang benar: `ORKESTRASI_RUTIN`, `AUDIT_KEAMANAN`, `UJI_SISTEM_BERKALA`,
`REGENERASI_PENGETAHUAN`, `ANALISIS_KINERJA`, `PEMINDAIAN_BUG`,
`RISET_REGULASI`.

### 3.4 Uji denyut nadi

Saya sisipkan satu baris uji berstatus `ANTREAN` bertanggal 3 jam lalu, lalu
jalankan `tw_ai_heartbeat(120)`:

```
status         : GAGAL
error_message  : Kedaluwarsa: tugas tidak diklaim runtime dalam 120 menit.
output_summary : Tidak pernah dijalankan — kemungkinan runtime/cron tidak aktif.
```

Baris uji sudah dihapus setelah verifikasi.

### 3.5 Parser interval cron

| Ekspresi | Hasil |
|---|---|
| `*/30 * * * *` | `00:30:00` ✓ |
| `0 */2 * * *` | `02:00:00` ✓ |
| `0 3 * * *` | `1 day` ✓ |

### 3.6 Jadwal agen diselaraskan

Sebelumnya `AGEN_KEAMANAN` punya cron `0 */6 * * *` padahal cron Vercel dan
GitHub memanggil tiap 2 jam. Kolom jadwal dan jadwal sebenarnya tidak cocok.
Kini: Keamanan `0 */2`, Penguji `*/30`, Perbaikan Bug `0 4` (harian).

---

## 4. Perubahan di sisi aplikasi

### Pusat Komando AI — panel "Penjadwal Otonom"

Sebelumnya panel hanya menampilkan skor keamanan, jumlah agen, jumlah artikel,
dan jumlah uji. Tidak ada cara membedakan "agen sehat" dari "agen yang tidak
pernah dipanggil". Sekarang ada:

- Menunggu / Sedang Jalan / **Menggantung** / **Agen Degradasi**
- Per agen: kedalaman antrean, success rate, status terakhir, hari senyap,
  tanda jatuh tempo

Kolom baru di snapshot: `queue_depth`, `success_rate`, `last_status`,
`is_overdue`, `silent_days`, plus blok `queue` dan `agents_degraded`.

### `/api/health` — kini melaporkan denyut penjadwal

Sebelumnya hanya `status: "healthy"`. Itu menjawab "apakah proses hidup", bukan
"apakah agen bekerja". Sekarang menyertakan `scheduler` berisi daftar job cron,
hasil eksekusi terakhir, dan jumlah tugas tertunda.

### `/api/agents/run` — menjalankan penjadwal sebelum klaim

Sebelum mengklaim tugas, route memanggil `tw_ai_prepare_cycle()` sehingga
siklus yang dipicu siapa pun selalu menemukan tugas untuk dikerjakan, bukan
antrean kosong. Respons menyertakan ringkasan `dispatched / executed / failed`.

### Android — ketahanan

- **`ErrorBoundary`**: satu galat render tidak lagi membuat aplikasi menjadi
  layar putih. Terapis melihat pesan jelas, dan diberi tahu bahwa data lokal
  tetap aman.
- **Tombol Back Android**: kembali ke tab sebelumnya → ke Beranda → tekan dua
  kali untuk keluar. Sebelumnya Back langsung menutup aplikasi, berisiko
  kehilangan isian yang belum disimpan.

---

## 5. Verifikasi teknis

| Pemeriksaan | Hasil |
|---|---|
| `tsc --noEmit` (web) | ✅ 0 error |
| `tsc --noEmit` (android) | ✅ 0 error |
| `next build` | ✅ 8 rute, compiled 1031ms |
| Rute web (7 buah) | ✅ semua 200 |
| Metro bundle Android | ✅ 200, 2565 modul |
| Cron job benar-benar jalan | ✅ `succeeded` 11:45:00 UTC |
| Tugas dibuat otomatis | ✅ `AUTO_DISPATCH` AGEN_SUPERVISOR |
| Denyut nadi menandai tugas mati | ✅ `GAGAL` + pesan jelas |
| Workflow AI dapat di-dispatch | ✅ run `45384088509` sukses |

---

## 6. Yang masih butuh tangan Anda (dan alasannya)

Saya tidak akan mengklaim ini selesai penuh, karena ada dua hal yang memang di
luar jangkauan sandbox ini:

### 6.1 Deploy Vercel — 1 klik

Tidak ada kredensial akun Vercel di sini.

```
https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fakvisomr-eng%2FSIMKLINIK-RME&root-directory=apps%2Fterapi-wicara-web&project-name=simklinik-terapi-wicara
```

Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`NEXT_PUBLIC_CLINIC_CODE=TW-2026`, `NEXT_PUBLIC_CLINIC_NAME`.

Setelah deploy, **penjadwalan tetap tidak bergantung pada Vercel** — pg_cron
sudah jalan tanpa itu. Vercel hanya agar UI dapat diakses publik.

### 6.2 Secret GitHub `AGENT_APP_URL` (opsional)

Hanya diperlukan bila Anda ingin GitHub Actions juga ikut memicu siklus penuh
(tidak wajib lagi, karena pg_cron sudah mendaftarkan tugas). Isi dengan URL
Vercel setelah langkah 6.1.

### 6.3 Siapa yang mengeksekusi tugas

Ini batas yang jujur perlu saya sampaikan: **pg_cron mendaftarkan tugas, tetapi
tidak mengeksekusinya.** Eksekusi butuh runtime JavaScript (`agentRuntime.ts`)
yang memanggil RPC `tw_ai_complete_task`.

Konsekuensinya sekarang: setiap 15 menit tugas bertambah di antrean. Bila tidak
ada runtime yang mengklaimnya dalam 120 menit, `tw_ai_heartbeat` menandainya
`GAGAL` dengan pesan *"kemungkinan runtime/cron tidak aktif"*.

Itu **perilaku yang benar** — lebih baik jujur gagal daripada diam-diam
menganggur. Tapi artinya: agar agen benar-benar menyelesaikan pekerjaan, salah
satu harus hidup:

1. **Vercel Cron** setelah 6.1 (paling mudah — sudah dikonfigurasi di
   `vercel.json`, panggilan tiap 2 jam & harian), atau
2. **GitHub Actions** setelah 6.2, atau
3. Situs web yang sedang hidup, dipanggil manual dari Pusat Komando AI.

Untuk sementara, antrean akan terisi dan tugas yang tidak terklaim akan
ditandai gagal secara transparan — bukan gagal diam-diam.

---

## 7. Commit pada sesi ini

| Commit | Isi |
|---|---|
| `5c33681` | Penjadwal otonom + denyut nadi agen; ErrorBoundary & Back Android |
| `af2b2cb` | Langkah periksa kesiapan agen + gagal-keras saat siklus gagal |
| `42ece6d` | **Perbaikan workflow** — `secrets` di step-level `if` ditolak GitHub |
| `c20fbdf` | **pg_cron**: penjadwal nyata di dalam basis data |

Migrasi basis data: `0007_agent_dispatcher_and_heartbeat.sql`,
`0008_pg_cron_scheduler.sql` (keduanya sudah diterapkan ke
`fawmudsaaotlqyryciwd`).

---

## 8. Saran lanjutan

- **Edge Function penggerak agen.** Supabase Edge Function bisa dipanggil
  `pg_net` dari pg_cron, sehingga agen berjalan penuh di dalam ekosistem
  Supabase tanpa Vercel maupun GitHub Actions. Ini menghapus ketergantungan
  terakhir pada layanan luar.
- **Notifikasi WhatsApp/email** ke penanggung jawab klinik bila skor keamanan
  turun di bawah 70 atau ada agen `DEGRADASI` lebih dari sehari.
- **Mode gelap** aplikasi Android untuk ruang terapi minim cahaya.
- **Ekspor PDF** catatan per pasien dari tab Riwayat.
