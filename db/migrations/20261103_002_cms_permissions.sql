-- Add CMS permissions and grant them to the existing organization roles.
-- Additive only; no existing role assignments or permissions are removed.
INSERT INTO permissions (code, module, description)
VALUES
  ('cms.posts.read', 'cms', 'View CMS articles and drafts'),
  ('cms.posts.create', 'cms', 'Create CMS article drafts'),
  ('cms.posts.update', 'cms', 'Update own CMS article drafts'),
  ('cms.posts.review', 'cms', 'Review articles submitted for editorial approval'),
  ('cms.posts.publish', 'cms', 'Publish approved CMS articles'),
  ('cms.posts.delete', 'cms', 'Archive or remove CMS articles'),
  ('cms.seo.audit', 'cms', 'Run SEO audit agents'),
  ('cms.media.manage', 'cms', 'Manage CMS media library'),
  ('cms.taxonomy.manage', 'cms', 'Manage article categories and tags')
ON CONFLICT (code) DO UPDATE
SET module = EXCLUDED.module, description = EXCLUDED.description;

-- Owner and administrator receive full CMS control.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN organizations o ON o.id = r.organization_id
JOIN permissions p ON p.code IN (
  'cms.posts.read', 'cms.posts.create', 'cms.posts.update',
  'cms.posts.review', 'cms.posts.publish', 'cms.posts.delete',
  'cms.seo.audit', 'cms.media.manage', 'cms.taxonomy.manage'
)
WHERE o.slug = 'rundingan-kreasi-media'
  AND r.code IN ('owner', 'administrator')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Editors and unit managers can create and maintain drafts, but cannot publish.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN organizations o ON o.id = r.organization_id
JOIN permissions p ON p.code IN (
  'cms.posts.read', 'cms.posts.create', 'cms.posts.update', 'cms.seo.audit'
)
WHERE o.slug = 'rundingan-kreasi-media'
  AND r.code IN ('unit_manager', 'staff')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Viewers can inspect content but cannot mutate it.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN organizations o ON o.id = r.organization_id
JOIN permissions p ON p.code = 'cms.posts.read'
WHERE o.slug = 'rundingan-kreasi-media'
  AND r.code = 'viewer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('20261103_002_cms_permissions', 'Add role-based permissions for CMS and SEO agents', NOW())
ON CONFLICT (version) DO NOTHING;
