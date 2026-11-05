# Custom CMS + SEO Multi-Agent

## Initial delivery (V1)
- Authenticated editorial workspace at `/cms`, linked from the team workspace when the user has CMS read permission.
- Role-protected article listing, draft creation, owner-scoped draft loading and updates, and SEO audit endpoints.
- PostgreSQL schema additions in `db/migrations/20261103_001_custom_cms.sql`.
- CMS role permissions in `db/migrations/20261103_002_cms_permissions.sql`.
- Public article route at `/artikel/[slug]`, with canonical metadata, Open Graph, Twitter summary metadata, and Article JSON-LD.
- Dynamic sitemap includes only published articles.
- `robots.txt` excludes editorial and API paths from crawlers.
- Six specialist SEO audit agents coordinated by a deterministic orchestrator:
  1. Title & Keyword
  2. Meta Description
  3. Content Structure
  4. Keyword Placement
  5. Readability
  6. Technical On-page

## Environment and migration status
- Additive migrations `20261103_001_custom_cms` and `20261103_002_cms_permissions` have been applied and verified on the Neon `development` branch of project `lucky-river-80575728`.
- Owner and Administrator receive full CMS permissions; Unit Manager and Staff can read/create/update drafts and run SEO audits; Viewer is read-only.
- The development branch currently has no Neon Auth users or role assignments. The first intended operator must register on the development preview; the Owner role can then be assigned to that verified account.
- The production branch has not been migrated.
- Vercel preview environment variables for this feature branch are scoped to the Neon development branch and are not added to Production.
- Production rollout remains blocked on review, preview verification, and a separately planned production migration.

## Important boundaries
- V1 creates drafts only. It does not publish, schedule, or silently modify public content.
- CMS page and API routes enforce Neon Auth sessions and database-backed permissions. Draft updates are scoped to the creator.
- SEO audit findings and the metadata draft generator use deterministic local heuristics; they do not call an LLM, search engine, Google Search Console, or external API. Metadata suggestions are explicitly marked for editor review and are not ranking predictions or guarantees.
- The metadata generator coordinates three focused local checks: keyword discovery, search-title shaping, and meta-description shaping. The six existing SEO agents remain audit checks. True LLM generation, live SERP research, competitor analysis, and GSC/Analytics integrations still require a configured provider/connector and separate validation.
- Migrations are additive and non-destructive. Production migration must be applied only after development verification and the project's normal database release process.
- No production migration is run by this PR.

## Follow-on modules
Editorial approval and publishing, revisions/version history, categories/tags, media library, scheduled publishing, redirect manager, reusable SEO templates, search console/analytics connectors, persistent audit history, AI provider routing, per-agent budgets and usage telemetry.
