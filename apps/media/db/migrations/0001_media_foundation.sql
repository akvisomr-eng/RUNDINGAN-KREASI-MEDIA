-- RUNDINGAN MEDIA initial schema.
-- Apply only to db_media after review on the development branch.
-- This migration is intentionally NOT auto-applied by CI or application startup.

BEGIN;

CREATE TABLE IF NOT EXISTS editorial_desks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug),
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS editorial_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  desk_id UUID NOT NULL,
  title TEXT NOT NULL,
  brief TEXT,
  assignee_core_user_id UUID,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','assigned','in_progress','submitted','approved','cancelled')),
  created_by_core_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, desk_id)
    REFERENCES editorial_desks (organization_id, id)
);

CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  desk_id UUID,
  assignment_id UUID,
  slug TEXT NOT NULL,
  headline TEXT NOT NULL,
  dek TEXT,
  body_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','in_review','approved','scheduled','published','archived','correction')),
  author_core_user_id UUID NOT NULL,
  editor_core_user_id UUID,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, slug),
  FOREIGN KEY (organization_id, desk_id)
    REFERENCES editorial_desks (organization_id, id),
  FOREIGN KEY (organization_id, assignment_id)
    REFERENCES editorial_assignments (organization_id, id)
);

CREATE TABLE IF NOT EXISTS article_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  article_id UUID NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  headline TEXT NOT NULL,
  dek TEXT,
  body_json JSONB NOT NULL,
  change_note TEXT,
  created_by_core_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, article_id, version_number),
  FOREIGN KEY (organization_id, article_id)
    REFERENCES articles (organization_id, id)
);

CREATE TABLE IF NOT EXISTS article_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  article_id UUID NOT NULL,
  article_version_id UUID NOT NULL,
  reviewer_core_user_id UUID NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved','rejected','changes_requested')),
  notes TEXT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, article_id)
    REFERENCES articles (organization_id, id),
  FOREIGN KEY (organization_id, article_version_id)
    REFERENCES article_versions (organization_id, id)
);

CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  storage_key TEXT NOT NULL,
  media_type TEXT NOT NULL,
  original_filename TEXT,
  checksum_sha256 TEXT,
  uploaded_by_core_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, storage_key)
);

CREATE TABLE IF NOT EXISTS asset_rights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  asset_id UUID NOT NULL,
  rights_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (rights_status IN ('pending','cleared','restricted','expired','rejected')),
  rights_holder TEXT,
  license_reference TEXT,
  permitted_use TEXT,
  expires_at TIMESTAMPTZ,
  verified_by_core_user_id UUID,
  verified_at TIMESTAMPTZ,
  FOREIGN KEY (organization_id, asset_id)
    REFERENCES media_assets (organization_id, id)
);

CREATE TABLE IF NOT EXISTS publication_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  article_id UUID NOT NULL,
  article_version_id UUID NOT NULL,
  channel TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','processing','published','failed','cancelled')),
  external_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, article_id)
    REFERENCES articles (organization_id, id),
  FOREIGN KEY (organization_id, article_version_id)
    REFERENCES article_versions (organization_id, id)
);

CREATE TABLE IF NOT EXISTS integration_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','delivered','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS integration_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  source_system TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE (source_system, source_event_id)
);

CREATE TABLE IF NOT EXISTS app_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  actor_core_user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  request_id TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('success','denied','failure')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignments_org_status_due
  ON editorial_assignments (organization_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_articles_org_status_updated
  ON articles (organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_publication_jobs_org_status_schedule
  ON publication_jobs (organization_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_outbox_status_retry
  ON integration_outbox (status, next_attempt_at);

-- Defense in depth: all tenant-owned tables require an organization context
-- established by trusted server code inside the same database transaction.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'editorial_desks',
    'editorial_assignments',
    'articles',
    'article_versions',
    'article_approvals',
    'media_assets',
    'asset_rights',
    'publication_jobs',
    'integration_outbox',
    'integration_inbox',
    'app_audit_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (organization_id = NULLIF(current_setting(''app.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = NULLIF(current_setting(''app.organization_id'', true), '''')::uuid)',
      table_name
    );
  END LOOP;
END $$;

COMMIT;
