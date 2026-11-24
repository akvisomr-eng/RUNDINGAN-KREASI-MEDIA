-- Phase 3 Migration Reference: Healthcare Enterprise HQ (Scenario A - Option 1)
-- Multi-Branch Clinic Network, 3-SIP Quota Registry (UU 17/2023), Multi-Profession Care (PKP),
-- PSAK Double-Entry General Ledger & COA, Jasa Medis Payroll + PPh 21, and PAK/NIE Medical Procurement.

CREATE TABLE IF NOT EXISTS terapi_wicara.enterprise_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  legal_entity_name text NOT NULL,
  entity_type text NOT NULL DEFAULT 'PERSEROAN_TERBATAS',
  ahu_decree_number text NOT NULL,
  npwp_number text NOT NULL,
  oss_master_nib text NOT NULL,
  kbli_codes text[] NOT NULL DEFAULT ARRAY['86104 (Aktivitas Klinik Swasta)', '86901 (Pelayanan Kesehatan Tenaga Kesehatan)'],
  medical_director_name text NOT NULL,
  head_office_address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS terapi_wicara.practitioner_sip_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES terapi_wicara.therapists(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES terapi_wicara.clinics(id) ON DELETE CASCADE,
  sip_sequence_slot int NOT NULL CHECK (sip_sequence_slot BETWEEN 1 AND 3),
  sip_number text NOT NULL UNIQUE,
  issued_by_dinkes text NOT NULL,
  valid_from date NOT NULL,
  valid_until date NOT NULL,
  practice_days text NOT NULL,
  status text NOT NULL DEFAULT 'AKTIF',
  UNIQUE (practitioner_id, sip_sequence_slot),
  UNIQUE (practitioner_id, clinic_id)
);

CREATE TABLE IF NOT EXISTS terapi_wicara.interprofessional_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES terapi_wicara.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES terapi_wicara.patients(id) ON DELETE CASCADE,
  from_practitioner_id uuid NOT NULL REFERENCES terapi_wicara.therapists(id),
  to_profession text NOT NULL,
  to_practitioner_id uuid REFERENCES terapi_wicara.therapists(id),
  clinical_reason text NOT NULL,
  joint_care_goal text NOT NULL,
  priority text NOT NULL DEFAULT 'RUTIN',
  status text NOT NULL DEFAULT 'AKTIF_KOLABORASI',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS terapi_wicara.finance_coa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id uuid NOT NULL REFERENCES terapi_wicara.enterprise_holdings(id) ON DELETE CASCADE,
  account_code text NOT NULL UNIQUE,
  account_name text NOT NULL,
  account_type text NOT NULL,
  normal_balance text NOT NULL CHECK (normal_balance IN ('DEBIT', 'KREDIT')),
  balance_idr bigint NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS terapi_wicara.finance_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id uuid NOT NULL REFERENCES terapi_wicara.enterprise_holdings(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES terapi_wicara.clinics(id) ON DELETE CASCADE,
  journal_number text NOT NULL UNIQUE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  source_module text NOT NULL,
  description text NOT NULL,
  debit_account_code text NOT NULL,
  credit_account_code text NOT NULL,
  amount_idr bigint NOT NULL CHECK (amount_idr > 0),
  posted_by text NOT NULL DEFAULT 'Sistem Akuntansi Otomatis EMS',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS terapi_wicara.hr_jasa_medis_payrolls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES terapi_wicara.clinics(id) ON DELETE CASCADE,
  practitioner_id uuid NOT NULL REFERENCES terapi_wicara.therapists(id) ON DELETE CASCADE,
  period_month text NOT NULL,
  verified_locked_sessions int NOT NULL DEFAULT 0,
  base_salary_idr bigint NOT NULL,
  total_session_fee_idr bigint NOT NULL,
  pph21_deduction_idr bigint NOT NULL DEFAULT 0,
  take_home_pay_idr bigint GENERATED ALWAYS AS (base_salary_idr + total_session_fee_idr - pph21_deduction_idr) STORED,
  payout_status text NOT NULL DEFAULT 'SIAP_TRANSFER',
  UNIQUE (clinic_id, practitioner_id, period_month)
);

CREATE TABLE IF NOT EXISTS terapi_wicara.procurement_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id uuid NOT NULL REFERENCES terapi_wicara.enterprise_holdings(id) ON DELETE CASCADE,
  supplier_code text NOT NULL UNIQUE,
  supplier_name text NOT NULL,
  pak_alkes_license text NOT NULL,
  contact_person text NOT NULL,
  phone text NOT NULL,
  category_supplied text NOT NULL
);

CREATE TABLE IF NOT EXISTS terapi_wicara.procurement_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id uuid NOT NULL REFERENCES terapi_wicara.enterprise_holdings(id) ON DELETE CASCADE,
  destination_clinic_id uuid NOT NULL REFERENCES terapi_wicara.clinics(id),
  supplier_id uuid NOT NULL REFERENCES terapi_wicara.procurement_suppliers(id),
  po_number text NOT NULL UNIQUE,
  items_summary text NOT NULL,
  total_amount_idr bigint NOT NULL,
  nie_kemenkes_verified boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'DISETUJUI_DIREKTUR',
  ordered_at timestamptz NOT NULL DEFAULT now()
);
