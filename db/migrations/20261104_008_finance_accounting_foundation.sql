-- 20261104_008_finance_accounting_foundation
-- Additive, organization-scoped accounting foundation. Existing journal data is preserved.
ALTER TABLE finance_accounts
  ADD COLUMN IF NOT EXISTS parent_account_id uuid,
  ADD COLUMN IF NOT EXISTS account_group text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_postable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cash_flow_category text,
  ADD COLUMN IF NOT EXISTS default_tax_code text,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='finance_accounts_org_id_id_uq') THEN
    ALTER TABLE finance_accounts ADD CONSTRAINT finance_accounts_org_id_id_uq UNIQUE (organization_id,id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='finance_accounts_parent_fk') THEN
    ALTER TABLE finance_accounts ADD CONSTRAINT finance_accounts_parent_fk
      FOREIGN KEY (organization_id,parent_account_id) REFERENCES finance_accounts(organization_id,id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='finance_accounts_parent_not_self') THEN
    ALTER TABLE finance_accounts ADD CONSTRAINT finance_accounts_parent_not_self CHECK(parent_account_id IS NULL OR parent_account_id<>id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS finance_cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_unit_id uuid REFERENCES business_units(id),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  parent_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,code),
  UNIQUE(organization_id,id),
  FOREIGN KEY(organization_id,parent_id) REFERENCES finance_cost_centers(organization_id,id)
);

CREATE TABLE IF NOT EXISTS finance_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_unit_id uuid REFERENCES business_units(id),
  module_code text REFERENCES module_catalog(code),
  code text NOT NULL,
  name text NOT NULL,
  customer_party_id uuid REFERENCES parties(id),
  start_date date,
  end_date date,
  budget_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK(budget_amount>=0),
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','completed','cancelled','archived')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,code),
  UNIQUE(organization_id,id),
  CHECK(end_date IS NULL OR start_date IS NULL OR end_date>=start_date)
);

CREATE TABLE IF NOT EXISTS finance_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  fiscal_year integer NOT NULL,
  period_number smallint NOT NULL CHECK(period_number BETWEEN 1 AND 13),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
  closed_by text,
  closed_at timestamptz,
  reopened_by text,
  reopened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,fiscal_year,period_number),
  CHECK(end_date>=start_date)
);
CREATE INDEX IF NOT EXISTS finance_periods_range_idx ON finance_periods(organization_id,start_date,end_date);

CREATE TABLE IF NOT EXISTS finance_tax_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  code text NOT NULL,
  name text NOT NULL,
  tax_type text NOT NULL CHECK(tax_type IN ('vat_in','vat_out','withholding','income_tax','other')),
  rate numeric(8,5) NOT NULL DEFAULT 0 CHECK(rate>=0 AND rate<=100),
  tax_account_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  effective_from date,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,code),
  FOREIGN KEY(organization_id,tax_account_id) REFERENCES finance_accounts(organization_id,id),
  CHECK(effective_to IS NULL OR effective_from IS NULL OR effective_to>=effective_from)
);

CREATE TABLE IF NOT EXISTS finance_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  account_id uuid NOT NULL,
  bank_name text NOT NULL,
  account_name text NOT NULL,
  account_number_masked text NOT NULL,
  currency char(3) NOT NULL DEFAULT 'IDR',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,id),
  FOREIGN KEY(organization_id,account_id) REFERENCES finance_accounts(organization_id,id)
);

CREATE TABLE IF NOT EXISTS finance_bank_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  bank_account_id uuid NOT NULL,
  statement_start date NOT NULL,
  statement_end date NOT NULL,
  statement_opening numeric(18,2) NOT NULL DEFAULT 0,
  statement_closing numeric(18,2) NOT NULL,
  book_closing numeric(18,2) NOT NULL DEFAULT 0,
  difference numeric(18,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','in_review','reconciled','void')),
  notes text,
  created_by text NOT NULL,
  approved_by text,
  reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(organization_id,bank_account_id) REFERENCES finance_bank_accounts(organization_id,id),
  CHECK(statement_end>=statement_start)
);

ALTER TABLE finance_journals
  ADD COLUMN IF NOT EXISTS document_date date,
  ADD COLUMN IF NOT EXISTS reference_no text,
  ADD COLUMN IF NOT EXISTS journal_type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS source_module_code text REFERENCES module_catalog(code),
  ADD COLUMN IF NOT EXISTS business_unit_id uuid,
  ADD COLUMN IF NOT EXISTS party_id uuid REFERENCES parties(id),
  ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'IDR',
  ADD COLUMN IF NOT EXISTS exchange_rate numeric(18,8) NOT NULL DEFAULT 1 CHECK(exchange_rate>0),
  ADD COLUMN IF NOT EXISTS memo text,
  ADD COLUMN IF NOT EXISTS attachment_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_journal_id uuid REFERENCES finance_journals(id),
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES finance_periods(id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='finance_journals_org_id_id_uq') THEN
    ALTER TABLE finance_journals ADD CONSTRAINT finance_journals_org_id_id_uq UNIQUE(organization_id,id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='finance_journals_business_unit_fk') THEN
    ALTER TABLE finance_journals ADD CONSTRAINT finance_journals_business_unit_fk
      FOREIGN KEY(organization_id,business_unit_id) REFERENCES business_units(organization_id,id);
  END IF;
END $$;

ALTER TABLE finance_journal_lines
  ADD COLUMN IF NOT EXISTS organization_id uuid,
  ADD COLUMN IF NOT EXISTS business_unit_id uuid,
  ADD COLUMN IF NOT EXISTS cost_center_id uuid,
  ADD COLUMN IF NOT EXISTS project_id uuid,
  ADD COLUMN IF NOT EXISTS party_id uuid REFERENCES parties(id),
  ADD COLUMN IF NOT EXISTS tax_code text,
  ADD COLUMN IF NOT EXISTS source_module_code text REFERENCES module_catalog(code);

UPDATE finance_journal_lines l SET organization_id=j.organization_id
FROM finance_journals j WHERE j.id=l.journal_id AND l.organization_id IS NULL;
ALTER TABLE finance_journal_lines ALTER COLUMN organization_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='finance_journal_lines_org_journal_fk') THEN
    ALTER TABLE finance_journal_lines ADD CONSTRAINT finance_journal_lines_org_journal_fk
      FOREIGN KEY(organization_id,journal_id) REFERENCES finance_journals(organization_id,id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='finance_journal_lines_org_account_fk') THEN
    ALTER TABLE finance_journal_lines ADD CONSTRAINT finance_journal_lines_org_account_fk
      FOREIGN KEY(organization_id,account_id) REFERENCES finance_accounts(organization_id,id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='finance_journal_lines_cost_center_fk') THEN
    ALTER TABLE finance_journal_lines ADD CONSTRAINT finance_journal_lines_cost_center_fk
      FOREIGN KEY(organization_id,cost_center_id) REFERENCES finance_cost_centers(organization_id,id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='finance_journal_lines_project_fk') THEN
    ALTER TABLE finance_journal_lines ADD CONSTRAINT finance_journal_lines_project_fk
      FOREIGN KEY(organization_id,project_id) REFERENCES finance_projects(organization_id,id);
  END IF;
END $$;

ALTER TABLE finance_journals DROP CONSTRAINT IF EXISTS finance_journals_status_check;
ALTER TABLE finance_journals ADD CONSTRAINT finance_journals_status_check
  CHECK(status IN ('draft','submitted','approved','posted','void'));

CREATE INDEX IF NOT EXISTS finance_accounts_parent_idx ON finance_accounts(organization_id,parent_account_id,code);
CREATE INDEX IF NOT EXISTS finance_journal_lines_account_idx ON finance_journal_lines(organization_id,account_id,journal_id);
CREATE INDEX IF NOT EXISTS finance_journal_lines_cost_center_idx ON finance_journal_lines(organization_id,cost_center_id);
CREATE INDEX IF NOT EXISTS finance_journal_lines_project_idx ON finance_journal_lines(organization_id,project_id);
CREATE INDEX IF NOT EXISTS finance_journals_status_idx ON finance_journals(organization_id,status,journal_date DESC);
CREATE INDEX IF NOT EXISTS finance_journals_source_idx ON finance_journals(organization_id,source_module_code,reference_no);

INSERT INTO permissions(code,module,description) VALUES
('finance.periods.read','finance','View accounting periods'),
('finance.periods.manage','finance','Open and close accounting periods'),
('finance.reports.read','finance','View financial statements and ledger reports'),
('finance.journals.approve','finance','Approve accounting journals'),
('finance.reconciliation.manage','finance','Manage bank reconciliation'),
('finance.dimensions.manage','finance','Manage cost centers and projects'),
('finance.tax.manage','finance','Manage tax codes')
ON CONFLICT(code) DO UPDATE SET module=EXCLUDED.module,description=EXCLUDED.description;

INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN organizations o ON o.id=r.organization_id
JOIN permissions p ON p.code IN ('finance.periods.read','finance.periods.manage','finance.reports.read','finance.journals.approve','finance.reconciliation.manage','finance.dimensions.manage','finance.tax.manage')
WHERE o.slug='rundingan-kreasi-media' AND r.code IN ('owner','administrator')
ON CONFLICT(role_id,permission_id) DO NOTHING;

INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN organizations o ON o.id=r.organization_id
JOIN permissions p ON p.code IN ('finance.periods.read','finance.reports.read')
WHERE o.slug='rundingan-kreasi-media' AND r.code IN ('unit_manager','staff','viewer')
ON CONFLICT(role_id,permission_id) DO NOTHING;

INSERT INTO schema_migrations(version,description,applied_at)
VALUES('20261104_008_finance_accounting_foundation','Add hierarchical COA, accounting periods, dimensions, tax, bank and journal source metadata',NOW())
ON CONFLICT(version) DO NOTHING;

GRANT SELECT,INSERT,UPDATE ON TABLE finance_accounts,finance_journals,finance_journal_lines,finance_cost_centers,finance_projects,finance_periods,finance_tax_codes,finance_bank_accounts,finance_bank_reconciliations TO rundingan_app_limited;
