# RUNDINGAN MEDIA — Application Blueprint

## Mission
Operate the media business: newsroom, editorial production, publication, advertising, audience operations, and media services.

## Owned data
- editorial desks, beats, assignments, story pitches, drafts, revisions, approvals;
- articles, categories, tags, media assets, publication schedule, corrections;
- journalist/freelancer app assignments and contributor deliverables;
- advertisers, campaigns, placements, media kits, campaign performance;
- app-specific customer interaction notes and service requests;
- advertising insertion orders, campaign delivery evidence, and billing requests.

Canonical customer/advertiser and supplier identity comes from Enterprise Core. Employee identity and payroll remain in Core; Media owns editorial assignments and contributor workflow.

## Module map
1. Newsroom & editorial desk
2. Assignment and contributor management
3. CMS and multi-channel publication
4. Media asset library and rights clearance
5. Advertising sales, campaigns, and placements
6. Media kit and rate-card management
7. Audience and content analytics
8. Editorial calendar and workflow
9. Operational CRM and service requests
10. Billing request and operational finance reports
11. Media AI research/SEO assistance with editorial approval
12. Workspace administration and audit

## Main workflows
Pitch -> editorial triage -> assignment -> research/draft -> fact check -> editor approval -> publication -> correction/analytics.

Advertiser lead -> proposal/rate card -> campaign order -> placement scheduling -> delivery evidence -> approval -> billing request to Core -> journal reference returned.

## Database table families
`editorial_*`, `articles`, `publication_*`, `media_assets`, `rights_clearances`, `advertisers` (Core party references only), `ad_campaigns`, `ad_placements`, `campaign_deliveries`, `media_service_requests`, `billing_requests`, `integration_outbox`, `integration_inbox`, `app_audit_events`.

## Integration
Consume organization, business-unit, party, employee-reference, and entitlement events. Send approved advertising/service billing requests to Core. Store Core journal IDs and posting state; do not create a local GL.

## Acceptance
Editorial approval and correction trails are auditable; unlicensed assets cannot be published; publication requires authorized approval; billing requests are idempotent; Core outage does not lose editorial work; all tenant-owned records are organization-scoped.
