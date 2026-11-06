# RUNDINGAN PRODUCTION — Application Blueprint

## Mission
Manage audiovisual, film, video, broadcast, photography, and commercial production projects from brief through delivery.

## Owned data
- client production briefs, project scope, creative treatment, and proposals;
- scripts, storyboards, shot lists, call sheets, schedules, locations;
- crew assignments, freelance engagement records, availability;
- production equipment bookings and asset requests;
- shoot reports, media ingest, edit versions, review notes, deliverables;
- project budgets, estimates, cost tracking, change orders, and billing requests;
- release forms, licenses, usage rights, and delivery evidence.

Client identity, supplier identity, and employee identity reference Core. Rental equipment bookings may integrate with RUNDINGAN RENTAL; production does not duplicate the Rental asset availability ledger.

## Module map
1. Client brief and project intake
2. Proposal, treatment, and quotation
3. Script and storyboard
4. Production planning and scheduling
5. Crew and freelancer coordination
6. Location and equipment booking
7. Shoot-day operations and call sheets
8. Media ingest and asset tracking
9. Post-production and review versions
10. Deliverables, approvals, and rights
11. Budget, cost tracking, and billing requests
12. Production analytics and AI-assisted planning

## Main workflows
Brief -> discovery -> proposal/estimate -> approval -> pre-production -> crew/location/equipment booking -> production -> post-production -> client review -> revision -> final delivery -> billing request -> archive.

## Database table families
`production_projects`, `production_briefs`, `project_proposals`, `project_estimates`, `scripts`, `storyboards`, `shot_lists`, `production_schedules`, `crew_assignments`, `location_bookings`, `equipment_bookings`, `shoot_reports`, `media_assets`, `edit_versions`, `client_reviews`, `deliverables`, `rights_releases`, `change_orders`, `billing_requests`, `integration_outbox`, `integration_inbox`, `app_audit_events`.

## Integration
Use Core party/employee references; request equipment from Rental where applicable; submit approved project invoices and vendor/crew cost postings to Core. No local general ledger.

## Acceptance
Project scope and estimate revisions are traceable; crew and equipment conflicts are prevented; media rights are recorded before delivery; review approvals are version-bound; project cost and billing totals reconcile with Core posting references.
