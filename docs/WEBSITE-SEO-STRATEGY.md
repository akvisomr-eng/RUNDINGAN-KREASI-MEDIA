# Website SEO — Rundingan Kreasi Media

## Strategic scope

The canonical SEO surface is the Rundingan Kreasi Media website. YouTube, Instagram, and TikTok remain optional manual distribution channels and are not dependencies for SEO generation, indexing, measurement, or publishing.

## Implemented foundation

- One canonical site-origin helper (NEXT_PUBLIC_SITE_URL) is shared by global metadata, article canonical URLs, robots.txt, and sitemap.xml.
- The current safe fallback is the verified Vercel production hostname. When a company-owned custom domain is configured and verified, set NEXT_PUBLIC_SITE_URL to its origin in Vercel Production and Preview environments.
- Global Organization and WebSite JSON-LD are emitted in Indonesian.
- Published CMS articles are listed in the sitemap; article pages emit Article JSON-LD with publication and modification dates.
- Private application paths (/auth/, /workspace/, /admin/, /cms/, /api/) are disallowed for crawlers. Access control remains enforced by application authentication; robots rules are not a security boundary.
- SEO audit receives the article excerpt as context.

## Editorial SEO workflow

1. Choose one primary search intent and focus keyword for each article.
2. Write a useful, original article with a descriptive H1 and logical H2/H3 sections.
3. Generate or edit SEO title and meta description, then review factual accuracy and search intent.
4. Add meaningful internal links to related Rundingan pages and articles.
5. Add descriptive image alt text when article image support is introduced.
6. Editor reviews canonical URL, metadata, structured data, and article preview before publishing.
7. Confirm the published URL appears in sitemap and returns an indexable page.

## Measurement and next integrations

- Verify the production property in Google Search Console and submit /sitemap.xml.
- Connect a privacy-conscious analytics solution or Google Analytics 4 only after the site's consent/privacy requirements are defined.
- Build a first-party Search Performance dashboard from Search Console data: clicks, impressions, CTR, average position, indexed pages, and query/page trends.
- Add internal-link suggestions, duplicate/cannibalization checks, broken-link checks, redirect/canonical checks, and content freshness alerts.
- Add a technical SEO health report for Core Web Vitals, mobile usability, indexability, and structured-data validation.

## Guardrails

- SEO scores are editorial heuristics, not Google ranking signals or guarantees.
- Never generate fabricated facts, search volume, ranking positions, backlinks, or competitor findings.
- AI suggestions remain drafts until an editor approves them.
- Do not publish or alter social accounts through this SEO workflow.
- Do not claim Search Console or analytics is connected until credentials, property ownership, and live data retrieval are verified.

## Current known data limitation

The Production cms_posts table currently returned no grouped status rows during the latest read-only inspection. Populate and publish a small set of high-quality, reviewed articles before evaluating sitemap coverage or search performance.
