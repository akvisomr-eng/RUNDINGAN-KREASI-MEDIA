import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { hasPermission } from '@/lib/auth/permissions';
import { getSql } from '@/lib/db';

export const dynamic='force-dynamic';
const ORG='rundingan-kreasi-media';
const fail=(message:string,status=400)=>NextResponse.json({error:message},{status});
const str=(v:unknown,max=240)=>typeof v==='string'?v.trim().slice(0,max):'';
const num=(v:unknown)=>Number(v??0);
const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(new Date(v+'T00:00:00Z').getTime())&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
async function user(){const {data}=await auth.getSession();return data?.user??null;}
async function allowed(id:string,permission:string){return hasPermission(id,permission);}
async function audit(tx:any,userId:string,action:string,type:string,id:string,data:unknown){
 await tx`INSERT INTO audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,after_data)
 SELECT id,${userId},${action},${type},${id},${JSON.stringify(data)}::jsonb FROM organizations WHERE slug=${ORG}`;
}

export async function GET(req:Request){
 const u=await user();if(!u)return fail('Unauthorized',401);
 const url=new URL(req.url),view=url.searchParams.get('view')||'overview';
 const start=url.searchParams.get('start')||'1900-01-01',end=url.searchParams.get('end')||new Date().toISOString().slice(0,10);
 const module=url.searchParams.get('module')||'',accountId=url.searchParams.get('account')||'';
 const unit=url.searchParams.get('business_unit')||'',project=url.searchParams.get('project')||'',costCenter=url.searchParams.get('cost_center')||'';
 const db:any=getSql();
 try{
  if(view==='overview'){
   if(!(await allowed(u.id,'finance.accounts.read')))return fail('Forbidden',403);
   const [accounts,journals,periods,costCenters,projects,taxCodes,bankAccounts,businessUnits,parties,metrics]=await Promise.all([
    db`SELECT a.id,a.code,a.name,a.account_type,a.normal_balance,a.parent_account_id,a.account_group,a.description,a.is_postable,a.is_active,a.cash_flow_category,a.default_tax_code,a.display_order, p.code AS parent_code,p.name AS parent_name FROM finance_accounts a LEFT JOIN finance_accounts p ON p.id=a.parent_account_id AND p.organization_id=a.organization_id WHERE a.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY a.code`,
    db`SELECT j.id,j.journal_number,j.journal_date,j.document_date,j.reference_no,j.description,j.journal_type,j.source_module_code,j.status,j.created_at,j.business_transaction_id,coalesce(sum(l.debit),0)::numeric(18,2) debit,coalesce(sum(l.credit),0)::numeric(18,2) credit,count(l.id)::int line_count FROM finance_journals j LEFT JOIN finance_journal_lines l ON l.journal_id=j.id JOIN organizations o ON o.id=j.organization_id WHERE o.slug=${ORG} GROUP BY j.id ORDER BY j.journal_date DESC,j.created_at DESC LIMIT 300`,
    db`SELECT id,fiscal_year,period_number,name,start_date,end_date,status,closed_at FROM finance_periods WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY start_date DESC LIMIT 50`,
    db`SELECT id,code,name,business_unit_id,is_active FROM finance_cost_centers WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY code`,
    db`SELECT id,code,name,module_code,business_unit_id,budget_amount,status FROM finance_projects WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY code`,
    db`SELECT id,code,name,tax_type,rate,is_active FROM finance_tax_codes WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY code`,
    db`SELECT id,bank_name,account_name,account_number_masked,currency,account_id,is_active FROM finance_bank_accounts WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY bank_name`,
    db`SELECT id,code,name FROM business_units WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND deleted_at IS NULL ORDER BY code`,
    db`SELECT id,party_type,display_name,legal_name FROM parties WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND deleted_at IS NULL ORDER BY display_name LIMIT 500`,
    db`SELECT
      (SELECT count(*)::int FROM finance_journals j WHERE j.organization_id=o.id) journals_total,
      (SELECT count(*)::int FROM finance_journals j WHERE j.organization_id=o.id AND j.status='draft') journals_draft,
      (SELECT count(*)::int FROM finance_journals j WHERE j.organization_id=o.id AND j.status='submitted') journals_pending,
      (SELECT count(*)::int FROM finance_journals j WHERE j.organization_id=o.id AND j.status='posted') journals_posted,
      (SELECT count(*)::int FROM finance_accounts a WHERE a.organization_id=o.id AND a.is_active) accounts_active,
      (SELECT count(*)::int FROM finance_periods p WHERE p.organization_id=o.id AND p.status='open') open_periods
      FROM organizations o WHERE o.slug=${ORG}`
   ]);
   return NextResponse.json({accounts,journals,periods,costCenters,projects,taxCodes,bankAccounts,businessUnits,parties,metrics:metrics[0]||{}});
  }
  if(!(await allowed(u.id,'finance.reports.read')))return fail('Forbidden',403);
  if(!validDate(start)||!validDate(end)||end<start)return fail('Rentang tanggal laporan tidak valid.');
  if(view==='trial-balance'||view==='profit-loss'||view==='balance-sheet'||view==='ledger'||view==='journal-register'||view==='cash-flow'){
   const rows=await db`WITH movement AS (
    SELECT a.id account_id,a.code,a.name,a.account_type,a.normal_balance,a.cash_flow_category,
      coalesce(sum(CASE WHEN j.journal_date<${start}::date THEN l.debit ELSE 0 END),0)::numeric(18,2) opening_debit,
      coalesce(sum(CASE WHEN j.journal_date<${start}::date THEN l.credit ELSE 0 END),0)::numeric(18,2) opening_credit,
      coalesce(sum(CASE WHEN j.journal_date BETWEEN ${start}::date AND ${end}::date THEN l.debit ELSE 0 END),0)::numeric(18,2) period_debit,
      coalesce(sum(CASE WHEN j.journal_date BETWEEN ${start}::date AND ${end}::date THEN l.credit ELSE 0 END),0)::numeric(18,2) period_credit,
      coalesce(sum(CASE WHEN j.journal_date<=${end}::date THEN l.debit ELSE 0 END),0)::numeric(18,2) closing_debit,
      coalesce(sum(CASE WHEN j.journal_date<=${end}::date THEN l.credit ELSE 0 END),0)::numeric(18,2) closing_credit
    FROM finance_accounts a
    LEFT JOIN finance_journal_lines l ON l.account_id=a.id AND l.organization_id=a.organization_id
    LEFT JOIN finance_journals j ON j.id=l.journal_id AND j.organization_id=a.organization_id AND j.status='posted'
      AND j.journal_date<=${end}::date
      AND (${module}='' OR j.source_module_code=${module})
      AND (${unit}='' OR j.business_unit_id=${unit}::uuid)
      AND (${project}='' OR l.project_id=${project}::uuid)
      AND (${costCenter}='' OR l.cost_center_id=${costCenter}::uuid)
    WHERE a.organization_id=(SELECT id FROM organizations WHERE slug=${ORG})
      AND a.is_active=true AND (${accountId}='' OR a.id=${accountId}::uuid)
      AND (${view}<>'profit-loss' OR a.account_type IN ('revenue','expense'))
      AND (${view}<>'balance-sheet' OR a.account_type IN ('asset','liability','equity'))
    GROUP BY a.id
   )
   SELECT *, (closing_debit-closing_credit)::numeric(18,2) closing_net,
     (CASE WHEN normal_balance='debit' THEN closing_debit-closing_credit ELSE closing_credit-closing_debit END)::numeric(18,2) closing_balance,
     (CASE WHEN normal_balance='debit' THEN period_debit-period_credit ELSE period_credit-period_debit END)::numeric(18,2) period_balance,
     (CASE WHEN normal_balance='debit' THEN opening_debit-opening_credit ELSE opening_credit-opening_debit END)::numeric(18,2) opening_balance
   FROM movement ORDER BY code`;
   if(view==='ledger'){
    if(!accountId)return fail('Pilih akun untuk melihat buku besar.');
    const ledger=await db`WITH a AS(SELECT normal_balance FROM finance_accounts WHERE id=${accountId}::uuid AND organization_id=(SELECT id FROM organizations WHERE slug=${ORG})),
      opening AS(SELECT coalesce(sum(CASE WHEN a.normal_balance='debit' THEN l.debit-l.credit ELSE l.credit-l.debit END),0)::numeric(18,2) balance
       FROM finance_journal_lines l JOIN finance_journals j ON j.id=l.journal_id AND j.organization_id=l.organization_id CROSS JOIN a
       WHERE l.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND l.account_id=${accountId}::uuid AND j.status='posted' AND j.journal_date<${start}::date),
      entries AS(SELECT j.id journal_id,j.journal_number,j.journal_date,j.description,j.reference_no,j.source_module_code,l.description line_description,l.debit,l.credit,bt.reference_no source_reference,
       CASE WHEN a.normal_balance='debit' THEN l.debit-l.credit ELSE l.credit-l.debit END movement
       FROM finance_journal_lines l JOIN finance_journals j ON j.id=l.journal_id AND j.organization_id=l.organization_id CROSS JOIN a
       LEFT JOIN business_transactions bt ON bt.id=j.business_transaction_id
       WHERE l.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND l.account_id=${accountId}::uuid
       AND j.status='posted' AND j.journal_date BETWEEN ${start}::date AND ${end}::date
       AND (${module}='' OR j.source_module_code=${module}))
      SELECT entries.*,(opening.balance+sum(entries.movement) OVER(ORDER BY entries.journal_date,entries.journal_number ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW))::numeric(18,2) running_balance FROM entries CROSS JOIN opening ORDER BY journal_date,journal_number`;
    return NextResponse.json({rows,ledger,view,start,end});
   }
   if(view==='journal-register'){
    const register=await db`SELECT j.id,j.journal_number,j.journal_date,j.document_date,j.reference_no,j.description,j.source_module_code,j.status,
      coalesce(sum(l.debit),0)::numeric(18,2) debit,coalesce(sum(l.credit),0)::numeric(18,2) credit
      FROM finance_journals j LEFT JOIN finance_journal_lines l ON l.journal_id=j.id
      WHERE j.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND j.journal_date BETWEEN ${start}::date AND ${end}::date
      GROUP BY j.id ORDER BY j.journal_date,j.journal_number`;
    return NextResponse.json({register,view,start,end});
   }
   if(view==='cash-flow'){
    const cash=rows.filter((r:any)=>r.account_type==='asset'&&r.cash_flow_category);
    return NextResponse.json({rows:cash,view,start,end,notice:'Klasifikasi arus kas mengikuti kategori akun. Laporan arus kas tidak langsung yang final memerlukan penyesuaian non-kas dan perubahan modal kerja.'});
   }
   return NextResponse.json({rows,view,start,end});
  }
  if(view==='integrity'){
   const [unbalanced,closedPeriod,orphan]=await Promise.all([
    db`SELECT j.id,j.journal_number,j.journal_date,j.status,coalesce(sum(l.debit),0)::numeric(18,2) debit,coalesce(sum(l.credit),0)::numeric(18,2) credit,count(l.id)::int line_count FROM finance_journals j LEFT JOIN finance_journal_lines l ON l.journal_id=j.id WHERE j.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) GROUP BY j.id HAVING j.status='posted' AND (coalesce(sum(l.debit),0)<>coalesce(sum(l.credit),0) OR count(l.id)<2) ORDER BY j.journal_date DESC`,
    db`SELECT j.id,j.journal_number,j.journal_date,p.name period_name FROM finance_journals j JOIN finance_periods p ON p.organization_id=j.organization_id AND j.journal_date BETWEEN p.start_date AND p.end_date WHERE j.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND p.status='closed' AND j.status<>'void'`,
    db`SELECT l.id,l.journal_id,l.account_id FROM finance_journal_lines l LEFT JOIN finance_accounts a ON a.id=l.account_id AND a.organization_id=l.organization_id WHERE l.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND a.id IS NULL`
   ]);
   return NextResponse.json({unbalanced,closedPeriod,orphan});
  }
  return fail('Laporan tidak dikenal.',404);
 }catch(error){console.error('finance GET',error);return fail('Gagal memuat data keuangan.',503);}
}

export async function POST(req:Request){
 const origin=req.headers.get('origin'),host=req.headers.get('host');
 if(origin){try{if(!host||new URL(origin).host!==host)return fail('Invalid request origin.',403);}catch{return fail('Invalid request origin.',403);}}
 const u=await user();if(!u)return fail('Unauthorized',401);
 let b:Record<string,unknown>;try{b=await req.json();}catch{return fail('Invalid JSON.');}
 const action=str(b.action,50),db:any=getSql();
 try{
  if(action==='seed-coa-template'){
   if(!(await allowed(u.id,'finance.accounts.manage')))return fail('Forbidden',403);
   const template=[
    ['1000','ASET',null,'asset','debit',false,''],
    ['1100','Aset Lancar','1000','asset','debit',false,''],
    ['1110','Kas','1100','asset','debit',true,'operating'],
    ['1120','Bank','1100','asset','debit',true,'operating'],
    ['1130','Piutang Usaha','1100','asset','debit',true,'operating'],
    ['1140','Persediaan','1100','asset','debit',true,'operating'],
    ['1150','Biaya Dibayar di Muka','1100','asset','debit',true,'operating'],
    ['1200','Aset Tidak Lancar','1000','asset','debit',false,''],
    ['1210','Peralatan Produksi & Kantor','1200','asset','debit',true,'investing'],
    ['1290','Akumulasi Penyusutan','1200','asset','credit',true,'investing'],
    ['2000','LIABILITAS',null,'liability','credit',false,''],
    ['2100','Utang Usaha','2000','liability','credit',true,'operating'],
    ['2200','Utang Pajak','2000','liability','credit',true,'operating'],
    ['2300','Utang Gaji & Honor','2000','liability','credit',true,'operating'],
    ['2400','Uang Muka Pelanggan / Pendapatan Diterima di Muka','2000','liability','credit',true,'operating'],
    ['3000','EKUITAS',null,'equity','credit',false,''],
    ['3100','Modal Pemilik','3000','equity','credit',true,'financing'],
    ['3200','Laba Ditahan','3000','equity','credit',true,'financing'],
    ['3300','Laba Tahun Berjalan','3000','equity','credit',true,'financing'],
    ['4000','PENDAPATAN',null,'revenue','credit',false,''],
    ['4100','Pendapatan Academy','4000','revenue','credit',true,'operating'],
    ['4200','Pendapatan Creative','4000','revenue','credit',true,'operating'],
    ['4300','Pendapatan Event','4000','revenue','credit',true,'operating'],
    ['4400','Pendapatan Media & Iklan','4000','revenue','credit',true,'operating'],
    ['4500','Pendapatan Production','4000','revenue','credit',true,'operating'],
    ['4600','Pendapatan Rental','4000','revenue','credit',true,'operating'],
    ['4900','Pendapatan Lain-lain','4000','revenue','credit',true,'operating'],
    ['5000','BEBAN POKOK PENDAPATAN',null,'expense','debit',false,''],
    ['5100','Biaya Pengajar & Materi Academy','5000','expense','debit',true,'operating'],
    ['5200','Biaya Talent & Kreatif','5000','expense','debit',true,'operating'],
    ['5300','Biaya Langsung Event','5000','expense','debit',true,'operating'],
    ['5400','Biaya Konten & Distribusi Media','5000','expense','debit',true,'operating'],
    ['5500','Biaya Langsung Production','5000','expense','debit',true,'operating'],
    ['5600','Biaya Langsung Rental & Perawatan','5000','expense','debit',true,'operating'],
    ['6000','BEBAN OPERASIONAL',null,'expense','debit',false,''],
    ['6100','Gaji & Tunjangan','6000','expense','debit',true,'operating'],
    ['6200','Internet, Listrik & Utilitas','6000','expense','debit',true,'operating'],
    ['6300','Pemasaran & Promosi','6000','expense','debit',true,'operating'],
    ['6400','Sewa & Administrasi','6000','expense','debit',true,'operating'],
    ['6500','Software, Cloud & AI API','6000','expense','debit',true,'operating'],
    ['6600','Beban Penyusutan','6000','expense','debit',true,'operating'],
    ['6700','Pajak, Perizinan & Kepatuhan','6000','expense','debit',true,'operating'],
    ['6800','Biaya Bank & Administrasi Pembayaran','6000','expense','debit',true,'operating']
   ] as const;
   const result=await db.begin(async(tx:any)=>{
    const org=await tx`SELECT id FROM organizations WHERE slug=${ORG}`;if(!org.length)throw new Error('Organisasi tidak ditemukan.');
    let inserted=0;
    for(const row of template){
     const [code,name,parentCode,type,normal,postable,cashFlow]=row;
     let parentId=null;
     if(parentCode){const parent=await tx`SELECT id FROM finance_accounts WHERE organization_id=${org[0].id} AND code=${parentCode}`;if(!parent.length)throw new Error('Akun induk '+parentCode+' belum tersedia.');parentId=parent[0].id;}
     const created=await tx`INSERT INTO finance_accounts(organization_id,code,name,parent_account_id,account_type,normal_balance,is_postable,cash_flow_category,account_group)
      VALUES(${org[0].id},${code},${name},${parentId},${type},${normal},${postable},${cashFlow||null},${name})
      ON CONFLICT(organization_id,code) DO NOTHING RETURNING id`;
     inserted+=created.length;
    }
    return {inserted,total:template.length};
   });
   await audit(db,u.id,'seed_template','finance_accounts','chart-of-accounts',result);
   return NextResponse.json({result});
  }
  if(action==='create-account'||action==='update-account'||action==='deactivate-account'){
   if(!(await allowed(u.id,'finance.accounts.manage')))return fail('Forbidden',403);
   const id=str(b.id,80),code=str(b.code,30),name=str(b.name,160),type=str(b.account_type,20),normal=str(b.normal_balance,10),parent=str(b.parent_account_id,80)||null;
   if(action!=='deactivate-account'&&(!code||!name||!['asset','liability','equity','revenue','expense'].includes(type)||!['debit','credit'].includes(normal)))return fail('Data akun tidak valid.');
   const rows=await db.begin(async(tx:any)=>{
    if(action==='deactivate-account')return tx`UPDATE finance_accounts SET is_active=false,updated_at=now() WHERE id=${id}::uuid AND organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) RETURNING id,code,name`;
    if(parent){const p=await tx`SELECT id,is_postable FROM finance_accounts WHERE id=${parent}::uuid AND organization_id=(SELECT id FROM organizations WHERE slug=${ORG})`;if(!p.length||p[0].is_postable)return [];}
    if(action==='update-account')return tx`UPDATE finance_accounts SET code=${code},name=${name},account_type=${type},normal_balance=${normal},parent_account_id=${parent}::uuid,account_group=${str(b.account_group,100)||null},description=${str(b.description,1000)||null},is_postable=${b.is_postable!==false},cash_flow_category=${str(b.cash_flow_category,40)||null},default_tax_code=${str(b.default_tax_code,40)||null},display_order=${num(b.display_order)},is_active=${b.is_active!==false},updated_at=now() WHERE id=${id}::uuid AND organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) RETURNING id,code,name`;
    return tx`INSERT INTO finance_accounts(organization_id,code,name,account_type,normal_balance,parent_account_id,account_group,description,is_postable,cash_flow_category,default_tax_code,display_order)
      SELECT id,${code},${name},${type},${normal},${parent}::uuid,${str(b.account_group,100)||null},${str(b.description,1000)||null},${b.is_postable!==false},${str(b.cash_flow_category,40)||null},${str(b.default_tax_code,40)||null},${num(b.display_order)}
      FROM organizations WHERE slug=${ORG} RETURNING id,code,name`;
   });
   if(!rows.length)return fail('Akun induk tidak valid atau data tidak ditemukan.',409);
   await audit(db,u.id,action,'finance_account',String(rows[0].id),{code:rows[0].code,name:rows[0].name});
   return NextResponse.json({account:rows[0]},{status:action==='create-account'?201:200});
  }
  if(action==='create-journal'){
   if(!(await allowed(u.id,'finance.journals.create')))return fail('Forbidden',403);
   const date=str(b.journal_date,10),docDate=str(b.document_date,10)||date,description=str(b.description,500),reference=str(b.reference_no,100)||null;
   const source=str(b.source_module_code,30)||'ENTERPRISE',journalType=str(b.journal_type,30)||'general',unit=str(b.business_unit_id,80)||null,party=str(b.party_id,80)||null;
   const lines=Array.isArray(b.lines)?b.lines as Record<string,unknown>[]:[];
   if(!validDate(date)||!validDate(docDate)||!description||lines.length<2||lines.length>100)return fail('Header jurnal atau jumlah baris tidak valid.');
   const ls=lines.map(x=>({account_id:str(x.account_id,80),description:str(x.description,240)||null,debit:num(x.debit),credit:num(x.credit),cost_center_id:str(x.cost_center_id,80)||null,project_id:str(x.project_id,80)||null,party_id:str(x.party_id,80)||party,tax_code:str(x.tax_code,40)||null,business_unit_id:str(x.business_unit_id,80)||unit}));
   if(ls.some(x=>!x.account_id||!Number.isFinite(x.debit)||!Number.isFinite(x.credit)||x.debit<0||x.credit<0||Math.abs(x.debit*100-Math.round(x.debit*100))>1e-6||Math.abs(x.credit*100-Math.round(x.credit*100))>1e-6||((x.debit>0)===(x.credit>0))))return fail('Setiap baris wajib memiliki debit atau kredit saja dan maksimal dua desimal.');
   const dc=ls.reduce((s,x)=>s+Math.round(x.debit*100),0),cc=ls.reduce((s,x)=>s+Math.round(x.credit*100),0);
   if(dc<=0||dc!==cc)return fail('Jurnal tidak seimbang. Total debit harus sama dengan total kredit.');
   const result=await db.begin(async(tx:any)=>{
    const org=await tx`SELECT id FROM organizations WHERE slug=${ORG}`;if(!org.length)throw new Error('Organisasi tidak ditemukan.');
    const accountIds=[...new Set(ls.map(x=>x.account_id))];
    const validAccounts=await tx`SELECT id FROM finance_accounts WHERE organization_id=${org[0].id} AND id=ANY(${accountIds}::uuid[]) AND is_active AND is_postable`;
    if(validAccounts.length!==accountIds.length)throw new Error('Satu atau lebih akun tidak aktif, bukan akun posting, atau bukan milik organisasi.');
    const period=await tx`SELECT id,status FROM finance_periods WHERE organization_id=${org[0].id} AND ${date}::date BETWEEN start_date AND end_date LIMIT 1`;
    if(period.length&&period[0].status!=='open')throw new Error('Periode akuntansi sudah ditutup.');
    const jno='JRN-'+date.replace(/-/g,'')+'-'+crypto.randomUUID().slice(0,8).toUpperCase();
    const headers=await tx`INSERT INTO finance_journals(organization_id,journal_number,journal_date,document_date,reference_no,description,journal_type,source_module_code,business_unit_id,party_id,currency,exchange_rate,memo,period_id,created_by)
      VALUES(${org[0].id},${jno},${date}::date,${docDate}::date,${reference},${description},${journalType},${source},${unit}::uuid,${party}::uuid,${str(b.currency,3)||'IDR'},${num(b.exchange_rate)||1},${str(b.memo,2000)||null},${period[0]?.id||null},${u.id}) RETURNING id,journal_number,status`;
    const jid=headers[0].id;
    for(const line of ls){
     await tx`INSERT INTO finance_journal_lines(organization_id,journal_id,account_id,description,debit,credit,business_unit_id,cost_center_id,project_id,party_id,tax_code,source_module_code)
      VALUES(${org[0].id},${jid},${line.account_id}::uuid,${line.description},${line.debit},${line.credit},${line.business_unit_id}::uuid,${line.cost_center_id}::uuid,${line.project_id}::uuid,${line.party_id}::uuid,${line.tax_code},${source})`;
    }
    const total=dc/100;
    const bt=await tx`INSERT INTO business_transactions(organization_id,business_unit_id,module_code,transaction_type,reference_no,description,transaction_date,status,amount,currency,source_table,source_id,created_by)
      VALUES(${org[0].id},${unit}::uuid,'ENTERPRISE','journal',${jno},${description},${date}::date,'draft',${total},${str(b.currency,3)||'IDR'},'finance_journals',${jid},${u.id}) RETURNING id`;
    await tx`UPDATE finance_journals SET business_transaction_id=${bt[0].id} WHERE id=${jid}`;
    await audit(tx,u.id,'create','finance_journal',jid,{journal_number:jno,debit:total,credit:total,source_module_code:source});
    return {id:jid,journal_number:jno,status:'draft',total_debit:total,total_credit:total};
   });
   return NextResponse.json({journal:result},{status:201});
  }
  if(['submit-journal','approve-journal','post-journal'].includes(action)){
   const permission=action==='approve-journal'?'finance.journals.approve':'finance.journals.create';
   if(!(await allowed(u.id,permission)))return fail('Forbidden',403);
   const id=str(b.id,80);
   const row=await db.begin(async(tx:any)=>{
    const current=await tx`SELECT j.id,j.status,j.journal_number,j.organization_id,j.journal_date,p.status period_status FROM finance_journals j LEFT JOIN finance_periods p ON p.id=j.period_id WHERE j.id=${id}::uuid AND j.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) FOR UPDATE OF j`;
    if(!current.length)throw new Error('Jurnal tidak ditemukan.');
    const totals=await tx`SELECT coalesce(sum(debit),0)::numeric(18,2) debit,coalesce(sum(credit),0)::numeric(18,2) credit,count(*)::int lines FROM finance_journal_lines WHERE journal_id=${id}::uuid AND organization_id=(SELECT id FROM organizations WHERE slug=${ORG})`;
    const j={...current[0],...totals[0]},balanced=Number(j.debit)>0&&Number(j.debit)===Number(j.credit)&&Number(j.lines)>=2;
    if(!balanced)throw new Error('Jurnal belum seimbang atau belum memiliki minimal dua baris.');
    if(j.period_status==='closed')throw new Error('Periode sudah ditutup.');
    let next='';
    if(action==='submit-journal'&&j.status==='draft')next='submitted';
    else if(action==='approve-journal'&&j.status==='submitted')next='approved';
    else if(action==='post-journal'&&j.status==='approved')next='posted';
    else throw new Error('Transisi status tidak diizinkan.');
    const updated=await tx`UPDATE finance_journals SET status=${next},approved_by=CASE WHEN ${next}='approved' THEN ${u.id} ELSE approved_by END,approved_at=CASE WHEN ${next}='approved' THEN now() ELSE approved_at END,posted_by=CASE WHEN ${next}='posted' THEN ${u.id} ELSE posted_by END,posted_at=CASE WHEN ${next}='posted' THEN now() ELSE posted_at END WHERE id=${id}::uuid RETURNING id,journal_number,status`;
    await tx`UPDATE business_transactions SET status=${next},updated_at=now() WHERE source_table='finance_journals' AND source_id=${id}`;
    await audit(tx,u.id,next,'finance_journal',id,{status:next});
    return updated[0];
   });
   return NextResponse.json({journal:row});
  }
  if(action==='create-period'){
   if(!(await allowed(u.id,'finance.periods.manage')))return fail('Forbidden',403);
   const year=num(b.fiscal_year),n=num(b.period_number),name=str(b.name,80),start=str(b.start_date,10),end=str(b.end_date,10);
   if(year<2000||year>2200||n<1||n>13||!name||!validDate(start)||!validDate(end)||end<start)return fail('Periode tidak valid.');
   const rows=await db`INSERT INTO finance_periods(organization_id,fiscal_year,period_number,name,start_date,end_date) SELECT id,${year},${n},${name},${start}::date,${end}::date FROM organizations WHERE slug=${ORG} RETURNING id,name,status`;
   return NextResponse.json({period:rows[0]},{status:201});
  }
  if(action==='close-period'){
   if(!(await allowed(u.id,'finance.periods.manage')))return fail('Forbidden',403);
   const id=str(b.id,80);
   const rows=await db.begin(async(tx:any)=>{
    const openJournals=await tx`SELECT count(*)::int n FROM finance_journals j JOIN finance_periods p ON p.organization_id=j.organization_id AND j.journal_date BETWEEN p.start_date AND p.end_date WHERE p.id=${id}::uuid AND j.status IN ('draft','submitted','approved')`;
    if(Number(openJournals[0]?.n||0)>0)throw new Error('Masih ada jurnal draft/menunggu persetujuan di periode ini.');
    return tx`UPDATE finance_periods SET status='closed',closed_by=${u.id},closed_at=now() WHERE id=${id}::uuid AND organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND status='open' RETURNING id,name,status`;
   });
   if(!rows.length)return fail('Periode tidak ditemukan atau sudah ditutup.',409);
   await audit(db,u.id,'close','finance_period',id,{status:'closed'});
   return NextResponse.json({period:rows[0]});
  }
  if(action==='create-cost-center'||action==='create-project'){
   if(!(await allowed(u.id,'finance.dimensions.manage')))return fail('Forbidden',403);
   const table=action==='create-cost-center'?'finance_cost_centers':'finance_projects',code=str(b.code,40),name=str(b.name,160);
   if(!code||!name)return fail('Kode dan nama wajib diisi.');
   const rows=action==='create-cost-center'
    ?await db`INSERT INTO finance_cost_centers(organization_id,code,name,business_unit_id,description) SELECT id,${code},${name},${str(b.business_unit_id,80)||null}::uuid,${str(b.description,1000)||null} FROM organizations WHERE slug=${ORG} RETURNING id,code,name`
    :await db`INSERT INTO finance_projects(organization_id,code,name,module_code,business_unit_id,customer_party_id,start_date,end_date,budget_amount,description) SELECT id,${code},${name},${str(b.module_code,30)||'ENTERPRISE'},${str(b.business_unit_id,80)||null}::uuid,${str(b.customer_party_id,80)||null}::uuid,${str(b.start_date,10)||null}::date,${str(b.end_date,10)||null}::date,${num(b.budget_amount)},${str(b.description,1000)||null} FROM organizations WHERE slug=${ORG} RETURNING id,code,name`;
   return NextResponse.json({item:rows[0]},{status:201});
  }
  return fail('Operasi tidak dikenal.',404);
 }catch(error){const message=error instanceof Error?error.message:'Operasi keuangan gagal.';console.error('finance POST',error);return fail(message,409);}
}
