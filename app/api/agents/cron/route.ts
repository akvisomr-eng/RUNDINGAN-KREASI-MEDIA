import {NextResponse} from 'next/server';
import {getSql} from '@/lib/db';
export const dynamic='force-dynamic';
const ORG='rundingan-kreasi-media';
const requiredTables=['organizations','business_units','parties','audit_logs','cms_posts','finance_accounts','finance_journals','finance_journal_lines','hr_employees','hr_payroll_runs','inventory_items','inventory_movements','procurement_requests','module_catalog','organization_modules','business_transactions','agent_runs','agent_actions'];
const requiredMigrations=['20261103_001_custom_cms','20261103_002_cms_permissions','20261104_003_enterprise_operational_modules','20261104_004_unified_modules_agents_reports','20261104_005_enterprise_transaction_module'];
export async function GET(req:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized cron request.'},{status:401});
 const sql:any=getSql();
 const [tables,migrations]=await Promise.all([
  sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`,
  sql`SELECT version FROM schema_migrations`
 ]);
 const foundTables=new Set(tables.map((x:any)=>String(x.table_name))),foundMigrations=new Set(migrations.map((x:any)=>String(x.version)));
 const missingTables=requiredTables.filter(x=>!foundTables.has(x)),missingMigrations=requiredMigrations.filter(x=>!foundMigrations.has(x));
 if(!foundTables.has('agent_runs')||!foundTables.has('audit_logs'))return NextResponse.json({status:'degraded',missing_tables:missingTables,missing_migrations:missingMigrations,detail:'Schema is incomplete; diagnostic could not be persisted.'},{status:503});
 const findings:any[]=[];
 if(missingTables.length)findings.push({severity:'critical',title:'Database schema incomplete',detail:'Missing tables: '+missingTables.join(', '),count:missingTables.length});
 if(missingMigrations.length)findings.push({severity:'warning',title:'Migrations not applied',detail:'Missing migration versions: '+missingMigrations.join(', '),count:missingMigrations.length});
 if(!findings.length)findings.push({severity:'success',title:'Application schema healthy',detail:'Required tables and migrations are present.'});
 let websiteStatus='not_checked';
 const deploymentHost=process.env.VERCEL_URL;
 if(deploymentHost){try{const response=await fetch('https://'+deploymentHost+'/api/health',{cache:'no-store'});websiteStatus=response.ok?'ok':'degraded';if(!response.ok)findings.push({severity:'critical',title:'Website readiness check failed',detail:'The deployed /api/health endpoint returned HTTP '+response.status+'.'});}catch{websiteStatus='unreachable';findings.push({severity:'critical',title:'Website health endpoint unreachable',detail:'The deployed health endpoint could not be reached.'});}}
 const result={agent:'Application Care Agent',runtime:'embedded_rules',generated_at:new Date().toISOString(),website_status:websiteStatus,finding_count:findings.length,findings,recommendations:['This scheduled task is read-only. It does not modify application code, database schema, secrets, deployments or business transactions.','Create a reviewed pull request for code changes and obtain explicit approval for production changes.'],autonomous_scope:'scheduled_read_only_diagnostics'};
 const rows=await sql`INSERT INTO agent_runs(organization_id,agent_code,runtime,status,input,result,created_by,finished_at)
  SELECT id,'system-maintenance','embedded_rules','completed','{"trigger":"vercel_cron"}'::jsonb,${JSON.stringify(result)}::jsonb,'system:vercel-cron',NOW()
  FROM organizations WHERE slug=${ORG} RETURNING id`;
 const runId=String((rows[0] as {id:string}).id);
 await sql`INSERT INTO audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,after_data)
  SELECT id,'system:vercel-cron','scheduled_agent_run','agent_run',${runId},${JSON.stringify({finding_count:findings.length,agent_code:'system-maintenance'})}::jsonb
  FROM organizations WHERE slug=${ORG}`;
 return NextResponse.json({run_id:runId,...result},{status:missingTables.length||missingMigrations.length?503:200});
}
