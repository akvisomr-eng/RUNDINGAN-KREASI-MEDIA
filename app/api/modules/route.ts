import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { hasPermission } from '@/lib/auth/permissions';
import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';
const ORG = 'rundingan-kreasi-media';
const error = (message:string,status=400) => NextResponse.json({error:message},{status});

export async function GET() {
  const {data} = await auth.getSession();
  if (!data?.user) return error('Unauthorized',401);
  if (!(await hasPermission(data.user.id,'modules.catalog.read'))) return error('Forbidden',403);
  const sql:any=getSql();
  const rows=await sql`
    SELECT c.code,c.name,c.description,c.is_optional,c.default_enabled,
      coalesce(m.status,CASE WHEN c.default_enabled THEN 'active' ELSE 'inactive' END) AS status,
      (m.module_code IS NOT NULL AND (m.status='active' OR NOT c.is_optional)) AS installed,m.installed_at,m.updated_at
    FROM module_catalog c
    JOIN organizations o ON o.slug=${ORG}
    LEFT JOIN organization_modules m ON m.organization_id=o.id AND m.module_code=c.code
    WHERE c.code <> 'ENTERPRISE'
    ORDER BY c.default_enabled DESC,c.code
  `;
  return NextResponse.json({modules:rows});
}

export async function POST(req:Request) {
  const origin=req.headers.get('origin'),host=req.headers.get('host');
  if(origin){try{if(!host||new URL(origin).host!==host)return error('Invalid request origin.',403);}catch{return error('Invalid request origin.',403);}}
  const {data}=await auth.getSession();
  if(!data?.user)return error('Unauthorized',401);
  if(!(await hasPermission(data.user.id,'modules.catalog.manage')))return error('Forbidden',403);
  let body:Record<string,unknown>;try{body=await req.json();}catch{return error('Invalid JSON body.');}
  const code=typeof body.code==='string'?body.code.toUpperCase():'';
  const action=body.action;
  const plugin=await getSql()\`SELECT code FROM module_catalog WHERE code=\${code} AND is_optional=true\`;\n  if(!plugin.length)return error('Modul ini bukan plugin opsional yang dapat dipasang/dinonaktifkan.',409);
  if(action!=='install'&&action!=='disable')return error('Aksi plugin tidak dikenal.');
  const sql:any=getSql();
  const rows=action==='install'
    ? await sql`INSERT INTO organization_modules(organization_id,module_code,status,installed_by,updated_at)
        SELECT id,\${code},'active',${data.user.id},NOW() FROM organizations WHERE slug=${ORG}
        ON CONFLICT(organization_id,module_code) DO UPDATE SET status='active',installed_by=EXCLUDED.installed_by,updated_at=NOW()
        RETURNING module_code,status`
    : await sql`UPDATE organization_modules m SET status='inactive',updated_at=NOW()
        FROM organizations o WHERE o.id=m.organization_id AND o.slug=${ORG} AND m.module_code='RENTAL'
        RETURNING m.module_code,m.status`;
  if(!rows.length)return error('Plugin tidak ditemukan atau organisasi belum terdaftar.',404);
  await sql`INSERT INTO audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,after_data)
    SELECT id,${data.user.id},${action==='install'?'install_plugin':'disable_plugin'},'organization_module','RENTAL',${JSON.stringify({status:rows[0].status})}::jsonb
    FROM organizations WHERE slug=${ORG}`;
  return NextResponse.json({module:rows[0]});
}
