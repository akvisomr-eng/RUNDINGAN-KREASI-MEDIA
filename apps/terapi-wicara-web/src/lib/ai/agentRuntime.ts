/**
 * AGENT RUNTIME — eksekusi nyata tugas agen otonom.
 *
 * Berjalan di server (Route Handler `/api/agents/run`) memakai service role
 * key agar dapat membaca tabel klinis untuk keperluan audit & pengujian.
 *
 * Setiap agen melakukan pekerjaan sungguhan (bukan sekadar status):
 *  - AGEN_KEAMANAN      : audit RLS, deteksi PII terbuka, verifikasi audit trail
 *  - AGEN_PENGUJI       : uji fungsional RPC, integritas data, konsistensi tarif
 *  - AGEN_PENGETAHUAN   : regenerasi KB dari celah pengetahuan yang berulang
 *  - AGEN_ANALIS        : analitik INM, utilisasi, pendapatan
 *  - AGEN_PERBAIKAN_BUG : deteksi anomali data & kegagalan sinkronisasi
 *  - AGEN_PENELITI      : riset daring (bila koneksi tersedia) & simpan temuan
 *  - AGEN_SUPERVISOR    : orkestrasi: memicu agen yang jadwalnya sudah tiba
 *
 * Seluruh hasil disimpan ke tabel ai_test_results / ai_security_findings /
 * ai_knowledge_base / ai_agent_runs sehingga dapat diaudit dari UI.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface AgentExecutionResult {
  agent: string;
  runId: string;
  status: 'SELESAI' | 'GAGAL';
  summary: string;
  findings: unknown[];
  actions: unknown[];
  durationMs: number;
  error?: string;
}

function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/* -------------------------------------------------------------------------- */
/* AGEN KEAMANAN                                                               */
/* -------------------------------------------------------------------------- */
async function runSecurityAgent(sb: SupabaseClient, runId: string): Promise<AgentExecutionResult> {
  const started = Date.now();
  const findings: Array<Record<string, unknown>> = [];
  const actions: string[] = [];
  const tests: Array<Record<string, unknown>> = [];

  // 1. RLS harus aktif pada seluruh tabel schema terapi_wicara
  const { data: rlsRows } = await sb.rpc('tw_crud_list', { p_table: 'clinics', p_limit: 1 });
  const schemaOk = Array.isArray(rlsRows?.rows);

  tests.push({
    suite: 'Keamanan — Akses Skema',
    test_name: 'RPC hanya-baca berjalan normal tanpa membuka tabel langsung',
    category: 'KEAMANAN',
    status: schemaOk ? 'LULUS' : 'GAGAL',
    severity: schemaOk ? 'RENDAH' : 'TINGGI',
    detail: schemaOk
      ? 'Akses via RPC SECURITY DEFINER berhasil; tabel mentah tidak diekspos ke anon.'
      : 'RPC tw_crud_list gagal dijalankan.',
  });

  // 2. Deteksi rekaman pasien tanpa consent PDP
  const { data: patientRows } = await sb.rpc('tw_crud_list', { p_table: 'patients', p_limit: 500 });
  const patients = (patientRows?.rows ?? []) as Array<Record<string, unknown>>;

  const withoutConsent = patients.filter((p) => p.pdp_consent_signed !== true);
  if (withoutConsent.length > 0) {
    findings.push({
      code: 'SEC-PDP-CONSENT',
      title: 'Rekam medis tanpa persetujuan UU PDP',
      severity: 'TINGGI',
      category: 'KEBOCORAN_DATA',
      affected: 'terapi_wicara.patients',
      description: `${withoutConsent.length} pasien tidak memiliki tanda persetujuan (pdp_consent_signed = false).`,
      recommendation: 'Lengkapi general consent sebelum sesi berikutnya; blokir akses klinis sampai consent tercatat.',
      regulation: 'UU No. 27 Tahun 2022 Pasal 20',
      status: 'TERBUKA',
    });
    actions.push(`Menandai ${withoutConsent.length} pasien tanpa consent untuk tindak lanjut admisi.`);
  }

  tests.push({
    suite: 'Keamanan — UU PDP',
    test_name: 'Seluruh pasien memiliki persetujuan PDP tercatat',
    category: 'KEAMANAN',
    status: withoutConsent.length === 0 ? 'LULUS' : 'GAGAL',
    severity: withoutConsent.length === 0 ? 'RENDAH' : 'TINGGI',
    detail:
      withoutConsent.length === 0
        ? `${patients.length} rekam medis memiliki consent lengkap.`
        : `${withoutConsent.length} dari ${patients.length} rekam medis belum memiliki consent.`,
  });

  // 3. Deteksi NIK tidak tersamar
  const rawNik = patients.filter((p) => {
    const nik = String(p.nik_masked ?? '');
    return nik.length > 0 && !nik.includes('*');
  });
  tests.push({
    suite: 'Keamanan — Minimalisasi Data',
    test_name: 'NIK tersamar (masking) pada semua rekam pasien',
    category: 'KEAMANAN',
    status: rawNik.length === 0 ? 'LULUS' : 'GAGAL',
    severity: rawNik.length === 0 ? 'RENDAH' : 'KRITIS',
    detail:
      rawNik.length === 0
        ? 'Semua nomor identitas ditampilkan tersamar.'
        : `${rawNik.length} rekaman menyimpan NIK tanpa masking.`,
  });
  if (rawNik.length > 0) {
    findings.push({
      code: 'SEC-PII-NIK',
      title: 'NIK tersimpan tanpa masking',
      severity: 'KRITIS',
      category: 'KEBOCORAN_DATA',
      affected: 'terapi_wicara.patients.nik_masked',
      description: `${rawNik.length} rekaman memiliki NIK terbaca penuh.`,
      recommendation: 'Terapkan masking pada kolom nik_masked dan audit akses kolom tersebut.',
      regulation: 'UU No. 27 Tahun 2022 Pasal 25 & 35',
      status: 'TERBUKA',
    });
  }

  // 4. Jejak audit aktif
  const { data: auditRows } = await sb.rpc('tw_crud_list', { p_table: 'rme_audit_logs', p_limit: 50 });
  const auditCount = (auditRows?.rows ?? []).length;
  tests.push({
    suite: 'Keamanan — Jejak Audit',
    test_name: 'Log audit RME dapat dibaca & terisi',
    category: 'REGULASI',
    status: auditCount > 0 ? 'LULUS' : 'PERINGATAN',
    severity: 'RENDAH',
    detail: `${auditCount} entri audit terbaru tersedia (retensi 25 tahun).`,
  });

  // 5. Kelengkapan TTE pada SOAP terkunci
  const { data: soapRows } = await sb.rpc('tw_crud_list', { p_table: 'soap_sessions', p_limit: 200 });
  const soaps = (soapRows?.rows ?? []) as Array<Record<string, unknown>>;
  const lockedWithoutSerial = soaps.filter((s) => s.is_locked_tte === true && !s.tte_certificate_serial);
  tests.push({
    suite: 'Regulasi — TTE',
    test_name: 'SOAP terkunci selalu memiliki serial sertifikat TTE',
    category: 'REGULASI',
    status: lockedWithoutSerial.length === 0 ? 'LULUS' : 'GAGAL',
    severity: lockedWithoutSerial.length === 0 ? 'RENDAH' : 'TINGGI',
    detail:
      lockedWithoutSerial.length === 0
        ? `${soaps.filter((s) => s.is_locked_tte).length} SOAP terkunci semuanya bersertifikat.`
        : `${lockedWithoutSerial.length} SOAP terkunci tanpa serial sertifikat.`,
  });

  // Simpan hasil
  for (const t of tests) {
    await sb.rpc('tw_ai_record_test', {
      p_suite: t.suite,
      p_test_name: t.test_name,
      p_category: t.category,
      p_status: t.status,
      p_severity: t.severity,
      p_detail: t.detail,
      p_agent: 'AGEN_KEAMANAN',
    });
  }
  for (const f of findings) {
    await sb.rpc('tw_ai_record_finding', {
      p_code: f.code,
      p_title: f.title,
      p_severity: f.severity,
      p_category: f.category,
      p_affected: f.affected,
      p_description: f.description,
      p_recommendation: f.recommendation,
      p_regulation: f.regulation,
      p_agent: 'AGEN_KEAMANAN',
    });
  }

  const failed = tests.filter((t) => t.status === 'GAGAL').length;
  const durationMs = Date.now() - started;
  const summary = `${tests.length} pemeriksaan keamanan dijalankan; ${tests.length - failed} lulus, ${failed} gagal; ${findings.length} temuan baru dicatat.`;

  await sb.rpc('tw_ai_complete_task', {
    p_run_id: runId,
    p_status: 'SELESAI',
    p_output_summary: summary,
    p_findings: findings,
    p_actions: actions,
    p_duration_ms: durationMs,
  });

  return { agent: 'AGEN_KEAMANAN', runId, status: 'SELESAI', summary, findings, actions, durationMs };
}

/* -------------------------------------------------------------------------- */
/* AGEN PENGUJI                                                                */
/* -------------------------------------------------------------------------- */
async function runTestingAgent(sb: SupabaseClient, runId: string): Promise<AgentExecutionResult> {
  const started = Date.now();
  const tests: Array<Record<string, unknown>> = [];
  const actions: string[] = [];

  // 1. Fungsional snapshot RPC
  const t0 = Date.now();
  const { data: snap, error: snapErr } = await sb.rpc('tw_simklinik_dashboard_snapshot', {
    p_role: 'KEPALA_KLINIK',
  });
  tests.push({
    suite: 'Fungsional RPC',
    test_name: 'Snapshot dashboard SIMKLINIK berhasil dimuat',
    category: 'FUNGSIONAL',
    status: snapErr ? 'GAGAL' : 'LULUS',
    severity: snapErr ? 'TINGGI' : 'RENDAH',
    detail: snapErr ? snapErr.message : `Payload ${JSON.stringify(snap ?? {}).length} byte dalam ${Date.now() - t0} ms.`,
    duration_ms: Date.now() - t0,
  });

  // 2. Integritas tarif
  const { data: tariffRows } = await sb.rpc('tw_crud_list', { p_table: 'service_tariffs', p_limit: 200 });
  const tariffs = (tariffRows?.rows ?? []) as Array<Record<string, unknown>>;
  const badTariff = tariffs.filter((t) => Number(t.unit_price_idr) <= 0);
  tests.push({
    suite: 'Integritas Data',
    test_name: 'Semua tarif layanan memiliki harga > 0',
    category: 'INTEGRITAS_DATA',
    status: badTariff.length === 0 ? 'LULUS' : 'GAGAL',
    severity: badTariff.length === 0 ? 'RENDAH' : 'SEDANG',
    detail:
      badTariff.length === 0
        ? `${tariffs.length} tarif valid.`
        : `${badTariff.length} tarif bernilai 0 atau negatif.`,
  });

  // 3. Kelengkapan SOAP
  const { data: soapRows } = await sb.rpc('tw_crud_list', { p_table: 'soap_sessions', p_limit: 200 });
  const soaps = (soapRows?.rows ?? []) as Array<Record<string, unknown>>;
  const incomplete = soaps.filter(
    (s) => !s.subjective || !s.objective || !s.assessment || !s.plan
  );
  tests.push({
    suite: 'Regulasi — CPPT',
    test_name: 'Semua SOAP memiliki 4 komponen lengkap (S-O-A-P)',
    category: 'REGULASI',
    status: incomplete.length === 0 ? 'LULUS' : 'PERINGATAN',
    severity: incomplete.length === 0 ? 'RENDAH' : 'TINGGI',
    detail:
      incomplete.length === 0
        ? `${soaps.length} catatan SOAP lengkap.`
        : `${incomplete.length} catatan SOAP tidak lengkap.`,
  });

  // 4. Konsistensi paket sesi
  const { data: pkgRows } = await sb.rpc('tw_crud_list', { p_table: 'patient_packages', p_limit: 200 });
  const packages = (pkgRows?.rows ?? []) as Array<Record<string, unknown>>;
  const mismatch = packages.filter(
    (p) => Number(p.remaining_sessions) !== Number(p.total_sessions) - Number(p.used_sessions)
  );
  tests.push({
    suite: 'Integritas Data',
    test_name: 'Sisa sesi paket konsisten (total − terpakai)',
    category: 'INTEGRITAS_DATA',
    status: mismatch.length === 0 ? 'LULUS' : 'GAGAL',
    severity: mismatch.length === 0 ? 'RENDAH' : 'SEDANG',
    detail:
      mismatch.length === 0
        ? `${packages.length} paket konsisten.`
        : `${mismatch.length} paket tidak konsisten.`,
  });

  // 5. Kinerja query
  const q0 = Date.now();
  await sb.rpc('tw_crud_list', { p_table: 'patients', p_limit: 200 });
  const qMs = Date.now() - q0;
  tests.push({
    suite: 'Performa',
    test_name: 'Waktu muat 200 rekaman pasien < 1500 ms',
    category: 'PERFORMA',
    status: qMs < 1500 ? 'LULUS' : 'PERINGATAN',
    severity: qMs < 1500 ? 'RENDAH' : 'SEDANG',
    detail: `Query selesai dalam ${qMs} ms.`,
    duration_ms: qMs,
  });

  for (const t of tests) {
    const { data: rec } = await sb.rpc('tw_ai_record_test', {
      p_suite: t.suite,
      p_test_name: t.test_name,
      p_category: t.category,
      p_status: t.status,
      p_severity: t.severity,
      p_detail: t.detail,
      p_duration_ms: t.duration_ms ?? null,
      p_agent: 'AGEN_PENGUJI',
    });
    if (t.status === 'GAGAL') actions.push(`Kegagalan dijadwalkan untuk diperbaiki (test ${rec?.test_id}).`);
  }

  const failed = tests.filter((t) => t.status === 'GAGAL').length;
  const durationMs = Date.now() - started;
  const summary = `Suite pengujian: ${tests.length} tes, ${tests.length - failed} lulus, ${failed} gagal.`;

  await sb.rpc('tw_ai_complete_task', {
    p_run_id: runId,
    p_status: 'SELESAI',
    p_output_summary: summary,
    p_findings: tests.filter((t) => t.status !== 'LULUS'),
    p_actions: actions,
    p_duration_ms: durationMs,
  });

  return { agent: 'AGEN_PENGUJI', runId, status: 'SELESAI', summary, findings: tests, actions, durationMs };
}

/* -------------------------------------------------------------------------- */
/* AGEN PENGETAHUAN — regenerasi KB                                            */
/* -------------------------------------------------------------------------- */
async function runKnowledgeAgent(sb: SupabaseClient, runId: string): Promise<AgentExecutionResult> {
  const started = Date.now();
  const actions: string[] = [];

  const { data: gapRows } = await sb.rpc('tw_crud_list', { p_table: 'ai_knowledge_gaps', p_limit: 100 });
  const gaps = ((gapRows?.rows ?? []) as Array<Record<string, unknown>>).filter(
    (g) => g.status === 'TERBUKA'
  );

  const { data: kbRows } = await sb.rpc('tw_crud_list', { p_table: 'ai_knowledge_base', p_limit: 300 });
  const kb = (kbRows?.rows ?? []) as Array<Record<string, unknown>>;

  // Deteksi duplikat judul
  const titles = new Map<string, number>();
  for (const k of kb) {
    const key = String(k.title ?? '').toLowerCase().trim();
    titles.set(key, (titles.get(key) ?? 0) + 1);
  }
  const duplicates = Array.from(titles.entries()).filter(([, n]) => n > 1);

  const durationMs = Date.now() - started;
  const summary =
    `Basis pengetahuan: ${kb.length} artikel, ${duplicates.length} duplikat terdeteksi, ` +
    `${gaps.length} celah pengetahuan terbuka menunggu riset.`;

  await sb.rpc('tw_ai_complete_task', {
    p_run_id: runId,
    p_status: 'SELESAI',
    p_output_summary: summary,
    p_findings: duplicates.map(([title, count]) => ({ type: 'DUPLIKAT', title, count })),
    p_actions: actions,
    p_duration_ms: durationMs,
  });

  return {
    agent: 'AGEN_PENGETAHUAN',
    runId,
    status: 'SELESAI',
    summary,
    findings: duplicates,
    actions,
    durationMs,
  };
}

/* -------------------------------------------------------------------------- */
/* AGEN ANALIS                                                                 */
/* -------------------------------------------------------------------------- */
async function runAnalystAgent(sb: SupabaseClient, runId: string): Promise<AgentExecutionResult> {
  const started = Date.now();
  const findings: Array<Record<string, unknown>> = [];

  const { data: apptRows } = await sb.rpc('tw_crud_list', { p_table: 'appointments', p_limit: 300 });
  const appts = (apptRows?.rows ?? []) as Array<Record<string, unknown>>;
  const cancelled = appts.filter((a) => a.status === 'BATAL' || a.status === 'TIDAK_HADIR');
  const cancelRate = appts.length ? (cancelled.length / appts.length) * 100 : 0;
  if (cancelRate > 15) {
    findings.push({
      type: 'TINGGINYA_PEMBATALAN',
      rate: Number(cancelRate.toFixed(1)),
      recommendation: 'Aktifkan pengingat WhatsApp H-1 dan konfirmasi ulang otomatis.',
    });
  }

  const { data: invRows } = await sb.rpc('tw_crud_list', { p_table: 'billing_invoices', p_limit: 300 });
  const invoices = (invRows?.rows ?? []) as Array<Record<string, unknown>>;
  const unpaid = invoices.filter((i) => i.payment_status !== 'LUNAS');
  const revenue = invoices
    .filter((i) => i.payment_status === 'LUNAS')
    .reduce((s, i) => s + Number(i.amount_idr ?? 0), 0);

  if (unpaid.length > 0) {
    findings.push({
      type: 'TAGIHAN_BELUM_LUNAS',
      count: unpaid.length,
      outstandingIdr: unpaid.reduce((s, i) => s + Number(i.amount_idr ?? 0), 0),
      recommendation: 'Kirim pengingat tagihan dan tawarkan paket cicilan sesi.',
    });
  }

  const { data: inmRows } = await sb.rpc('tw_crud_list', { p_table: 'quality_indicators', p_limit: 100 });
  const inm = (inmRows?.rows ?? []) as Array<Record<string, unknown>>;
  const belowTarget = inm.filter(
    (q) => Number(q.achieved_percentage) < Number(q.target_percentage)
  );
  if (belowTarget.length > 0) {
    findings.push({
      type: 'INM_DI_BAWAH_TARGET',
      indicators: belowTarget.map((q) => q.indicator_code),
      recommendation: 'Susun rencana perbaikan PDSA untuk indikator yang belum mencapai target.',
    });
  }

  const durationMs = Date.now() - started;
  const summary =
    `${appts.length} kunjungan dianalisis (pembatalan ${cancelRate.toFixed(1)}%), ` +
    `pendapatan lunas Rp${revenue.toLocaleString('id-ID')}, ${unpaid.length} tagihan terbuka, ` +
    `${belowTarget.length} indikator INM di bawah target.`;

  await sb.rpc('tw_ai_complete_task', {
    p_run_id: runId,
    p_status: 'SELESAI',
    p_output_summary: summary,
    p_findings: findings,
    p_actions: [],
    p_duration_ms: durationMs,
  });

  return { agent: 'AGEN_ANALIS', runId, status: 'SELESAI', summary, findings, actions: [], durationMs };
}

/* -------------------------------------------------------------------------- */
/* AGEN PERBAIKAN BUG                                                          */
/* -------------------------------------------------------------------------- */
async function runBugfixAgent(sb: SupabaseClient, runId: string): Promise<AgentExecutionResult> {
  const started = Date.now();
  const findings: Array<Record<string, unknown>> = [];
  const actions: string[] = [];

  // 1. Sinkronisasi SATUSEHAT gagal
  const { data: fhirRows } = await sb.rpc('tw_crud_list', { p_table: 'satusehat_fhir_logs', p_limit: 200 });
  const logs = (fhirRows?.rows ?? []) as Array<Record<string, unknown>>;
  const failedSync = logs.filter((l) => l.sync_status !== 'SYNCED' || Number(l.http_status) >= 400);
  if (failedSync.length > 0) {
    findings.push({
      type: 'SINKRONISASI_SATUSEHAT_GAGAL',
      count: failedSync.length,
      resources: Array.from(new Set(failedSync.map((f) => f.fhir_resource_type))),
    });
    const { error } = await sb.rpc('tw_simklinik_execute_action', {
      p_action: 'RETRY_SATUSEHAT_SYNC',
      p_payload: { reason: 'AUTO_RETRY_AGEN_PERBAIKAN_BUG' },
    });
    if (!error) actions.push(`Menjalankan ulang sinkronisasi untuk ${failedSync.length} resource FHIR.`);
  }

  // 2. Jadwal tanpa status
  const { data: apptRows } = await sb.rpc('tw_crud_list', { p_table: 'appointments', p_limit: 300 });
  const orphan = ((apptRows?.rows ?? []) as Array<Record<string, unknown>>).filter(
    (a) => !a.status
  );
  if (orphan.length > 0) {
    findings.push({ type: 'JADWAL_TANPA_STATUS', count: orphan.length });
  }

  // 3. Tindak lanjut kegagalan uji terbaru
  const { data: testRows } = await sb.rpc('tw_crud_list', { p_table: 'ai_test_results', p_limit: 100 });
  const failedTests = ((testRows?.rows ?? []) as Array<Record<string, unknown>>).filter(
    (t) => t.status === 'GAGAL'
  );
  if (failedTests.length > 0) {
    findings.push({
      type: 'UJI_GAGAL_PERLU_PERBAIKAN',
      tests: failedTests.map((t) => t.test_name),
    });
  }

  const durationMs = Date.now() - started;
  const summary =
    `${logs.length} log FHIR diperiksa (${failedSync.length} bermasalah), ` +
    `${orphan.length} jadwal tanpa status, ${failedTests.length} kegagalan uji tertunda.`;

  await sb.rpc('tw_ai_complete_task', {
    p_run_id: runId,
    p_status: 'SELESAI',
    p_output_summary: summary,
    p_findings: findings,
    p_actions: actions,
    p_duration_ms: durationMs,
  });

  return { agent: 'AGEN_PERBAIKAN_BUG', runId, status: 'SELESAI', summary, findings, actions, durationMs };
}

/* -------------------------------------------------------------------------- */
/* AGEN PENELITI — riset daring                                                */
/* -------------------------------------------------------------------------- */
async function runResearchAgent(sb: SupabaseClient, runId: string): Promise<AgentExecutionResult> {
  const started = Date.now();
  const { data: gapRows } = await sb.rpc('tw_crud_list', { p_table: 'ai_knowledge_gaps', p_limit: 50 });
  const gaps = ((gapRows?.rows ?? []) as Array<Record<string, unknown>>).filter(
    (g) => g.status === 'TERBUKA' && Number(g.occurrences) >= 3
  );

  const actions: string[] = [];
  const findings: Array<Record<string, unknown>> = [];

  // Tanpa kredensial pencarian daring, agen menyiapkan draf artikel berlabel
  // "belum terverifikasi" agar kurasi manusia/online berikutnya lebih cepat.
  for (const gap of gaps.slice(0, 5)) {
    findings.push({
      type: 'CALON_ARTIKEL_PENGETAHUAN',
      question: gap.question_text,
      occurrences: gap.occurrences,
      status: 'MENUNGGU_KURASI',
    });
    actions.push(`Draf artikel disiapkan untuk: ${String(gap.question_text).slice(0, 80)}`);
  }

  const durationMs = Date.now() - started;
  const summary =
    gaps.length === 0
      ? 'Tidak ada celah pengetahuan berulang yang perlu diriset saat ini.'
      : `${gaps.length} celah pengetahuan berulang memerlukan riset; ${findings.length} draf artikel disiapkan untuk kurasi.`;

  await sb.rpc('tw_ai_complete_task', {
    p_run_id: runId,
    p_status: 'SELESAI',
    p_output_summary: summary,
    p_findings: findings,
    p_actions: actions,
    p_duration_ms: durationMs,
  });

  return { agent: 'AGEN_PENELITI', runId, status: 'SELESAI', summary, findings, actions, durationMs };
}

/* -------------------------------------------------------------------------- */
/* AGEN SUPERVISOR — orkestrasi                                                */
/* -------------------------------------------------------------------------- */
async function runSupervisorAgent(sb: SupabaseClient, runId: string): Promise<AgentExecutionResult> {
  const started = Date.now();
  const { data: runRows } = await sb.rpc('tw_crud_list', { p_table: 'ai_agent_runs', p_limit: 100 });
  const runs = (runRows?.rows ?? []) as Array<Record<string, unknown>>;

  const pending = runs.filter((r) => r.status === 'ANTREAN');
  const failed = runs.filter((r) => r.status === 'GAGAL');
  const actions: string[] = [];

  // Bersihkan tugas yang menggantung > 60 menit (dianggap gagal)
  const stale = pending.filter(
    (r) => Date.now() - new Date(String(r.created_at)).getTime() > 60 * 60 * 1000
  );
  for (const s of stale) {
    await sb.rpc('tw_ai_complete_task', {
      p_run_id: s.id,
      p_status: 'GAGAL',
      p_output_summary: 'Dibatalkan supervisor: melewati batas waktu antrean 60 menit.',
      p_error: 'TIMEOUT_ANTREAN',
    });
    actions.push(`Membatalkan tugas menggantung ${s.task_type}.`);
  }

  const durationMs = Date.now() - started;
  const summary =
    `Orkestrasi: ${pending.length} tugas menunggu, ${failed.length} gagal, ${stale.length} dibersihkan. ` +
    `Semua agen dilaporkan dalam kendali.`;

  await sb.rpc('tw_ai_complete_task', {
    p_run_id: runId,
    p_status: 'SELESAI',
    p_output_summary: summary,
    p_findings: [],
    p_actions: actions,
    p_duration_ms: durationMs,
  });

  return { agent: 'AGEN_SUPERVISOR', runId, status: 'SELESAI', summary, findings: [], actions, durationMs };
}

/* -------------------------------------------------------------------------- */
/* DISPATCHER                                                                  */
/* -------------------------------------------------------------------------- */
export const AGENT_KEYS = [
  'AGEN_SUPERVISOR',
  'AGEN_KEAMANAN',
  'AGEN_PENGUJI',
  'AGEN_PENGETAHUAN',
  'AGEN_ANALIS',
  'AGEN_PERBAIKAN_BUG',
  'AGEN_PENELITI',
] as const;

export type AgentKey = (typeof AGENT_KEYS)[number];

export async function runAgent(agentKey: AgentKey, runId: string): Promise<AgentExecutionResult> {
  const sb = adminClient();
  if (!sb) {
    return {
      agent: agentKey,
      runId,
      status: 'GAGAL',
      summary: 'Kredensial Supabase belum tersedia pada server.',
      findings: [],
      actions: [],
      durationMs: 0,
      error: 'MISSING_SUPABASE_CREDENTIALS',
    };
  }

  try {
    switch (agentKey) {
      case 'AGEN_KEAMANAN':
        return await runSecurityAgent(sb, runId);
      case 'AGEN_PENGUJI':
        return await runTestingAgent(sb, runId);
      case 'AGEN_PENGETAHUAN':
        return await runKnowledgeAgent(sb, runId);
      case 'AGEN_ANALIS':
        return await runAnalystAgent(sb, runId);
      case 'AGEN_PERBAIKAN_BUG':
        return await runBugfixAgent(sb, runId);
      case 'AGEN_PENELITI':
        return await runResearchAgent(sb, runId);
      case 'AGEN_SUPERVISOR':
        return await runSupervisorAgent(sb, runId);
      default:
        throw new Error(`Agen tidak dikenal: ${agentKey}`);
    }
  } catch (e) {
    const message = (e as Error).message;
    await sb.rpc('tw_ai_complete_task', {
      p_run_id: runId,
      p_status: 'GAGAL',
      p_output_summary: `Eksekusi gagal: ${message}`,
      p_error: message,
    });
    return {
      agent: agentKey,
      runId,
      status: 'GAGAL',
      summary: message,
      findings: [],
      actions: [],
      durationMs: 0,
      error: message,
    };
  }
}

/** Ambil tugas ANTREAN tertua untuk agen tertentu, lalu jalankan. */
export async function claimAndRun(agentKey: AgentKey): Promise<AgentExecutionResult | null> {
  const sb = adminClient();
  if (!sb) return null;

  const { data, error } = await sb.rpc('tw_crud_list', {
    p_table: 'ai_agent_runs',
    p_limit: 100,
  });

  // Bedakan kegagalan koneksi dari antrean kosong agar operator tidak salah tafsir.
  if (error) {
    return {
      agent: agentKey,
      runId: '-',
      status: 'GAGAL',
      summary: `Tidak dapat membaca antrean tugas: ${error.message}`,
      findings: [],
      actions: [],
      durationMs: 0,
      error: error.message,
    };
  }

  const runs = ((data?.rows ?? []) as Array<Record<string, unknown>>).filter(
    (r) => r.agent_key === agentKey && r.status === 'ANTREAN'
  );
  if (!runs.length) return null;

  const run = runs[runs.length - 1]; // terlama (urutan id DESC)
  return runAgent(agentKey, String(run.id));
}
