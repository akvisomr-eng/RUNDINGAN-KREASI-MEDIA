-- Deny direct Supabase Data API access to application tables by anon/authenticated.
-- Application data is accessed only by the server-side PostgreSQL client. Its restricted
-- runtime role receives explicit table grants and an RLS policy; app authorization and
-- organization scoping remain enforced in the server routes.

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Supabase's default ACLs grant future public-schema objects to API roles. Remove those
-- defaults for objects created by the project migration role so future tables/functions are not exposed.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON FUNCTIONS FROM anon, authenticated;

-- Enable RLS everywhere. By default this denies anon/authenticated even if privileges
-- are accidentally re-granted. Only the restricted server runtime role is allowed by
-- policy; its table grants still cap it at the granted SELECT/INSERT/UPDATE operations.
-- The Supabase service_role bypasses RLS by design and must remain server-secret.
DO $$
DECLARE
  app_table record;
BEGIN
  FOR app_table IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', app_table.relname);
    EXECUTE format('DROP POLICY IF EXISTS server_runtime_access ON public.%I', app_table.relname);
    EXECUTE format(
      'CREATE POLICY server_runtime_access ON public.%I FOR ALL TO rundingan_app_limited USING (true) WITH CHECK (true)',
      app_table.relname
    );
  END LOOP;
END;
$$;

INSERT INTO schema_migrations(version, description, applied_at)
VALUES (
  '20261123_012_lock_down_public_api',
  'Revoke public API roles from application data, restrict default grants, and enable RLS for server-only access',
  now()
)
ON CONFLICT(version) DO NOTHING;
