-- 0002_shared_master_data_and_authorization.sql
-- Additive core tables. Apply only to the Neon development branch.
BEGIN;

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  business_unit_id UUID REFERENCES business_units(id),
  parent_department_id UUID REFERENCES departments(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  business_unit_id UUID REFERENCES business_units(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  location_type TEXT NOT NULL DEFAULT 'office'
    CHECK (location_type IN ('office','studio','warehouse','classroom','event_venue','other')),
  address_line TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  country_code CHAR(2) NOT NULL DEFAULT 'ID',
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (organization_id, code)
);

-- One shared party master avoids duplicate customer/supplier records.
CREATE TABLE IF NOT EXISTS parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  party_type TEXT NOT NULL CHECK (party_type IN ('customer','supplier','both')),
  legal_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  tax_id TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  billing_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','blocked','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  updated_by TEXT,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS parties_org_name_idx
  ON parties (organization_id, lower(display_name)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS parties_org_type_idx
  ON parties (organization_id, party_type, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS party_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  party_id UUID NOT NULL REFERENCES parties(id),
  full_name TEXT NOT NULL,
  job_title TEXT,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS party_contacts_party_idx
  ON party_contacts (organization_id, party_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  module TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

-- Neon Auth user IDs are stored as text; no coupling to managed internal tables.
CREATE TABLE IF NOT EXISTS user_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES roles(id),
  business_unit_id UUID REFERENCES business_units(id),
  granted_by TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (organization_id, user_id, role_id, business_unit_id)
);
CREATE INDEX IF NOT EXISTS user_role_assignments_user_idx
  ON user_role_assignments (organization_id, user_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  business_unit_id UUID REFERENCES business_units(id),
  actor_user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  before_data JSONB,
  after_data JSONB,
  request_id TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_org_created_idx
  ON audit_logs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx
  ON audit_logs (organization_id, resource_type, resource_id);

INSERT INTO permissions (code, module, description) VALUES
 ('core.organization.read','core','Melihat profil organisasi'),
 ('core.organization.manage','core','Mengubah pengaturan organisasi'),
 ('core.business_units.read','core','Melihat unit bisnis'),
 ('core.business_units.manage','core','Mengelola unit bisnis'),
 ('core.users.read','core','Melihat pengguna'),
 ('core.users.manage','core','Mengelola pengguna dan penugasan akses'),
 ('core.roles.read','core','Melihat peran dan izin'),
 ('core.roles.manage','core','Mengelola peran dan izin'),
 ('core.audit.read','core','Melihat jejak audit'),
 ('crm.parties.read','crm','Melihat pelanggan dan pemasok'),
 ('crm.parties.create','crm','Membuat pelanggan dan pemasok'),
 ('crm.parties.update','crm','Memperbarui pelanggan dan pemasok'),
 ('crm.parties.archive','crm','Mengarsipkan pelanggan dan pemasok')
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles (organization_id, code, name, description, is_system)
SELECT o.id, r.code, r.name, r.description, true
FROM organizations o
CROSS JOIN (VALUES
 ('owner','Owner','Pemilik organisasi dengan kewenangan tertinggi.'),
 ('administrator','Administrator','Administrator operasional perusahaan.'),
 ('unit_manager','Unit Manager','Pengelola satu atau beberapa unit bisnis.'),
 ('staff','Staff','Staf operasional sesuai penugasan.'),
 ('viewer','Viewer','Akses baca sesuai penugasan.')
) AS r(code,name,description)
WHERE o.slug='rundingan-kreasi-media'
ON CONFLICT (organization_id, code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON
  (r.code IN ('owner','administrator'))
  OR (r.code='unit_manager' AND p.code IN (
    'core.organization.read','core.business_units.read','core.users.read',
    'core.roles.read','crm.parties.read','crm.parties.create','crm.parties.update'
  ))
  OR (r.code='staff' AND p.code IN ('core.business_units.read','crm.parties.read','crm.parties.create','crm.parties.update'))
  OR (r.code='viewer' AND p.code IN ('core.organization.read','core.business_units.read','crm.parties.read'))
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version, description)
VALUES ('0002','Shared master data, role-based access foundation, and audit log')
ON CONFLICT (version) DO NOTHING;

COMMIT;
