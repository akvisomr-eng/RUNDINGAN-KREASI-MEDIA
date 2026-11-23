-- Shared catalog data is read-only at runtime; module enablement is stored in
-- organization_modules, which remains organization-scoped and writable.
REVOKE INSERT, UPDATE ON TABLE public.module_catalog FROM rundingan_app_limited;

INSERT INTO public.schema_migrations(version, description, applied_at)
VALUES (
  '20261123_015_lock_shared_catalog_writes',
  'Make the shared module catalog read-only for the application runtime role',
  now()
)
ON CONFLICT(version) DO NOTHING;
