-- ============================================================================
-- 0007 — DISPATCHER OTONOM & DENYUT NADI AGEN
-- ============================================================================
-- Latar belakang masalah yang diperbaiki:
--
--   Sebelumnya siklus agen (cron Vercel / GitHub Actions) hanya mengerjakan
--   tugas yang sudah berstatus ANTREAN. Bila tidak ada manusia menekan tombol
--   di Pusat Komando AI, semua agen menganggur — jadi "otonom" hanya di atas
--   kertas. Selain itu, bila runtime gagal total (mis. kredensial Supabase
--   hilang), tugas yang sudah diklaim tertinggal berstatus ANTREAN selamanya
--   dan tidak ada indikator bahwa agen sebenarnya tidak pernah berjalan.
--
-- Yang ditambahkan:
--   1. tw_ai_dispatch_due()      → mendaftarkan tugas otomatis untuk agen yang
--                                  jadwalnya sudah lewat (menghormati cron).
--   2. tw_ai_heartbeat()         → menandai tugas menggantung sebagai GAGAL,
--                                  menandai agen yang tidak pernah berjalan.
--   3. tw_ai_agent_health()      → ringkasan kesehatan seluruh agen.
--   4. Index antrean agar klaim tugas tetap cepat saat data bertambah.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. INDEX ANTREAN
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_claim
  ON terapi_wicara.ai_agent_runs (agent_key, status, id DESC);

CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_status_created
  ON terapi_wicara.ai_agent_runs (status, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. KEBENARAN PENJADWALAN: selaraskan kolom jadwal agen dengan niat desain
-- ---------------------------------------------------------------------------
-- Agen Keamanan: audit setiap 2 jam (cron Vercel & GitHub Actions memang
-- memanggil tiap 2 jam — sebelumnya kolom ini tidak sinkron).
UPDATE terapi_wicara.ai_agents
   SET schedule_cron = '0 */2 * * *'
 WHERE agent_key = 'AGEN_KEAMANAN';

-- Agen Penguji: pengujian sistem setiap 30 menit.
UPDATE terapi_wicara.ai_agents
   SET schedule_cron = '*/30 * * * *'
 WHERE agent_key = 'AGEN_PENGUJI';

-- Agen Perbaikan Bug bekerja berbasis kejadian (dipicu kegagalan pengujian),
-- jadi ia tidak perlu dijadwalkan per jam. Beri denyut pemeriksaan harian
-- supaya bug yang tertinggal tetap ditemukan.
UPDATE terapi_wicara.ai_agents
   SET schedule_cron = '0 4 * * *'
 WHERE agent_key = 'AGEN_PERBAIKAN_BUG';

-- ---------------------------------------------------------------------------
-- 3. PEMBANTU: apakah jadwal cron sudah lewat?
-- ---------------------------------------------------------------------------
-- Kita tidak memakai parser cron penuh di SQL. Cukup hitung interval dari
-- ekspresi cron yang kita kendalikan sendiri (menit/jam), lalu bandingkan
-- dengan waktu terakhir agen dijadwalkan. Aman dan deterministik.
CREATE OR REPLACE FUNCTION terapi_wicara.tw_ai_cron_interval(p_cron text)
RETURNS interval
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_minute text := split_part(coalesce(p_cron, ''), ' ', 1);
  v_hour   text := split_part(coalesce(p_cron, ''), ' ', 2);
BEGIN
  -- */N * * * *  → tiap N menit
  IF v_minute LIKE '*/%' AND v_hour = '*' THEN
    RETURN make_interval(mins => greatest(1, nullif(replace(v_minute, '*/', ''), '')::int));
  END IF;

  -- 0 */N * * *  → tiap N jam
  IF v_hour LIKE '*/%' THEN
    RETURN make_interval(hours => greatest(1, nullif(replace(v_hour, '*/', ''), '')::int));
  END IF;

  -- 0 H * * *    → sekali sehari
  IF v_minute ~ '^[0-9]+$' AND v_hour ~ '^[0-9]+$' THEN
    RETURN interval '1 day';
  END IF;

  -- Tidak dikenal → anggap harian agar agen tetap pernah berjalan.
  RETURN interval '1 day';
END;
$$;

GRANT EXECUTE ON FUNCTION terapi_wicara.tw_ai_cron_interval(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. DISPATCHER: daftarkan tugas untuk agen yang sudah jatuh tempo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tw_ai_dispatch_due(p_force boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE
  v_agent    record;
  v_task     text;
  v_obj      text;
  v_run_id   uuid;
  v_created  jsonb := '[]'::jsonb;
  v_skipped  jsonb := '[]'::jsonb;
  v_pending  integer;
  v_cap      integer := 25;   -- batas antrean per agen agar tidak menumpuk
BEGIN
  FOR v_agent IN
    SELECT * FROM terapi_wicara.ai_agents
     WHERE is_enabled
       AND coalesce(schedule_cron, '') <> ''
     ORDER BY agent_key
  LOOP
    -- Jangan menumpuk tugas: bila masih ada ANTREAN, lewati.
    SELECT count(*) INTO v_pending
      FROM terapi_wicara.ai_agent_runs
     WHERE agent_key = v_agent.agent_key AND status = 'ANTREAN';

    IF v_pending >= v_cap THEN
      v_skipped := v_skipped || to_jsonb(v_agent.agent_key);
      CONTINUE;
    END IF;

    -- Sudah jatuh tempo?
    IF NOT p_force AND v_agent.next_run_at IS NOT NULL
       AND v_agent.next_run_at > now() THEN
      CONTINUE;
    END IF;

    -- Jenis tugas & tujuan per agen — mengikuti misi yang tersimpan di DB.
    v_task := CASE v_agent.agent_key
      WHEN 'AGEN_SUPERVISOR'    THEN 'ORKESTRASI_RUTIN'
      WHEN 'AGEN_KEAMANAN'      THEN 'AUDIT_KEAMANAN'
      WHEN 'AGEN_PENGUJI'       THEN 'UJI_SISTEM_BERKALA'
      WHEN 'AGEN_PENGETAHUAN'   THEN 'REGENERASI_PENGETAHUAN'
      WHEN 'AGEN_ANALIS'        THEN 'ANALISIS_KINERJA'
      WHEN 'AGEN_PERBAIKAN_BUG' THEN 'PEMINDAIAN_BUG'
      WHEN 'AGEN_PENELITI'      THEN 'RISET_REGULASI'
      ELSE 'TUGAS_RUTIN' END;

    v_obj := CASE v_agent.agent_key
      WHEN 'AGEN_SUPERVISOR'    THEN 'Mengawasi seluruh agen, membersihkan tugas menggantung, dan melaporkan status orkestrasi.'
      WHEN 'AGEN_KEAMANAN'      THEN 'Audit RLS, hak akses, kebocoran PII, dan jejak audit sesuai UU PDP 27/2022.'
      WHEN 'AGEN_PENGUJI'       THEN 'Uji kesehatan sistem, integritas data, dan kesiapan layanan secara berkala.'
      WHEN 'AGEN_PENGETAHUAN'   THEN 'Regenerasi basis pengetahuan dari celah pengetahuan yang belum terjawab.'
      WHEN 'AGEN_ANALIS'        THEN 'Analisis agregat pemanfaatan klinik dan kualitas dokumentasi.'
      WHEN 'AGEN_PERBAIKAN_BUG' THEN 'Memindai kegagalan pengujian terakhir dan mengusulkan perbaikan.'
      WHEN 'AGEN_PENELITI'      THEN 'Riset rujukan regulasi terbaru untuk memperkaya basis pengetahuan.'
      ELSE 'Menjalankan tugas rutin sesuai misi agen.' END;

    INSERT INTO terapi_wicara.ai_agent_runs
      (agent_key, task_type, objective, input_payload, priority, status)
    VALUES
      (v_agent.agent_key, v_task, v_obj,
       jsonb_build_object('source', 'AUTO_DISPATCH', 'cron', v_agent.schedule_cron),
       3, 'ANTREAN')
    RETURNING id INTO v_run_id;

    -- Jadwalkan berikutnya berdasarkan interval cron, dan catat bahwa
    -- penjadwal otonom memang bekerja.
    UPDATE terapi_wicara.ai_agents
       SET next_run_at = now() + terapi_wicara.tw_ai_cron_interval(schedule_cron)
     WHERE agent_key = v_agent.agent_key;

    v_created := v_created || jsonb_build_object(
      'agent', v_agent.agent_key,
      'run_id', v_run_id,
      'task', v_task,
      'cron', v_agent.schedule_cron
    );
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'ok',
    'dispatched', jsonb_array_length(v_created),
    'created', v_created,
    'skipped_full_queue', v_skipped,
    'at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.tw_ai_dispatch_due(boolean) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. DENYUT NADI: bersihkan tugas menggantung & tandai agen bermasalah
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tw_ai_heartbeat(p_stale_minutes integer DEFAULT 120)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE
  v_stale integer := 0;
  v_degraded integer := 0;
  v_never_run integer := 0;
BEGIN
  -- a. Tugas ANTREAN yang terlalu lama = runtime tidak pernah menyentuhnya.
  UPDATE terapi_wicara.ai_agent_runs
     SET status = 'GAGAL',
         error_message = 'Kedaluwarsa: tugas tidak diklaim oleh runtime dalam '
                         || p_stale_minutes || ' menit. Periksa kredensial Supabase & URL runner.',
         output_summary = 'Tidak pernah dijalankan — kemungkinan runtime/cron tidak aktif.',
         finished_at = now()
   WHERE status = 'ANTREAN'
     AND created_at < now() - make_interval(mins => p_stale_minutes);
  GET DIAGNOSTICS v_stale = ROW_COUNT;

  -- b. Agen yang tidak pernah berjalan sama sekali padahal dijadwalkan.
  UPDATE terapi_wicara.ai_agents
     SET health_status = 'DEGRADASI'
   WHERE is_enabled
     AND coalesce(schedule_cron, '') <> ''
     AND (last_run_at IS NULL OR last_run_at < now() - interval '7 days')
     AND health_status <> 'NONAKTIF';
  GET DIAGNOSTICS v_never_run = ROW_COUNT;

  -- c. Agen dengan tingkat kegagalan tinggi = degradasi.
  UPDATE terapi_wicara.ai_agents a
     SET health_status = 'DEGRADASI'
   WHERE is_enabled
     AND a.total_runs >= 3
     AND (a.successful_runs::numeric / a.total_runs) < 0.5
     AND a.health_status <> 'NONAKTIF';
  GET DIAGNOSTICS v_degraded = ROW_COUNT;

  RETURN jsonb_build_object(
    'status', 'ok',
    'expired_tasks', v_stale,
    'degraded_agents', v_degraded,
    'never_run_agents', v_never_run,
    'at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.tw_ai_heartbeat(integer) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. KESEHATAN AGEN (untuk Pusat Komando AI)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tw_ai_agent_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'agent_key'), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'agent_key', a.agent_key,
      'agent_name', a.agent_name,
      'role', a.role,
      'is_enabled', a.is_enabled,
      'schedule_cron', a.schedule_cron,
      'health_status', a.health_status,
      'autonomy_level', a.autonomy_level,
      'last_run_at', a.last_run_at,
      'next_run_at', a.next_run_at,
      'total_runs', a.total_runs,
      'successful_runs', a.successful_runs,
      'success_rate', CASE WHEN a.total_runs = 0 THEN NULL
                           ELSE round(a.successful_runs::numeric * 100 / a.total_runs, 1) END,
      'queue_depth', (SELECT count(*) FROM terapi_wicara.ai_agent_runs r
                       WHERE r.agent_key = a.agent_key AND r.status = 'ANTREAN'),
      'last_status', (SELECT r.status FROM terapi_wicara.ai_agent_runs r
                       WHERE r.agent_key = a.agent_key AND r.status IN ('SELESAI','GAGAL')
                       ORDER BY r.finished_at DESC NULLS LAST LIMIT 1),
      'last_summary', (SELECT left(coalesce(r.output_summary,''), 240)
                         FROM terapi_wicara.ai_agent_runs r
                        WHERE r.agent_key = a.agent_key AND r.status IN ('SELESAI','GAGAL')
                        ORDER BY r.finished_at DESC NULLS LAST LIMIT 1)
    ) AS x
    FROM terapi_wicara.ai_agents a
  ) s;

  RETURN jsonb_build_object('status', 'ok', 'agents', v_rows, 'at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.tw_ai_agent_health() TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. AGREGATOR SATU PIPA: dipakai runtime sebelum menjalankan siklus
-- ---------------------------------------------------------------------------
-- Urutan: bersihkan yang menggantung → daftarkan yang jatuh tempo → klaim.
CREATE OR REPLACE FUNCTION public.tw_ai_prepare_cycle(p_force boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE
  v_beat jsonb;
  v_disp jsonb;
BEGIN
  v_beat := public.tw_ai_heartbeat(120);
  v_disp := public.tw_ai_dispatch_due(p_force);

  RETURN jsonb_build_object(
    'status', 'ok',
    'heartbeat', v_beat,
    'dispatch', v_disp,
    'pending_total', (SELECT count(*) FROM terapi_wicara.ai_agent_runs WHERE status = 'ANTREAN')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.tw_ai_prepare_cycle(boolean) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. VERIFIKASI
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_fns integer;
BEGIN
  SELECT count(*) INTO v_fns
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('tw_ai_dispatch_due','tw_ai_heartbeat','tw_ai_agent_health','tw_ai_prepare_cycle');
  RAISE NOTICE '0007: % dari 4 fungsi dispatcher terpasang.', v_fns;
END $$;
