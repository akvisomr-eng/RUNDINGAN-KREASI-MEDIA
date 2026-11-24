# Multi-Agen AI Otonom + Formulir SIMKLINIK Sesuai Regulasi

Dokumen ini menjelaskan dua penambahan besar pada ekosistem SIMKLINIK & RME:

1. **Sistem 7 agen AI otonom** yang menjaga keamanan, menguji sistem, meregenerasi pengetahuan, memperbaiki bug, menganalisis, dan meriset.
2. **AI Companion** (chatbot) di website dengan pengetahuan lokal offline-first yang bertambah cerdas saat online.
3. **Perubahan SIMKLINIK dari "papan pengumuman" menjadi aplikasi manajemen** dengan formulir lengkap + navigasi Update / Next / Delete / Cetak.

---

## 1. Tujuh Agen AI Otonom

Setiap agen terdaftar pada tabel `terapi_wicara.ai_agents`, dapat diaktifkan/dijadwalkan, dan **pekerjaannya nyata** (menulis hasil uji, temuan keamanan, dan ringkasan ke basis data yang dapat diaudit).

| Agen | Tugas | Otonomi | Jadwal |
|---|---|---|---|
| **AGEN_SUPERVISOR** | Orkestrasi semua agen, membersihkan tugas menggantung >60 menit, mencegah tumpang tindih | Semi-otonom | tiap 15 menit |
| **AGEN_KEAMANAN** | Audit RLS, deteksi pasien tanpa consent PDP, deteksi NIK tidak tersamar, verifikasi jejak audit, cek kelengkapan TTE | Semi-otonom | tiap 2 jam |
| **AGEN_PENGUJI** | Suite uji: fungsional RPC, integritas tarif, kelengkapan S-O-A-P, konsistensi paket sesi, performa query | Otonom penuh | tiap 30 menit |
| **AGEN_PENGETAHUAN** | Regenerasi/deduplikasi basis pengetahuan, tindak lanjut celah pengetahuan | Otonom penuh | tiap 6 jam |
| **AGEN_PERBAIKAN_BUG** | Deteksi kegagalan sinkronisasi SATUSEHAT, jadwal tanpa status, kegagalan uji tertunda; menjalankan retry otomatis | Semi-otonom | berbasis peristiwa |
| **AGEN_ANALIS** | Analitik pembatalan kunjungan, tagihan belum lunas, INM di bawah target, rekomendasi operasional | Otonom penuh | harian 01:00 |
| **AGEN_PENELITI** | Riset celah pengetahuan berulang (≥3×), menyiapkan draf artikel berlabel sumber untuk kurasi | Semi-otonom | harian 03:00 |

### Guardrail (batas aman)
Disimpan di kolom `guardrails` tiap agen, antara lain:
- Agen tidak boleh mengubah data pasien.
- Perubahan skema (DDL) dan penghapusan data **wajib persetujuan manusia** (`requires_human_approval`).
- Agen analis hanya boleh bekerja pada agregasi anonim, dilarang mengekspor data pribadi.
- Agen peneliti wajib menyertakan sitasi URL sumber resmi dan menandai artikel "belum terverifikasi" sampai dikurasi.

### Cara menjalankan
| Cara | Perintah / Lokasi |
|---|---|
| Manual dari UI | Buka **`/ai-command-center`** → klik **Jalankan Sekarang** pada agen yang diinginkan |
| API | `POST /api/agents/run` body `{"agents":["AGEN_KEAMANAN"]}` (kosong = semua) |
| Vercel Cron | Otomatis, sudah dikonfigurasi di `vercel.json` (`0 */2 * * *` dan `0 1 * * *`) |
| GitHub Actions | `.github/workflows/ai-agents-cycle.yml` (set secret `AGENT_APP_URL`) |

### Tabel baru
`ai_agents`, `ai_agent_runs`, `ai_knowledge_base`, `ai_companion_sessions`, `ai_companion_messages`, `ai_knowledge_gaps`, `ai_test_results`, `ai_security_findings` — semuanya **RLS aktif**, akses hanya melalui RPC `SECURITY DEFINER`.

### RPC baru
- `tw_ai_command_center_snapshot()` — seluruh kondisi agen, skor keamanan, hasil uji, celah pengetahuan
- `tw_ai_enqueue_task()`, `tw_ai_complete_task()` — antrean tugas
- `tw_ai_record_test()`, `tw_ai_record_finding()` — hasil uji & temuan
- `tw_ai_kb_search()`, `tw_ai_log_conversation()`, `tw_ai_report_knowledge_gap()` — AI Companion

---

## 2. AI Companion (Chatbot Website)

Tombol mengambang **“Tanya Wicara AI”** tampil di seluruh halaman (website publik, portal pasien, SIMKLINIK, Enterprise HQ).

### Arsitektur pengetahuan: lokal dulu, online kemudian
1. **Lokal (offline-first):** 17 artikel pengetahuan tertanam di `src/lib/ai/knowledgeSeed.ts` — tetap menjawab meski tanpa internet.
2. **Online (pengayaan):** saat terhubung, pencarian dilanjutkan ke RPC `tw_ai_kb_search` yang membaca pengetahuan hasil pembelajaran & riset agen.
3. **Pembelajaran bertahap:** hasil dari server disimpan ke `localStorage`, sehingga pada kunjungan berikutnya pengetahuan baru **ikut tersedia secara offline**.
4. **Celah pengetahuan:** pertanyaan yang tak terjawab dicatat via `tw_ai_report_knowledge_gap`. Setelah muncul **3 kali**, sistem otomatis menugaskan **AGEN_PENELITI** untuk merisetnya.

### Yang dikirim ke pengguna
- Jawaban ringkas dari artikel paling relevan.
- **Sitasi sumber & rujukan regulasi** (mis. Permenkes 24/2022).
- Skor keyakinan (confidence) dan indikator mode lokal/daring.
- Pertanyaan lanjutan yang disarankan.

### Prinsip keamanan
- AI **tidak mengarang** nomor rekam medis, diagnosis, atau tarif.
- Bila tidak ada sumber terpercaya: sistem memberi tahu terus terang, mencatat celah, dan mengarahkan ke petugas manusia (0354) 689420.
- Transkrip tercatat untuk audit, tanpa menyimpan identitas pribadi pengunjung.

---

## 3. SIMKLINIK: dari Papan Pengumuman → Aplikasi Manajemen

### Masalah sebelumnya
Seluruh menu SIMKLINIK (10 menu) hanya menampilkan tabel **baca-saja**. Tidak ada cara mengisi, mengubah, menghapus, atau mencetak data.

### Solusi: `FormulirCrud` + 13 skema resmi
Komponen `src/components/FormulirCrud.tsx` menyediakan aplikasi formulir penuh:

| Kemampuan | Keterangan |
|---|---|
| **Daftar rekaman** | Tabel dengan pencarian, penanda baris aktif, dan paginasi navigasi |
| **Entri Baru** | Nomor dokumen otomatis (RM / INV / PO), validasi field wajib |
| **Ubah** | Muat rekaman ke formulir, ubah, simpan dengan jejak audit |
| **Hapus** | Konfirmasi + snapshot disimpan pada audit log; SOAP terkunci TTE **ditolak** |
| **Next / Sebelumnya** | Navigasi antar rekaman langsung dari dalam formulir |
| **Cetak laporan resmi** | Kop klinik lengkap (izin Dinkes, NIB, kode fasyankes), tabel field, kolom tanda tangan, catatan audit |
| **Ekspor CSV** | Unduh seluruh rekaman terfilter (UTF-8 BOM, siap Excel) |
| **Indikator simpan** | Peringatan "ada perubahan belum disimpan" saat meninggalkan formulir |
| **Mode lokal** | Tetap berfungsi tanpa Supabase (data sementara di memori) |

### 13 formulir SIMKLINIK (sesuai regulasi)
| # | Menu | Tabel | Dasar Regulasi |
|---|---|---|---|
| 2 | **Admisi & Data Pokok Pasien** | `patients` | Permenkes 24/2022, UU PDP 27/2022 |
| 3 | **RME / CPPT SOAP** | `soap_sessions` | Permenkes 24/2022 Pasal 41 (TTE & addendum) |
| 5 | **Master SOP & PPK** | `sop_documents` | Permenkes 34/2022 (TKK), 81/2014 |
| 6 | **SDM, STR & SIP** | `therapists` | UU 17/2023, PP 28/2024 (STR seumur hidup, maks 3 SIP) |
| 7 | **Kasir & Tagihan** | `billing_invoices` | PSAK 72, tarif fasyankes |
| 8 | **Inventaris, MFK & Kalibrasi** | `clinic_inventory` | Permenkes 34/2022 (MFK), 14/2021 (PPI) |
| 9 | **Indikator Mutu INM** | `quality_indicators` | Permenkes 34/2022 (PMKP) |
| 11 | **Master Tarif Layanan** | `service_tariffs` | ICD-9-CM, UU 17/2023 |
| 12 | **Penjadwalan Sesi** | `appointments` | Permenkes 24/2022, 81/2014 |
| 13 | **Paket Sesi Terapi** | `patient_packages` | PSAK 72 (deferred revenue) |
| 14 | **Log Sterilisasi PPI** | `ppi_sterilization_logs` | Permenkes 14/2021 |
| 15 | **Insiden Keselamatan (IKP)** | `patient_safety_incidents` | Permenkes 34/2022, SKP Kemenkes |
| 16 | **Rujukan Interprofesional (PKP)** | `interprofessional_referrals` | Permenkes 34/2022 (PKP) |

### 4 formulir Enterprise HQ
| Menu | Tabel | Regulasi |
|---|---|---|
| 1. Holding PT & Cabang | `clinics` | KBLI 86104/86901, Permenkes 34/2022 |
| 4. Buku Besar & Jurnal | `finance_journal_entries` | PSAK 1 & 72 (double-entry) |
| 6. PO Pengadaan Alkes | `procurement_purchase_orders` | Izin PAK & NIE Kemenkes |
| Master Pemasok | `procurement_suppliers` | Permenkes 14/2021 |

### Mesin penyimpanan: RPC `tw_crud_save` / `tw_crud_delete`
- **Whitelist tabel** — tabel di luar daftar ditolak.
- **Whitelist kolom** — dibaca dari `information_schema`, mencegah injeksi nama kolom.
- **Audit otomatis** — setiap CREATE/UPDATE/DELETE masuk `rme_audit_logs` beserta peran, alasan, dan snapshot data lama (saat hapus).
- **Proteksi retensi** — SOAP ber-TTE tidak dapat dihapus; hanya addendum (Permenkes 24/2022).
- **Auto-isi `clinic_id` / `holding_id`** — mencegah relasi menggantung.

---

## Ringkasan Berkas Baru

```text
apps/terapi-wicara-web/
├── app/ai-command-center/page.tsx        Dashboard 7 agen AI
├── app/api/agents/run/route.ts           Endpoint eksekusi agen (cron + manual)
├── src/components/AiCompanionWidget.tsx  Chatbot mengambang
├── src/components/FormulirCrud.tsx       Mesin formulir (CRUD + cetak)
├── src/lib/ai/knowledgeSeed.ts           17 artikel pengetahuan lokal
├── src/lib/ai/companionEngine.ts         Retrieval lokal + pengayaan online
├── src/lib/ai/agentRuntime.ts            Eksekusi nyata 7 agen
├── src/lib/formSchemas.ts                13 skema formulir SIMKLINIK
└── src/lib/enterpriseSchemas.ts          4 skema formulir Enterprise

apps/simklinik-rme-database/migrations/
└── 0006_multi_agent_ai_and_universal_crud.sql

.github/workflows/ai-agents-cycle.yml     Penjadwal agen via GitHub Actions
```

## Variabel Lingkungan Tambahan (opsional)
```env
# Aktifkan akses penuh agen (audit menyeluruh). Jangan pakai prefiks NEXT_PUBLIC_.
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxxxxxx

# Kunci bersama penjadwal ↔ endpoint agen
AGENT_RUNNER_SECRET=kunci-rahasia-panjang
```

Tanpa dua variabel itu, agen tetap berjalan menggunakan publishable key (akses via RPC), dan endpoint agen terbuka untuk dipicu manual dari UI.
