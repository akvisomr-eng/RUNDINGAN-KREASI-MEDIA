-- Read-only metadata access required by /api/health and scheduled schema diagnostics.
-- This migration does not grant business-data write privileges.
GRANT SELECT ON TABLE public.schema_migrations, public.cms_seo_audits TO rundingan_app_limited;
GRANT SELECT, INSERT, UPDATE ON TABLE public.cms_posts TO rundingan_app_limited;

INSERT INTO schema_migrations(version,description,applied_at)
VALUES ('20261104_006_limited_role_health_read_permissions','Grant limited application role read access to migration markers and SEO audit table metadata',NOW())
ON CONFLICT(version) DO NOTHING;
