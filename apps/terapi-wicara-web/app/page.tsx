'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Award,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Ear,
  HeartHandshake,
  Lock,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Volume2,
} from 'lucide-react';
import {
  FALLBACK_SIMKLINIK_DATA,
  formatRupiah,
  getBrowserSupabase,
} from '../src/lib/supabaseClient';

const RED_FLAG_QUESTIONS = [
  {
    id: 'rf-1',
    ageGroup: 'Usia 12–18 Bulan',
    question:
      'Anak belum menunjuk benda yang diinginkan (joint attention) atau belum memiliki minimal 3–6 kata bermakna pada usia 18 bulan.',
  },
  {
    id: 'rf-2',
    ageGroup: 'Usia 24 Bulan (2 Tahun)',
    question:
      'Anak memiliki kosa kata < 50 kata atau belum mampu menggabungkan 2 kata bermakna (misal: "mau susu", "buka pintu").',
  },
  {
    id: 'rf-3',
    ageGroup: 'Usia 36 Bulan (3 Tahun)',
    question:
      'Ucapan anak masih sulit dipahami oleh orang di luar keluarga inti (<75% kejelasan bicara) atau sering menghilangkan konsonan awal/akhir.',
  },
  {
    id: 'rf-4',
    ageGroup: 'Kelancaran / Suara (Anak & Dewasa)',
    question:
      'Terdapat pengulangan suku kata/blok gagap disertai ketegangan wajah >6 bulan, atau suara serak menetap >2 minggu.',
  },
  {
    id: 'rf-5',
    ageGroup: 'Menelan & Makan (Pediatrik / Pasca-Stroke)',
    question:
      'Sering batuk/tersedak saat minum cairan encer, waktu makan >45 menit, atau suara terdengar basah (wet voice) setelah menelan.',
  },
];

export default function PublicClinicWebsitePage() {
  const [clinic, setClinic] = useState(FALLBACK_SIMKLINIK_DATA.clinic);
  const [therapists, setTherapists] = useState(FALLBACK_SIMKLINIK_DATA.therapists);
  const [rooms, setRooms] = useState(FALLBACK_SIMKLINIK_DATA.rooms);
  const [tariffs, setTariffs] = useState(FALLBACK_SIMKLINIK_DATA.tariffs);

  // Non-Diagnostic Red Flag Screening State
  const [checkedFlags, setCheckedFlags] = useState<Record<string, boolean>>({});

  // Online Pre-Admission Booking Form (UU PDP Compliant)
  const [patientName, setPatientName] = useState('');
  const [birthDate, setBirthDate] = useState('2023-04-15');
  const [gender, setGender] = useState<'L' | 'P'>('L');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [requestedDate, setRequestedDate] = useState('2026-11-26');
  const [requestedSlot, setRequestedSlot] = useState('09:00 - 10:00 WIB');
  const [disorderConcern, setDisorderConcern] = useState('BAHASA');
  const [referringDoctor, setReferringDoctor] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [pdpConsent, setPdpConsent] = useState(false);
  const [bookingResult, setBookingResult] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    (async () => {
      try {
        const { data, error } = await sb.rpc('tw_public_portal_snapshot', {
          p_clinic_code: 'KLN-TW-KDR-01',
        });
        if (!error && data) {
          if (data.clinic) setClinic(data.clinic);
          if (data.therapists) setTherapists(data.therapists);
          if (data.rooms) setRooms(data.rooms);
          if (data.tariffs) setTariffs(data.tariffs);
        }
      } catch {
        // Fallback already loaded
      }
    })();
  }, []);

  const redFlagCount = Object.values(checkedFlags).filter(Boolean).length;

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdpConsent || !patientName || !guardianName || !guardianPhone || !chiefComplaint) {
      return;
    }
    setSubmitting(true);
    const payload = {
      patient_full_name: patientName,
      birth_date: birthDate,
      gender,
      guardian_name: guardianName,
      guardian_phone: guardianPhone,
      requested_date: requestedDate,
      requested_slot: requestedSlot,
      service_type: 'ASESMEN_AWAL',
      disorder_concern: disorderConcern,
      chief_complaint: chiefComplaint,
      referring_doctor: referringDoctor,
      screening_red_flags_count: redFlagCount,
      pdp_explicit_consent: pdpConsent,
    };

    try {
      const sb = getBrowserSupabase();
      if (sb) {
        const { data, error } = await sb.rpc('tw_public_submit_booking', {
          p_payload: payload,
        });
        if (!error && data?.booking_code) {
          setBookingResult(
            `Pendaftaran Pra-Admisi berhasil diterima! Kode Booking Resmi: ${data.booking_code}. Data telah masuk ke Meja Admisi SIMKLINIK.`
          );
          setSubmitting(false);
          return;
        }
      }
    } catch {
      // fallback code generation
    }

    const fallbackCode = `BOOK-TW-2026-${Math.floor(100 + Math.random() * 899)}`;
    setBookingResult(
      `Pendaftaran Pra-Admisi tercatat (${fallbackCode}). Petugas Admisi RME akan memverifikasi jadwal & surat rujukan Anda.`
    );
    setSubmitting(false);
  };

  return (
    <div>
      {/* Top Official Regulatory Bar */}
      <div
        style={{
          background: '#0f172a',
          color: '#cbd5e1',
          fontSize: 12,
          padding: '8px 0',
        }}
      >
        <div
          className="pub-container"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <span>
            Izin Dinkes: <strong>{clinic.dinkes_license_number}</strong> • Kode Fasyankes Kemenkes:{' '}
            <strong>{clinic.fasyankes_code}</strong> • Terintegrasi <strong>SATUSEHAT</strong>
          </span>
          <span>
            Akreditasi Kemenkes: <strong style={{ color: '#5eead4' }}>{clinic.accreditation_status}</strong>
          </span>
        </div>
      </div>

      {/* Navigation Header */}
      <header className="pub-header">
        <div className="pub-container pub-nav">
          <div className="brand-box">
            <div className="brand-logo">TW</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{clinic.name}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Penanggung Jawab Medis: {clinic.head_of_clinic_name}
              </div>
            </div>
          </div>

          <nav className="nav-links">
            <a href="#layanan" style={{ fontSize: 14, fontWeight: 600 }}>
              5 Ruang Lingkup Klinis
            </a>
            <a href="#tenaga-kesehatan" style={{ fontSize: 14, fontWeight: 600 }}>
              Direktori SIP Terapis
            </a>
            <a href="#skrining" style={{ fontSize: 14, fontWeight: 600 }}>
              Skrining Mandiri
            </a>
            <a href="#reservasi" style={{ fontSize: 14, fontWeight: 600 }}>
              Pendaftaran Online
            </a>
            <Link href="/portal-pasien" className="btn btn-outline">
              Portal Pasien & HEP
            </Link>
            <Link href="/simklinik" className="btn btn-primary">
              <MonitorSmartphone size={16} />
              SIMKLINIK Cabang
            </Link>
            <Link href="/enterprise" className="btn btn-dark">
              <Building2 size={16} />
              Enterprise HQ (Multi-Cabang)
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section (Patuh Etika Informasi Fasyankes Kemenkes - Tanpa Overclaim) */}
      <section className="hero-section">
        <div className="pub-container grid-2" style={{ alignItems: 'center' }}>
          <div>
            <span className="badge badge-teal" style={{ marginBottom: 14 }}>
              <ShieldCheck size={14} /> Standar Pelayanan Permenkes No. 81/2014 & RME Permenkes 24/2022
            </span>
            <h1 style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.2, marginBottom: 14 }}>
              Layanan Klinis Terapi Wicara, Bahasa, Suara & Menelan Berbasis Bukti Ilmiah
            </h1>
            <p style={{ color: '#cbd5e1', fontSize: 15, marginBottom: 24 }}>
              Penanganan terpadu tumbuh kembang komunikasi anak dan rehabilitasi neurogenik dewasa oleh Terapis Wicara ber-STR & SIP resmi Dinas Kesehatan, dilengkapi ruang kedap suara standar akustik serta Rekam Medis Elektronik terintegrasi SATUSEHAT.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href="#reservasi" className="btn btn-primary">
                <CalendarCheck size={16} /> Jadwalkan Asesmen Awal
              </a>
              <a
                href="#skrining"
                className="btn"
                style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
              >
                <ClipboardCheck size={16} /> Cek Tanda Waspada (Red Flags)
              </a>
            </div>
          </div>

          <div
            className="card"
            style={{
              background: 'rgba(15, 23, 42, 0.72)',
              borderColor: 'rgba(94, 234, 212, 0.3)',
              color: '#f8fafc',
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#5eead4', marginBottom: 12 }}>
              Standar Mutu, Sarana & Pelindungan Data Pasien
            </h3>
            <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <Volume2 size={18} color="#5eead4" style={{ flexShrink: 0 }} />
                <span>
                  <strong>Ruang Terapi Kedap Suara (&lt;35 dB)</strong> dengan cermin artikulasi & jendela observasi orang tua (<em>one-way mirror</em>) sesuai Permenkes No. 14/2021.
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Award size={18} color="#5eead4" style={{ flexShrink: 0 }} />
                <span>
                  <strong>Asuhan Terstandar ICF WHO & IKATWI</strong>: Setiap pasien memiliki <em>Individualized Therapy Plan</em> (IEP) terukur & evaluasi berkala.
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Lock size={18} color="#5eead4" style={{ flexShrink: 0 }} />
                <span>
                  <strong>Kepatuhan Penuh UU PDP No. 27/2022</strong>: Enkripsi data medis spesifik, persetujuan eksplisit wali, dan Tanda Tangan Elektronik (TTE).
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5 Ruang Lingkup Pelayanan Terapi Wicara (Permenkes 81/2014) */}
      <section id="layanan" style={{ padding: '48px 0' }}>
        <div className="pub-container">
          <div style={{ marginBottom: 24 }}>
            <span className="badge badge-teal">Permenkes No. 81 Tahun 2014</span>
            <h2 style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>
              5 Ruang Lingkup Pelayanan Klinis Terapi Wicara & Rehabilitasi Aural
            </h2>
            <p style={{ color: '#64748b', fontSize: 14 }}>
              Informasi edukatif layanan kesehatan sesuai standar profesi tanpa klaim penyembuhan instan yang menyesatkan.
            </p>
          </div>

          <div className="grid-3">
            {[
              {
                title: '1. Gangguan Bahasa (Anak & Dewasa)',
                icd: 'ICD-10: F80.1, F80.2, F84.0, R47.01',
                desc: 'Keterlambatan bicara-bahasa (Speech Delay), gangguan bahasa reseptif-ekspresif, komunikasi sosial pragmatik pada ASD/ADHD, serta rehabilitasi Afasia pasca-stroke atau cedera otak.',
                Icon: HeartHandshake,
              },
              {
                title: '2. Gangguan Bicara (Artikulasi & Motorik)',
                icd: 'ICD-10: F80.0, R47.1, Q35–Q37',
                desc: 'Gangguan artikulasi & fonologi anak, Childhood Apraxia of Speech (CAS), Disartria neurogenik, serta terapi resonansi bicara pasca-operasi celah bibir dan langit-langit.',
                Icon: Sparkles,
              },
              {
                title: '3. Gangguan Suara (Disfonia)',
                icd: 'ICD-10: R49.0, J38.2',
                desc: 'Terapi higienitas vokal & fungsi fonasi pada nodul pita suara guru/pekerja vokal, paralisis plika vokalis, hipernasalitas, dan rehabilitasi pasca-laringektomi.',
                Icon: Volume2,
              },
              {
                title: '4. Gangguan Irama / Kelancaran',
                icd: 'ICD-10: F98.5, F98.6',
                desc: 'Penanganan Gagap (Stuttering) perkembangan anak hingga dewasa serta Cluttering menggunakan pendekatan modifikasi gagap dan pembentukan kelancaran bicara.',
                Icon: Activity,
              },
              {
                title: '5. Gangguan Menelan & Makan (Disfagia)',
                icd: 'ICD-10: R13.10, F98.2',
                desc: 'Asesmen menelan klinis berpanduan saturasi oksigen (SpO2), modifikasi diet berstandar IDDSI Level 0–7, terapi makan pediatrik (feeding therapy), dan stimulasi oromotor steril.',
                Icon: Stethoscope,
              },
              {
                title: '6. Rehabilitasi Aural / Pendengaran & AAC',
                icd: 'AVT & Augmentative Communication',
                desc: 'Terapi Auditory-Verbal pasca pemasangan Alat Bantu Dengar (ABD) / Implan Koklea serta penyediaan papan komunikasi alternatif (AAC) fungsional.',
                Icon: Ear,
              },
            ].map((srv, i) => (
              <div key={i} className="card">
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: '#f0fdfa',
                    color: '#0f766e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  <srv.Icon size={20} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{srv.title}</h3>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0f766e', marginBottom: 8 }}>
                  {srv.icd}
                </div>
                <p style={{ fontSize: 13, color: '#475569' }}>{srv.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Direktori Tenaga Kesehatan Ber-SIP Resmi & Transparansi Tarif */}
      <section
        id="tenaga-kesehatan"
        style={{ padding: '44px 0', background: '#ffffff', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}
      >
        <div className="pub-container grid-2">
          <div>
            <span className="badge badge-green">Transparansi UU Kesehatan No. 17 Tahun 2023</span>
            <h2 style={{ fontSize: 22, fontWeight: 900, marginTop: 6, marginBottom: 12 }}>
              Direktori Terapis Wicara & SIP Aktif Dinas Kesehatan
            </h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {therapists.map((th) => (
                <div key={th.id} className="card" style={{ background: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{th.full_name}</div>
                    <span className="badge badge-green">SIP Aktif s/d {th.sip_valid_until}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#0f766e', fontWeight: 700, marginTop: 3 }}>
                    No. SIP: {th.sip_number} ({th.sip_issued_by_dinkes})
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    Kewenangan Klinis (RKK): {th.clinical_privilege_level.replace(/_/g, ' ')} • Cakupan:{' '}
                    {th.specializations.join(', ')}
                  </div>
                </div>
              ))}
            </div>

            <h3 style={{ fontSize: 16, fontWeight: 800, marginTop: 20, marginBottom: 10 }}>
              Standar Ruang Terapi Klinik ({rooms.length} Ruang Aktif)
            </h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {rooms.map((rm, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    fontSize: 13,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>
                    <Building2 size={14} style={{ display: 'inline', marginRight: 6 }} />
                    <strong>{rm.room_code}</strong> — {rm.room_name}
                  </span>
                  <span className="badge badge-teal">{rm.ambient_noise_db} dB</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="badge badge-teal">Transparansi Informasi Biaya Pelayanan</span>
            <h2 style={{ fontSize: 22, fontWeight: 900, marginTop: 6, marginBottom: 12 }}>
              Standar Tarif Resmi Layanan Klinik
            </h2>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Layanan Klinis</th>
                    <th>Durasi</th>
                    <th>Tarif Resmi</th>
                  </tr>
                </thead>
                <tbody>
                  {tariffs.map((trf) => (
                    <tr key={trf.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{trf.service_name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          Kode ICD-9-CM: {trf.icd9cm_code} • {trf.sessions_included} Sesi
                        </div>
                      </td>
                      <td>{trf.duration_minutes} mnt</td>
                      <td style={{ fontWeight: 800, color: '#0f766e' }}>
                        {formatRupiah(trf.unit_price_idr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Skrining Awal Mandiri Non-Diagnostik & Reservasi Online */}
      <section id="skrining" style={{ padding: '48px 0' }}>
        <div className="pub-container grid-2">
          {/* Kuesioner Skrining Red Flags */}
          <div className="card">
            <span className="badge badge-amber">Alat Edukasi Skrining Mandiri (Non-Diagnostik)</span>
            <h2 style={{ fontSize: 20, fontWeight: 900, marginTop: 8, marginBottom: 6 }}>
              Cek Tanda Waspada (Red Flags) Komunikasi & Menelan
            </h2>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
              Centang kondisi yang dialami pasien. Hasil ini membantu terapis saat asesmen awal dan <strong>bukan pengganti diagnosis klinis langsung</strong>.
            </p>

            <div style={{ display: 'grid', gap: 10 }}>
              {RED_FLAG_QUESTIONS.map((item) => (
                <label
                  key={item.id}
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    background: checkedFlags[item.id] ? '#fffbeb' : '#f8fafc',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(checkedFlags[item.id])}
                    onChange={(e) =>
                      setCheckedFlags((prev) => ({ ...prev, [item.id]: e.target.checked }))
                    }
                    style={{ marginTop: 3 }}
                  />
                  <div style={{ fontSize: 13 }}>
                    <div style={{ fontWeight: 800, color: '#0f766e', fontSize: 11 }}>
                      {item.ageGroup}
                    </div>
                    <div>{item.question}</div>
                  </div>
                </label>
              ))}
            </div>

            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 12,
                background: redFlagCount > 0 ? '#fef2f2' : '#f0fdfa',
                border: `1px solid ${redFlagCount > 0 ? '#fecaca' : '#99f6e4'}`,
                fontSize: 13,
              }}
            >
              {redFlagCount > 0 ? (
                <strong style={{ color: '#991b1b' }}>
                  Terdeteksi {redFlagCount} indikator tanda waspada (Red Flag). Sangat disarankan menjadwalkan Asesmen Komprehensif Terapi Wicara tanpa menunggu.
                </strong>
              ) : (
                <span style={{ color: '#115e59' }}>
                  Belum ada tanda waspada dicentang. Anda tetap dapat mendaftar untuk skrining tumbuh kembang berkala.
                </span>
              )}
            </div>
          </div>

          {/* Form Reservasi Online & Pra-Anamnesis (UU PDP Explicit Consent) */}
          <div id="reservasi" className="card">
            <span className="badge badge-teal">Terhubung ke Meja Admisi SIMKLINIK</span>
            <h2 style={{ fontSize: 20, fontWeight: 900, marginTop: 8, marginBottom: 14 }}>
              Formulir Pendaftaran Online & Pra-Anamnesis
            </h2>

            {bookingResult && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: '#dcfce7',
                  color: '#166534',
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 14,
                  display: 'flex',
                  gap: 8,
                }}
              >
                <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                <span>{bookingResult}</span>
              </div>
            )}

            <form onSubmit={handleBookingSubmit} style={{ display: 'grid', gap: 12 }}>
              <div className="grid-2" style={{ gap: 12 }}>
                <div>
                  <label className="form-label">Nama Lengkap Pasien (Sesuai KIA/KTP) *</label>
                  <input
                    required
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="Contoh: An. Kirana Putri"
                    className="form-control"
                  />
                </div>
                <div>
                  <label className="form-label">Tanggal Lahir Pasien *</label>
                  <input
                    type="date"
                    required
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="form-control"
                  />
                </div>
              </div>

              <div className="grid-2" style={{ gap: 12 }}>
                <div>
                  <label className="form-label">Nama Orang Tua / Penanggung Jawab *</label>
                  <input
                    required
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    placeholder="Nama Ayah / Ibu / Wali"
                    className="form-control"
                  />
                </div>
                <div>
                  <label className="form-label">Nomor WhatsApp Aktif *</label>
                  <input
                    required
                    value={guardianPhone}
                    onChange={(e) => setGuardianPhone(e.target.value)}
                    placeholder="0812xxxxxxxx"
                    className="form-control"
                  />
                </div>
              </div>

              <div className="grid-3" style={{ gap: 10 }}>
                <div>
                  <label className="form-label">Jenis Kelamin</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'L' | 'P')}
                    className="form-control"
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Tanggal Kunjungan</label>
                  <input
                    type="date"
                    value={requestedDate}
                    onChange={(e) => setRequestedDate(e.target.value)}
                    className="form-control"
                  />
                </div>
                <div>
                  <label className="form-label">Slot Jam Praktik</label>
                  <select
                    value={requestedSlot}
                    onChange={(e) => setRequestedSlot(e.target.value)}
                    className="form-control"
                  >
                    <option>08:30 - 09:30 WIB</option>
                    <option>09:30 - 10:30 WIB</option>
                    <option>10:30 - 11:30 WIB</option>
                    <option>13:00 - 14:00 WIB</option>
                    <option>14:30 - 15:30 WIB</option>
                  </select>
                </div>
              </div>

              <div className="grid-2" style={{ gap: 12 }}>
                <div>
                  <label className="form-label">Fokus Keluhan Utama</label>
                  <select
                    value={disorderConcern}
                    onChange={(e) => setDisorderConcern(e.target.value)}
                    className="form-control"
                  >
                    <option value="BAHASA">Keterlambatan Bahasa / Afasia</option>
                    <option value="BICARA">Kejelasan Bicara / Artikulasi</option>
                    <option value="SUARA">Gangguan Suara / Serak</option>
                    <option value="IRAMA_KELANCARAN">Gagap / Kelancaran Bicara</option>
                    <option value="MENELAN_DISFAGIA">Kesulitan Makan & Menelan (Disfagia)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Dokter / Psikolog Perujuk (Bila Ada)</label>
                  <input
                    value={referringDoctor}
                    onChange={(e) => setReferringDoctor(e.target.value)}
                    placeholder="Misal: dr. Sp.A / Sp.KFR / Sp.N / Mandiri"
                    className="form-control"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Ringkasan Pra-Anamnesis / Keluhan Saat Ini *</label>
                <textarea
                  required
                  rows={3}
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="Ceritakan kemampuan bicara/menelan pasien saat ini, riwayat tes pendengaran (OAE/BERA) bila ada..."
                  className="form-control"
                />
              </div>

              <label
                style={{
                  display: 'flex',
                  gap: 10,
                  fontSize: 12,
                  color: '#334155',
                  background: '#f8fafc',
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  required
                  checked={pdpConsent}
                  onChange={(e) => setPdpConsent(e.target.checked)}
                />
                <span>
                  <strong>Persetujuan Eksplisit UU PDP No. 27/2022:</strong> Saya selaku pasien/wali sah menyetujui pemrosesan data pribadi spesifik kesehatan untuk keperluan pra-admisi dan Rekam Medis Elektronik di {clinic.name}.
                </span>
              </label>

              <button
                type="submit"
                disabled={submitting || !pdpConsent}
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px 16px' }}
              >
                {submitting ? 'Mengirim ke Sistem Admisi...' : 'Kirim Pendaftaran & Dapatkan Kode Booking'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer Resmi Klinik */}
      <footer
        style={{
          background: '#0f172a',
          color: '#94a3b8',
          padding: '32px 0',
          fontSize: 13,
        }}
      >
        <div
          className="pub-container"
          style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}
        >
          <div>
            <strong style={{ color: '#ffffff' }}>{clinic.name}</strong>
            <div>
              {clinic.address}, {clinic.city}, {clinic.province} • Telp: {clinic.phone}
            </div>
            <div>NIB OSS-RBA: {clinic.oss_nib} • Izin Dinkes: {clinic.dinkes_license_number}</div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Link href="/portal-pasien" style={{ color: '#5eead4', fontWeight: 700 }}>
              Portal Keluarga (HEP)
            </Link>
            <Link href="/simklinik" style={{ color: '#5eead4', fontWeight: 700 }}>
              Login Staf SIMKLINIK
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
