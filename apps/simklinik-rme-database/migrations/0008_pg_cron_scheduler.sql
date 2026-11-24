-- ============================================================================
-- 0008 — PENJADWAL OTONOM DI DALAM BASIS DATA (pg_cron)
-- ============================================================================
-- Sebelum ini, "otonomi" agen bergantung pada dua layanan luar:
--   • Vercel Cron     → baru aktif setelah aplikasi di-deploy.
--   • GitHub Actions  → baru aktif setelah dua secret diisi operator.
-- Jika keduanya belum dikonfigurasi, ketujuh agen tidak pernah bekerja dan
-- tidak ada satu pun indikator yang memberi tahu. Itu bukan sistem otonom.
--
-- Dengan pg_cron, basis data mendaftarkan tugas agen sendiri sesuai jadwal,
-- tanpa bergantung pada situs web yang hidup atau akun Vercel.
--
-- CATATAN PENTING (sempat menjadi jebakan):
--   Pada Supabase, pg_cron hanya mengeksekusi job yang namanya diawali nama
--   database. Job bernama 'tw_ai_dispatch_15m' terdaftar, aktif, dan tampak
--   benar di cron.job — tetapi tidak pernah dijalankan. Nama job wajib
--   diawali 'postgres-'.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Idempoten: bersihkan jadwal lama (termasuk nama tanpa prefiks yang macet).
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname LIKE '%tw_ai_%';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 1. Setiap 15 menit: daftarkan tugas bagi agen yang jadwalnya jatuh tempo.
SELECT cron.schedule(
  'postgres-tw_ai_dispatch_15m',
  '*/15 * * * *',
  $$SELECT public.tw_ai_dispatch_due(false);$$
);

-- 2. Setiap jam (menit ke-7): bersihkan tugas menggantung & tandai agen senyap.
SELECT cron.schedule(
  'postgres-tw_ai_heartbeat_hourly',
  '7 * * * *',
  $$SELECT public.tw_ai_heartbeat(120);$$
);

-- ---------------------------------------------------------------------------
-- RPC status penjadwal (dipanggil /api/health dan Pusat Komando AI)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tw_ai_scheduler_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = terapi_wicara, public AS $$
DECLARE v_jobs jsonb; v_last jsonb; v_pending int;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'jobname', jobname, 'schedule', schedule, 'active', active) ORDER BY jobname), '[]'::jsonb)
    INTO v_jobs FROM cron.job WHERE jobname LIKE '%tw_ai_%';

  SELECT jsonb_build_object(
           'jobname', j.jobname, 'status', d.status, 'ran_at', d.start_time,
           'message', left(coalesce(d.return_message,''), 160))
    INTO v_last
    FROM cron.job_run_details d JOIN cron.job j ON j.jobid = d.jobid
   WHERE j.jobname LIKE '%tw_ai_%'
   ORDER BY d.start_time DESC LIMIT 1;

  SELECT count(*) INTO v_pending FROM terapi_wicara.ai_agent_runs WHERE status='ANTREAN';

  RETURN jsonb_build_object(
    'cron_jobs', v_jobs, 'job_count', jsonb_array_length(v_jobs),
    'last_run', v_last, 'pending_tasks', v_pending);
EXCEPTION WHEN undefined_table THEN
  RETURN jsonb_build_object('cron_jobs','[]'::jsonb,'job_count',0,'last_run',NULL,
    'pending_tasks',(SELECT count(*) FROM terapi_wicara.ai_agent_runs WHERE status='ANTREAN'),
    'note','pg_cron belum aktif di proyek ini');
END; $$;

GRANT EXECUTE ON FUNCTION public.tw_ai_scheduler_status() TO anon, authenticated, service_role;
