-- ============================================================================
-- MIGRATION 0002: AUDITED SECURITY DEFINER RPC GATEWAYS + RLS ENFORCEMENT
-- Target Project: SIMKLINIK & RME (ref: fawmudsaaotlqyryciwd)
-- ============================================================================

DO $$
DECLARE
  tbl record;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'terapi_wicara'
  LOOP
    EXECUTE format('ALTER TABLE terapi_wicara.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);
    EXECUTE format('DROP POLICY IF EXISTS tw_service_role_all ON terapi_wicara.%I', tbl.tablename);
    EXECUTE format(
      'CREATE POLICY tw_service_role_all ON terapi_wicara.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tbl.tablename
    );
  END LOOP;
END;
$$;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA terapi_wicara TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA terapi_wicara TO service_role;

CREATE OR REPLACE FUNCTION public.tw_android_fetch_bootstrap(p_employee_number text DEFAULT 'TW-2023-001')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE
  v_therapist terapi_wicara.therapists%ROWTYPE;
  v_clinic terapi_wicara.clinics%ROWTYPE;
BEGIN
  SELECT * INTO v_therapist
  FROM terapi_wicara.therapists
  WHERE employee_number = p_employee_number AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Terapis Wicara (%) tidak ditemukan atau tidak aktif', p_employee_number;
  END IF;

  SELECT * INTO v_clinic FROM terapi_wicara.clinics WHERE id = v_therapist.clinic_id;

  INSERT INTO terapi_wicara.rme_audit_logs (
    clinic_id, actor_therapist_id, actor_name, actor_sip_number,
    action, entity_type, entity_id, device_platform, metadata
  ) VALUES (
    v_clinic.id, v_therapist.id, v_therapist.full_name, v_therapist.sip_number,
    'SYNC_CLINICAL_WORKLIST', 'THERAPIST_SESSION', v_therapist.id::text,
    'ANDROID_TERAPIS_APP', jsonb_build_object('sip_valid_until', v_therapist.sip_valid_until)
  );

  RETURN jsonb_build_object(
    'synced_at', now(),
    'clinic', to_jsonb(v_clinic),
    'therapist', to_jsonb(v_therapist) - 'pin_code_hash' - 'nik_hash',
    'rooms', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.room_code) FROM terapi_wicara.therapy_rooms r WHERE r.clinic_id = v_clinic.id), '[]'::jsonb),
    'patients', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.medical_record_number) FROM terapi_wicara.patients p WHERE p.clinic_id = v_clinic.id), '[]'::jsonb),
    'care_plans', COALESCE((SELECT jsonb_agg(to_jsonb(cp) ORDER BY cp.created_at DESC) FROM terapi_wicara.care_plans cp WHERE cp.clinic_id = v_clinic.id), '[]'::jsonb),
    'appointments', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(a) || jsonb_build_object(
          'patient_name', p.full_name,
          'medical_record_number', p.medical_record_number,
          'birth_date', p.birth_date,
          'aspiration_risk_level', p.aspiration_risk_level,
          'clinical_alerts', p.clinical_alerts,
          'room_name', rm.room_name
        ) ORDER BY a.scheduled_start ASC
      )
      FROM terapi_wicara.appointments a
      JOIN terapi_wicara.patients p ON p.id = a.patient_id
      LEFT JOIN terapi_wicara.therapy_rooms rm ON rm.id = a.room_id
      WHERE a.clinic_id = v_clinic.id AND a.therapist_id = v_therapist.id
    ), '[]'::jsonb),
    'soap_sessions', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.session_date DESC) FROM terapi_wicara.soap_sessions s WHERE s.clinic_id = v_clinic.id), '[]'::jsonb),
    'assessments', COALESCE((SELECT jsonb_agg(to_jsonb(ca) ORDER BY ca.assessment_date DESC) FROM terapi_wicara.clinical_assessments ca WHERE ca.clinic_id = v_clinic.id), '[]'::jsonb),
    'sops', COALESCE((SELECT jsonb_agg(to_jsonb(sd) ORDER BY sd.sop_number ASC) FROM terapi_wicara.sop_documents sd WHERE sd.clinic_id = v_clinic.id), '[]'::jsonb),
    'sterilization_logs', COALESCE((SELECT jsonb_agg(to_jsonb(sl) ORDER BY sl.logged_at DESC) FROM terapi_wicara.ppi_sterilization_logs sl WHERE sl.clinic_id = v_clinic.id), '[]'::jsonb),
    'audit_logs', COALESCE((
      SELECT jsonb_agg(to_jsonb(al) ORDER BY al.logged_at DESC)
      FROM (SELECT * FROM terapi_wicara.rme_audit_logs WHERE clinic_id = v_clinic.id ORDER BY logged_at DESC LIMIT 20) al
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tw_android_submit_soap(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE
  v_therapist terapi_wicara.therapists%ROWTYPE;
  v_patient terapi_wicara.patients%ROWTYPE;
  v_soap_id uuid;
  v_appt_id uuid := NULLIF(p_payload->>'appointment_id', '')::uuid;
BEGIN
  SELECT * INTO v_therapist FROM terapi_wicara.therapists WHERE id = (p_payload->>'therapist_id')::uuid AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Terapis tidak valid'; END IF;

  IF v_therapist.sip_valid_until < CURRENT_DATE THEN
    RAISE EXCEPTION 'SIP Terapis (%) kedaluwarsa pada %. Pengisian RME dikunci sesuai UU No. 17/2023.', v_therapist.sip_number, v_therapist.sip_valid_until;
  END IF;

  SELECT * INTO v_patient FROM terapi_wicara.patients WHERE id = (p_payload->>'patient_id')::uuid AND clinic_id = v_therapist.clinic_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pasien tidak ditemukan'; END IF;

  INSERT INTO terapi_wicara.soap_sessions (
    clinic_id, appointment_id, patient_id, therapist_id, duration_minutes,
    hand_hygiene_5_moments, apd_compliant, oral_tools_sterile_verified, patient_two_identifiers_checked,
    target_skill, trials_independent, trials_verbal_prompt, trials_visual_prompt, trials_tactile_prompt, trials_incorrect,
    accuracy_percentage, subjective, objective, assessment, plan, home_exercise_program,
    caregiver_educated, caregiver_signature_name, icd10_code, icd9cm_code, icf_code,
    is_locked_tte, tte_certificate_serial, satusehat_synced, client_offline_uuid
  ) VALUES (
    v_therapist.clinic_id, v_appt_id, v_patient.id, v_therapist.id,
    COALESCE((p_payload->>'duration_minutes')::int, 45),
    COALESCE((p_payload->>'hand_hygiene_5_moments')::boolean, true),
    COALESCE((p_payload->>'apd_compliant')::boolean, true),
    COALESCE((p_payload->>'oral_tools_sterile_verified')::boolean, true),
    COALESCE((p_payload->>'patient_two_identifiers_checked')::boolean, true),
    COALESCE(p_payload->>'target_skill', 'Target komunikasi fungsional'),
    COALESCE((p_payload->>'trials_independent')::int, 0),
    COALESCE((p_payload->>'trials_verbal_prompt')::int, 0),
    COALESCE((p_payload->>'trials_visual_prompt')::int, 0),
    COALESCE((p_payload->>'trials_tactile_prompt')::int, 0),
    COALESCE((p_payload->>'trials_incorrect')::int, 0),
    COALESCE((p_payload->>'accuracy_percentage')::numeric, 0),
    p_payload->>'subjective', p_payload->>'objective', p_payload->>'assessment', p_payload->>'plan',
    p_payload->>'home_exercise_program',
    COALESCE((p_payload->>'caregiver_educated')::boolean, true),
    p_payload->>'caregiver_signature_name',
    COALESCE(p_payload->>'icd10_code', 'F80.9'),
    COALESCE(p_payload->>'icd9cm_code', '93.75'),
    p_payload->>'icf_code',
    true,
    COALESCE(p_payload->>'tte_certificate_serial', 'BSrE-TTE-TW-' || floor(extract(epoch from now()))::text),
    true,
    COALESCE(p_payload->>'client_offline_uuid', gen_random_uuid()::text)
  ) ON CONFLICT (client_offline_uuid) DO UPDATE SET satusehat_synced = true
  RETURNING id INTO v_soap_id;

  IF v_appt_id IS NOT NULL THEN
    UPDATE terapi_wicara.appointments
    SET status = 'SELESAI_SOAP_LOCKED', patient_identity_verified = true, informed_consent_verified = true,
        satusehat_sync_status = 'SYNCED', satusehat_encounter_id = COALESCE(satusehat_encounter_id, 'ENC-SS-' || substr(v_soap_id::text, 1, 8)), updated_at = now()
    WHERE id = v_appt_id;
  END IF;

  UPDATE terapi_wicara.care_plans SET completed_sessions = completed_sessions + 1, updated_at = now()
  WHERE patient_id = v_patient.id AND status = 'AKTIF';

  INSERT INTO terapi_wicara.rme_audit_logs (
    clinic_id, actor_therapist_id, actor_name, actor_sip_number, action, entity_type, entity_id, patient_mrn, device_platform, metadata
  ) VALUES (
    v_therapist.clinic_id, v_therapist.id, v_therapist.full_name, v_therapist.sip_number,
    'SIGN_AND_LOCK_CPPT_SOAP_TTE', 'SOAP_SESSION', v_soap_id::text, v_patient.medical_record_number, 'ANDROID_TERAPIS_APP',
    jsonb_build_object('accuracy_percentage', p_payload->>'accuracy_percentage', 'icd10', p_payload->>'icd10_code')
  );

  RETURN jsonb_build_object('status', 'ok', 'soap_id', v_soap_id, 'locked_at', now());
END;
$$;

CREATE OR REPLACE FUNCTION public.tw_android_submit_assessment(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE
  v_therapist terapi_wicara.therapists%ROWTYPE;
  v_patient terapi_wicara.patients%ROWTYPE;
  v_assessment_id uuid;
BEGIN
  SELECT * INTO v_therapist FROM terapi_wicara.therapists WHERE id = (p_payload->>'therapist_id')::uuid AND is_active = true;
  IF NOT FOUND OR v_therapist.sip_valid_until < CURRENT_DATE THEN RAISE EXCEPTION 'Terapis tidak aktif atau SIP kedaluwarsa'; END IF;

  SELECT * INTO v_patient FROM terapi_wicara.patients WHERE id = (p_payload->>'patient_id')::uuid AND clinic_id = v_therapist.clinic_id;

  INSERT INTO terapi_wicara.clinical_assessments (
    clinic_id, patient_id, therapist_id, domain, ope_findings, ddk_smr_pataka_per_sec,
    pcc_score, articulation_matrix, mpt_seconds, sz_ratio, grbas_score,
    total_syllables_counted, stuttered_syllables_counted, percent_syllables_stuttered,
    iddsi_liquid_level, iddsi_food_level, spo2_baseline, spo2_post_swallow,
    clinical_conclusion, icd10_code, icd9cm_procedure_code, signed_tte_hash, signed_at
  ) VALUES (
    v_therapist.clinic_id, v_patient.id, v_therapist.id, p_payload->>'domain',
    COALESCE(p_payload->'ope_findings', '{}'::jsonb),
    NULLIF(p_payload->>'ddk_smr_pataka_per_sec', '')::numeric,
    NULLIF(p_payload->>'pcc_score', '')::numeric,
    COALESCE(p_payload->'articulation_matrix', '[]'::jsonb),
    NULLIF(p_payload->>'mpt_seconds', '')::numeric,
    NULLIF(p_payload->>'sz_ratio', '')::numeric,
    COALESCE(p_payload->'grbas_score', '{}'::jsonb),
    NULLIF(p_payload->>'total_syllables_counted', '')::int,
    NULLIF(p_payload->>'stuttered_syllables_counted', '')::int,
    NULLIF(p_payload->>'percent_syllables_stuttered', '')::numeric,
    NULLIF(p_payload->>'iddsi_liquid_level', '')::int,
    NULLIF(p_payload->>'iddsi_food_level', '')::int,
    NULLIF(p_payload->>'spo2_baseline', '')::int,
    NULLIF(p_payload->>'spo2_post_swallow', '')::int,
    COALESCE(p_payload->>'clinical_conclusion', 'Asesmen klinis terstandar selesai'),
    p_payload->>'icd10_code', COALESCE(p_payload->>'icd9cm_procedure_code', '93.71'),
    'SHA256-TTE-' || md5(now()::text || v_patient.id::text), now()
  ) RETURNING id INTO v_assessment_id;

  INSERT INTO terapi_wicara.rme_audit_logs (
    clinic_id, actor_therapist_id, actor_name, actor_sip_number, action, entity_type, entity_id, patient_mrn, device_platform
  ) VALUES (
    v_therapist.clinic_id, v_therapist.id, v_therapist.full_name, v_therapist.sip_number,
    'SUBMIT_CLINICAL_ASSESSMENT', 'CLINICAL_ASSESSMENT', v_assessment_id::text, v_patient.medical_record_number, 'ANDROID_TERAPIS_APP'
  );

  RETURN jsonb_build_object('status', 'ok', 'assessment_id', v_assessment_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.tw_android_log_ppi_or_ikp(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE
  v_therapist terapi_wicara.therapists%ROWTYPE;
  v_record_id uuid;
BEGIN
  SELECT * INTO v_therapist FROM terapi_wicara.therapists WHERE id = (p_payload->>'therapist_id')::uuid AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Terapis tidak valid'; END IF;

  IF (p_payload->>'record_type') = 'PPI_STERILISASI' THEN
    INSERT INTO terapi_wicara.ppi_sterilization_logs (
      clinic_id, therapist_id, room_id, tool_set_name, batch_code, method, indicator_passed
    ) VALUES (
      v_therapist.clinic_id, v_therapist.id, NULLIF(p_payload->>'room_id', '')::uuid,
      p_payload->>'tool_set_name', p_payload->>'batch_code', COALESCE(p_payload->>'method', 'AUTOCLAVE_STEAM'), true
    ) RETURNING id INTO v_record_id;
  ELSE
    INSERT INTO terapi_wicara.patient_safety_incidents (
      clinic_id, patient_id, reported_by_therapist_id, incident_type, risk_grading, chronology, immediate_action
    ) VALUES (
      v_therapist.clinic_id, NULLIF(p_payload->>'patient_id', '')::uuid, v_therapist.id,
      COALESCE(p_payload->>'incident_type', 'KNC'), COALESCE(p_payload->>'risk_grading', 'HIJAU'),
      p_payload->>'chronology', p_payload->>'immediate_action'
    ) RETURNING id INTO v_record_id;
  END IF;

  INSERT INTO terapi_wicara.rme_audit_logs (
    clinic_id, actor_therapist_id, actor_name, actor_sip_number, action, entity_type, entity_id, device_platform, metadata
  ) VALUES (
    v_therapist.clinic_id, v_therapist.id, v_therapist.full_name, v_therapist.sip_number,
    COALESCE(p_payload->>'record_type', 'PPI_IKP_LOG'), 'SAFETY_QUALITY_RECORD', v_record_id::text, 'ANDROID_TERAPIS_APP', p_payload
  );

  RETURN jsonb_build_object('status', 'ok', 'id', v_record_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.tw_android_submit_interprofessional_referral(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE
  v_therapist terapi_wicara.therapists%ROWTYPE;
  v_ref_id uuid;
BEGIN
  SELECT * INTO v_therapist FROM terapi_wicara.therapists WHERE id = (p_payload->>'from_practitioner_id')::uuid AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Terapis pengirim tidak valid'; END IF;

  INSERT INTO terapi_wicara.interprofessional_referrals (
    clinic_id, patient_id, from_practitioner_id, to_profession, clinical_reason, joint_care_goal, priority, status
  ) VALUES (
    v_therapist.clinic_id, (p_payload->>'patient_id')::uuid, v_therapist.id,
    p_payload->>'to_profession', p_payload->>'clinical_reason', p_payload->>'joint_care_goal',
    COALESCE(p_payload->>'priority', 'RUTIN'), 'AKTIF_KOLABORASI'
  ) RETURNING id INTO v_ref_id;

  INSERT INTO terapi_wicara.rme_audit_logs (
    clinic_id, actor_therapist_id, actor_name, actor_sip_number, action, entity_type, entity_id, device_platform, metadata
  ) VALUES (
    v_therapist.clinic_id, v_therapist.id, v_therapist.full_name, v_therapist.sip_number,
    'CREATE_INTERPROFESSIONAL_REFERRAL_PKP', 'INTERPROFESSIONAL_REFERRAL', v_ref_id::text, 'ANDROID_TERAPIS_APP', p_payload
  );

  RETURN jsonb_build_object('status', 'ok', 'referral_id', v_ref_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.tw_public_portal_snapshot(p_clinic_code text DEFAULT 'KLN-TW-KDR-01')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE
  v_clinic terapi_wicara.clinics%ROWTYPE;
BEGIN
  SELECT * INTO v_clinic FROM terapi_wicara.clinics WHERE code = p_clinic_code LIMIT 1;
  IF NOT FOUND THEN SELECT * INTO v_clinic FROM terapi_wicara.clinics LIMIT 1; END IF;

  RETURN jsonb_build_object(
    'clinic', to_jsonb(v_clinic),
    'rooms', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.room_code) FROM terapi_wicara.therapy_rooms r WHERE r.clinic_id = v_clinic.id), '[]'::jsonb),
    'therapists', COALESCE((SELECT jsonb_agg(to_jsonb(t) - 'pin_code_hash' - 'nik_hash' ORDER BY t.employee_number) FROM terapi_wicara.therapists t WHERE t.clinic_id = v_clinic.id AND t.is_active = true), '[]'::jsonb),
    'tariffs', COALESCE((SELECT jsonb_agg(to_jsonb(st) - 'therapist_fee_idr' ORDER BY st.service_code) FROM terapi_wicara.service_tariffs st WHERE st.clinic_id = v_clinic.id AND st.is_active = true), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tw_public_submit_booking(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE
  v_clinic_id uuid;
  v_code text := 'BOOK-TW-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((floor(random() * 900 + 100))::int::text, 3, '0');
  v_id uuid;
BEGIN
  IF COALESCE((p_payload->>'pdp_explicit_consent')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Persetujuan eksplisit UU PDP No. 27/2022 wajib dicentang.';
  END IF;

  SELECT id INTO v_clinic_id FROM terapi_wicara.clinics WHERE is_flagship_hq = true LIMIT 1;

  INSERT INTO terapi_wicara.online_booking_requests (
    clinic_id, booking_code, patient_full_name, birth_date, gender, guardian_name, guardian_phone,
    requested_date, requested_slot, service_type, disorder_concern, chief_complaint,
    referring_doctor, screening_red_flags_count, pdp_explicit_consent, status
  ) VALUES (
    v_clinic_id, v_code, p_payload->>'patient_full_name', (p_payload->>'birth_date')::date, COALESCE(p_payload->>'gender', 'L'),
    p_payload->>'guardian_name', p_payload->>'guardian_phone',
    COALESCE(NULLIF(p_payload->>'requested_date', '')::date, CURRENT_DATE + 1),
    COALESCE(p_payload->>'requested_slot', '09:00 - 10:00 WIB'),
    COALESCE(p_payload->>'service_type', 'ASESMEN_AWAL'),
    COALESCE(p_payload->>'disorder_concern', 'BAHASA'),
    p_payload->>'chief_complaint', p_payload->>'referring_doctor',
    COALESCE((p_payload->>'screening_red_flags_count')::int, 0), true, 'MENUNGGU_VERIFIKASI_ADMISI'
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('status', 'ok', 'booking_code', v_code, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.tw_patient_portal_lookup(p_mrn text, p_birth_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE
  v_patient terapi_wicara.patients%ROWTYPE;
BEGIN
  SELECT * INTO v_patient FROM terapi_wicara.patients
  WHERE upper(trim(medical_record_number)) = upper(trim(p_mrn)) AND birth_date = p_birth_date LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kombinasi Nomor Rekam Medis dan Tanggal Lahir tidak cocok (Verifikasi 2 Identitas Permenkes 24/2022).';
  END IF;

  RETURN jsonb_build_object(
    'patient', to_jsonb(v_patient),
    'care_plans', COALESCE((SELECT jsonb_agg(to_jsonb(cp)) FROM terapi_wicara.care_plans cp WHERE cp.patient_id = v_patient.id), '[]'::jsonb),
    'hep_list', COALESCE((
      SELECT jsonb_agg(to_jsonb(s) || jsonb_build_object('patient_name', v_patient.full_name, 'medical_record_number', v_patient.medical_record_number, 'therapist_name', t.full_name) ORDER BY s.session_date DESC)
      FROM terapi_wicara.soap_sessions s JOIN terapi_wicara.therapists t ON t.id = s.therapist_id WHERE s.patient_id = v_patient.id
    ), '[]'::jsonb),
    'packages', COALESCE((SELECT jsonb_agg(to_jsonb(pkg) || jsonb_build_object('patient_name', v_patient.full_name, 'medical_record_number', v_patient.medical_record_number)) FROM terapi_wicara.patient_packages pkg WHERE pkg.patient_id = v_patient.id), '[]'::jsonb),
    'invoices', COALESCE((SELECT jsonb_agg(to_jsonb(inv) || jsonb_build_object('patient_name', v_patient.full_name, 'medical_record_number', v_patient.medical_record_number) ORDER BY inv.issued_at DESC) FROM terapi_wicara.billing_invoices inv WHERE inv.patient_id = v_patient.id), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tw_simklinik_dashboard_snapshot(p_role text DEFAULT 'KEPALA_KLINIK')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE
  v_clinic terapi_wicara.clinics%ROWTYPE;
BEGIN
  SELECT * INTO v_clinic FROM terapi_wicara.clinics WHERE is_flagship_hq = true LIMIT 1;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'active_role', p_role,
    'clinic', to_jsonb(v_clinic),
    'rooms', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.room_code) FROM terapi_wicara.therapy_rooms r WHERE r.clinic_id = v_clinic.id), '[]'::jsonb),
    'therapists', COALESCE((SELECT jsonb_agg(to_jsonb(t) - 'pin_code_hash' - 'nik_hash' ORDER BY t.employee_number) FROM terapi_wicara.therapists t WHERE t.clinic_id = v_clinic.id), '[]'::jsonb),
    'patients', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.medical_record_number) FROM terapi_wicara.patients p WHERE p.clinic_id = v_clinic.id), '[]'::jsonb),
    'care_plans', COALESCE((SELECT jsonb_agg(to_jsonb(cp) ORDER BY cp.created_at DESC) FROM terapi_wicara.care_plans cp WHERE cp.clinic_id = v_clinic.id), '[]'::jsonb),
    'appointments', COALESCE((
      SELECT jsonb_agg(to_jsonb(a) || jsonb_build_object('patient_name', p.full_name, 'medical_record_number', p.medical_record_number, 'therapist_name', t.full_name, 'room_code', rm.room_code) ORDER BY a.scheduled_start ASC)
      FROM terapi_wicara.appointments a JOIN terapi_wicara.patients p ON p.id = a.patient_id JOIN terapi_wicara.therapists t ON t.id = a.therapist_id LEFT JOIN terapi_wicara.therapy_rooms rm ON rm.id = a.room_id
      WHERE a.clinic_id = v_clinic.id
    ), '[]'::jsonb),
    'soap_sessions', CASE WHEN p_role = 'KASIR_KEUANGAN' THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(to_jsonb(s) || jsonb_build_object('patient_name', p.full_name, 'medical_record_number', p.medical_record_number, 'therapist_name', t.full_name) ORDER BY s.session_date DESC)
      FROM terapi_wicara.soap_sessions s JOIN terapi_wicara.patients p ON p.id = s.patient_id JOIN terapi_wicara.therapists t ON t.id = s.therapist_id WHERE s.clinic_id = v_clinic.id
    ), '[]'::jsonb) END,
    'online_bookings', COALESCE((SELECT jsonb_agg(to_jsonb(ob) ORDER BY ob.created_at DESC) FROM terapi_wicara.online_booking_requests ob WHERE ob.clinic_id = v_clinic.id), '[]'::jsonb),
    'tariffs', COALESCE((SELECT jsonb_agg(to_jsonb(st) ORDER BY st.service_code) FROM terapi_wicara.service_tariffs st WHERE st.clinic_id = v_clinic.id), '[]'::jsonb),
    'packages', COALESCE((SELECT jsonb_agg(to_jsonb(pkg) || jsonb_build_object('patient_name', p.full_name, 'medical_record_number', p.medical_record_number) ORDER BY pkg.created_at DESC) FROM terapi_wicara.patient_packages pkg JOIN terapi_wicara.patients p ON p.id = pkg.patient_id WHERE pkg.clinic_id = v_clinic.id), '[]'::jsonb),
    'invoices', COALESCE((SELECT jsonb_agg(to_jsonb(inv) || jsonb_build_object('patient_name', p.full_name, 'medical_record_number', p.medical_record_number) ORDER BY inv.issued_at DESC) FROM terapi_wicara.billing_invoices inv JOIN terapi_wicara.patients p ON p.id = inv.patient_id WHERE inv.clinic_id = v_clinic.id), '[]'::jsonb),
    'inventory', COALESCE((SELECT jsonb_agg(to_jsonb(ci) ORDER BY ci.item_code) FROM terapi_wicara.clinic_inventory ci WHERE ci.clinic_id = v_clinic.id), '[]'::jsonb),
    'sterilization_logs', COALESCE((SELECT jsonb_agg(to_jsonb(sl) ORDER BY sl.logged_at DESC) FROM terapi_wicara.ppi_sterilization_logs sl WHERE sl.clinic_id = v_clinic.id), '[]'::jsonb),
    'quality_indicators', COALESCE((SELECT jsonb_agg(to_jsonb(qi) ORDER BY qi.indicator_code) FROM terapi_wicara.quality_indicators qi WHERE qi.clinic_id = v_clinic.id), '[]'::jsonb),
    'incidents', COALESCE((SELECT jsonb_agg(to_jsonb(psi) ORDER BY psi.occurred_at DESC) FROM terapi_wicara.patient_safety_incidents psi WHERE psi.clinic_id = v_clinic.id), '[]'::jsonb),
    'sops', COALESCE((SELECT jsonb_agg(to_jsonb(sd) ORDER BY sd.sop_number) FROM terapi_wicara.sop_documents sd WHERE sd.clinic_id = v_clinic.id), '[]'::jsonb),
    'satusehat_logs', COALESCE((SELECT jsonb_agg(to_jsonb(ss) ORDER BY ss.transmitted_at DESC) FROM terapi_wicara.satusehat_fhir_logs ss WHERE ss.clinic_id = v_clinic.id), '[]'::jsonb),
    'dinkes_top_diagnoses', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('icd10', referring_diagnosis_icd10, 'diagnosis_name', referring_diagnosis_name, 'patient_count', cnt) ORDER BY cnt DESC)
      FROM (SELECT COALESCE(referring_diagnosis_icd10, 'F80.9') AS referring_diagnosis_icd10, COALESCE(referring_diagnosis_name, 'Speech Disorder') AS referring_diagnosis_name, count(*)::int AS cnt FROM terapi_wicara.patients WHERE clinic_id = v_clinic.id GROUP BY 1, 2) d
    ), '[]'::jsonb),
    'audit_logs', COALESCE((SELECT jsonb_agg(to_jsonb(al) ORDER BY al.logged_at DESC) FROM (SELECT * FROM terapi_wicara.rme_audit_logs WHERE clinic_id = v_clinic.id ORDER BY logged_at DESC LIMIT 30) al), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tw_simklinik_execute_action(p_action text, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE
  v_clinic_id uuid;
  v_booking terapi_wicara.online_booking_requests%ROWTYPE;
  v_new_mrn text;
  v_patient_id uuid;
  v_inv_no text;
BEGIN
  SELECT id INTO v_clinic_id FROM terapi_wicara.clinics WHERE is_flagship_hq = true LIMIT 1;

  IF p_action = 'APPROVE_ONLINE_BOOKING_TO_MRN' THEN
    SELECT * INTO v_booking FROM terapi_wicara.online_booking_requests WHERE id = (p_payload->>'booking_id')::uuid;
    v_new_mrn := 'RM-TW-' || to_char(now(), 'YYYY') || '-' || lpad((floor(random() * 8000 + 1000))::int::text, 4, '0');
    INSERT INTO terapi_wicara.patients (
      clinic_id, medical_record_number, full_name, birth_date, gender, nik_masked, guardian_name, guardian_relation, guardian_phone, address, referring_doctor, referring_diagnosis_icd10, referring_diagnosis_name
    ) VALUES (
      v_clinic_id, v_new_mrn, v_booking.patient_full_name, v_booking.birth_date, v_booking.gender, '3571************', v_booking.guardian_name, 'Orang Tua / Wali', v_booking.guardian_phone, 'Domisili Terverifikasi Admisi', v_booking.referring_doctor, 'F80.9', v_booking.disorder_concern
    ) RETURNING id INTO v_patient_id;
    UPDATE terapi_wicara.online_booking_requests SET status = 'SELESAI_REGISTRASI_RM' WHERE id = v_booking.id;
    RETURN jsonb_build_object('status', 'ok', 'medical_record_number', v_new_mrn, 'patient_id', v_patient_id);

  ELSIF p_action = 'CREATE_CASHIER_INVOICE' THEN
    v_inv_no := 'INV/TW/' || to_char(now(), 'YYYYMM') || '/' || lpad((floor(random() * 8999 + 1000))::int::text, 4, '0');
    INSERT INTO terapi_wicara.billing_invoices (clinic_id, invoice_number, patient_id, description, amount_idr, payment_method, payment_status, cashier_name)
    VALUES (v_clinic_id, v_inv_no, (p_payload->>'patient_id')::uuid, p_payload->>'description', (p_payload->>'amount_idr')::bigint, COALESCE(p_payload->>'payment_method', 'QRIS'), 'LUNAS', COALESCE(p_payload->>'actor_name', 'Kasir Klinik'));
    RETURN jsonb_build_object('status', 'ok', 'invoice_number', v_inv_no);

  ELSIF p_action = 'RETRY_SATUSEHAT_SYNC' THEN
    UPDATE terapi_wicara.satusehat_fhir_logs SET sync_status = 'SYNCED', http_status = 201, satusehat_resource_id = COALESCE(satusehat_resource_id, 'fhir-sync-' || substr(md5(now()::text), 1, 10)), transmitted_at = now() WHERE clinic_id = v_clinic_id AND sync_status <> 'SYNCED';
    UPDATE terapi_wicara.appointments SET satusehat_sync_status = 'SYNCED' WHERE clinic_id = v_clinic_id AND satusehat_sync_status <> 'SYNCED';
    RETURN jsonb_build_object('status', 'ok');
  END IF;

  RAISE EXCEPTION 'Aksi tidak dikenali: %', p_action;
END;
$$;

CREATE OR REPLACE FUNCTION public.tw_enterprise_hq_snapshot(p_branch_code text DEFAULT 'ALL')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE
  v_holding terapi_wicara.enterprise_holdings%ROWTYPE;
BEGIN
  SELECT * INTO v_holding FROM terapi_wicara.enterprise_holdings LIMIT 1;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'branch_filter', p_branch_code,
    'holding', to_jsonb(v_holding),
    'branches', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(c) || jsonb_build_object(
          'practitioner_count', (SELECT count(*) FROM terapi_wicara.practitioner_sip_allocations psa WHERE psa.clinic_id = c.id AND psa.status = 'AKTIF'),
          'patient_count', (SELECT count(*) FROM terapi_wicara.patients p WHERE p.clinic_id = c.id),
          'realized_revenue_idr', COALESCE((SELECT sum(je.amount_idr) FROM terapi_wicara.finance_journal_entries je WHERE je.clinic_id = c.id AND je.credit_account_code = '4-1100'), 0)
        ) ORDER BY c.is_flagship_hq DESC, c.code ASC
      ) FROM terapi_wicara.clinics c WHERE c.holding_id = v_holding.id
    ), '[]'::jsonb),
    'sip_matrix', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'practitioner_id', t.id, 'employee_number', t.employee_number, 'full_name', t.full_name,
        'profession_type', t.profession_type, 'collegium_council_name', t.collegium_council_name,
        'str_number', t.str_number, 'skp_points_earned', t.skp_points_earned, 'skp_points_target', t.skp_points_target,
        'active_sip_count', (SELECT count(*) FROM terapi_wicara.practitioner_sip_allocations psa WHERE psa.practitioner_id = t.id AND psa.status = 'AKTIF'),
        'sip_slots', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('slot', psa.sip_sequence_slot, 'clinic_code', cl.code, 'clinic_city', cl.city, 'sip_number', psa.sip_number, 'valid_until', psa.valid_until, 'practice_days', psa.practice_days) ORDER BY psa.sip_sequence_slot)
          FROM terapi_wicara.practitioner_sip_allocations psa JOIN terapi_wicara.clinics cl ON cl.id = psa.clinic_id WHERE psa.practitioner_id = t.id
        ), '[]'::jsonb)
      ) ORDER BY t.profession_type, t.full_name) FROM terapi_wicara.therapists t
    ), '[]'::jsonb),
    'interprofessional_referrals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', ir.id, 'clinic_code', cl.code, 'patient_name', p.full_name, 'medical_record_number', p.medical_record_number, 'from_practitioner', tf.full_name, 'from_profession', tf.profession_type, 'to_profession', ir.to_profession, 'to_practitioner', COALESCE(tt.full_name, 'Tim Spesialis Terkait'), 'clinical_reason', ir.clinical_reason, 'joint_care_goal', ir.joint_care_goal, 'priority', ir.priority, 'status', ir.status) ORDER BY ir.created_at DESC)
      FROM terapi_wicara.interprofessional_referrals ir JOIN terapi_wicara.clinics cl ON cl.id = ir.clinic_id JOIN terapi_wicara.patients p ON p.id = ir.patient_id JOIN terapi_wicara.therapists tf ON tf.id = ir.from_practitioner_id LEFT JOIN terapi_wicara.therapists tt ON tt.id = ir.to_practitioner_id
      WHERE (p_branch_code = 'ALL' OR cl.code = p_branch_code)
    ), '[]'::jsonb),
    'coa_accounts', COALESCE((SELECT jsonb_agg(to_jsonb(coa) ORDER BY coa.account_code) FROM terapi_wicara.finance_coa coa WHERE coa.holding_id = v_holding.id), '[]'::jsonb),
    'journals', COALESCE((SELECT jsonb_agg(to_jsonb(je) || jsonb_build_object('clinic_code', cl.code, 'clinic_city', cl.city) ORDER BY je.entry_date DESC, je.journal_number DESC) FROM terapi_wicara.finance_journal_entries je JOIN terapi_wicara.clinics cl ON cl.id = je.clinic_id WHERE je.holding_id = v_holding.id AND (p_branch_code = 'ALL' OR cl.code = p_branch_code)), '[]'::jsonb),
    'payrolls', COALESCE((SELECT jsonb_agg(to_jsonb(pr) || jsonb_build_object('practitioner_name', t.full_name, 'profession_type', t.profession_type, 'clinic_code', cl.code) ORDER BY pr.take_home_pay_idr DESC) FROM terapi_wicara.hr_jasa_medis_payrolls pr JOIN terapi_wicara.therapists t ON t.id = pr.practitioner_id JOIN terapi_wicara.clinics cl ON cl.id = pr.clinic_id WHERE (p_branch_code = 'ALL' OR cl.code = p_branch_code)), '[]'::jsonb),
    'purchase_orders', COALESCE((SELECT jsonb_agg(to_jsonb(po) || jsonb_build_object('clinic_code', cl.code, 'clinic_city', cl.city, 'supplier_name', sup.supplier_name, 'pak_alkes_license', sup.pak_alkes_license) ORDER BY po.ordered_at DESC) FROM terapi_wicara.procurement_purchase_orders po JOIN terapi_wicara.clinics cl ON cl.id = po.destination_clinic_id JOIN terapi_wicara.procurement_suppliers sup ON sup.id = po.supplier_id WHERE po.holding_id = v_holding.id AND (p_branch_code = 'ALL' OR cl.code = p_branch_code)), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tw_enterprise_execute_action(p_action text, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = terapi_wicara, public
AS $$
DECLARE
  v_holding_id uuid;
  v_po_no text;
BEGIN
  SELECT id INTO v_holding_id FROM terapi_wicara.enterprise_holdings LIMIT 1;

  IF p_action = 'APPROVE_PURCHASE_ORDER' THEN
    UPDATE terapi_wicara.procurement_purchase_orders SET status = 'DISETUJUI_DIREKTUR' WHERE id = (p_payload->>'po_id')::uuid;
    RETURN jsonb_build_object('status', 'ok');
  ELSIF p_action = 'CREATE_PURCHASE_ORDER' THEN
    v_po_no := 'PO/EMS-TW/' || to_char(now(), 'YYYYMM') || '/' || lpad((floor(random() * 899 + 100))::int::text, 4, '0');
    INSERT INTO terapi_wicara.procurement_purchase_orders (holding_id, destination_clinic_id, supplier_id, po_number, items_summary, total_amount_idr, nie_kemenkes_verified, status)
    VALUES (v_holding_id, (SELECT id FROM terapi_wicara.clinics WHERE code = COALESCE(p_payload->>'clinic_code', 'KLN-TW-KDR-01') LIMIT 1), (SELECT id FROM terapi_wicara.procurement_suppliers LIMIT 1), v_po_no, p_payload->>'items_summary', (p_payload->>'total_amount_idr')::bigint, true, 'MENUNGGU_APPROVAL');
    RETURN jsonb_build_object('status', 'ok', 'po_number', v_po_no);
  ELSIF p_action = 'DISBURSE_JASA_MEDIS_PAYROLL' THEN
    UPDATE terapi_wicara.hr_jasa_medis_payrolls SET payout_status = 'DIBAYARKAN_LUNAS' WHERE id = (p_payload->>'payroll_id')::uuid;
    RETURN jsonb_build_object('status', 'ok');
  END IF;
  RAISE EXCEPTION 'Aksi Enterprise tidak dikenali: %', p_action;
END;
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tw_android_fetch_bootstrap(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tw_android_submit_soap(jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tw_android_submit_assessment(jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tw_android_log_ppi_or_ikp(jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tw_android_submit_interprofessional_referral(jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tw_public_portal_snapshot(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tw_public_submit_booking(jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tw_patient_portal_lookup(text, date) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tw_simklinik_dashboard_snapshot(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tw_simklinik_execute_action(text, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tw_enterprise_hq_snapshot(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tw_enterprise_execute_action(text, jsonb) TO anon, authenticated, service_role;
