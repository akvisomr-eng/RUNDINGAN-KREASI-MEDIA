import { auth } from '@/lib/auth/server';
import { hasPermission } from '@/lib/auth/permissions';
import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allowed = await hasPermission(session.user.id, 'crm.parties.read');
  if (!allowed) {
    return Response.json({ error: 'Forbidden', message: 'Akses CRM belum diberikan.' }, { status: 403 });
  }

  const sql = getSql();
  const parties = await sql`
    SELECT id, party_type, legal_name, display_name, email, phone, status, created_at
    FROM parties
    WHERE organization_id = (
      SELECT id FROM organizations WHERE slug = 'rundingan-kreasi-media'
    )
    AND deleted_at IS NULL
    ORDER BY display_name ASC
    LIMIT 100
  `;

  return Response.json({ data: parties });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const requestHost = request.headers.get('host');
  if (!origin || !requestHost || new URL(origin).host !== requestHost) {
    return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allowed = await hasPermission(session.user.id, 'crm.parties.create');
  if (!allowed) {
    return Response.json({ error: 'Forbidden', message: 'Izin membuat data CRM belum diberikan.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'Request body must be an object.' }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const partyType = input.party_type;
  const legalName = typeof input.legal_name === 'string' ? input.legal_name.trim() : '';
  const displayName = typeof input.display_name === 'string' ? input.display_name.trim() : legalName;
  const email = typeof input.email === 'string' ? input.email.trim() : null;
  const phone = typeof input.phone === 'string' ? input.phone.trim() : null;

  if (partyType !== 'customer' && partyType !== 'supplier' && partyType !== 'both') {
    return Response.json({ error: 'party_type must be customer, supplier, or both.' }, { status: 400 });
  }
  if (!legalName || legalName.length > 200 || !displayName || displayName.length > 160) {
    return Response.json({ error: 'legal_name and display_name are required and must be within allowed length.' }, { status: 400 });
  }
  if (email && email.length > 254) {
    return Response.json({ error: 'email is too long.' }, { status: 400 });
  }
  if (phone && phone.length > 40) {
    return Response.json({ error: 'phone is too long.' }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    INSERT INTO parties (
      organization_id, party_type, legal_name, display_name, email, phone, created_by, updated_by
    )
    SELECT id, ${partyType}, ${legalName}, ${displayName}, ${email}, ${phone}, ${session.user.id}, ${session.user.id}
    FROM organizations
    WHERE slug = 'rundingan-kreasi-media'
    RETURNING id, party_type, legal_name, display_name, email, phone, status, created_at
  `;

  const party = rows[0];
  if (!party) {
    return Response.json({ error: 'Organization not found.' }, { status: 500 });
  }

  await sql`
    INSERT INTO audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, after_data)
    SELECT id, ${session.user.id}, 'create', 'party', ${party.id},
      jsonb_build_object('party_type', ${partyType}, 'display_name', ${displayName})
    FROM organizations
    WHERE slug = 'rundingan-kreasi-media'
  `;

  return Response.json({ data: party }, { status: 201 });
}
