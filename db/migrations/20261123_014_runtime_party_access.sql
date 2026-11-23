-- The server-side CRM, Finance, Procurement and Reporting routes query these
-- organization-scoped party tables. RLS still limits the runtime to the configured org.
GRANT SELECT, INSERT, UPDATE ON TABLE public.parties, public.party_contacts TO rundingan_app_limited;

INSERT INTO public.schema_migrations(version, description, applied_at)
VALUES (
  '20261123_014_runtime_party_access',
  'Grant the limited server role the CRM party reads and writes required by application routes',
  now()
)
ON CONFLICT(version) DO NOTHING;
