import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { hasPermission } from '@/lib/auth/permissions';
import { getSql } from '@/lib/db';
export const dynamic='force-dynamic';
const ORG='rundingan-kreasi-media';
const fail=(message:string,status=400)=>NextResponse.json({error:message},{status});
const str=(b:Record<string,unknown>,k:string,max=200)=>typeof b[k]==='string'?(b[k] as string).trim().slice(0,max):'';
async function actor(){const {data}=await auth.getSession();return data?.user??null;}
async function audit(db:any,userId:string,action:string,type:string,id:string,data:Record<string,unknown>){await db`INSERT INTO audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,after_data) SELECT id,${userId},${action},${type},${id},${JSON.stringify(data)}::jsonb FROM organizations WHERE slug=${ORG}`;}

export async function GET(){
 const user=await actor();if(!user)return fail('Unauthorized',401);
 if(!(await hasPermission(user.id,'inventory.items.read')))return fail('Forbidden',403);
 const db:any=getSql();
 try{
  const [items,categories,requests,orders,orderLines,receipts,accounts,locations,parties]=await Promise.all([
   db`SELECT i.id,i.sku,i.name,i.unit,i.item_type,i.minimum_stock,i.reorder_quantity,i.category_id,i.inventory_account_id,i.expense_account_id,i.cogs_account_id,i.is_active,coalesce(sum(CASE WHEN m.movement_type IN('opening','in') THEN m.quantity WHEN m.movement_type='out' THEN -m.quantity ELSE 0 END),0)::numeric(18,3) AS stock FROM inventory_items i JOIN organizations o ON o.id=i.organization_id LEFT JOIN inventory_movements m ON m.item_id=i.id AND m.organization_id=i.organization_id WHERE o.slug=${ORG} GROUP BY i.id ORDER BY i.name`,
   db`SELECT id,code,name,parent_id,is_active FROM inventory_categories WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY code`,
   await hasPermission(user.id,'procurement.requests.read')?db`SELECT p.id,p.request_number,p.description,p.estimated_total,p.status,p.needed_by,pa.display_name AS supplier_name FROM procurement_requests p JOIN organizations o ON o.id=p.organization_id LEFT JOIN parties pa ON pa.id=p.supplier_party_id AND pa.organization_id=p.organization_id WHERE o.slug=${ORG} ORDER BY p.created_at DESC LIMIT 300`:[],
   await hasPermission(user.id,'procurement.orders.read')?db`SELECT po.id,po.po_number,po.order_date,po.expected_date,po.status,pa.display_name AS supplier_name,coalesce(sum(pol.line_total),0)::numeric(18,2) AS total FROM purchase_orders po JOIN organizations o ON o.id=po.organization_id JOIN parties pa ON pa.id=po.supplier_party_id AND pa.organization_id=po.organization_id LEFT JOIN purchase_order_lines pol ON pol.purchase_order_id=po.id AND pol.organization_id=po.organization_id WHERE o.slug=${ORG} GROUP BY po.id,pa.display_name ORDER BY po.order_date DESC LIMIT 300`:[],
   await hasPermission(user.id,'procurement.orders.read')?db`SELECT pol.id,pol.purchase_order_id,pol.item_id,pol.description,pol.quantity,pol.received_quantity,pol.unit_price,po.po_number,i.sku,i.name AS item_name FROM purchase_order_lines pol JOIN organizations o ON o.id=pol.organization_id JOIN purchase_orders po ON po.id=pol.purchase_order_id AND po.organization_id=pol.organization_id LEFT JOIN inventory_items i ON i.id=pol.item_id AND i.organization_id=pol.organization_id WHERE o.slug=${ORG} ORDER BY po.order_date DESC`:[],
   await hasPermission(user.id,'procurement.orders.read')?db`SELECT gr.id,gr.receipt_number,gr.status,gr.received_at,po.po_number,count(gl.id)::int AS line_count FROM goods_receipts gr JOIN organizations o ON o.id=gr.organization_id JOIN purchase_orders po ON po.id=gr.purchase_order_id AND po.organization_id=gr.organization_id LEFT JOIN goods_receipt_lines gl ON gl.goods_receipt_id=gr.id AND gl.organization_id=gr.organization_id WHERE o.slug=${ORG} GROUP BY gr.id,po.po_number ORDER BY gr.received_at DESC LIMIT 300`:[],
   db`SELECT id,code,name,account_type,is_active FROM finance_accounts WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND is_active AND is_postable ORDER BY code`,
   db`SELECT id,code,name,location_type FROM locations WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND deleted_at IS NULL ORDER BY name`,
   db`SELECT id,display_name FROM parties WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND deleted_at IS NULL ORDER BY display_name LIMIT 500`
  ]);
  return NextResponse.json({items,categories,requests,orders,orderLines,receipts,accounts,locations,parties});
 }catch{return fail('Data inventaris/pengadaan lanjutan belum tersedia. Periksa migrasi 010.',503);}
}

export async function POST(req:Request){
 const origin=req.headers.get('origin'),host=req.headers.get('host');if(origin){try{if(!host||new URL(origin).host!==host)return fail('Invalid request origin.',403);}catch{return fail('Invalid request origin.',403);}}
 const user=await actor();if(!user)return fail('Unauthorized',401);
 let b:Record<string,unknown>;try{b=await req.json();}catch{return fail('Invalid JSON body.');}
 const action=str(b,'action',50),db:any=getSql();
 try{
  if(action==='category'){
   if(!(await hasPermission(user.id,'inventory.categories.manage')))return fail('Forbidden',403);
   const code=str(b,'code',40).toUpperCase(),name=str(b,'name',120),parent=str(b,'parent_id',80)||null;
   if(!code||!name)return fail('Kode dan nama kategori wajib diisi.');
   const rows=await db`INSERT INTO inventory_categories(organization_id,code,name,parent_id) SELECT id,${code},${name},${parent}::uuid FROM organizations WHERE slug=${ORG} AND (${parent}::uuid IS NULL OR EXISTS(SELECT 1 FROM inventory_categories c WHERE c.id=${parent}::uuid AND c.organization_id=organizations.id AND c.is_active)) RETURNING id,code,name`;
   if(!rows.length)return fail('Kategori induk tidak valid.',409);await audit(db,user.id,'create','inventory_category',String(rows[0].id),{code,name});return NextResponse.json({category:rows[0]},{status:201});
  }
  if(action==='item_update'){
   if(!(await hasPermission(user.id,'inventory.items.update'))&&!(await hasPermission(user.id,'inventory.items.manage')))return fail('Forbidden',403);
   const id=str(b,'item_id',80),name=str(b,'name',180),unit=str(b,'unit',20)||'pcs',category=str(b,'category_id',80)||null;
   const min=Number(b.minimum_stock??0),reorder=Number(b.reorder_quantity??0);
   const inventory=str(b,'inventory_account_id',80)||null,expense=str(b,'expense_account_id',80)||null,cogs=str(b,'cogs_account_id',80)||null;
   if(!id||!name||!Number.isFinite(min)||min<0||!Number.isFinite(reorder)||reorder<0)return fail('Data barang tidak valid.');
   const rows=await db`UPDATE inventory_items i SET name=${name},unit=${unit},category_id=${category}::uuid,minimum_stock=${min},reorder_quantity=${reorder},inventory_account_id=${inventory}::uuid,expense_account_id=${expense}::uuid,cogs_account_id=${cogs}::uuid,updated_at=NOW() FROM organizations o WHERE i.organization_id=o.id AND o.slug=${ORG} AND i.id=${id}::uuid AND (${category}::uuid IS NULL OR EXISTS(SELECT 1 FROM inventory_categories c WHERE c.id=${category}::uuid AND c.organization_id=o.id AND c.is_active)) RETURNING i.id,i.sku,i.name,i.is_active`;
   if(!rows.length)return fail('Barang atau kategori tidak valid.',409);await audit(db,user.id,'update','inventory_item',id,{name,category_id:category,minimum_stock:min,reorder_quantity:reorder});return NextResponse.json({item:rows[0]});
  }
  if(action==='item_status'){
   if(!(await hasPermission(user.id,'inventory.items.manage')))return fail('Forbidden',403);
   const id=str(b,'item_id',80),active=b.is_active===true;
   const rows=await db`UPDATE inventory_items i SET is_active=${active},updated_at=NOW() FROM organizations o WHERE i.organization_id=o.id AND o.slug=${ORG} AND i.id=${id}::uuid RETURNING i.id,i.sku,i.is_active`;
   if(!rows.length)return fail('Barang tidak ditemukan atau sudah memiliki riwayat stok; gunakan status nonaktif melalui prosedur pengendalian.',409);await audit(db,user.id,'update_status','inventory_item',id,{is_active:active});return NextResponse.json({item:rows[0]});
  }
  if(action==='request_with_lines'){
   if(!(await hasPermission(user.id,'procurement.requests.manage')))return fail('Forbidden',403);
   const desc=str(b,'description',1000),supplier=str(b,'supplier_party_id',80)||null,needed=str(b,'needed_by',10)||null,lines=Array.isArray(b.lines)?b.lines as Record<string,unknown>[]:[];
   if(!desc||!lines.length||lines.length>200)return fail('Permintaan harus memiliki uraian dan 1–200 baris barang.');
   const parsed=lines.map(x=>({item_id:String(x.item_id||''),description:String(x.description||'').slice(0,300),quantity:Number(x.quantity),price:Number(x.estimated_unit_price||0)}));
   if(parsed.some(x=>!x.description||!Number.isFinite(x.quantity)||x.quantity<=0||!Number.isFinite(x.price)||x.price<0))return fail('Rincian permintaan tidak valid.');
   const total=parsed.reduce((sum,x)=>sum+x.quantity*x.price,0);
   const result=await db.begin(async(tx:any)=>{
    const org=await tx`SELECT id FROM organizations WHERE slug=${ORG}`;if(!org.length)throw new Error('Organisasi tidak ditemukan.');
    if(supplier){const p=await tx`SELECT id FROM parties WHERE id=${supplier}::uuid AND organization_id=${org[0].id} AND deleted_at IS NULL`;if(!p.length)throw new Error('Pemasok tidak valid.');}
    const no='PR-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+crypto.randomUUID().slice(0,6).toUpperCase();
    const reqRows=await tx`INSERT INTO procurement_requests(organization_id,request_number,requested_by,supplier_party_id,description,estimated_total,needed_by) VALUES(${org[0].id},${no},${user.id},${supplier}::uuid,${desc},${total},${needed}::date) RETURNING id,request_number`;
    for(const line of parsed){if(line.item_id){const it=await tx`SELECT id FROM inventory_items WHERE id=${line.item_id}::uuid AND organization_id=${org[0].id} AND is_active`;if(!it.length)throw new Error('Item pada permintaan tidak valid.');}
     await tx`INSERT INTO procurement_request_lines(organization_id,request_id,item_id,description,quantity,estimated_unit_price) VALUES(${org[0].id},${reqRows[0].id},${line.item_id||null}::uuid,${line.description},${line.quantity},${line.price})`;}
    const bt=await tx`INSERT INTO business_transactions(organization_id,module_code,transaction_type,reference_no,description,party_id,transaction_date,status,amount,source_table,source_id,created_by) VALUES(${org[0].id},'ENTERPRISE','procurement',${no},${desc},${supplier}::uuid,coalesce(${needed}::date,CURRENT_DATE),'draft',${total},'procurement_requests',${reqRows[0].id}::text,${user.id}) RETURNING id`;
    await tx`UPDATE procurement_requests SET business_transaction_id=${bt[0].id} WHERE id=${reqRows[0].id}`;
    return {id:reqRows[0].id,request_number:no,total};
   });
   await audit(db,user.id,'create','procurement_request',String(result.id),{request_number:result.request_number,total});return NextResponse.json({request:result},{status:201});
  }
  if(action==='purchase_order'){
   if(!(await hasPermission(user.id,'procurement.orders.manage')))return fail('Forbidden',403);
   const supplier=str(b,'supplier_party_id',80),request=str(b,'request_id',80)||null,expected=str(b,'expected_date',10)||null,notes=str(b,'notes',1000),lines=Array.isArray(b.lines)?b.lines as Record<string,unknown>[]:[];
   const parsed=lines.map(x=>({item_id:String(x.item_id||''),description:String(x.description||'').slice(0,300),quantity:Number(x.quantity),price:Number(x.unit_price)}));
   if(!supplier||!parsed.length||parsed.length>200||parsed.some(x=>!x.description||!Number.isFinite(x.quantity)||x.quantity<=0||!Number.isFinite(x.price)||x.price<0))return fail('Supplier dan rincian PO wajib valid.');
   const result=await db.begin(async(tx:any)=>{
    const org=await tx`SELECT id FROM organizations WHERE slug=${ORG}`;if(!org.length)throw new Error('Organisasi tidak ditemukan.');
    const party=await tx`SELECT id FROM parties WHERE id=${supplier}::uuid AND organization_id=${org[0].id} AND deleted_at IS NULL`;if(!party.length)throw new Error('Supplier tidak valid.');
    if(request){const rq=await tx`SELECT id,supplier_party_id FROM procurement_requests WHERE id=${request}::uuid AND organization_id=${org[0].id} AND status='approved'`;if(!rq.length)throw new Error('Permintaan sumber harus disetujui.');}
    const no='PO-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+crypto.randomUUID().slice(0,6).toUpperCase();
    const header=await tx`INSERT INTO purchase_orders(organization_id,request_id,po_number,supplier_party_id,expected_date,notes,created_by) VALUES(${org[0].id},${request}::uuid,${no},${supplier}::uuid,${expected}::date,${notes||null},${user.id}) RETURNING id,po_number,status`;
    let total=0;
    for(const line of parsed){if(line.item_id){const it=await tx`SELECT id FROM inventory_items WHERE id=${line.item_id}::uuid AND organization_id=${org[0].id} AND is_active`;if(!it.length)throw new Error('Item PO tidak valid.');}
     await tx`INSERT INTO purchase_order_lines(organization_id,purchase_order_id,item_id,description,quantity,unit_price) VALUES(${org[0].id},${header[0].id},${line.item_id||null}::uuid,${line.description},${line.quantity},${line.price})`;total+=line.quantity*line.price;}
    const bt=await tx`INSERT INTO business_transactions(organization_id,module_code,transaction_type,reference_no,description,party_id,transaction_date,status,amount,source_table,source_id,created_by) VALUES(${org[0].id},'ENTERPRISE','purchase_order',${no},'Purchase order ' || ${no},${supplier}::uuid,CURRENT_DATE,'draft',${total},'purchase_orders',${header[0].id}::text,${user.id}) RETURNING id`;
    await tx`UPDATE purchase_orders SET business_transaction_id=${bt[0].id} WHERE id=${header[0].id}`;
    return {id:header[0].id,po_number:no,total};
   });
   await audit(db,user.id,'create','purchase_order',String(result.id),{po_number:result.po_number,total:result.total});return NextResponse.json({purchaseOrder:result},{status:201});
  }
  if(action==='purchase_order_status'){
   if(!(await hasPermission(user.id,'procurement.orders.manage')))return fail('Forbidden',403);
   const id=str(b,'purchase_order_id',80),next=str(b,'status',30);
   if(!['submitted','approved','cancelled'].includes(next))return fail('Status PO tidak valid.');
   const rows=await db`UPDATE purchase_orders po SET status=${next},approved_by=CASE WHEN ${next}='approved' THEN ${user.id} ELSE approved_by END,approved_at=CASE WHEN ${next}='approved' THEN NOW() ELSE approved_at END,updated_at=NOW() FROM organizations o WHERE po.organization_id=o.id AND o.slug=${ORG} AND po.id=${id}::uuid AND ((po.status='draft' AND ${next} IN('submitted','cancelled')) OR (po.status='submitted' AND ${next} IN('approved','cancelled'))) RETURNING po.id,po.po_number,po.status,po.business_transaction_id`;
   if(!rows.length)return fail('Transisi PO tidak diizinkan.',409);
   if(rows[0].business_transaction_id)await db`UPDATE business_transactions SET status=${next==='approved'?'approved':next==='submitted'?'pending':'cancelled'},updated_at=NOW() WHERE id=${rows[0].business_transaction_id}`;
   await audit(db,user.id,'update_status','purchase_order',id,{status:next});return NextResponse.json({purchaseOrder:rows[0]});
  }
  if(action==='goods_receipt'){
   if(!(await hasPermission(user.id,'procurement.orders.manage')))return fail('Forbidden',403);
   const po=str(b,'purchase_order_id',80),notes=str(b,'notes',1000),lines=Array.isArray(b.lines)?b.lines as Record<string,unknown>[]:[];
   if(!po||!lines.length||lines.length>200)return fail('Pilih PO dan minimal satu baris penerimaan.');
   const parsed=lines.map(x=>({po_line_id:String(x.purchase_order_line_id||''),item_id:String(x.item_id||''),location_id:String(x.location_id||''),quantity:Number(x.quantity),unit_cost:Number(x.unit_cost)}));
   if(parsed.some(x=>!x.po_line_id||!x.item_id||!Number.isFinite(x.quantity)||x.quantity<=0||!Number.isFinite(x.unit_cost)||x.unit_cost<0))return fail('Rincian penerimaan tidak valid.');
   const result=await db.begin(async(tx:any)=>{
    const org=await tx`SELECT id FROM organizations WHERE slug=${ORG}`;if(!org.length)throw new Error('Organisasi tidak ditemukan.');
    const order=await tx`SELECT id,po_number,status FROM purchase_orders WHERE id=${po}::uuid AND organization_id=${org[0].id} AND status IN('approved','partially_received') FOR UPDATE`;if(!order.length)throw new Error('PO belum disetujui atau tidak valid.');
    const no='GR-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+crypto.randomUUID().slice(0,6).toUpperCase();
    const header=await tx`INSERT INTO goods_receipts(organization_id,purchase_order_id,receipt_number,notes,created_by) VALUES(${org[0].id},${po}::uuid,${no},${notes||null},${user.id}) RETURNING id,receipt_number,status`;
    for(const line of parsed){
     const poLine=await tx`SELECT id,item_id,quantity,received_quantity FROM purchase_order_lines WHERE id=${line.po_line_id}::uuid AND organization_id=${org[0].id} AND purchase_order_id=${po}::uuid FOR UPDATE`;
     if(!poLine.length||String(poLine[0].item_id)!==line.item_id||Number(poLine[0].received_quantity)+line.quantity>Number(poLine[0].quantity))throw new Error('Jumlah penerimaan melebihi sisa PO atau item tidak cocok.');
     const loc=line.location_id?await tx`SELECT id FROM locations WHERE id=${line.location_id}::uuid AND organization_id=${org[0].id} AND deleted_at IS NULL`:[{id:null}];if(!loc.length)throw new Error('Lokasi penerimaan tidak valid.');
     await tx`INSERT INTO goods_receipt_lines(organization_id,goods_receipt_id,purchase_order_line_id,item_id,location_id,quantity,unit_cost) VALUES(${org[0].id},${header[0].id},${line.po_line_id}::uuid,${line.item_id}::uuid,${line.location_id||null}::uuid,${line.quantity},${line.unit_cost})`;
    }
    return {id:header[0].id,receipt_number:no,status:'draft'};
   });
   await audit(db,user.id,'create','goods_receipt',String(result.id),{receipt_number:result.receipt_number,purchase_order_id:po});return NextResponse.json({goodsReceipt:result},{status:201});
  }
  return fail('Aksi inventaris/pengadaan tidak dikenal.',404);
 }catch(error){const message=error instanceof Error?error.message:'Operasi gagal.';return fail(message,409);}
}
