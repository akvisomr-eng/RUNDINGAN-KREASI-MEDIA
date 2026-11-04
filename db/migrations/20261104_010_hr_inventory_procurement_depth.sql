-- 20261104_010_hr_inventory_procurement_depth
-- Additive operational depth for HR, payroll, inventory and procurement.
-- All records remain organization-scoped. No production data is seeded or deleted.

ALTER TABLE hr_employees
  ADD COLUMN IF NOT EXISTS business_unit_id uuid,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS updated_by text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE hr_employees ADD CONSTRAINT hr_employees_org_id_uq UNIQUE (organization_id,id);
ALTER TABLE hr_employees ADD CONSTRAINT hr_employees_business_unit_fk
  FOREIGN KEY (organization_id,business_unit_id) REFERENCES business_units(organization_id,id);
ALTER TABLE hr_employees ADD CONSTRAINT hr_employees_dates_ck
  CHECK (end_date IS NULL OR end_date >= start_date);

CREATE TABLE IF NOT EXISTS hr_employee_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  employee_id uuid NOT NULL,
  contract_number text NOT NULL,
  contract_type text NOT NULL CHECK(contract_type IN ('permanent','fixed_term','probation','freelance','internship')),
  start_date date NOT NULL,
  end_date date,
  base_salary numeric(18,2) NOT NULL DEFAULT 0 CHECK(base_salary>=0),
  notes text,
  document_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','expired','terminated')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,contract_number),
  FOREIGN KEY(organization_id,employee_id) REFERENCES hr_employees(organization_id,id),
  CHECK(end_date IS NULL OR end_date>=start_date)
);
CREATE INDEX IF NOT EXISTS hr_employee_contracts_employee_idx ON hr_employee_contracts(organization_id,employee_id,start_date DESC);

CREATE TABLE IF NOT EXISTS hr_attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  employee_id uuid NOT NULL,
  work_date date NOT NULL,
  check_in timestamptz,
  check_out timestamptz,
  attendance_status text NOT NULL DEFAULT 'present' CHECK(attendance_status IN ('present','late','absent','leave','sick','remote','holiday')),
  overtime_minutes integer NOT NULL DEFAULT 0 CHECK(overtime_minutes>=0),
  notes text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,employee_id,work_date),
  FOREIGN KEY(organization_id,employee_id) REFERENCES hr_employees(organization_id,id),
  CHECK(check_out IS NULL OR check_in IS NULL OR check_out>=check_in)
);
CREATE INDEX IF NOT EXISTS hr_attendance_date_idx ON hr_attendance_records(organization_id,work_date,attendance_status);

CREATE TABLE IF NOT EXISTS hr_leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  employee_id uuid NOT NULL,
  leave_type text NOT NULL CHECK(leave_type IN ('annual','sick','maternity','paternity','unpaid','other')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_days numeric(6,2) NOT NULL CHECK(total_days>0),
  reason text,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected','cancelled')),
  approved_by text,
  approved_at timestamptz,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(organization_id,employee_id) REFERENCES hr_employees(organization_id,id),
  CHECK(end_date>=start_date)
);
CREATE INDEX IF NOT EXISTS hr_leave_employee_date_idx ON hr_leave_requests(organization_id,employee_id,start_date DESC);

CREATE TABLE IF NOT EXISTS hr_payroll_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  code text NOT NULL,
  name text NOT NULL,
  component_type text NOT NULL CHECK(component_type IN ('earning','deduction','employer_contribution')),
  is_taxable boolean NOT NULL DEFAULT false,
  is_recurring boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  expense_account_id uuid,
  payable_account_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,code),
  UNIQUE(organization_id,id),
  FOREIGN KEY(organization_id,expense_account_id) REFERENCES finance_accounts(organization_id,id),
  FOREIGN KEY(organization_id,payable_account_id) REFERENCES finance_accounts(organization_id,id)
);
CREATE TABLE IF NOT EXISTS hr_payroll_line_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  payroll_line_id uuid NOT NULL REFERENCES hr_payroll_lines(id) ON DELETE CASCADE,
  component_id uuid NOT NULL,
  amount numeric(18,2) NOT NULL CHECK(amount>=0),
  notes text,
  FOREIGN KEY(organization_id,component_id) REFERENCES hr_payroll_components(organization_id,id)
);
ALTER TABLE hr_payroll_runs
  ADD COLUMN IF NOT EXISTS business_unit_id uuid,
  ADD COLUMN IF NOT EXISTS finance_journal_id uuid,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS paid_by text;
ALTER TABLE hr_payroll_runs ADD CONSTRAINT hr_payroll_runs_org_id_uq UNIQUE(organization_id,id);
ALTER TABLE hr_payroll_runs ADD CONSTRAINT hr_payroll_runs_business_unit_fk
  FOREIGN KEY(organization_id,business_unit_id) REFERENCES business_units(organization_id,id);
ALTER TABLE hr_payroll_runs ADD CONSTRAINT hr_payroll_runs_journal_fk
  FOREIGN KEY(organization_id,finance_journal_id) REFERENCES finance_journals(organization_id,id);

CREATE TABLE IF NOT EXISTS inventory_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  code text NOT NULL,
  name text NOT NULL,
  parent_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,code),
  UNIQUE(organization_id,id),
  FOREIGN KEY(organization_id,parent_id) REFERENCES inventory_categories(organization_id,id),
  CHECK(parent_id IS NULL OR parent_id<>id)
);
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS category_id uuid,
  ADD COLUMN IF NOT EXISTS business_unit_id uuid,
  ADD COLUMN IF NOT EXISTS inventory_account_id uuid,
  ADD COLUMN IF NOT EXISTS expense_account_id uuid,
  ADD COLUMN IF NOT EXISTS cogs_account_id uuid,
  ADD COLUMN IF NOT EXISTS reorder_quantity numeric(18,3) NOT NULL DEFAULT 0;
ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_org_id_uq UNIQUE(organization_id,id);
ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_category_fk
  FOREIGN KEY(organization_id,category_id) REFERENCES inventory_categories(organization_id,id);
ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_business_unit_fk
  FOREIGN KEY(organization_id,business_unit_id) REFERENCES business_units(organization_id,id);
ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_inventory_account_fk
  FOREIGN KEY(organization_id,inventory_account_id) REFERENCES finance_accounts(organization_id,id);
ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_expense_account_fk
  FOREIGN KEY(organization_id,expense_account_id) REFERENCES finance_accounts(organization_id,id);
ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_cogs_account_fk
  FOREIGN KEY(organization_id,cogs_account_id) REFERENCES finance_accounts(organization_id,id);
ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_reorder_ck CHECK(reorder_quantity>=0);
ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS business_unit_id uuid,
  ADD COLUMN IF NOT EXISTS finance_journal_id uuid,
  ADD COLUMN IF NOT EXISTS movement_status text NOT NULL DEFAULT 'posted';
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_business_unit_fk
  FOREIGN KEY(organization_id,business_unit_id) REFERENCES business_units(organization_id,id);
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_journal_fk
  FOREIGN KEY(organization_id,finance_journal_id) REFERENCES finance_journals(organization_id,id);
CREATE INDEX IF NOT EXISTS inventory_items_category_idx ON inventory_items(organization_id,category_id,name);
CREATE INDEX IF NOT EXISTS inventory_movements_location_idx ON inventory_movements(organization_id,location_id,created_at DESC);

ALTER TABLE procurement_requests
  ADD COLUMN IF NOT EXISTS business_unit_id uuid,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS finance_journal_id uuid;
ALTER TABLE procurement_requests ADD CONSTRAINT procurement_requests_org_id_uq UNIQUE(organization_id,id);
ALTER TABLE procurement_requests ADD CONSTRAINT procurement_requests_business_unit_fk
  FOREIGN KEY(organization_id,business_unit_id) REFERENCES business_units(organization_id,id);
ALTER TABLE procurement_requests ADD CONSTRAINT procurement_requests_journal_fk
  FOREIGN KEY(organization_id,finance_journal_id) REFERENCES finance_journals(organization_id,id);

CREATE TABLE IF NOT EXISTS procurement_request_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  request_id uuid NOT NULL,
  item_id uuid,
  description text NOT NULL,
  quantity numeric(18,3) NOT NULL CHECK(quantity>0),
  estimated_unit_price numeric(18,2) NOT NULL DEFAULT 0 CHECK(estimated_unit_price>=0),
  line_total numeric(18,2) GENERATED ALWAYS AS (quantity*estimated_unit_price) STORED,
  notes text,
  FOREIGN KEY(organization_id,request_id) REFERENCES procurement_requests(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY(organization_id,item_id) REFERENCES inventory_items(organization_id,id)
);
CREATE INDEX IF NOT EXISTS procurement_request_lines_request_idx ON procurement_request_lines(organization_id,request_id);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  request_id uuid,
  po_number text NOT NULL,
  supplier_party_id uuid NOT NULL REFERENCES parties(id),
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_date date,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','partially_received','received','cancelled')),
  currency char(3) NOT NULL DEFAULT 'IDR',
  notes text,
  business_unit_id uuid,
  business_transaction_id uuid REFERENCES business_transactions(id),
  finance_document_id uuid,
  created_by text NOT NULL,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,po_number),
  UNIQUE(organization_id,id),
  FOREIGN KEY(organization_id,request_id) REFERENCES procurement_requests(organization_id,id),
  FOREIGN KEY(organization_id,business_unit_id) REFERENCES business_units(organization_id,id),
  FOREIGN KEY(organization_id,supplier_party_id) REFERENCES parties(organization_id,id)
);
CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  purchase_order_id uuid NOT NULL,
  item_id uuid,
  description text NOT NULL,
  quantity numeric(18,3) NOT NULL CHECK(quantity>0),
  unit_price numeric(18,2) NOT NULL CHECK(unit_price>=0),
  received_quantity numeric(18,3) NOT NULL DEFAULT 0 CHECK(received_quantity>=0 AND received_quantity<=quantity),
  line_total numeric(18,2) GENERATED ALWAYS AS (quantity*unit_price) STORED,
  FOREIGN KEY(organization_id,purchase_order_id) REFERENCES purchase_orders(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY(organization_id,item_id) REFERENCES inventory_items(organization_id,id)
);
ALTER TABLE purchase_order_lines ADD CONSTRAINT purchase_order_lines_org_id_uq UNIQUE(organization_id,id);
CREATE TABLE IF NOT EXISTS goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  purchase_order_id uuid NOT NULL,
  receipt_number text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','posted','void')),
  notes text,
  created_by text NOT NULL,
  posted_by text,
  posted_at timestamptz,
  business_transaction_id uuid REFERENCES business_transactions(id),
  finance_journal_id uuid,
  UNIQUE(organization_id,receipt_number),
  UNIQUE(organization_id,id),
  FOREIGN KEY(organization_id,purchase_order_id) REFERENCES purchase_orders(organization_id,id),
  FOREIGN KEY(organization_id,finance_journal_id) REFERENCES finance_journals(organization_id,id)
);
CREATE TABLE IF NOT EXISTS goods_receipt_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  goods_receipt_id uuid NOT NULL,
  purchase_order_line_id uuid NOT NULL,
  item_id uuid NOT NULL,
  location_id uuid,
  quantity numeric(18,3) NOT NULL CHECK(quantity>0),
  unit_cost numeric(18,2) NOT NULL CHECK(unit_cost>=0),
  FOREIGN KEY(organization_id,goods_receipt_id) REFERENCES goods_receipts(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY(organization_id,purchase_order_line_id) REFERENCES purchase_order_lines(organization_id,id),
  FOREIGN KEY(organization_id,item_id) REFERENCES inventory_items(organization_id,id),
  FOREIGN KEY(organization_id,location_id) REFERENCES locations(organization_id,id)
);
CREATE INDEX IF NOT EXISTS purchase_orders_supplier_idx ON purchase_orders(organization_id,supplier_party_id,order_date DESC);
CREATE INDEX IF NOT EXISTS goods_receipts_po_idx ON goods_receipts(organization_id,purchase_order_id,received_at DESC);

INSERT INTO permissions(code,module,description) VALUES
('hr.contracts.read','hr','View employee contracts'),
('hr.contracts.manage','hr','Manage employee contracts'),
('hr.attendance.read','hr','View attendance records'),
('hr.attendance.manage','hr','Manage attendance records'),
('hr.leave.read','hr','View leave requests'),
('hr.leave.manage','hr','Manage leave requests'),
('hr.payroll.components.manage','hr','Manage payroll earning and deduction components'),
('inventory.categories.manage','inventory','Manage inventory categories'),
('inventory.items.update','inventory','Update inventory item master data'),
('inventory.movements.read','inventory','View inventory movement history'),
('procurement.orders.read','procurement','View purchase orders'),
('procurement.orders.manage','procurement','Manage purchase orders and receipts')
ON CONFLICT(code) DO UPDATE SET module=EXCLUDED.module,description=EXCLUDED.description;

INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN organizations o ON o.id=r.organization_id
JOIN permissions p ON p.code IN (
 'hr.contracts.read','hr.contracts.manage','hr.attendance.read','hr.attendance.manage','hr.leave.read','hr.leave.manage','hr.payroll.components.manage',
 'inventory.categories.manage','inventory.items.update','inventory.movements.read','procurement.orders.read','procurement.orders.manage'
)
WHERE o.slug='rundingan-kreasi-media' AND r.code IN ('owner','administrator')
ON CONFLICT(role_id,permission_id) DO NOTHING;

INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN organizations o ON o.id=r.organization_id
JOIN permissions p ON p.code IN ('hr.contracts.read','hr.attendance.read','hr.leave.read','inventory.movements.read','procurement.orders.read')
WHERE o.slug='rundingan-kreasi-media' AND r.code='unit_manager'
ON CONFLICT(role_id,permission_id) DO NOTHING;

INSERT INTO schema_migrations(version,description,applied_at)
VALUES ('20261104_010_hr_inventory_procurement_depth','Add contracts, attendance, leave, payroll components, inventory account mappings, purchase orders and goods receipts',NOW())
ON CONFLICT(version) DO NOTHING;

GRANT SELECT,INSERT,UPDATE ON TABLE hr_employee_contracts,hr_attendance_records,hr_leave_requests,hr_payroll_components,hr_payroll_line_components,inventory_categories,procurement_request_lines,purchase_orders,purchase_order_lines,goods_receipts,goods_receipt_lines TO rundingan_app_limited;
