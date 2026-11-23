-- Scope the server runtime's RLS access to the current single-organization deployment.
-- This deliberately matches the app's fixed organization slug. Multi-organization
-- onboarding must replace this policy with request-scoped tenant context before launch.

CREATE OR REPLACE FUNCTION public.rundingan_current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT id
  FROM organizations
  WHERE slug = 'rundingan-kreasi-media'
    AND deleted_at IS NULL
$$;
GRANT EXECUTE ON FUNCTION public.rundingan_current_organization_id() TO rundingan_app_limited;

-- CMS tables were originally global. Attach them to the existing organization so their
-- server-role policy and audit references are tenant-safe as well.
ALTER TABLE public.cms_posts
  ADD COLUMN IF NOT EXISTS organization_id uuid DEFAULT public.rundingan_current_organization_id();
ALTER TABLE public.cms_posts
  ALTER COLUMN organization_id SET DEFAULT public.rundingan_current_organization_id();
UPDATE public.cms_posts
SET organization_id = public.rundingan_current_organization_id()
WHERE organization_id IS NULL;
ALTER TABLE public.cms_posts
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.cms_seo_audits
  ADD COLUMN IF NOT EXISTS organization_id uuid DEFAULT public.rundingan_current_organization_id();
ALTER TABLE public.cms_seo_audits
  ALTER COLUMN organization_id SET DEFAULT public.rundingan_current_organization_id();
UPDATE public.cms_seo_audits
SET organization_id = public.rundingan_current_organization_id()
WHERE organization_id IS NULL;
ALTER TABLE public.cms_seo_audits
  ALTER COLUMN organization_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cms_posts_org_id_id_uq'
      AND conrelid = 'public.cms_posts'::regclass
  ) THEN
    ALTER TABLE public.cms_posts
      ADD CONSTRAINT cms_posts_org_id_id_uq UNIQUE (organization_id, id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cms_posts_organization_fk'
      AND conrelid = 'public.cms_posts'::regclass
  ) THEN
    ALTER TABLE public.cms_posts
      ADD CONSTRAINT cms_posts_organization_fk
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cms_seo_audits_organization_fk'
      AND conrelid = 'public.cms_seo_audits'::regclass
  ) THEN
    ALTER TABLE public.cms_seo_audits
      ADD CONSTRAINT cms_seo_audits_organization_fk
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cms_seo_audits_org_post_fk'
      AND conrelid = 'public.cms_seo_audits'::regclass
  ) THEN
    ALTER TABLE public.cms_seo_audits
      ADD CONSTRAINT cms_seo_audits_org_post_fk
      FOREIGN KEY (organization_id, post_id)
      REFERENCES public.cms_posts(organization_id, id) ON DELETE CASCADE;
  END IF;
END;
$$;
CREATE INDEX IF NOT EXISTS cms_posts_organization_status_idx
  ON public.cms_posts(organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS cms_seo_audits_organization_post_idx
  ON public.cms_seo_audits(organization_id, post_id, created_at DESC);

-- Every table with an organization_id column is restricted at the database layer.
DO $$
DECLARE
  app_table record;
BEGIN
  FOR app_table IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN information_schema.columns col
      ON col.table_schema = n.nspname AND col.table_name = c.relname
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND col.column_name = 'organization_id'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS server_runtime_access ON public.%I', app_table.relname);
    EXECUTE format(
      'CREATE POLICY server_runtime_access ON public.%I FOR ALL TO rundingan_app_limited USING (organization_id = public.rundingan_current_organization_id()) WITH CHECK (organization_id = public.rundingan_current_organization_id())',
      app_table.relname
    );
  END LOOP;
END;
$$;

-- The organization row itself can only be read by the server role when it is the
-- configured single organization. This is intentionally non-recursive.
DROP POLICY IF EXISTS server_runtime_access ON public.organizations;
CREATE POLICY server_runtime_access ON public.organizations
  FOR ALL TO rundingan_app_limited
  USING (slug = 'rundingan-kreasi-media' AND deleted_at IS NULL)
  WITH CHECK (slug = 'rundingan-kreasi-media' AND deleted_at IS NULL);

-- Role permissions have no organization_id of their own; derive scope through roles.
DROP POLICY IF EXISTS server_runtime_access ON public.role_permissions;
CREATE POLICY server_runtime_access ON public.role_permissions
  FOR ALL TO rundingan_app_limited
  USING (EXISTS (
    SELECT 1 FROM public.roles r
    WHERE r.id = role_permissions.role_id
      AND r.organization_id = public.rundingan_current_organization_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.roles r
    WHERE r.id = role_permissions.role_id
      AND r.organization_id = public.rundingan_current_organization_id()
  ));

-- These are shared lookup / migration metadata tables, with no tenant-owned rows.
DO $$
DECLARE shared_table text;
BEGIN
  FOREACH shared_table IN ARRAY ARRAY['module_catalog', 'permissions', 'schema_migrations'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS server_runtime_access ON public.%I', shared_table);
    EXECUTE format(
      'CREATE POLICY server_runtime_access ON public.%I FOR ALL TO rundingan_app_limited USING (true) WITH CHECK (true)',
      shared_table
    );
  END LOOP;
END;
$$;

-- The least-privilege role needs these reads for tenant resolution and permission checks.
GRANT SELECT ON public.organizations, public.roles, public.role_permissions, public.permissions TO rundingan_app_limited;
GRANT SELECT ON public.cms_posts, public.cms_seo_audits TO rundingan_app_limited;

INSERT INTO public.schema_migrations(version, description, applied_at)
VALUES (
  '20261123_013_enforce_single_organization_rls',
  'Scope all organization-owned rows and CMS records to the configured organization using PostgreSQL RLS',
  now()
)
ON CONFLICT(version) DO NOTHING;
