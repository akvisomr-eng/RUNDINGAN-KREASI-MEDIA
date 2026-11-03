-- 0003_enforce_organization_boundaries.sql
-- Composite foreign keys prevent cross-organization references in tenant-ready data.
BEGIN;

ALTER TABLE business_units
  ADD CONSTRAINT business_units_org_id_id_uq UNIQUE (organization_id, id);
ALTER TABLE departments
  ADD CONSTRAINT departments_org_id_id_uq UNIQUE (organization_id, id);
ALTER TABLE locations
  ADD CONSTRAINT locations_org_id_id_uq UNIQUE (organization_id, id);
ALTER TABLE parties
  ADD CONSTRAINT parties_org_id_id_uq UNIQUE (organization_id, id);
ALTER TABLE roles
  ADD CONSTRAINT roles_org_id_id_uq UNIQUE (organization_id, id);

ALTER TABLE departments
  ADD CONSTRAINT departments_org_business_unit_fk
  FOREIGN KEY (organization_id, business_unit_id)
  REFERENCES business_units (organization_id, id);
ALTER TABLE departments
  ADD CONSTRAINT departments_org_parent_fk
  FOREIGN KEY (organization_id, parent_department_id)
  REFERENCES departments (organization_id, id);
ALTER TABLE locations
  ADD CONSTRAINT locations_org_business_unit_fk
  FOREIGN KEY (organization_id, business_unit_id)
  REFERENCES business_units (organization_id, id);
ALTER TABLE party_contacts
  ADD CONSTRAINT party_contacts_org_party_fk
  FOREIGN KEY (organization_id, party_id)
  REFERENCES parties (organization_id, id);
ALTER TABLE user_role_assignments
  ADD CONSTRAINT user_role_assignments_org_role_fk
  FOREIGN KEY (organization_id, role_id)
  REFERENCES roles (organization_id, id);
ALTER TABLE user_role_assignments
  ADD CONSTRAINT user_role_assignments_org_business_unit_fk
  FOREIGN KEY (organization_id, business_unit_id)
  REFERENCES business_units (organization_id, id);
ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_org_business_unit_fk
  FOREIGN KEY (organization_id, business_unit_id)
  REFERENCES business_units (organization_id, id);

-- Allow re-assignment after revocation and prevent duplicate active assignments.
ALTER TABLE user_role_assignments
  DROP CONSTRAINT IF EXISTS user_role_assignments_organization_id_user_id_role_id_business_unit_id_key;
DROP INDEX IF EXISTS user_role_assignments_user_idx;
CREATE UNIQUE INDEX user_role_assignments_global_active_uq
  ON user_role_assignments (organization_id, user_id, role_id)
  WHERE business_unit_id IS NULL AND revoked_at IS NULL;
CREATE UNIQUE INDEX user_role_assignments_unit_active_uq
  ON user_role_assignments (organization_id, user_id, role_id, business_unit_id)
  WHERE business_unit_id IS NOT NULL AND revoked_at IS NULL;
CREATE INDEX user_role_assignments_user_idx
  ON user_role_assignments (organization_id, user_id)
  WHERE revoked_at IS NULL;

INSERT INTO schema_migrations (version, description)
VALUES ('0003','Enforce organization boundaries with composite foreign keys and active role uniqueness')
ON CONFLICT (version) DO NOTHING;

COMMIT;
