# Integration API and Event Contracts

## API conventions

- Base path: `/api/v1`.
- Format: JSON over HTTPS.
- Contract: OpenAPI 3.1, versioned and checked into the owning repository.
- Authentication: short-lived, audience-restricted access tokens issued by the central identity layer; each service validates issuer, audience, signature, expiry, and required scopes.
- Authorization: enforce organization, business-unit, role, and resource permissions on the server for every request.
- Use TLS for all service-to-service traffic.
- Use request IDs and correlation IDs for traceability.
- Return stable machine-readable error codes; never expose SQL, stack traces, secrets, or internal credentials.

## Required request context

Where relevant, authenticated requests carry:
- `sub`: immutable user subject;
- `org_id`: active organization;
- `business_unit_id`: active business unit, if scoped;
- `aud`: intended service;
- `scope`: granted capabilities;
- `jti`: token identifier;
- `exp`, `iat`, and `iss`.

The receiving service must not trust organization or business-unit IDs supplied only in an arbitrary request body. It must validate the context against the authenticated principal and current membership/entitlements.

## Standard response envelope

Success:
```json
{
  "data": {},
  "meta": {
    "request_id": "uuid",
    "schema_version": "1"
  }
}
```

Error:
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "The requested operation is not permitted.",
    "request_id": "uuid"
  }
}
```

## Core endpoints to establish

| Endpoint | Owner | Purpose |
|---|---|---|
| `GET /api/v1/me` | Enterprise Core | Resolve current identity and organization memberships |
| `GET /api/v1/organizations/{id}/business-units` | Enterprise Core | Resolve allowed business units |
| `GET /api/v1/parties/{id}` | Enterprise Core | Read canonical customer/supplier reference |
| `GET /api/v1/employees/{id}` | Enterprise Core | Read authorized employee reference |
| `POST /api/v1/finance/postings` | Enterprise Core | Validate and post approved source transaction |
| `GET /api/v1/finance/postings/{id}` | Enterprise Core | Retrieve posting status and journal reference |
| `POST /api/v1/integrations/events` | Integration Hub | Accept authenticated event delivery |
| `GET /api/v1/entitlements/{application}` | Enterprise Core | Resolve app subscription and enabled capabilities |

Endpoint list is a target contract, not a claim that these routes already exist. Final schemas must be generated and reviewed before implementation.

## Event envelope

```json
{
  "event_id": "uuid",
  "event_type": "party.updated",
  "schema_version": "1",
  "source_system": "rundingan-core",
  "organization_id": "uuid",
  "aggregate_type": "party",
  "aggregate_id": "uuid",
  "occurred_at": "2026-11-06T00:00:00Z",
  "correlation_id": "uuid",
  "data": {}
}
```

Events are signed or delivered through authenticated service credentials. Consumers validate the signature/credential, schema version, organization scope, and replay/deduplication state.

## Initial event catalog

| Event | Producer | Consumers |
|---|---|---|
| `organization.updated` | Enterprise Core | All enabled apps |
| `business_unit.updated` | Enterprise Core | All enabled apps |
| `party.created`, `party.updated`, `party.deactivated` | Enterprise Core | Apps that use party references |
| `employee.updated`, `employee.deactivated` | Enterprise Core | Apps that use employee references |
| `transaction.approved` | Specialist app | Enterprise Core |
| `finance.posting.completed`, `finance.posting.rejected` | Enterprise Core | Originating specialist app |
| `subscription.entitlement.changed` | Enterprise Core | Affected app |

## Reliability requirements

- At-least-once delivery with idempotent consumers.
- Outbox records committed in the same transaction as the source change.
- Consumer inbox/deduplication key unique on `event_id` and consumer.
- Exponential retry with bounded attempts and dead-letter visibility.
- Replay must preserve the original event ID and must not repeat side effects.
- Financial commands additionally require an idempotency key unique within source system and organization.
- Record correlation IDs from UI request through service call, event, and finance posting.

## Versioning and compatibility

- Additive optional fields are backward compatible.
- Breaking changes require a new API major version or event schema version.
- Producers must publish a compatibility window before retiring old fields or event versions.
- Contract tests run in CI for each producer and consumer.
