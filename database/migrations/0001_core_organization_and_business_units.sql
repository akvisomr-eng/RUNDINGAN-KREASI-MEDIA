-- 0001_core_organization_and_business_units.sql
-- Initial additive foundation. Apply only to the Neon development branch.
BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'archived')),
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  default_currency CHAR(3) NOT NULL DEFAULT 'IDR',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS business_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived')),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT business_units_org_code_unique UNIQUE (organization_id, code),
  CONSTRAINT business_units_org_slug_unique UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS business_units_org_status_idx
  ON business_units (organization_id, status)
  WHERE deleted_at IS NULL;

INSERT INTO organizations (name, slug)
VALUES ('Rundingan Kreasi Media', 'rundingan-kreasi-media')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO business_units (organization_id, code, name, slug, description)
SELECT o.id, v.code, v.name, v.slug, v.description
FROM organizations o
CROSS JOIN (VALUES
  ('MEDIA', 'Rundingan Media', 'rundingan-media', 'Kanal digital, publikasi, video, podcast, dan konten edukatif.'),
  ('ACADEMY', 'Rundingan Academy', 'rundingan-academy', 'Pendidikan, pelatihan multimedia, dan pengembangan keterampilan.'),
  ('RENTAL', 'Rundingan Rental', 'rundingan-rental', 'Penyewaan peralatan kamera dan produksi.'),
  ('PRODUCTION', 'Rundingan Production', 'rundingan-production', 'Layanan produksi video, livestreaming, dan dokumentasi.'),
  ('CREATIVE', 'Rundingan Creative', 'rundingan-creative', 'Branding, desain, dan layanan kreatif.'),
  ('EVENT', 'Rundingan Event', 'rundingan-event', 'Produksi dan dukungan penyelenggaraan acara.')
) AS v(code, name, slug, description)
WHERE o.slug = 'rundingan-kreasi-media'
ON CONFLICT (organization_id, code) DO NOTHING;

INSERT INTO schema_migrations (version, description)
VALUES ('0001', 'Core organization and six business units')
ON CONFLICT (version) DO NOTHING;

COMMIT;
