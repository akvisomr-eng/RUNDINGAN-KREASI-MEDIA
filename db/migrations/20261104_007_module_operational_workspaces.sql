-- First operational workflow layer for ACADEMY, CREATIVE, EVENT, MEDIA and PRODUCTION.
-- All work items are organization-scoped and mirrored to the shared transaction spine.
CREATE TABLE IF NOT EXISTS module_work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  module_code text NOT NULL REFERENCES module_catalog(code),
  reference_no text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  owner_name text,
  start_date date,
  due_date date,
  budget_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (budget_amount >= 0),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','in_progress','review','approved','completed','cancelled')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  business_transaction_id uuid REFERENCES business_transactions(id),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (due_date IS NULL OR start_date IS NULL OR due_date >= start_date),
  UNIQUE (organization_id,module_code,reference_no)
);

CREATE INDEX IF NOT EXISTS module_work_items_org_module_idx
  ON module_work_items(organization_id,module_code,updated_at DESC);
CREATE INDEX IF NOT EXISTS module_work_items_due_idx
  ON module_work_items(organization_id,due_date)
  WHERE status NOT IN ('completed','cancelled');

INSERT INTO permissions(code,module,description) VALUES
('academy.work.read','academy','View Academy programs and classes'),
('academy.work.manage','academy','Create and manage Academy programs and classes'),
('creative.work.read','creative','View Creative briefs and jobs'),
('creative.work.manage','creative','Create and manage Creative briefs and jobs'),
('event.work.read','event','View Event plans and productions'),
('event.work.manage','event','Create and manage Event plans and productions'),
('media.work.read','media','View Media editorial and distribution work'),
('media.work.manage','media','Create and manage Media editorial and distribution work'),
('production.work.read','production','View Production projects and work orders'),
('production.work.manage','production','Create and manage Production projects and work orders')
ON CONFLICT(code) DO UPDATE SET module=EXCLUDED.module,description=EXCLUDED.description;

INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id
FROM roles r
JOIN organizations o ON o.id=r.organization_id
JOIN permissions p ON p.code IN (
  'academy.work.read','academy.work.manage',
  'creative.work.read','creative.work.manage',
  'event.work.read','event.work.manage',
  'media.work.read','media.work.manage',
  'production.work.read','production.work.manage'
)
WHERE o.slug='rundingan-kreasi-media' AND r.code IN ('owner','administrator','unit_manager')
ON CONFLICT(role_id,permission_id) DO NOTHING;

INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id
FROM roles r
JOIN organizations o ON o.id=r.organization_id
JOIN permissions p ON p.code IN (
  'academy.work.read','creative.work.read','event.work.read','media.work.read','production.work.read'
)
WHERE o.slug='rundingan-kreasi-media' AND r.code IN ('staff','viewer')
ON CONFLICT(role_id,permission_id) DO NOTHING;

GRANT SELECT,INSERT,UPDATE ON TABLE module_work_items TO rundingan_app_limited;

INSERT INTO schema_migrations(version,description,applied_at)
VALUES ('20261104_007_module_operational_workspaces','Add organization-scoped work item workflows for core business modules',NOW())
ON CONFLICT(version) DO NOTHING;
