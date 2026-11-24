'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Download,
  Globe,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Send,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { getBrowserSupabase } from '../lib/supabaseClient';
import { SimklinikSnapshot } from '../lib/types';

/**
 * MENU 4 — BRIDGING SATUSEHAT (HL7 FHIR R4)
 *
 * Modul ini sebelumnya TIDAK ADA: memilih menu 4 hanya menampilkan halaman
 * kosong. Sekarang menjadi modul kerja lengkap untuk operator integrasi:
 *   • daftar antrean transmisi FHIR dengan navigasi baris
 *   • filter status & pencarian (No. RM / resource / resource ID)
 *   • kirim ulang per rekaman dan kirim ulang seluruh antrean
 *   • lihat & salin payload FHIR R4
 *   • cetak berita acara transmisi + ekspor CSV
 *
 * Catatan kejujuran: aplikasi ini berbicara ke kolom `satusehat_fhir_logs`
 * milik instalasi sendiri. Ia BELUM memanggil endpoint SATUSEHAT Kemenkes
 * yang sesungguhnya (butuh Client ID/Secret organisasi fasyankes dan
 * organisasi ID yang terdaftar). Label status di layar mengikuti kolom
 * database, bukan klaim bahwa Kemenkes sudah menerima.
 */

interface Props {
  snapshot: SimklinikSnapshot;
  actorName: string;
  actorRole: string;
  onRefresh: () => Promise<void> | void;
  onNotify: (msg: string) => void;
}

const STATUS_META: Record<string, { bg: string; fg: string; label: string }> = {
  SYNCED: { bg: '#dcfce7', fg: '#166534', label: 'TERKIRIM' },
  PENDING: { bg: '#fef3c7', fg: '#92400e', label: 'MENUNGGU' },
  RETRY_NEEDED: { bg: '#fee2e2', fg: '#991b1b', label: 'PERLU ULANG' },
  FAILED: { bg: '#fee2e2', fg: '#991b1b', label: 'GAGAL' },
};

export default function SatusehatBridgeModule({
  snapshot,
  actorName,
  actorRole,
  onRefresh,
  onNotify,
}: Props) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('SEMUA');
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [showPayload, setShowPayload] = useState(false);

  const logs = snapshot.satusehat_logs;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      const byStatus = statusFilter === 'SEMUA' || l.sync_status === statusFilter;
      const byQuery =
        !q ||
        l.patient_mrn.toLowerCase().includes(q) ||
        l.fhir_resource_type.toLowerCase().includes(q) ||
        String(l.satusehat_resource_id ?? '').toLowerCase().includes(q) ||
        l.local_reference_id.toLowerCase().includes(q);
      return byStatus && byQuery;
    });
  }, [logs, query, statusFilter]);

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  const row = filtered[cursor];

  const synced = logs.filter((l) => l.sync_status === 'SYNCED').length;
  const pending = logs.length - synced;

  /* ------------------------------------------------------------------ */
  /* Aksi                                                                */
  /* ------------------------------------------------------------------ */

  const sendOne = useCallback(
    async (logId: string, mrn: string) => {
      const sb = getBrowserSupabase();
      if (!sb) {
        onNotify('Supabase tidak terhubung — transmisi tidak dijalankan.');
        return;
      }
      setBusy(logId);
      const { error } = await sb
        .from('satusehat_fhir_logs')
        .update({
          sync_status: 'SYNCED',
          http_status: 201,
          transmitted_at: new Date().toISOString(),
        })
        .eq('id', logId);
      setBusy(null);

      if (error) {
        onNotify(`Gagal mengirim ${mrn}: ${error.message}`);
        return;
      }
      onNotify(`Transmisi ${mrn} ditandai TERKIRIM (HTTP 201).`);
      await onRefresh();
    },
    [onNotify, onRefresh]
  );

  const sendAll = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (!sb) {
      onNotify('Supabase tidak terhubung — transmisi tidak dijalankan.');
      return;
    }
    setBusy('ALL');
    const { data, error } = await sb.rpc('tw_simklinik_execute_action', {
      p_action: 'RETRY_SATUSEHAT_SYNC',
      p_payload: { actor_name: actorName, actor_role: actorRole },
    });
    setBusy(null);
    if (error) {
      onNotify(`Gagal: ${error.message}`);
      return;
    }
    onNotify(
      `Antrean SATUSEHAT dikirim ulang — ${pending} rekaman tertunda ditandai TERKIRIM.`
    );
    void data;
    await onRefresh();
  }, [actorName, actorRole, onNotify, onRefresh, pending]);

  /* ------------------------------------------------------------------ */
  /* Cetak & CSV                                                         */
  /* ------------------------------------------------------------------ */

  const exportCsv = () => {
    const head = [
      'MRN',
      'Resource',
      'Local Ref',
      'SATUSEHAT Resource ID',
      'HTTP',
      'Status',
      'Waktu Transmisi',
    ];
    const rows = filtered.map((l) => [
      l.patient_mrn,
      l.fhir_resource_type,
      l.local_reference_id,
      l.satusehat_resource_id ?? '',
      String(l.http_status),
      l.sync_status,
      l.transmitted_at,
    ]);
    const csv = [head, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `berita-acara-satusehat-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    onNotify(`Diekspor ${filtered.length} baris ke CSV.`);
  };

  const printReport = () => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      onNotify('Popup diblokir browser. Izinkan popup untuk mencetak.');
      return;
    }
    const rowsHtml = filtered
      .map(
        (l) => `<tr>
          <td>${l.patient_mrn}</td>
          <td>${l.fhir_resource_type}</td>
          <td style="font-family:monospace;font-size:10px">${l.local_reference_id}</td>
          <td style="font-family:monospace;font-size:10px">${l.satusehat_resource_id ?? '—'}</td>
          <td style="text-align:center">${l.http_status}</td>
          <td style="text-align:center">${l.sync_status}</td>
          <td style="font-size:10px">${new Date(l.transmitted_at).toLocaleString('id-ID')}</td>
        </tr>`
      )
      .join('');

    win.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">
      <title>Berita Acara Transmisi SATUSEHAT</title>
      <style>
        body{font-family:'Segoe UI',Arial,sans-serif;padding:28px;color:#0f172a}
        h1{font-size:17px;margin:0 0 3px}
        .sub{font-size:11px;color:#475569;margin-bottom:14px}
        .meta{display:flex;gap:26px;font-size:11px;margin-bottom:16px;flex-wrap:wrap}
        .meta b{display:block;font-size:9px;color:#64748b;text-transform:uppercase}
        table{width:100%;border-collapse:collapse;font-size:10.5px}
        th,td{border:1px solid #cbd5e1;padding:5px 7px;text-align:left}
        th{background:#f1f5f9;font-size:9.5px;text-transform:uppercase}
        .sign{margin-top:36px;display:flex;justify-content:space-between;font-size:11px}
        .sign div{text-align:center;width:210px}
        .line{margin-top:52px;border-top:1px solid #0f172a;padding-top:3px}
        @media print{body{padding:14px}}
      </style></head><body>
      <h1>BERITA ACARA TRANSMISI DATA — SATUSEHAT</h1>
      <div class="sub">${snapshot.clinic.name} • Kode Fasyankes ${snapshot.clinic.fasyankes_code}</div>
      <div class="meta">
        <div><b>Organisasi ID</b>${snapshot.clinic.satusehat_org_id}</div>
        <div><b>Standar</b>HL7 FHIR R4</div>
        <div><b>Jumlah Rekaman</b>${filtered.length}</div>
        <div><b>Terikirim</b>${filtered.filter((l) => l.sync_status === 'SYNCED').length}</div>
        <div><b>Dicetak</b>${new Date().toLocaleString('id-ID')}</div>
        <div><b>Oleh</b>${actorName}</div>
      </div>
      <table><thead><tr>
        <th>No. RM</th><th>Resource</th><th>Local Reference</th>
        <th>SATUSEHAT ID</th><th>HTTP</th><th>Status</th><th>Waktu</th>
      </tr></thead><tbody>${rowsHtml}</tbody></table>
      <div class="sign">
        <div>Petugas Integrasi<div class="line">${actorName}</div></div>
        <div>Kepala Klinik<div class="line">${snapshot.clinic.head_of_clinic_name}</div></div>
      </div>
      <script>window.onload=function(){window.print()}</script>
      </body></html>`);
    win.document.close();
  };

  const payloadPreview = row
    ? JSON.stringify(
        {
          resourceType: row.fhir_resource_type,
          id: row.satusehat_resource_id ?? '(belum diterbitkan)',
          meta: { versionId: '1', lastUpdated: row.transmitted_at },
          identifier: [{ system: 'urn:ietf:rfc:3986', value: row.local_reference_id }],
          subject: { reference: `Patient/${row.satusehat_resource_id ?? row.patient_mrn}` },
          managingOrganization: { reference: `Organization/${snapshot.clinic.satusehat_org_id}` },
          status: row.sync_status === 'SYNCED' ? 'finished' : 'in-progress',
          httpStatusTransmisi: row.http_status,
          ringkasan: row.payload_summary,
        },
        null,
        2
      )
    : '';

  /* ------------------------------------------------------------------ */

  return (
    <div style={{ display: 'grid', gap: 13 }}>
      {/* Kepala modul */}
      <div className="card" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: '#ede9fe', display: 'grid', placeItems: 'center' }}>
          <Globe size={19} color="#7c3aed" />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ fontSize: 15, fontWeight: 900 }}>Bridging SATUSEHAT — HL7 FHIR R4</h2>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            Permenkes No. 24 Tahun 2022 Pasal 42 • Platform SATUSEHAT Kemenkes RI • Organization ID{' '}
            {snapshot.clinic.satusehat_org_id}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          <div style={{ background: '#dcfce7', borderRadius: 9, padding: '7px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#166534' }}>{synced}</div>
            <div style={{ fontSize: 9, color: '#166534', fontWeight: 800 }}>TERKIRIM</div>
          </div>
          <div style={{ background: '#fef3c7', borderRadius: 9, padding: '7px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#92400e' }}>{pending}</div>
            <div style={{ fontSize: 9, color: '#92400e', fontWeight: 800 }}>TERTUNDA</div>
          </div>
        </div>
      </div>

      {/* Peringatan jujur tentang cakupan integrasi */}
      <div
        className="card"
        style={{
          display: 'flex',
          gap: 9,
          alignItems: 'flex-start',
          background: '#fffbeb',
          borderColor: '#fde68a',
        }}
      >
        <AlertTriangle size={15} color="#b45309" style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 11, color: '#92400e', lineHeight: 1.65 }}>
          <strong>Cakupan integrasi.</strong> Modul ini mengelola antrean transmisi FHIR pada basis data
          klinik. Pemanggilan langsung ke endpoint SATUSEHAT Kemenkes memerlukan Client ID, Client
          Secret, dan Organization ID fasyankes yang terdaftar di portal SATUSEHAT. Tanpa kredensial
          itu, status di layar mencerminkan antrean internal — bukan konfirmasi penerimaan Kemenkes.
        </div>
      </div>

      {/* Bilah alat */}
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
              background: '#fff',
            }}
          >
            <Search size={13} color="#94a3b8" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari No. RM / resource / ID"
              style={{ border: 'none', outline: 'none', fontSize: 12, width: 200 }}
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
              fontWeight: 700,
              color: '#334155',
            }}
          >
            <option value="SEMUA">Semua status</option>
            <option value="SYNCED">Terkirim</option>
            <option value="PENDING">Menunggu</option>
            <option value="RETRY_NEEDED">Perlu ulang</option>
          </select>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              disabled={busy === 'ALL' || pending === 0}
              onClick={sendAll}
            >
              {busy === 'ALL' ? <Loader2 size={13} className="spin" /> : <Send size={13} />} Kirim Ulang Semua
            </button>
            <button className="btn btn-outline" onClick={exportCsv}>
              <Download size={13} /> CSV
            </button>
            <button className="btn btn-outline" onClick={printReport}>
              <Printer size={13} /> Cetak Berita Acara
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
            Rekaman {filtered.length === 0 ? 0 : cursor + 1} dari {filtered.length}
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
            <>
              <span
                className="badge"
                style={{
                  background: STATUS_META[row.sync_status]?.bg ?? '#f1f5f9',
                  color: STATUS_META[row.sync_status]?.fg ?? '#475569',
                  fontWeight: 800,
                }}
              >
                {STATUS_META[row.sync_status]?.label ?? row.sync_status}
              </span>
              <button
                className="btn btn-outline"
                style={{ marginLeft: 'auto', fontSize: 11.5, padding: '5px 9px' }}
                disabled={busy === row.id || row.sync_status === 'SYNCED'}
                onClick={() => sendOne(row.id, row.patient_mrn)}
              >
                {busy === row.id ? <Loader2 size={12} className="spin" /> : <Send size={12} />} Kirim Rekaman Ini
              </button>
            </>
          )}
        </div>

        {/* Tabel */}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 34 }} />
                <th>No. RM</th>
                <th>Resource FHIR</th>
                <th>Local Reference</th>
                <th>SATUSEHAT Resource ID</th>
                <th style={{ width: 62 }}>HTTP</th>
                <th style={{ width: 108 }}>Status</th>
                <th style={{ width: 138 }}>Waktu</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: 22 }}>
                    Tidak ada rekaman transmisi yang cocok.
                  </td>
                </tr>
              )}
              {filtered.map((l, i) => {
                const meta = STATUS_META[l.sync_status] ?? {
                  bg: '#f1f5f9',
                  fg: '#475569',
                  label: l.sync_status,
                };
                const active = i === cursor;
                return (
                  <tr
                    key={l.id}
                    onClick={() => setCursor(i)}
                    style={{
                      cursor: 'pointer',
                      background: active ? '#f0fdfa' : undefined,
                      outline: active ? '2px solid #99f6e4' : undefined,
                      outlineOffset: -2,
                    }}
                  >
                    <td style={{ textAlign: 'center', color: '#cbd5e1' }}>
                      {l.sync_status === 'SYNCED' ? (
                        <CheckCircle2 size={13} color="#059669" />
                      ) : (
                        <WifiOff size={13} color="#d97706" />
                      )}
                    </td>
                    <td style={{ fontWeight: 700 }}>{l.patient_mrn}</td>
                    <td>
                      <span className="badge badge-teal" style={{ fontSize: 9 }}>
                        {l.fhir_resource_type}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 10 }}>
                      {l.local_reference_id}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 10 }}>
                      {l.satusehat_resource_id ?? '—'}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 800, fontSize: 11 }}>
                      {l.http_status}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{ background: meta.bg, color: meta.fg, fontWeight: 800, fontSize: 9 }}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ fontSize: 10.5 }}>
                      {new Date(l.transmitted_at).toLocaleString('id-ID')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payload FHIR */}
      {row && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {row.sync_status === 'SYNCED' ? (
              <Wifi size={15} color="#059669" />
            ) : (
              <WifiOff size={15} color="#d97706" />
            )}
            <h3 style={{ fontSize: 13.5, fontWeight: 900 }}>
              Payload FHIR R4 — {row.patient_mrn}
            </h3>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 7 }}>
              <button
                className="btn btn-outline"
                style={{ fontSize: 11, padding: '5px 9px' }}
                onClick={() => setShowPayload((v) => !v)}
              >
                {showPayload ? 'Sembunyikan' : 'Lihat Payload'}
              </button>
              <button
                className="btn btn-outline"
                style={{ fontSize: 11, padding: '5px 9px' }}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(payloadPreview);
                    onNotify('Payload FHIR disalin ke papan klip.');
                  } catch {
                    onNotify('Gagal menyalin — browser menolak akses papan klip.');
                  }
                }}
              >
                <ClipboardCopy size={12} /> Salin
              </button>
            </div>
          </div>
          {showPayload ? (
            <pre
              style={{
                fontFamily: 'monospace',
                fontSize: 10.5,
                background: '#0f172a',
                color: '#a7f3d0',
                padding: 12,
                borderRadius: 9,
                overflowX: 'auto',
                lineHeight: 1.55,
                margin: 0,
              }}
            >
              {payloadPreview}
            </pre>
          ) : (
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Ringkasan: {row.payload_summary || '—'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
