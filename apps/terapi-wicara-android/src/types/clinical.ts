export type DisorderDomain =
  | 'BAHASA'
  | 'BICARA'
  | 'SUARA'
  | 'IRAMA_KELANCARAN'
  | 'MENELAN_DISFAGIA';

export type AssessmentDomain =
  | 'OPE_OROMOTOR'
  | 'BAHASA'
  | 'BICARA_ARTIKULASI'
  | 'SUARA_GRBAS'
  | 'IRAMA_GAGAP'
  | 'MENELAN_IDDSI';

export interface ClinicProfile {
  id: string;
  code: string;
  name: string;
  dinkes_license_number: string;
  oss_nib?: string;
  fasyankes_code: string;
  satusehat_org_id?: string;
  accreditation_status: 'BELUM_AKREDITASI' | 'MADYA' | 'UTAMA' | 'PARIPURNA';
  head_of_clinic_name: string;
  address: string;
  city: string;
  province: string;
  phone?: string;
}

export interface TherapyRoom {
  id: string;
  clinic_id: string;
  room_code: string;
  room_name: string;
  satusehat_location_id?: string;
  ambient_noise_db: number;
  has_soundproofing: boolean;
  has_therapy_mirror: boolean;
  has_observation_window: boolean;
  sterilization_status: 'STERIL' | 'PERLU_DISINFEKSI' | 'DALAM_PEMBERSIHAN';
  last_disinfected_at?: string;
}

export interface TherapistCredential {
  id: string;
  clinic_id: string;
  employee_number: string;
  full_name: string;
  degree_title: string;
  ihs_practitioner_id?: string;
  ikatwi_member_number?: string;
  str_number: string;
  str_is_lifetime: boolean;
  sip_number: string;
  sip_issued_by_dinkes: string;
  sip_valid_from: string;
  sip_valid_until: string;
  skp_points_earned: number;
  skp_points_target: number;
  bhd_certified_until?: string;
  clinical_privilege_level: string;
  specializations: DisorderDomain[];
  is_active: boolean;
}

export interface PatientRecord {
  id: string;
  clinic_id: string;
  medical_record_number: string;
  full_name: string;
  birth_date: string;
  gender: 'L' | 'P';
  nik_masked: string;
  ihs_patient_id?: string;
  mother_name?: string;
  primary_language: string;
  secondary_language?: string | null;
  guardian_name: string;
  guardian_relation: string;
  guardian_phone: string;
  address: string;
  referring_doctor?: string;
  referring_diagnosis_icd10?: string;
  referring_diagnosis_name?: string;
  hearing_screening_status?: string;
  clinical_alerts: string[];
  allergies: string[];
  aspiration_risk_level: 'RENDAH' | 'SEDANG' | 'TINGGI';
  pdp_consent_signed: boolean;
  audio_video_consent: boolean;
  retention_until: string;
}

export interface ShortTermGoal {
  id: string;
  target: string;
  progress: number;
}

export interface CarePlan {
  id: string;
  clinic_id: string;
  patient_id: string;
  therapist_id: string;
  tw_diagnosis_code: string;
  tw_diagnosis_name: string;
  medical_icd10_code: string;
  icf_codes: string[];
  disorder_domain: DisorderDomain;
  long_term_goal: string;
  short_term_goals: ShortTermGoal[];
  planned_sessions: number;
  completed_sessions: number;
  frequency_per_week: number;
  status: 'AKTIF' | 'EVALUASI_ULANG' | 'SELESAI_TERMINASI' | 'DIRUJUK';
}

export interface AppointmentItem {
  id: string;
  clinic_id: string;
  patient_id: string;
  therapist_id: string;
  room_id?: string;
  care_plan_id?: string;
  scheduled_start: string;
  scheduled_end: string;
  visit_type:
    | 'ASESMEN_AWAL'
    | 'TERAPI_REGULER'
    | 'EVALUASI_BERKALA'
    | 'TERAPI_MENELAN'
    | 'TELETERAPI'
    | 'HOME_VISIT';
  disorder_focus: DisorderDomain;
  session_number: number;
  status:
    | 'TERJADWAL'
    | 'CHECK_IN'
    | 'SEDANG_TERAPI'
    | 'SELESAI_SOAP_LOCKED'
    | 'BATAL'
    | 'NO_SHOW';
  patient_identity_verified: boolean;
  informed_consent_verified: boolean;
  satusehat_encounter_id?: string | null;
  satusehat_sync_status: 'PENDING' | 'SYNCED' | 'RETRY_NEEDED';
  patient_name: string;
  medical_record_number: string;
  birth_date: string;
  aspiration_risk_level: 'RENDAH' | 'SEDANG' | 'TINGGI';
  clinical_alerts: string[];
  room_name?: string;
}

export interface SoapSessionRecord {
  id: string;
  clinic_id: string;
  appointment_id?: string | null;
  patient_id: string;
  therapist_id: string;
  session_date: string;
  duration_minutes: number;
  hand_hygiene_5_moments: boolean;
  apd_compliant: boolean;
  oral_tools_sterile_verified: boolean;
  patient_two_identifiers_checked: boolean;
  target_skill: string;
  trials_independent: number;
  trials_verbal_prompt: number;
  trials_visual_prompt: number;
  trials_tactile_prompt: number;
  trials_incorrect: number;
  accuracy_percentage: number;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  home_exercise_program: string;
  caregiver_educated: boolean;
  caregiver_signature_name?: string;
  icd10_code: string;
  icd9cm_code: string;
  icf_code?: string;
  is_locked_tte: boolean;
  tte_certificate_serial?: string;
  tte_signed_at?: string;
  satusehat_synced: boolean;
  client_offline_uuid?: string;
}

export interface SopDocument {
  id: string;
  sop_number: string;
  title: string;
  category:
    | 'PELAYANAN_KLINIS'
    | 'PPI_STERILISASI'
    | 'KESELAMATAN_PASIEN'
    | 'KEGAWATDARURATAN'
    | 'RME_UU_PDP';
  regulation_reference: string;
  effective_date: string;
  revision_number: number;
  mandatory_checklist: string[];
  steps_summary: string[];
  approved_by: string;
}

export interface SterilizationLog {
  id: string;
  tool_set_name: string;
  batch_code: string;
  method: 'AUTOCLAVE_STEAM' | 'DISINFEKSI_TINGKAT_TINGGI' | 'SINGLE_USE_DISPOSED';
  indicator_passed: boolean;
  logged_at: string;
}

export interface AuditLogItem {
  id: string;
  actor_name: string;
  actor_sip_number?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  patient_mrn?: string;
  device_platform: string;
  logged_at: string;
}

export interface OfflineSyncQueueItem {
  queueId: string;
  type: 'SOAP' | 'ASSESSMENT' | 'PPI_IKP' | 'INTERPROF_REFERRAL';
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface BootstrapClinicalData {
  synced_at: string;
  clinic: ClinicProfile;
  therapist: TherapistCredential;
  rooms: TherapyRoom[];
  patients: PatientRecord[];
  care_plans: CarePlan[];
  appointments: AppointmentItem[];
  soap_sessions: SoapSessionRecord[];
  assessments: Record<string, unknown>[];
  sops: SopDocument[];
  sterilization_logs: SterilizationLog[];
  audit_logs: AuditLogItem[];
}
