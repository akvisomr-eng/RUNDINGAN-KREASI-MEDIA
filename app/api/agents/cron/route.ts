import {NextResponse} from 'next/server';
import {getSql} from '@/lib/db';
export const dynamic='force-dynamic';
const ORG='rundingan-kreasi-media';
const requiredTables=['organizations','business_units','parties','audit_logs','cms_posts','cms_seo_audits','finance_accounts','finance_journals','finance_journal_lines','hr_employees','hr_payroll_runs','hr_payroll_lines','inventory_items','inventory_movements','procurement_requests','module_catalog','organization_modules','business_transactions','agent_runs','agent_actions'];
const requiredMigrations=['20261103_001_custom_cms','20261103_002_cms_permissions','20261104_003_enterprise_operational_modules','20261104_004_unified_modules_agents_reports','20261104_005_enterprise_transaction_module','20261104_006_limited_role_health_read_permissions'];

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

 async function save(code:string,name:string,findings:any[],recommendations:string[],extra:Record<string,unknown>={}){
  const runtime='embedded_rules';
  const result={agent:name,runtime,generated_at:new Date().toISOString(),finding_count:findings.length,findings,recommendations,...extra,autonomous_scope:'scheduled_read_only_diagnostics'};
  const rows=await sql`INSERT INTO agent_runs(organization_id,agent_code,runtime,status,input,result,created_by,finished_at)
   SELECT id,${code},${runtime},'completed','{"trigger":"vercel_cron"}'::jsonb,${JSON.stringify(result)}::jsonb,'system:vercel-cron',NOW()
   FROM organizations WHERE slug=${ORG} RETURNING id`;
  const runId=String((rows[0] as {id:string}).id);
  await sql`INSERT INTO audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,after_data)
   SELECT id,'system:vercel-cron','scheduled_agent_run','agent_run',${runId},${JSON.stringify({agent_code:code,finding_count:findings.length,runtime})}::jsonb FROM organizations WHERE slug=${ORG}`;
  return {run_id:runId,...result};
 }

 const runs:any[]=[];
 if(missingTables.length||missingMigrations.length){
  const findings:any[]=[];
  if(missingTables.length)findings.push({severity:'critical',title:'Database schema incomplete',detail:'Missing tables: '+missingTables.join(', '),count:missingTables.length});
  if(missingMigrations.length)findings.push({severity:'warning',title:'Migrations not applied',detail:'Missing migration versions: '+missingMigrations.join(', '),count:missingMigrations.length});
  runs.push(await save('system-maintenance','Application Care Agent',findings,['Schema repair requires a reviewed migration and an approved deployment window.']));
  return NextResponse.json({status:'degraded',runs,missing_tables:missingTables,missing_migrations:missingMigrations},{status:503});
 }

 // Website and database readiness.
 const systemFindings:any[]=[];
 let websiteStatus='not_checked';
 const deploymentHost=process.env.VERCEL_URL;
 if(deploymentHost){try{const response=await fetch('https://'+deploymentHost+'/api/health',{cache:'no-store'});websiteStatus=response.ok?'ok':'degraded';if(!response.ok)systemFindings.push({severity:'critical',title:'Website readiness check failed',detail:'The deployed /api/health endpoint returned HTTP '+response.status+'.'});}catch{websiteStatus='unreachable';systemFindings.push({severity:'critical',title:'Website health endpoint unreachable',detail:'The deployed health endpoint could not be reached.'});}}
 if(!systemFindings.length)systemFindings.push({severity:'success',title:'Website and database readiness check passed',detail:'The application health endpoint responded successfully and required schema migrations are present.'});
 runs.push(await save('system-maintenance','Application Care Agent',systemFindings,['Agen hanya membaca dan menganalisis. Perbaikan kode, schema, secrets dan deployment harus melalui persetujuan Owner.'],{website_status:websiteStatus,missing_tables:[],missing_migrations:[]}));

 // Finance integrity.
 const [unbalanced,drafts,unlinked]=await Promise.all([
  sql`SELECT count(*)::int AS n FROM finance_journals j JOIN organizations o ON o.id=j.organization_id WHERE o.slug=${ORG} AND j.status='posted' AND (SELECT coalesce(sum(l.debit),0) FROM finance_journal_lines l WHERE l.journal_id=j.id)<>(SELECT coalesce(sum(l.credit),0) FROM finance_journal_lines l WHERE l.journal_id=j.id)`,
  sql`SELECT count(*)::int AS n FROM finance_journals j JOIN organizations o ON o.id=j.organization_id WHERE o.slug=${ORG} AND j.status='draft' AND j.created_at<NOW()-INTERVAL '7 days'`,
  sql`SELECT count(*)::int AS n FROM finance_journals j JOIN organizations o ON o.id=j.organization_id WHERE o.slug=${ORG} AND j.status='posted' AND j.business_transaction_id IS NULL`
 ]);
 const financeFindings:any[]=[];
 const fu=Number(unbalanced[0].n),fd=Number(drafts[0].n),fl=Number(unlinked[0].n);
 if(fu)financeFindings.push({severity:'critical',title:'Jurnal posted tidak seimbang',detail:'Total debit dan kredit berbeda.',count:fu});
 if(fd)financeFindings.push({severity:'warning',title:'Jurnal draft tertunda',detail:'Jurnal draft lebih dari tujuh hari.',count:fd});
 if(fl)financeFindings.push({severity:'info',title:'Jurnal belum tertaut transaksi',detail:'Jurnal posted belum terhubung ke shared transaction spine.',count:fl});
 if(!financeFindings.length)financeFindings.push({severity:'success',title:'Pemeriksaan integritas finance lulus',detail:'Tidak ditemukan jurnal posted tidak seimbang atau draft lama.'});
 runs.push(await save('finance-integrity','Finance Integrity Agent',financeFindings,['Posting jurnal dan pembayaran tetap memerlukan pemeriksaan serta persetujuan manusia.']));

 // HR and payroll.
 const [missingPeople,unpaid,zeroSalary]=await Promise.all([
  sql`SELECT count(*)::int AS n FROM hr_employees e JOIN organizations o ON o.id=e.organization_id WHERE o.slug=${ORG} AND e.status='active' AND (e.email IS NULL OR e.department_id IS NULL)`,
  sql`SELECT count(*)::int AS n FROM hr_payroll_runs r JOIN organizations o ON o.id=r.organization_id WHERE o.slug=${ORG} AND r.status='approved' AND r.created_at<NOW()-INTERVAL '5 days'`,
  sql`SELECT count(*)::int AS n FROM hr_employees e JOIN organizations o ON o.id=e.organization_id WHERE o.slug=${ORG} AND e.status='active' AND e.base_salary=0`
 ]);
 const hrFindings:any[]=[];const hp=Number(missingPeople[0].n),hu=Number(unpaid[0].n),hz=Number(zeroSalary[0].n);
 if(hp)hrFindings.push({severity:'warning',title:'Data pegawai belum lengkap',detail:'Pegawai aktif belum memiliki email atau departemen.',count:hp});
 if(hu)hrFindings.push({severity:'warning',title:'Payroll menunggu pembayaran',detail:'Payroll approved lebih dari lima hari.',count:hu});
 if(hz)hrFindings.push({severity:'info',title:'Gaji pokok nol',detail:'Periksa master gaji pegawai aktif.',count:hz});
 if(!hrFindings.length)hrFindings.push({severity:'success',title:'Pemeriksaan HR lulus',detail:'Tidak ditemukan anomali pada aturan kelengkapan dan status payroll.'});
 runs.push(await save('people-operations','People Operations Agent',hrFindings,['Pajak, BPJS, THR dan transfer payroll wajib diverifikasi HR/Finance.']));

 // Inventory and procurement.
 const [lowStock,negativeStock,latePurchase]=await Promise.all([
  sql`SELECT count(*)::int AS n FROM (SELECT i.id,i.minimum_stock,coalesce(sum(CASE WHEN m.movement_type IN('opening','in') THEN m.quantity WHEN m.movement_type='out' THEN -m.quantity ELSE 0 END),0) AS qty FROM inventory_items i JOIN organizations o ON o.id=i.organization_id LEFT JOIN inventory_movements m ON m.item_id=i.id WHERE o.slug=${ORG} AND i.is_active GROUP BY i.id HAVING coalesce(sum(CASE WHEN m.movement_type IN('opening','in') THEN m.quantity WHEN m.movement_type='out' THEN -m.quantity ELSE 0 END),0)<i.minimum_stock) x`,
  sql`SELECT count(*)::int AS n FROM (SELECT i.id,sum(CASE WHEN m.movement_type IN('opening','in') THEN m.quantity WHEN m.movement_type='out' THEN -m.quantity ELSE 0 END) AS qty FROM inventory_items i JOIN organizations o ON o.id=i.organization_id LEFT JOIN inventory_movements m ON m.item_id=i.id WHERE o.slug=${ORG} GROUP BY i.id HAVING sum(CASE WHEN m.movement_type IN('opening','in') THEN m.quantity WHEN m.movement_type='out' THEN -m.quantity ELSE 0 END)<0) x`,
  sql`SELECT count(*)::int AS n FROM procurement_requests p JOIN organizations o ON o.id=p.organization_id WHERE o.slug=${ORG} AND p.status IN('submitted','approved') AND p.created_at<NOW()-INTERVAL '14 days'`
 ]);
 const invFindings:any[]=[];const il=Number(lowStock[0].n),ineg=Number(negativeStock[0].n),ip=Number(latePurchase[0].n);
 if(ineg)invFindings.push({severity:'critical',title:'Stok negatif terdeteksi',detail:'Periksa konsistensi mutasi dan saldo fisik.',count:ineg});
 if(il)invFindings.push({severity:'warning',title:'Stok di bawah minimum',detail:'Barang perlu ditinjau untuk pengadaan.',count:il});
 if(ip)invFindings.push({severity:'warning',title:'Pengadaan tertunda',detail:'Permintaan submitted/approved lebih dari 14 hari.',count:ip});
 if(!invFindings.length)invFindings.push({severity:'success',title:'Pemeriksaan inventaris lulus',detail:'Tidak ditemukan stok di bawah minimum atau pengadaan tertunda.'});
 runs.push(await save('inventory-control','Inventory Control Agent',invFindings,['Agen tidak melakukan pembelian atau mutasi stok otomatis.']));

 // CRM master-data quality.
 const crm=await sql`SELECT count(*) FILTER(WHERE email IS NULL AND phone IS NULL)::int AS no_contact,count(*) FILTER(WHERE display_name IS NULL OR btrim(display_name)='')::int AS no_name,count(*)::int AS total FROM parties p JOIN organizations o ON o.id=p.organization_id WHERE o.slug=${ORG} AND p.deleted_at IS NULL`;
 const crmFindings:any[]=[];const cr=crm[0];
 if(Number(cr.no_contact))crmFindings.push({severity:'warning',title:'Relasi tanpa kontak',detail:'Pelanggan/pemasok tidak memiliki email maupun telepon.',count:Number(cr.no_contact)});
 if(Number(cr.no_name))crmFindings.push({severity:'critical',title:'Nama relasi kosong',detail:'Master relasi bisnis memiliki nama tampilan kosong.',count:Number(cr.no_name)});
 if(!crmFindings.length)crmFindings.push({severity:'success',title:'Kualitas CRM baik',detail:'Memeriksa '+Number(cr.total)+' relasi bisnis tanpa anomali aturan dasar.'});
 runs.push(await save('crm-health','CRM Relationship Agent',crmFindings,['Deduplikasi berdasarkan NPWP/email perlu verifikasi pemilik data.']));

 // CMS editorial and SEO hygiene.
 const [oldDrafts,missingSeo]=await Promise.all([
  sql`SELECT count(*)::int AS n FROM cms_posts p WHERE p.status='draft' AND p.updated_at<NOW()-INTERVAL '14 days'`,
  sql`SELECT count(*)::int AS n FROM cms_posts p WHERE p.status='published' AND (coalesce(p.seo_title,'')='' OR coalesce(p.seo_description,'')='')`
 ]);
 const cmsFindings:any[]=[];const cd=Number(oldDrafts[0].n),cs=Number(missingSeo[0].n);
 if(cd)cmsFindings.push({severity:'warning',title:'Draft editorial tertunda',detail:'Draft tidak diperbarui lebih dari 14 hari.',count:cd});
 if(cs)cmsFindings.push({severity:'warning',title:'Metadata SEO belum lengkap',detail:'Artikel terbit belum memiliki SEO title atau description.',count:cs});
 if(!cmsFindings.length)cmsFindings.push({severity:'success',title:'Pemeriksaan editorial lulus',detail:'Tidak ditemukan draft lama atau metadata SEO kosong.'});
 runs.push(await save('cms-editorial','CMS Editorial Agent',cmsFindings,['Publikasi artikel tetap memerlukan persetujuan editor.']));

 // Business-module specialist agents use the same shared transaction spine.
 const moduleAgents=[['academy-operations','Academy Operations Agent','ACADEMY'],['creative-operations','Creative Operations Agent','CREATIVE'],['event-operations','Event Operations Agent','EVENT'],['media-operations','Media Operations Agent','MEDIA'],['production-operations','Production Operations Agent','PRODUCTION'],['rental-operations','Rental Operations Agent','RENTAL']];
 for(const [code,name,moduleCode] of moduleAgents){
  const enabled=await sql`SELECT 1 FROM organization_modules WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND module_code=${moduleCode} AND status='active'`;
  if(!enabled.length)continue;
  const [statusRows,stale,unlinked]=await Promise.all([
   sql`SELECT status,count(*)::int AS total,coalesce(sum(amount),0)::numeric AS amount FROM business_transactions t JOIN organizations o ON o.id=t.organization_id WHERE o.slug=${ORG} AND t.module_code=${moduleCode} GROUP BY status ORDER BY status`,
   sql`SELECT count(*)::int AS n FROM business_transactions t JOIN organizations o ON o.id=t.organization_id WHERE o.slug=${ORG} AND t.module_code=${moduleCode} AND t.status IN('draft','pending') AND t.created_at<NOW()-INTERVAL '14 days'`,
   sql`SELECT count(*)::int AS n FROM business_transactions t JOIN organizations o ON o.id=t.organization_id WHERE o.slug=${ORG} AND t.module_code=${moduleCode} AND (t.source_table IS NULL OR t.source_id IS NULL)`
  ]);
  const total=(statusRows as any[]).reduce((sum,row)=>sum+Number(row.total),0),staleCount=Number(stale[0].n),unlinkedCount=Number(unlinked[0].n);
  const findings:any[]=[];
  if(!total)findings.push({severity:'info',title:'Belum ada transaksi modul',detail:`Belum ada transaksi ${moduleCode} pada shared transaction spine.`});
  if(staleCount)findings.push({severity:'warning',title:'Transaksi modul tertunda',detail:'Transaksi draft/pending lebih dari 14 hari.',count:staleCount});
  if(unlinkedCount)findings.push({severity:'info',title:'Transaksi belum tertaut sumber',detail:'Transaksi belum memiliki record operasional asal.',count:unlinkedCount});
  if(total)findings.push({severity:'success',title:'Ringkasan transaksi modul',detail:`Memeriksa ${total} transaksi ${moduleCode}.`,count:total});
  runs.push(await save(code,name,findings,['Workflow modul harus menulis ke shared transaction spine; tindakan bisnis memerlukan persetujuan.'],{transaction_statuses:statusRows}));
 }

 // Cross-agent orchestration and risk summary.
 const allFindings:any[]=[];
 for(const run of runs){for(const item of (run.findings||[]))allFindings.push({agent_code:run.agent?.toLowerCase().replace(/ /g,'-'),...item});}
 const counts={critical:allFindings.filter((x:any)=>x.severity==='critical').length,warning:allFindings.filter((x:any)=>x.severity==='warning').length,info:allFindings.filter((x:any)=>x.severity==='info').length};
 const orchestrationFindings=allFindings.length?allFindings:[{severity:'success',title:'Semua agen spesialis selesai',detail:'Tidak ada temuan yang memerlukan tindakan dari pemeriksaan terjadwal.'}];
 runs.push(await save('enterprise-orchestrator','Enterprise Orchestrator',orchestrationFindings,['Prioritaskan temuan critical, kemudian warning. Tindakan bisnis dan perubahan produksi tetap memerlukan persetujuan Owner.'],{agents_executed:runs.length,risk_summary:counts}));
 const total=runs.reduce((sum:any,run:any)=>sum+Number(run.finding_count||0),0);
 return NextResponse.json({status:counts.critical||counts.warning?'attention_required':'ok',scheduled:true,agent_runs:runs.length,total_findings:total,risk_summary:counts,runs},{status:200});
}
