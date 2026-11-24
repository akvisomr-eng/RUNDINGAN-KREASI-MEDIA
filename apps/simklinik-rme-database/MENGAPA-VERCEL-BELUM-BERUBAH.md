# MENGAPA simklinik-rme.vercel.app BELUM BERUBAH — DAN CARA MEMPERBAIKINYA

Tanggal: 24 November 2026

---

## 1. Diagnosis: situs Vercel tidak terhubung ke tempat saya bekerja

Saya sudah memeriksa langsung `https://simklinik-rme.vercel.app/simklinik`. Isinya
masih kode lama:

- `Pasien Aktif Terdaftar RME`, `Matriks Jadwal Harian Ruang & Terapis Wicara`
- **tidak ada** `Perlu Tindakan Anda`, **tidak ada** `Bridging SATUSEHAT` versi baru

Lalu saya lacak asalnya:

```
$ git remote -v
origin  https://github.com/akvisomr-eng/RUNDINGAN-KREASI-MEDIA.git
```

**Situs itu tidak dibangun dari repositori ini.** Ia dibangun dari
`akvisomr-eng/SIMKLINIK-RME` — repositori terpisah, sesuai permintaan Anda
sebelumnya agar ekosistem SIMKLINIK dipisah ke repo sendiri.

Saya mengkloning repo itu untuk memastikan:

```
$ grep -c "ClinicOperatingDashboard" apps/terapi-wicara-web/app/simklinik/page.tsx
0
$ grep -c "Matriks Jadwal Harian" ...
1            ← masih kode lama
```

Jadi seluruh pekerjaan saya — **20 commit** — ada di
`RUNDINGAN-KREASI-MEDIA`, sementara Vercel menayangkan `SIMKLINIK-RME`
yang masih versi lama.

## 2. Saya tidak bisa menembusnya sendiri

Saya sudah mencoba menulis ke repo itu:

```
$ git push origin main
remote: Permission to akvisomr-eng/SIMKLINIK-RME.git denied to akvisomr-eng.
fatal: ... error 403
```

Token GitHub yang tersedia di sesi ini hanya berwenang atas
`RUNDINGAN-KREASI-MEDIA`. Saya **tidak punya kredensial Vercel** dan **tidak
punya izin tulis** ke repo tempat Vercel men-deploy. Tidak ada cara saya
mengubah situs itu tanpa salah satu dari dua hal tersebut.

Saya sengaja tidak mengarang alasan lain, karena ini masalah izin, bukan
masalah kode.

## 3. Dua cara memperbaikinya — pilih salah satu

### Cara A — Beri saya izin tulis ke repo (paling rapi, sekali atur)

1. Buka **GitHub → Settings → Applications → Installed GitHub Apps → Configure**
   (aplikasi Arena).
2. Pada **Repository access**, tambahkan `akvisomr-eng/SIMKLINIK-RME`.
3. Beri tahu saya. Saya dorong seluruh perubahan ke sana, Vercel otomatis
   membangun ulang.

Setelah itu setiap perbaikan berikutnya langsung sampai ke situs.

### Cara B — Unggah manual (tanpa mengubah izin)

Saya sudah menyiapkan paket siap-pakai:

**`SIMKLINIK-WEB-FIX.zip`** (168 KB, 34 berkas) — ada di akar repositori ini.

Langkahnya:

1. Unduh `SIMKLINIK-WEB-FIX.zip` dari panel berkas.
2. Buka repositori `akvisomr-eng/SIMKLINIK-RME` di GitHub.
3. Masuk ke folder `apps/terapi-wicara-web`.
4. Klik **Add file → Upload files**, lalu seret isi zip (folder `app/`,
   `src/`, `package.json`, dll — bukan zip-nya).
5. Commit ke `main`. Vercel akan membangun ulang otomatis dalam ~2 menit.

> Catatan: bila GitHub menolak unggah file di dalam folder bertingkat,
> gunakan `git` biasa:
> ```bash
> git clone https://github.com/akvisomr-eng/SIMKLINIK-RME.git
> cd SIMKLINIK-RME/apps
> rm -rf terapi-wicara-web
> unzip ~/Downloads/SIMKLINIK-WEB-FIX.zip -d terapi-wicara-web
> cd .. && git add -A && git commit -m "feat: dasbor operasional + modul M4 & M10" && git push
> ```

---

## 4. Apa yang akan Anda lihat setelah berhasil

### Menu 1 — Dasbor Operasional (bukan papan pengumuman)
- Sapaan peran + jam berjalan (perbarui tiap 30 detik)
- **"Perlu Tindakan Anda"**: antrean kerja nyata — pendaftaran daring
  menunggu verifikasi, SOAP belum TTE, encounter SATUSEHAT tertunda, SIP
  jatuh tempo, tagihan belum lunas, stok minimum, kalibrasi alat, indikator
  mutu di bawah target, insiden IKP. Tiap butir punya tombol menuju modulnya.
- **Tabel jadwal interaktif**: cari pasien/RM/ruang, filter status, dan menu
  **Ubah** per baris → ubah status sesi langsung ke database atau kirim
  pengingat.
- Keuangan (diterima vs ditangguhkan PSAK 72), progres bridging SATUSEHAT
  dengan tombol kirim ulang, indikator mutu, kesiapan ruang, dan panel
  verifikasi pendaftaran daring yang menerbitkan No. RM.

### Menu 2, 3, 5–9, 11–16 — 13 formulir CRUD penuh
Setiap menu membuka formulir dengan navigasi lengkap:
**Entri Baru · Ubah · Hapus · Sebelumnya · Berikutnya · Cetak Laporan · Ekspor CSV**

Bidang isian mengikuti standar nasional, antara lain:
- Admisi: No. RM, NIK tersamar, wali, diagnosis rujukan ICD-10, consent PDP
- CPPT SOAP: S/O/A/P, ICD-10, ICD-9-CM, ICF, penguncian TTE
- SOP/PPK: nomor dokumen, revisi, dasar hukum
- SDM: STR seumur hidup, SIP + masa berlaku, SKP, IHS Practitioner ID
- Kasir: kuitansi resmi, metode bayar, status lunas
- Sarpras/PPI: stok minimum, kalibrasi, kondisi alat
- Mutu INM: numerator/denominator, target vs capaian
- Tarif: kode layanan, ICD-9-CM, durasi, harga satuan

### Menu 4 — Bridging SATUSEHAT (BARU, sebelumnya hampa)
Antrean transmisi FHIR R4 + navigasi baris + kirim ulang per rekaman maupun
seluruh antrean + lihat/salin payload FHIR + **cetak berita acara transmisi**
+ ekspor CSV.

### Menu 10 — RBAC & Audit PDP (BARU, sebelumnya hampa)
- **Jejak Audit**: filter aksi, pencarian, navigasi baris, cetak laporan audit
  dengan kolom tanda tangan Kepala Klinik, ekspor CSV.
- **Matriks Izin**: 16 modul × 5 peran (Baca / Tulis / Tidak berhak) dengan
  tombol uji peran langsung.
- Jejak audit **tanpa tombol hapus** — disengaja, UU PDP Pasal 35 mewajibkan
  catatan akses dipertahankan.

---

## 5. Yang sudah saya verifikasi (dan yang tidak)

| Pemeriksaan | Hasil |
|---|---|
| `tsc --noEmit` | ✅ 0 error |
| `next build` | ✅ 8 rute, compiled 966ms |
| 6 rute web lokal | ✅ semua 200 |
| 16 menu punya render | ✅ 13 formulir + 3 modul khusus |
| Menu M4 & M10 sebelumnya hampa | ✅ diperbaiki (terbukti dari kode) |
| **Situs Vercel menampilkan versi baru** | ❌ **belum** — terkunci izin, lihat bagian 1–3 |

Saya tidak bisa menguji tampilan secara visual (tidak ada browser di sandbox
ini), dan saya tidak bisa menguji situs Vercel sampai salah satu dari dua
langkah di bagian 3 dijalankan.

---

## 6. Ringkas

Masalahnya **bukan** kode saya belum jadi — masalahnya **kode saya tidak
pernah sampai ke repositori yang Vercel bangun.** Setelah Anda memilih Cara A
atau Cara B, perubahan akan langsung terlihat.
