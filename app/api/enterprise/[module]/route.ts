import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { hasPermission } from '@/lib/auth/permissions';
import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';
const ORG='rundingan-kreasi-media';
type Module='rental'|'production'|'academy';
const err=(message:string,status=400)=>NextResponse.json({error:message},{status});
const str=(b:Record<string,unknown>,k:string,max=500)=>typeof b[k]==='string'?(b[k] as string).trim().slice(0,max):'';
const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(new Date(v+'T00:00:00Z').getTime())&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const validMoney=(v:unknown)=>{const n=Number(v),cents=Math.round(n*100);return Number.isFinite(n)&&n>=0&&Number.isFinite(cents)&&Math.abs(n*100-cents)<1e-7?cents/100:NaN;};
async function user(){const {data}=await auth.getSession();return data?.user??null;}
async function audit(db:any,actor:string,action:string,resource:string,id:string,data:Record<string,unknown>){await db`INSERT INTO audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,after_data) SELECT id,${actor},${action},${resource},${id},${JSON.stringify(data)}::jsonb FROM organizations WHERE slug=${ORG}`;}
async function moduleContext(ctx:{params:Promise<{module:string}>}){const {module}=await ctx.params;return ['rental','production','academy'].includes(module)?module as Module:null;}
function permission(module:Module,manage=false){return module==='academy'?`academy.lms.${manage?'manage':'read'}`:`${module}.${manage?'manage':'read'}`;}

export async function GET(_request:Request,ctx:{params:Promise<{module:string}>}){
 const m=await moduleContext(ctx);if(!m)return err('Unknown module',404);
 const u=await user();if(!u)return err('Unauthorized',401);
 if(!(await hasPermission(u.id,permission(m))))return err('Forbidden',403);
 const db:any=getSql();
 try{
  if(m==='rental'){
   const [equipment,bookings,customers,maintenance,incidents]=await Promise.all([
    db`SELECT e.id,e.asset_tag,e.name,e.category,e.manufacturer,e.model,e.serial_number,e.condition,e.daily_rate,e.replacement_value,e.status,e.notes FROM rental_equipment_units e JOIN organizations o ON o.id=e.organization_id WHERE o.slug=${ORG} ORDER BY e.name LIMIT 500`,
    db`SELECT b.id,b.booking_number,b.start_date,b.end_date,b.status,b.deposit_amount,b.notes,p.display_name AS customer_name,coalesce(sum(i.line_total),0)::numeric(18,2) AS rental_total,count(i.id)::int AS item_count,coalesce(jsonb_agg(jsonb_build_object('item_id',i.id,'unit_id',i.equipment_unit_id,'asset_tag',e.asset_tag,'name',e.name,'condition_out',i.condition_out,'condition_in',i.condition_in)) FILTER(WHERE i.id IS NOT NULL),'[]'::jsonb) AS items FROM rental_bookings b JOIN organizations o ON o.id=b.organization_id JOIN parties p ON p.id=b.customer_party_id LEFT JOIN rental_booking_items i ON i.booking_id=b.id LEFT JOIN rental_equipment_units e ON e.id=i.equipment_unit_id WHERE o.slug=${ORG} GROUP BY b.id,p.display_name ORDER BY b.created_at DESC LIMIT 300`,
    db`SELECT id,display_name,party_type FROM parties WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND deleted_at IS NULL AND party_type IN ('customer','both') AND status='active' ORDER BY display_name LIMIT 500`,
    db`SELECT m.id,m.equipment_unit_id,e.asset_tag,e.name,m.maintenance_type,m.description,m.scheduled_date,m.completed_date,m.cost,m.status FROM rental_maintenance m JOIN organizations o ON o.id=m.organization_id JOIN rental_equipment_units e ON e.id=m.equipment_unit_id WHERE o.slug=${ORG} ORDER BY m.scheduled_date DESC NULLS LAST LIMIT 200`,
    db`SELECT i.id,i.booking_id,i.equipment_unit_id,e.asset_tag,e.name,i.incident_type,i.description,i.assessed_cost,i.status,i.created_at FROM rental_incidents i JOIN rental_equipment_units e ON e.id=i.equipment_unit_id AND e.organization_id=i.organization_id WHERE i.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY i.created_at DESC LIMIT 300`
   ]);return NextResponse.json({equipment,bookings,customers,maintenance,incidents});
  }
  if(m==='production'){
   const [projects,customers,crew,equipment]=await Promise.all([
    db`SELECT p.id,p.project_number,p.title,p.project_type,p.brief,p.location,p.start_date,p.due_date,p.budget_amount,p.actual_cost,p.status,pa.display_name AS customer_name,(SELECT count(*)::int FROM production_crew_assignments a WHERE a.project_id=p.id AND a.organization_id=p.organization_id AND a.status<>'cancelled') AS crew_count,(SELECT count(*)::int FROM production_equipment_allocations x WHERE x.project_id=p.id AND x.organization_id=p.organization_id AND x.status IN('reserved','in_use')) AS equipment_count FROM production_projects p JOIN organizations o ON o.id=p.organization_id LEFT JOIN parties pa ON pa.id=p.customer_party_id WHERE o.slug=${ORG} ORDER BY p.created_at DESC LIMIT 300`,
    db`SELECT id,display_name FROM parties WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND deleted_at IS NULL AND party_type IN ('customer','both') AND status='active' ORDER BY display_name LIMIT 500`,
    db`SELECT id,full_name,specialty FROM production_crew_members WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND is_active ORDER BY full_name LIMIT 500`,
    db`SELECT id,asset_tag,name,category FROM rental_equipment_units WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND status='available' ORDER BY name LIMIT 500`
   ]);
   const [assignments,allocations,deliverables,expenses]=await Promise.all([
    db`SELECT a.id,a.project_id,a.crew_member_id,c.full_name,c.specialty,a.role_name,a.start_date,a.end_date,a.status FROM production_crew_assignments a JOIN production_crew_members c ON c.id=a.crew_member_id AND c.organization_id=a.organization_id WHERE a.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY a.created_at DESC LIMIT 500`,
    db`SELECT a.id,a.project_id,a.equipment_unit_id,e.asset_tag,e.name,a.start_date,a.end_date,a.status,a.notes FROM production_equipment_allocations a JOIN rental_equipment_units e ON e.id=a.equipment_unit_id AND e.organization_id=a.organization_id WHERE a.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY a.start_date DESC LIMIT 500`,
    db`SELECT d.id,d.project_id,d.title,d.description,d.file_url,d.due_date,d.status,count(r.id)::int AS revision_count FROM production_deliverables d LEFT JOIN production_revisions r ON r.organization_id=d.organization_id AND r.deliverable_id=d.id WHERE d.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) GROUP BY d.id ORDER BY d.due_date NULLS LAST LIMIT 500`,
    db`SELECT e.id,e.project_id,e.description,e.amount,e.incurred_on,e.approval_status FROM production_expenses e WHERE e.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY e.incurred_on DESC LIMIT 500`
   ]);return NextResponse.json({projects,customers,crew,equipment,assignments,allocations,deliverables,expenses});
  }
  const [courses,classes,students,instructors,enrollments]=await Promise.all([
   db`SELECT c.id,c.course_code,c.title,c.description,c.level,c.learning_hours,c.fee,c.status,(SELECT count(*)::int FROM academy_lessons l WHERE l.course_id=c.id AND l.organization_id=c.organization_id) AS lesson_count FROM academy_courses c WHERE c.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY c.updated_at DESC LIMIT 300`,
   db`SELECT c.id,c.class_code,c.title,c.delivery_mode,c.venue,c.starts_at,c.ends_at,c.capacity,c.fee,c.status,co.title AS course_title,i.full_name AS instructor_name,(SELECT count(*)::int FROM academy_enrollments en WHERE en.class_id=c.id AND en.organization_id=c.organization_id AND en.status='enrolled') AS enrolled_count FROM academy_classes c JOIN academy_courses co ON co.id=c.course_id AND co.organization_id=c.organization_id LEFT JOIN academy_instructors i ON i.id=c.instructor_id AND i.organization_id=c.organization_id WHERE c.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY c.starts_at DESC LIMIT 300`,
   db`SELECT id,student_number,full_name,email,phone,status FROM academy_students WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY full_name LIMIT 1000`,
   db`SELECT id,full_name,specialty FROM academy_instructors WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND status='active' ORDER BY full_name LIMIT 300`,
   db`SELECT e.id,e.class_id,e.student_id,s.student_number,s.full_name,e.status,e.payment_status,e.amount_paid,e.enrolled_at,c.class_code,c.title AS class_title,cert.certificate_number FROM academy_enrollments e JOIN academy_students s ON s.id=e.student_id AND s.organization_id=e.organization_id JOIN academy_classes c ON c.id=e.class_id AND c.organization_id=e.organization_id LEFT JOIN academy_certificates cert ON cert.enrollment_id=e.id AND cert.organization_id=e.organization_id WHERE e.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY e.enrolled_at DESC LIMIT 1000`
  ]);const [lessons,certificates,assessments,grades]=await Promise.all([
   db`SELECT l.id,l.course_id,c.course_code,c.title AS course_title,l.title,l.sequence_no,l.duration_minutes FROM academy_lessons l JOIN academy_courses c ON c.id=l.course_id AND c.organization_id=l.organization_id WHERE l.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY c.course_code,l.sequence_no LIMIT 1000`,
   db`SELECT c.id,c.certificate_number,c.issued_at,c.revoked_at,e.student_id,s.full_name,s.student_number,cl.class_code,cl.title AS class_title FROM academy_certificates c JOIN academy_enrollments e ON e.id=c.enrollment_id AND e.organization_id=c.organization_id JOIN academy_students s ON s.id=e.student_id AND s.organization_id=e.organization_id JOIN academy_classes cl ON cl.id=e.class_id AND cl.organization_id=e.organization_id WHERE c.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY c.issued_at DESC LIMIT 500`,
   db`SELECT a.id,a.class_id,a.title,a.assessment_type,a.max_score,a.due_date,c.class_code,c.title AS class_title FROM academy_assessments a JOIN academy_classes c ON c.id=a.class_id AND c.organization_id=a.organization_id WHERE a.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY a.due_date NULLS LAST LIMIT 500`,
   db`SELECT r.id,r.assessment_id,r.enrollment_id,r.score,r.feedback,r.graded_at,a.title AS assessment_title,s.full_name,s.student_number FROM academy_assessment_results r JOIN academy_assessments a ON a.id=r.assessment_id AND a.organization_id=r.organization_id JOIN academy_enrollments e ON e.id=r.enrollment_id AND e.organization_id=r.organization_id JOIN academy_students s ON s.id=e.student_id AND s.organization_id=e.organization_id WHERE r.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY r.graded_at DESC LIMIT 1000`
  ]);return NextResponse.json({courses,classes,students,instructors,enrollments,lessons,certificates,assessments,grades});
 }catch{return err('Gagal memuat data. Pastikan migrasi modul sudah diterapkan dan role database memiliki akses.',503);}
}

export async function POST(req:Request,ctx:{params:Promise<{module:string}>}){
 const origin=req.headers.get('origin'),host=req.headers.get('host');if(origin){try{if(!host||new URL(origin).host!==host)return err('Invalid request origin.',403);}catch{return err('Invalid request origin.',403);}}
 const m=await moduleContext(ctx);if(!m)return err('Unknown module',404);
 const u=await user();if(!u)return err('Unauthorized',401);
 if(!(await hasPermission(u.id,permission(m,true))))return err('Forbidden',403);
 let b:Record<string,unknown>;try{b=await req.json();if(!b||typeof b!=='object'||Array.isArray(b))return err('Invalid JSON body');}catch{return err('Invalid JSON body');}
 const action=str(b,'action',60),db:any=getSql();
 try{
  if(m==='rental'){
   if(action==='equipment'){
    const tag=str(b,'asset_tag',80),name=str(b,'name',180),category=str(b,'category',100)||'general',rate=validMoney(b.daily_rate),value=validMoney(b.replacement_value??0);
    if(!tag||!name||!Number.isFinite(rate)||!Number.isFinite(value))return err('Nomor aset, nama dan tarif valid wajib diisi.');
    const rows=await db`INSERT INTO rental_equipment_units(organization_id,asset_tag,name,category,manufacturer,model,serial_number,daily_rate,replacement_value,notes,created_by) SELECT id,${tag},${name},${category},${str(b,'manufacturer',100)||null},${str(b,'model',120)||null},${str(b,'serial_number',120)||null},${rate},${value},${str(b,'notes',1000)||null},${u.id} FROM organizations WHERE slug=${ORG} RETURNING id,asset_tag,name,status`;
    if(!rows.length)return err('Organisasi tidak ditemukan.',409);await audit(db,u.id,'create','rental_equipment_unit',String(rows[0].id),{asset_tag:tag,name});return NextResponse.json({equipment:rows[0]},{status:201});
   }
   if(action==='booking'){
    const customer=str(b,'customer_party_id',80),start=str(b,'start_date',10),end=str(b,'end_date',10),deposit=validMoney(b.deposit_amount??0),units=Array.isArray(b.equipment_unit_ids)?[...new Set((b.equipment_unit_ids as unknown[]).filter(x=>typeof x==='string'))] as string[]:[];
    if(!customer||!validDate(start)||!validDate(end)||end<start||!Number.isFinite(deposit)||!units.length||units.length>25)return err('Pelanggan, tanggal dan minimal satu unit aset valid wajib diisi.');
    const days=Math.floor((Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000)+1;
    const number='RNT-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+crypto.randomUUID().slice(0,8).toUpperCase();
    const rows=await db`WITH o AS(SELECT id FROM organizations WHERE slug=${ORG}),v AS(SELECT count(*)::int n FROM rental_equipment_units e WHERE e.organization_id=(SELECT id FROM o) AND e.id::text IN (SELECT jsonb_array_elements_text(${JSON.stringify(units)}::jsonb)) AND e.status='available'),t AS(INSERT INTO business_transactions(organization_id,module_code,transaction_type,reference_no,description,party_id,transaction_date,status,amount,source_table,created_by) SELECT o.id,'RENTAL','rental_booking',${number},'Rental booking '+${number},${customer}::uuid,${start}::date,'draft',coalesce((SELECT sum(e.daily_rate)*${days} FROM rental_equipment_units e WHERE e.organization_id=o.id AND e.id::text IN (SELECT jsonb_array_elements_text(${JSON.stringify(units)}::jsonb))),0),'rental_bookings',${u.id} FROM o JOIN parties p ON p.organization_id=o.id AND p.id=${customer}::uuid AND p.deleted_at IS NULL CROSS JOIN v WHERE v.n=${units.length} RETURNING id,organization_id,amount),bkg AS(INSERT INTO rental_bookings(organization_id,booking_number,customer_party_id,start_date,end_date,deposit_amount,created_by,business_transaction_id) SELECT organization_id,${number},${customer}::uuid,${start}::date,${end}::date,${deposit},${u.id},id FROM t RETURNING id,organization_id,business_transaction_id),lines AS(INSERT INTO rental_booking_items(organization_id,booking_id,equipment_unit_id,daily_rate,quantity_days) SELECT bkg.organization_id,bkg.id,e.id,e.daily_rate,${days} FROM bkg JOIN rental_equipment_units e ON e.organization_id=bkg.organization_id AND e.id::text IN (SELECT jsonb_array_elements_text(${JSON.stringify(units)}::jsonb)) RETURNING id),link AS(UPDATE business_transactions SET source_id=(SELECT id::text FROM bkg),updated_at=now() WHERE id=(SELECT business_transaction_id FROM bkg) RETURNING id) SELECT bkg.id,bkg.business_transaction_id,(SELECT count(*)::int FROM lines) AS item_count FROM bkg`;
    if(!rows.length||Number(rows[0].item_count)!==units.length)return err('Pelanggan atau unit aset tidak valid.',409);await audit(db,u.id,'create','rental_booking',String(rows[0].id),{booking_number:number,start_date:start,end_date:end,item_count:units.length});return NextResponse.json({booking:rows[0],booking_number:number},{status:201});
   }
   if(action==='booking_status'){
    const id=str(b,'booking_id',80),next=str(b,'status',30);if(!['requested','confirmed','cancelled'].includes(next))return err('Status booking tidak valid.');
    const rows=await db`UPDATE rental_bookings b SET status=${next},confirmed_by=CASE WHEN ${next}='confirmed' THEN ${u.id} ELSE b.confirmed_by END,confirmed_at=CASE WHEN ${next}='confirmed' THEN now() ELSE b.confirmed_at END,updated_at=now() FROM organizations o WHERE b.organization_id=o.id AND o.slug=${ORG} AND b.id=${id}::uuid AND ((b.status='draft' AND ${next} IN('requested','cancelled')) OR (b.status='requested' AND ${next} IN('confirmed','cancelled'))) AND (${next}<>'confirmed' OR b.created_by<>${u.id}) AND (${next}<>'confirmed' OR EXISTS(SELECT 1 FROM rental_booking_items i WHERE i.booking_id=b.id AND i.organization_id=b.organization_id)) RETURNING b.id,b.status`;
    if(!rows.length)return err('Transisi status tidak valid atau booking belum memiliki aset.',409);await audit(db,u.id,'update_status','rental_booking',id,{status:next});return NextResponse.json({booking:rows[0]});
   }
   if(action==='checkout'){
    const booking=str(b,'booking_id',80),unit=str(b,'equipment_unit_id',80),condition=str(b,'condition_out',80)||null;
    if(condition&&!['new','good','fair','needs_repair','retired'].includes(condition))return err('Kondisi aset tidak valid.');
    const rows=await db`WITH x AS(INSERT INTO rental_checkouts(organization_id,booking_id,equipment_unit_id,checked_out_by,condition_out,accessories_out,notes) SELECT b.organization_id,b.id,i.equipment_unit_id,${u.id},${condition},${JSON.stringify(Array.isArray(b.accessories)?b.accessories:[])}::jsonb,${str(b,'notes',1000)||null} FROM rental_bookings b JOIN organizations o ON o.id=b.organization_id JOIN rental_booking_items i ON i.booking_id=b.id AND i.organization_id=b.organization_id AND i.equipment_unit_id=${unit}::uuid WHERE o.slug=${ORG} AND b.id=${booking}::uuid AND b.status IN('confirmed','checked_out') RETURNING id,organization_id,booking_id),i AS(UPDATE rental_booking_items SET condition_out=${condition} WHERE organization_id=(SELECT organization_id FROM x) AND booking_id=(SELECT booking_id FROM x) AND equipment_unit_id=${unit}::uuid RETURNING id),s AS(UPDATE rental_bookings SET status='checked_out',updated_at=now() WHERE id=(SELECT booking_id FROM x) AND organization_id=(SELECT organization_id FROM x) RETURNING id) SELECT x.id,x.booking_id FROM x`;
    if(!rows.length)return err('Booking harus berstatus confirmed dan unit harus terdaftar.',409);await audit(db,u.id,'checkout','rental_checkout',String(rows[0].id),{booking_id:booking,equipment_unit_id:unit});return NextResponse.json({checkout:rows[0]},{status:201});
   }
   if(action==='checkin'){
    const booking=str(b,'booking_id',80),unit=str(b,'equipment_unit_id',80),condition=str(b,'condition_in',80)||null,fee=validMoney(b.late_fee??0);
    if(!Number.isFinite(fee)|| (condition&&!['new','good','fair','needs_repair','retired'].includes(condition)))return err('Kondisi aset atau biaya keterlambatan tidak valid.');
    const rows=await db`WITH x AS(UPDATE rental_checkouts c SET returned_at=now(),returned_by=${u.id},condition_in=${condition},accessories_in=${JSON.stringify(Array.isArray(b.accessories)?b.accessories:[])}::jsonb,late_fee=${fee},notes=coalesce(${str(b,'notes',1000)||null},c.notes) WHERE c.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND c.booking_id=${booking}::uuid AND c.equipment_unit_id=${unit}::uuid AND c.returned_at IS NULL RETURNING c.id,c.organization_id,c.booking_id,c.equipment_unit_id),i AS(UPDATE rental_booking_items SET condition_in=${condition} WHERE organization_id=(SELECT organization_id FROM x) AND booking_id=(SELECT booking_id FROM x) AND equipment_unit_id=(SELECT equipment_unit_id FROM x) RETURNING id),s AS(UPDATE rental_bookings b SET status=CASE WHEN NOT EXISTS(SELECT 1 FROM rental_booking_items bi LEFT JOIN rental_checkouts c ON c.organization_id=bi.organization_id AND c.booking_id=bi.booking_id AND c.equipment_unit_id=bi.equipment_unit_id WHERE bi.organization_id=b.organization_id AND bi.booking_id=b.id AND (c.id IS NULL OR c.returned_at IS NULL)) THEN 'returned' ELSE b.status END,updated_at=now() WHERE b.id=(SELECT booking_id FROM x) AND b.organization_id=(SELECT organization_id FROM x) RETURNING id,status),e AS(UPDATE rental_equipment_units SET condition=coalesce(${condition},condition),status=CASE WHEN ${condition}='needs_repair' THEN 'maintenance' WHEN ${condition}='retired' THEN 'retired' ELSE status END,updated_at=now() WHERE id=(SELECT equipment_unit_id FROM x) AND organization_id=(SELECT organization_id FROM x) RETURNING id) SELECT x.id,s.status FROM x,s`;
    if(!rows.length)return err('Checkout aktif tidak ditemukan.',409);await audit(db,u.id,'checkin','rental_checkout',String(rows[0].id),{booking_id:booking,equipment_unit_id:unit,condition_in:condition,late_fee:fee});return NextResponse.json({checkin:rows[0]});
   }
   if(action==='maintenance'){
    const unit=str(b,'equipment_unit_id',80),kind=str(b,'maintenance_type',30),description=str(b,'description',1000),date=str(b,'scheduled_date',10),cost=validMoney(b.cost??0);
    if(!unit||!['preventive','repair','inspection'].includes(kind)||!description||!Number.isFinite(cost)||(date&&!validDate(date)))return err('Data maintenance tidak valid.');
    const rows=await db`WITH x AS(INSERT INTO rental_maintenance(organization_id,equipment_unit_id,maintenance_type,description,scheduled_date,cost,created_by) SELECT e.organization_id,e.id,${kind},${description},${date||null}::date,${cost},${u.id} FROM rental_equipment_units e WHERE e.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND e.id=${unit}::uuid RETURNING id,organization_id,equipment_unit_id),y AS(UPDATE rental_equipment_units SET status='maintenance',updated_at=now() WHERE id=(SELECT equipment_unit_id FROM x) AND organization_id=(SELECT organization_id FROM x) RETURNING id) SELECT x.id FROM x`;
    if(!rows.length)return err('Aset tidak ditemukan.',404);await audit(db,u.id,'create','rental_maintenance',String(rows[0].id),{equipment_unit_id:unit,maintenance_type:kind});return NextResponse.json({maintenance:rows[0]},{status:201});
   }
   if(action==='maintenance_status'){
    const id=str(b,'maintenance_id',80),next=str(b,'status',20);if(!['completed','cancelled'].includes(next))return err('Status maintenance tidak valid.');
    const rows=await db`WITH m AS(UPDATE rental_maintenance SET status=${next},completed_date=CASE WHEN ${next}='completed' THEN current_date ELSE completed_date END WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND id=${id}::uuid AND status IN('planned','in_progress') RETURNING id,organization_id,equipment_unit_id,status),e AS(UPDATE rental_equipment_units SET status=CASE WHEN ${next}='completed' AND condition NOT IN('needs_repair','retired') THEN 'available' ELSE status END,updated_at=now() WHERE id=(SELECT equipment_unit_id FROM m) AND organization_id=(SELECT organization_id FROM m) RETURNING id) SELECT m.* FROM m`;
    if(!rows.length)return err('Maintenance tidak ditemukan atau status akhir.',409);await audit(db,u.id,'update_status','rental_maintenance',id,{status:next});return NextResponse.json({maintenance:rows[0]});
   }
   if(action==='incident'){
    const booking=str(b,'booking_id',80),unit=str(b,'equipment_unit_id',80),kind=str(b,'incident_type',20),description=str(b,'description',1500),cost=validMoney(b.assessed_cost??0);
    if(!booking||!unit||!['damage','loss','late','other'].includes(kind)||!description||!Number.isFinite(cost))return err('Data insiden tidak valid.');
    const rows=await db`INSERT INTO rental_incidents(organization_id,booking_id,equipment_unit_id,incident_type,description,assessed_cost,created_by) SELECT b.organization_id,b.id,i.equipment_unit_id,${kind},${description},${cost},${u.id} FROM rental_bookings b JOIN rental_booking_items i ON i.booking_id=b.id AND i.organization_id=b.organization_id AND i.equipment_unit_id=${unit}::uuid WHERE b.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND b.id=${booking}::uuid RETURNING id,booking_id,equipment_unit_id,status`;
    if(!rows.length)return err('Booking atau unit tidak ditemukan.',404);await audit(db,u.id,'create','rental_incident',String(rows[0].id),{booking_id:booking,equipment_unit_id:unit,incident_type:kind});return NextResponse.json({incident:rows[0]},{status:201});
   }
  }
  if(m==='production'){
   if(action==='project'){
    const title=str(b,'title',180),number='PRD-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+crypto.randomUUID().slice(0,8).toUpperCase(),budget=validMoney(b.budget_amount??0),start=str(b,'start_date',10),due=str(b,'due_date',10),customer=str(b,'customer_party_id',80)||null;
    if(!title||!Number.isFinite(budget)||(start&&!validDate(start))||(due&&!validDate(due))||(start&&due&&due<start))return err('Nama, tanggal atau anggaran proyek tidak valid.');
    const rows=await db`WITH o AS(SELECT id FROM organizations WHERE slug=${ORG}),t AS(INSERT INTO business_transactions(organization_id,module_code,transaction_type,reference_no,description,party_id,transaction_date,status,amount,source_table,created_by) SELECT id,'PRODUCTION','production_project',${number},${title},${customer}::uuid,coalesce(${start}::date,current_date),'draft',${budget},'production_projects',${u.id} FROM o WHERE ${customer}::uuid IS NULL OR EXISTS(SELECT 1 FROM parties p WHERE p.organization_id=o.id AND p.id=${customer}::uuid AND p.deleted_at IS NULL) RETURNING id,organization_id),p AS(INSERT INTO production_projects(organization_id,project_number,title,project_type,brief,location,customer_party_id,start_date,due_date,budget_amount,created_by,business_transaction_id) SELECT t.organization_id,${number},${title},${str(b,'project_type',80)||'video'},${str(b,'brief',4000)},${str(b,'location',300)||null},${customer}::uuid,${start||null}::date,${due||null}::date,${budget},${u.id},t.id FROM t RETURNING id,project_number,title,status,business_transaction_id),x AS(UPDATE business_transactions SET source_id=(SELECT id::text FROM p) WHERE id=(SELECT business_transaction_id FROM p) RETURNING id) SELECT p.* FROM p`;
    if(!rows.length)return err('Klien tidak valid atau organisasi tidak ditemukan.',409);await audit(db,u.id,'create','production_project',String(rows[0].id),{project_number:number,title});return NextResponse.json({project:rows[0]},{status:201});
   }
   if(action==='crew_member'){
    const name=str(b,'full_name',180);if(!name)return err('Nama anggota kru wajib diisi.');
    const rows=await db`INSERT INTO production_crew_members(organization_id,full_name,email,specialty) SELECT id,${name},${str(b,'email',254)||null},${str(b,'specialty',120)||null} FROM organizations WHERE slug=${ORG} RETURNING id,full_name,specialty`;
    if(rows[0])await audit(db,u.id,'create','production_crew_member',String(rows[0].id),{full_name:name});return NextResponse.json({crew:rows[0]},{status:201});
   }
   if(action==='assign_crew'){
    const project=str(b,'project_id',80),member=str(b,'crew_member_id',80),role=str(b,'role_name',120),start=str(b,'start_date',10),end=str(b,'end_date',10);
    if(!project||!member||!role||(start&&!validDate(start))||(end&&!validDate(end))||(start&&end&&end<start))return err('Penugasan kru tidak valid.');
    const rows=await db`INSERT INTO production_crew_assignments(organization_id,project_id,crew_member_id,role_name,start_date,end_date) SELECT p.organization_id,p.id,c.id,${role},${start||null}::date,${end||null}::date FROM production_projects p JOIN production_crew_members c ON c.organization_id=p.organization_id AND c.id=${member}::uuid WHERE p.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND p.id=${project}::uuid RETURNING id,project_id,crew_member_id,role_name,status`;
    if(!rows.length)return err('Proyek atau anggota kru tidak ditemukan.',404);await audit(db,u.id,'create','production_crew_assignment',String(rows[0].id),{project_id:project,crew_member_id:member,role_name:role});return NextResponse.json({assignment:rows[0]},{status:201});
   }
   if(action==='allocate_equipment'){
    const project=str(b,'project_id',80),unit=str(b,'equipment_unit_id',80),start=str(b,'start_date',10),end=str(b,'end_date',10);
    if(!project||!unit||!validDate(start)||!validDate(end)||end<start)return err('Unit dan rentang tanggal alokasi tidak valid.');
    const rows=await db`INSERT INTO production_equipment_allocations(organization_id,project_id,equipment_unit_id,start_date,end_date,notes,created_by) SELECT p.organization_id,p.id,e.id,${start}::date,${end}::date,${str(b,'notes',1000)||null},${u.id} FROM production_projects p JOIN rental_equipment_units e ON e.organization_id=p.organization_id AND e.id=${unit}::uuid WHERE p.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND p.id=${project}::uuid RETURNING id,project_id,equipment_unit_id,start_date,end_date,status`;
    if(!rows.length)return err('Proyek atau unit aset tidak ditemukan.',404);await audit(db,u.id,'create','production_equipment_allocation',String(rows[0].id),{project_id:project,equipment_unit_id:unit,start_date:start,end_date:end});return NextResponse.json({allocation:rows[0]},{status:201});
   }
   if(action==='deliverable'){
    const project=str(b,'project_id',80),title=str(b,'title',180),due=str(b,'due_date',10);
    if(!project||!title||(due&&!validDate(due)))return err('Nama deliverable atau tanggal tidak valid.');
    const rows=await db`INSERT INTO production_deliverables(organization_id,project_id,title,description,file_url,due_date) SELECT p.organization_id,p.id,${title},${str(b,'description',1500)||null},${str(b,'file_url',1000)||null},${due||null}::date FROM production_projects p WHERE p.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND p.id=${project}::uuid RETURNING id,project_id,title,status`;
    if(!rows.length)return err('Proyek tidak ditemukan.',404);await audit(db,u.id,'create','production_deliverable',String(rows[0].id),{project_id:project,title});return NextResponse.json({deliverable:rows[0]},{status:201});
   }
   if(action==='revision'){
    const id=str(b,'deliverable_id',80),feedback=str(b,'feedback',2000);
    if(!id||!feedback)return err('Deliverable dan feedback wajib diisi.');
    const rows=await db`INSERT INTO production_revisions(organization_id,deliverable_id,revision_number,feedback,requested_by) SELECT d.organization_id,d.id,coalesce(max(r.revision_number),0)+1,${feedback},${u.id} FROM production_deliverables d LEFT JOIN production_revisions r ON r.organization_id=d.organization_id AND r.deliverable_id=d.id WHERE d.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND d.id=${id}::uuid GROUP BY d.organization_id,d.id RETURNING id,deliverable_id,revision_number,status`;
    if(!rows.length)return err('Deliverable tidak ditemukan.',404);await audit(db,u.id,'create','production_revision',String(rows[0].id),{deliverable_id:id,revision_number:rows[0].revision_number});return NextResponse.json({revision:rows[0]},{status:201});
   }
   if(action==='expense'){
    const project=str(b,'project_id',80),description=str(b,'description',500),amount=validMoney(b.amount),date=str(b,'incurred_on',10);
    if(!project||!description||!Number.isFinite(amount)||(date&&!validDate(date)))return err('Data biaya proyek tidak valid.');
    const rows=await db`INSERT INTO production_expenses(organization_id,project_id,description,amount,incurred_on,created_by) SELECT p.organization_id,p.id,${description},${amount},${date||null}::date,${u.id} FROM production_projects p WHERE p.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND p.id=${project}::uuid RETURNING id,project_id,description,amount,incurred_on,approval_status`;
    if(!rows.length)return err('Proyek tidak ditemukan.',404);await audit(db,u.id,'create','production_expense',String(rows[0].id),{project_id:project,amount,approval_status:'pending'});return NextResponse.json({expense:rows[0]},{status:201});
   }
   if(action==='project_status'){
    const id=str(b,'project_id',80),next=str(b,'status',30),allowed:Record<string,string[]>={draft:['briefing','cancelled'],briefing:['scheduled','cancelled'],scheduled:['in_progress','cancelled'],in_progress:['review','cancelled'],review:['in_progress','approved'],approved:['delivered']};
    if(!Object.values(allowed).some(x=>x.includes(next)))return err('Status proyek tidak valid.');
    const rows=await db`UPDATE production_projects p SET status=${next},approved_by=CASE WHEN ${next}='approved' THEN ${u.id} ELSE p.approved_by END,approved_at=CASE WHEN ${next}='approved' THEN now() ELSE p.approved_at END,delivered_at=CASE WHEN ${next}='delivered' THEN now() ELSE p.delivered_at END,updated_at=now() FROM organizations o WHERE p.organization_id=o.id AND o.slug=${ORG} AND p.id=${id}::uuid AND p.status IN (SELECT jsonb_array_elements_text(${JSON.stringify(Object.keys(allowed).filter(x=>allowed[x].includes(next)))}::jsonb)) AND (${next}<>'approved' OR p.created_by<>${u.id}) RETURNING p.id,p.status`;
    if(!rows.length)return err('Transisi status proyek tidak diizinkan.',409);await audit(db,u.id,'update_status','production_project',id,{status:next});return NextResponse.json({project:rows[0]});
   }
  }
  if(m==='academy'){
   if(action==='course'){
    const code=str(b,'course_code',60),title=str(b,'title',180),hours=Number(b.learning_hours??0),fee=validMoney(b.fee??0);
    if(!code||!title||!Number.isFinite(hours)||hours<0||!Number.isFinite(fee))return err('Kode, nama, durasi atau biaya kursus tidak valid.');
    const rows=await db`INSERT INTO academy_courses(organization_id,course_code,title,description,level,learning_hours,fee,created_by) SELECT id,${code},${title},${str(b,'description',4000)},${str(b,'level',40)||'beginner'},${hours},${fee},${u.id} FROM organizations WHERE slug=${ORG} RETURNING id,course_code,title,status`;
    if(rows[0])await audit(db,u.id,'create','academy_course',String(rows[0].id),{course_code:code,title});return NextResponse.json({course:rows[0]},{status:201});
   }
   if(action==='course_status'){
    const id=str(b,'course_id',80),next=str(b,'status',20);if(!['published','archived'].includes(next))return err('Status kursus tidak valid.');
    const rows=await db`UPDATE academy_courses c SET status=${next},updated_at=now() WHERE c.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND c.id=${id}::uuid AND ((c.status='draft' AND ${next}='published') OR ${next}='archived') RETURNING id,status`;
    if(!rows.length)return err('Transisi kursus tidak diizinkan.',409);await audit(db,u.id,'update_status','academy_course',id,{status:next});return NextResponse.json({course:rows[0]});
   }
   if(action==='lesson'){
    const course=str(b,'course_id',80),title=str(b,'title',180),sequence=Number(b.sequence_no),duration=Number(b.duration_minutes??0);
    if(!course||!title||!Number.isInteger(sequence)||sequence<1||!Number.isInteger(duration)||duration<0)return err('Pelajaran, urutan dan durasi harus valid.');
    const rows=await db`INSERT INTO academy_lessons(organization_id,course_id,title,content,sequence_no,duration_minutes) SELECT c.organization_id,c.id,${title},${str(b,'content',5000)},${sequence},${duration} FROM academy_courses c WHERE c.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND c.id=${course}::uuid AND c.status<>'archived' RETURNING id,course_id,title,sequence_no`;
    if(!rows.length)return err('Kursus tidak ditemukan atau sudah diarsipkan.',404);await audit(db,u.id,'create','academy_lesson',String(rows[0].id),{course_id:course,title,sequence_no:sequence});return NextResponse.json({lesson:rows[0]},{status:201});
   }
   if(action==='class_status'){
    const id=str(b,'class_id',80),next=str(b,'status',20),valid=next==='in_progress'?['scheduled']:next==='completed'?['in_progress']:next==='cancelled'?['scheduled','in_progress']:[];
    if(!valid.length)return err('Status kelas tidak valid.');
    const rows=await db`UPDATE academy_classes SET status=${next} WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND id=${id}::uuid AND status IN (SELECT jsonb_array_elements_text(${JSON.stringify(valid)}::jsonb)) RETURNING id,status`;
    if(!rows.length)return err('Transisi kelas tidak diizinkan.',409);await audit(db,u.id,'update_status','academy_class',id,{status:next});return NextResponse.json({class:rows[0]});
   }
   if(action==='instructor'){
    const name=str(b,'full_name',180);if(!name)return err('Nama instruktur wajib diisi.');
    const rows=await db`INSERT INTO academy_instructors(organization_id,full_name,email,specialty) SELECT id,${name},${str(b,'email',254)||null},${str(b,'specialty',120)||null} FROM organizations WHERE slug=${ORG} RETURNING id,full_name,specialty`;
    if(rows[0])await audit(db,u.id,'create','academy_instructor',String(rows[0].id),{full_name:name});return NextResponse.json({instructor:rows[0]},{status:201});
   }
   if(action==='class'){
    const code=str(b,'class_code',60),title=str(b,'title',180),course=str(b,'course_id',80),instructor=str(b,'instructor_id',80)||null,startRaw=str(b,'starts_at',30),endRaw=str(b,'ends_at',30),start=startRaw?(/(?:Z|[+-]\d{2}:?\d{2})$/.test(startRaw)?startRaw:startRaw+'+07:00'):startRaw,end=endRaw?(/(?:Z|[+-]\d{2}:?\d{2})$/.test(endRaw)?endRaw:endRaw+'+07:00'):endRaw,capacity=Number(b.capacity),fee=validMoney(b.fee??0);
    const sd=Date.parse(start),ed=Date.parse(end);
    if(!code||!title||!course||!Number.isFinite(sd)||!Number.isFinite(ed)||ed<=sd||!Number.isInteger(capacity)||capacity<1||capacity>1000||!Number.isFinite(fee)||!['onsite','online','hybrid'].includes(str(b,'delivery_mode',20)||'onsite'))return err('Data kelas tidak valid.');
    const rows=await db`INSERT INTO academy_classes(organization_id,course_id,instructor_id,class_code,title,delivery_mode,venue,starts_at,ends_at,capacity,fee,created_by) SELECT c.organization_id,c.id,${instructor}::uuid,${code},${title},${str(b,'delivery_mode',20)||'onsite'},${str(b,'venue',250)||null},${start}::timestamptz,${end}::timestamptz,${capacity},${fee},${u.id} FROM academy_courses c WHERE c.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND c.id=${course}::uuid AND c.status='published' AND (${instructor}::uuid IS NULL OR EXISTS(SELECT 1 FROM academy_instructors i WHERE i.id=${instructor}::uuid AND i.organization_id=c.organization_id AND i.status='active')) RETURNING id,class_code,title,status`;
    if(!rows.length)return err('Kursus harus dipublikasikan dan instruktur valid.',409);await audit(db,u.id,'create','academy_class',String(rows[0].id),{class_code:code,title});return NextResponse.json({class:rows[0]},{status:201});
   }
   if(action==='student'){
    const number=str(b,'student_number',60),name=str(b,'full_name',180);if(!number||!name)return err('Nomor dan nama siswa wajib diisi.');
    const rows=await db`INSERT INTO academy_students(organization_id,student_number,full_name,email,phone) SELECT id,${number},${name},${str(b,'email',254)||null},${str(b,'phone',40)||null} FROM organizations WHERE slug=${ORG} RETURNING id,student_number,full_name,status`;
    if(rows[0])await audit(db,u.id,'create','academy_student',String(rows[0].id),{student_number:number,full_name:name});return NextResponse.json({student:rows[0]},{status:201});
   }
   if(action==='enroll'){
    const cls=str(b,'class_id',80),student=str(b,'student_id',80);
    const rows=await db`INSERT INTO academy_enrollments(organization_id,class_id,student_id) SELECT c.organization_id,c.id,s.id FROM academy_classes c JOIN academy_students s ON s.organization_id=c.organization_id AND s.id=${student}::uuid AND s.status='active' WHERE c.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND c.id=${cls}::uuid AND c.status='scheduled' AND (SELECT count(*) FROM academy_enrollments e WHERE e.class_id=c.id AND e.organization_id=c.organization_id AND e.status='enrolled')<c.capacity RETURNING id,class_id,student_id,status,payment_status`;
    if(!rows.length)return err('Kelas penuh/tidak tersedia atau siswa tidak valid.',409);await audit(db,u.id,'create','academy_enrollment',String(rows[0].id),{class_id:cls,student_id:student});return NextResponse.json({enrollment:rows[0]},{status:201});
   }
   if(action==='enrollment_status'){
    const id=str(b,'enrollment_id',80),next=str(b,'status',20);if(!['completed','withdrawn','failed'].includes(next))return err('Status peserta tidak valid.');
    const rows=await db`UPDATE academy_enrollments e SET status=${next} FROM academy_classes c WHERE e.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND e.id=${id}::uuid AND c.organization_id=e.organization_id AND c.id=e.class_id AND e.status='enrolled' AND (${next}<>'completed' OR c.status='completed') RETURNING e.id,e.status`;
    if(!rows.length)return err('Selesaikan kelas terlebih dahulu sebelum meluluskan peserta.',409);await audit(db,u.id,'update_status','academy_enrollment',id,{status:next});return NextResponse.json({enrollment:rows[0]});
   }
   if(action==='attendance'){
    const enrollment=str(b,'enrollment_id',80),date=str(b,'session_date',10),status=str(b,'attendance_status',20);
    if(!enrollment||!validDate(date)||!['present','late','absent','excused'].includes(status))return err('Presensi tidak valid.');
    const rows=await db`INSERT INTO academy_attendance(organization_id,enrollment_id,session_date,attendance_status,notes,recorded_by) SELECT e.organization_id,e.id,${date}::date,${status},${str(b,'notes',500)||null},${u.id} FROM academy_enrollments e WHERE e.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND e.id=${enrollment}::uuid ON CONFLICT(organization_id,enrollment_id,session_date) DO UPDATE SET attendance_status=EXCLUDED.attendance_status,notes=EXCLUDED.notes,recorded_by=EXCLUDED.recorded_by RETURNING id,session_date,attendance_status`;
    if(rows[0])await audit(db,u.id,'upsert','academy_attendance',String(rows[0].id),{session_date:date,attendance_status:status});return NextResponse.json({attendance:rows[0]},{status:201});
   }
   if(action==='assessment'){
    const cls=str(b,'class_id',80),title=str(b,'title',180),max=Number(b.max_score??100),due=str(b,'due_date',10);
    if(!cls||!title||!Number.isFinite(max)||max<=0||(due&&!validDate(due)))return err('Data penilaian tidak valid.');
    const rows=await db`INSERT INTO academy_assessments(organization_id,class_id,title,assessment_type,max_score,due_date,created_by) SELECT c.organization_id,c.id,${title},${str(b,'assessment_type',60)||'assignment'},${max},${due||null}::date,${u.id} FROM academy_classes c WHERE c.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND c.id=${cls}::uuid AND c.status<>'cancelled' RETURNING id,class_id,title,max_score`;
    if(!rows.length)return err('Kelas tidak ditemukan atau dibatalkan.',404);await audit(db,u.id,'create','academy_assessment',String(rows[0].id),{class_id:cls,title});return NextResponse.json({assessment:rows[0]},{status:201});
   }
   if(action==='grade'){
    const assessment=str(b,'assessment_id',80),enrollment=str(b,'enrollment_id',80),score=Number(b.score);
    if(!assessment||!enrollment||!Number.isFinite(score)||score<0)return err('Nilai tidak valid.');
    const rows=await db`INSERT INTO academy_assessment_results(organization_id,assessment_id,enrollment_id,score,feedback,graded_by) SELECT a.organization_id,a.id,e.id,${score},${str(b,'feedback',1000)||null},${u.id} FROM academy_assessments a JOIN academy_enrollments e ON e.organization_id=a.organization_id AND e.class_id=a.class_id WHERE a.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND a.id=${assessment}::uuid AND e.id=${enrollment}::uuid AND ${score}<=a.max_score ON CONFLICT(organization_id,assessment_id,enrollment_id) DO UPDATE SET score=EXCLUDED.score,feedback=EXCLUDED.feedback,graded_by=EXCLUDED.graded_by,graded_at=now() RETURNING id,assessment_id,enrollment_id,score`;
    if(!rows.length)return err('Penilaian, peserta atau rentang nilai tidak valid.',409);await audit(db,u.id,'grade','academy_assessment_result',String(rows[0].id),{score});return NextResponse.json({result:rows[0]},{status:201});
   }
   if(action==='issue_certificate'){
    const enrollment=str(b,'enrollment_id',80),number='CERT-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+crypto.randomUUID().slice(0,8).toUpperCase();
    const rows=await db`INSERT INTO academy_certificates(organization_id,enrollment_id,certificate_number,issued_by) SELECT e.organization_id,e.id,${number},${u.id} FROM academy_enrollments e JOIN academy_classes c ON c.id=e.class_id AND c.organization_id=e.organization_id WHERE e.organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) AND e.id=${enrollment}::uuid AND e.status='completed' AND c.status='completed' RETURNING id,certificate_number,enrollment_id,issued_at`;
    if(!rows.length)return err('Sertifikat hanya dapat diterbitkan setelah kelas dan pendaftaran berstatus selesai.',409);await audit(db,u.id,'issue','academy_certificate',String(rows[0].id),{certificate_number:number,enrollment_id:enrollment});return NextResponse.json({certificate:rows[0]},{status:201});
   }
  }
  return err('Aksi modul tidak dikenal.',404);
 }catch(error){
  const message=error instanceof Error?error.message:'';
  if(message.includes('overlapping dates')||message.includes('conflicts with a rental booking')||message.includes('Equipment unit is not available'))return err(message,409);
  if(message.includes('duplicate key'))return err('Data dengan kode atau kombinasi yang sama sudah ada.',409);
  if(message.includes('foreign key'))return err('Referensi data tidak valid atau berbeda organisasi.',409);
  return err('Operasi gagal. Periksa data dan pastikan migrasi modul sudah diterapkan.',503);
 }
}
