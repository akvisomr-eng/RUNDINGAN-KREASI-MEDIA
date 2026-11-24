-- ============================================================================
-- ISOLATED MODULE: KLINIK TERAPI WICARA & RME (terapi_wicara schema)
-- Regulatory Compliance:
-- 1. UU No. 17 Tahun 2023 tentang Kesehatan & PP No. 28 Tahun 2024
-- 2. UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)
-- 3. Permenkes No. 24 Tahun 2022 tentang Rekam Medis (RME, TTE, 25y retention, SATUSEHAT)
-- 4. Permenkes No. 81 Tahun 2014 tentang Standar Pelayanan Terapi Wicara
-- 5. Permenkes No. 34 Tahun 2022 tentang Akreditasi Klinik (TKK, PMKP, PKP, PPI)
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS terapi_wicara;

REVOKE ALL ON SCHEMA terapi_wicara FROM PUBLIC;
GRANT USAGE ON SCHEMA terapi_wicara TO service_role;

CREATE TABLE IF NOT EXISTS terapi_wicara.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  dinkes_license_number text NOT NULL,
  oss_nib text,
  fasyankes_code text NOT NULL UNIQUE,
  satusehat_org_id text,
  accreditation_status text NOT NULL DEFAULT 'PARIPURNA'
    CHECK (accreditation_status IN ('BELUM_AKREDITASI', 'MADYA', 'UTAMA', 'PARIPURNA')),
  head_of_clinic_name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  province text NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS terapi_wicara.therapy_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES terapi_wicara.clinics(id) ON DELETE CASCADE,
  room_code text NOT NULL,
  room_name text NOT NULL,
  satusehat_location_id text,
  ambient_noise_db numeric(5,2) DEFAULT 35.00,
  has_soundproofing boolean NOT NULL DEFAULT true,
  has_therapy_mirror boolean NOT NULL DEFAULT true,
  has_observation_window boolean NOT NULL DEFAULT true,
  sterilization_status text NOT NULL DEFAULT 'STERIL'
    CHECK (sterilization_status IN ('STERIL', 'PERLU_DISINFEKSI', 'DALAM_PEMBERSIHAN')),
  last_disinfected_at timestamptz,
  UNIQUE (clinic_id, room_code)
);

CREATE TABLE IF NOT EXISTS terapi_wicara.therapists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES terapi_wicara.clinics(id) ON DELETE CASCADE,
  auth_user_id uuid UNIQUE,
  employee_number text NOT NULL UNIQUE,
  full_name text NOT NULL,
  degree_title text NOT NULL DEFAULT 'S.Tr.Kes',
  nik_hash text,
  ihs_practitioner_id text UNIQUE,
  ikatwi_member_number text,
  str_number text NOT NULL,
  str_is_lifetime boolean NOT NULL DEFAULT true,
  sip_number text NOT NULL,
  sip_issued_by_dinkes text NOT NULL,
  sip_valid_from date NOT NULL,
  sip_valid_until date NOT NULL,
  skp_points_earned numeric(6,2) NOT NULL DEFAULT 0,
  skp_points_target numeric(6,2) NOT NULL DEFAULT 250,
  bhd_certified_until date,
  clinical_privilege_level text NOT NULL DEFAULT 'TERAPIS_WICARA_MAHIR'
    CHECK (clinical_privilege_level IN ('TERAPIS_WICARA_PELAKSANA', 'TERAPIS_WICARA_MAHIR', 'TERAPIS_WICARA_PENYELIA', 'SPESIALIS_DISFAGIA_AVT')),
  specializations text[] NOT NULL DEFAULT ARRAY['BAHASA','BICARA','SUARA','IRAMA_KELANCARAN','MENELAN_DISFAGIA'],
  pin_code_hash text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS terapi_wicara.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES terapi_wicara.clinics(id) ON DELETE CASCADE,
  medical_record_number text NOT NULL,
  full_name text NOT NULL,
  birth_date date NOT NULL,
  gender text NOT NULL CHECK (gender IN ('L', 'P')),
  nik_masked text NOT NULL,
  ihs_patient_id text,
  mother_name text,
  primary_language text NOT NULL DEFAULT 'Bahasa Indonesia',
  secondary_language text,
  guardian_name text NOT NULL,
  guardian_relation text NOT NULL,
  guardian_phone text NOT NULL,
  address text NOT NULL,
  referring_doctor text,
  referring_diagnosis_icd10 text,
  referring_diagnosis_name text,
  hearing_screening_status text DEFAULT 'NORMAL_OAE_BERA',
  clinical_alerts jsonb NOT NULL DEFAULT '[]'::jsonb,
  allergies text[] NOT NULL DEFAULT ARRAY[]::text[],
  aspiration_risk_level text NOT NULL DEFAULT 'RENDAH'
    CHECK (aspiration_risk_level IN ('RENDAH', 'SEDANG', 'TINGGI')),
  pdp_consent_signed boolean NOT NULL DEFAULT true,
  pdp_consent_signed_at timestamptz DEFAULT now(),
  audio_video_consent boolean NOT NULL DEFAULT true,
  retention_until date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '25 years')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, medical_record_number)
);

CREATE TABLE IF NOT EXISTS terapi_wicara.care_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES terapi_wicara.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES terapi_wicara.patients(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES terapi_wicara.therapists(id),
  tw_diagnosis_code text NOT NULL,
  tw_diagnosis_name text NOT NULL,
  medical_icd10_code text NOT NULL,
  icf_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  disorder_domain text NOT NULL
    CHECK (disorder_domain IN ('BAHASA', 'BICARA', 'SUARA', 'IRAMA_KELANCARAN', 'MENELAN_DISFAGIA')),
  long_term_goal text NOT NULL,
  short_term_goals jsonb NOT NULL DEFAULT '[]'::jsonb,
  planned_sessions int NOT NULL DEFAULT 12,
  completed_sessions int NOT NULL DEFAULT 0,
  frequency_per_week int NOT NULL DEFAULT 2,
  status text NOT NULL DEFAULT 'AKTIF'
    CHECK (status IN ('AKTIF', 'EVALUASI_ULANG', 'SELESAI_TERMINASI', 'DIRUJUK')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS terapi_wicara.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES terapi_wicara.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES terapi_wicara.patients(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES terapi_wicara.therapists(id),
  room_id uuid REFERENCES terapi_wicara.therapy_rooms(id),
  care_plan_id uuid REFERENCES terapi_wicara.care_plans(id),
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  visit_type text NOT NULL DEFAULT 'TERAPI_REGULER'
    CHECK (visit_type IN ('ASESMEN_AWAL', 'TERAPI_REGULER', 'EVALUASI_BERKALA', 'TERAPI_MENELAN', 'TELETERAPI', 'HOME_VISIT')),
  disorder_focus text NOT NULL
    CHECK (disorder_focus IN ('BAHASA', 'BICARA', 'SUARA', 'IRAMA_KELANCARAN', 'MENELAN_DISFAGIA')),
  session_number int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'TERJADWAL'
    CHECK (status IN ('TERJADWAL', 'CHECK_IN', 'SEDANG_TERAPI', 'SELESAI_SOAP_LOCKED', 'BATAL', 'NO_SHOW')),
  patient_identity_verified boolean NOT NULL DEFAULT false,
  informed_consent_verified boolean NOT NULL DEFAULT false,
  satusehat_encounter_id text,
  satusehat_sync_status text NOT NULL DEFAULT 'PENDING'
    CHECK (satusehat_sync_status IN ('PENDING', 'SYNCED', 'RETRY_NEEDED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS terapi_wicara.clinical_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES terapi_wicara.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES terapi_wicara.patients(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES terapi_wicara.therapists(id),
  appointment_id uuid REFERENCES terapi_wicara.appointments(id),
  assessment_date timestamptz NOT NULL DEFAULT now(),
  domain text NOT NULL
    CHECK (domain IN ('OPE_OROMOTOR', 'BAHASA', 'BICARA_ARTIKULASI', 'SUARA_GRBAS', 'IRAMA_GAGAP', 'MENELAN_IDDSI')),
  ope_findings jsonb DEFAULT '{}'::jsonb,
  ddk_amr_pa_per_sec numeric(5,2),
  ddk_amr_ta_per_sec numeric(5,2),
  ddk_amr_ka_per_sec numeric(5,2),
  ddk_smr_pataka_per_sec numeric(5,2),
  pcc_score numeric(5,2),
  articulation_matrix jsonb DEFAULT '[]'::jsonb,
  phonological_processes text[] DEFAULT ARRAY[]::text[],
  receptive_age_equivalent_months int,
  expressive_age_equivalent_months int,
  pragmatic_checklist jsonb DEFAULT '{}'::jsonb,
  grbas_score jsonb DEFAULT '{}'::jsonb,
  mpt_seconds numeric(6,2),
  sz_ratio numeric(5,2),
  total_syllables_counted int,
  stuttered_syllables_counted int,
  percent_syllables_stuttered numeric(5,2),
  secondary_behaviors text[] DEFAULT ARRAY[]::text[],
  iddsi_liquid_level int CHECK (iddsi_liquid_level BETWEEN 0 AND 7),
  iddsi_food_level int CHECK (iddsi_food_level BETWEEN 0 AND 7),
  spo2_baseline int,
  spo2_post_swallow int,
  aspiration_signs text[] DEFAULT ARRAY[]::text[],
  clinical_conclusion text NOT NULL,
  icd10_code text,
  icd9cm_procedure_code text DEFAULT '93.75',
  icf_codes text[] DEFAULT ARRAY[]::text[],
  signed_tte_hash text,
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS terapi_wicara.soap_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES terapi_wicara.clinics(id) ON DELETE CASCADE,
  appointment_id uuid UNIQUE REFERENCES terapi_wicara.appointments(id) ON DELETE SET NULL,
  patient_id uuid NOT NULL REFERENCES terapi_wicara.patients(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES terapi_wicara.therapists(id),
  session_date timestamptz NOT NULL DEFAULT now(),
  duration_minutes int NOT NULL DEFAULT 45,
  hand_hygiene_5_moments boolean NOT NULL DEFAULT true,
  apd_compliant boolean NOT NULL DEFAULT true,
  oral_tools_sterile_verified boolean NOT NULL DEFAULT true,
  patient_two_identifiers_checked boolean NOT NULL DEFAULT true,
  target_skill text NOT NULL,
  trials_independent int NOT NULL DEFAULT 0,
  trials_verbal_prompt int NOT NULL DEFAULT 0,
  trials_visual_prompt int NOT NULL DEFAULT 0,
  trials_tactile_prompt int NOT NULL DEFAULT 0,
  trials_incorrect int NOT NULL DEFAULT 0,
  accuracy_percentage numeric(5,2) NOT NULL DEFAULT 0,
  subjective text NOT NULL,
  objective text NOT NULL,
  assessment text NOT NULL,
  plan text NOT NULL,
  home_exercise_program text NOT NULL,
  caregiver_educated boolean NOT NULL DEFAULT true,
  caregiver_signature_name text,
  icd10_code text NOT NULL,
  icd9cm_code text NOT NULL DEFAULT '93.75',
  icf_code text,
  is_locked_tte boolean NOT NULL DEFAULT true,
  tte_certificate_serial text,
  tte_signed_at timestamptz DEFAULT now(),
  addendum_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  satusehat_synced boolean NOT NULL DEFAULT false,
  client_offline_uuid text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS terapi_wicara.sop_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES terapi_wicara.clinics(id) ON DELETE CASCADE,
  sop_number text NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL
    CHECK (category IN ('PELAYANAN_KLINIS', 'PPI_STERILISASI', 'KESELAMATAN_PASIEN', 'KEGAWATDARURATAN', 'RME_UU_PDP')),
  regulation_reference text NOT NULL,
  effective_date date NOT NULL,
  revision_number int NOT NULL DEFAULT 1,
  mandatory_checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  steps_summary text[] NOT NULL DEFAULT ARRAY[]::text[],
  approved_by text NOT NULL
);

CREATE TABLE IF NOT EXISTS terapi_wicara.ppi_sterilization_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES terapi_wicara.clinics(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES terapi_wicara.therapists(id),
  room_id uuid REFERENCES terapi_wicara.therapy_rooms(id),
  tool_set_name text NOT NULL,
  batch_code text NOT NULL,
  method text NOT NULL CHECK (method IN ('AUTOCLAVE_STEAM', 'DISINFEKSI_TINGKAT_TINGGI', 'SINGLE_USE_DISPOSED')),
  indicator_passed boolean NOT NULL DEFAULT true,
  logged_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS terapi_wicara.patient_safety_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES terapi_wicara.clinics(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES terapi_wicara.patients(id),
  reported_by_therapist_id uuid NOT NULL REFERENCES terapi_wicara.therapists(id),
  incident_type text NOT NULL CHECK (incident_type IN ('KPC', 'KNC', 'KTC', 'KTD', 'SENTINEL')),
  risk_grading text NOT NULL CHECK (risk_grading IN ('BIRU', 'HIJAU', 'KUNING', 'MERAH')),
  chronology text NOT NULL,
  immediate_action text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  reported_to_tim_mutu boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS terapi_wicara.rme_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES terapi_wicara.clinics(id) ON DELETE CASCADE,
  actor_therapist_id uuid REFERENCES terapi_wicara.therapists(id),
  actor_name text NOT NULL,
  actor_sip_number text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  patient_mrn text,
  device_platform text NOT NULL DEFAULT 'ANDROID_TERAPIS_APP',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  logged_at timestamptz NOT NULL DEFAULT now()
);
