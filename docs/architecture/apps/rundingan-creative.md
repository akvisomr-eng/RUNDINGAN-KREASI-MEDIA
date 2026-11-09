# RUNDINGAN CREATIVE — Application Blueprint

## Mission
Manage design, branding, advertising creative, digital content, illustration, and creative service projects.

## Owned data
- creative briefs, discovery notes, brand strategy, and design requirements;
- brand identities, design systems, templates, and approved brand assets;
- creative project boards, tasks, milestones, review rounds, and revisions;
- source files, previews, exports, and deliverable packages;
- licensing, usage scope, rights, and client approvals;
- creative estimates, milestone billing requests, and service analytics.

Client, supplier, and employee identities reference Core. Creative owns design assets and revision history; it does not own the shared customer master or central finance ledger.

## Module map
1. Creative intake and brief
2. Brand strategy and identity
3. Brand asset library and design system
4. Creative project management
5. Design production workspace
6. Review, comments, and revision rounds
7. Approval and sign-off
8. Asset export and delivery
9. License and usage rights
10. Client relationship activity
11. Estimates and billing requests
12. Creative performance analytics and AI-assisted ideation

## Main workflows
Brief -> discovery -> creative direction -> estimate -> approval -> production -> internal QA -> client review -> revision -> sign-off -> delivery -> billing request -> archive.

## Database table families
`creative_briefs`, `creative_projects`, `brand_profiles`, `brand_guidelines`, `brand_assets`, `design_systems`, `creative_tasks`, `creative_files`, `review_rounds`, `review_comments`, `approval_records`, `deliverable_packages`, `usage_licenses`, `billing_requests`, `integration_outbox`, `integration_inbox`, `app_audit_events`.

## Integration
Consume Core party, organization/business-unit, employee-reference, entitlement, and finance status events. Submit approved creative service billing and vendor cost requests to Core. Keep file storage private and issue time-limited access URLs after authorization.

## Acceptance
Every deliverable has a version and rights record; approvals are tied to exact versions; client access is restricted to their projects; private source files are not publicly addressable; billing milestones reconcile to Core.
