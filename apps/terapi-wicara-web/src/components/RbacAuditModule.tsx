'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileLock2,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import { SimklinikSnapshot } from '../lib/types';

/**
 * MENU 10 — RBAC & AUDIT PDP (UU No. 27 Tahun 2022)
 *
 * Menu ini sebelumnya hanya menampilkan halaman kosong. Sekarang menjadi
 * modul tata kelola akses:
 *   • matriks peran → izin per modul (RBAC), sesuai prinsip "seperlunya"
 *     (Pasal 27–28 UU PDP: pembatasan tujuan & minimalisasi data)
 *   • jejak audit tak terhapus dengan filter, pencarian, navigasi baris
 *   • cetak laporan audit untuk pemeriksaan Dinkes / auditor internal
 *   • ekspor CSV untuk bukti kepatuhan
 *
 * Penting: jejak audit bersifat READ-ONLY di aplikasi ini. Tidak ada tombol
 * hapus — itu disengaja, karena UU PDP Pasal 35 mewajibkan catatan akses
 * dipertahankan. Tabel di bawah adalah bukti, bukan draf.
 */

interface Props {
  snapshot: SimklinikSnapshot;
  role: string;
  actorName: string;
  onRefresh: () => Promise<void> | void;
  onNotify: (msg: string) => void;
  onSwitchRole: (role: string) => void;
}

type MenuPermission = 'R' | 'W' | '—';

const ROLES = [
  'KEPALA_KLINIK',
  'ADMISI_RME',
  'TERAPIS_WICARA',
  'KASIR_KEUANGAN',
  'TIM_MUTU_DINKES',
] as const;

const ROLE_LABEL: Record<string, string> = {
  KEPALA_KLINIK: 'Kepala Klinik',
  ADMISI_RME: 'Admisi & Rekam Medis',
  TERAPIS_WICARA: 'Terapis Wicara',
  KASIR_KEUANGAN: 'Kasir & Keuangan',
  TIM_MUTU_DINKES: 'Tim Mutu & Dinkes',
};

/** Matriks izin: R = baca, W = tulis, — = tidak berhak. */
const MATRIX: Array<{ module: string; perms: Record<string, MenuPermission> }> = [
  { module: '1. Dasbor Operasional', perms: { KEPALA_KLINIK: 'R', ADMISI_RME: 'R', TERAPIS_WICARA: 'R', KASIR_KEUANGAN: 'R', TIM_MUTU_DINKES: 'R' } },
  { module: '2. Admisi & Data Pasien', perms: { KEPALA_KLINIK: 'R', ADMISI_RME: 'W', TERAPIS_WICARA: 'R', KASIR_KEUANGAN: 'R', TIM_MUTU_DINKES: '—' } },
  { module: '3. RME & CPPT SOAP', perms: { KEPALA_KLINIK: 'R', ADMISI_RME: 'R', TERAPIS_WICARA: 'W', KASIR_KEUANGAN: '—', TIM_MUTU_DINKES: 'R' } },
  { module: '4. Bridging SATUSEHAT', perms: { KEPALA_KLINIK: 'R', ADMISI_RME: 'W', TERAPIS_WICARA: '—', KASIR_KEUANGAN: '—', TIM_MUTU_DINKES: 'R' } },
  { module: '5. Master SOP & PPK', perms: { KEPALA_KLINIK: 'W', ADMISI_RME: 'R', TERAPIS_WICARA: 'R', KASIR_KEUANGAN: '—', TIM_MUTU_DINKES: 'R' } },
  { module: '6. SDM, STR & SIP', perms: { KEPALA_KLINIK: 'W', ADMISI_RME: 'R', TERAPIS_WICARA: 'R', KASIR_KEUANGAN: '—', TIM_MUTU_DINKES: 'R' } },
  { module: '7. Kasir & Paket Sesi', perms: { KEPALA_KLINIK: 'R', ADMISI_RME: '—', TERAPIS_WICARA: '—', KASIR_KEUANGAN: 'W', TIM_MUTU_DINKES: 'R' } },
  { module: '8. Sarpras, MFK & PPI', perms: { KEPALA_KLINIK: 'R', ADMISI_RME: '—', TERAPIS_WICARA: 'R', KASIR_KEUANGAN: '—', TIM_MUTU_DINKES: 'W' } },
  { module: '9. Mutu INM & Dinkes', perms: { KEPALA_KLINIK: 'R', ADMISI_RME: '—', TERAPIS_WICARA: '—', KASIR_KEUANGAN: '—', TIM_MUTU_DINKES: 'W' } },
  { module: '10. RBAC & Audit PDP', perms: { KEPALA_KLINIK: 'R', ADMISI_RME: '—', TERAPIS_WICARA: '—', KASIR_KEUANGAN: '—', TIM_MUTU_DINKES: 'R' } },
  { module: '11. Master Tarif', perms: { KEPALA_KLINIK: 'W', ADMISI_RME: 'R', TERAPIS_WICARA: 'R', KASIR_KEUANGAN: 'R', TIM_MUTU_DINKES: '—' } },
  { module: '12. Penjadwalan Sesi', perms: { KEPALA_KLINIK: 'R', ADMISI_RME: 'W', TERAPIS_WICARA: 'W', KASIR_KEUANGAN: 'R', TIM_MUTU_DINKES: '—' } },
  { module: '13. Paket Sesi', perms: { KEPALA_KLINIK: 'R', ADMISI_RME: 'R', TERAPIS_WICARA: '—', KASIR_KEUANGAN: 'W', TIM_MUTU_DINKES: '—' } },
  { module: '14. Log Sterilisasi PPI', perms: { KEPALA_KLINIK: 'R', ADMISI_RME: '—', TERAPIS_WICARA: 'W', KASIR_KEUANGAN: '—', TIM_MUTU_DINKES: 'R' } },
  { module: '15. Insiden Keselamatan (IKP)', perms: { KEPALA_KLINIK: 'R', ADMISI_RME: 'W', TERAPIS_WICARA: 'W', KASIR_KEUANGAN: '—', TIM_MUTU_DINKES: 'W' } },
  { module: '16. Rujukan Interprofesional', perms: { KEPALA_KLINIK: 'R', ADMISI_RME: 'R', TERAPIS_WICARA: 'W', KASIR_KEUANGAN: '—', TIM_MUTU_DINKES: 'R' } },
];

const PERM_STYLE: Record<MenuPermission, { label: string; bg: string; fg: string }> = {
  R: { label: 'Baca', bg: '#dbeafe', fg: '#1e40af' },
  W: { label: 'Tulis', bg: '#dcfce7', fg: '#166534' },
  '—': { label: 'Tidak berhak', bg: '#f1f5f9', fg: '#94a3b8' },
};

export default function RbacAuditModule({
  snapshot,
  role,
  actorName,
  onRefresh,
  onNotify,
  onSwitchRole,
}: Props) {
  const [tab, setTab] = useState<'AUDIT' | 'MATRIX'>('AUDIT');
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('SEMUA');
  const [cursor, setCursor] = useState(0);

  const logs = snapshot.audit_logs;

  const actions = useMemo(
    () => Array.from(new Set(logs.map((l) => l.action))).sort(),
    [logs]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      const byAction = actionFilter === 'SEMUA' || l.action === actionFilter;
      const byQuery =
        !q ||
        l.actor_name.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.entity_type.toLowerCase().includes(q) ||
        String(l.patient_mrn ?? '').toLowerCase().includes(q) ||
        l.device_platform.toLowerCase().includes(q);
      return byAction && byQuery;
    });
  }, [logs, query, actionFilter]);

  const row = filtered[Math.min(cursor, Math.max(0, filtered.length - 1))];

  const actorCounts = useMemo(() => {
    const map = new Map<string, number>();
    logs.forEach((l) => map.set(l.actor_name, (map.get(l.actor_name) ?? 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [logs]);

  /* ------------------------------------------------------------------ */

  const exportCsv = () => {
    const head = ['Waktu', 'Aktor', 'SIP', 'Aksi', 'Entitas', 'ID Entitas', 'No. RM', 'Perangkat'];
    const rows = filtered.map((l) => [
      l.logged_at,
      l.actor_name,
      l.actor_sip_number ?? '',
      l.action,
      l.entity_type,
      l.entity_id,
      l.patient_mrn ?? '',
      l.device_platform,
    ]);
    const csv = [head, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `jejak-audit-pdp-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    onNotify(`Diekspor ${filtered.length} baris jejak audit ke CSV.`);
  };

  const printReport = () => {
    const win = window.open('', '_blank', 'width=980,height=720');
    if (!win) {
      onNotify('Popup diblokir browser. Izinkan popup untuk mencetak.');
      return;
    }
    const rowsHtml = filtered
      .map(
        (l) => `<tr>
          <td style="font-size:9.5px">${new Date(l.logged_at).toLocaleString('id-ID')}</td>
          <td>${l.actor_name}</td>
          <td style="text-align:center">${l.action}</td>
          <td>${l.entity_type}</td>
          <td style="font-family:monospace;font-size:9px">${l.entity_id}</td>
          <td>${l.patient_mrn ?? '—'}</td>
          <td style="font-size:9.5px">${l.device_platform}</td>
        </tr>`
      )
      .join('');

    win.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">
      <title>Laporan Jejak Audit PDP</title>
      <style>
        body{font-family:'Segoe UI',Arial,sans-serif;padding:28px;color:#0f172a}
        h1{font-size:17px;margin:0 0 3px}
        .sub{font-size:11px;color:#475569;margin-bottom:14px}
        .meta{display:flex;gap:24px;font-size:11px;margin-bottom:16px;flex-wrap:wrap}
        .meta b{display:block;font-size:9px;color:#64748b;text-transform:uppercase}
        table{width:100%;border-collapse:collapse;font-size:10px}
        th,td{border:1px solid #cbd5e1;padding:4px 6px;text-align:left}
        th{background:#f1f5f9;font-size:9px;text-transform:uppercase}
        .sign{margin-top:34px;display:flex;justify-content:space-between;font-size:11px}
        .sign div{text-align:center;width:210px}
        .line{margin-top:50px;border-top:1px solid #0f172a;padding-top:3px}
        @media print{body{padding:14px}}
      </style></head><body>
      <h1>LAPORAN JEJAK AUDIT AKSES DATA PRIBADI</h1>
      <div class="sub">${snapshot.clinic.name} • UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi</div>
      <div class="meta">
        <div><b>Jumlah Baris</b>${filtered.length}</div>
        <div><b>Periode Data</b>${filtered.length ? new Date(filtered[filtered.length - 1].logged_at).toLocaleDateString('id-ID') + ' — ' + new Date(filtered[0].logged_at).toLocaleDateString('id-ID') : '—'}</div>
        <div><b>Jumlah Aktor</b>${actorCounts.length}</div>
        <div><b>Dicetak</b>${new Date().toLocaleString('id-ID')}</div>
      </div>
      <table><thead><tr>
        <th>Waktu</th><th>Aktor</th><th>Aksi</th><th>Entitas</th>
        <th>ID Entitas</th><th>No. RM</th><th>Perangkat</th>
      </tr></thead><tbody>${rowsHtml}</tbody></table>
      <p style="font-size:10px;color:#475569;margin-top:12px">
        Catatan: jejak audit bersifat tambah-saja (append-only) dan tidak dapat diubah atau dihapus
        melalui aplikasi. Laporan ini merupakan bukti kepatuhan, bukan draf.
      </p>
      <div class="sign">
        <div>Pejabat Pelindungan Data<div class="line">${actorName}</div></div>
        <div>Kepala Klinik<div class="line">${snapshot.clinic.head_of_clinic_name}</div></div>
      </div>
      <script>window.onload=function(){window.print()}</script>
      </body></html>`);
    win.document.close();
  };

  /* ------------------------------------------------------------------ */

  return (
    <div style={{ display: 'grid', gap: 13 }}>
      {/* Kepala */}
      <div className="card" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: '#e0e7ff', display: 'grid', placeItems: 'center' }}>
          <FileLock2 size={19} color="#4338ca" />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ fontSize: 15, fontWeight: 900 }}>RBAC & Audit PDP</h2>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            UU No. 27 Tahun 2022 Pasal 27–28 (pembatasan tujuan & minimalisasi) • Pasal 35 (catatan
            akses) • Permenkes No. 24 Tahun 2022 Pasal 44
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          <div style={{ background: '#eef2ff', borderRadius: 9, padding: '7px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#4338ca' }}>{logs.length}</div>
            <div style={{ fontSize: 9, color: '#4338ca', fontWeight: 800 }}>BARIS AUDIT</div>
          </div>
          <div style={{ background: '#f0fdfa', borderRadius: 9, padding: '7px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#0f766e' }}>{actorCounts.length}</div>
            <div style={{ fontSize: 9, color: '#0f766e', fontWeight: 800 }}>AKTOR</div>
          </div>
        </div>
      </div>

      {/* Tab */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(
          [
            { id: 'AUDIT', label: 'Jejak Audit Akses', Icon: ShieldCheck },
            { id: 'MATRIX', label: 'Matriks Izin Peran', Icon: UserCog },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={tab === id ? 'btn btn-primary' : 'btn btn-outline'}
            style={{ fontSize: 12 }}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {tab === 'MATRIX' ? (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <UserCog size={15} color="#0f766e" />
            <h3 style={{ fontSize: 13.5, fontWeight: 900 }}>Matriks Kendali Akses Berbasis Peran</h3>
            <span className="badge badge-teal" style={{ marginLeft: 'auto', fontWeight: 800 }}>
              Peran aktif: {ROLE_LABEL[role] ?? role}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Modul</th>
                  {ROLES.map((r) => (
                    <th
                      key={r}
                      style={{
                        textAlign: 'center',
                        background: r === role ? '#ccfbf1' : undefined,
                        color: r === role ? '#0f766e' : undefined,
                      }}
                    >
                      {ROLE_LABEL[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((m) => (
                  <tr key={m.module}>
                    <td style={{ fontWeight: 700, fontSize: 11.5 }}>{m.module}</td>
                    {ROLES.map((r) => {
                      const p = m.perms[r] ?? '—';
                      const st = PERM_STYLE[p];
                      return (
                        <td key={r} style={{ textAlign: 'center' }}>
                          <span
                            className="badge"
                            style={{
                              background: st.bg,
                              color: st.fg,
                              fontWeight: 800,
                              fontSize: 9,
                              opacity: r === role ? 1 : 0.62,
                            }}
                          >
                            {p === '—' ? '—' : p}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              marginTop: 11,
              fontSize: 10.5,
              color: '#475569',
              lineHeight: 1.65,
              background: '#f8fafc',
              borderRadius: 9,
              padding: 11,
            }}
          >
            <strong>R</strong> = boleh membaca • <strong>W</strong> = boleh menulis/mengubah •{' '}
            <strong>—</strong> = tidak berhak. Matriks ini menegakkan prinsip <em>minimalisasi data</em>{' '}
            (UU PDP Pasal 28): setiap peran hanya menyentuh data yang diperlukan untuk tugasnya. Pada
            basis data, aturan yang sama ditegakkan oleh Row-Level Security — matriks ini adalah
            cermin yang dapat dibaca manusia, bukan satu-satunya pengaman.
          </div>

          <div style={{ display: 'flex', gap: 7, marginTop: 11, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10.5, color: '#64748b', alignSelf: 'center' }}>
              Uji matriks dengan beralih peran:
            </span>
            {ROLES.map((r) => (
              <button
                key={r}
                className={r === role ? 'btn btn-primary' : 'btn btn-outline'}
                style={{ fontSize: 10.5, padding: '4px 9px' }}
                onClick={() => {
                  onSwitchRole(r);
                  onNotify(`Peran diubah ke ${ROLE_LABEL[r]} — perhatikan menu yang dapat diakses.`);
                }}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="card">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 11 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '5px 9px',
              }}
            >
              <Search size={13} color="#94a3b8" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari aktor / aksi / No. RM"
                style={{ border: 'none', outline: 'none', fontSize: 12, width: 190 }}
              />
            </div>

            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              style={{
                fontSize: 11.5,
                padding: '6px 8px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                fontWeight: 700,
                color: '#334155',
              }}
            >
              <option value="SEMUA">Semua aksi</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 7 }}>
              <button className="btn btn-outline" onClick={exportCsv}>
                <Download size={13} /> CSV
              </button>
              <button className="btn btn-outline" onClick={printReport}>
                <Printer size={13} /> Cetak Laporan
              </button>
              <button className="btn btn-outline" onClick={() => void onRefresh()}>
                <RefreshCw size={13} /> Muat Ulang
              </button>
            </div>
          </div>

          {/* Navigasi baris */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '8px 11px',
              background: '#f8fafc',
              borderRadius: 9,
              marginBottom: 11,
              flexWrap: 'wrap',
            }}
          >
            <button
              className="btn btn-outline"
              style={{ fontSize: 11.5, padding: '5px 9px' }}
              disabled={cursor <= 0}
              onClick={() => setCursor((c) => Math.max(0, c - 1))}
            >
              <ChevronLeft size={13} /> Sebelumnya
            </button>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: '#334155' }}>
              Baris {filtered.length === 0 ? 0 : cursor + 1} dari {filtered.length}
            </span>
            <button
              className="btn btn-outline"
              style={{ fontSize: 11.5, padding: '5px 9px' }}
              disabled={cursor >= filtered.length - 1}
              onClick={() => setCursor((c) => Math.min(filtered.length - 1, c + 1))}
            >
              Berikutnya <ChevronRight size={13} />
            </button>
            {row && (
              <span style={{ marginLeft: 'auto', fontSize: 10.5, color: '#64748b' }}>
                {new Date(row.logged_at).toLocaleString('id-ID')} • {row.actor_name} • {row.action}
              </span>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Waktu</th>
                  <th>Aktor</th>
                  <th style={{ width: 150 }}>Aksi</th>
                  <th style={{ width: 110 }}>Entitas</th>
                  <th style={{ width: 100 }}>No. RM</th>
                  <th style={{ width: 118 }}>Perangkat</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: 22 }}>
                      Tidak ada baris audit yang cocok.
                    </td>
                  </tr>
                )}
                {filtered.map((l, i) => (
                  <tr
                    key={l.id}
                    onClick={() => setCursor(i)}
                    style={{
                      cursor: 'pointer',
                      background: i === cursor ? '#eef2ff' : undefined,
                    }}
                  >
                    <td style={{ fontSize: 10.5 }}>
                      {new Date(l.logged_at).toLocaleString('id-ID')}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 11.5 }}>{l.actor_name}</div>
                      {l.actor_sip_number && (
                        <div style={{ fontSize: 9.5, color: '#94a3b8' }}>
                          SIP {l.actor_sip_number}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-teal" style={{ fontSize: 9, fontWeight: 800 }}>
                        {l.action}
                      </span>
                    </td>
                    <td style={{ fontSize: 10.5 }}>{l.entity_type}</td>
                    <td style={{ fontSize: 10.5, fontWeight: 700 }}>{l.patient_mrn ?? '—'}</td>
                    <td style={{ fontSize: 10 }}>{l.device_platform}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              marginTop: 11,
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 9,
              padding: 11,
            }}
          >
            <AlertTriangle size={14} color="#b45309" style={{ marginTop: 1, flexShrink: 0 }} />
            <div style={{ fontSize: 10.5, color: '#92400e', lineHeight: 1.65 }}>
              <strong>Jejak audit bersifat tambah-saja.</strong> Tidak ada tombol ubah atau hapus pada
              modul ini — itu disengaja. UU PDP Pasal 35 mewajibkan catatan aktivitas pemrosesan data
              pribadi dipertahankan. Bila ada baris yang terlihat keliru, tindakan yang benar adalah
              mencatat koreksi baru, bukan menghapus riwayat.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
