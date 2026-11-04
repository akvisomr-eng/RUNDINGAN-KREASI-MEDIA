-- Unified module registry, shared transaction spine, embedded agents and reporting permissions.
-- Additive migration. Apply to Development first; Production migration requires an approved release window.
CREATE TABLE IF NOT EXISTS module_catalog (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  is_optional boolean NOT NULL DEFAULT false,
  default_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO module_catalog(code,name,description,is_optional,default_enabled) VALUES
('ACADEMY','Rundingan Academy','Learning management, classes, learning content and certifications.',false,true),
('CREATIVE','Rundingan Creative','Creative briefs, design jobs, assets and approvals.',false,true),
('EVENT','Rundingan Event','Event planning, schedules, vendors, participants and budgets.',false,true),
('MEDIA','Rundingan Media','Editorial, media assets, distribution and audience operations.',false,true),
('PRODUCTION','Rundingan Production','Production planning, work orders, crews, equipment and delivery.',false,true),
('RENTAL','Rundingan Rental','Rental inventory, reservations, contracts and returns.',true,false)
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,is_optional=EXCLUDED.is_optional,default_enabled=EXCLUDED.default_enabled;

CREATE TABLE IF NOT EXISTS organization_modules (
  organization_id uuid NOT NULL REFERENCES organizations(id),
  module_code text NOT NULL REFERENCES module_catalog(code),
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  installed_at timestamptz NOT NULL DEFAULT now(),
  installed_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(organization_id,module_code)
);

INSERT INTO organization_modules(organization_id,module_code,status)
SELECT o.id,m.code,CASE WHEN m.default_enabled THEN 'active' ELSE 'inactive' END
FROM organizations o CROSS JOIN module_catalog m
WHERE o.slug='rundingan-kreasi-media'
ON CONFLICT(organization_id,module_code) DO NOTHING;

-- One shared transaction identity across operational modules and the general ledger.
CREATE TABLE IF NOT EXISTS business_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_unit_id uuid REFERENCES business_units(id),
  module_code text NOT NULL REFERENCES module_catalog(code),
  transaction_type text NOT NULL,
  reference_no text NOT NULL,
  description text NOT NULL,
  party_id uuid REFERENCES parties(id),
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending','approved','posted','paid','cancelled')),
  amount numeric(18,2) NOT NULL DEFAULT 0 CHECK(amount >= 0),
  currency char(3) NOT NULL DEFAULT 'IDR',
  source_table text,
  source_id text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,module_code,reference_no)
);
CREATE INDEX IF NOT EXISTS business_transactions_date_idx ON business_transactions(organization_id,transaction_date DESC);
CREATE INDEX IF NOT EXISTS business_transactions_party_idx ON business_transactions(party_id,transaction_date DESC);
CREATE INDEX IF NOT EXISTS business_transactions_source_idx ON business_transactions(source_table,source_id);

ALTER TABLE finance_journals ADD COLUMN IF NOT EXISTS business_transaction_id uuid REFERENCES business_transactions(id);
ALTER TABLE procurement_requests ADD COLUMN IF NOT EXISTS business_transaction_id uuid REFERENCES business_transactions(id);
ALTER TABLE hr_payroll_runs ADD COLUMN IF NOT EXISTS business_transaction_id uuid REFERENCES business_transactions(id);
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS business_transaction_id uuid REFERENCES business_transactions(id);
CREATE INDEX IF NOT EXISTS finance_journals_transaction_idx ON finance_journals(business_transaction_id);
CREATE INDEX IF NOT EXISTS procurement_transaction_idx ON procurement_requests(business_transaction_id);
CREATE INDEX IF NOT EXISTS payroll_transaction_idx ON hr_payroll_runs(business_transaction_id);
CREATE INDEX IF NOT EXISTS inventory_transaction_idx ON inventory_movements(business_transaction_id);

CREATE TABLE IF NOT EXISTS agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  agent_code text NOT NULL,
  runtime text NOT NULL DEFAULT 'embedded_rules' CHECK(runtime IN ('embedded_rules','local_model')),
  status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','completed','failed')),
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS agent_runs_history_idx ON agent_runs(organization_id,created_at DESC);

CREATE TABLE IF NOT EXISTS agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  agent_run_id uuid NOT NULL REFERENCES agent_runs(id),
  action_type text NOT NULL,
  target_table text,
  target_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_level text NOT NULL CHECK(risk_level IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'pending_approval' CHECK(status IN ('pending_approval','approved','rejected','completed')),
  approved_by text,
  approved_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_actions_approval_idx ON agent_actions(organization_id,status,created_at DESC);

INSERT INTO permissions(code,module,description) VALUES
('modules.catalog.read','core','View the organization module catalog and installed modules'),
('modules.catalog.manage','core','Install or disable optional organization modules'),
('reports.read','core','View operational and financial reports'),
('agents.read','core','View embedded AI agent runs and findings'),
('agents.run','core','Run embedded AI domain and maintenance agents'),
('agents.actions.approve','core','Approve or reject proposed AI agent actions')
ON CONFLICT(code) DO UPDATE SET module=EXCLUDED.module,description=EXCLUDED.description;

INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN organizations o ON o.id=r.organization_id
JOIN permissions p ON p.code IN ('modules.catalog.read','modules.catalog.manage','reports.read','agents.read','agents.run','agents.actions.approve')
WHERE o.slug='rundingan-kreasi-media' AND r.code IN ('owner','administrator')
ON CONFLICT(role_id,permission_id) DO NOTHING;

INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN organizations o ON o.id=r.organization_id
JOIN permissions p ON p.code IN ('modules.catalog.read','reports.read','agents.read')
WHERE o.slug='rundingan-kreasi-media' AND r.code='unit_manager'
ON CONFLICT(role_id,permission_id) DO NOTHING;

INSERT INTO schema_migrations(version,description,applied_at)
VALUES ('20261104_004_unified_modules_agents_reports','Add module plugin registry, shared transaction spine, embedded agent audit trail and report permissions',NOW())
ON CONFLICT(version) DO NOTHING;

GRANT SELECT,INSERT,UPDATE ON TABLE module_catalog,organization_modules,business_transactions,agent_runs,agent_actions TO rundingan_app_limited;
