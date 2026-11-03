import 'server-only';
import { getSql } from '@/lib/db';

export async function hasPermission(
  userId: string,
  permissionCode: string,
  businessUnitId?: string,
): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM user_role_assignments ura
      JOIN roles r ON r.id = ura.role_id AND r.organization_id = ura.organization_id AND r.status = 'active'
      JOIN role_permissions rp ON rp.role_id = r.id
      JOIN permissions p ON p.id = rp.permission_id
      JOIN organizations o ON o.id = ura.organization_id
      WHERE o.slug = 'rundingan-kreasi-media'
        AND ura.user_id = ${userId}
        AND ura.revoked_at IS NULL
        AND p.code = ${permissionCode}
        AND (
          ura.business_unit_id IS NULL
          OR ura.business_unit_id = ${businessUnitId ?? null}::uuid
        )
    ) AS allowed
  `;
  const resultRows = rows as unknown as Array<{ allowed: boolean }>;
  return resultRows[0]?.allowed === true;
}
