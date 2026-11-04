import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { hasPermission } from '@/lib/auth/permissions';
import { getSql } from '@/lib/db';
export const dynamic='force-dynamic';
const ORG='rundingan-kreasi-media';
const fail=(message:string,status=400)=>NextResponse.json({error:message},{status});
const str=(b:Record<string,unknown>,k:string,max=200)=>typeof b[k]==='string'?(b[k] as string).trim().slice(0,max):'';
const num=(v:unknown)=>Number(v??0);
async function actor(){const {data}=await auth.getSession();return data?.user??null;}
async function audit(db:any,userId:string,action:string,type:string,id:string,data:Record<string,unknown>){await db`INSERT INTO audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,after_data) SELECT id,${userId},${action},${type},${id},${JSON.stringify(data)}::jsonb FROM organizations WHERE slug=${ORG}`;}

export async function GET(){
 const user=await actor();if(!user)return fail('Unauthorized',401);
 if(!(await hasPermission(user.id,'hr.employees.read')))return fail('Forbidden',403);
 const db:any=getSql();
 try{
  const [employees,contracts,attendance,leaveRequests,components]=await Promise.all([
   db`SELECT e.id,e.employee_code,e.full_name,e.job_title,e.status,d.name AS department_name FROM hr_employees e JOIN organizations o ON o.id=e.organization_id LEFT JOIN departments d ON d.id=e.department_id WHERE o.slug=${ORG} AND e.archived_at IS NULL ORDER BY e.full_name`,
   await hasPermission(user.id,'hr.contracts.read')?db`SELECT c.*,e.employee_code,e.full_name FROM hr_employee_contracts c JOIN organizations o ON o.id=c.organization_id JOIN hr_employees e ON e.id=c.employee_id AND e.organization_id=c.organization_id WHERE o.slug=${ORG} ORDER BY c.start_date DESC LIMIT 500`:[],
   await hasPermission(user.id,'hr.attendance.read')?db`SELECT a.*,e.employee_code,e.full_name FROM hr_attendance_records a JOIN organizations o ON o.id=a.organization_id JOIN hr_employees e ON e.id=a.employee_id AND e.organization_id=a.organization_id WHERE o.slug=${ORG} ORDER BY a.work_date DESC LIMIT 1000`:[],
   await hasPermission(user.id,'hr.leave.read')?db`SELECT l.*,e.employee_code,e.full_name FROM hr_leave_requests l JOIN organizations o ON o.id=l.organization_id JOIN hr_employees e ON e.id=l.employee_id AND e.organization_id=l.organization_id WHERE o.slug=${ORG} ORDER BY l.start_date DESC LIMIT 500`:[],
   await hasPermission(user.id,'hr.payroll.read')?db`SELECT id,code,name,component_type,is_taxable,is_recurring,is_active,expense_account_id,payable_account_id FROM hr_payroll_components WHERE organization_id=(SELECT id FROM organizations WHERE slug=${ORG}) ORDER BY code`:[],
  ]);
  return NextResponse.json({employees,contracts,attendance,leaveRequests,components});
 }catch{return fail('Data HR lanjutan belum tersedia. Periksa migrasi 010.',503);}
}

export async function POST(req:Request){
 const origin=req.headers.get('origin'),host=req.headers.get('host');if(origin){try{if(!host||new URL(origin).host!==host)return fail('Invalid request origin.',403);}catch{return fail('Invalid request origin.',403);}}
 const user=await actor();if(!user)return fail('Unauthorized',401);
 let b:Record<string,unknown>;try{b=await req.json();}catch{return fail('Invalid JSON body.');}
 const action=str(b,'action',50),db:any=getSql();
 try{
  if(action==='employee_update'||action==='employee_archive'){
   if(!(await hasPermission(user.id,'hr.employees.manage')))return fail('Forbidden',403);
   const id=str(b,'employee_id',80);
   if(action==='employee_archive'){
    const rows=await db`UPDATE hr_employees e SET archived_at=NOW(),status='terminated',updated_by=${user.id},updated_at=NOW() FROM organizations o WHERE e.organization_id=o.id AND o.slug=${ORG} AND e.id=${id}::uuid AND e.archived_at IS NULL AND NOT EXISTS(SELECT 1 FROM hr_payroll_lines l JOIN hr_payroll_runs r ON r.id=l.payroll_run_id WHERE l.employee_id=e.id AND r.status IN('approved','paid')) RETURNING e.id,e.employee_code,e.status`;
    if(!rows.length)return fail('Pegawai tidak ditemukan atau masih terikat payroll yang disetujui.',409);
    await audit(db,user.id,'archive','hr_employee',id,{status:'terminated'});return NextResponse.json({employee:rows[0]});
   }
   const name=str(b,'full_name',160),job=str(b,'job_title',120)||null,email=str(b,'email',254)||null,phone=str(b,'phone',40)||null,dept=str(b,'department_id',80)||null,unit=str(b,'business_unit_id',80)||null,salary=num(b.base_salary),status=str(b,'status',20)||'active';
   if(!id||!name||!Number.isFinite(salary)||salary<0||!['active','leave','resigned','terminated'].includes(status))return fail('Data pegawai tidak valid.');
   const rows=await db`UPDATE hr_employees e SET full_name=${name},job_title=${job},email=${email},phone=${phone},department_id=${dept}::uuid,business_unit_id=${unit}::uuid,base_salary=${salary},status=${status},updated_by=${user.id},updated_at=NOW() FROM organizations o WHERE e.organization_id=o.id AND o.slug=${ORG} AND e.id=${id}::uuid AND e.archived_at IS NULL AND (${dept}::uuid IS NULL OR EXISTS(SELECT 1 FROM departments d WHERE d.id=${dept}::uuid AND d.organization_id=o.id AND d.deleted_at IS NULL)) AND (${unit}::uuid IS NULL OR EXISTS(SELECT 1 FROM business_units bu WHERE bu.id=${unit}::uuid AND bu.organization_id=o.id AND bu.deleted_at IS NULL)) RETURNING e.id,e.employee_code,e.full_name,e.status`;
   if(!rows.length)return fail('Pegawai atau referensi organisasi tidak valid.',409);
   await audit(db,user.id,'update','hr_employee',id,{full_name:name,job_title:job,status});return NextResponse.json({employee:rows[0]});
  }
  if(action==='contract'){
   if(!(await hasPermission(user.id,'hr.contracts.manage')))return fail('Forbidden',403);
   const employee=str(b,'employee_id',80),no=str(b,'contract_number',60),type=str(b,'contract_type',30),start=str(b,'start_date',10),end=str(b,'end_date',10)||null,salary=num(b.base_salary);
   if(!employee||!no||!['permanent','fixed_term','probation','freelance','internship'].includes(type)||!/^\d{4}-\d{2}-\d{2}$/.test(start)||!Number.isFinite(salary)||salary<0||(end&&end<start))return fail('Data kontrak tidak valid.');
   const rows=await db`INSERT INTO hr_employee_contracts(organization_id,employee_id,contract_number,contract_type,start_date,end_date,base_salary,notes,created_by) SELECT o.id,e.id,${no},${type},${start}::date,${end}::date,${salary},${str(b,'notes',1000)||null},${user.id} FROM organizations o JOIN hr_employees e ON e.organization_id=o.id AND e.id=${employee}::uuid AND e.archived_at IS NULL WHERE o.slug=${ORG} RETURNING id,contract_number,status`;
   if(!rows.length)return fail('Pegawai tidak valid.',409);await audit(db,user.id,'create','hr_employee_contract',String(rows[0].id),{contract_number:no,employee_id:employee});return NextResponse.json({contract:rows[0]},{status:201});
  }
  if(action==='attendance'){
   if(!(await hasPermission(user.id,'hr.attendance.manage')))return fail('Forbidden',403);
   const employee=str(b,'employee_id',80),date=str(b,'work_date',10),status=str(b,'attendance_status',20)||'present',overtime=num(b.overtime_minutes);
   if(!employee||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!['present','late','absent','leave','sick','remote','holiday'].includes(status)||!Number.isInteger(overtime)||overtime<0)return fail('Data kehadiran tidak valid.');
   const rows=await db`INSERT INTO hr_attendance_records(organization_id,employee_id,work_date,attendance_status,overtime_minutes,notes,created_by) SELECT o.id,e.id,${date}::date,${status},${overtime},${str(b,'notes',500)||null},${user.id} FROM organizations o JOIN hr_employees e ON e.organization_id=o.id AND e.id=${employee}::uuid AND e.archived_at IS NULL WHERE o.slug=${ORG} ON CONFLICT(organization_id,employee_id,work_date) DO UPDATE SET attendance_status=EXCLUDED.attendance_status,overtime_minutes=EXCLUDED.overtime_minutes,notes=EXCLUDED.notes,updated_at=NOW() RETURNING id,work_date,attendance_status,overtime_minutes`;
   if(!rows.length)return fail('Pegawai tidak valid.',409);await audit(db,user.id,'upsert','hr_attendance_record',String(rows[0].id),{employee_id:employee,work_date:date,attendance_status:status});return NextResponse.json({attendance:rows[0]},{status:201});
  }
  if(action==='leave'){
   if(!(await hasPermission(user.id,'hr.leave.manage')))return fail('Forbidden',403);
   const employee=str(b,'employee_id',80),type=str(b,'leave_type',30),start=str(b,'start_date',10),end=str(b,'end_date',10),days=num(b,'total_days');
   if(!employee||!['annual','sick','maternity','paternity','unpaid','other'].includes(type)||!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start||!Number.isFinite(days)||days<=0)return fail('Permohonan cuti tidak valid.');
   const rows=await db`INSERT INTO hr_leave_requests(organization_id,employee_id,leave_type,start_date,end_date,total_days,reason,created_by) SELECT o.id,e.id,${type},${start}::date,${end}::date,${days},${str(b,'reason',1000)||null},${user.id} FROM organizations o JOIN hr_employees e ON e.organization_id=o.id AND e.id=${employee}::uuid AND e.archived_at IS NULL WHERE o.slug=${ORG} RETURNING id,status,start_date,end_date,total_days`;
   if(!rows.length)return fail('Pegawai tidak valid.',409);await audit(db,user.id,'create','hr_leave_request',String(rows[0].id),{employee_id:employee,leave_type:type});return NextResponse.json({leave:rows[0]},{status:201});
  }
  if(action==='leave_status'){
   if(!(await hasPermission(user.id,'hr.leave.manage')))return fail('Forbidden',403);
   const id=str(b,'leave_id',80),next=str(b,'status',20);if(!['submitted','approved','rejected','cancelled'].includes(next))return fail('Status cuti tidak valid.');
   const rows=await db`UPDATE hr_leave_requests l SET status=${next},approved_by=CASE WHEN ${next}='approved' THEN ${user.id} ELSE approved_by END,approved_at=CASE WHEN ${next}='approved' THEN NOW() ELSE approved_at END,updated_at=NOW() FROM organizations o WHERE l.organization_id=o.id AND o.slug=${ORG} AND l.id=${id}::uuid AND ((l.status='draft' AND ${next} IN('submitted','cancelled')) OR (l.status='submitted' AND ${next} IN('approved','rejected','cancelled'))) RETURNING l.id,l.status`;
   if(!rows.length)return fail('Transisi status cuti tidak diizinkan.',409);await audit(db,user.id,'update_status','hr_leave_request',id,{status:next});return NextResponse.json({leave:rows[0]});
  }
  if(action==='payroll_component'){
   if(!(await hasPermission(user.id,'hr.payroll.components.manage')))return fail('Forbidden',403);
   const code=str(b,'code',40).toUpperCase(),name=str(b,'name',120),type=str(b,'component_type',30);
   if(!code||!name||!['earning','deduction','employer_contribution'].includes(type))return fail('Komponen payroll tidak valid.');
   const rows=await db`INSERT INTO hr_payroll_components(organization_id,code,name,component_type,is_taxable,is_recurring,expense_account_id,payable_account_id) SELECT id,${code},${name},${type},${b.is_taxable===true},${b.is_recurring===true},${str(b,'expense_account_id',80)||null}::uuid,${str(b,'payable_account_id',80)||null}::uuid FROM organizations WHERE slug=${ORG} RETURNING id,code,name,component_type`;
   await audit(db,user.id,'create','hr_payroll_component',String(rows[0].id),{code,name,component_type:type});return NextResponse.json({component:rows[0]},{status:201});
  }
  return fail('Aksi HR tidak dikenal.',404);
 }catch(error){const message=error instanceof Error&&error.message.toLowerCase().includes('unique')?'Kode atau record sudah digunakan.':'Operasi HR gagal. Periksa data, migrasi dan hak akses.';return fail(message,409);}
}
