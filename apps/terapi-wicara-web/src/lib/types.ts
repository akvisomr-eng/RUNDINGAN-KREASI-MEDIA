export type SimklinikRole =
  | 'KEPALA_KLINIK'
  | 'ADMISI_RME'
  | 'TERAPIS_WICARA'
  | 'KASIR_KEUANGAN'
  | 'MUTU_DINKES';

export interface SimklinikSnapshot {
  generated_at: string;
  active_role: SimklinikRole;
  clinic: {
    id: string;
    code: string;
    name: string;
    dinkes_license_number: string;
    oss_nib: string;
    fasyankes_code: string;
    satusehat_org_id: string;
    accreditation_status: string;
    head_of_clinic_name: string;
    address: string;
    city: string;
    province: string;
    phone: string;
  };
  rooms: Array<{
    id: string;
    room_code: string;
    room_name: string;
    satusehat_location_id: string;
    ambient_noise_db: number;
    has_soundproofing: boolean;
    has_therapy_mirror: boolean;
    has_observation_window: boolean;
    sterilization_status: string;
  }>;
  therapists: Array<{
    id: string;
    employee_number: string;
    full_name: string;
    degree_title: string;
    ihs_practitioner_id: string;
    ikatwi_member_number: string;
    str_number: string;
    str_is_lifetime: boolean;
    sip_number: string;
    sip_issued_by_dinkes: string;
    sip_valid_from: string;
    sip_valid_until: string;
    skp_points_earned: number;
    skp_points_target: number;
    bhd_certified_until: string;
    clinical_privilege_level: string;
    specializations: string[];
    is_active: boolean;
  }>;
  patients: Array<{
    id: string;
    medical_record_number: string;
    full_name: string;
    birth_date: string;
    gender: 'L' | 'P';
    nik_masked: string;
    ihs_patient_id: string;
    primary_language: string;
    guardian_name: string;
    guardian_relation: string;
    guardian_phone: string;
    address: string;
    referring_doctor: string;
    referring_diagnosis_icd10: string;
    referring_diagnosis_name: string;
    hearing_screening_status: string;
    clinical_alerts: string[];
    allergies: string[];
    aspiration_risk_level: string;
    pdp_consent_signed: boolean;
    audio_video_consent: boolean;
    retention_until: string;
  }>;
  care_plans: Array<{
    id: string;
    patient_id: string;
    tw_diagnosis_code: string;
    tw_diagnosis_name: string;
    medical_icd10_code: string;
    icf_codes: string[];
    disorder_domain: string;
    long_term_goal: string;
    short_term_goals: Array<{ id: string; target: string; progress: number }>;
    planned_sessions: number;
    completed_sessions: number;
    frequency_per_week: number;
    status: string;
  }>;
  appointments: Array<{
    id: string;
    patient_id: string;
    patient_name: string;
    medical_record_number: string;
    therapist_name: string;
    room_code: string;
    scheduled_start: string;
    scheduled_end: string;
    visit_type: string;
    disorder_focus: string;
    session_number: number;
    status: string;
    patient_identity_verified: boolean;
    informed_consent_verified: boolean;
    satusehat_encounter_id: string | null;
    satusehat_sync_status: string;
  }>;
  soap_sessions: Array<{
    id: string;
    patient_id: string;
    patient_name: string;
    medical_record_number: string;
    therapist_name: string;
    session_date: string;
    duration_minutes: number;
    target_skill: string;
    accuracy_percentage: number;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    home_exercise_program: string;
    icd10_code: string;
    icd9cm_code: string;
    icf_code: string;
    is_locked_tte: boolean;
    tte_certificate_serial: string;
    satusehat_synced: boolean;
  }>;
  online_bookings: Array<{
    id: string;
    booking_code: string;
    patient_full_name: string;
    birth_date: string;
    gender: 'L' | 'P';
    guardian_name: string;
    guardian_phone: string;
    requested_date: string;
    requested_slot: string;
    service_type: string;
    disorder_concern: string;
    chief_complaint: string;
    referring_doctor: string;
    screening_red_flags_count: number;
    pdp_explicit_consent: boolean;
    status: string;
  }>;
  tariffs: Array<{
    id: string;
    service_code: string;
    service_name: string;
    category: string;
    icd9cm_code: string;
    duration_minutes: number;
    sessions_included: number;
    unit_price_idr: number;
    therapist_fee_idr?: number;
  }>;
  packages: Array<{
    id: string;
    patient_name: string;
    medical_record_number: string;
    package_name: string;
    total_sessions: number;
    used_sessions: number;
    remaining_sessions: number;
    total_paid_idr: number;
    recognized_revenue_idr: number;
    deferred_revenue_idr: number;
    valid_until: string;
    status: string;
  }>;
  invoices: Array<{
    id: string;
    invoice_number: string;
    patient_name: string;
    medical_record_number: string;
    description: string;
    amount_idr: number;
    payment_method: string;
    payment_status: string;
    cashier_name: string;
    issued_at: string;
  }>;
  inventory: Array<{
    id: string;
    item_code: string;
    item_name: string;
    category: string;
    stock_qty: number;
    min_stock_alert: number;
    unit: string;
    condition_status: string;
    last_calibrated_date: string | null;
    next_calibration_date: string | null;
    room_location: string;
  }>;
  sterilization_logs: Array<{
    id: string;
    tool_set_name: string;
    batch_code: string;
    method: string;
    indicator_passed: boolean;
    logged_at: string;
  }>;
  quality_indicators: Array<{
    id: string;
    period_month: string;
    indicator_code: string;
    indicator_name: string;
    indicator_group: string;
    target_percentage: number;
    achieved_percentage: number;
    numerator: number;
    denominator: number;
  }>;
  incidents: Array<{
    id: string;
    incident_type: string;
    risk_grading: string;
    chronology: string;
    immediate_action: string;
    occurred_at: string;
  }>;
  sops: Array<{
    id: string;
    sop_number: string;
    title: string;
    category: string;
    regulation_reference: string;
    effective_date: string;
    revision_number: number;
    mandatory_checklist: string[];
    steps_summary: string[];
    approved_by: string;
  }>;
  satusehat_logs: Array<{
    id: string;
    fhir_resource_type: string;
    local_reference_id: string;
    patient_mrn: string;
    satusehat_resource_id: string | null;
    http_status: number;
    sync_status: string;
    payload_summary: string;
    transmitted_at: string;
  }>;
  dinkes_top_diagnoses: Array<{
    icd10: string;
    diagnosis_name: string;
    patient_count: number;
  }>;
  audit_logs: Array<{
    id: string;
    actor_name: string;
    actor_sip_number?: string;
    action: string;
    entity_type: string;
    entity_id: string;
    patient_mrn?: string;
    device_platform: string;
    logged_at: string;
  }>;
}
