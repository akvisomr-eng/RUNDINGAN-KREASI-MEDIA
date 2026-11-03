# Custom CMS + SEO Multi-Agent

## Initial delivery (V1)
- Authenticated editorial workspace at `/cms`.
- Draft-only article creation and owner-scoped draft editing.
- PostgreSQL schema additions in `db/migrations/20261103_001_custom_cms.sql`.
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
- Additive migration `20261103_001_custom_cms` has been applied and verified on the Neon `development` branch of project `lucky-river-80575728`.
- The production branch has not been migrated.
- Vercel preview environment variables for this feature branch are scoped to the Neon development branch and are not added to Production.
- Production rollout remains blocked on review, preview verification, and a separately planned production migration.

## Important boundaries
- V1 creates drafts only. It does not publish, schedule, or silently modify public content.
- Every API read/write is protected by a Neon Auth session check. Draft updates are scoped to the creator.
- SEO findings are rule-based heuristics, not live Google Search Console data, ranking predictions, or guarantees.
- The current agent implementation does not call a generative AI provider. It is a deterministic multi-agent audit foundation. LLM research, SERP analysis, content briefs, competitor analysis, internal-link suggestions, schema recommendations, and GSC/Analytics integrations require provider credentials and separately approved integrations.
- Migration is additive and non-destructive. Production migration must be applied only after development verification and the project's normal database release process.
- No production migration is run by this PR.

## Follow-on modules
Editorial roles and approval workflow, revisions/version history, categories/tags, media library, scheduled publishing, redirect manager, reusable SEO templates, search console/analytics connectors, audit history, AI provider routing, per-agent budgets and usage telemetry.
