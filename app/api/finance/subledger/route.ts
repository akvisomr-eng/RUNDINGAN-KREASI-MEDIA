import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { hasPermission } from '@/lib/auth/permissions';
import { getSql } from '@/lib/db';

export const dynamic='force-dynamic';
const ORG='rundingan-kreasi-media';
const fail=(message:string,status=400)=>NextResponse.json({error:message},{status});
const s=(v:unknown,max=240)=>typeof v==='string'?v.trim().slice(0,max):'';
const n=(v:unknown)=>Number(v??0);
const dateOk=(v:string)=>/^\\d{4}-\\d{2}-\\d{2}$/.test(v)&&Number.isFinite(new Date(v+'T00:00:00Z').getTime())&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const round=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
async function currentUser(){const {data}=await auth.getSession();return data?.user??null;}
async function audit(tx:any,userId:string,action:string,type:string,id:string,data:unknown){
 await tx`INSERT INTO audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,after_data)
 SELECT id,${userId},${action},${type},${id},${JSON.stringify(data)}::jsonb FROM organizations WHERE slug=${ORG}`;
}
async function orgId(tx:any){const r=await tx`SELECT id FROM organizations WHERE slug=${ORG}`;if(!r.length)throw new Error('Organisasi tidak ditemukan.');return r[0].id;}
async function makeJournal(tx:any,userId:string,args:{date:string;description:string;reference:string;source:string;party:string|null;unit:string|null;currency:string;rate:number;lines:{account:string;description:string;debit:number;credit:number;costCenter?:string|null;project?:string|null;taxCode?:string|null}[]}){
 const oid=await orgId(tx);
 const period=await tx`SELECT id,status FROM finance_periods WHERE organization_id=${oid} AND ${args.date}::date BETWEEN start_date AND end_date LIMIT 1`;
 if(period.length&&period[0].status!=='open')throw new Error('Periode akuntansi pada tanggal transaksi sudah ditutup.');
 const debit=round(args.lines.reduce((a,l)=>a+l.debit,0)),credit=round(args.lines.reduce((a,l)=>a+l.credit,0));
 if(debit<=0||debit!==credit||args.lines.length<2)throw new Error('Jurnal otomatis tidak seimbang.');
 const number='JRN-'+args.date.replace(/-/g,'')+'-'+crypto.randomUUID().slice(0,8).toUpperCase();
 const h=await tx`INSERT INTO finance_journals(organization_id,journal_number,journal_date,document_date,reference_no,description,journal_type,source_module_code,business_unit_id,party_id,currency,exchange_rate,period_id,created_by,status,approved_by,approved_at)
 VALUES(${oid},${number},${args.date}::date,${args.date}::date,${args.reference},${args.description},'general',${args.source},${args.unit}::uuid,${args.party}::uuid,${args.currency},${args.rate},${period[0]?.id||null},${userId},'approved',${userId},now()) RETURNING id,journal_number`;
 for(const line of args.lines){
  await tx`INSERT INTO finance_journal_lines(organization_id,journal_id,account_id,description,debit,credit,business_unit_id,cost_center_id,project_id,party_id,tax_code,source_module_code)
  VALUES(${oid},${h[0].id},${line.account}::uuid,${line.description},${line.debit},${line.credit},${args.unit}::uuid,${line.costCenter||null}::uuid,${line.project||null}::uuid,${args.party}::uuid,${line.taxCode||null},${args.source})`;
 }
 await tx`UPDATE finance_journals SET status='posted',posted_by=${userId},posted_at=now() WHERE id=${h[0].id}`;
 const bt=await tx`INSERT INTO business_transactions(organization_id,business_unit_id,module_code,transaction_type,reference_no,description,transaction_date,status,amount,currency,source_table,source_id,party_id,created_by)
 VALUES(${oid},${args.unit}::uuid,${args.source},'finance_posting',${args.reference},${args.description},${args.date}::date,'posted',${debit},${args.currency},'finance_journals',${h[0].id},${args.party}::uuid,${userId}) RETURNING id`;
 await tx`UPDATE finance_journals SET business_transaction_id=${bt[0].id} WHERE id=${h[0].id}`;
 await audit(tx,userId,'post','finance_journal',h[0].id,{journal_number:number,debit,credit,source:args.source});
 return {id:h[0].id,number};
}

export async function GET(req:Request){
 const u=await currentUser();if(!u)return fail('Unauthorized',401);
 const url=new URL(req.url),view=url.searchParams.get('view')||'documents',type=url.searchParams.get('type')||'sales_invoice';
 const db:any=getSql();
 try{
  if(view==='documents'||view==='ar-aging'||view==='ap-aging'){
   const permission=type==='purchase_bill'?'finance.ap.read':'finance.ar.read';
   if(!(await hasPermission(u.id,permission)))return fail('Forbidden',403);
   const types= view==='ar-aging'?['sales_invoice']:view==='ap-aging'?['purchase_bill']:[type];
   const docs=await db`SELECT d.id,d.document_type,d.document_number,d.external_reference,d.document_date,d.due_date,d.party_id,p.display_name party_name,d.source_module_code,d.business_unit_id,d.project_id,d.currency,d.subtotal,d.discount_total,d.tax_total,d.total_amount,d.settled_amount,(d.total_amount-d.settled_amount)::numeric(18,2) outstanding,d.status,d.journal_id,d.created_at
    FROM finance_documents d JOIN parties p ON p.id=d.party_id AND p.organization_id=d.organization_id
    WHERE d.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND d.document_type=ANY(${types}::text[])
    ORDER BY d.document_date DESC,d.created_at DESC LIMIT 500`;
   if(view==='ar-aging'||view==='ap-aging'){
    const aging=docs.map((d:any)=>{const days=Math.max(0,Math.floor((Date.now()-new Date(d.due_date+'T00:00:00Z').getTime())/86400000));return {...d,aging_bucket:days===0?'Belum jatuh tempo':days<=30?'1–30 hari':days<=60?'31–60 hari':days<=90?'61–90 hari':'>90 hari'};});
    return NextResponse.json({documents:aging,view});
   }
   const settlements=await db`SELECT id,settlement_type,settlement_number,settlement_date,party_id,amount,currency,status,journal_id FROM finance_settlements WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY settlement_date DESC LIMIT 200`;
   return NextResponse.json({documents:docs,settlements});
  }
  if(view==='cash-bank'){
   if(!(await hasPermission(u.id,'finance.cash.read')))return fail('Forbidden',403);
   const [banks,reconciliations,settlements]=await Promise.all([
    db`SELECT b.id,b.bank_name,b.account_name,b.account_number_masked,b.currency,b.account_id,a.code account_code,a.name account_name_gl FROM finance_bank_accounts b JOIN finance_accounts a ON a.id=b.account_id AND a.organization_id=b.organization_id WHERE b.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY b.bank_name`,
    db`SELECT r.*,b.bank_name,b.account_name FROM finance_bank_reconciliations r JOIN finance_bank_accounts b ON b.id=r.bank_account_id AND b.organization_id=r.organization_id WHERE r.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY r.statement_end DESC LIMIT 100`,
    db`SELECT s.*,p.display_name party_name,b.bank_name FROM finance_settlements s JOIN parties p ON p.id=s.party_id AND p.organization_id=s.organization_id JOIN finance_bank_accounts b ON b.id=s.bank_account_id AND b.organization_id=s.organization_id WHERE s.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY s.settlement_date DESC LIMIT 200`
   ]);
   return NextResponse.json({banks,reconciliations,settlements});
  }
  return fail('View subledger tidak dikenal.',404);
 }catch(error){console.error('finance subledger GET',error);return fail('Gagal memuat subledger.',503);}
}

export async function POST(req:Request){
 const origin=req.headers.get('origin'),host=req.headers.get('host');
 if(origin){try{if(!host||new URL(origin).host!==host)return fail('Invalid request origin.',403);}catch{return fail('Invalid request origin.',403);}}
 const u=await currentUser();if(!u)return fail('Unauthorized',401);
 let b:Record<string,unknown>;try{b=await req.json();}catch{return fail('Invalid JSON.');}
 const action=s(b.action,60),db:any=getSql();
 try{
  if(action==='create-document'){
   const type=s(b.document_type,40),isAR=type==='sales_invoice',isAP=type==='purchase_bill';
   if(!isAR&&!isAP)return fail('Jenis dokumen belum didukung.');
   if(!(await hasPermission(u.id,isAR?'finance.ar.manage':'finance.ap.manage')))return fail('Forbidden',403);
   const docDate=s(b.document_date,10),dueDate=s(b.due_date,10),party=s(b.party_id,80),control=s(b.control_account_id,80);
   const source=s(b.source_module_code,30)||'ENTERPRISE',unit=s(b.business_unit_id,80)||null,project=s(b.project_id,80)||null,currency=s(b.currency,3)||'IDR',rate=n(b.exchange_rate)||1;
   const lines=Array.isArray(b.lines)?b.lines as Record<string,unknown>[]:[];
   if(!s(b.document_number,60)||!dateOk(docDate)||!dateOk(dueDate)||dueDate<docDate||!party||!control||!lines.length||lines.length>100||!Number.isFinite(rate)||rate<=0)return fail('Header dokumen atau detail baris tidak valid.');
   const normalized=lines.map((l)=>{const qty=n(l.quantity),price=n(l.unit_price),discount=n(l.discount_amount),taxCode=s(l.tax_code_id,80)||null,account=s(l.account_id,80),base=round(qty*price-discount);return {description:s(l.description,500),quantity:qty,unit:s(l.unit,24)||'unit',unit_price:price,discount_amount:discount,tax_code_id:taxCode,account_id:account,cost_center_id:s(l.cost_center_id,80)||null,project_id:s(l.project_id,80)||project,tax_base:base};});
   if(normalized.some(l=>!l.description||!l.account_id||!Number.isFinite(l.quantity)||l.quantity<=0||!Number.isFinite(l.unit_price)||l.unit_price<0||!Number.isFinite(l.discount_amount)||l.discount_amount<0||l.discount_amount>l.quantity*l.unit_price))return fail('Ada detail item dengan kuantitas, harga, diskon atau akun tidak valid.');
   const result=await db.begin(async(tx:any)=>{
    const oid=await orgId(tx);
    const parties=await tx`SELECT id FROM parties WHERE id=${party}::uuid AND organization_id=${oid} AND deleted_at IS NULL AND status='active'`;if(!parties.length)throw new Error('Pelanggan/pemasok tidak valid.');
    const controlRows=await tx`SELECT id,account_type,is_active,is_postable FROM finance_accounts WHERE id=${control}::uuid AND organization_id=${oid}`;
    if(!controlRows.length||!controlRows[0].is_active||!controlRows[0].is_postable||controlRows[0].account_type!==(isAR?'asset':'liability'))throw new Error('Akun kontrol piutang/utang harus aktif, posting, dan bertipe sesuai.');
    const accountIds=[...new Set(normalized.map(l=>l.account_id))];
    const accountRows=await tx`SELECT id,account_type,is_active,is_postable FROM finance_accounts WHERE organization_id=${oid} AND id=ANY(${accountIds}::uuid[])`;
    if(accountRows.length!==accountIds.length||accountRows.some((a:any)=>!a.is_active||!a.is_postable||!(isAR?a.account_type==='revenue':['expense','asset'].includes(a.account_type))))throw new Error('Akun baris harus aktif dan sesuai jenis invoice/tagihan.');
    const taxIds=[...new Set(normalized.map(l=>l.tax_code_id).filter(Boolean))];
    const taxes=taxIds.length?await tx`SELECT id,rate,tax_type,tax_account_id,is_active,effective_from,effective_to FROM finance_tax_codes WHERE organization_id=${oid} AND id=ANY(${taxIds}::uuid[])`:[];
    if(taxes.length!==taxIds.length||taxes.some((t:any)=>!t.is_active||t.tax_type!==(isAR?'vat_out':'vat_in')))throw new Error('Kode pajak tidak aktif atau jenis pajak tidak cocok.');
    const taxById=new Map(taxes.map((t:any)=>[t.id,t]));
    let subtotal=0,taxTotal=0,discountTotal=0;
    for(const l of normalized){const tax:any=l.tax_code_id?taxById.get(l.tax_code_id):null;if(tax&&((tax.effective_from&&docDate<tax.effective_from)||(tax.effective_to&&docDate>tax.effective_to)))throw new Error('Kode pajak tidak berlaku pada tanggal dokumen.');const amount=tax?round(l.tax_base*Number(tax.rate)/100):0;(l as any).tax_amount=amount;(l as any).line_total=round(l.tax_base+amount);(l as any).tax_account_id=tax?.tax_account_id||null;if(amount>0&&!tax?.tax_account_id)throw new Error('Akun pajak pada kode pajak belum dikonfigurasi.');subtotal=round(subtotal+l.tax_base);taxTotal=round(taxTotal+amount);discountTotal=round(discountTotal+l.discount_amount);}
    const total=round(subtotal+taxTotal),number=s(b.document_number,60);
    const h=await tx`INSERT INTO finance_documents(organization_id,document_type,document_number,external_reference,document_date,due_date,party_id,source_module_code,business_unit_id,project_id,currency,exchange_rate,receivable_payable_account_id,subtotal,discount_total,tax_total,total_amount,notes,created_by)
     VALUES(${oid},${type},${number},${s(b.external_reference,100)||null},${docDate}::date,${dueDate}::date,${party}::uuid,${source},${unit}::uuid,${project}::uuid,${currency},${rate},${control}::uuid,${subtotal},${discountTotal},${taxTotal},${total},${s(b.notes,2000)||null},${u.id}) RETURNING id,document_number,status,total_amount`;
    for(let i=0;i<normalized.length;i++){const l:any=normalized[i];await tx`INSERT INTO finance_document_lines(organization_id,document_id,line_number,description,quantity,unit,unit_price,discount_amount,tax_code_id,account_id,cost_center_id,project_id,tax_base,tax_amount,line_total)
     VALUES(${oid},${h[0].id},${i+1},${l.description},${l.quantity},${l.unit},${l.unit_price},${l.discount_amount},${l.tax_code_id}::uuid,${l.account_id}::uuid,${l.cost_center_id}::uuid,${l.project_id}::uuid,${l.tax_base},${l.tax_amount},${l.line_total})`;}
    await audit(tx,u.id,'create','finance_document',h[0].id,{document_type:type,document_number:number,total});
    return h[0];
   });
   return NextResponse.json({document:result},{status:201});
  }
  if(['submit-document','approve-document','post-document'].includes(action)){
   const id=s(b.id,80);
   const header=await db`SELECT d.*,p.display_name party_name FROM finance_documents d JOIN parties p ON p.id=d.party_id AND p.organization_id=d.organization_id WHERE d.id=${id}::uuid AND d.organization_id=(SELECT id FROM organizations WHERE slug=${ORG})`;
   if(!header.length)return fail('Dokumen tidak ditemukan.',404);
   const isAR=header[0].document_type==='sales_invoice';
   if(!(await hasPermission(u.id,isAR?'finance.ar.manage':'finance.ap.manage')))return fail('Forbidden',403);
   const result=await db.begin(async(tx:any)=>{
    const rows=await tx`SELECT * FROM finance_documents WHERE id=${id}::uuid AND organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) FOR UPDATE`;if(!rows.length)throw new Error('Dokumen tidak ditemukan.');
    const d=rows[0];let next='';
    if(action==='submit-document'&&d.status==='draft')next='submitted';
    else if(action==='approve-document'&&d.status==='submitted')next='approved';
    else if(action==='post-document'&&d.status==='approved')next='posted';
    else throw new Error('Transisi status dokumen tidak diizinkan.');
    let journal=null;
    if(next==='posted'){
     const oid=await orgId(tx);
     const lines=await tx`SELECT l.*,t.tax_account_id,t.code tax_code FROM finance_document_lines l LEFT JOIN finance_tax_codes t ON t.id=l.tax_code_id AND t.organization_id=l.organization_id WHERE l.document_id=${id}::uuid AND l.organization_id=${oid} ORDER BY l.line_number`;
     const grouped=new Map<string,{net:number;debit:number;credit:number;desc:string;costCenter:string|null;project:string|null;taxCode:string|null}>();
     for(const l of lines){const key=l.account_id;const g=grouped.get(key)||{net:0,debit:0,credit:0,desc:l.description,costCenter:l.cost_center_id,project:l.project_id,taxCode:l.tax_code};if(isAR)g.credit=round(g.credit+Number(l.tax_base));else g.debit=round(g.debit+Number(l.tax_base));grouped.set(key,g);}
     const journalLines:any[]=[];
     journalLines.push({account:d.receivable_payable_account_id,description:isAR?'Piutang pelanggan':'Utang pemasok',debit:isAR?Number(d.total_amount):0,credit:isAR?0:Number(d.total_amount)});
     for(const g of grouped.values())journalLines.push({account:[...grouped.entries()].find(([,v])=>v===g)?.[0],description:g.desc,debit:g.debit,credit:g.credit});
     const taxGroups=new Map<string,{amount:number;code:string}>();
     for(const l of lines){if(Number(l.tax_amount)>0){if(!l.tax_account_id)throw new Error('Akun pajak tidak dikonfigurasi.');const k=l.tax_account_id;const g=taxGroups.get(k)||{amount:0,code:l.tax_code||'TAX'};g.amount=round(g.amount+Number(l.tax_amount));taxGroups.set(k,g);}}
     for(const [account,g] of taxGroups)journalLines.push({account,description:'Pajak '+g.code,debit:isAR?0:g.amount,credit:isAR?g.amount:0,taxCode:g.code});
     journal=await makeJournal(tx,u.id,{date:String(d.document_date).slice(0,10),description:(isAR?'Invoice ':'Tagihan pemasok ')+d.document_number,reference:d.document_number,source:d.source_module_code||'ENTERPRISE',party:d.party_id,unit:d.business_unit_id,currency:d.currency,rate:Number(d.exchange_rate),lines:journalLines});
     await tx`UPDATE finance_documents SET journal_id=${journal.id},posted_at=now(),updated_at=now() WHERE id=${id}::uuid`;
    }
    await tx`UPDATE finance_documents SET status=${next},approved_by=CASE WHEN ${next}='approved' THEN ${u.id} ELSE approved_by END,approved_at=CASE WHEN ${next}='approved' THEN now() ELSE approved_at END,updated_at=now() WHERE id=${id}::uuid`;
    await audit(tx,u.id,next,'finance_document',id,{status:next,journal_id:journal?.id||null});
    return {id,status:next,journal};
   });
   return NextResponse.json({document:result});
  }
  if(action==='create-bank-account'){
   if(!(await hasPermission(u.id,'finance.cash.manage')))return fail('Forbidden',403);
   const account=s(b.account_id,80),bank=s(b.bank_name,120),name=s(b.account_name,120),masked=s(b.account_number_masked,40),currency=s(b.currency,3)||'IDR';
   if(!account||!bank||!name||!masked)return fail('Data rekening bank wajib dilengkapi.');
   const rows=await db`INSERT INTO finance_bank_accounts(organization_id,account_id,bank_name,account_name,account_number_masked,currency)
    SELECT o.id,${account}::uuid,${bank},${name},${masked},${currency} FROM organizations o JOIN finance_accounts a ON a.organization_id=o.id AND a.id=${account}::uuid AND a.account_type='asset' AND a.is_active AND a.is_postable WHERE o.slug=${ORG} RETURNING id,bank_name,account_name`;
   if(!rows.length)return fail('Akun GL bank tidak valid.',409);
   await audit(db,u.id,'create','finance_bank_account',rows[0].id,rows[0]);return NextResponse.json({bank:rows[0]},{status:201});
  }
  if(action==='create-settlement'){
   const type=s(b.settlement_type,40),isReceipt=type==='customer_receipt';if(!isReceipt&&type!=='supplier_payment')return fail('Jenis penerimaan/pembayaran tidak valid.');
   if(!(await hasPermission(u.id,'finance.cash.manage')))return fail('Forbidden',403);
   const date=s(b.settlement_date,10),party=s(b.party_id,80),bank=s(b.bank_account_id,80),amount=round(n(b.amount)),allocations=Array.isArray(b.allocations)?b.allocations as Record<string,unknown>[]:[];
   if(!dateOk(date)||!party||!bank||amount<=0||!allocations.length)return fail('Tanggal, pihak, rekening, jumlah, dan alokasi wajib diisi.');
   const result=await db.begin(async(tx:any)=>{
    const oid=await orgId(tx);
    const ba=await tx`SELECT b.id,b.account_id,b.currency FROM finance_bank_accounts b WHERE b.id=${bank}::uuid AND b.organization_id=${oid} AND b.is_active`;if(!ba.length)throw new Error('Rekening bank tidak valid.');
    const partyRow=await tx`SELECT id FROM parties WHERE id=${party}::uuid AND organization_id=${oid} AND status='active' AND deleted_at IS NULL`;if(!partyRow.length)throw new Error('Pihak tidak valid.');
    let allocTotal=0,controlAccount='';
    const normalized=allocations.map(a=>({document_id:s(a.document_id,80),amount:round(n(a.amount))}));
    for(const a of normalized){if(!a.document_id||a.amount<=0)throw new Error('Alokasi tidak valid.');
     const docs=await tx`SELECT id,document_type,party_id,total_amount,settled_amount,receivable_payable_account_id,status FROM finance_documents WHERE id=${a.document_id}::uuid AND organization_id=${oid} FOR UPDATE`;
     if(!docs.length)throw new Error('Dokumen alokasi tidak ditemukan.');const d=docs[0];
     if(d.party_id!==party||d.status!=='posted'||(isReceipt?d.document_type!=='sales_invoice':d.document_type!=='purchase_bill'))throw new Error('Pihak, jenis, atau status dokumen tidak cocok dengan penerimaan/pembayaran.');
     if(round(Number(d.total_amount)-Number(d.settled_amount))<a.amount)throw new Error('Alokasi melebihi saldo dokumen.');
     if(controlAccount&&controlAccount!==d.receivable_payable_account_id)throw new Error('Satu transaksi hanya boleh mengalokasikan dokumen dengan akun kontrol yang sama.');
     controlAccount=d.receivable_payable_account_id;allocTotal=round(allocTotal+a.amount);
    }
    if(allocTotal!==amount)throw new Error('Total alokasi harus sama persis dengan jumlah penerimaan/pembayaran.');
    const number=(isReceipt?'RCV-':'PAY-')+date.replace(/-/g,'')+'-'+crypto.randomUUID().slice(0,6).toUpperCase();
    const h=await tx`INSERT INTO finance_settlements(organization_id,settlement_type,settlement_number,settlement_date,party_id,bank_account_id,amount,currency,exchange_rate,payment_method,bank_reference,notes,created_by)
     VALUES(${oid},${type},${number},${date}::date,${party}::uuid,${bank}::uuid,${amount},${s(b.currency,3)||ba[0].currency},${n(b.exchange_rate)||1},${s(b.payment_method,40)||'bank_transfer'},${s(b.bank_reference,100)||null},${s(b.notes,1000)||null},${u.id}) RETURNING id,settlement_number,status`;
    for(const a of normalized)await tx`INSERT INTO finance_settlement_allocations(organization_id,settlement_id,document_id,amount) VALUES(${oid},${h[0].id},${a.document_id}::uuid,${a.amount})`;
    return h[0];
   });
   await audit(db,u.id,'create','finance_settlement',result.id,result);return NextResponse.json({settlement:result},{status:201});
  }
  if(action==='post-settlement'){
   if(!(await hasPermission(u.id,'finance.cash.manage')))return fail('Forbidden',403);
   const id=s(b.id,80);
   const result=await db.begin(async(tx:any)=>{
    const oid=await orgId(tx),rows=await tx`SELECT * FROM finance_settlements WHERE id=${id}::uuid AND organization_id=${oid} FOR UPDATE`;if(!rows.length)throw new Error('Penerimaan/pembayaran tidak ditemukan.');
    const srow=rows[0];if(srow.status!=='draft')throw new Error('Hanya transaksi draft yang dapat diposting.');
    const isReceipt=srow.settlement_type==='customer_receipt';
    const alloc=await tx`SELECT a.amount,d.id document_id,d.document_number,d.document_type,d.party_id,d.total_amount,d.settled_amount,d.receivable_payable_account_id,d.source_module_code,d.business_unit_id,d.currency,d.exchange_rate FROM finance_settlement_allocations a JOIN finance_documents d ON d.id=a.document_id AND d.organization_id=a.organization_id WHERE a.settlement_id=${id}::uuid AND a.organization_id=${oid} FOR UPDATE OF d`;
    if(!alloc.length||round(alloc.reduce((v:number,a:any)=>v+Number(a.amount),0))!==Number(srow.amount))throw new Error('Alokasi pembayaran tidak valid.');
    const control=alloc[0].receivable_payable_account_id;if(alloc.some((a:any)=>a.receivable_payable_account_id!==control||a.party_id!==srow.party_id))throw new Error('Alokasi harus satu pihak dan satu akun kontrol.');
    const bank=await tx`SELECT account_id FROM finance_bank_accounts WHERE id=${srow.bank_account_id}::uuid AND organization_id=${oid}`;
    const lines=[{account:bank[0].account_id,description:isReceipt?'Penerimaan pelanggan':'Pembayaran pemasok',debit:isReceipt?Number(srow.amount):0,credit:isReceipt?0:Number(srow.amount)},
     {account:control,description:isReceipt?'Pelunasan piutang':'Pelunasan utang',debit:isReceipt?0:Number(srow.amount),credit:isReceipt?Number(srow.amount):0}];
    const journal=await makeJournal(tx,u.id,{date:String(srow.settlement_date).slice(0,10),description:(isReceipt?'Penerimaan ':'Pembayaran ')+srow.settlement_number,reference:srow.settlement_number,source:'ENTERPRISE',party:srow.party_id,unit:null,currency:srow.currency,rate:Number(srow.exchange_rate),lines});
    for(const a of alloc){const newPaid=round(Number(a.settled_amount)+Number(a.amount));await tx`UPDATE finance_documents SET settled_amount=${newPaid},status=CASE WHEN ${newPaid}>=total_amount THEN 'paid' ELSE 'part_paid' END,updated_at=now() WHERE id=${a.document_id}::uuid`;}
    await tx`UPDATE finance_settlements SET status='posted',journal_id=${journal.id},posted_at=now() WHERE id=${id}::uuid`;
    await audit(tx,u.id,'post','finance_settlement',id,{journal_id:journal.id,amount:srow.amount});
    return {id,status:'posted',journal};
   });
   return NextResponse.json({settlement:result});
  }
  if(action==='create-reconciliation'){
   if(!(await hasPermission(u.id,'finance.cash.manage')))return fail('Forbidden',403);
   const bank=s(b.bank_account_id,80),start=s(b.statement_start,10),end=s(b.statement_end,10),opening=round(n(b.statement_opening)),closing=round(n(b.statement_closing)),items=Array.isArray(b.lines)?b.lines as Record<string,unknown>[]:[];
   if(!bank||!dateOk(start)||!dateOk(end)||end<start||!Number.isFinite(opening)||!Number.isFinite(closing))return fail('Header rekonsiliasi tidak valid.');
   const result=await db.begin(async(tx:any)=>{
    const oid=await orgId(tx),ba=await tx`SELECT id,account_id FROM finance_bank_accounts WHERE id=${bank}::uuid AND organization_id=${oid} AND is_active`;if(!ba.length)throw new Error('Rekening bank tidak valid.');
    const movements=await tx`SELECT coalesce(sum(l.debit-l.credit),0)::numeric(18,2) movement FROM finance_journal_lines l JOIN finance_journals j ON j.id=l.journal_id AND j.organization_id=l.organization_id WHERE l.organization_id=${oid} AND l.account_id=${ba[0].account_id} AND j.status='posted' AND j.journal_date BETWEEN ${start}::date AND ${end}::date`;
    const book=round(opening+Number(movements[0].movement)),difference=round(closing-book);
    const h=await tx`INSERT INTO finance_bank_reconciliations(organization_id,bank_account_id,statement_start,statement_end,statement_opening,statement_closing,book_closing,difference,status,notes,created_by)
     VALUES(${oid},${bank}::uuid,${start}::date,${end}::date,${opening},${closing},${book},${difference},'draft',${s(b.notes,1000)||null},${u.id}) RETURNING id,status,book_closing,difference`;
    for(const l of items){const d=s(l.transaction_date,10),debit=round(n(l.debit)),credit=round(n(l.credit));if(!dateOk(d)||d<start||d>end||((debit>0)===(credit>0)))throw new Error('Baris mutasi bank tidak valid.');await tx`INSERT INTO finance_bank_statement_lines(organization_id,bank_account_id,reconciliation_id,transaction_date,value_date,reference_no,description,debit,credit) VALUES(${oid},${bank}::uuid,${h[0].id},${d}::date,${dateOk(s(l.value_date,10))?s(l.value_date,10):null}::date,${s(l.reference_no,100)||null},${s(l.description,500)||null},${debit},${credit})`;}
    await audit(tx,u.id,'create','finance_bank_reconciliation',h[0].id,{book_closing:book,statement_closing:closing,difference});
    return h[0];
   });
   return NextResponse.json({reconciliation:result},{status:201});
  }
  if(action==='finalize-reconciliation'){
   if(!(await hasPermission(u.id,'finance.cash.manage')))return fail('Forbidden',403);
   const id=s(b.id,80),rows=await db`UPDATE finance_bank_reconciliations SET status='reconciled',finalized_by=${u.id},reconciled_at=now() WHERE id=${id}::uuid AND organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND status IN ('draft','in_review') AND difference=0 RETURNING id,status,difference`;
   if(!rows.length)return fail('Rekonsiliasi hanya dapat difinalisasi jika selisih tepat nol.',409);
   await audit(db,u.id,'reconcile','finance_bank_reconciliation',id,rows[0]);return NextResponse.json({reconciliation:rows[0]});
  }
  return fail('Operasi subledger tidak dikenal.',404);
 }catch(error){const message=error instanceof Error?error.message:'Operasi subledger gagal.';console.error('finance subledger POST',error);return fail(message,409);}
}
