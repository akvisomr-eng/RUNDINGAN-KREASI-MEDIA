/**
 * Basis pengetahuan LOKAL AI Companion (offline-first).
 *
 * Sesuai permintaan: pengetahuan ditanamkan secara lokal di aplikasi, sehingga
 * chatbot tetap dapat menjawab saat offline / sebelum terhubung ke server.
 * Ketika sistem online, pencarian diperkaya dari tabel `ai_knowledge_base`
 * (Supabase) dan pengetahuan hasil pembelajaran disimpan ke localStorage
 * agar ikut tersedia offline pada kunjungan berikutnya.
 */

export type KnowledgeCategory =
  | 'KLINIS'
  | 'REGULASI'
  | 'LAYANAN'
  | 'TARIF'
  | 'ADMINISTRASI'
  | 'PANDUAN_WEB'
  | 'FAQ'
  | 'RISET'
  | 'TEKNIS';

export type KnowledgeSource = 'SEED_LOKAL' | 'PEMBELAJARAN_WEB' | 'RISET_AGEN' | 'KURASI_MANUSIA';

export interface KnowledgeEntry {
  id: string;
  topic: string;
  subtopic?: string;
  category: KnowledgeCategory;
  title: string;
  content: string;
  keywords: string[];
  regulationReference?: string;
  sourceKind: KnowledgeSource;
  sourceUrl?: string;
  confidence: number;
  updatedAt: string;
}

const now = () => new Date().toISOString();

export const LOCAL_KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: 'kb-lokal-001',
    topic: 'Klinik',
    subtopic: 'Identitas Layanan',
    category: 'LAYANAN',
    title: 'Apa itu Klinik Terapi Wicara WicaraSehat?',
    content:
      'WicaraSehat adalah klinik utama rehabilitasi medik yang melayani terapi wicara untuk anak dan dewasa. Klinik menangani lima domain: bahasa reseptif-ekspresif, bicara dan artikulasi, suara, irama kelancaran (gagap), serta menelan (disfagia). Setiap sesi berlangsung 45 menit di ruang kedap suara dengan kebisingan di bawah 35 dB, ditangani terapis wicara ber-STR seumur hidup dan bersertifikat BHD sesuai UU No. 17 Tahun 2023.',
    keywords: ['klinik', 'terapi wicara', 'layanan', 'wicarasehat', 'domain', 'lima domain', 'rehabilitasi'],
    regulationReference: 'UU No. 17 Tahun 2023 tentang Kesehatan',
    sourceKind: 'SEED_LOKAL',
    confidence: 0.98,
    updatedAt: now(),
  },
  {
    id: 'kb-lokal-002',
    topic: 'Klinik',
    subtopic: 'Jadwal dan Pendaftaran',
    category: 'ADMINISTRASI',
    title: 'Bagaimana cara mendaftar dan membuat jadwal terapi?',
    content:
      'Pendaftaran dilakukan melalui formulir Booking Online di halaman utama website ini. Anda mengisi data pasien (nama lengkap, tanggal lahir, jenis kelamin), data wali, nomor telepon, tanggal dan slot yang diinginkan, jenis layanan, serta keluhan utama. Setelah terkirim, petugas admisi memverifikasi minimal 2 identitas lalu menerbitkan Nomor Rekam Medis berformat RM-TW-2026-XXXX. Anda akan dihubungi melalui WhatsApp pada nomor wali untuk konfirmasi jadwal.',
    keywords: ['daftar', 'booking', 'pendaftaran', 'jadwal', 'online', 'reservasi', 'rekam medis', 'antrean', 'nomor rm'],
    regulationReference: 'Permenkes No. 24 Tahun 2022 tentang Rekam Medis',
    sourceKind: 'SEED_LOKAL',
    confidence: 0.96,
    updatedAt: now(),
  },
  {
    id: 'kb-lokal-003',
    topic: 'Klinik',
    subtopic: 'Tarif',
    category: 'TARIF',
    title: 'Berapa biaya satu sesi terapi dan apakah ada paket?',
    content:
      'Tarif sesi terapi wicara reguler 45 menit adalah Rp195.000. Tersedia juga paket multi-sesi yang lebih hemat, misalnya paket 8 sesi. Pembayaran dapat melalui QRIS, transfer bank, atau tunai di kasir, dan kuitansi resmi diterbitkan oleh kasir. Untuk rujukan asuransi atau BPJS, mohon informasikan saat pendaftaran agar petugas menyiapkan berkas.',
    keywords: ['tarif', 'biaya', 'harga', 'paket', 'sesi', 'qris', 'bayar', 'pembayaran', 'kuitansi', 'berapa'],
    regulationReference: 'Standar Tarif Klinik',
    sourceKind: 'SEED_LOKAL',
    confidence: 0.94,
    updatedAt: now(),
  },
  {
    id: 'kb-lokal-004',
    topic: 'Klinik',
    subtopic: 'Persiapan Sesi',
    category: 'PANDUAN_WEB',
    title: 'Apa yang perlu dipersiapkan sebelum sesi terapi pertama?',
    content:
      'Bawa fotokopi Kartu Keluarga dan Akta Kelahiran anak, Kartu Identitas Anak (KIA) atau KTP orang tua, surat rujukan dokter bila ada, hasil audiometri bila pernah dilakukan, serta buku penghubung sekolah bila anak sudah bersekolah. Datang 15 menit lebih awal untuk verifikasi identitas dan pengisian informed consent. Anak sebaiknya cukup tidur dan tidak lapar agar asesmen optimal.',
    keywords: ['persiapan', 'dokumen', 'berkas', 'consent', 'asesmen', 'pertama', 'bawa', 'syarat', 'kia'],
    regulationReference: 'Permenkes No. 81 Tahun 2014',
    sourceKind: 'SEED_LOKAL',
    confidence: 0.95,
    updatedAt: now(),
  },
  {
    id: 'kb-lokal-005',
    topic: 'Klinis',
    subtopic: 'Keterlambatan Bicara',
    category: 'KLINIS',
    title: 'Kapan anak dianggap terlambat bicara (speech delay)?',
    content:
      'Tanda anak perlu dievaluasi: belum mengoceh pada 9 bulan, belum ada kata bermakna pada 16 bulan, belum menggabungkan dua kata pada 24 bulan, kosa kata kurang dari 50 kata pada usia 2 tahun, atau bicara tidak dipahami orang di luar keluarga pada usia 3 tahun. Perhatikan juga kontak mata, kemampuan menunjuk untuk meminta, meniru gerakan, dan respons terhadap nama. Bila ada lebih dari satu tanda, segera lakukan skrining tumbuh kembang.',
    keywords: ['terlambat bicara', 'speech delay', 'keterlambatan', 'milestone', 'tumbuh kembang', 'skrining', 'anak', 'bicara'],
    regulationReference: 'Permenkes No. 81 Tahun 2014',
    sourceKind: 'SEED_LOKAL',
    confidence: 0.97,
    updatedAt: now(),
  },
  {
    id: 'kb-lokal-006',
    topic: 'Klinis',
    subtopic: 'Gagap',
    category: 'KLINIS',
    title: 'Apakah gagap pada anak bisa disembuhkan?',
    content:
      'Gagap pada anak berprognosis baik, terutama bila intervensi dilakukan sebelum usia 6 tahun. Terapi mencakup fluency shaping, modifikasi gagap, dan pelatihan orang tua untuk memperlambat tempo bicara serta tidak memotong pembicaraan anak. Indikator yang dipantau adalah Percent Syllables Stuttered (%SS); nilai di bawah 3 persen dianggap normal. Faktor risiko: riwayat gagap keluarga, berlangsung lebih dari 12 bulan, dan perilaku sekunder seperti menghindar bicara.',
    keywords: ['gagap', 'stuttering', 'kelancaran', 'fluency', 'irama', 'anak', 'ss', 'sembuh'],
    regulationReference: 'Permenkes No. 81 Tahun 2014 Domain Irama/Kelancaran',
    sourceKind: 'SEED_LOKAL',
    confidence: 0.96,
    updatedAt: now(),
  },
  {
    id: 'kb-lokal-007',
    topic: 'Klinis',
    subtopic: 'Disfagia',
    category: 'KLINIS',
    title: 'Apa itu disfagia dan bagaimana penanganannya?',
    content:
      'Disfagia adalah gangguan menelan yang dapat menyebabkan tersedak, aspirasi, atau kekurangan gizi. Penanganan mencakup asesmen menelan, pemantauan saturasi oksigen sebelum dan sesudah menelan, serta penentuan tekstur makanan dan minuman memakai standar IDDSI level 0 sampai 7 (level 0 cairan encer, level 7 makanan biasa). Terapis mengajarkan manuver kompensasi dan latihan oromotor. Bila ada tanda aspirasi, pasien dirujuk ke dokter Sp.KFR atau THT-KL.',
    keywords: ['disfagia', 'menelan', 'iddsi', 'aspirasi', 'tersedak', 'tekstur', 'oromotor'],
    regulationReference: 'Permenkes No. 81 Tahun 2014 Domain Menelan/Disfagia',
    sourceKind: 'SEED_LOKAL',
    confidence: 0.96,
    updatedAt: now(),
  },
  {
    id: 'kb-lokal-008',
    topic: 'Klinis',
    subtopic: 'Suara',
    category: 'KLINIS',
    title: 'Bagaimana penilaian gangguan suara dilakukan?',
    content:
      'Penilaian suara memakai skala GRBAS (Grade, Roughness, Breathiness, Asthenicity, Strain) serta pengukuran Maximum Phonation Time (MPT) dan rasio s/z. MPT normal dewasa sekitar 15 sampai 25 detik. Terapi mencakup higiene suara, latihan pernapasan diafragma, dan teknik resonansi. Hindari berbisik berlebihan dan berteriak.',
    keywords: ['suara', 'grbas', 'mpt', 'serak', 'parau', 'fonasi', 'voice'],
    regulationReference: 'Permenkes No. 81 Tahun 2014 Domain Suara',
    sourceKind: 'SEED_LOKAL',
    confidence: 0.94,
    updatedAt: now(),
  },
  {
    id: 'kb-lokal-009',
    topic: 'Regulasi',
    subtopic: 'Rekam Medis',
    category: 'REGULASI',
    title: 'Apakah rekam medis saya aman dan berapa lama disimpan?',
    content:
      'Rekam medis elektronik disimpan minimal 25 tahun sesuai Permenkes No. 24 Tahun 2022. Catatan SOAP yang ditandatangani elektronik (TTE) terkunci dan tidak dapat diubah; perubahan hanya lewat addendum yang tercatat di jejak audit. Data pribadi dilindungi UU No. 27 Tahun 2022 (UU PDP): akses dibatasi per peran, NIK ditampilkan tersamar, dan setiap akses tercatat dalam log audit yang tidak dapat dihapus.',
    keywords: ['rekam medis', 'aman', 'privasi', 'pdp', 'retensi', 'tte', 'audit', 'nik', '25 tahun'],
    regulationReference: 'Permenkes No. 24 Tahun 2022 & UU No. 27 Tahun 2022',
    sourceKind: 'SEED_LOKAL',
    confidence: 0.98,
    updatedAt: now(),
  },
  {
    id: 'kb-lokal-010',
    topic: 'Regulasi',
    subtopic: 'Hak Pasien',
    category: 'REGULASI',
    title: 'Apa hak saya sebagai pasien atau wali pasien?',
    content:
      'Anda berhak memperoleh informasi lengkap tentang diagnosis, rencana terapi, dan prognosis; memberi atau menolak persetujuan tindakan; meminta salinan resume medis; meminta koreksi data pribadi yang tidak akurat; membatasi atau menarik persetujuan penggunaan data; serta mengajukan pengaduan kepada petugas atau Dinas Kesehatan. Permintaan salinan rekam medis diproses maksimal 14 hari kerja.',
    keywords: ['hak', 'pasien', 'consent', 'informasi', 'salinan', 'resume', 'pengaduan', 'pdp'],
    regulationReference: 'UU No. 17 Tahun 2023 & UU No. 27 Tahun 2022',
    sourceKind: 'SEED_LOKAL',
    confidence: 0.97,
    updatedAt: now(),
  },
  {
    id: 'kb-lokal-011',
    topic: 'Regulasi',
    subtopic: 'SATUSEHAT',
    category: 'REGULASI',
    title: 'Apakah data kunjungan saya terhubung ke SATUSEHAT?',
    content:
      'Ya. Klinik melakukan interoperabilitas dengan platform SATUSEHAT Kementerian Kesehatan memakai standar HL7 FHIR R4. Data yang dikirim meliputi Patient, Practitioner, Location, dan Encounter. Pengiriman memerlukan persetujuan Anda sebagai bagian dari general consent, dan setiap pengiriman tercatat dalam log beserta kode status HTTP-nya.',
    keywords: ['satusehat', 'fhir', 'interoperabilitas', 'kemenkes', 'encounter', 'hl7'],
    regulationReference: 'Permenkes No. 24 Tahun 2022',
    sourceKind: 'SEED_LOKAL',
    confidence: 0.95,
    updatedAt: now(),
  },
  {
    id: 'kb-lokal-012',
    topic: 'Layanan',
    subtopic: 'Program Rumah',
    category: 'LAYANAN',
    title: 'Apakah ada latihan yang bisa dilakukan di rumah?',
    content:
      'Setiap sesi menghasilkan Home Exercise Program (HEP) sesuai target terapi. Latihan singkat 10 sampai 15 menit, dilakukan 2 sampai 3 kali sehari secara konsisten. Orang tua berperan sebagai co-terapis: memberi contoh, menunggu giliran bicara, dan memberi pujian. Melalui Portal Pasien Anda dapat masuk memakai Nomor Rekam Medis dan tanggal lahir untuk melihat program latihan rumah dan riwayat sesi.',
    keywords: ['latihan', 'rumah', 'hep', 'program', 'orang tua', 'mandiri', 'portal', 'pr'],
    regulationReference: 'Permenkes No. 81 Tahun 2014',
    sourceKind: 'SEED_LOKAL',
    confidence: 0.95,
    updatedAt: now(),
  },
  {
    id: 'kb-lokal-013',
    topic: 'Panduan Web',
    subtopic: 'Portal Pasien',
    category: 'PANDUAN_WEB',
    title: 'Bagaimana cara masuk ke Portal Pasien?',
    content:
      'Buka halaman Portal Pasien, masukkan Nomor Rekam Medis (contoh RM-TW-2026-0041) dan tanggal lahir pasien dengan format YYYY-MM-DD. Sistem menampilkan ringkasan terapi, program latihan rumah, dan jadwal sesi berikutnya. Bila lupa nomor rekam medis, hubungi petugas admisi dengan menyebutkan nama lengkap dan tanggal lahir pasien. Demi UU PDP, portal tidak menampilkan NIK lengkap.',
    keywords: ['portal pasien', 'login', 'masuk', 'nomor rekam medis', 'tanggal lahir', 'lupa', 'akun'],
    regulationReference: 'UU No. 27 Tahun 2022',
    sourceKind: 'SEED_LOKAL',
    confidence: 0.96,
    updatedAt: now(),
  },
  {
    id: 'kb-lokal-014',
    topic: 'FAQ',
    subtopic: 'Asuransi',
    category: 'FAQ',
    title: 'Apakah terapi wicara ditanggung asuransi atau BPJS?',
    content:
      'Cakupan bergantung pada jenis kepesertaan dan indikasi medis. Untuk BPJS Kesehatan, layanan dapat ditanggung bila pasien memiliki rujukan dari fasilitas kesehatan tingkat pertama dan diagnosis ditegakkan dokter. Untuk asuransi swasta diperlukan surat rujukan dokter dan kadang surat jaminan (guarantee letter). Klinik membantu menyiapkan berkas administratif, namun keputusan penjaminan berada pada pihak penjamin.',
    keywords: ['asuransi', 'bpjs', 'tanggungan', 'jaminan', 'rujukan', 'klaim', 'gratis'],
    regulationReference: 'UU No. 17 Tahun 2023 & Ketentuan JKN',
    sourceKind: 'SEED_LOKAL',
    confidence: 0.92,
    updatedAt: now(),
  },
  {
    id: 'kb-lokal-015',
    topic: 'FAQ',
    subtopic: 'Lokasi dan Jam',
    category: 'FAQ',
    title: 'Di mana lokasi klinik dan bagaimana jam operasionalnya?',
    content:
      'Klinik berlokasi di Jl. Jaksa Agung Suprapto No. 24, Mojoroto, Kota Kediri, Jawa Timur, dan dapat dihubungi di (0354) 689420. Pendaftaran dilayani pada hari kerja dan Sabtu pagi. Sesi terapi dijadwalkan berdasarkan ketersediaan ruang kedap suara dan terapis. Untuk kunjungan pertama, disarankan membuat janji melalui Booking Online agar tidak menunggu antrean.',
    keywords: ['lokasi', 'alamat', 'kediri', 'jam', 'operasional', 'kontak', 'telepon', 'dimana', 'buka'],
    regulationReference: 'Informasi Klinik',
    sourceKind: 'SEED_LOKAL',
    confidence: 0.96,
    updatedAt: now(),
  },
  {
    id: 'kb-lokal-016',
    topic: 'Teknis',
    subtopic: 'Sistem Multi-Agen AI',
    category: 'TEKNIS',
    title: 'Apa itu sistem multi-agen AI di WicaraSehat?',
    content:
      'WicaraSehat menjalankan tujuh agen AI otonom yang bekerja bergiliran: Agen Supervisor (orkestrasi), Agen Regenerasi Pengetahuan (kurasi basis pengetahuan), Agen Keamanan (audit RLS dan pelindungan data), Agen Penguji (uji sistem berkala), Agen Perbaikan Bug (deteksi dan pemulihan anomali), Agen Analisis (mutu dan kinerja), serta Agen Riset (pembelajaran online dari sumber resmi). Setiap tindakan agen tercatat dan dapat diaudit pada halaman Pusat Komando AI.',
    keywords: ['agen', 'ai', 'multi agen', 'otomatis', 'keamanan', 'penguji', 'riset', 'komando'],
    regulationReference: 'Tata Kelola Sistem Informasi Klinik',
    sourceKind: 'SEED_LOKAL',
    confidence: 0.93,
    updatedAt: now(),
  },
  {
    id: 'kb-lokal-017',
    topic: 'FAQ',
    subtopic: 'Dewasa',
    category: 'FAQ',
    title: 'Apakah klinik melayani pasien dewasa dan lanjut usia?',
    content:
      'Ya. Selain anak, klinik melayani dewasa dan lanjut usia dengan kasus pascastroke (afasia dan disartria), gangguan suara akibat pemakaian berlebih seperti pada guru dan penyanyi, disfagia neurogenik, serta pasien pascabedah laring. Untuk pasien pascastroke, terapi dilakukan secara interprofesional bersama dokter Sp.KFR, okupasi terapis, dan fisioterapis.',
    keywords: ['dewasa', 'lansia', 'stroke', 'afasia', 'disartria', 'pascastroke', 'lanjut usia'],
    regulationReference: 'Permenkes No. 81 Tahun 2014',
    sourceKind: 'SEED_LOKAL',
    confidence: 0.93,
    updatedAt: now(),
  },
];

/* -------------------------------------------------------------------------- */
/* Retrieval lokal (TF sederhana + pencocokan kata kunci)                      */
/* -------------------------------------------------------------------------- */

const STOPWORDS = new Set([
  'yang', 'untuk', 'dengan', 'dari', 'pada', 'adalah', 'apakah', 'bagaimana', 'berapa',
  'bisa', 'dapat', 'saya', 'anda', 'kita', 'kami', 'ini', 'itu', 'ada', 'tidak', 'dan',
  'atau', 'juga', 'akan', 'sudah', 'belum', 'kalau', 'jika', 'apa', 'kapan', 'dimana',
  'mana', 'kenapa', 'mengapa', 'siapa', 'cara', 'nya', 'sih', 'dong', 'ya', 'kah',
  'mau', 'ingin', 'perlu', 'harus', 'tolong', 'mohon', 'terima', 'kasih', 'halo', 'hai',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 3 && !STOPWORDS.has(t));
}

export interface ScoredEntry {
  entry: KnowledgeEntry;
  score: number;
}

export function searchKnowledge(
  query: string,
  corpus: KnowledgeEntry[],
  limit = 4
): ScoredEntry[] {
  const terms = tokenize(query);
  if (!terms.length) return [];

  const scored: ScoredEntry[] = [];
  for (const entry of corpus) {
    const haystack = `${entry.title} ${entry.content} ${entry.regulationReference ?? ''} ${entry.keywords.join(' ')}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (entry.keywords.some((k) => k.toLowerCase().includes(term))) score += 3;
      if (entry.title.toLowerCase().includes(term)) score += 2;
      if (haystack.includes(term)) score += 1;
    }
    // Sinonim domain
    const lowerQuery = query.toLowerCase();
    for (const kw of entry.keywords) {
      const k = kw.toLowerCase();
      if (k.length > 4 && lowerQuery.includes(k)) score += 2;
    }
    if (score > 0) scored.push({ entry, score });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
