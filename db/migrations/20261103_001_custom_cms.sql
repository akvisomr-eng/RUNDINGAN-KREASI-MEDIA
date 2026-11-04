-- Rundingan Kreasi Media custom CMS foundation.
-- Safe additive migration: no existing tables or production data are dropped or rewritten.
CREATE TABLE IF NOT EXISTS cms_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'published', 'archived')),
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  focus_keyword TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cms_posts_status_updated_idx
  ON cms_posts (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS cms_posts_published_idx
  ON cms_posts (published_at DESC)
  WHERE status = 'published';

CREATE TABLE IF NOT EXISTS cms_seo_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES cms_posts(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cms_seo_audits_post_created_idx
  ON cms_seo_audits (post_id, created_at DESC);

INSERT INTO schema_migrations(version,description,applied_at)
VALUES ('20261103_001_custom_cms','Create CMS posts and SEO audit foundations',NOW())
ON CONFLICT(version) DO NOTHING;
