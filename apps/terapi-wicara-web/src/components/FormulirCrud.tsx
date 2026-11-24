'use client';

/**
 * FormulirCRUD — mesin formulir data-entry SIMKLINIK & Enterprise HQ.
 *
 * Menggantikan tampilan "papan pengumuman" (read-only) dengan aplikasi
 * manajemen sesungguhnya: daftar rekaman, pencarian, tambah, ubah, hapus,
 * navigasi baris (sebelumnya/berikutnya), cetak laporan resmi, dan ekspor CSV.
 *
 * Semua penyimpanan melewati RPC `tw_crud_save` / `tw_crud_delete` sehingga
 * tercatat pada jejak audit UU PDP & Permenkes 24/2022.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  FilePlus2,
  Filter,
  Loader2,
  Printer,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { getBrowserSupabase } from '../lib/supabaseClient';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'money'
  | 'date'
  | 'datetime'
  | 'time'
  | 'select'
  | 'boolean'
  | 'tags';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  hint?: string;
  regulation?: string;
  section?: string;
  span?: 1 | 2 | 3;
  readOnly?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
}

export interface ColumnDef {
  key: string;
  label: string;
  type?: FieldType;
  width?: string;
}

export interface FormSchema {
  table: string;
  title: string;
  subtitle?: string;
  regulation: string;
  icon?: React.ReactNode;
  fields: FieldDef[];
  columns: ColumnDef[];
  /** Kolom yang dipakai sebagai judul baris pada tabel daftar. */
  primaryField: string;
  secondaryField?: string;
  statusField?: string;
  /** Nomor dokumen otomatis, mis. INV/TW/2026/xxxx */
  autoNumber?: { field: string; prefix: string };
  defaultValues?: Record<string, string>;
}

interface Props {
  schema: FormSchema;
  actorName: string;
  actorRole: string;
  /** Data awal dari snapshot Supabase agar formulir langsung terisi. */
  bootstrapRows?: Array<Record<string, unknown>>;
  onSaved?: () => void;
}

type Mode = 'list' | 'form';

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function toInputValue(field: FieldDef, raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (field.type === 'boolean') return raw ? 'true' : 'false';
  if (field.type === 'tags') return Array.isArray(raw) ? raw.join(', ') : String(raw);
  if (field.type === 'date') return String(raw).slice(0, 10);
  if (field.type === 'datetime') return String(raw).slice(0, 16);
  return String(raw);
}

function fromInputValue(field: FieldDef, value: string): unknown {
  if (value === '') return null;
  switch (field.type) {
    case 'number':
    case 'money':
      return Number(value.replace(/[^\d.-]/g, ''));
    case 'boolean':
      return value === 'true';
    case 'tags':
      return value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    default:
      return value;
  }
}

export default function FormulirCrud({
  schema,
  actorName,
  actorRole,
  bootstrapRows = [],
  onSaved,
}: Props) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>(bootstrapRows);
  const [mode, setMode] = useState<Mode>('list');
  const [cursor, setCursor] = useState(0);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [search, setSearch] = useState('');
  const [online, setOnline] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const notify = useCallback((kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast((t) => (t?.msg === msg ? null : t)), 5200);
  }, []);

  /* ------------------------------ Muat data ------------------------------ */
  const load = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (!sb) {
      setOnline(false);
      setRows(bootstrapRows);
      return;
    }
    try {
      const { data, error } = await sb.rpc('tw_crud_list', {
        p_table: schema.table,
        p_limit: 200,
      });
      if (!error && data?.rows) {
        setRows(data.rows as Array<Record<string, unknown>>);
        setOnline(true);
      } else {
        setRows(bootstrapRows);
        setOnline(false);
      }
    } catch {
      setRows(bootstrapRows);
      setOnline(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.table]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.table]);

  /* ------------------------- Sinkron bootstrap -------------------------- */
  useEffect(() => {
    if (bootstrapRows.length && rows.length === 0) setRows(bootstrapRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapRows]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      schema.columns.some((c) => String(r[c.key] ?? '').toLowerCase().includes(q)) ||
      String(r[schema.primaryField] ?? '').toLowerCase().includes(q)
    );
  }, [rows, search, schema.columns, schema.primaryField]);

  const emptyDraft = useCallback((): Record<string, string> => {
    const base: Record<string, string> = {};
    for (const f of schema.fields) base[f.key] = schema.defaultValues?.[f.key] ?? '';
    if (schema.autoNumber) {
      base[schema.autoNumber.field] = `${schema.autoNumber.prefix}${String(
        Math.floor(1000 + Math.random() * 8999)
      )}`;
    }
    for (const f of schema.fields) {
      if (f.type === 'date' && !base[f.key] && f.key.includes('date')) {
        base[f.key] = new Date().toISOString().slice(0, 10);
      }
    }
    return base;
  }, [schema]);

  const rowToDraft = useCallback(
    (row: Record<string, unknown>): Record<string, string> => {
      const out: Record<string, string> = {};
      for (const f of schema.fields) out[f.key] = toInputValue(f, row[f.key]);
      return out;
    },
    [schema.fields]
  );

  function startCreate() {
    setDraft(emptyDraft());
    setDirty(false);
    setMode('form');
  }

  function startEdit(index: number) {
    const row = filtered[index];
    if (!row) return;
    setCursor(index);
    setDraft(rowToDraft(row));
    setDirty(false);
    setMode('form');
  }

  function patch(key: string, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }

  /* ------------------------------- Simpan ------------------------------- */
  async function save() {
    const missing = schema.fields.filter((f) => f.required && !draft[f.key]?.trim());
    if (missing.length) {
      notify('err', `Wajib diisi: ${missing.map((m) => m.label).join(', ')}`);
      return;
    }

    const current = filtered[cursor];
    const payload: Record<string, unknown> = {};
    for (const f of schema.fields) {
      if (f.readOnly) continue;
      const v = fromInputValue(f, draft[f.key] ?? '');
      if (v !== null && v !== '') payload[f.key] = v;
    }
    if (current?.id && mode === 'form' && draft.__existing === 'true') {
      payload.id = current.id;
    }

    setBusy(true);
    const sb = getBrowserSupabase();
    if (!sb) {
      // Mode lokal: simulasikan penyimpanan agar alur kerja tetap dapat diuji
      const localRow = { ...payload, id: String(payload.id ?? `lokal-${Date.now()}`) };
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.id === localRow.id);
        if (idx >= 0) {
          const clone = [...prev];
          clone[idx] = { ...clone[idx], ...localRow };
          return clone;
        }
        return [localRow, ...prev];
      });
      notify('ok', 'Tersimpan pada mode lokal (Supabase belum terkonfigurasi). Hubungkan .env.local untuk sinkron cloud.');
      setBusy(false);
      setDirty(false);
      setMode('list');
      return;
    }

    try {
      const { data, error } = await sb.rpc('tw_crud_save', {
        p_table: schema.table,
        p_payload: payload,
        p_actor_name: actorName,
        p_actor_role: actorRole,
        p_reason: payload.id ? 'UBAH_FORMULIR' : 'ENTRI_FORMULIR_BARU',
      });
      if (error) throw new Error(error.message);
      notify('ok', `Berhasil disimpan (${data?.action}). Jejak audit tercatat.`);
      setDirty(false);
      setMode('list');
      await load();
      onSaved?.();
    } catch (e) {
      notify('err', `Gagal menyimpan: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  /* ------------------------------- Hapus -------------------------------- */
  async function remove(row: Record<string, unknown>) {
    const label = String(row[schema.primaryField] ?? 'rekaman ini');
    if (!window.confirm(`Hapus "${label}"? Tindakan ini tercatat pada jejak audit dan tidak dapat dibatalkan.`))
      return;

    setBusy(true);
    const sb = getBrowserSupabase();
    if (!sb) {
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      notify('ok', 'Dihapus pada mode lokal.');
      setBusy(false);
      return;
    }
    try {
      const { error } = await sb.rpc('tw_crud_delete', {
        p_table: schema.table,
        p_id: String(row.id),
        p_actor_name: actorName,
        p_reason: 'HAPUS_FORMULIR',
      });
      if (error) throw new Error(error.message);
      notify('ok', 'Rekaman dihapus. Snapshot disimpan pada audit log.');
      await load();
      onSaved?.();
    } catch (e) {
      notify('err', `Gagal menghapus: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  /* ------------------------------- Cetak -------------------------------- */
  const currentRow = filtered[cursor];

  function printDoc() {
    const data = mode === 'form' ? draft : currentRow;
    if (!data) {
      notify('err', 'Tidak ada data untuk dicetak.');
      return;
    }
    const win = window.open('', '_blank', 'width=900,height=760');
    if (!win) {
      notify('err', 'Popup diblokir browser. Izinkan popup untuk mencetak.');
      return;
    }
    const rowsHtml = schema.fields
      .map((f) => {
        const raw = mode === 'form' ? draft[f.key] : toInputValue(f, (data as Record<string, unknown>)[f.key]);
        const shown =
          f.type === 'money' && raw ? money.format(Number(String(raw).replace(/[^\d]/g, ''))) : raw || '—';
        return `<tr><th>${f.label}</th><td>${String(shown)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')}</td></tr>`;
      })
      .join('');

    win.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8">
      <title>${schema.title} — Cetak Resmi</title>
      <style>
        body{font-family:'Segoe UI',Arial,sans-serif;padding:36px;color:#0f172a;font-size:12px}
        h1{font-size:17px;margin:0 0 2px}
        .sub{color:#475569;font-size:11.5px;margin-bottom:4px}
        .reg{color:#0f766e;font-size:11px;font-weight:700;margin-bottom:16px}
        .clinic{border-bottom:2.5px solid #0f766e;padding-bottom:10px;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{border:1px solid #cbd5e1;padding:7px 9px;text-align:left;vertical-align:top}
        th{background:#f1f5f9;width:34%;font-weight:700;font-size:11.5px}
        td{font-size:11.5px}
        .foot{margin-top:28px;display:flex;justify-content:space-between;font-size:11px}
        .sign{text-align:center;width:210px}
        .line{margin-top:52px;border-top:1px solid #0f172a;padding-top:4px}
        .audit{margin-top:18px;font-size:10px;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px}
        @media print{body{padding:16px}}
      </style></head><body>
      <div class="clinic">
        <h1>KLINIK UTAMA REHABILITASI MEDIK &amp; TERAPI WICARA WICARASEHAT</h1>
        <div class="sub">Jl. Jaksa Agung Suprapto No. 24, Mojoroto, Kota Kediri, Jawa Timur • (0354) 689420</div>
        <div class="sub">Izin Operasional: 503/442.8/SIP-KLN/DINKES-KDR/2025 • NIB: 9120300492817 • Fasyankes: 3571042001</div>
      </div>
      <h1>${schema.title}</h1>
      <div class="sub">${schema.subtitle ?? ''}</div>
      <div class="reg">Dasar regulasi: ${schema.regulation}</div>
      <table>${rowsHtml}</table>
      <div class="foot">
        <div class="sign">Petugas / Penanggung Jawab<div class="line">${actorName}</div></div>
        <div class="sign">Kepala Klinik / Dokter PJ<div class="line">dr. Ratna Kusumawati, Sp.KFR</div></div>
      </div>
      <div class="audit">
        Dokumen ini dihasilkan dari Sistem Informasi Klinik (SIMKLINIK) pada ${new Date().toLocaleString('id-ID')}.
        Setiap entri dan perubahan tercatat pada jejak audit elektronik sesuai Permenkes No. 24 Tahun 2022 dan
        UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.
      </div>
      <script>window.onload=function(){window.print()}</script>
      </body></html>`);
    win.document.close();
  }

  function exportCsv() {
    const cols = schema.columns;
    const header = cols.map((c) => `"${c.label}"`).join(',');
    const body = filtered
      .map((r) =>
        cols
          .map((c) => {
            const v = r[c.key];
            const text = Array.isArray(v) ? v.join('; ') : v === null || v === undefined ? '' : String(v);
            return `"${text.replace(/"/g, '""')}"`;
          })
          .join(',')
      )
      .join('\n');
    const blob = new Blob([`\uFEFF${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${schema.table}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify('ok', `Diekspor ${filtered.length} baris ke CSV.`);
  }

  /* ------------------------------ Render UI ----------------------------- */
  const sectioned = useMemo(() => {
    const groups = new Map<string, FieldDef[]>();
    for (const f of schema.fields) {
      const key = f.section ?? 'Data Utama';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(f);
    }
    return Array.from(groups.entries());
  }, [schema.fields]);

  return (
    <div className="crud-shell">
      {/* Header modul */}
      <div className="crud-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="crud-head-icon">{schema.icon}</div>
          <div>
            <h2 className="crud-title">{schema.title}</h2>
            <p className="crud-sub">{schema.subtitle}</p>
            <span className="crud-reg">{schema.regulation}</span>
          </div>
        </div>
        <div className="crud-head-actions">
          <span className={`badge ${online ? 'badge-green' : 'badge-amber'}`}>
            {online ? 'Tersinkron Supabase' : 'Mode Lokal'}
          </span>
          <button className="btn btn-outline" onClick={() => void load()} title="Muat ulang data">
            <RefreshCw size={14} /> Muat Ulang
          </button>
          <button className="btn btn-outline" onClick={exportCsv} title="Ekspor CSV">
            <Download size={14} /> CSV
          </button>
          <button className="btn btn-primary" onClick={startCreate}>
            <FilePlus2 size={14} /> Entri Baru
          </button>
        </div>
      </div>

      {toast && (
        <div className={`crud-toast ${toast.kind === 'ok' ? 'crud-toast-ok' : 'crud-toast-err'}`}>
          {toast.kind === 'ok' ? <Save size={14} /> : <AlertTriangle size={14} />}
          {toast.msg}
          <button onClick={() => setToast(null)} className="crud-toast-x" aria-label="Tutup">
            <X size={13} />
          </button>
        </div>
      )}

      {mode === 'list' ? (
        <>
          {/* Toolbar navigasi daftar */}
          <div className="crud-toolbar">
            <div className="crud-search">
              <Search size={14} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Cari pada ${schema.title.toLowerCase()}…`}
                aria-label="Pencarian"
              />
            </div>
            <div className="crud-nav">
              <span className="crud-count">
                <Filter size={12} /> {filtered.length} rekaman
              </span>
              <button
                className="btn btn-outline crud-navbtn"
                disabled={cursor <= 0}
                onClick={() => setCursor((c) => Math.max(0, c - 1))}
                title="Rekaman sebelumnya"
              >
                <ChevronLeft size={14} /> Sebelumnya
              </button>
              <span className="crud-pos">
                {filtered.length ? cursor + 1 : 0} / {filtered.length}
              </span>
              <button
                className="btn btn-outline crud-navbtn"
                disabled={cursor >= filtered.length - 1}
                onClick={() => setCursor((c) => Math.min(filtered.length - 1, c + 1))}
                title="Rekaman berikutnya"
              >
                Berikutnya <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Tabel daftar */}
          <div className="crud-table-wrap">
            <table className="data-table crud-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  {schema.columns.map((c) => (
                    <th key={c.key} style={{ width: c.width }}>
                      {c.label}
                    </th>
                  ))}
                  <th style={{ width: 168 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={schema.columns.length + 2} className="crud-empty">
                      Belum ada rekaman. Klik <strong>Entri Baru</strong> untuk menambahkan data pertama.
                    </td>
                  </tr>
                )}
                {filtered.map((row, i) => (
                  <tr
                    key={String(row.id ?? i)}
                    className={i === cursor ? 'crud-row-active' : undefined}
                    onClick={() => setCursor(i)}
                  >
                    <td style={{ color: '#94a3b8', fontWeight: 700 }}>{i + 1}</td>
                    {schema.columns.map((c) => {
                      const raw = row[c.key];
                      let display: React.ReactNode = '—';
                      if (raw !== null && raw !== undefined && raw !== '') {
                        if (c.type === 'money') display = money.format(Number(raw));
                        else if (c.type === 'boolean') display = raw ? 'Ya' : 'Tidak';
                        else if (Array.isArray(raw)) display = raw.join(', ');
                        else if (c.type === 'date') display = String(raw).slice(0, 10);
                        else if (c.type === 'datetime') display = new Date(String(raw)).toLocaleString('id-ID');
                        else display = String(raw);
                      }
                      return (
                        <td key={c.key}>
                          {c.key === schema.primaryField ? (
                            <div>
                              <div style={{ fontWeight: 700 }}>{display}</div>
                              {schema.secondaryField && row[schema.secondaryField] ? (
                                <div style={{ fontSize: 11, color: '#64748b' }}>
                                  {String(row[schema.secondaryField])}
                                </div>
                              ) : null}
                            </div>
                          ) : c.key === schema.statusField ? (
                            <span className="badge badge-teal">{String(display)}</span>
                          ) : (
                            display
                          )}
                        </td>
                      );
                    })}
                    <td>
                      <div className="crud-actions">
                        <button
                          className="btn btn-outline crud-act"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(i);
                          }}
                          title="Ubah rekaman"
                        >
                          <Save size={12} /> Ubah
                        </button>
                        <button
                          className="btn btn-outline crud-act crud-act-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            void remove(row);
                          }}
                          title="Hapus rekaman"
                        >
                          <Trash2 size={12} /> Hapus
                        </button>
                        <button
                          className="btn btn-outline crud-act"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCursor(i);
                            setTimeout(printDoc, 80);
                          }}
                          title="Cetak rekaman ini"
                        >
                          <Printer size={12} /> Cetak
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* ------------------------------ FORMULIR ----------------------------- */
        <div className="crud-form-wrap">
          <div className="crud-form-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={`badge ${draft.id || currentRow?.id ? 'badge-amber' : 'badge-teal'}`}>
                {draft.id || (mode === 'form' && currentRow?.id) ? 'Mode Ubah Data' : 'Mode Entri Baru'}
              </span>
              {dirty && <span className="crud-dirty">● Ada perubahan belum disimpan</span>}
            </div>
            <div className="crud-nav">
              <button
                className="btn btn-outline"
                disabled={cursor <= 0}
                onClick={() => {
                  const prev = Math.max(0, cursor - 1);
                  setCursor(prev);
                  setDraft(rowToDraft(filtered[prev] ?? {}));
                  setDirty(false);
                }}
              >
                <ChevronLeft size={14} /> Sebelumnya
              </button>
              <button
                className="btn btn-outline"
                disabled={cursor >= filtered.length - 1}
                onClick={() => {
                  const next = Math.min(filtered.length - 1, cursor + 1);
                  setCursor(next);
                  setDraft(rowToDraft(filtered[next] ?? {}));
                  setDirty(false);
                }}
              >
                Berikutnya <ChevronRight size={14} />
              </button>
              <button className="btn btn-outline" onClick={printDoc}>
                <Printer size={14} /> Cetak
              </button>
              <button
                className="btn btn-outline"
                onClick={() => {
                  if (dirty && !window.confirm('Perubahan belum disimpan. Tinggalkan formulir?')) return;
                  setMode('list');
                  setDirty(false);
                }}
              >
                <X size={14} /> Batal
              </button>
              <button className="btn btn-primary" onClick={() => void save()} disabled={busy}>
                {busy ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Simpan
              </button>
            </div>
          </div>

          <div ref={printRef} className="crud-form-body">
            {sectioned.map(([section, fields]) => (
              <fieldset key={section} className="crud-fieldset">
                <legend>{section}</legend>
                <div className="crud-grid">
                  {fields.map((f) => {
                    const value = draft[f.key] ?? '';
                    const span = f.span ?? (f.type === 'textarea' ? 3 : 1);
                    return (
                      <div key={f.key} className={`crud-field crud-span-${span}`}>
                        <label htmlFor={`f-${f.key}`}>
                          {f.label}
                          {f.required && <span className="crud-req">*</span>}
                        </label>

                        {f.type === 'textarea' ? (
                          <textarea
                            id={`f-${f.key}`}
                            rows={3}
                            value={value}
                            maxLength={f.maxLength}
                            placeholder={f.placeholder}
                            onChange={(e) => patch(f.key, e.target.value)}
                          />
                        ) : f.type === 'select' ? (
                          <select
                            id={`f-${f.key}`}
                            value={value}
                            onChange={(e) => patch(f.key, e.target.value)}
                          >
                            <option value="">— Pilih —</option>
                            {f.options?.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : f.type === 'boolean' ? (
                          <select
                            id={`f-${f.key}`}
                            value={value || 'false'}
                            onChange={(e) => patch(f.key, e.target.value)}
                          >
                            <option value="true">Ya</option>
                            <option value="false">Tidak</option>
                          </select>
                        ) : (
                          <input
                            id={`f-${f.key}`}
                            type={
                              f.type === 'number' || f.type === 'money'
                                ? 'number'
                                : f.type === 'date'
                                ? 'date'
                                : f.type === 'datetime'
                                ? 'datetime-local'
                                : f.type === 'time'
                                ? 'time'
                                : 'text'
                            }
                            value={value}
                            readOnly={f.readOnly}
                            placeholder={f.placeholder}
                            maxLength={f.maxLength}
                            min={f.min}
                            max={f.max}
                            onChange={(e) => patch(f.key, e.target.value)}
                          />
                        )}

                        {f.hint && <small className="crud-hint">{f.hint}</small>}
                        {f.regulation && <small className="crud-freg">{f.regulation}</small>}
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          <div className="crud-form-foot">
            <span>
              Petugas: <strong>{actorName}</strong> • Peran: <strong>{actorRole}</strong>
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-outline"
                onClick={() => {
                  setDraft(emptyDraft());
                  setDirty(true);
                }}
              >
                <FilePlus2 size={14} /> Kosongkan Form
              </button>
              <button className="btn btn-primary" onClick={() => void save()} disabled={busy}>
                {busy ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Simpan Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
