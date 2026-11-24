-- ============================================================================
-- MIGRATION 0006 — MULTI-AGENT AI ORCHESTRATION + UNIVERSAL CRUD ENGINE
-- Ekosistem SIMKLINIK & RME Terapi Wicara (fawmudsaaotlqyryciwd)
--
-- Isi:
--   1. Registry 7 agen AI otonom (supervisor, knowledge, security, quality,
--      bugfix, analyst, researcher) + antrean tugas
--   2. Basis pengetahuan lokal AI Companion (seed offline-first) + pembelajaran
--   3. Sesi & riwayat percakapan AI Companion website
--   4. Hasil uji sistem berkala (self-test) yang dapat diaudit
--   5. Temuan keamanan (security findings) untuk skor keamanan
--   6. RPC CRUD universal ber-whitelist + audit trail UU PDP
--   7. RPC orkestrasi agen (enqueue / claim / complete)
--   8. RPC tanya-jawab AI Companion (pencarian pengetahuan lokal)
--
-- Kepatuhan: UU 27/2022 (PDP), Permenkes 24/2022 (RME & audit), UU 17/2023
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS terapi_wicara;

-- ---------------------------------------------------------------------------
-- 1. MULTI-AGENT AI REGISTRY
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS terapi_wicara.ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_key text NOT NULL UNIQUE,
  agent_name text NOT NULL,
  role text NOT NULL,
  mission text NOT NULL,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  autonomy_level text NOT NULL DEFAULT 'SEMI_OTONOM'
    CHECK (autonomy_level IN ('OBSERVER', 'SEMI_OTONOM', 'OTONOM_PENUH')),
  trigger_mode text NOT NULL DEFAULT 'CRON'
    CHECK (trigger_mode IN ('CRON', 'PER_REQUEST', 'EVENT', 'MANUAL')),
  schedule_cron text,
  guardrails jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  health_status text NOT NULL DEFAULT 'SEHAT'
    CHECK (health_status IN ('SEHAT', 'DEGRADASI', 'GAGAL', 'NONAKTIF')),
  total_runs integer NOT NULL DEFAULT 0,
  successful_runs integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS terapi_wicara.ai_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_key text NOT NULL REFERENCES terapi_wicara.ai_agents(agent_key) ON DELETE CASCADE,
  task_type text NOT NULL,
  objective text NOT NULL,
  input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ANTREAN'
    CHECK (status IN ('ANTREAN', 'DIKERJAKAN', 'SELESAI', 'GAGAL', 'DIBATALKAN')),
  priority integer NOT NULL DEFAULT 5,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions_taken jsonb NOT NULL DEFAULT '[]'::jsonb,
  requires_human_approval boolean NOT NULL DEFAULT false,
  approved_by text,
  approved_at timestamptz,
  output_summary text,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_status
  ON terapi_wicara.ai_agent_runs (status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_agent
  ON terapi_wicara.ai_agent_runs (agent_key, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. KNOWLEDGE BASE (lokal dulu, lalu diperkaya saat online)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS terapi_wicara.ai_knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  subtopic text,
  category text NOT NULL DEFAULT 'KLINIS'
    CHECK (category IN (
      'KLINIS', 'REGULASI', 'LAYANAN', 'TARIF', 'ADMINISTRASI',
      'PANDUAN_WEB', 'FAQ', 'RISET', 'TEKNIS'
    )),
  title text NOT NULL,
  content text NOT NULL,
  keywords text[] NOT NULL DEFAULT ARRAY[]::text[],
  regulation_reference text,
  source_kind text NOT NULL DEFAULT 'SEED_LOKAL'
    CHECK (source_kind IN ('SEED_LOKAL', 'PEMBELAJARAN_WEB', 'RISET_AGEN', 'KURASI_MANUSIA')),
  source_url text,
  confidence numeric(4,3) NOT NULL DEFAULT 0.950,
  language text NOT NULL DEFAULT 'id',
  usage_count integer NOT NULL DEFAULT 0,
  helpful_count integer NOT NULL DEFAULT 0,
  is_verified boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  superseded_by uuid REFERENCES terapi_wicara.ai_knowledge_base(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_kb_category ON terapi_wicara.ai_knowledge_base (category, is_verified);
CREATE INDEX IF NOT EXISTS idx_ai_kb_keywords ON terapi_wicara.ai_knowledge_base USING gin (keywords);
CREATE INDEX IF NOT EXISTS idx_ai_kb_topic ON terapi_wicara.ai_knowledge_base (topic);

-- ---------------------------------------------------------------------------
-- 3. AI COMPANION CHAT (website)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS terapi_wicara.ai_companion_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token text NOT NULL UNIQUE,
  visitor_label text,
  page_context text,
  channel text NOT NULL DEFAULT 'WEBSITE_PUBLIK'
    CHECK (channel IN ('WEBSITE_PUBLIK', 'PORTAL_PASIEN', 'SIMKLINIK', 'ENTERPRISE_HQ', 'ANDROID_TERAPIS')),
  is_authenticated boolean NOT NULL DEFAULT false,
  message_count integer NOT NULL DEFAULT 0,
  knowledge_gap_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS terapi_wicara.ai_companion_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token text NOT NULL,
  role text NOT NULL CHECK (role IN ('PENGGUNA', 'ASISTEN')),
  message_text text NOT NULL,
  cited_knowledge_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  intent text,
  confidence numeric(4,3),
  answer_source text NOT NULL DEFAULT 'KB_LOKAL'
    CHECK (answer_source IN ('KB_LOKAL', 'KB_PEMBELAJARAN', 'ESKALASI_HUMAN', 'TIDAK_DITEMUKAN')),
  response_ms integer,
  helpful_vote integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_chat_session
  ON terapi_wicara.ai_companion_messages (session_token, created_at);

-- Celah pengetahuan: pertanyaan yang belum terjawab -> tugas agen peneliti
CREATE TABLE IF NOT EXISTS terapi_wicara.ai_knowledge_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text text NOT NULL,
  detected_intent text,
  occurrences integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'TERBUKA'
    CHECK (status IN ('TERBUKA', 'SEDANG_DIRISET', 'TERJAWAB', 'DITOLAK')),
  answered_by_knowledge_id uuid REFERENCES terapi_wicara.ai_knowledge_base(id) ON DELETE SET NULL,
  assigned_agent_key text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 4. SELF-TEST BERKALA
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS terapi_wicara.ai_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suite text NOT NULL,
  test_name text NOT NULL,
  category text NOT NULL DEFAULT 'FUNGSIONAL'
    CHECK (category IN ('FUNGSIONAL', 'KEAMANAN', 'INTEGRITAS_DATA', 'PERFORMA', 'REGULASI', 'UI_UX')),
  status text NOT NULL CHECK (status IN ('LULUS', 'GAGAL', 'PERINGATAN', 'DILEWATI')),
  severity text NOT NULL DEFAULT 'RENDAH'
    CHECK (severity IN ('KRITIS', 'TINGGI', 'SEDANG', 'RENDAH')),
  detail text,
  metric_value numeric,
  duration_ms integer,
  executed_by_agent text,
  run_batch text NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD"T"HH24:MI'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_tests_batch ON terapi_wicara.ai_test_results (created_at DESC, status);

-- ---------------------------------------------------------------------------
-- 5. TEMUAN KEAMANAN
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS terapi_wicara.ai_security_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_code text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('KRITIS', 'TINGGI', 'SEDANG', 'RENDAH', 'INFO')),
  category text NOT NULL DEFAULT 'RLS'
    CHECK (category IN ('RLS', 'AUTENTIKASI', 'OTORISASI', 'ENKRIPSI', 'INJEKSI', 'KEBOCORAN_DATA', 'AUDIT', 'KONFIGURASI')),
  affected_object text,
  description text NOT NULL,
  recommendation text NOT NULL,
  regulation_reference text,
  status text NOT NULL DEFAULT 'TERBUKA'
    CHECK (status IN ('TERBUKA', 'DIPERBAIKI', 'RISIKO_DITERIMA', 'FALSE_POSITIVE')),
  detected_by_agent text NOT NULL DEFAULT 'AGEN_KEAMANAN',
  auto_remediated boolean NOT NULL DEFAULT false,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- ---------------------------------------------------------------------------
-- 6. SEED: 7 AGEN AI OTONOM
-- ---------------------------------------------------------------------------
INSERT INTO terapi_wicara.ai_agents
  (agent_key, agent_name, role, mission, capabilities, autonomy_level, trigger_mode, schedule_cron, guardrails)
VALUES
  ('AGEN_SUPERVISOR', 'Agen Supervisor Orkestrasi',
   'Kepala orkestrasi seluruh agen AI',
   'Menjadwalkan, memprioritaskan, dan mengawasi seluruh tugas agen lain; mencegah tumpang tindih pekerjaan dan menegakkan guardrail.',
   '["orkestrasi_tugas","penjadwalan_cron","deteksi_kegagalan_agen","eskalasi_manusia"]'::jsonb,
   'SEMI_OTONOM', 'CRON', '*/15 * * * *',
   '{"tidak_boleh_ubah_data_pasien":true,"maks_tugas_paralel":4,"wajib_lapor_ke_manusia":["perubahan_skema","hapus_data"]}'::jsonb),

  ('AGEN_PENGETAHUAN', 'Agen Regenerasi Pengetahuan',
   'Kurator & regenerator basis pengetahuan',
   'Memperbarui, memverifikasi, dan meregenerasi basis pengetahuan AI Companion; mengubah pertanyaan tak terjawab menjadi artikel pengetahuan baru.',
   '["regenerasi_kb","deduplikasi_pengetahuan","verifikasi_regulasi","pembelajaran_dari_pertanyaan"]'::jsonb,
   'OTONOM_PENUH', 'CRON', '0 */6 * * *',
   '{"wajib_sumber_terverifikasi":true,"simpan_versi_lama":true,"tidak_boleh_hapus_seed":true}'::jsonb),

  ('AGEN_KEAMANAN', 'Agen Keamanan Sistem',
   'Auditor keamanan & kepatuhan UU PDP',
   'Mengaudit RLS, hak akses peran, kebocoran data pribadi, enkripsi, dan jejak audit; menghasilkan temuan berprioritas beserta rekomendasi perbaikan.',
   '["audit_rls","pemindaian_kebocoran_pii","verifikasi_audit_trail","uji_injeksi","skor_keamanan"]'::jsonb,
   'SEMI_OTONOM', 'CRON', '0 */2 * * *',
   '{"tidak_boleh_ubah_policy_tanpa_approval":true,"larang_uji_merusak":true}'::jsonb),

  ('AGEN_PENGUJI', 'Agen Penguji Sistem Berkala',
   'Quality assurance otomatis',
   'Menjalankan suite uji berkala: fungsional RPC, integritas data, konsistensi tarif, kelengkapan RME, dan kepatuhan regulasi.',
   '["uji_fungsional","uji_integritas_data","uji_regulasi","regresi_otomatis","laporan_mutu"]'::jsonb,
   'OTONOM_PENUH', 'CRON', '*/30 * * * *',
   '{"tidak_boleh_tulis_ke_tabel_klinis":true,"gunakan_data_uji_berlabel":true}'::jsonb),

  ('AGEN_PERBAIKAN_BUG', 'Agen Perbaikan Bug & Error',
   'Detektor & pemulih gangguan',
   'Mendeteksi anomali, error RPC, data tidak konsisten, dan kegagalan sinkronisasi; menyusun patch atau tindakan pemulihan otomatis yang aman.',
   '["deteksi_anomali","analisis_stack_trace","patch_otomatis","rollback_aman","notifikasi_insiden"]'::jsonb,
   'SEMI_OTONOM', 'EVENT', NULL,
   '{"wajib_dry_run":true,"wajib_approval_untuk_ddl":true,"selalu_catat_di_audit":true}'::jsonb),

  ('AGEN_ANALIS', 'Agen Analisis Data & Kinerja',
   'Analis bisnis & klinis',
   'Menganalisis indikator mutu INM, utilisasi ruang terapi, pendapatan, retensi pasien, dan beban terapis; menyusun rekomendasi perbaikan.',
   '["analisis_inm","analisis_pendapatan","utilisasi_ruang","prediksi_antrean","rekomendasi_operasional"]'::jsonb,
   'OTONOM_PENUH', 'CRON', '0 1 * * *',
   '{"agregasi_anonim_saja":true,"tidak_boleh_ekspor_pii":true}'::jsonb),

  ('AGEN_PENELITI', 'Agen Riset & Pembelajaran Online',
   'Peneliti eksternal terkurasi',
   'Saat sistem online: mencari rujukan regulasi terbaru (Kemenkes, SATUSEHAT), pedoman klinis terapi wicara, dan praktik terbaik; menyimpannya sebagai pengetahuan baru berlabel sumber.',
   '["riset_regulasi_terbaru","riset_pedoman_klinis","kurasi_sumber","pembelajaran_online","sitasi_sumber"]'::jsonb,
   'SEMI_OTONOM', 'CRON', '0 3 * * *',
   '{"wajib_sitasi_url":true,"hanya_sumber_resmi":true,"tandai_belum_terverifikasi_sampai_kurasi":true}'::jsonb)
ON CONFLICT (agent_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. RPC CRUD UNIVERSAL (whitelist ketat + audit UU PDP)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tw_crud_meta()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
  SELECT jsonb_build_object(
    'tables', jsonb_build_array(
      'patients', 'appointments', 'soap_sessions', 'clinical_assessments', 'care_plans',
      'therapists', 'therapy_rooms', 'service_tariffs', 'patient_packages', 'billing_invoices',
      'clinic_inventory', 'ppi_sterilization_logs', 'patient_safety_incidents',
      'sop_documents', 'quality_indicators', 'satusehat_fhir_logs', 'online_booking_requests',
      'interprofessional_referrals', 'practitioner_sip_allocations'
    ),
    'read_only', jsonb_build_array('rme_audit_logs', 'ai_agent_runs', 'ai_knowledge_base',
      'ai_test_results', 'ai_security_findings', 'enterprise_holdings', 'finance_coa',
      'finance_journal_entries', 'hr_jasa_medis_payrolls', 'procurement_suppliers',
      'procurement_purchase_orders', 'clinics')
  );
$$;
GRANT EXECUTE ON FUNCTION public.tw_crud_meta() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tw_crud_list(p_table text, p_limit integer DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE
  v_allowed text[] := ARRAY[
    'patients','appointments','soap_sessions','clinical_assessments','care_plans',
    'therapists','therapy_rooms','service_tariffs','patient_packages','billing_invoices',
    'clinic_inventory','ppi_sterilization_logs','patient_safety_incidents',
    'sop_documents','quality_indicators','satusehat_fhir_logs','online_booking_requests',
    'interprofessional_referrals','practitioner_sip_allocations',
    'rme_audit_logs','ai_agent_runs','ai_knowledge_base','ai_test_results',
    'ai_security_findings','enterprise_holdings','finance_coa','finance_journal_entries',
    'hr_jasa_medis_payrolls','procurement_suppliers','procurement_purchase_orders','clinics'
  ];
  v_rows jsonb;
BEGIN
  IF NOT (p_table = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'Tabel tidak diizinkan: %', p_table;
  END IF;
  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (
       SELECT * FROM terapi_wicara.%I ORDER BY 1 DESC LIMIT %s
     ) t', p_table, LEAST(GREATEST(p_limit, 1), 500))
    INTO v_rows;
  RETURN jsonb_build_object('status','ok','table',p_table,'rows',v_rows,'count',jsonb_array_length(v_rows));
END;
$$;
GRANT EXECUTE ON FUNCTION public.tw_crud_list(text, integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tw_crud_save(
  p_table text,
  p_payload jsonb,
  p_actor_name text DEFAULT 'Petugas SIMKLINIK',
  p_actor_role text DEFAULT 'ADMISI_RME',
  p_reason text DEFAULT 'ENTRI_FORMULIR'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE
  v_writable text[] := ARRAY[
    'patients','appointments','soap_sessions','clinical_assessments','care_plans',
    'therapists','therapy_rooms','service_tariffs','patient_packages','billing_invoices',
    'clinic_inventory','ppi_sterilization_logs','patient_safety_incidents',
    'sop_documents','quality_indicators','satusehat_fhir_logs','online_booking_requests',
    'interprofessional_referrals','practitioner_sip_allocations'
  ];
  v_clinic_id uuid;
  v_id uuid;
  v_is_insert boolean;
  v_cols text[];
  v_col_list text;
  v_val_list text;
  v_set_list text;
  v_row jsonb;
  v_action text;
BEGIN
  IF NOT (p_table = ANY (v_writable)) THEN
    RAISE EXCEPTION 'Tabel % bersifat hanya-baca atau tidak dikenal (UU PDP / integritas audit).', p_table;
  END IF;

  SELECT id INTO v_clinic_id FROM terapi_wicara.clinics ORDER BY is_flagship_hq DESC NULLS LAST LIMIT 1;

  v_id := NULLIF(p_payload->>'id','')::uuid;
  v_is_insert := (v_id IS NULL);

  -- Ambil daftar kolom nyata pada tabel target (mencegah injeksi nama kolom)
  SELECT array_agg(column_name::text) INTO v_cols
  FROM information_schema.columns
  WHERE table_schema='terapi_wicara' AND table_name = p_table;

  IF v_is_insert THEN
    -- Bangun daftar kolom yang benar-benar ada di payload
    SELECT string_agg(quote_ident(k),', '), string_agg(format('%L', v), ', ' ORDER BY k)
      INTO v_col_list, v_val_list
    FROM jsonb_each_text(p_payload) AS e(k,v)
    WHERE k = ANY (v_cols) AND k NOT IN ('id','created_at','updated_at');

    IF v_col_list IS NULL THEN
      RAISE EXCEPTION 'Tidak ada kolom valid pada payload untuk %', p_table;
    END IF;

    -- Suntikkan clinic_id wajib bila tabel memilikinya
    IF 'clinic_id' = ANY (v_cols) AND v_clinic_id IS NOT NULL AND NOT (p_payload ? 'clinic_id') THEN
      v_col_list := v_col_list || ', clinic_id';
      v_val_list := v_val_list || format(', %L', v_clinic_id);
    END IF;

    EXECUTE format('INSERT INTO terapi_wicara.%I (%s) VALUES (%s) RETURNING to_jsonb(%I)',
                   p_table, v_col_list, v_val_list, p_table) INTO v_row;
    v_action := 'CREATE';
  ELSE
    SELECT string_agg(format('%I = %L', k, v), ', ' ORDER BY k) INTO v_set_list
    FROM jsonb_each_text(p_payload) AS e(k,v)
    WHERE k = ANY (v_cols) AND k NOT IN ('id','created_at');

    IF v_set_list IS NULL THEN
      RAISE EXCEPTION 'Tidak ada kolom valid untuk diperbarui pada %', p_table;
    END IF;

    EXECUTE format('UPDATE terapi_wicara.%I SET %s, updated_at = now() WHERE id = %L RETURNING to_jsonb(%I)',
                   p_table, v_set_list, v_id, p_table) INTO v_row;
    IF v_row IS NULL THEN
      RAISE EXCEPTION 'Rekaman % dengan id % tidak ditemukan', p_table, v_id;
    END IF;
    v_action := 'UPDATE';
  END IF;

  -- Audit wajib (Permenkes 24/2022 & UU PDP 27/2022)
  IF v_clinic_id IS NOT NULL THEN
    INSERT INTO terapi_wicara.rme_audit_logs
      (clinic_id, actor_name, action, entity_type, entity_id, device_platform, metadata)
    VALUES (v_clinic_id, COALESCE(p_actor_name,'Petugas SIMKLINIK'),
            'CRUD_' || v_action, p_table,
            COALESCE(v_row->>'id', v_id::text, 'BARU'),
            'WEB_SIMKLINIK_DESKTOP',
            jsonb_build_object('role', p_actor_role, 'reason', p_reason,
                               'fields', (SELECT jsonb_agg(k) FROM jsonb_object_keys(p_payload) k)));
  END IF;

  RETURN jsonb_build_object('status','ok','action',v_action,'table',p_table,'row',v_row);
END;
$$;
GRANT EXECUTE ON FUNCTION public.tw_crud_save(text, jsonb, text, text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tw_crud_delete(
  p_table text,
  p_id uuid,
  p_actor_name text DEFAULT 'Petugas SIMKLINIK',
  p_reason text DEFAULT 'HAPUS_FORMULIR'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE
  v_writable text[] := ARRAY[
    'patients','appointments','soap_sessions','clinical_assessments','care_plans',
    'therapists','therapy_rooms','service_tariffs','patient_packages','billing_invoices',
    'clinic_inventory','ppi_sterilization_logs','patient_safety_incidents',
    'sop_documents','quality_indicators','satusehat_fhir_logs','online_booking_requests',
    'interprofessional_referrals','practitioner_sip_allocations'
  ];
  v_clinic_id uuid;
  v_snapshot jsonb;
BEGIN
  IF NOT (p_table = ANY (v_writable)) THEN
    RAISE EXCEPTION 'Tabel % tidak boleh dihapus (hanya-baca / retensi RME 25 tahun).', p_table;
  END IF;

  -- Retensi Permenkes 24/2022: rekam medis terkunci TTE tidak boleh dihapus
  IF p_table = 'soap_sessions' THEN
    IF EXISTS (SELECT 1 FROM terapi_wicara.soap_sessions WHERE id = p_id AND is_locked_tte) THEN
      RAISE EXCEPTION 'SOAP terkunci TTE tidak dapat dihapus. Gunakan addendum (Permenkes 24/2022 Pasal 41).';
    END IF;
  END IF;

  EXECUTE format('DELETE FROM terapi_wicara.%I WHERE id = %L RETURNING to_jsonb(%I)',
                 p_table, p_id, p_table) INTO v_snapshot;
  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'Rekaman tidak ditemukan';
  END IF;

  SELECT id INTO v_clinic_id FROM terapi_wicara.clinics ORDER BY is_flagship_hq DESC NULLS LAST LIMIT 1;
  IF v_clinic_id IS NOT NULL THEN
    INSERT INTO terapi_wicara.rme_audit_logs
      (clinic_id, actor_name, action, entity_type, entity_id, device_platform, metadata)
    VALUES (v_clinic_id, COALESCE(p_actor_name,'Petugas SIMKLINIK'),
            'CRUD_DELETE', p_table, p_id::text, 'WEB_SIMKLINIK_DESKTOP',
            jsonb_build_object('reason', p_reason, 'deleted_snapshot', v_snapshot));
  END IF;

  RETURN jsonb_build_object('status','ok','action','DELETE','table',p_table,'id',p_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.tw_crud_delete(text, uuid, text, text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. RPC ORKESTRASI AGEN AI
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tw_ai_command_center_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE
  v_agents jsonb;
  v_runs jsonb;
  v_kb jsonb;
  v_tests jsonb;
  v_findings jsonb;
  v_gaps jsonb;
  v_score numeric;
BEGIN
  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.agent_key),'[]'::jsonb) INTO v_agents
    FROM terapi_wicara.ai_agents a;

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC),'[]'::jsonb) INTO v_runs
    FROM (SELECT * FROM terapi_wicara.ai_agent_runs ORDER BY created_at DESC LIMIT 40) r;

  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM terapi_wicara.ai_knowledge_base),
    'by_category', COALESCE((SELECT jsonb_object_agg(category, c) FROM (
        SELECT category, count(*) AS c FROM terapi_wicara.ai_knowledge_base GROUP BY category) x),'{}'::jsonb),
    'by_source', COALESCE((SELECT jsonb_object_agg(source_kind, c) FROM (
        SELECT source_kind, count(*) AS c FROM terapi_wicara.ai_knowledge_base GROUP BY source_kind) y),'{}'::jsonb),
    'verified', (SELECT count(*) FROM terapi_wicara.ai_knowledge_base WHERE is_verified),
    'top_used', COALESCE((SELECT jsonb_agg(jsonb_build_object('title',title,'usage',usage_count))
        FROM (SELECT title, usage_count FROM terapi_wicara.ai_knowledge_base
              ORDER BY usage_count DESC LIMIT 5) z),'[]'::jsonb)
  ) INTO v_kb;

  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM terapi_wicara.ai_test_results),
    'lulus', (SELECT count(*) FROM terapi_wicara.ai_test_results WHERE status='LULUS'),
    'gagal', (SELECT count(*) FROM terapi_wicara.ai_test_results WHERE status='GAGAL'),
    'peringatan', (SELECT count(*) FROM terapi_wicara.ai_test_results WHERE status='PERINGATAN'),
    'terbaru', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC)
        FROM (SELECT * FROM terapi_wicara.ai_test_results ORDER BY created_at DESC LIMIT 25) t),'[]'::jsonb)
  ) INTO v_tests;

  SELECT COALESCE(jsonb_agg(to_jsonb(f) ORDER BY
      CASE f.severity WHEN 'KRITIS' THEN 1 WHEN 'TINGGI' THEN 2 WHEN 'SEDANG' THEN 3
                      WHEN 'RENDAH' THEN 4 ELSE 5 END, f.detected_at DESC),'[]'::jsonb)
    INTO v_findings
    FROM terapi_wicara.ai_security_findings f;

  SELECT COALESCE(jsonb_agg(to_jsonb(g) ORDER BY g.occurrences DESC),'[]'::jsonb) INTO v_gaps
    FROM (SELECT * FROM terapi_wicara.ai_knowledge_gaps ORDER BY occurrences DESC LIMIT 25) g;

  -- Skor keamanan: mulai 100, kurangi berbobot per temuan terbuka
  v_score := GREATEST(0, 100 -
      (SELECT COALESCE(sum(CASE severity WHEN 'KRITIS' THEN 25 WHEN 'TINGGI' THEN 12
                                          WHEN 'SEDANG' THEN 5 WHEN 'RENDAH' THEN 1 ELSE 0 END),0)
       FROM terapi_wicara.ai_security_findings WHERE status='TERBUKA'));

  RETURN jsonb_build_object(
    'generated_at', now(),
    'agents', v_agents,
    'runs', v_runs,
    'knowledge', v_kb,
    'tests', v_tests,
    'security_findings', v_findings,
    'security_score', v_score,
    'knowledge_gaps', v_gaps,
    'totals', jsonb_build_object(
      'agents_active', (SELECT count(*) FROM terapi_wicara.ai_agents WHERE is_enabled),
      'runs_pending', (SELECT count(*) FROM terapi_wicara.ai_agent_runs WHERE status='ANTREAN'),
      'runs_done', (SELECT count(*) FROM terapi_wicara.ai_agent_runs WHERE status='SELESAI'),
      'chat_messages', (SELECT count(*) FROM terapi_wicara.ai_companion_messages)
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.tw_ai_command_center_snapshot() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tw_ai_enqueue_task(
  p_agent_key text,
  p_task_type text,
  p_objective text,
  p_input jsonb DEFAULT '{}'::jsonb,
  p_priority integer DEFAULT 5,
  p_requires_approval boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO terapi_wicara.ai_agent_runs
    (agent_key, task_type, objective, input_payload, priority, requires_human_approval, status)
  VALUES (p_agent_key, p_task_type, p_objective, p_input, p_priority, p_requires_approval, 'ANTREAN')
  RETURNING id INTO v_id;

  UPDATE terapi_wicara.ai_agents SET next_run_at = now() WHERE agent_key = p_agent_key;
  RETURN jsonb_build_object('status','ok','run_id',v_id,'agent',p_agent_key);
END;
$$;
GRANT EXECUTE ON FUNCTION public.tw_ai_enqueue_task(text, text, text, jsonb, integer, boolean) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tw_ai_complete_task(
  p_run_id uuid,
  p_status text,
  p_output_summary text,
  p_findings jsonb DEFAULT '[]'::jsonb,
  p_actions jsonb DEFAULT '[]'::jsonb,
  p_duration_ms integer DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE v_agent text;
BEGIN
  UPDATE terapi_wicara.ai_agent_runs
     SET status = p_status,
         output_summary = p_output_summary,
         findings = COALESCE(p_findings,'[]'::jsonb),
         actions_taken = COALESCE(p_actions,'[]'::jsonb),
         duration_ms = p_duration_ms,
         error_message = p_error,
         finished_at = now()
   WHERE id = p_run_id
   RETURNING agent_key INTO v_agent;

  UPDATE terapi_wicara.ai_agents
     SET last_run_at = now(),
         total_runs = total_runs + 1,
         successful_runs = successful_runs + CASE WHEN p_status='SELESAI' THEN 1 ELSE 0 END,
         health_status = CASE WHEN p_status='GAGAL' THEN 'DEGRADASI' ELSE 'SEHAT' END
   WHERE agent_key = v_agent;

  RETURN jsonb_build_object('status','ok','run_id',p_run_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.tw_ai_complete_task(uuid, text, text, jsonb, jsonb, integer, text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 9. RPC AI COMPANION (pencarian pengetahuan lokal)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tw_ai_kb_search(p_query text, p_limit integer DEFAULT 4)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE
  v_terms text[];
  v_rows jsonb;
BEGIN
  v_terms := string_to_array(lower(regexp_replace(coalesce(p_query,''), '[^a-zA-Z0-9 ]', ' ', 'g')), ' ');
  v_terms := ARRAY(SELECT t FROM unnest(v_terms) t WHERE length(t) > 3 LIMIT 12);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', k.id, 'title', k.title, 'content', k.content, 'category', k.category,
           'topic', k.topic, 'regulation_reference', k.regulation_reference,
           'source_kind', k.source_kind, 'source_url', k.source_url,
           'confidence', k.confidence, 'score', k.score) ORDER BY k.score DESC),'[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT kb.*,
      ( SELECT count(*) FROM unnest(v_terms) term
        WHERE lower(kb.title || ' ' || kb.content || ' ' ||
                    coalesce(kb.regulation_reference,'') || ' ' || array_to_string(kb.keywords,' ')) LIKE '%' || term || '%'
      )::numeric AS score
    FROM terapi_wicara.ai_knowledge_base kb
    WHERE kb.is_verified AND kb.superseded_by IS NULL
  ) k
  WHERE k.score > 0
  ORDER BY k.score DESC
  LIMIT LEAST(GREATEST(p_limit,1),10);

  RETURN jsonb_build_object('status','ok','query',p_query,'matches',v_rows,
                            'count', jsonb_array_length(v_rows));
END;
$$;
GRANT EXECUTE ON FUNCTION public.tw_ai_kb_search(text, integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tw_ai_log_conversation(
  p_session_token text,
  p_role text,
  p_message text,
  p_cited uuid[] DEFAULT ARRAY[]::uuid[],
  p_intent text DEFAULT NULL,
  p_confidence numeric DEFAULT NULL,
  p_answer_source text DEFAULT 'KB_LOKAL',
  p_response_ms integer DEFAULT NULL,
  p_channel text DEFAULT 'WEBSITE_PUBLIK',
  p_page_context text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
BEGIN
  INSERT INTO terapi_wicara.ai_companion_sessions (session_token, channel, page_context, message_count)
  VALUES (p_session_token, p_channel, p_page_context, 1)
  ON CONFLICT (session_token) DO UPDATE
    SET message_count = terapi_wicara.ai_companion_sessions.message_count + 1,
        last_active_at = now(),
        page_context = COALESCE(EXCLUDED.page_context, terapi_wicara.ai_companion_sessions.page_context);

  INSERT INTO terapi_wicara.ai_companion_messages
    (session_token, role, message_text, cited_knowledge_ids, intent, confidence,
     answer_source, response_ms)
  VALUES (p_session_token, p_role, p_message, COALESCE(p_cited, ARRAY[]::uuid[]),
          p_intent, p_confidence, p_answer_source, p_response_ms);

  IF p_cited IS NOT NULL AND array_length(p_cited,1) > 0 THEN
    UPDATE terapi_wicara.ai_knowledge_base SET usage_count = usage_count + 1
      WHERE id = ANY (p_cited);
  END IF;

  RETURN jsonb_build_object('status','ok');
END;
$$;
GRANT EXECUTE ON FUNCTION public.tw_ai_log_conversation(text, text, text, uuid[], text, numeric, text, integer, text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tw_ai_report_knowledge_gap(
  p_question text,
  p_intent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM terapi_wicara.ai_knowledge_gaps
   WHERE lower(question_text) = lower(p_question) AND status <> 'TERJAWAB' LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE terapi_wicara.ai_knowledge_gaps
       SET occurrences = occurrences + 1, last_seen_at = now() WHERE id = v_id;
  ELSE
    INSERT INTO terapi_wicara.ai_knowledge_gaps (question_text, detected_intent, assigned_agent_key)
    VALUES (p_question, p_intent, 'AGEN_PENELITI') RETURNING id INTO v_id;
  END IF;

  -- Sekali celah muncul >=3 kali, minta agen peneliti membuat artikel baru
  IF (SELECT occurrences FROM terapi_wicara.ai_knowledge_gaps WHERE id = v_id) >= 3
     AND NOT EXISTS (SELECT 1 FROM terapi_wicara.ai_agent_runs
                     WHERE task_type='RISET_CELAH_PENGETAHUAN' AND status IN ('ANTREAN','DIKERJAKAN')) THEN
    PERFORM public.tw_ai_enqueue_task(
      'AGEN_PENELITI', 'RISET_CELAH_PENGETAHUAN',
      'Riset jawaban untuk pertanyaan pengunjung yang berulang: ' || left(p_question, 200),
      jsonb_build_object('gap_id', v_id), 4, false);
  END IF;

  RETURN jsonb_build_object('status','ok','gap_id',v_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.tw_ai_report_knowledge_gap(text, text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 10. RPC SIMPAN HASIL UJI & TEMUAN KEAMANAN (dipakai agen otomatis)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tw_ai_record_test(
  p_suite text, p_test_name text, p_category text, p_status text,
  p_severity text DEFAULT 'RENDAH', p_detail text DEFAULT NULL,
  p_metric numeric DEFAULT NULL, p_duration_ms integer DEFAULT NULL,
  p_agent text DEFAULT 'AGEN_PENGUJI'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO terapi_wicara.ai_test_results
    (suite, test_name, category, status, severity, detail, metric_value, duration_ms, executed_by_agent)
  VALUES (p_suite, p_test_name, p_category, p_status, p_severity, p_detail, p_metric, p_duration_ms, p_agent)
  RETURNING id INTO v_id;

  IF p_status = 'GAGAL' THEN
    PERFORM public.tw_ai_enqueue_task('AGEN_PERBAIKAN_BUG', 'PERBAIKI_KEGAGALAN_UJI',
      'Perbaiki kegagalan uji: ' || p_test_name,
      jsonb_build_object('test_id', v_id, 'detail', p_detail), 3, false);
  END IF;

  RETURN jsonb_build_object('status','ok','test_id',v_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.tw_ai_record_test(text, text, text, text, text, text, numeric, integer, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tw_ai_record_finding(
  p_code text, p_title text, p_severity text, p_category text,
  p_affected text, p_description text, p_recommendation text,
  p_regulation text DEFAULT NULL, p_agent text DEFAULT 'AGEN_KEAMANAN'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM terapi_wicara.ai_security_findings
   WHERE finding_code = p_code AND affected_object IS NOT DISTINCT FROM p_affected
     AND status = 'TERBUKA' LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO terapi_wicara.ai_security_findings
      (finding_code, title, severity, category, affected_object, description,
       recommendation, regulation_reference, detected_by_agent)
    VALUES (p_code, p_title, p_severity, p_category, p_affected, p_description,
            p_recommendation, p_regulation, p_agent)
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object('status','ok','finding_id',v_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.tw_ai_record_finding(text, text, text, text, text, text, text, text, text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 11. RLS: tabel AI hanya-baca untuk anon, tulis via RPC SECURITY DEFINER
-- ---------------------------------------------------------------------------
ALTER TABLE terapi_wicara.ai_agents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE terapi_wicara.ai_agent_runs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE terapi_wicara.ai_knowledge_base     ENABLE ROW LEVEL SECURITY;
ALTER TABLE terapi_wicara.ai_companion_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE terapi_wicara.ai_companion_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE terapi_wicara.ai_knowledge_gaps     ENABLE ROW LEVEL SECURITY;
ALTER TABLE terapi_wicara.ai_test_results       ENABLE ROW LEVEL SECURITY;
ALTER TABLE terapi_wicara.ai_security_findings  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA terapi_wicara FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 12. SEED BASIS PENGETAHUAN LOKAL AI COMPANION (offline-first)
-- ---------------------------------------------------------------------------
INSERT INTO terapi_wicara.ai_knowledge_base
  (topic, subtopic, category, title, content, keywords, regulation_reference, source_kind, confidence)
VALUES
  ('Klinik', 'Identitas Layanan', 'LAYANAN',
   'Apa itu Klinik Terapi Wicara WicaraSehat?',
   'WicaraSehat adalah klinik utama rehabilitasi medik yang melayani terapi wicara untuk anak dan dewasa. Klinik menangani lima domain: (1) bahasa reseptif-ekspresif, (2) bicara & artikulasi, (3) suara, (4) irama kelancaran atau gagap, dan (5) menelan atau disfagia. Layanan diberikan oleh terapis wicara ber-STR seumur hidup dengan SIP sesuai UU No. 17 Tahun 2023. Setiap sesi berlangsung 45 menit di ruang kedap suara dengan kebisingan di bawah 35 dB.',
   ARRAY['klinik','terapi wicara','layanan','wicarasehat','domain','lima domain'],
   'UU No. 17 Tahun 2023 tentang Kesehatan', 'SEED_LOKAL', 0.980),

  ('Klinik', 'Jadwal & Pendaftaran', 'ADMINISTRASI',
   'Bagaimana cara mendaftar dan membuat jadwal terapi?',
   'Pendaftaran dapat dilakukan melalui formulir Booking Online di website ini. Anda mengisi data anak atau pasien (nama lengkap, tanggal lahir, jenis kelamin), data wali, nomor telepon, tanggal dan slot yang diinginkan, jenis layanan, serta keluhan utama. Setelah dikirim, petugas admisi akan memverifikasi minimal 2 identitas (nama lengkap dan tanggal lahir) lalu menerbitkan Nomor Rekam Medis (format RM-TW-2026-XXXX). Anda akan dihubungi melalui WhatsApp pada nomor wali yang didaftarkan untuk konfirmasi jadwal.',
   ARRAY['daftar','booking','pendaftaran','jadwal','online','reservasi','nomor rekam medis','antrean'],
   'Permenkes No. 24 Tahun 2022 tentang Rekam Medis', 'SEED_LOKAL', 0.960),

  ('Klinik', 'Tarif', 'TARIF',
   'Berapa biaya satu sesi terapi wicara dan apakah ada paket?',
   'Tarif sesi terapi wicara reguler 45 menit adalah Rp195.000. Klinik juga menyediakan paket multi-sesi yang lebih hemat, misalnya paket 8 sesi dengan potongan harga. Pembayaran dapat dilakukan melalui QRIS, transfer bank, atau tunai di kasir. Kuitansi resmi dan rincian tagihan diterbitkan oleh kasir. Untuk pasien dengan rujukan asuransi atau BPJS, mohon informasikan saat pendaftaran agar petugas menyiapkan berkas yang diperlukan.',
   ARRAY['tarif','biaya','harga','paket','sesi','qris','bayar','pembayaran','kuitansi'],
   'Standar Tarif Klinik', 'SEED_LOKAL', 0.940),

  ('Klinik', 'Persiapan Sesi', 'PANDUAN_WEB',
   'Apa yang perlu dipersiapkan sebelum sesi terapi pertama?',
   'Bawa dokumen berikut: (1) fotokopi Kartu Keluarga dan Akta Kelahiran anak, (2) Kartu Identitas Anak (KIA) atau KTP orang tua, (3) surat rujukan dokter bila ada, (4) hasil pemeriksaan pendengaran atau audiometri bila pernah dilakukan, dan (5) buku catatan atau buku penghubung sekolah bila anak sudah bersekolah. Datang 15 menit lebih awal untuk verifikasi identitas dan pengisian informed consent. Anak sebaiknya dalam kondisi cukup tidur dan tidak lapar agar sesi asesmen berjalan optimal.',
   ARRAY['persiapan','dokumen','berkas','konsen','asesmen','pertama','bawa','syarat'],
   'Permenkes No. 81 Tahun 2014 tentang Standar Pelayanan Terapi Wicara', 'SEED_LOKAL', 0.950),

  ('Klinis', 'Keterlambatan Bicara', 'KLINIS',
   'Kapan anak dianggap terlambat bicara (speech delay)?',
   'Tanda anak perlu dievaluasi terapis wicara: belum mengoceh pada usia 9 bulan, belum mengucapkan kata bermakna pertama pada 16 bulan, belum menggabungkan dua kata pada 24 bulan, kosa kata kurang dari 50 kata pada usia 2 tahun, atau kemampuan bicara tidak dapat dipahami orang di luar keluarga pada usia 3 tahun. Selain jumlah kata, perhatikan juga kualitas interaksi: kontak mata, menunjuk untuk meminta, meniru gerakan, dan respons terhadap nama. Bila terdapat lebih dari satu tanda, segera lakukan skrining tumbuh kembang. Deteksi dini sangat menentukan hasil terapi.',
   ARRAY['terlambat bicara','speech delay','keterlambatan','mile stone','tumbuh kembang','2 tahun','skrining'],
   'Permenkes No. 81 Tahun 2014 & Pedoman Stimulasi Tumbuh Kembang', 'SEED_LOKAL', 0.970),

  ('Klinis', 'Gagap', 'KLINIS',
   'Apakah gagap pada anak bisa disembuhkan?',
   'Gagap atau stuttering pada anak memiliki prognosis baik, terutama bila intervensi dilakukan sebelum usia 6 tahun. Terapi mencakup teknik kelancaran (fluency shaping), modifikasi gagap (stuttering modification), serta pelatihan orang tua untuk memperlambat tempo bicara dan memberi waktu bicara tanpa interupsi. Indikator klinis yang dipantau adalah persentase suku kata gagap atau Percent Syllables Stuttered (%SS); nilai di bawah 3 persen dianggap dalam batas normal. Faktor risiko yang memperberat meliputi riwayat gagap dalam keluarga, gagap berlangsung lebih dari 12 bulan, dan adanya perilaku sekunder seperti menghindar bicara.',
   ARRAY['gagap','stuttering','kelancaran','fluency','irama','ss','anak'],
   'Permenkes No. 81 Tahun 2014 (Domain Irama/Kelancaran)', 'SEED_LOKAL', 0.960),

  ('Klinis', 'Disfagia', 'KLINIS',
   'Apa itu disfagia dan bagaimana penanganannya?',
   'Disfagia adalah gangguan menelan yang dapat menyebabkan tersedak, aspirasi, atau kekurangan gizi. Penanganan di klinik mencakup asesmen klinis menelan, pemantauan saturasi oksigen sebelum dan sesudah menelan, serta penentuan tekstur makanan dan minuman memakai standar IDDSI (International Dysphagia Diet Standardisation Initiative) level 0 sampai 7. Level 0 adalah cairan encer dan level 7 adalah makanan biasa. Terapis juga mengajarkan manuver kompensasi dan latihan kekuatan otot oromotor. Bila terdapat tanda aspirasi, pasien akan dirujuk ke dokter Sp.KFR atau THT-KL.',
   ARRAY['disfagia','menelan','iddsi','aspirasi','tersedak','tekstur','oromotor'],
   'Permenkes No. 81 Tahun 2014 (Domain Menelan/Disfagia)', 'SEED_LOKAL', 0.960),

  ('Klinis', 'Suara', 'KLINIS',
   'Bagaimana penilaian gangguan suara dilakukan?',
   'Penilaian suara memakai skala GRBAS yang menilai Grade (derajat keparahan), Roughness (kekasaran), Breathiness (serak berdesir), Asthenicity (kelemahan), dan Strain (ketegangan). Klinik juga mengukur Maximum Phonation Time (MPT) dalam detik serta rasio s/z. Nilai MPT normal pada orang dewasa sekitar 15 sampai 25 detik. Terapi mencakup higiene suara, latihan pernapasan diafragma, dan teknis resonansi. Pasien disarankan menghindari berbisik berlebihan dan berteriak.',
   ARRAY['suara','grbas','mpt','serak','parau','fonasi','voice'],
   'Permenkes No. 81 Tahun 2014 (Domain Suara)', 'SEED_LOKAL', 0.940),

  ('Regulasi', 'Rekam Medis', 'REGULASI',
   'Apakah rekam medis saya aman dan berapa lama disimpan?',
   'Rekam medis elektronik Anda disimpan minimal 25 tahun sesuai Permenkes No. 24 Tahun 2022. Catatan SOAP yang telah ditandatangani secara elektronik (TTE) akan terkunci dan tidak dapat diubah; perubahan hanya boleh melalui addendum yang tercatat dalam jejak audit. Data pribadi dilindungi UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi: akses dibatasi berdasarkan peran (dokter, terapis, kasir, tim mutu), nomor NIK ditampilkan dalam bentuk tersamar, dan setiap akses tercatat dalam log audit yang tidak dapat dihapus.',
   ARRAY['rekam medis','aman','privasi','pdp','retensi','25 tahun','tte','audit','nik'],
   'Permenkes No. 24 Tahun 2022 & UU No. 27 Tahun 2022', 'SEED_LOKAL', 0.980),

  ('Regulasi', 'Hak Pasien', 'REGULASI',
   'Apa hak saya sebagai pasien atau wali pasien?',
   'Sesuai UU No. 17 Tahun 2023 dan UU PDP, Anda berhak: (1) mendapatkan informasi lengkap tentang diagnosis, rencana terapi, dan prognosis; (2) memberi atau menolak persetujuan tindakan (informed consent); (3) meminta salinan resume medis; (4) meminta koreksi data pribadi yang tidak akurat; (5) membatasi atau menarik persetujuan penggunaan data untuk tujuan tertentu; (6) mengajukan pengaduan kepada petugas atau Dinas Kesehatan. Permintaan salinan rekam medis diproses maksimal 14 hari kerja.',
   ARRAY['hak','pasien','consent','informasi','salinan','resume','pengaduan','pdp'],
   'UU No. 17 Tahun 2023 & UU No. 27 Tahun 2022', 'SEED_LOKAL', 0.970),

  ('Regulasi', 'SATUSEHAT', 'REGULASI',
   'Apakah data kunjungan saya terhubung ke SATUSEHAT Kementerian Kesehatan?',
   'Ya. Klinik melakukan interoperabilitas data dengan platform SATUSEHAT Kementerian Kesehatan memakai standar HL7 FHIR R4. Data yang dikirimkan mencakup data pasien (Patient), tenaga kesehatan (Practitioner), lokasi layanan (Location), dan kunjungan (Encounter). Pengiriman memerlukan persetujuan Anda sebagai bagian dari general consent. Status sinkronisasi dapat dilihat oleh petugas rekam medis, dan setiap pengiriman tercatat dalam log beserta kode status HTTP-nya.',
   ARRAY['satusehat','fhir','interoperabilitas','kemenkes','encounter','hl7'],
   'Permenkes No. 24 Tahun 2022 (Interoperabilitas SATUSEHAT)', 'SEED_LOKAL', 0.950),

  ('Layanan', 'Program Rumah', 'LAYANAN',
   'Apakah ada latihan yang bisa dilakukan di rumah?',
   'Setiap sesi menghasilkan Home Exercise Program (HEP) yang disesuaikan dengan target terapi anak. Latihan biasanya singkat, 10 sampai 15 menit, dilakukan 2 sampai 3 kali sehari secara konsisten. Orang tua berperan sebagai co-terapis: memberi contoh, menunggu giliran bicara, dan memberi pujian. Melalui Portal Pasien di website ini, Anda dapat masuk memakai Nomor Rekam Medis dan tanggal lahir untuk melihat rincian program latihan rumah, riwayat sesi, dan rekomendasi terapis.',
   ARRAY['latihan','rumah','hep','program','orang tua','mandiri','portal'],
   'Permenkes No. 81 Tahun 2014 (Kolaborasi Keluarga)', 'SEED_LOKAL', 0.950),

  ('Panduan Web', 'Portal Pasien', 'PANDUAN_WEB',
   'Bagaimana cara masuk ke Portal Pasien?',
   'Buka halaman Portal Pasien, lalu masukkan Nomor Rekam Medis (contoh format RM-TW-2026-0041) dan tanggal lahir pasien (format YYYY-MM-DD). Sistem akan menampilkan ringkasan terapi, program latihan rumah, serta jadwal sesi berikutnya. Apabila Anda lupa nomor rekam medis, hubungi petugas admisi klinik dengan menyebutkan nama lengkap dan tanggal lahir pasien. Demi keamanan UU PDP, portal tidak menampilkan NIK lengkap dan hanya dapat diakses dengan kombinasi dua identitas yang benar.',
   ARRAY['portal pasien','login','masuk','nomor rekam medis','tanggal lahir','lupa'],
   'UU No. 27 Tahun 2022 (Verifikasi 2 Identitas)', 'SEED_LOKAL', 0.960),

  ('Teknis', 'Aplikasi Terapis', 'PANDUAN_WEB',
   'Aplikasi apa yang dipakai terapis saat sesi berlangsung?',
   'Terapis memakai aplikasi Android WicaraSehat Terapis yang bekerja secara offline-first: pencatatan tetap berjalan di ruang kedap suara meskipun tanpa sinyal, lalu tersinkronisasi otomatis ke server ketika perangkat kembali online. Aplikasi mencakup kalkulator trial SOAP, instrumen asesmen lima domain, tanda tangan elektronik, rujukan interprofesional, serta log sterilisasi alat oromotor sesuai standar PPI.',
   ARRAY['aplikasi','android','terapis','offline','sinkronisasi','soap','rme'],
   'Permenkes No. 24 Tahun 2022 (RME Offline-First)', 'SEED_LOKAL', 0.930),

  ('FAQ', 'Dewasa', 'FAQ',
   'Apakah klinik melayani pasien dewasa dan lanjut usia?',
   'Ya. Selain pasien anak, klinik melayani dewasa dan lanjut usia dengan kasus pascastroke (afasia dan disartria), gangguan suara akibat pemakaian berlebih (misalnya guru dan penyanyi), disfagia neurogenik, serta pasien pascabedah laring. Asesmen dewasa mencakup uji bahasa, artikulasi, kualitas suara, dan evaluasi menelan. Untuk pasien pascastroke, terapi dilakukan secara interprofesional bersama dokter Sp.KFR, okupasi terapis, dan fisioterapis.',
   ARRAY['dewasa','lansia','stroke','afasia','disartria','pascastroke','lanjut usia'],
   'Permenkes No. 81 Tahun 2014', 'SEED_LOKAL', 0.930),

  ('FAQ', 'Asuransi', 'FAQ',
   'Apakah terapi wicara ditanggung asuransi atau BPJS?',
   'Cakupan bergantung pada jenis kepesertaan dan indikasi medis. Untuk BPJS Kesehatan, layanan terapi wicara dapat ditanggung bila pasien memiliki rujukan dari fasilitas kesehatan tingkat pertama dan diagnosis ditegakkan oleh dokter. Untuk asuransi swasta, diperlukan surat rujukan dokter dan kadang surat jaminan (guarantee letter) dari penanggung. Klinik membantu menyiapkan berkas administratif, namun keputusan penjaminan sepenuhnya berada pada pihak penjamin. Disarankan menghubungi kami sebelum jadwal pertama agar berkas dapat disiapkan.',
   ARRAY['asuransi','bpjs','tanggungan','jaminan','rujukan','klaim','gratis'],
   'UU No. 17 Tahun 2023 & Ketentuan JKN', 'SEED_LOKAL', 0.920),

  ('FAQ', 'Lokasi', 'FAQ',
   'Di mana lokasi klinik dan bagaimana jam operasionalnya?',
   'Klinik berlokasi di Jl. Jaksa Agung Suprapto No. 24, Mojoroto, Kota Kediri, Jawa Timur, dan dapat dihubungi di (0354) 689420. Klinik melayani pendaftaran pada hari kerja dan Sabtu pagi; sesi terapi dijadwalkan berdasarkan ketersediaan ruang kedap suara dan terapis. Untuk kunjungan pertama, disarankan membuat janji melalui Booking Online agar tidak menunggu antrean.',
   ARRAY['lokasi','alamat','kediri','jam','operasional','kontak','telepon','dimana'],
   'Informasi Klinik', 'SEED_LOKAL', 0.960)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 13. STATUS AWAL AGEN + CONTOH TEMUAN TERKURASI
-- ---------------------------------------------------------------------------
INSERT INTO terapi_wicara.ai_security_findings
  (finding_code, title, severity, category, affected_object, description, recommendation,
   regulation_reference, status, detected_by_agent)
VALUES
  ('SEC-BASELINE-001', 'Tabel AI baru wajib diverifikasi ulang kebijakan RLS',
   'RENDAH', 'RLS', 'terapi_wicara.ai_*',
   'Tabel multi-agen AI (agents, runs, knowledge_base, companion_*, test_results, security_findings) mengaktifkan RLS tanpa policy baca untuk anon; seluruh akses data dilakukan melalui RPC SECURITY DEFINER yang tercatat. Perlu verifikasi berkala bahwa tidak ada policy permisif yang ditambahkan kemudian.',
   'Jalankan audit RLS otomatis oleh AGEN_KEAMANAN setiap 2 jam dan bandingkan jumlah policy dengan baseline.',
   'UU No. 27 Tahun 2022 Pasal 35', 'TERBUKA', 'AGEN_KEAMANAN')
ON CONFLICT DO NOTHING;
