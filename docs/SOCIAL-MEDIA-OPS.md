# Social Media Operations

## Scope of this phase

The Media workspace now supports editor-owned social content records for YouTube, Instagram, and TikTok. A record can hold the shared brief, platform-specific title/description/captions, hashtags, target accounts, asset reference, rights evidence, editorial status, and a planned local publication time.

The workspace reuses the existing organization-scoped \`module_work_items\` table and shared transaction/audit trail. No new database migration or platform credential is required for draft planning.

## Embedded specialist agents

- **Social Content Quality Agent** — checks that each selected platform has its required copy and that hashtags are present.
- **Social Rights & Safety Agent** — checks asset URL, source/permission evidence, and rights status.
- **Social Publishing Readiness Agent** — checks destination handles and planned time, and explicitly warns while OAuth is not connected.
- **Social Media Orchestrator** — consolidates specialist findings from the last 24 hours and can optionally use the configured private local model.

These are deterministic embedded-rule agents by default. They do not perform live trend research, generate copy with a cloud LLM, fetch account analytics, schedule a platform job, or publish content.

## Account destinations configured in the workspace

- YouTube: \`@rundingan\`
- Instagram: \`@rundingan.id\`
- TikTok: \`@rundingan.id\`

These are destination labels only. They do not mean the accounts are authenticated or connected.

## OAuth and publishing prerequisites

### YouTube

Register a Google Cloud OAuth client, enable YouTube Data API v3, configure the exact callback URL, and obtain user consent for the \`youtube.upload\` scope (plus read-only scopes only when required). Upload operations consume YouTube API quota. Store refresh tokens encrypted server-side; never expose tokens to the browser.

### Instagram

Use Meta's Instagram API for a Professional account (Business or Creator). Confirm the account/Page linkage and required permissions such as \`instagram_basic\` and \`instagram_content_publish\`, then complete Meta app review/verification as applicable. Consumer/personal accounts are not eligible for the publishing workflow described here.

### TikTok

Register a TikTok for Developers app, add Content Posting API, configure OAuth redirect URLs, request and obtain approval for \`video.publish\`, and have the target creator authorize the app. TikTok unaudited clients are restricted to private-only visibility; public posting requires the relevant audit. Respect creator information, privacy-level choices, upload-source/domain verification, and rate limits.

## Security and release requirements

- Add provider credentials only as encrypted Vercel environment variables; never commit them.
- Use separate OAuth clients and redirect URLs for Preview and Production.
- Encrypt provider access/refresh tokens at rest with a dedicated server-side key; do not log them.
- Implement token refresh, revocation, account disconnect, least-privilege scopes, rate limits, idempotency, retry/backoff, and audit logging.
- Require explicit editor approval for every publish job. Do not auto-publish based only on an AI agent recommendation.
- Verify each platform's app review status and test with a private/draft destination before enabling public publication.
- Analytics requires separate approved read scopes and must distinguish organic metrics from paid metrics.

## Current operational status

The planning and review workspace plus embedded specialist checks are implemented in this phase. OAuth connection, direct publishing, live analytics, and LLM-based social copy generation remain disabled until company-owned developer app credentials, approved scopes, token encryption configuration, and a configured AI provider are supplied and tested.
