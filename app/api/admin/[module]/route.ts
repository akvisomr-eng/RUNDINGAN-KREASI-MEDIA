import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { hasPermission } from '@/lib/auth/permissions';
import { getSql } from '@/lib/db';
export const dynamic = 'force-dynamic';
const ORG = 'rundingan-kreasi-media';
async function userNow(){ const {data}=await auth.getSession(); return data?.user??null; }
const err=(message:string,status=400)=>NextResponse.json({error:message},{status});
const s=(b:Record<string,unknown>,k:string,n=200)=>typeof b[k]==='string'?(b[k] as string).trim().slice(0,n):'';
const audit=async(sql:ReturnType<typeof getSql>,actor:string,action:string,type:string,id:string,data:Record<string,unknown>)=>sql`
 INSERT INTO audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,after_data)
 SELECT id,${actor},${action},${type},${id},${JSON.stringify(data)}::jsonb FROM organizations WHERE slug=${ORG}
`;

export async function GET(_req:Request,ctx:{params:Promise<{module:string}>}){
 const u=await userNow(); if(!u)return err('Unauthorized',401);
 const {module}=await ctx.params; const db:any=getSql();
 try{
  if(module==='access'){
   if(!(await hasPermission(u.id,'core.users.read'))||!(await hasPermission(u.id,'core.roles.read')))return err('Forbidden',403);
   const [users,roles,assignments]=await Promise.all([
    db`SELECT id::text AS id,name,email,"emailVerified" AS email_verified,banned FROM neon_auth."user" ORDER BY name LIMIT 200`,
    db`SELECT r.id,r.code,r.name,r.description,r.is_system,r.status,count(rp.permission_id)::int AS permission_count FROM roles r JOIN organizations o ON o.id=r.organization_id LEFT JOIN role_permissions rp ON rp.role_id=r.id WHERE o.slug=${ORG} GROUP BY r.id ORDER BY r.code`,
    db`SELECT a.id,a.user_id,u.name AS user_name,u.email,r.code AS role_code,r.name AS role_name,a.business_unit_id,b.name AS business_unit_name,a.granted_at,a.revoked_at FROM user_role_assignments a JOIN organizations o ON o.id=a.organization_id JOIN roles r ON r.id=a.role_id LEFT JOIN neon_auth."user" u ON u.id::text=a.user_id LEFT JOIN business_units b ON b.id=a.business_unit_id WHERE o.slug=${ORG} ORDER BY a.granted_at DESC LIMIT 300`
   ]); return NextResponse.json({users,roles,assignments});
  }
  if(module==='structure'){
   if(!(await hasPermission(u.id,'core.business_units.read')))return err('Forbidden',403);
   const [businessUnits,departments,locations]=await Promise.all([
    db`SELECT id,code,name,slug,description,status FROM business_units WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND deleted_at IS NULL ORDER BY name`,
    db`SELECT d.id,d.code,d.name,d.status,d.business_unit_id,b.name AS business_unit_name FROM departments d JOIN organizations o ON o.id=d.organization_id LEFT JOIN business_units b ON b.id=d.business_unit_id WHERE o.slug=${ORG} AND d.deleted_at IS NULL ORDER BY d.name`,
    db`SELECT l.id,l.code,l.name,l.location_type,l.address_line,l.city,l.province,l.timezone,l.status,l.business_unit_id,b.name AS business_unit_name FROM locations l JOIN organizations o ON o.id=l.organization_id LEFT JOIN business_units b ON b.id=l.business_unit_id WHERE o.slug=${ORG} AND l.deleted_at IS NULL ORDER BY l.name`
   ]); return NextResponse.json({businessUnits,departments,locations});
  }
  if(module==='governance'){
   if(!(await hasPermission(u.id,'core.audit.read')))return err('Forbidden',403);
   const events=await db`SELECT a.id,a.actor_user_id,u.name AS actor_name,u.email AS actor_email,a.action,a.resource_type,a.resource_id,a.before_data,a.after_data,a.created_at FROM audit_logs a JOIN organizations o ON o.id=a.organization_id LEFT JOIN neon_auth."user" u ON u.id::text=a.actor_user_id WHERE o.slug=${ORG} ORDER BY a.created_at DESC LIMIT 250`;
   return NextResponse.json({events});
  }
  if(module==='finance'){
   if(!(await hasPermission(u.id,'finance.accounts.read'))||!(await hasPermission(u.id,'finance.journals.read')))return err('Forbidden',403);
   const [accounts,journals]=await Promise.all([
    db`SELECT id,code,name,account_type,normal_balance,is_active FROM finance_accounts WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY code`,
    db`SELECT j.id,j.journal_number,j.journal_date,j.description,j.status,j.created_at,j.business_transaction_id,coalesce(sum(l.debit),0)::numeric(18,2) AS total_debit,coalesce(sum(l.credit),0)::numeric(18,2) AS total_credit,count(l.id)::int AS line_count FROM finance_journals j LEFT JOIN finance_journal_lines l ON l.journal_id=j.id JOIN organizations o ON o.id=j.organization_id WHERE o.slug=${ORG} GROUP BY j.id ORDER BY j.journal_date DESC LIMIT 200`
   ]);return NextResponse.json({accounts,journals});
  }
  if(module==='people'){
   if(!(await hasPermission(u.id,'hr.employees.read')))return err('Forbidden',403);
   const canPayroll=await hasPermission(u.id,'hr.payroll.read');
   const [employees,departments]=await Promise.all([
    db`SELECT e.id,e.employee_code,e.full_name,e.email,e.phone,e.employment_type,e.start_date,e.status,CASE WHEN ${canPayroll} THEN e.base_salary ELSE NULL END AS base_salary,e.department_id,d.name AS department_name FROM hr_employees e JOIN organizations o ON o.id=e.organization_id LEFT JOIN departments d ON d.id=e.department_id WHERE o.slug=${ORG} ORDER BY e.full_name LIMIT 500`,
    db`SELECT d.id,d.name FROM departments d JOIN organizations o ON o.id=d.organization_id WHERE o.slug=${ORG} AND d.deleted_at IS NULL ORDER BY d.name`
   ]);
   const payrollRuns=canPayroll?await db`SELECT r.id,r.period_start,r.period_end,r.status,r.notes,r.created_at,r.business_transaction_id,count(l.id)::int AS employee_count,coalesce(sum(l.gross_pay),0)::numeric(18,2) AS gross_total,coalesce(sum(l.deductions),0)::numeric(18,2) AS deductions_total,coalesce(sum(l.net_pay),0)::numeric(18,2) AS net_total FROM hr_payroll_runs r LEFT JOIN hr_payroll_lines l ON l.payroll_run_id=r.id JOIN organizations o ON o.id=r.organization_id WHERE o.slug=${ORG} GROUP BY r.id ORDER BY r.period_start DESC LIMIT 100`:[];
   return NextResponse.json({employees,departments,payrollRuns,canReadPayroll:canPayroll});
  }
  if(module==='inventory'){
   if(!(await hasPermission(u.id,'inventory.items.read')))return err('Forbidden',403);
   const canProcurement=await hasPermission(u.id,'procurement.requests.read');
   const [items,locations,parties]=await Promise.all([
    db`SELECT i.id,i.sku,i.name,i.unit,i.item_type,i.minimum_stock,i.is_active,coalesce(sum(CASE WHEN m.movement_type IN ('opening','in') THEN m.quantity WHEN m.movement_type='out' THEN -m.quantity ELSE 0 END),0)::numeric(18,3) AS stock FROM inventory_items i JOIN organizations o ON o.id=i.organization_id LEFT JOIN inventory_movements m ON m.item_id=i.id WHERE o.slug=${ORG} GROUP BY i.id ORDER BY i.name`,
    db`SELECT l.id,l.name FROM locations l JOIN organizations o ON o.id=l.organization_id WHERE o.slug=${ORG} AND l.deleted_at IS NULL ORDER BY l.name`,
    db`SELECT id,display_name FROM parties WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND deleted_at IS NULL ORDER BY display_name LIMIT 200`
   ]);const requests=canProcurement?await db`SELECT p.id,p.request_number,p.description,p.estimated_total,p.status,p.needed_by,p.created_at,p.business_transaction_id,pa.display_name AS supplier_name FROM procurement_requests p JOIN organizations o ON o.id=p.organization_id LEFT JOIN parties pa ON pa.id=p.supplier_party_id WHERE o.slug=${ORG} ORDER BY p.created_at DESC LIMIT 200`:[];return NextResponse.json({items,requests,locations,parties,canProcurement});
  }
  return err('Unknown administration module.',404);
 }catch{return err('Gagal memuat data. Periksa migrasi dan hak akses database Development.',503);}
}

export async function POST(req:Request,ctx:{params:Promise<{module:string}>}){
 const origin=req.headers.get('origin'),host=req.headers.get('host');
 if(origin){try{if(!host||new URL(origin).host!==host)return err('Invalid request origin.',403);}catch{return err('Invalid request origin.',403);}}
 const u=await userNow();if(!u)return err('Unauthorized',401);
 let b:Record<string,unknown>;try{b=await req.json();}catch{return err('Invalid JSON body.');}
 const {module}=await ctx.params,db:any=getSql(),n=(k:string)=>Number(b[k]??0);
 try{
  if(module==='access'){
   if(!(await hasPermission(u.id,'core.users.manage')))return err('Forbidden',403);
   if(s(b,'action')==='assign'){
    const target=s(b,'user_id',100),role=s(b,'role_id',80),unit=s(b,'business_unit_id',80)||null;
    if(!target||!role)return err('Pilih akun dan role.');
    const rows=await db`WITH t AS(SELECT u.id::text AS user_id,r.id AS role_id,o.id AS organization_id,r.code FROM neon_auth."user" u CROSS JOIN organizations o JOIN roles r ON r.organization_id=o.id WHERE u.id::text=${target} AND coalesce(u.banned,false)=false AND r.id=${role}::uuid AND r.status='active' AND o.slug=${ORG} AND (${unit}::uuid IS NULL OR EXISTS(SELECT 1 FROM business_units bu WHERE bu.id=${unit}::uuid AND bu.organization_id=o.id AND bu.deleted_at IS NULL)) AND (r.code<>'owner' OR EXISTS(SELECT 1 FROM user_role_assignments a JOIN roles ar ON ar.id=a.role_id WHERE a.user_id=${u.id} AND a.organization_id=o.id AND a.revoked_at IS NULL AND ar.code='owner'))),i AS(INSERT INTO user_role_assignments(organization_id,user_id,role_id,business_unit_id,granted_by) SELECT organization_id,user_id,role_id,${unit}::uuid,${u.id} FROM t WHERE NOT EXISTS(SELECT 1 FROM user_role_assignments x WHERE x.organization_id=t.organization_id AND x.user_id=t.user_id AND x.role_id=t.role_id AND x.business_unit_id IS NOT DISTINCT FROM ${unit}::uuid AND x.revoked_at IS NULL) RETURNING id,user_id,role_id,business_unit_id,granted_at) SELECT i.*,r.name AS role_name,u.name AS user_name,u.email FROM i JOIN roles r ON r.id=i.role_id JOIN neon_auth."user" u ON u.id::text=i.user_id`;
    if(!rows.length)return err('Akun/role/unit tidak valid, duplikat, atau hanya Owner boleh memberikan role Owner.',409);
    await audit(db,u.id,'grant_role','user_role_assignment',String((rows[0] as {id:string}).id),{user_id:target,role_id:role,business_unit_id:unit});
    return NextResponse.json({assignment:rows[0]},{status:201});
   }
   if(s(b,'action')==='revoke'){
    const id=s(b,'assignment_id',80);
    const rows=await db`WITH t AS(SELECT a.id,a.organization_id,a.user_id,r.code FROM user_role_assignments a JOIN roles r ON r.id=a.role_id JOIN organizations o ON o.id=a.organization_id WHERE a.id=${id}::uuid AND o.slug=${ORG} AND a.revoked_at IS NULL),x AS(UPDATE user_role_assignments a SET revoked_at=NOW() FROM t WHERE a.id=t.id AND (t.code<>'owner' OR EXISTS(SELECT 1 FROM user_role_assignments own JOIN roles ownr ON ownr.id=own.role_id WHERE own.user_id=${u.id} AND own.organization_id=t.organization_id AND own.revoked_at IS NULL AND ownr.code='owner')) AND NOT(t.code='owner' AND (SELECT count(*) FROM user_role_assignments z JOIN roles zr ON zr.id=z.role_id WHERE z.organization_id=t.organization_id AND z.revoked_at IS NULL AND zr.code='owner')<=1) RETURNING a.id,a.user_id) SELECT * FROM x`;
    if(!rows.length)return err('Penugasan tidak ada atau Owner terakhir tidak boleh dicabut.',409);
    await audit(db,u.id,'revoke_role','user_role_assignment',id,{user_id:(rows[0] as {user_id:string}).user_id});return NextResponse.json({revoked:true});
   }
  }
  if(module==='structure'){
   const type=s(b,'type'),code=s(b,'code',40).toUpperCase(),name=s(b,'name',160),unit=s(b,'business_unit_id',80)||null;
   if(!code||!name)return err('Kode dan nama wajib diisi.');
   if(type==='business_unit'){
    if(!(await hasPermission(u.id,'core.business_units.manage')))return err('Forbidden',403);
    const slug=s(b,'slug',160)||name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const rows=await db`INSERT INTO business_units(organization_id,code,name,slug,description) SELECT id,${code},${name},${slug},${s(b,'description',1000)||null} FROM organizations WHERE slug=${ORG} RETURNING id,code,name,slug,status`;
    await audit(db,u.id,'create','business_unit',String((rows[0] as {id:string}).id),{code,name});return NextResponse.json({record:rows[0]},{status:201});
   }
   if(type==='department'){
    if(!(await hasPermission(u.id,'core.departments.manage')))return err('Forbidden',403);
    const rows=await db`INSERT INTO departments(organization_id,business_unit_id,code,name) SELECT o.id,${unit}::uuid,${code},${name} FROM organizations o WHERE o.slug=${ORG} AND (${unit}::uuid IS NULL OR EXISTS(SELECT 1 FROM business_units bu WHERE bu.id=${unit}::uuid AND bu.organization_id=o.id)) RETURNING id,code,name,business_unit_id,status`;
    if(!rows.length)return err('Unit bisnis tidak valid.',409);await audit(db,u.id,'create','department',String((rows[0] as {id:string}).id),{code,name});return NextResponse.json({record:rows[0]},{status:201});
   }
   if(type==='location'){
    if(!(await hasPermission(u.id,'core.locations.manage')))return err('Forbidden',403);
    const rows=await db`INSERT INTO locations(organization_id,business_unit_id,code,name,location_type,address_line,city,province) SELECT o.id,${unit}::uuid,${code},${name},${s(b,'location_type',30)||'office'},${s(b,'address_line',300)||null},${s(b,'city',100)||null},${s(b,'province',100)||null} FROM organizations o WHERE o.slug=${ORG} AND (${unit}::uuid IS NULL OR EXISTS(SELECT 1 FROM business_units bu WHERE bu.id=${unit}::uuid AND bu.organization_id=o.id)) RETURNING id,code,name,location_type,city,province,status`;
    if(!rows.length)return err('Unit bisnis tidak valid.',409);await audit(db,u.id,'create','location',String((rows[0] as {id:string}).id),{code,name});return NextResponse.json({record:rows[0]},{status:201});
   }
   return err('Jenis struktur tidak dikenal.');
  }
  if(module==='finance'){
   if(s(b,'action')==='account'){
    if(!(await hasPermission(u.id,'finance.accounts.manage')))return err('Forbidden',403);
    const code=s(b,'code',30),name=s(b,'name',160),type=s(b,'account_type',20),normal=s(b,'normal_balance',10);
    if(!code||!name||!['asset','liability','equity','revenue','expense'].includes(type)||!['debit','credit'].includes(normal))return err('Data akun tidak valid.');
    const rows=await db`INSERT INTO finance_accounts(organization_id,code,name,account_type,normal_balance) SELECT id,${code},${name},${type},${normal} FROM organizations WHERE slug=${ORG} RETURNING id,code,name,account_type,normal_balance,is_active`;
    await audit(db,u.id,'create','finance_account',String((rows[0] as {id:string}).id),{code,name,type});return NextResponse.json({account:rows[0]},{status:201});
   }
   if(s(b,'action')==='post_journal'){
    if(!(await hasPermission(u.id,'finance.journals.create')))return err('Forbidden',403);
    const id=s(b,'journal_id',80);
    const rows=await db`WITH j AS (UPDATE finance_journals j SET status='posted',posted_by=${u.id},posted_at=NOW()
      FROM organizations o WHERE j.organization_id=o.id AND o.slug=${ORG} AND j.id=${id}::uuid AND j.status='draft'
      AND (SELECT count(*) FROM finance_journal_lines l WHERE l.journal_id=j.id)>=2
      AND (SELECT coalesce(sum(l.debit),0)=coalesce(sum(l.credit),0) AND sum(l.debit)>0 FROM finance_journal_lines l WHERE l.journal_id=j.id)
      RETURNING j.id,j.journal_number,j.status,j.posted_at,j.business_transaction_id),
      t AS (UPDATE business_transactions SET status='posted',updated_at=NOW() WHERE id=(SELECT business_transaction_id FROM j) RETURNING id)
      SELECT j.id,j.journal_number,j.status,j.posted_at FROM j`;
    if(!rows.length)return err('Jurnal tidak dapat diposting: pastikan masih draft dan debit-kredit seimbang.',409);
    await audit(db,u.id,'post','finance_journal',id,{status:'posted'});return NextResponse.json({journal:rows[0]});
   }
   if(s(b,'action')==='journal'){
    if(!(await hasPermission(u.id,'finance.journals.create')))return err('Forbidden',403);
    const date=s(b,'journal_date',10),desc=s(b,'description',500),lines=Array.isArray(b.lines)?b.lines as Array<Record<string,unknown>>:[];
    const ls=lines.map(x=>({account_id:String(x.account_id||''),debit:Number(x.debit||0),credit:Number(x.credit||0),description:String(x.description||'').slice(0,200)}));
    if(!date||!desc||ls.length<2||ls.length>30||ls.some(x=>!x.account_id||!Number.isFinite(x.debit)||!Number.isFinite(x.credit)||x.debit<0||x.credit<0||Math.abs(x.debit*100-Math.round(x.debit*100))>0.000001||Math.abs(x.credit*100-Math.round(x.credit*100))>0.000001||((x.debit>0)===(x.credit>0))))return err('Baris jurnal tidak valid. Gunakan maksimal dua angka desimal.');
    const debitCents=ls.reduce((v,x)=>v+Math.round(x.debit*100),0),creditCents=ls.reduce((v,x)=>v+Math.round(x.credit*100),0);
    const debit=debitCents/100,credit=creditCents/100;
    if(debitCents<=0||debitCents!==creditCents)return err('Total debit dan kredit harus seimbang hingga satuan sen.');
    const no='JRN-'+date.replace(/-/g,'')+'-'+crypto.randomUUID().slice(0,8).toUpperCase();
    const rows=await db`WITH o AS(SELECT id FROM organizations WHERE slug=${ORG}),v AS(SELECT count(*)::int AS n FROM jsonb_to_recordset(${JSON.stringify(ls)}::jsonb) AS x(account_id text) JOIN finance_accounts a ON a.id=x.account_id::uuid AND a.organization_id=(SELECT id FROM o) AND a.is_active),h AS(INSERT INTO finance_journals(organization_id,journal_number,journal_date,description,created_by) SELECT id,${no},${date}::date,${desc},${u.id} FROM o CROSS JOIN v WHERE v.n=${ls.length} RETURNING id,organization_id,journal_number,journal_date,description,status),l AS(INSERT INTO finance_journal_lines(journal_id,account_id,description,debit,credit) SELECT h.id,x.account_id::uuid,x.description,x.debit,x.credit FROM h CROSS JOIN jsonb_to_recordset(${JSON.stringify(ls)}::jsonb) AS x(account_id text,description text,debit numeric,credit numeric) RETURNING id),t AS(INSERT INTO business_transactions(organization_id,module_code,transaction_type,reference_no,description,transaction_date,status,amount,source_table,source_id,created_by) SELECT h.organization_id,'ENTERPRISE','journal',h.journal_number,h.description,h.journal_date,'draft',${debit},'finance_journals',h.id::text,${u.id} FROM h RETURNING id),linked AS(UPDATE finance_journals j SET business_transaction_id=(SELECT id FROM t) WHERE j.id=(SELECT id FROM h) RETURNING j.id,j.organization_id,j.journal_number,j.journal_date,j.description,j.status,j.business_transaction_id) SELECT linked.*,(SELECT count(*)::int FROM l) AS line_count FROM linked`;
    if(!rows.length||Number((rows[0] as {line_count:number}).line_count)!==ls.length)return err('Akun jurnal tidak valid.',409);
    await audit(db,u.id,'create','finance_journal',String((rows[0] as {id:string}).id),{journal_number:no,debit,credit});return NextResponse.json({journal:rows[0]},{status:201});
   }
  }
  if(module==='people'){
   if(s(b,'action')==='employee'){
    if(!(await hasPermission(u.id,'hr.employees.manage')))return err('Forbidden',403);
    const code=s(b,'employee_code',40),name=s(b,'full_name',160),start=s(b,'start_date',10),type=s(b,'employment_type',20)||'permanent',salary=Number(b.base_salary??0),dept=s(b,'department_id',80)||null;
    if(!code||!name||!start||!Number.isFinite(salary)||salary<0||!['permanent','contract','intern','freelance'].includes(type))return err('Data pegawai tidak valid.');
    const rows=await db`INSERT INTO hr_employees(organization_id,employee_code,full_name,email,phone,department_id,employment_type,start_date,base_salary,created_by) SELECT o.id,${code},${name},${s(b,'email',254)||null},${s(b,'phone',40)||null},${dept}::uuid,${type},${start}::date,${salary},${u.id} FROM organizations o WHERE o.slug=${ORG} AND (${dept}::uuid IS NULL OR EXISTS(SELECT 1 FROM departments d WHERE d.id=${dept}::uuid AND d.organization_id=o.id AND d.deleted_at IS NULL)) RETURNING id,employee_code,full_name,email,employment_type,start_date,base_salary,status`;
    if(!rows.length)return err('Departemen tidak valid.',409);await audit(db,u.id,'create','hr_employee',String((rows[0] as {id:string}).id),{employee_code:code,full_name:name});return NextResponse.json({employee:rows[0]},{status:201});
   }
   if(s(b,'action')==='payroll_status'){
    if(!(await hasPermission(u.id,'hr.payroll.manage')))return err('Forbidden',403);
    const id=s(b,'payroll_id',80),next=s(b,'status',20);
    if(!['approved','paid','void'].includes(next))return err('Status payroll tidak valid.');
    const rows=await db`WITH r AS(UPDATE hr_payroll_runs r SET status=${next},approved_by=CASE WHEN ${next}='approved' THEN ${u.id} ELSE approved_by END,paid_at=CASE WHEN ${next}='paid' THEN NOW() ELSE paid_at END
      FROM organizations o WHERE r.organization_id=o.id AND o.slug=${ORG} AND r.id=${id}::uuid
      AND ((r.status='draft' AND ${next} IN('approved','void')) OR (r.status='approved' AND ${next} IN('paid','void')))
      RETURNING r.id,r.period_start,r.period_end,r.status,r.paid_at,r.business_transaction_id),
      t AS(UPDATE business_transactions SET status=CASE WHEN ${next}='paid' THEN 'paid' WHEN ${next}='approved' THEN 'approved' ELSE 'cancelled' END,updated_at=NOW() WHERE id=(SELECT business_transaction_id FROM r) RETURNING id)
      SELECT r.id,r.period_start,r.period_end,r.status,r.paid_at FROM r`;
    if(!rows.length)return err('Transisi status payroll tidak diizinkan.',409);
    await audit(db,u.id,'update_status','hr_payroll_run',id,{status:next});return NextResponse.json({payroll:rows[0]});
   }
   if(s(b,'action')==='payroll'){
    if(!(await hasPermission(u.id,'hr.payroll.manage')))return err('Forbidden',403);
    const start=s(b,'period_start',10),end=s(b,'period_end',10),lines=Array.isArray(b.lines)?b.lines as Array<Record<string,unknown>>:[];
    const ls=lines.map(x=>({employee_id:String(x.employee_id||''),gross_pay:Number(x.gross_pay||0),deductions:Number(x.deductions||0),notes:String(x.notes||'').slice(0,200)}));
    if(!start||!end||end<start||!ls.length||ls.length>500||ls.some(x=>!x.employee_id||!Number.isFinite(x.gross_pay)||!Number.isFinite(x.deductions)||x.gross_pay<0||x.deductions<0||x.deductions>x.gross_pay||Math.abs(x.gross_pay*100-Math.round(x.gross_pay*100))>0.000001||Math.abs(x.deductions*100-Math.round(x.deductions*100))>0.000001))return err('Periode atau rincian payroll tidak valid. Gunakan maksimal dua angka desimal.');
    const netTotalCents=ls.reduce((sum,x)=>sum+Math.round(x.gross_pay*100)-Math.round(x.deductions*100),0);
    const netTotal=netTotalCents/100;
    const rows=await db`WITH o AS(SELECT id FROM organizations WHERE slug=${ORG}),v AS(SELECT count(*)::int AS n FROM jsonb_to_recordset(${JSON.stringify(ls)}::jsonb) AS x(employee_id text) JOIN hr_employees e ON e.id=x.employee_id::uuid AND e.organization_id=(SELECT id FROM o) AND e.status='active'),r AS(INSERT INTO hr_payroll_runs(organization_id,period_start,period_end,notes,created_by) SELECT id,${start}::date,${end}::date,${s(b,'notes',500)||null},${u.id} FROM o CROSS JOIN v WHERE v.n=${ls.length} RETURNING id,organization_id,period_start,period_end,status),l AS(INSERT INTO hr_payroll_lines(payroll_run_id,employee_id,gross_pay,deductions,notes) SELECT r.id,x.employee_id::uuid,x.gross_pay,x.deductions,x.notes FROM r CROSS JOIN jsonb_to_recordset(${JSON.stringify(ls)}::jsonb) AS x(employee_id text,gross_pay numeric,deductions numeric,notes text) RETURNING id),t AS(INSERT INTO business_transactions(organization_id,module_code,transaction_type,reference_no,description,transaction_date,status,amount,source_table,source_id,created_by) SELECT r.organization_id,'ENTERPRISE','payroll','PAYROLL-'||to_char(r.period_start,'YYYYMMDD'),'Payroll '+to_char(r.period_start,'YYYY-MM-DD')+' to '+to_char(r.period_end,'YYYY-MM-DD'),r.period_end,'draft',${netTotal},'hr_payroll_runs',r.id::text,${u.id} FROM r RETURNING id),linked AS(UPDATE hr_payroll_runs SET business_transaction_id=(SELECT id FROM t) WHERE id=(SELECT id FROM r) RETURNING id,period_start,period_end,status,business_transaction_id) SELECT linked.*,(SELECT count(*)::int FROM l) AS line_count FROM linked`;
    if(!rows.length||Number((rows[0] as {line_count:number}).line_count)!==ls.length)return err('Payroll gagal dibuat. Pastikan pegawai aktif dan periode belum pernah dibuat.',409);
    await audit(db,u.id,'create','hr_payroll_run',String((rows[0] as {id:string}).id),{period_start:start,period_end:end,employee_count:ls.length});return NextResponse.json({payroll:rows[0]},{status:201});
   }
  }
  if(module==='inventory'){
   if(s(b,'action')==='item'){
    if(!(await hasPermission(u.id,'inventory.items.manage')))return err('Forbidden',403);
    const sku=s(b,'sku',60),name=s(b,'name',180),unit=s(b,'unit',20)||'pcs',type=s(b,'item_type',20)||'product',min=Number(b.minimum_stock??0);
    if(!sku||!name||!['product','material','asset','service'].includes(type)||!Number.isFinite(min)||min<0)return err('Data item tidak valid.');
    const rows=await db`INSERT INTO inventory_items(organization_id,sku,name,unit,item_type,minimum_stock) SELECT id,${sku},${name},${unit},${type},${min} FROM organizations WHERE slug=${ORG} RETURNING id,sku,name,unit,item_type,minimum_stock,is_active`;
    await audit(db,u.id,'create','inventory_item',String((rows[0] as {id:string}).id),{sku,name});return NextResponse.json({item:rows[0]},{status:201});
   }
   if(s(b,'action')==='movement'){
    if(!(await hasPermission(u.id,'inventory.stock.manage')))return err('Forbidden',403);
    const item=s(b,'item_id',80),type=s(b,'movement_type',20),qty=Number(b.quantity),cost=Number(b.unit_cost??0),loc=s(b,'location_id',80)||null;
    if(!item||!['opening','in','out'].includes(type)||!Number.isFinite(qty)||qty<=0||!Number.isFinite(cost)||cost<0)return err('Pergerakan stok tidak valid.');
    const rows=await db`WITH o AS(SELECT id FROM organizations WHERE slug=${ORG}),locked_item AS(SELECT x.id,x.organization_id FROM inventory_items x JOIN o ON o.id=x.organization_id WHERE x.id=${item}::uuid AND x.is_active FOR UPDATE),stock AS(SELECT coalesce(sum(CASE WHEN m.movement_type IN('opening','in') THEN m.quantity WHEN m.movement_type='out' THEN -m.quantity ELSE 0 END),0) AS qty FROM inventory_movements m WHERE m.item_id=(SELECT id FROM locked_item)),i AS(INSERT INTO inventory_movements(organization_id,item_id,location_id,movement_type,quantity,unit_cost,reference,notes,created_by) SELECT o.id,x.id,${loc}::uuid,${type},${qty},${cost},${s(b,'reference',100)||null},${s(b,'notes',300)||null},${u.id} FROM o JOIN locked_item x ON x.organization_id=o.id CROSS JOIN stock st WHERE (${type}<>'out' OR st.qty>=${qty}) AND (${loc}::uuid IS NULL OR EXISTS(SELECT 1 FROM locations l WHERE l.id=${loc}::uuid AND l.organization_id=o.id AND l.deleted_at IS NULL)) RETURNING id,organization_id,item_id,movement_type,quantity,unit_cost,created_at),t AS(INSERT INTO business_transactions(organization_id,module_code,transaction_type,reference_no,description,transaction_date,status,amount,source_table,source_id,created_by) SELECT i.organization_id,'ENTERPRISE','inventory_movement','INV-'||i.id::text,'Inventory '+i.movement_type,i.created_at::date,'posted',i.quantity*i.unit_cost,'inventory_movements',i.id::text,${u.id} FROM i RETURNING id),linked AS(UPDATE inventory_movements SET business_transaction_id=(SELECT id FROM t) WHERE id=(SELECT id FROM i) RETURNING id,item_id,movement_type,quantity,created_at,business_transaction_id) SELECT * FROM linked`;
    if(!rows.length)return err('Stok tidak cukup atau item/lokasi tidak valid.',409);await audit(db,u.id,'create','inventory_movement',String((rows[0] as {id:string}).id),{item_id:item,type,quantity:qty});return NextResponse.json({movement:rows[0]},{status:201});
   }
   if(s(b,'action')==='procurement_status'){
    if(!(await hasPermission(u.id,'procurement.requests.manage')))return err('Forbidden',403);
    const id=s(b,'request_id',80),next=s(b,'status',20);
    const rows=await db`WITH p AS(UPDATE procurement_requests p SET status=${next},updated_at=NOW()
      FROM organizations o WHERE p.organization_id=o.id AND o.slug=${ORG} AND p.id=${id}::uuid
      AND ((p.status='draft' AND ${next} IN('submitted','cancelled')) OR (p.status='submitted' AND ${next} IN('approved','rejected','cancelled')) OR (p.status='approved' AND ${next}='received'))
      RETURNING p.id,p.request_number,p.status,p.business_transaction_id),t AS(UPDATE business_transactions SET status=CASE WHEN ${next}='submitted' THEN 'pending' WHEN ${next}='approved' THEN 'approved' WHEN ${next}='received' THEN 'posted' ELSE 'cancelled' END,updated_at=NOW() WHERE id=(SELECT business_transaction_id FROM p) RETURNING id) SELECT p.id,p.request_number,p.status FROM p`;
    if(!rows.length)return err('Transisi status permintaan tidak diizinkan.',409);
    await audit(db,u.id,'update_status','procurement_request',id,{status:next});return NextResponse.json({request:rows[0]});
   }
   if(s(b,'action')==='procurement'){
    if(!(await hasPermission(u.id,'procurement.requests.manage')))return err('Forbidden',403);
    const desc=s(b,'description',1000),total=Number(b.estimated_total??0),supplier=s(b,'supplier_party_id',80)||null,needed=s(b,'needed_by',10)||null;
    if(!desc||!Number.isFinite(total)||total<0)return err('Deskripsi dan estimasi biaya tidak valid.');
    const no='PR-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+crypto.randomUUID().slice(0,6).toUpperCase();
    const rows=await db`WITH p AS(INSERT INTO procurement_requests(organization_id,request_number,requested_by,supplier_party_id,description,estimated_total,needed_by) SELECT o.id,${no},${u.id},${supplier}::uuid,${desc},${total},${needed}::date FROM organizations o WHERE o.slug=${ORG} AND (${supplier}::uuid IS NULL OR EXISTS(SELECT 1 FROM parties p WHERE p.id=${supplier}::uuid AND p.organization_id=o.id AND p.deleted_at IS NULL)) RETURNING id,organization_id,request_number,description,estimated_total,status,needed_by,supplier_party_id),t AS(INSERT INTO business_transactions(organization_id,module_code,transaction_type,reference_no,description,party_id,transaction_date,status,amount,source_table,source_id,created_by) SELECT p.organization_id,'ENTERPRISE','procurement',p.request_number,p.description,p.supplier_party_id,coalesce(p.needed_by,CURRENT_DATE),'draft',p.estimated_total,'procurement_requests',p.id::text,${u.id} FROM p RETURNING id),linked AS(UPDATE procurement_requests SET business_transaction_id=(SELECT id FROM t) WHERE id=(SELECT id FROM p) RETURNING id,request_number,description,estimated_total,status,needed_by,business_transaction_id) SELECT * FROM linked`;
    if(!rows.length)return err('Pemasok tidak valid.',409);await audit(db,u.id,'create','procurement_request',String((rows[0] as {id:string}).id),{request_number:no,estimated_total:total});return NextResponse.json({request:rows[0]},{status:201});
   }
  }
  return err('Aksi administrasi tidak dikenal.',404);
 }catch(error){
  const msg=error instanceof Error&&error.message.toLowerCase().includes('unique')?'Kode atau data tersebut sudah digunakan.':'Operasi gagal. Periksa data, migrasi dan hak akses database Development.';
  return err(msg,409);
 }
}