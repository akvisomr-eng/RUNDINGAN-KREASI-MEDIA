# RUNDINGAN MEDIA ↔ Enterprise Core Integration Contract

**Status:** Proposed contract for review — not an enabled integration.  
**Scope:** Identity, organization context, authorization, shared master-data references, billing requests, audit, and event delivery.  
**Security rule:** MEDIA must fail closed until the Core identity and authorization contract is implemented and verified.

## 1. Ownership boundaries

| Concern | System of record | MEDIA behavior |
|---|---|---|
| User identity and credentials | Enterprise Core identity provider | Consume verified identity; never create a competing user account |
| Organization and membership | Enterprise Core | Consume authorized organization membership references |
| Roles, permissions, subscriptions and entitlements | Enterprise Core | Enforce returned permissions/entitlements on the server |
| Customer, supplier, employee master records | Enterprise Core | Store Core IDs and read approved projections only |
| General Ledger, AR/AP, cash and bank | Enterprise Core | Submit billing/finance requests; never write journals directly |
| Editorial desks, assignments, articles, versions, approvals | MEDIA database | Own and operate these records |
| Media files, rights and publication jobs | MEDIA database (file bytes in approved object storage) | Own operational metadata and workflow |
| Advertising campaign delivery metrics | MEDIA database | Own operational campaign execution; send financial references to Core |

MEDIA must not duplicate Core master data or post directly to the Core ledger. Cross-system references use immutable Core IDs, not copied mutable master records.

## 2. Identity and tenant context

The eventual integration must use the identity provider already selected and deployed by Enterprise Core. Do not introduce a second login provider in MEDIA.

The Core-to-MEDIA server contract must provide a verified principal with at least:
- `sub`: immutable Core user ID
- `org_id`: organization selected by the user and verified by Core membership checks
- `permissions`: effective permission codes for the requested MEDIA operation
- `entitlements`: active product/module access, where applicable
- `iss`, `aud`, `exp`, `iat`, and token identifier / key identifier as required by the chosen protocol

Validation requirements:
1. Verify signature using the trusted issuer's published key set or the agreed server-to-server verification mechanism.
2. Pin the expected issuer and MEDIA audience; validate expiry and not-before.
3. Reject missing, malformed, expired, wrong-audience, or untrusted credentials.
4. Resolve the active organization from the verified Core membership context. Never trust an organization ID supplied only by a browser form, URL, header, or request body.
5. Check the required permission and active entitlement on every protected server action.
6. Record actor, organization, request ID, action, resource, and outcome in MEDIA audit events.
7. Do not put service credentials or signing secrets in client-side code.

**Open decision:** Core's actual auth provider, token format, issuer, audience, key-discovery URL, session interface, and permission response have not yet been verified. Until then, no MEDIA route may infer authentication from a client-supplied user or organization ID.

## 3. Proposed versioned Core API

These are contract proposals, not claims that endpoints already exist. Core owners must confirm paths, payloads, scopes, and response schemas before implementation.

| Proposed operation | Purpose | Expected authorization |
|---|---|---|
| `GET /api/v1/me` | Current principal and session summary | Authenticated user |
| `GET /api/v1/me/organizations` | Organizations the user may access | Authenticated user |
| `GET /api/v1/organizations/{orgId}/media-context` | Effective MEDIA permissions and entitlements for one verified membership | User token or trusted service assertion |
| `GET /api/v1/parties/{partyId}/summary` | Approved customer/advertiser reference projection | MEDIA read scope |
| `POST /api/v1/finance/billing-requests` | Submit an approved billing request for a campaign/order | MEDIA billing-request scope |
| `POST /api/v1/audit/external-events` | Optional central audit forwarding | Service-to-service scope |

API requirements:
- JSON over HTTPS; explicit versioning and stable error codes.
- Correlation via `X-Request-Id`; propagate a generated ID when absent.
- Rate limits and bounded request/response sizes.
- Least-privilege scopes; no generic database or ledger-write API.
- Return only fields needed by MEDIA; avoid exporting sensitive HR, finance, or personal data.
- Use idempotency keys for every create/submit operation that can be retried.

## 4. Proposed event envelope

Events exchanged between Core and MEDIA must use a documented envelope:

```json
{
  "event_id": "uuid",
  "event_type": "core.organization.membership.updated",
  "event_version": 1,
  "occurred_at": "2026-01-01T00:00:00Z",
  "producer": "enterprise-core",
  "tenant": { "organization_id": "uuid" },
  "subject": { "type": "user", "id": "uuid" },
  "correlation_id": "request-or-trace-id",
  "data": {}
}
```

Required controls:
- Authenticate producer using the selected signed-webhook or mTLS scheme.
- Verify signature over the raw request body, enforce timestamp tolerance, and reject replayed event IDs.
- Persist the event in `integration_inbox` before acknowledging it.
- Enforce uniqueness on `(source_system, source_event_id)`; process idempotently.
- Retry transient failures with exponential backoff and dead-letter visibility.
- Do not process an event whose organization context is missing or inconsistent.
- Keep an outbox record in the same transaction as the local state change for outbound events.

Suggested initial event types (subject to Core approval):
- `core.organization.membership.updated`
- `core.organization.status.changed`
- `core.entitlement.changed`
- `core.party.reference.updated`
- `media.billing_request.submitted`
- `media.publication.completed`

## 5. MEDIA authorization model

Proposed permission codes (Core must approve the canonical names):
- `media.workspace.view`
- `media.editorial.desk.manage`
- `media.assignment.manage`
- `media.article.create`
- `media.article.edit`
- `media.article.review`
- `media.article.approve`
- `media.article.publish`
- `media.asset.manage`
- `media.asset.rights.verify`
- `media.advertising.manage`
- `media.analytics.view`
- `media.integration.manage`

Rules:
- UI visibility is not authorization; enforce checks in server handlers/actions.
- Default deny. A missing permission or entitlement means no access.
- Approval and publication should be separate permissions; authors cannot approve their own article unless an explicit policy permits it.
- Finance operations remain Core-owned. MEDIA can request, view approved status, and link references only.
- Organization switching must revalidate membership and refresh the server-side context.

## 6. Database and RLS transaction boundary

MEDIA database `db_media` is isolated from Core and all other specialist databases. The runtime role must remain non-owner, non-superuser, and without `BYPASSRLS`.

Every tenant query must run in a transaction that sets the organization context locally:

```sql
BEGIN;
SELECT set_config('app.organization_id', '<organization-id-from-verified-Core-context>', true);
-- Tenant-scoped statements, using parameterized SQL.
COMMIT;
```

Implementation requirements:
- Use a transaction-capable PostgreSQL driver/client; do not use a one-shot HTTP query helper for a multi-statement transaction unless its documented transaction semantics guarantee one backend session.
- Set context with transaction-local semantics (`true`); never use session-persistent `SET` on pooled connections.
- Do not expose a generic query function to route handlers.
- Validate UUIDs and bind values as parameters.
- Test that a missing context returns no rows and rejects inserts; test tenant A cannot read/write tenant B.
- Test pooled connection reuse: after commit/rollback, a subsequent transaction without context must have no tenant context.
- Keep authorization checks in the application even with RLS enabled.

## 7. Error contract

Use stable error categories:
- `AUTH_REQUIRED` — no valid identity.
- `AUTH_INVALID` — invalid issuer, audience, signature, or expiry.
- `ORG_CONTEXT_REQUIRED` — no verified active organization.
- `ORG_ACCESS_DENIED` — no membership in requested organization.
- `PERMISSION_DENIED` — principal lacks required permission.
- `ENTITLEMENT_INACTIVE` — module/subscription not active.
- `IDEMPOTENCY_CONFLICT` — same key used with a different request body.
- `DEPENDENCY_UNAVAILABLE` — Core temporarily unavailable; fail closed for privileged actions.
- `VALIDATION_ERROR` — invalid request payload.

Do not return tokens, connection strings, stack traces, SQL, or secret values in API errors.

## 8. Delivery gates

| Gate | Evidence required | Current state |
|---|---|---|
| Confirm Core auth provider and token/session contract | Source code + documented issuer/audience/claims | Pending |
| Confirm organization membership and permission API | Tested contract and negative cases | Pending |
| Confirm API scopes and service credentials | Approved least-privilege scopes | Pending |
| Implement MEDIA server-side auth adapter | Automated unit/integration tests | Not started |
| Implement transaction-safe tenant DB boundary | Pool reset + cross-tenant tests | Development schema only |
| Implement signed inbox/outbox | Signature, replay, retry and idempotency tests | Schema foundation only |
| Configure Vercel Preview secrets | Correct Preview environment and runtime-role URL | Pending |
| User acceptance and security review | Signed-off test evidence | Pending |
| Production rollout | Explicit approval after all prior gates | Not authorized |

## 9. Non-goals

This contract does not authorize:
- changing Enterprise Core authentication or its production database;
- sharing database credentials or connecting MEDIA directly to Core PostgreSQL;
- writing to Core General Ledger, HR, payroll, or subscription tables;
- enabling public browser-to-database access;
- configuring production secrets, domains, or deployments;
- publishing articles automatically without an authorized editorial approval workflow.
