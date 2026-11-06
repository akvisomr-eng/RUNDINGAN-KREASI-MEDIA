# RUNDINGAN EVENT — Application Blueprint

## Mission
Plan and operate conferences, exhibitions, performances, community gatherings, corporate events, and public activations.

## Owned data
- event concepts, briefs, schedules, venues, capacity, and floor plans;
- registration, ticket types, attendee records, check-in, and access control;
- sponsor packages, exhibitor allocations, and event partner deliverables;
- vendor work orders, procurement requirements, and fulfillment tracking;
- staffing rosters, run-of-show, stage/technical requirements, and incident logs;
- ticket sales, sponsorship receivables, refunds, vendor costs, and billing requests.

Customer, supplier, sponsor, and employee identities reference Core. Event owns event-specific attendee registration and consent data; it does not create duplicate global customer identities or maintain a general ledger.

## Module map
1. Event portfolio and brief intake
2. Venue, capacity, and floor plan
3. Event schedule and run-of-show
4. Registration and ticketing
5. Attendee and check-in operations
6. Sponsor and exhibitor management
7. Vendor and procurement coordination
8. Staffing and crew rosters
9. Stage, technical, and production requirements
10. Safety, incident, and contingency logs
11. Ticket/sponsor billing and settlement requests
12. Event analytics and post-event reporting

## Main workflows
Brief -> feasibility -> venue hold -> budget/approval -> event page -> registration/ticketing -> vendor and crew planning -> run-of-show -> live event/check-in -> incident tracking -> settlement/billing -> post-event report.

## Database table families
`events`, `event_versions`, `venues`, `venue_holds`, `event_spaces`, `event_schedules`, `ticket_types`, `registrations`, `attendees`, `check_ins`, `sponsor_packages`, `sponsor_deliverables`, `exhibitor_allocations`, `vendor_orders`, `staff_rosters`, `run_of_show_items`, `incident_reports`, `settlement_requests`, `billing_requests`, `integration_outbox`, `integration_inbox`, `app_audit_events`.

## Integration
Consume Core parties, suppliers, employee references, business units, entitlements, and finance status events. Submit approved ticket, sponsorship, vendor, and event service postings to Core with idempotency keys. Rental and Production may provide equipment and production services through their own APIs.

## Acceptance
Ticket capacity and duplicate check-in are controlled; refunds and settlements are auditable; vendor commitments are approved; run-of-show changes are versioned; attendee personal data is access-controlled and retained only as required.
