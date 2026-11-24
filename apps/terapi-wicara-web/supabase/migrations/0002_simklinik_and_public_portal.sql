-- Phase 2 Migration Reference: SIMKLINIK Tariffs, Packages, Billing, Inventory/MFK,
-- INM Quality Indicators, SATUSEHAT FHIR Queue, Online Bookings & Secure RPCs.
-- Applied live to isolated PostgreSQL schema `terapi_wicara` (migrations 019 & 020).

CREATE TABLE IF NOT EXISTS terapi_wicara.service_tariffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES terapi_wicara.clinics(id) ON DELETE CASCADE,
  service_code text NOT NULL,
  service_name text NOT NULL,
  category text NOT NULL,
  icd9cm_code text NOT NULL DEFAULT '93.75',
  duration_minutes int NOT NULL DEFAULT 45,
  sessions_included int NOT NULL DEFAULT 1,
  unit_price_idr bigint NOT NULL,
  therapist_fee_idr bigint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (clinic_id, service_code)
);

CREATE TABLE IF NOT EXISTS terapi_wicara.patient_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES terapi_wicara.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES terapi_wicara.patients(id) ON DELETE CASCADE,
  tariff_id uuid REFERENCES terapi_wicara.service_tariffs(id),
  package_name text NOT NULL,
  total_sessions int NOT NULL,
  used_sessions int NOT NULL DEFAULT 0,
  remaining_sessions int GENERATED ALWAYS AS (GREATEST(total_sessions - used_sessions, 0)) STORED,
  total_paid_idr bigint NOT NULL,
  recognized_revenue_idr bigint NOT NULL DEFAULT 0,
  deferred_revenue_idr bigint GENERATED ALWAYS AS (GREATEST(total_paid_idr - recognized_revenue_idr, 0)) STORED,
  valid_until date NOT NULL,
  status text NOT NULL DEFAULT 'AKTIF',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS terapi_wicara.billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES terapi_wicara.clinics(id) ON DELETE CASCADE,
  invoice_number text NOT NULL UNIQUE,
  patient_id uuid NOT NULL REFERENCES terapi_wicara.patients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES terapi_wicara.appointments(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount_idr bigint NOT NULL,
  payment_method text NOT NULL DEFAULT 'QRIS',
  payment_status text NOT NULL DEFAULT 'LUNAS',
  cashier_name text NOT NULL DEFAULT 'Admin Kasir Klinik',
  issued_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS terapi_wicara.clinic_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES terapi_wicara.clinics(id) ON DELETE CASCADE,
  item_code text NOT NULL,
  item_name text NOT NULL,
  category text NOT NULL,
  stock_qty int NOT NULL DEFAULT 1,
  min_stock_alert int NOT NULL DEFAULT 2,
  unit text NOT NULL DEFAULT 'Unit',
  condition_status text NOT NULL DEFAULT 'BAIK_LAIK_PAKAI',
  last_calibrated_date date,
  next_calibration_date date,
  room_location text,
  UNIQUE (clinic_id, item_code)
);

CREATE TABLE IF NOT EXISTS terapi_wicara.quality_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES terapi_wicara.clinics(id) ON DELETE CASCADE,
  period_month text NOT NULL,
  indicator_code text NOT NULL,
  indicator_name text NOT NULL,
  indicator_group text NOT NULL,
  target_percentage numeric(5,2) NOT NULL,
  achieved_percentage numeric(5,2) NOT NULL,
  numerator int NOT NULL,
  denominator int NOT NULL,
  UNIQUE (clinic_id, period_month, indicator_code)
);

CREATE TABLE IF NOT EXISTS terapi_wicara.satusehat_fhir_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES terapi_wicara.clinics(id) ON DELETE CASCADE,
  fhir_resource_type text NOT NULL,
  local_reference_id text NOT NULL,
  patient_mrn text,
  satusehat_resource_id text,
  http_status int NOT NULL DEFAULT 200,
  sync_status text NOT NULL DEFAULT 'SYNCED',
  payload_summary text NOT NULL,
  transmitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS terapi_wicara.online_booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES terapi_wicara.clinics(id) ON DELETE CASCADE,
  booking_code text NOT NULL UNIQUE,
  patient_full_name text NOT NULL,
  birth_date date NOT NULL,
  gender text NOT NULL CHECK (gender IN ('L', 'P')),
  guardian_name text NOT NULL,
  guardian_phone text NOT NULL,
  requested_date date NOT NULL,
  requested_slot text NOT NULL,
  service_type text NOT NULL,
  disorder_concern text NOT NULL,
  chief_complaint text NOT NULL,
  referring_doctor text,
  screening_red_flags_count int NOT NULL DEFAULT 0,
  pdp_explicit_consent boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'MENUNGGU_VERIFIKASI_ADMISI',
  created_at timestamptz NOT NULL DEFAULT now()
);
