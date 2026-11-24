'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  Brain,
  CheckCircle2,
  Cpu,
  FlaskConical,
  Gauge,
  Loader2,
  MessageSquare,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TestTube2,
  TriangleAlert,
  Wrench,
  XCircle,
} from 'lucide-react';
import { getBrowserSupabase } from '../../src/lib/supabaseClient';

/* -------------------------------------------------------------------------- */
/* Tipe data                                                                   */
/* -------------------------------------------------------------------------- */
interface Agent {
  agent_key: string;
  agent_name: string;
  role: string;
  mission: string;
  autonomy_level: string;
  trigger_mode: string;
  schedule_cron: string | null;
  is_enabled: boolean;
  health_status: string;
  total_runs: number;
  successful_runs: number;
  last_run_at: string | null;
  next_run_at?: string | null;
  /** Tambahan dari snapshot: kedalaman antrean & indikator kehidupan agen. */
  queue_depth?: number;
  success_rate?: number | null;
  last_status?: string | null;
  is_overdue?: boolean;
  silent_days?: number | null;
}

interface AgentRun {
  id: string;
  agent_key: string;
  task_type: string;
  objective: string;
  status: string;
  priority: number;
  output_summary: string | null;
  duration_ms: number | null;
  created_at: string;
}

interface TestResult {
  id: string;
  suite: string;
  test_name: string;
  category: string;
  status: string;
  severity: string;
  detail: string | null;
  created_at: string;
}

interface Finding {
  id: string;
  finding_code: string;
  title: string;
  severity: string;
  category: string;
  affected_object: string | null;
  description: string;
  recommendation: string;
  regulation_reference: string | null;
  status: string;
}

interface Gap {
  id: string;
  question_text: string;
  occurrences: number;
  status: string;
  detected_intent: string | null;
}

interface Snapshot {
  generated_at: string;
  agents: Agent[];
  runs: AgentRun[];
  knowledge: {
    total: number;
    verified: number;
    by_category: Record<string, number>;
    by_source: Record<string, number>;
    top_used: Array<{ title: string; usage: number }>;
  };
  tests: {
    total: number;
    lulus: number;
    gagal: number;
    peringatan: number;
    terbaru: TestResult[];
  };
  security_findings: Finding[];
  security_score: number;
  knowledge_gaps: Gap[];
  queue?: {
    pending: number;
    running: number;
    stale: number;
    oldest_pending_minutes: number;
  };
  totals: {
    agents_active: number;
    agents_degraded?: number;
    runs_pending: number;
    runs_done: number;
    runs_failed?: number;
    chat_messages: number;
  };
}

const AGENT_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  AGEN_SUPERVISOR: Cpu,
  AGEN_PENGETAHUAN: Brain,
  AGEN_KEAMANAN: ShieldAlert,
  AGEN_PENGUJI: TestTube2,
  AGEN_PERBAIKAN_BUG: Wrench,
  AGEN_ANALIS: Activity,
  AGEN_PENELITI: FlaskConical,
};

export default function AiCommandCenterPage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [kbQuery, setKbQuery] = useState('');
  const [kbResults, setKbResults] = useState<Array<{ title: string; content: string; category: string; regulation_reference?: string }>>([]);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 5000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const sb = getBrowserSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    try {
      const { data: res, error } = await sb.rpc('tw_ai_command_center_snapshot');
      if (!error && res) setData(res as Snapshot);
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function triggerAgent(agentKey: string, taskType: string, objective: string) {
    const sb = getBrowserSupabase();
    if (!sb) return notify('Supabase belum terkonfigurasi. Hubungkan .env.local.');
    setBusy(agentKey);
    try {
      const { error } = await sb.rpc('tw_ai_enqueue_task', {
        p_agent_key: agentKey,
        p_task_type: taskType,
        p_objective: objective,
        p_input: { requested_by: 'Operator Command Center', at: new Date().toISOString() },
        p_priority: 3,
        p_requires_approval: false,
      });
      if (error) throw new Error(error.message);
      notify(`Tugas untuk ${agentKey} berhasil diantrekan.`);
      await load();
    } catch (e) {
      notify(`Gagal: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function runKnowledgeSearch() {
    if (!kbQuery.trim()) return;
    const sb = getBrowserSupabase();
    if (!sb) return notify('Supabase belum terkonfigurasi.');
    try {
      const { data: res, error } = await sb.rpc('tw_ai_kb_search', {
        p_query: kbQuery,
        p_limit: 5,
      });
      if (error) throw new Error(error.message);
      setKbResults((res?.matches ?? []) as typeof kbResults);
    } catch (e) {
      notify(`Pencarian gagal: ${(e as Error).message}`);
    }
  }

  const score = data?.security_score ?? 0;
  const scoreColor = score >= 90 ? '#059669' : score >= 70 ? '#d97706' : '#dc2626';

  return (
    <div className="pub-container" style={{ paddingTop: 26, paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: '#0f766e', color: '#fff', display: 'grid', placeItems: 'center' }}>
            <Bot size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em' }}>Pusat Komando Multi-Agen AI</h1>
            <p style={{ fontSize: 13, color: '#64748b' }}>
              Orkestrasi otonom: keamanan sistem, pengujian berkala, regenerasi pengetahuan, perbaikan bug, analisis kinerja, dan riset daring.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/simklinik" className="btn btn-outline">
            <ArrowLeft size={14} /> SIMKLINIK
          </Link>
          <Link href="/enterprise" className="btn btn-outline">Enterprise HQ</Link>
          <button className="btn btn-primary" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Muat Ulang
          </button>
        </div>
      </div>

      {toast && (
        <div style={{ padding: '11px 15px', borderRadius: 11, background: '#dcfce7', color: '#166534', fontWeight: 700, fontSize: 12.5, marginBottom: 14 }}>
          {toast}
        </div>
      )}

      {!getBrowserSupabase() && (
        <div style={{ padding: 16, borderRadius: 12, background: '#fef3c7', color: '#92400e', fontSize: 13, marginBottom: 16 }}>
          <strong>Supabase belum terkonfigurasi.</strong> Salin <code>.env.example</code> menjadi <code>.env.local</code> lalu isi
          <code> NEXT_PUBLIC_SUPABASE_URL</code> dan <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> agar panel ini menampilkan data agen secara langsung.
        </div>
      )}

      {/* KPI */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Skor Keamanan</span>
            <Gauge size={16} color={scoreColor} />
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: scoreColor, marginTop: 4 }}>{score}<span style={{ fontSize: 15 }}>/100</span></div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            {(data?.security_findings ?? []).filter((f) => f.status === 'TERBUKA').length} temuan terbuka
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Agen AI Aktif</span>
            <Cpu size={16} color="#0f766e" />
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, marginTop: 4 }}>{data?.totals.agents_active ?? 0}<span style={{ fontSize: 15, color: '#64748b' }}>/7</span></div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{data?.totals.runs_done ?? 0} tugas selesai</div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Basis Pengetahuan</span>
            <Brain size={16} color="#0f766e" />
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, marginTop: 4 }}>{data?.knowledge.total ?? 0}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{data?.knowledge.verified ?? 0} terverifikasi</div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Uji Sistem</span>
            <TestTube2 size={16} color="#0f766e" />
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, marginTop: 4 }}>{data?.tests.total ?? 0}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            {data?.tests.lulus ?? 0} lulus • {data?.tests.gagal ?? 0} gagal
          </div>
        </div>
      </div>

      {/* Status antrean & penjadwal otonom */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
          <Activity size={16} color="#0f766e" />
          <span style={{ fontWeight: 900, fontSize: 14 }}>Penjadwal Otonom</span>
          <span
            className={`badge ${
              (data?.queue?.pending ?? 0) === 0
                ? 'badge-green'
                : (data?.queue?.stale ?? 0) > 0
                ? 'badge-amber'
                : 'badge-teal'
            }`}
            style={{ marginLeft: 'auto' }}
          >
            {(data?.queue?.pending ?? 0) === 0 ? 'Antrean bersih' : `${data?.queue?.pending ?? 0} tugas menunggu`}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 700 }}>Menunggu</div>
            <div style={{ fontSize: 21, fontWeight: 900 }}>{data?.queue?.pending ?? 0}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 700 }}>Sedang Jalan</div>
            <div style={{ fontSize: 21, fontWeight: 900 }}>{data?.queue?.running ?? 0}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 700 }}>Menggantung</div>
            <div style={{ fontSize: 21, fontWeight: 900, color: (data?.queue?.stale ?? 0) > 0 ? '#b45309' : undefined }}>
              {data?.queue?.stale ?? 0}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 700 }}>Agen Degradasi</div>
            <div style={{ fontSize: 21, fontWeight: 900, color: (data?.totals?.agents_degraded ?? 0) > 0 ? '#b45309' : undefined }}>
              {data?.totals?.agents_degraded ?? 0}
            </div>
          </div>
        </div>

        <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6, marginTop: 10 }}>
          Setiap siklus, sistem mendaftarkan sendiri tugas untuk agen yang jadwalnya jatuh tempo
          (<code>tw_ai_dispatch_due</code>) dan membersihkan tugas menggantung
          (<code>tw_ai_heartbeat</code>). Agen tetap bekerja walaupun tidak ada operator yang menekan tombol.
        </p>
      </div>

      {/* Daftar agen */}
      <h2 style={{ fontSize: 16, fontWeight: 900, marginBottom: 10 }}>Regu Agen Otonom</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 12, marginBottom: 20 }}>
        {(data?.agents ?? []).map((agent) => {
          const Icon = AGENT_ICONS[agent.agent_key] ?? Bot;
          const healthOk = agent.health_status === 'SEHAT';
          return (
            <div key={agent.agent_key} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: '#f0fdfa', color: '#0f766e', display: 'grid', placeItems: 'center' }}>
                  <Icon size={17} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{agent.agent_name}</div>
                  <div style={{ fontSize: 10.5, color: '#64748b' }}>{agent.role}</div>
                </div>
                <span className={`badge ${healthOk ? 'badge-green' : 'badge-amber'}`}>{agent.health_status}</span>
              </div>

              <p style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.55 }}>{agent.mission}</p>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10 }}>
                <span className="badge badge-teal">{agent.autonomy_level.replace('_', ' ')}</span>
                <span className="badge badge-teal">{agent.trigger_mode}</span>
                {agent.schedule_cron && <span className="badge badge-teal">cron {agent.schedule_cron}</span>}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#64748b' }}>
                <span>
                  {agent.total_runs} kali jalan • {agent.successful_runs} sukses
                  {agent.success_rate != null && ` (${agent.success_rate}%)`}
                </span>
                <span>{agent.last_run_at ? new Date(agent.last_run_at).toLocaleString('id-ID') : 'belum pernah'}</span>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 9.5 }}>
                <span className={`badge ${(agent.queue_depth ?? 0) > 0 ? 'badge-amber' : 'badge-green'}`}>
                  antrean {agent.queue_depth ?? 0}
                </span>
                {agent.last_status && (
                  <span className={`badge ${agent.last_status === 'SELESAI' ? 'badge-green' : 'badge-amber'}`}>
                    terakhir {agent.last_status}
                  </span>
                )}
                {agent.silent_days != null && agent.silent_days >= 1 && (
                  <span className="badge badge-amber">{agent.silent_days} hari senyap</span>
                )}
                {agent.is_overdue && <span className="badge badge-amber">jatuh tempo</span>}
              </div>

              <button
                className="btn btn-outline"
                style={{ fontSize: 11.5, padding: '6px 10px', marginTop: 'auto' }}
                disabled={busy === agent.agent_key}
                onClick={() =>
                  void triggerAgent(
                    agent.agent_key,
                    'TUGAS_MANUAL_OPERATOR',
                    `Operator meminta ${agent.agent_name} menjalankan siklus penuh sekarang.`
                  )
                }
              >
                {busy === agent.agent_key ? <Loader2 size={12} className="spin" /> : <Play size={12} />} Jalankan Sekarang
              </button>
            </div>
          );
        })}
      </div>

      {/* Dua kolom: temuan keamanan + uji */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 900, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
            <ShieldAlert size={16} color="#dc2626" /> Temuan Keamanan & Kepatuhan
          </h3>
          {(data?.security_findings ?? []).length === 0 && (
            <p style={{ fontSize: 12.5, color: '#64748b' }}>Belum ada temuan. Agen Keamanan akan mengisi daftar ini pada siklus berikutnya.</p>
          )}
          <div style={{ display: 'grid', gap: 9 }}>
            {(data?.security_findings ?? []).slice(0, 8).map((f) => (
              <div key={f.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <strong style={{ fontSize: 12.5 }}>{f.title}</strong>
                  <span className={`badge ${f.severity === 'KRITIS' || f.severity === 'TINGGI' ? 'badge-red' : f.severity === 'SEDANG' ? 'badge-amber' : 'badge-teal'}`}>
                    {f.severity}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{f.description}</div>
                <div style={{ fontSize: 11, color: '#0f766e', marginTop: 5, fontWeight: 700 }}>
                  <ShieldCheck size={11} style={{ verticalAlign: '-2px' }} /> {f.recommendation}
                </div>
                {f.regulation_reference && (
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{f.regulation_reference}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 900, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
            <TestTube2 size={16} color="#0f766e" /> Hasil Uji Sistem Berkala
          </h3>
          {(data?.tests.terbaru ?? []).length === 0 && (
            <p style={{ fontSize: 12.5, color: '#64748b' }}>
              Belum ada hasil uji. Klik tombol <strong>Jalankan Sekarang</strong> pada Agen Penguji untuk memulai suite pertama.
            </p>
          )}
          <div style={{ display: 'grid', gap: 7 }}>
            {(data?.tests.terbaru ?? []).slice(0, 10).map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, borderBottom: '1px solid #f1f5f9', paddingBottom: 6 }}>
                {t.status === 'LULUS' ? (
                  <CheckCircle2 size={13} color="#059669" />
                ) : t.status === 'GAGAL' ? (
                  <XCircle size={13} color="#dc2626" />
                ) : t.status === 'PERINGATAN' ? (
                  <TriangleAlert size={13} color="#d97706" />
                ) : (
                  <AlertTriangle size={13} color="#94a3b8" />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{t.test_name}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{t.suite} • {t.category}</div>
                </div>
                <span className="badge badge-teal" style={{ fontSize: 9.5 }}>{t.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Antrean tugas */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 900, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Activity size={16} color="#0f766e" /> Antrean & Riwayat Tugas Agen
        </h3>
        {(data?.runs ?? []).length === 0 ? (
          <p style={{ fontSize: 12.5, color: '#64748b' }}>Belum ada tugas. Gunakan tombol <strong>Jalankan Sekarang</strong> pada salah satu agen.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th>Agen</th>
                  <th>Jenis Tugas</th>
                  <th>Objektif</th>
                  <th>Status</th>
                  <th>Prioritas</th>
                  <th>Hasil</th>
                </tr>
              </thead>
              <tbody>
                {(data?.runs ?? []).slice(0, 15).map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 700, fontSize: 11.5 }}>{r.agent_key.replace('AGEN_', '')}</td>
                    <td style={{ fontSize: 11.5 }}>{r.task_type}</td>
                    <td style={{ fontSize: 11.5, color: '#475569' }}>{r.objective.slice(0, 80)}</td>
                    <td>
                      <span className={`badge ${r.status === 'SELESAI' ? 'badge-green' : r.status === 'GAGAL' ? 'badge-red' : r.status === 'DIKERJAKAN' ? 'badge-amber' : 'badge-teal'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 11.5 }}>{r.priority}</td>
                    <td style={{ fontSize: 11, color: '#64748b' }}>{r.output_summary ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Celah pengetahuan + pencarian KB */}
      <div className="grid-2">
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 900, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
            <MessageSquare size={16} color="#d97706" /> Celah Pengetahuan (dari AI Companion)
          </h3>
          <p style={{ fontSize: 11.5, color: '#64748b', marginBottom: 10 }}>
            Pertanyaan pengunjung yang belum terjawab. Setelah muncul 3 kali, Agen Peneliti otomatis diberi tugas riset.
          </p>
          {(data?.knowledge_gaps ?? []).length === 0 && (
            <p style={{ fontSize: 12.5, color: '#64748b' }}>Belum ada celah pengetahuan tercatat.</p>
          )}
          <div style={{ display: 'grid', gap: 7 }}>
            {(data?.knowledge_gaps ?? []).slice(0, 8).map((g) => (
              <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, borderBottom: '1px solid #f1f5f9', paddingBottom: 6 }}>
                <span>{g.question_text.slice(0, 90)}</span>
                <span className="badge badge-amber">{g.occurrences}×</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 900, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Search size={16} color="#0f766e" /> Uji Basis Pengetahuan AI Companion
          </h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              value={kbQuery}
              onChange={(e) => setKbQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void runKnowledgeSearch()}
              placeholder="mis. berapa biaya terapi dan apakah ditanggung bpjs"
              className="form-control"
              style={{ flex: 1, fontSize: 12 }}
            />
            <button className="btn btn-primary" onClick={() => void runKnowledgeSearch()}>
              <Search size={13} /> Cari
            </button>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {kbResults.map((r, i) => (
              <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 12.5 }}>{r.title}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4, lineHeight: 1.55 }}>{r.content.slice(0, 220)}…</div>
                {r.regulation_reference && (
                  <div style={{ fontSize: 10, color: '#0f766e', fontWeight: 700, marginTop: 5 }}>
                    <Sparkles size={10} style={{ verticalAlign: '-1px' }} /> {r.regulation_reference}
                  </div>
                )}
              </div>
            ))}
            {kbQuery && kbResults.length === 0 && (
              <p style={{ fontSize: 12, color: '#64748b' }}>Tidak ada kecocokan. Pertanyaan seperti ini akan dicatat sebagai celah pengetahuan.</p>
            )}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 22, textAlign: 'center' }}>
        Semua aktivitas agen tercatat dan dapat diaudit. Sesuai UU No. 27 Tahun 2022, agen tidak pernah mengekspor data pribadi pasien
        keluar sistem; analitik hanya memakai agregasi anonim.
      </p>
    </div>
  );
}
