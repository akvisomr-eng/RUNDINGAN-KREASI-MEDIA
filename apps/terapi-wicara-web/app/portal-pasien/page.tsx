'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpenCheck,
  Calendar,
  CheckCircle2,
  FileCheck2,
  Printer,
  Receipt,
  ShieldCheck,
} from 'lucide-react';
import {
  FALLBACK_SIMKLINIK_DATA,
  formatRupiah,
  getBrowserSupabase,
} from '../../src/lib/supabaseClient';

export default function PatientCaregiverPortalPage() {
  const [mrnInput, setMrnInput] = useState('RM-TW-2026-0041');
  const [dobInput, setDobInput] = useState('2022-05-14');
  const [verified, setVerified] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hepCompletedToday, setHepCompletedToday] = useState(true);

  const [portalData, setPortalData] = useState({
    patient: FALLBACK_SIMKLINIK_DATA.patients[0],
    care_plans: FALLBACK_SIMKLINIK_DATA.care_plans,
    hep_list: FALLBACK_SIMKLINIK_DATA.soap_sessions,
    packages: FALLBACK_SIMKLINIK_DATA.packages.filter(
      (p) => p.medical_record_number === 'RM-TW-2026-0041'
    ),
    invoices: FALLBACK_SIMKLINIK_DATA.invoices.filter(
      (i) => i.medical_record_number === 'RM-TW-2026-0041'
    ),
  });

  const handleVerifyLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const sb = getBrowserSupabase();
    if (sb) {
      try {
        const { data, error } = await sb.rpc('tw_patient_portal_lookup', {
          p_mrn: mrnInput,
          p_birth_date: dobInput,
        });
        if (!error && data) {
          setPortalData(data);
          setVerified(true);
          return;
        }
        if (error) {
          setErrorMsg(error.message);
          return;
        }
      } catch {
        // fallback lookup below
      }
    }

    const found = FALLBACK_SIMKLINIK_DATA.patients.find(
      (p) =>
        p.medical_record_number.toUpperCase() === mrnInput.trim().toUpperCase() &&
        p.birth_date === dobInput
    );
    if (!found) {
      setErrorMsg(
        'Kombinasi Nomor Rekam Medis & Tanggal Lahir tidak ditemukan (Standar Verifikasi 2 Identitas Permenkes No. 24/2022).'
      );
      return;
    }

    setPortalData({
      patient: found,
      care_plans: FALLBACK_SIMKLINIK_DATA.care_plans.filter(
        (c) => c.patient_id === found.id
      ),
      hep_list: FALLBACK_SIMKLINIK_DATA.soap_sessions.filter(
        (s) => s.patient_id === found.id
      ),
      packages: FALLBACK_SIMKLINIK_DATA.packages.filter(
        (pk) => pk.medical_record_number === found.medical_record_number
      ),
      invoices: FALLBACK_SIMKLINIK_DATA.invoices.filter(
        (iv) => iv.medical_record_number === found.medical_record_number
      ),
    });
    setVerified(true);
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 48 }}>
      <header className="pub-header no-print">
        <div className="pub-container pub-nav">
          <div className="brand-box">
            <Link href="/" className="btn btn-outline">
              <ArrowLeft size={16} /> Beranda Klinik
            </Link>
            <div>
              <div style={{ fontWeight: 800 }}>Portal Pasien & Keluarga (HEP Digital)</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Verifikasi 2 Identitas Pasien • Terhubung Langsung dengan Aplikasi Android Terapis Wicara
              </div>
            </div>
          </div>

          <button onClick={() => window.print()} className="btn btn-primary">
            <Printer size={16} /> Cetak Resume Terapi / Surat Sekolah
          </button>
        </div>
      </header>

      <div className="pub-container" style={{ marginTop: 24, display: 'grid', gap: 20 }}>
        {/* 2-Identifier Verification Form */}
        <form onSubmit={handleVerifyLookup} className="card no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <ShieldCheck size={18} color="#0f766e" />
            <strong style={{ fontSize: 14 }}>
              Akses Aman Rekam Ringkas Keluarga (Verifikasi 2 Parameter Permenkes 24/2022)
            </strong>
          </div>
          <div className="grid-3" style={{ alignItems: 'end' }}>
            <div>
              <label className="form-label">Nomor Rekam Medis (No. RM)</label>
              <input
                value={mrnInput}
                onChange={(e) => setMrnInput(e.target.value)}
                className="form-control"
                placeholder="RM-TW-2026-0041"
              />
            </div>
            <div>
              <label className="form-label">Tanggal Lahir Pasien</label>
              <input
                type="date"
                value={dobInput}
                onChange={(e) => setDobInput(e.target.value)}
                className="form-control"
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Buka Data Program Terapi
            </button>
          </div>
          {errorMsg && (
            <div style={{ color: '#dc2626', fontSize: 12, fontWeight: 700, marginTop: 8 }}>
              {errorMsg}
            </div>
          )}
        </form>

        {verified && portalData.patient && (
          <>
            {/* Patient Header & Active IEP Progress */}
            <div className="grid-2">
              <div className="card">
                <span className="badge badge-teal">{portalData.patient.medical_record_number}</span>
                <h1 style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>
                  {portalData.patient.full_name}
                </h1>
                <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                  Tanggal Lahir: {portalData.patient.birth_date} • Wali: {portalData.patient.guardian_name}
                </p>
                <p style={{ fontSize: 13, color: '#334155', marginTop: 8 }}>
                  <strong>Rujukan Klinis:</strong> {portalData.patient.referring_doctor} (
                  {portalData.patient.referring_diagnosis_name})
                </p>
              </div>

              {portalData.care_plans.map((cp, idx) => (
                <div key={idx} className="card" style={{ background: '#f0fdfa', borderColor: '#99f6e4' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="badge badge-green">Program Terapi (IEP) {cp.status}</span>
                    <strong style={{ fontSize: 13, color: '#0f766e' }}>
                      Sesi Terlaksana: {cp.completed_sessions} / {cp.planned_sessions}
                    </strong>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, marginTop: 8 }}>
                    {cp.tw_diagnosis_name}
                  </h3>
                  <p style={{ fontSize: 13, color: '#115e59', marginTop: 4 }}>
                    <strong>Tujuan Jangka Panjang:</strong> {cp.long_term_goal}
                  </p>
                  <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                    {cp.short_term_goals?.map((stg) => (
                      <div key={stg.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span>{stg.target}</span>
                          <strong>{stg.progress}%</strong>
                        </div>
                        <div
                          style={{
                            height: 7,
                            background: '#ccfbf1',
                            borderRadius: 999,
                            marginTop: 4,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${stg.progress}%`,
                              height: '100%',
                              background: '#0f766e',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Home Exercise Program (HEP) Sent from Therapist's Android App */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BookOpenCheck size={20} color="#0f766e" />
                  <h2 style={{ fontSize: 18, fontWeight: 800 }}>
                    Program Latihan Rumah (Home Exercise Program / HEP) dari Terapis Wicara
                  </h2>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#0f766e' }}>
                  <input
                    type="checkbox"
                    checked={hepCompletedToday}
                    onChange={(e) => setHepCompletedToday(e.target.checked)}
                  />
                  Latihan Rumah Hari Ini Selesai
                </label>
              </div>

              {portalData.hep_list.length === 0 ? (
                <p style={{ fontSize: 13, color: '#64748b' }}>
                  Belum ada catatan HEP terkunci untuk pasien ini.
                </p>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {portalData.hep_list.map((hep, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <strong style={{ fontSize: 14 }}>{hep.target_skill}</strong>
                        <span className="badge badge-green">
                          <FileCheck2 size={12} /> Akurasi Sesi: {hep.accuracy_percentage}% • TTE: {hep.tte_certificate_serial}
                        </span>
                      </div>
                      <p style={{ fontSize: 13, color: '#1e293b', marginTop: 8 }}>
                        <strong>Instruksi Latihan Orang Tua di Rumah:</strong> {hep.home_exercise_program}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sisa Kuota Paket Sesi & Riwayat Kwitansi Resmi */}
            <div className="grid-2">
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Calendar size={18} color="#0f766e" />
                  <h3 style={{ fontSize: 16, fontWeight: 800 }}>Kuota Paket Terapi Aktif</h3>
                </div>
                {portalData.packages.map((pkg, idx) => (
                  <div key={idx} style={{ padding: 12, background: '#f8fafc', borderRadius: 10 }}>
                    <div style={{ fontWeight: 800 }}>{pkg.package_name}</div>
                    <div style={{ fontSize: 13, color: '#0f766e', fontWeight: 700, marginTop: 4 }}>
                      Terpakai {pkg.used_sessions} dari {pkg.total_sessions} Sesi • Sisa Kuota:{' '}
                      {pkg.remaining_sessions} Sesi
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      Berlaku sampai: {pkg.valid_until}
                    </div>
                  </div>
                ))}
              </div>

              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Receipt size={18} color="#0f766e" />
                  <h3 style={{ fontSize: 16, fontWeight: 800 }}>Riwayat Bukti Pembayaran (e-Receipt)</h3>
                </div>
                {portalData.invoices.map((inv, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '10px 0',
                      borderBottom: '1px solid #f1f5f9',
                      fontSize: 13,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{inv.invoice_number}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{inv.description}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800 }}>{formatRupiah(inv.amount_idr)}</div>
                      <span className="badge badge-green">
                        <CheckCircle2 size={11} /> {inv.payment_status} ({inv.payment_method})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
