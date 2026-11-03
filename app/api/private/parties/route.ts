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
