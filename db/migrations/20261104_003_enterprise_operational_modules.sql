-- Enterprise operational workspace foundation (Development first).
-- Additive schema only. No existing production data or tables are changed.
CREATE TABLE IF NOT EXISTS finance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  code text NOT NULL,
  name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('asset','liability','equity','revenue','expense')),
  normal_balance text NOT NULL CHECK (normal_balance IN ('debit','credit')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
CREATE TABLE IF NOT EXISTS finance_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  journal_number text NOT NULL,
  journal_date date NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','void')),
  created_by text NOT NULL,
  posted_by text,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, journal_number)
);
CREATE TABLE IF NOT EXISTS finance_journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES finance_journals(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES finance_accounts(id),
  description text,
  debit numeric(18,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(18,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);
CREATE INDEX IF NOT EXISTS finance_journals_date_idx ON finance_journals(organization_id,journal_date DESC);

CREATE TABLE IF NOT EXISTS hr_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  employee_code text NOT NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  department_id uuid REFERENCES departments(id),
  employment_type text NOT NULL DEFAULT 'permanent' CHECK (employment_type IN ('permanent','contract','intern','freelance')),
  start_date date NOT NULL,
  base_salary numeric(18,2) NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','leave','resigned','terminated')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, employee_code)
);
CREATE TABLE IF NOT EXISTS hr_payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid','void')),
  notes text,
  created_by text NOT NULL,
  approved_by text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start),
  UNIQUE (organization_id, period_start, period_end)
);
CREATE TABLE IF NOT EXISTS hr_payroll_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES hr_payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES hr_employees(id),
  gross_pay numeric(18,2) NOT NULL CHECK (gross_pay >= 0),
  deductions numeric(18,2) NOT NULL DEFAULT 0 CHECK (deductions >= 0),
  net_pay numeric(18,2) GENERATED ALWAYS AS (gross_pay - deductions) STORED,
  notes text,
  CHECK (deductions <= gross_pay),
  UNIQUE (payroll_run_id, employee_id)
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  sku text NOT NULL,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'pcs',
  item_type text NOT NULL DEFAULT 'product' CHECK (item_type IN ('product','material','asset','service')),
  minimum_stock numeric(18,3) NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, sku)
);
CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  item_id uuid NOT NULL REFERENCES inventory_items(id),
  location_id uuid REFERENCES locations(id),
  movement_type text NOT NULL CHECK (movement_type IN ('opening','in','out','adjustment')),
  quantity numeric(18,3) NOT NULL CHECK (quantity > 0),
  unit_cost numeric(18,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  reference text,
  notes text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_movements_item_idx ON inventory_movements(item_id,created_at DESC);
CREATE TABLE IF NOT EXISTS procurement_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  request_number text NOT NULL,
  requested_by text NOT NULL,
  supplier_party_id uuid REFERENCES parties(id),
  description text NOT NULL,
  estimated_total numeric(18,2) NOT NULL DEFAULT 0 CHECK (estimated_total >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','received','cancelled')),
  needed_by date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, request_number)
);

INSERT INTO permissions (code,module,description) VALUES
('core.departments.read','core','View departments'),
('core.departments.manage','core','Manage departments'),
('core.locations.read','core','View operating locations'),
('core.locations.manage','core','Manage operating locations'),
('finance.accounts.read','finance','View chart of accounts'),
('finance.accounts.manage','finance','Manage chart of accounts'),
('finance.journals.read','finance','View accounting journals'),
('finance.journals.create','finance','Create balanced journal entries'),
('hr.employees.read','hr','View employee records'),
('hr.employees.manage','hr','Manage employee records'),
('hr.payroll.read','hr','View payroll runs and amounts'),
('hr.payroll.manage','hr','Create and manage payroll drafts'),
('inventory.items.read','inventory','View inventory items and stock'),
('inventory.items.manage','inventory','Manage inventory items'),
('inventory.stock.manage','inventory','Record inventory movements'),
('procurement.requests.read','procurement','View procurement requests'),
('procurement.requests.manage','procurement','Manage procurement requests')
ON CONFLICT (code) DO UPDATE SET module=EXCLUDED.module,description=EXCLUDED.description;

INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN organizations o ON o.id=r.organization_id
JOIN permissions p ON p.code IN (
'core.departments.read','core.departments.manage','core.locations.read','core.locations.manage',
'finance.accounts.read','finance.accounts.manage','finance.journals.read','finance.journals.create',
'hr.employees.read','hr.employees.manage','hr.payroll.read','hr.payroll.manage',
'inventory.items.read','inventory.items.manage','inventory.stock.manage',
'procurement.requests.read','procurement.requests.manage'
)
WHERE o.slug='rundingan-kreasi-media' AND r.code IN ('owner','administrator')
ON CONFLICT (role_id,permission_id) DO NOTHING;

INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN organizations o ON o.id=r.organization_id
JOIN permissions p ON p.code IN (
'core.departments.read','core.locations.read','finance.accounts.read','finance.journals.read',
'hr.employees.read','inventory.items.read','procurement.requests.read'
)
WHERE o.slug='rundingan-kreasi-media' AND r.code='unit_manager'
ON CONFLICT (role_id,permission_id) DO NOTHING;

INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN organizations o ON o.id=r.organization_id
JOIN permissions p ON p.code IN (
'core.departments.read','core.locations.read','finance.accounts.read','finance.journals.read',
'inventory.items.read'
)
WHERE o.slug='rundingan-kreasi-media' AND r.code='staff'
ON CONFLICT (role_id,permission_id) DO NOTHING;

INSERT INTO schema_migrations(version,description,applied_at)
VALUES ('20261104_003_enterprise_operational_modules','Add finance, HR, inventory, procurement and administration foundations',NOW())
ON CONFLICT(version) DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON TABLE
  finance_accounts,finance_journals,finance_journal_lines,
  hr_employees,hr_payroll_runs,hr_payroll_lines,
  inventory_items,inventory_movements,procurement_requests
TO rundingan_app_limited;

GRANT USAGE ON SCHEMA neon_auth TO rundingan_app_limited;
GRANT SELECT ON TABLE neon_auth.user TO rundingan_app_limited;
GRANT SELECT, INSERT, UPDATE ON TABLE business_units, departments, locations, user_role_assignments TO rundingan_app_limited;
GRANT SELECT, INSERT ON TABLE audit_logs TO rundingan_app_limited;
