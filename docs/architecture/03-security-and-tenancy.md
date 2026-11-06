# Security, Identity, and Tenant Isolation Baseline

## Security boundary

Every application is a separate security boundary. A shared login does not imply shared authorization, and a user authenticated in one app is not automatically authorized for every organization, business unit, module, or record.

## Identity and SSO

Target model:
1. Enterprise Core (or an explicitly approved central identity provider) is the identity authority.
2. Each specialist app is registered as a separate OIDC client with its own audience and redirect URIs.
3. Use Authorization Code with PKCE for browser/mobile sign-in.
4. Each API validates token signature, issuer, audience, expiry, and required scopes.
5. Each app maintains its own secure application session and does not share raw session cookies or database credentials.
6. Provisioning and deprovisioning are reflected through central membership/entitlement checks and events.

Do not assume the existing Neon Auth setup automatically provides cross-project SSO. Verify provider support, token claims, audience handling, trusted domains, and production session behavior before selecting the concrete SSO implementation.

## Authorization

- RBAC is enforced server-side, never only in navigation or client components.
- Every protected route/action checks the session and permission.
- Every database query is scoped by organization and, where relevant, business unit.
- The server derives allowed organization/unit scope from authenticated membership; request body values are not sufficient.
- Privileged actions require explicit permissions and audit events.
- Role grants/revocations are auditable and take effect promptly.
- Service-to-service credentials have narrow scopes and can be rotated independently.

## Database isolation

For the initial shared specialist Neon project:
- Use a distinct database for each specialist app.
- Use a distinct runtime login role per app, scoped to its database with read/write data privileges only.
- Use a separate migration role per app. It may create and change objects only in its own database/schema; it must not be a Neon administrator or bypass RLS.
- Runtime roles must not have schema CREATE privileges.
- Revoke PUBLIC CONNECT/TEMP database privileges where not required, then explicitly grant CONNECT only to the app's runtime and migration roles.
- Revoke PUBLIC CREATE on application schemas. Grant schema CREATE only to the matching migration role.
- Configure default privileges so objects created by the migration role grant only the required DML/sequence privileges to that app's runtime role.
- Verify both positive access (own database) and negative access (other databases) on every environment.
- Do not distribute a project owner or superuser credential to application runtimes.
- Use pooled connections for ordinary serverless request traffic and direct connections for migrations.
- Keep credentials in the matching Vercel project environment only.

Enterprise Core and specialist applications must not share application runtime database credentials.

## Tenant isolation

- Include organization ID on every tenant-owned record.
- Use composite foreign keys for organization-scoped relationships.
- Apply RLS where supported and appropriate, with a documented policy for every tenant-owned table.
- Where RLS is not enabled, prove server-side isolation with comprehensive authorization tests and restricted runtime database roles.
- Test cross-organization and cross-business-unit reads, updates, deletes, exports, background jobs, and event consumers.
- Do not enable RLS globally until policies, role semantics, and connection context have been designed and tested on a non-production branch.

## Audit and observability

Capture:
- actor/service identity;
- organization and business unit;
- action and resource;
- timestamp and request/correlation ID;
- outcome and reason code;
- before/after metadata where legally appropriate.

Never log passwords, access tokens, cookie secrets, database URLs, private keys, or full payment credentials.

## Release security gates

A release is blocked until:
- unauthenticated API requests return 401;
- unauthorized requests return 403;
- cross-tenant access tests fail safely;
- service credentials cannot connect to another app database;
- webhook signatures and replay protections are tested;
- sensitive fields are permission-filtered;
- backup restore is tested;
- secret scanning and dependency checks pass.
