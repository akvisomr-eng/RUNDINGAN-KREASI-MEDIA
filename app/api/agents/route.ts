import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { hasPermission } from '@/lib/auth/permissions';
import { getSql } from '@/lib/db';
import { AGENTS } from '@/lib/agents/registry';
import { askLocalModel } from '@/lib/agents/local-model';

export const dynamic='force-dynamic';
const ORG='rundingan-kreasi-media';
const fail=(message:string,status=400)=>NextResponse.json({error:message},{status});

export async function GET(){
 const {data}=await auth.getSession();if(!data?.user)return fail('Unauthorized',401);
 if(!(await hasPermission(data.user.id,'agents.read')))return fail('Forbidden',403);
 const sql:any=getSql();
 const [runs,actions]=await Promise.all([
  sql`SELECT id,agent_code,runtime,status,input,result,created_at,finished_at FROM agent_runs
      WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY created_at DESC LIMIT 30`,
  sql`SELECT id,agent_run_id,action_type,target_table,target_id,payload,risk_level,status,created_at
      FROM agent_actions WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG})
      AND status='pending_approval' ORDER BY created_at DESC LIMIT 30`
 ]);
 return NextResponse.json({agents:AGENTS,runs,actions});
}

export async function POST(req:Request){
 const origin=req.headers.get('origin'),host=req.headers.get('host');
 if(origin){try{if(!host||new URL(origin).host!==host)return fail('Invalid request origin.',403);}catch{return fail('Invalid request origin.',403);}}
 const {data}=await auth.getSession();if(!data?.user)return fail('Unauthorized',401);
 if(!(await hasPermission(data.user.id,'agents.run')))return fail('Forbidden',403);
 let body:Record<string,unknown>;try{body=await req.json();}catch{return fail('Invalid JSON body.');}
 const code=typeof body.agent_code==='string'?body.agent_code:'';
 const agent=AGENTS.find(x=>x.code===code);if(!agent)return fail('Agen tidak dikenal.');
 const sql:any=getSql();
 const created=await sql`INSERT INTO agent_runs(organization_id,agent_code,runtime,status,input,created_by)
   SELECT id,${code},'embedded_rules','running',${JSON.stringify({trigger:'manual'})}::jsonb,${data.user.id}
   FROM organizations WHERE slug=${ORG} RETURNING id`;
 const runId=String((created[0] as {id:string}).id);
 const findings:Array<{severity:string;title:string;detail:string;count?:number}>=[];
 const recommendations:string[]=[];
 try{
  if(code==='finance-integrity'){
   const [unbalanced,drafts,unlinked]=await Promise.all([
    sql`SELECT count(*)::int AS n FROM finance_journals j JOIN organizations o ON o.id=j.organization_id
      WHERE o.slug=${ORG} AND j.status='posted' AND (SELECT coalesce(sum(l.debit),0) FROM finance_journal_lines l WHERE l.journal_id=j.id)
      <> (SELECT coalesce(sum(l.credit),0) FROM finance_journal_lines l WHERE l.journal_id=j.id)`,
    sql`SELECT count(*)::int AS n FROM finance_journals j JOIN organizations o ON o.id=j.organization_id
      WHERE o.slug=${ORG} AND j.status='draft' AND j.created_at<NOW()-INTERVAL '7 days'`,
    sql`SELECT count(*)::int AS n FROM finance_journals j JOIN organizations o ON o.id=j.organization_id
      WHERE o.slug=${ORG} AND j.status='posted' AND j.business_transaction_id IS NULL`
   ]);
   const a=Number((unbalanced[0] as {n:number}).n),b=Number((drafts[0] as {n:number}).n),c=Number((unlinked[0] as {n:number}).n);
   if(a)findings.push({severity:'critical',title:'Jurnal posted tidak seimbang',detail:'Terdapat jurnal posted yang total debit dan kreditnya berbeda.',count:a});
   if(b)findings.push({severity:'warning',title:'Jurnal draft tertunda',detail:'Jurnal draft berusia lebih dari tujuh hari perlu ditinjau.',count:b});
   if(c)findings.push({severity:'info',title:'Jurnal belum tertaut transaksi sumber',detail:'Jurnal posted belum memiliki referensi pada shared transaction spine.',count:c});
   if(!findings.length)findings.push({severity:'success',title:'Pemeriksaan jurnal lulus',detail:'Tidak ditemukan jurnal posted tidak seimbang atau draft berusia lebih dari tujuh hari.'});
   recommendations.push('Finance harus memeriksa seluruh temuan sebelum melakukan posting atau pembayaran.');
  }else if(code==='people-operations'){
   const [missing,unpaid,zero]=await Promise.all([
    sql`SELECT count(*)::int AS n FROM hr_employees e JOIN organizations o ON o.id=e.organization_id WHERE o.slug=${ORG} AND e.status='active' AND (e.email IS NULL OR e.department_id IS NULL)`,
    sql`SELECT count(*)::int AS n FROM hr_payroll_runs r JOIN organizations o ON o.id=r.organization_id WHERE o.slug=${ORG} AND r.status='approved' AND r.created_at<NOW()-INTERVAL '5 days'`,
    sql`SELECT count(*)::int AS n FROM hr_employees e JOIN organizations o ON o.id=e.organization_id WHERE o.slug=${ORG} AND e.status='active' AND e.base_salary=0`
   ]);
   const a=Number((missing[0] as {n:number}).n),b=Number((unpaid[0] as {n:number}).n),c=Number((zero[0] as {n:number}).n);
   if(a)findings.push({severity:'warning',title:'Data pegawai belum lengkap',detail:'Pegawai aktif belum memiliki email atau departemen.',count:a});
   if(b)findings.push({severity:'warning',title:'Payroll menunggu pembayaran',detail:'Payroll berstatus approved lebih dari lima hari.',count:b});
   if(c)findings.push({severity:'info',title:'Gaji pokok nol',detail:'Periksa kelengkapan master gaji pegawai aktif.',count:c});
   if(!findings.length)findings.push({severity:'success',title:'Pemeriksaan HR selesai',detail:'Tidak ditemukan kelengkapan data kritis dari aturan yang diperiksa.'});
   recommendations.push('Perhitungan pajak, BPJS, THR dan transfer gaji tetap memerlukan validasi HR/Finance dan persetujuan manusia.');
  }else if(code==='inventory-control'){
   const [low,negative,late]=await Promise.all([
    sql`SELECT count(*)::int AS n FROM (SELECT i.id,i.minimum_stock,coalesce(sum(CASE WHEN m.movement_type IN('opening','in') THEN m.quantity WHEN m.movement_type='out' THEN -m.quantity ELSE 0 END),0) AS qty FROM inventory_items i JOIN organizations o ON o.id=i.organization_id LEFT JOIN inventory_movements m ON m.item_id=i.id WHERE o.slug=${ORG} AND i.is_active GROUP BY i.id HAVING coalesce(sum(CASE WHEN m.movement_type IN('opening','in') THEN m.quantity WHEN m.movement_type='out' THEN -m.quantity ELSE 0 END),0)<i.minimum_stock) x`,
    sql`SELECT count(*)::int AS n FROM (SELECT i.id,sum(CASE WHEN m.movement_type IN('opening','in') THEN m.quantity WHEN m.movement_type='out' THEN -m.quantity ELSE 0 END) AS qty FROM inventory_items i JOIN organizations o ON o.id=i.organization_id LEFT JOIN inventory_movements m ON m.item_id=i.id WHERE o.slug=${ORG} GROUP BY i.id HAVING sum(CASE WHEN m.movement_type IN('opening','in') THEN m.quantity WHEN m.movement_type='out' THEN -m.quantity ELSE 0 END)<0) x`,
    sql`SELECT count(*)::int AS n FROM procurement_requests p JOIN organizations o ON o.id=p.organization_id WHERE o.slug=${ORG} AND p.status IN('submitted','approved') AND p.created_at<NOW()-INTERVAL '14 days'`
   ]);
   const a=Number((low[0] as {n:number}).n),b=Number((negative[0] as {n:number}).n),c=Number((late[0] as {n:number}).n);
   if(b)findings.push({severity:'critical',title:'Stok negatif terdeteksi',detail:'Periksa konsistensi mutasi dan saldo stok.',count:b});
   if(a)findings.push({severity:'warning',title:'Stok di bawah minimum',detail:'Barang perlu ditinjau untuk rencana pengadaan.',count:a});
   if(c)findings.push({severity:'warning',title:'Pengadaan tertunda',detail:'Permintaan submitted/approved lebih dari 14 hari.',count:c});
   if(!findings.length)findings.push({severity:'success',title:'Pemeriksaan inventaris lulus',detail:'Tidak ditemukan stok di bawah minimum atau pengadaan yang tertunda.'});
   recommendations.push('Agen tidak membuat pembelian atau mutasi stok otomatis; verifikasi fisik dan persetujuan tetap wajib.');
  }else if(code==='crm-health'){
   const rows=await sql`SELECT count(*) FILTER(WHERE email IS NULL AND phone IS NULL)::int AS no_contact,
      count(*) FILTER(WHERE display_name IS NULL OR btrim(display_name)='')::int AS no_name,
      count(*)::int AS total FROM parties p JOIN organizations o ON o.id=p.organization_id WHERE o.slug=${ORG} AND p.deleted_at IS NULL`;
   const row=rows[0] as {no_contact:number;no_name:number;total:number};
   if(Number(row.no_contact))findings.push({severity:'warning',title:'Relasi tanpa kontak',detail:'Pelanggan/pemasok belum memiliki email maupun telepon.',count:Number(row.no_contact)});
   if(Number(row.no_name))findings.push({severity:'critical',title:'Nama relasi kosong',detail:'Master relasi bisnis memiliki nama tampilan kosong.',count:Number(row.no_name)});
   if(!findings.length)findings.push({severity:'success',title:'Kualitas data CRM baik',detail:`Memeriksa ${row.total} relasi bisnis; tidak ditemukan anomali dari aturan dasar.`});
   recommendations.push('Lakukan deduplikasi lanjutan berdasarkan NPWP/email dengan persetujuan pemilik data.');
  }else if(code==='cms-editorial'){
   const [drafts,seo]=await Promise.all([
    sql`SELECT count(*)::int AS n FROM cms_posts p WHERE p.status='draft' AND p.updated_at<NOW()-INTERVAL '14 days'`,
    sql`SELECT count(*)::int AS n FROM cms_posts p WHERE p.status='published' AND (coalesce(p.seo_title,'')='' OR coalesce(p.seo_description,'')='')`
   ]);
   const a=Number((drafts[0] as {n:number}).n),b=Number((seo[0] as {n:number}).n);
   if(a)findings.push({severity:'warning',title:'Draft editorial tertunda',detail:'Draft tidak diperbarui lebih dari 14 hari.',count:a});
   if(b)findings.push({severity:'warning',title:'Metadata SEO belum lengkap',detail:'Artikel terbit belum memiliki SEO title atau description.',count:b});
   if(!findings.length)findings.push({severity:'success',title:'Pemeriksaan editorial lulus',detail:'Tidak ditemukan draft lama atau metadata SEO kosong.'});
   recommendations.push('Agen memberi rekomendasi; publikasi artikel tetap membutuhkan persetujuan editor.');
  }else if(code==='enterprise-orchestrator'){
   const recent=await sql`SELECT agent_code,result,created_at FROM agent_runs WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND status='completed' AND agent_code<>'enterprise-orchestrator' AND created_at>NOW()-INTERVAL '24 hours' ORDER BY created_at DESC LIMIT 60`;
   const byAgent=new Map<string,any>();
   for(const row of recent as any[]){if(!byAgent.has(String(row.agent_code)))byAgent.set(String(row.agent_code),row.result||{});}
   let critical=0,warning=0,info=0;
   const consolidated:any[]=[];
   for(const [agentCode,result] of byAgent.entries()){
    for(const finding of (Array.isArray(result.findings)?result.findings:[])){
     if(finding.severity==='critical')critical++;else if(finding.severity==='warning')warning++;else if(finding.severity==='info')info++;
     consolidated.push({agent_code:agentCode,...finding});
    }
   }
   findings.push(...consolidated.slice(0,40));
   if(!recent.length)findings.push({severity:'info',title:'Belum ada hasil agen spesialis',detail:'Jalankan agen domain terlebih dahulu; Orchestrator hanya mengonsolidasikan hasil 24 jam terakhir.'});
   recommendations.push('Prioritaskan temuan critical, lalu warning. Pemilik modul harus menilai konteks sebelum tindakan.');
   recommendations.push('Orchestrator tidak menjalankan perubahan bisnis atau tindakan perbaikan secara otomatis.');
   const localInsight=await askLocalModel(agent.name,{summary:{agents_seen:byAgent.size,critical,warning,info},findings,recommendations});
   const runtime=localInsight?'local_model':'embedded_rules';
   const result={agent:agent.name,runtime,local_model_insight:localInsight,generated_at:new Date().toISOString(),finding_count:findings.length,summary:{agents_seen:byAgent.size,critical,warning,info},findings,recommendations,autonomous_scope:'read_only_multi_agent_coordination'};
   await sql`UPDATE agent_runs SET runtime=${runtime},status='completed',result=${JSON.stringify(result)}::jsonb,finished_at=NOW() WHERE id=${runId}::uuid`;
   await sql`INSERT INTO audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,after_data) SELECT id,${data.user.id},'run_agent','agent_run',${runId},${JSON.stringify({agent_code:code,finding_count:findings.length,runtime})}::jsonb FROM organizations WHERE slug=${ORG}`;
   return NextResponse.json({run_id:runId,...result});
  }else if(code==='system-maintenance'){
   const required=['organizations','business_units','parties','audit_logs','cms_posts','cms_seo_audits','finance_accounts','finance_journals','finance_journal_lines','hr_employees','hr_payroll_runs','hr_payroll_lines','inventory_items','inventory_movements','procurement_requests','module_catalog','organization_modules','business_transactions','agent_runs','agent_actions'];
   const tables=await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`;
   const found=new Set(tables.map((x:any)=>String(x.table_name)));
   const missing=required.filter(x=>!found.has(x));
   const migration=await sql`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version='20261104_004_unified_modules_agents_reports') AS unified_applied,EXISTS(SELECT 1 FROM schema_migrations WHERE version='20261104_005_enterprise_transaction_module') AS enterprise_applied`;
   if(missing.length)findings.push({severity:'critical',title:'Skema database belum lengkap',detail:'Tabel wajib tidak ditemukan: '+missing.join(', '),count:missing.length});
   if(!(migration[0] as {unified_applied:boolean;enterprise_applied:boolean}).unified_applied||!(migration[0] as {unified_applied:boolean;enterprise_applied:boolean}).enterprise_applied)findings.push({severity:'warning',title:'Migration registry belum lengkap',detail:'Migration 004 atau 005 belum tercatat pada schema_migrations.'});
   if(!findings.length)findings.push({severity:'success',title:'Database dan skema inti terdeteksi',detail:'Koneksi berhasil dan seluruh tabel wajib tersedia.'});
   recommendations.push('Agen hanya melakukan pemeriksaan read-only. Perubahan skema, deployment, dan perbaikan kode harus melalui pull request serta persetujuan Owner.');
  }
  const localInsight=await askLocalModel(agent.name,{findings,recommendations});
  const runtime=localInsight?'local_model':'embedded_rules';
  const result={agent:agent.name,runtime,local_model_insight:localInsight,generated_at:new Date().toISOString(),finding_count:findings.length,findings,recommendations,autonomous_scope:'read_only_diagnostics'};
  await sql`UPDATE agent_runs SET runtime=${runtime},status='completed',result=${JSON.stringify(result)}::jsonb,finished_at=NOW() WHERE id=${runId}::uuid`;
  await sql`INSERT INTO audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,after_data)
    SELECT id,${data.user.id},'run_agent','agent_run',${runId},${JSON.stringify({agent_code:code,finding_count:findings.length,runtime})}::jsonb FROM organizations WHERE slug=${ORG}`;
  return NextResponse.json({run_id:runId,...result});
 }catch(e){
  await sql`UPDATE agent_runs SET status='failed',result=${JSON.stringify({error:'Agent diagnostic failed. Check required schema and database permissions.'})}::jsonb,finished_at=NOW() WHERE id=${runId}::uuid`;
  return fail('Agen gagal berjalan. Periksa skema database dan hak akses.',503);
 }
}
