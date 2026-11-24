'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  CreditCard,
  DoorOpen,
  Globe,
  LayoutGrid,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Stethoscope,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { getBrowserSupabase, formatRupiah } from '../lib/supabaseClient';
import { SimklinikSnapshot } from '../lib/types';

/* ========================================================================== */
/* Tipe                                                                       */
/* ========================================================================== */

type SimMenuKey =
  | 'M1_DASHBOARD'
  | 'M2_ADMISI_JADWAL'
  | 'M3_RME_CPPT'
  | 'M4_SATUSEHAT'
  | 'M5_SOP_PPK'
  | 'M6_SDM_SIP_STR'
  | 'M7_KASIR_PAKET'
  | 'M8_SARPRAS_PPI'
  | 'M9_MUTU_DINKES'
  | 'M10_RBAC_AUDIT'
  | 'M11_TARIF'
  | 'M12_JADWAL'
  | 'M13_PAKET'
  | 'M14_STERILISASI'
  | 'M15_IKP'
  | 'M16_RUJUKAN';

export interface DashboardProps {
  snapshot: SimklinikSnapshot;
  role: string;
  actorName: string;
  cloudConnected: boolean;
  onNavigate: (menu: SimMenuKey) => void;
  onRefresh: () => Promise<void> | void;
  onNotify: (msg: string) => void;
}

interface Insight {
  pending_satusehat?: number;
  unpaid_invoices?: number;
  pending_bookings?: number;
  sessions_today?: number;
}

const APPT_STATUS = [
  'TERJADWAL',
  'CHECK_IN',
  'SEDANG_TERAPI',
  'SELESAI_SOAP_LOCKED',
  'BATAL',
  'NO_SHOW',
] as const;

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  TERJADWAL: { bg: '#dbeafe', fg: '#1e40af', label: 'Terjadwal' },
  CHECK_IN: { bg: '#fef3c7', fg: '#92400e', label: 'Check-in' },
  SEDANG_TERAPI: { bg: '#ccfbf1', fg: '#0f766e', label: 'Sedang Terapi' },
  SELESAI_SOAP_LOCKED: { bg: '#dcfce7', fg: '#166534', label: 'Selesai' },
  BATAL: { bg: '#fee2e2', fg: '#991b1b', label: 'Batal' },
  NO_SHOW: { bg: '#f1f5f9', fg: '#475569', label: 'Tidak Hadir' },
};

/* ========================================================================== */
/* Komponen                                                                   */
/* ========================================================================== */

export default function ClinicOperatingDashboard({
  snapshot,
  role,
  actorName,
  cloudConnected,
  onNavigate,
  onRefresh,
  onNotify,
}: DashboardProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('SEMUA');
  const [menu, setMenu] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const menuRef = useRef<HTMLDivElement>(null);

  /* Jam berjalan — dasbor klinik harus terasa hidup. */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  /* Tutup menu aksi bila klik di luar. */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const sb = getBrowserSupabase();

  const callAction = useCallback(
    async (action: string, payload: Record<string, unknown>) => {
      if (!sb) {
        onNotify(
          'Supabase belum terhubung. Aksi tidak dapat dijalankan — ini bukan simulasi, jadi tidak ada yang berpura-pura tersimpan.'
        );
        return null;
      }
      const { data, error } = await sb.rpc('tw_simklinik_execute_action', {
        p_action: action,
        p_payload: { actor_name: actorName, actor_role: role, ...payload },
      });
      if (error) {
        onNotify(`Gagal: ${error.message}`);
        return null;
      }
      return data as Record<string, unknown>;
    },
    [sb, actorName, role, onNotify]
  );

  /* Wawasan ringkas dari basis data */
  const loadInsight = useCallback(async () => {
    const res = await callAction('THEMATIC_INSIGHT', {});
    if (res) setInsight(res as Insight);
  }, [callAction]);

  useEffect(() => {
    loadInsight();
  }, [loadInsight]);

  /* ------------------------------------------------------------------ */
  /* Aksi operasional                                                    */
  /* ------------------------------------------------------------------ */

  const changeStatus = async (apptId: string, patientName: string, status: string) => {
    setBusy(apptId);
    setMenu(null);
    const res = await callAction('SET_APPOINTMENT_STATUS', {
      appointment_id: apptId,
      status,
    });
    setBusy(null);
    if (res) {
      onNotify(`Status sesi ${patientName} → ${STATUS_STYLE[status]?.label ?? status}`);
      await onRefresh();
    }
  };

  const sendReminder = async (apptId: string, patientName: string) => {
    setBusy(apptId);
    setMenu(null);
    const res = await callAction('SEND_SESSION_REMINDER', { appointment_id: apptId });
    setBusy(null);
    if (res) {
      onNotify(
        `Pengingat untuk ${patientName} dicatat pada jejak audit. Gateway WhatsApp belum terhubung.`
      );
    }
  };

  const retryFhir = async () => {
    setBusy('FHIR');
    const res = await callAction('RETRY_SATUSEHAT_SYNC', {});
    setBusy(null);
    if (res) {
      onNotify('Sinkronisasi SATUSEHAT diulang — semua rekaman tertunda ditandai SYNCED.');
      await onRefresh();
      await loadInsight();
    }
  };

  const approveBooking = async (bookingId: string, name: string) => {
    setBusy(bookingId);
    const res = await callAction('APPROVE_ONLINE_BOOKING_TO_MRN', { booking_id: bookingId });
    setBusy(null);
    if (res) {
      onNotify(
        `Pasien ${name} terverifikasi. No. RM baru: ${String(res.medical_record_number ?? '-')}`
      );
      await onRefresh();
      await loadInsight();
    }
  };

  /* ------------------------------------------------------------------ */
  /* Turunan data                                                        */
  /* ------------------------------------------------------------------ */

  const today = now.toISOString().slice(0, 10);

  const todaysAppointments = useMemo(() => {
    const todays = snapshot.appointments.filter(
      (a) => String(a.scheduled_start).slice(0, 10) === today
    );
    return (todays.length ? todays : snapshot.appointments).slice().sort((a, b) =>
      String(a.scheduled_start).localeCompare(String(b.scheduled_start))
    );
  }, [snapshot.appointments, today]);

  const filteredAppointments = useMemo(() => {
    const q = query.trim().toLowerCase();
    return todaysAppointments.filter((a) => {
      const byStatus = statusFilter === 'SEMUA' || a.status === statusFilter;
      const byQuery =
        !q ||
        a.patient_name.toLowerCase().includes(q) ||
        a.medical_record_number.toLowerCase().includes(q) ||
        a.therapist_name.toLowerCase().includes(q) ||
        a.room_code.toLowerCase().includes(q);
      return byStatus && byQuery;
    });
  }, [todaysAppointments, statusFilter, query]);

  const inProgress = todaysAppointments.filter((a) => a.status === 'SEDANG_TERAPI').length;
  const waiting = todaysAppointments.filter((a) => a.status === 'CHECK_IN').length;
  const completed = todaysAppointments.filter((a) => a.status === 'SELESAI_SOAP_LOCKED').length;

  const revenuePaid = snapshot.invoices
    .filter((i) => i.payment_status === 'LUNAS')
    .reduce((acc, cur) => acc + Number(cur.amount_idr || 0), 0);
  const deferred = snapshot.packages.reduce(
    (acc, cur) => acc + Number(cur.deferred_revenue_idr || 0),
    0
  );
  const unpaidCount = snapshot.invoices.filter((i) => i.payment_status !== 'LUNAS').length;

  const fhirSynced = snapshot.satusehat_logs.filter((s) => s.sync_status === 'SYNCED').length;
  const fhirTotal = snapshot.satusehat_logs.length || 1;
  const fhirPercent = Math.round((fhirSynced / fhirTotal) * 100);

  const pendingBookings = snapshot.online_bookings.filter(
    (b) => b.status === 'MENUNGGU_VERIFIKASI' || b.status === 'PENDING'
  );

  const dangerSessions = snapshot.soap_sessions.filter((s) => !s.is_locked_tte).length;

  const expiringCredentials = snapshot.therapists.filter((t) => {
    const days = Math.ceil(
      (new Date(t.sip_valid_until).getTime() - now.getTime()) / 86_400_000
    );
    return days <= 60;
  });

  const lowStock = snapshot.inventory.filter(
    (i) => Number(i.stock_qty) <= Number(i.min_stock_alert)
  );

  const calibDue = snapshot.inventory.filter((i) => {
    if (!i.next_calibration_date) return false;
    const days = Math.ceil(
      (new Date(i.next_calibration_date).getTime() - now.getTime()) / 86_400_000
    );
    return days <= 30;
  });

  const unmetIndicators = snapshot.quality_indicators.filter(
    (q) => Number(q.achieved_percentage) < Number(q.target_percentage)
  );

  const openIncidents = snapshot.incidents.length;

  /* ------------------------------------------------------------------ */
  /* Antrean tugas — inilah yang membuat dasbor jadi alat kerja          */
  /* ------------------------------------------------------------------ */

  const workItems = [
    pendingBookings.length > 0 && {
      id: 'booking',
      icon: UserPlus,
      tone: '#1e40af',
      bg: '#dbeafe',
      title: `${pendingBookings.length} pendaftaran daring menunggu verifikasi`,
      detail: 'Verifikasi 2 identitas + general consent, lalu terbitkan No. RM.',
      action: 'Proses',
      onClick: () => onNavigate('M2_ADMISI_JADWAL'),
    },
    dangerSessions > 0 && {
      id: 'tte',
      icon: AlertTriangle,
      tone: '#b45309',
      bg: '#fef3c7',
      title: `${dangerSessions} catatan SOAP belum dikunci TTE`,
      detail: 'Belum sah sebagai rekam medis elektronik (Permenkes 24/2022 Pasal 12).',
      action: 'Kunci',
      onClick: () => onNavigate('M3_RME_CPPT'),
    },
    (insight?.pending_satusehat ?? 0) > 0 && {
      id: 'fhir',
      icon: Globe,
      tone: '#7c3aed',
      bg: '#ede9fe',
      title: `${insight?.pending_satusehat} encounter tertunda ke SATUSEHAT`,
      detail: 'Kirim ulang antrean FHIR agar pelaporan Kemenkes tidak terlambat.',
      action: busy === 'FHIR' ? 'Mengirim…' : 'Kirim Ulang',
      onClick: retryFhir,
    },
    expiringCredentials.length > 0 && {
      id: 'sip',
      icon: AlertTriangle,
      tone: '#b45309',
      bg: '#fef3c7',
      title: `${expiringCredentials.length} SIP terapis jatuh tempo ≤ 60 hari`,
      detail: expiringCredentials.map((t) => t.full_name).join(', '),
      action: 'Lihat SDM',
      onClick: () => onNavigate('M6_SDM_SIP_STR'),
    },
    unpaidCount > 0 && {
      id: 'kasir',
      icon: Wallet,
      tone: '#0f766e',
      bg: '#ccfbf1',
      title: `${unpaidCount} tagihan belum lunas`,
      detail: `Total tagihan tercatat ${formatRupiah(
        snapshot.invoices.filter((i) => i.payment_status !== 'LUNAS').reduce((a, c) => a + Number(c.amount_idr || 0), 0)
      )}`,
      action: 'Buka Kasir',
      onClick: () => onNavigate('M7_KASIR_PAKET'),
    },
    lowStock.length > 0 && {
      id: 'stok',
      icon: AlertTriangle,
      tone: '#b45309',
      bg: '#fef3c7',
      title: `${lowStock.length} alat/bahan di bawah stok minimum`,
      detail: lowStock.map((i) => i.item_name).slice(0, 3).join(', '),
      action: 'Inventaris',
      onClick: () => onNavigate('M8_SARPRAS_PPI'),
    },
    calibDue.length > 0 && {
      id: 'kalibrasi',
      icon: CircleDot,
      tone: '#7c3aed',
      bg: '#ede9fe',
      title: `${calibDue.length} alat jatuh tempo kalibrasi ≤ 30 hari`,
      detail: 'Wajib untuk akreditasi klinik (Permenkes 34/2022).',
      action: 'Lihat',
      onClick: () => onNavigate('M8_SARPRAS_PPI'),
    },
    unmetIndicators.length > 0 && {
      id: 'inm',
      icon: TrendingUp,
      tone: '#b45309',
      bg: '#fef3c7',
      title: `${unmetIndicators.length} indikator mutu di bawah target`,
      detail: unmetIndicators
        .map((q) => `${q.indicator_code} ${q.achieved_percentage}%`)
        .slice(0, 4)
        .join(' • '),
      action: 'Analisis',
      onClick: () => onNavigate('M9_MUTU_DINKES'),
    },
    openIncidents > 0 && {
      id: 'ikp',
      icon: AlertTriangle,
      tone: '#b91c1c',
      bg: '#fee2e2',
      title: `${openIncidents} insiden keselamatan pasien tercatat`,
      detail: 'Telaah akar masalah & rencana perbaikan wajib didokumentasikan.',
      action: 'Tinjau',
      onClick: () => onNavigate('M15_IKP'),
    },
  ].filter(Boolean) as Array<{
    id: string;
    icon: React.ComponentType<{ size?: number; color?: string }>;
    tone: string;
    bg: string;
    title: string;
    detail: string;
    action: string;
    onClick: () => void;
  }>;

  /* ------------------------------------------------------------------ */

  const jam = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const tanggal = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* ================= KEPALA DASBOR ================= */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          background: 'linear-gradient(120deg,#0f766e 0%,#115e59 55%,#134e4a 100%)',
          color: '#fff',
          border: 'none',
        }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#99f6e4', letterSpacing: 0.4 }}>
            {snapshot.clinic.name.toUpperCase()} • {snapshot.clinic.fasyankes_code}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>
            Selamat bekerja, {actorName.split(',')[0]}
          </div>
          <div style={{ fontSize: 12, color: '#ccfbf1', marginTop: 3 }}>
            {tanggal} • {jam} WIB — {todaysAppointments.length} sesi terjadwal hari ini
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div
            style={{
              background: 'rgba(255,255,255,0.14)',
              borderRadius: 10,
              padding: '8px 13px',
              minWidth: 84,
            }}
          >
            <div style={{ fontSize: 9.5, color: '#99f6e4', fontWeight: 700 }}>SEDANG TERAPI</div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{inProgress}</div>
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.14)',
              borderRadius: 10,
              padding: '8px 13px',
              minWidth: 84,
            }}
          >
            <div style={{ fontSize: 9.5, color: '#99f6e4', fontWeight: 700 }}>MENUNGGU</div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{waiting}</div>
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.14)',
              borderRadius: 10,
              padding: '8px 13px',
              minWidth: 84,
            }}
          >
            <div style={{ fontSize: 9.5, color: '#99f6e4', fontWeight: 700 }}>SELESAI</div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{completed}</div>
          </div>
        </div>
      </div>

      {/* ================= ANTREAN TUGAS ================= */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
            flexWrap: 'wrap',
          }}
        >
          <LayoutGrid size={16} color="#0f766e" />
          <h2 style={{ fontSize: 15, fontWeight: 900 }}>Perlu Tindakan Anda</h2>
          <span
            className="badge"
            style={{
              background: workItems.length ? '#fef3c7' : '#dcfce7',
              color: workItems.length ? '#92400e' : '#166534',
              fontWeight: 800,
            }}
          >
            {workItems.length ? `${workItems.length} butir` : 'Semua beres'}
          </span>
          <button
            className="btn btn-outline"
            style={{ marginLeft: 'auto', fontSize: 11.5, padding: '6px 10px' }}
            onClick={async () => {
              await onRefresh();
              await loadInsight();
            }}
          >
            <RefreshCw size={12} /> Muat Ulang
          </button>
        </div>

        {workItems.length === 0 ? (
          <div
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              borderStyle: 'dashed',
              color: '#166534',
            }}
          >
            <CheckCircle2 size={20} color="#059669" />
            <div>
              <div style={{ fontWeight: 800, fontSize: 13 }}>Tidak ada tugas tertunda</div>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>
                Semua pendaftaran, kunci TTE, dan sinkronisasi sudah selesai.
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))',
              gap: 10,
            }}
          >
            {workItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="card"
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 9,
                        background: item.bg,
                        color: item.tone,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={16} color={item.tone} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.45 }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 3, lineHeight: 1.5 }}>
                        {item.detail}
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn btn-outline"
                    style={{
                      fontSize: 11.5,
                      padding: '6px 10px',
                      marginTop: 'auto',
                      alignSelf: 'flex-start',
                      borderColor: item.tone,
                      color: item.tone,
                    }}
                    onClick={item.onClick}
                  >
                    {item.action} <ChevronRight size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= JADWAL HARI INI (INTERAKTIF) ================= */}
      <div className="card" ref={menuRef}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            marginBottom: 11,
            flexWrap: 'wrap',
          }}
        >
          <CalendarClock size={16} color="#0f766e" />
          <h2 style={{ fontSize: 15, fontWeight: 900 }}>Jadwal Sesi Hari Ini</h2>
          <span className="badge badge-teal" style={{ fontWeight: 800 }}>
            {filteredAppointments.length} sesi
          </span>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '5px 9px',
                background: '#fff',
              }}
            >
              <Search size={12} color="#94a3b8" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari pasien / RM / ruang"
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: 11.5,
                  width: 160,
                  background: 'transparent',
                }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                fontSize: 11.5,
                padding: '6px 8px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#fff',
                fontWeight: 700,
                color: '#334155',
              }}
            >
              <option value="SEMUA">Semua status</option>
              {APPT_STATUS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_STYLE[s].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 74 }}>Jam</th>
                <th>Pasien & No. RM</th>
                <th>Terapis & Ruang</th>
                <th>Fokus</th>
                <th style={{ width: 130 }}>Status</th>
                <th style={{ width: 96 }}>Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: 22 }}>
                    Tidak ada sesi yang cocok dengan pencarian.
                  </td>
                </tr>
              )}
              {filteredAppointments.map((ap) => {
                const st = STATUS_STYLE[ap.status] ?? {
                  bg: '#f1f5f9',
                  fg: '#475569',
                  label: ap.status,
                };
                const isBusy = busy === ap.id;
                return (
                  <tr key={ap.id}>
                    <td>
                      <div style={{ fontWeight: 900, fontSize: 12.5 }}>
                        {String(ap.scheduled_start).slice(11, 16)}
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>
                        {String(ap.scheduled_end).slice(11, 16)}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{ap.patient_name}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {ap.medical_record_number} • Sesi {ap.session_number}
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                        {ap.patient_identity_verified ? (
                          <span className="badge badge-green" style={{ fontSize: 8.5 }}>
                            2 IDENTITAS ✓
                          </span>
                        ) : (
                          <span className="badge badge-amber" style={{ fontSize: 8.5 }}>
                            IDENTITAS BELUM
                          </span>
                        )}
                        {ap.informed_consent_verified && (
                          <span className="badge badge-green" style={{ fontSize: 8.5 }}>
                            CONSENT ✓
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 11.5 }}>{ap.therapist_name}</div>
                      <div style={{ fontSize: 10.5, color: '#0f766e', fontWeight: 700 }}>
                        {ap.room_code}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#334155' }}>
                        {ap.disorder_focus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{ background: st.bg, color: st.fg, fontWeight: 800, fontSize: 9.5 }}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td style={{ position: 'relative' }}>
                      <button
                        className="btn btn-outline"
                        style={{ fontSize: 10.5, padding: '4px 8px' }}
                        disabled={isBusy}
                        onClick={() => setMenu(menu === ap.id ? null : ap.id)}
                      >
                        {isBusy ? <Loader2 size={11} className="spin" /> : null} Ubah
                      </button>

                      {menu === ap.id && (
                        <div
                          style={{
                            position: 'absolute',
                            right: 8,
                            top: '100%',
                            zIndex: 50,
                            background: '#fff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 10,
                            boxShadow: '0 10px 28px rgba(15,23,42,0.16)',
                            minWidth: 186,
                            padding: 5,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 9.5,
                              fontWeight: 800,
                              color: '#94a3b8',
                              padding: '4px 8px',
                            }}
                          >
                            UBAH STATUS SESI
                          </div>
                          {APPT_STATUS.filter((s) => s !== ap.status).map((s) => (
                            <button
                              key={s}
                              onClick={() => changeStatus(ap.id, ap.patient_name, s)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                width: '100%',
                                textAlign: 'left',
                                border: 'none',
                                background: 'transparent',
                                padding: '7px 8px',
                                borderRadius: 7,
                                cursor: 'pointer',
                                fontSize: 11.5,
                                fontWeight: 600,
                                color: '#334155',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.background = 'transparent')
                              }
                            >
                              <span
                                style={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: 999,
                                  background: STATUS_STYLE[s].fg,
                                }}
                              />
                              {STATUS_STYLE[s].label}
                            </button>
                          ))}
                          <div style={{ height: 1, background: '#f1f5f9', margin: '4px 0' }} />
                          <button
                            onClick={() => sendReminder(ap.id, ap.patient_name)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 7,
                              width: '100%',
                              textAlign: 'left',
                              border: 'none',
                              background: 'transparent',
                              padding: '7px 8px',
                              borderRadius: 7,
                              cursor: 'pointer',
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: '#0f766e',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f0fdfa')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <BellRing size={12} color="#0f766e" /> Kirim Pengingat
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= KEUANGAN + SATUSEHAT ================= */}
      <div className="grid-2">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <CreditCard size={16} color="#0f766e" />
            <h3 style={{ fontSize: 14, fontWeight: 900 }}>Keuangan Hari Ini</h3>
            <button
              className="btn btn-outline"
              style={{ marginLeft: 'auto', fontSize: 10.5, padding: '4px 8px' }}
              onClick={() => onNavigate('M7_KASIR_PAKET')}
            >
              Buka Kasir <ArrowRight size={11} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: '#f0fdfa', borderRadius: 10, padding: 11 }}>
              <div style={{ fontSize: 10, color: '#0f766e', fontWeight: 800 }}>DITERIMA (LUNAS)</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#0f766e', marginTop: 2 }}>
                {formatRupiah(revenuePaid)}
              </div>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: 11 }}>
              <div style={{ fontSize: 10, color: '#64748b', fontWeight: 800 }}>
                DITANGGUHKAN (PSAK 72)
              </div>
              <div style={{ fontSize: 17, fontWeight: 900, marginTop: 2 }}>
                {formatRupiah(deferred)}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 9 }}>
            {snapshot.invoices.length} kuitansi terbit • {unpaidCount} belum lunas
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Globe size={16} color="#0f766e" />
            <h3 style={{ fontSize: 14, fontWeight: 900 }}>Bridging SATUSEHAT</h3>
            <button
              className="btn btn-outline"
              style={{ marginLeft: 'auto', fontSize: 10.5, padding: '4px 8px' }}
              disabled={busy === 'FHIR'}
              onClick={retryFhir}
            >
              {busy === 'FHIR' ? <Loader2 size={11} className="spin" /> : <RefreshCw size={11} />}{' '}
              Kirim Ulang
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 900 }}>{fhirSynced}</span>
            <span style={{ fontSize: 13, color: '#64748b' }}>/ {fhirTotal} encounter</span>
            <span
              className="badge"
              style={{
                marginLeft: 'auto',
                background: fhirPercent === 100 ? '#dcfce7' : '#fef3c7',
                color: fhirPercent === 100 ? '#166534' : '#92400e',
                fontWeight: 800,
              }}
            >
              {fhirPercent}%
            </span>
          </div>
          <div
            style={{
              height: 7,
              background: '#e2e8f0',
              borderRadius: 999,
              marginTop: 8,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${fhirPercent}%`,
                height: '100%',
                background: fhirPercent === 100 ? '#059669' : '#d97706',
              }}
            />
          </div>
          <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 7 }}>
            Org ID {snapshot.clinic.satusehat_org_id} • HL7 FHIR R4
          </div>
        </div>
      </div>

      {/* ================= MUTU + RUANG ================= */}
      <div className="grid-2">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <TrendingUp size={16} color="#0f766e" />
            <h3 style={{ fontSize: 14, fontWeight: 900 }}>Indikator Mutu Nasional</h3>
            <button
              className="btn btn-outline"
              style={{ marginLeft: 'auto', fontSize: 10.5, padding: '4px 8px' }}
              onClick={() => onNavigate('M9_MUTU_DINKES')}
            >
              Detail <ArrowRight size={11} />
            </button>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {snapshot.quality_indicators.slice(0, 5).map((qi) => {
              const ok = Number(qi.achieved_percentage) >= Number(qi.target_percentage);
              return (
                <div key={qi.id}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 11.5,
                      gap: 8,
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{qi.indicator_name}</span>
                    <strong style={{ color: ok ? '#059669' : '#b45309', whiteSpace: 'nowrap' }}>
                      {qi.achieved_percentage}% / {qi.target_percentage}%
                    </strong>
                  </div>
                  <div
                    style={{
                      height: 6,
                      background: '#e2e8f0',
                      borderRadius: 999,
                      marginTop: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, Number(qi.achieved_percentage))}%`,
                        height: '100%',
                        background: ok ? '#059669' : '#d97706',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <DoorOpen size={16} color="#0f766e" />
            <h3 style={{ fontSize: 14, fontWeight: 900 }}>Kesiapan Ruang Terapi</h3>
            <button
              className="btn btn-outline"
              style={{ marginLeft: 'auto', fontSize: 10.5, padding: '4px 8px' }}
              onClick={() => onNavigate('M8_SARPRAS_PPI')}
            >
              Sarpras <ArrowRight size={11} />
            </button>
          </div>
          <div style={{ display: 'grid', gap: 7 }}>
            {snapshot.rooms.map((rm) => {
              const noisy = Number(rm.ambient_noise_db) > 35;
              return (
                <div
                  key={rm.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '7px 9px',
                    borderRadius: 9,
                    background: '#f8fafc',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800 }}>
                      {rm.room_code} — {rm.room_name}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>
                      {rm.has_soundproofing ? 'Kedap suara' : 'Tanpa peredam'} •{' '}
                      {rm.ambient_noise_db} dB
                      {rm.has_therapy_mirror ? ' • Cermin terapi' : ''}
                    </div>
                  </div>
                  <span
                    className="badge"
                    style={{
                      background: noisy ? '#fee2e2' : '#dcfce7',
                      color: noisy ? '#991b1b' : '#166534',
                      fontSize: 8.5,
                      fontWeight: 900,
                    }}
                  >
                    {noisy ? 'BISING' : 'SIAP'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ================= PENDAFTARAN DARING ================= */}
      {pendingBookings.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <UserPlus size={16} color="#1e40af" />
            <h3 style={{ fontSize: 14, fontWeight: 900 }}>Pendaftaran Daring Menunggu</h3>
            <span className="badge badge-amber" style={{ fontWeight: 800 }}>
              {pendingBookings.length}
            </span>
            <button
              className="btn btn-outline"
              style={{ marginLeft: 'auto', fontSize: 10.5, padding: '4px 8px' }}
              onClick={() => onNavigate('M2_ADMISI_JADWAL')}
            >
              Semua <ArrowRight size={11} />
            </button>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {pendingBookings.slice(0, 4).map((b) => (
              <div
                key={b.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 9,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 800 }}>
                    {b.patient_full_name}{' '}
                    <span style={{ fontWeight: 500, color: '#64748b' }}>
                      ({b.gender}, {new Date(b.birth_date).toLocaleDateString('id-ID')})
                    </span>
                  </div>
                  <div style={{ fontSize: 10.5, color: '#64748b' }}>
                    Wali: {b.guardian_name} • {b.guardian_phone} • {b.disorder_concern}
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                    Diminta: {b.requested_date} {b.requested_slot} •{' '}
                    {b.pdp_explicit_consent ? 'Consent PDP ✓' : 'Consent PDP BELUM'}
                  </div>
                </div>
                <button
                  className="btn"
                  style={{ fontSize: 10.5, padding: '5px 9px' }}
                  disabled={busy === b.id}
                  onClick={() => approveBooking(b.id, b.patient_full_name)}
                >
                  {busy === b.id ? <Loader2 size={11} className="spin" /> : <CheckCircle2 size={11} />}{' '}
                  Verifikasi & Terbitkan RM
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= KAKI ================= */}
      <div
        style={{
          fontSize: 10,
          color: '#94a3b8',
          textAlign: 'center',
          padding: '4px 0 10px',
          lineHeight: 1.6,
        }}
      >
        Data langsung dari Supabase RME — {cloudConnected ? 'terhubung cloud' : 'mode luring'} •
        Diperbarui {new Date(snapshot.generated_at).toLocaleTimeString('id-ID')}
        <br />
        UU 17/2023 • Permenkes 24/2022 • Permenkes 81/2014 • Permenkes 34/2022 • UU PDP 27/2022
      </div>
    </div>
  );
}
