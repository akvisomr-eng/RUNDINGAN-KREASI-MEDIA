import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { hasPermission } from '@/lib/auth/permissions';
import { getSql } from '@/lib/db';
export const dynamic = 'force-dynamic';
const ORG = 'rundingan-kreasi-media';

export async function GET(req: Request) {
  const { data } = await auth.getSession();
  if (!data?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(data.user.id, 'reports.read'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const report = new URL(req.url).searchParams.get('report') || 'employees';
  const sql: any = getSql();
  try {
    if (report === 'employees') {
      const rows = await sql`SELECT e.employee_code,e.full_name,e.email,e.phone,e.employment_type,e.job_title,e.start_date,e.end_date,e.status,d.name AS department_name,b.name AS business_unit_name FROM hr_employees e JOIN organizations o ON o.id=e.organization_id LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN business_units b ON b.id=e.business_unit_id WHERE o.slug=${ORG} AND e.archived_at IS NULL ORDER BY e.full_name`;
      return NextResponse.json({ report, rows });
    }
    if (report === 'contracts') {
      const rows = await sql`SELECT c.contract_number,c.contract_type,c.start_date,c.end_date,c.base_salary,c.status,e.employee_code,e.full_name FROM hr_employee_contracts c JOIN organizations o ON o.id=c.organization_id JOIN hr_employees e ON e.id=c.employee_id AND e.organization_id=c.organization_id WHERE o.slug=${ORG} ORDER BY c.end_date NULLS LAST`;
      return NextResponse.json({ report, rows });
    }
    if (report === 'attendance') {
      const rows = await sql`SELECT a.work_date,a.attendance_status,count(*)::int AS employee_count,sum(a.overtime_minutes)::int AS overtime_minutes FROM hr_attendance_records a JOIN organizations o ON o.id=a.organization_id WHERE o.slug=${ORG} GROUP BY a.work_date,a.attendance_status ORDER BY a.work_date DESC,a.attendance_status`;
      return NextResponse.json({ report, rows });
    }
    if (report === 'leave') {
      const rows = await sql`SELECT l.start_date,l.end_date,l.leave_type,l.total_days,l.status,e.employee_code,e.full_name FROM hr_leave_requests l JOIN organizations o ON o.id=l.organization_id JOIN hr_employees e ON e.id=l.employee_id AND e.organization_id=l.organization_id WHERE o.slug=${ORG} ORDER BY l.start_date DESC`;
      return NextResponse.json({ report, rows });
    }
    if (report === 'payroll') {
      const rows = await sql`SELECT r.period_start,r.period_end,r.status,r.finance_journal_id,r.payment_journal_id,count(l.id)::int AS employee_count,coalesce(sum(l.gross_pay),0)::numeric(18,2) AS gross_total,coalesce(sum(l.deductions),0)::numeric(18,2) AS deductions_total,coalesce(sum(l.net_pay),0)::numeric(18,2) AS net_total FROM hr_payroll_runs r JOIN organizations o ON o.id=r.organization_id LEFT JOIN hr_payroll_lines l ON l.payroll_run_id=r.id WHERE o.slug=${ORG} GROUP BY r.id ORDER BY r.period_start DESC`;
      return NextResponse.json({ report, rows });
    }
    if (report === 'stock') {
      const rows = await sql`SELECT i.sku,i.name,i.unit,i.minimum_stock,i.reorder_quantity,coalesce(sum(CASE WHEN m.movement_type IN ('opening','in') THEN m.quantity WHEN m.movement_type='out' THEN -m.quantity ELSE 0 END),0)::numeric(18,3) AS quantity_on_hand,coalesce(sum(CASE WHEN m.movement_type IN ('opening','in') THEN m.quantity*m.unit_cost WHEN m.movement_type='out' THEN -m.quantity*m.unit_cost ELSE 0 END),0)::numeric(18,2) AS movement_value FROM inventory_items i JOIN organizations o ON o.id=i.organization_id LEFT JOIN inventory_movements m ON m.item_id=i.id AND m.organization_id=i.organization_id WHERE o.slug=${ORG} AND i.is_active GROUP BY i.id ORDER BY i.name`;
      return NextResponse.json({ report, rows });
    }
    if (report === 'stock-movements') {
      const rows = await sql`SELECT m.created_at,m.movement_type,m.quantity,m.unit_cost,m.reference,m.finance_journal_id,i.sku,i.name,l.name AS location_name FROM inventory_movements m JOIN organizations o ON o.id=m.organization_id JOIN inventory_items i ON i.id=m.item_id AND i.organization_id=m.organization_id LEFT JOIN locations l ON l.id=m.location_id AND l.organization_id=m.organization_id WHERE o.slug=${ORG} ORDER BY m.created_at DESC LIMIT 2000`;
      return NextResponse.json({ report, rows });
    }
    if (report === 'procurement') {
      const rows = await sql`SELECT p.request_number,p.description,p.estimated_total,p.status,p.needed_by,pa.display_name AS supplier_name,p.created_at FROM procurement_requests p JOIN organizations o ON o.id=p.organization_id LEFT JOIN parties pa ON pa.id=p.supplier_party_id AND pa.organization_id=p.organization_id WHERE o.slug=${ORG} ORDER BY p.created_at DESC`;
      return NextResponse.json({ report, rows });
    }
    if (report === 'purchase-orders') {
      const rows = await sql`SELECT po.po_number,po.order_date,po.expected_date,po.status,pa.display_name AS supplier_name,coalesce(sum(pol.line_total),0)::numeric(18,2) AS order_total,coalesce(sum(pol.received_quantity),0)::numeric(18,3) AS received_quantity FROM purchase_orders po JOIN organizations o ON o.id=po.organization_id JOIN parties pa ON pa.id=po.supplier_party_id AND pa.organization_id=po.organization_id LEFT JOIN purchase_order_lines pol ON pol.purchase_order_id=po.id AND pol.organization_id=po.organization_id WHERE o.slug=${ORG} GROUP BY po.id,pa.display_name ORDER BY po.order_date DESC`;
      return NextResponse.json({ report, rows });
    }
    if (report === 'goods-receipts') {
      const rows = await sql`SELECT gr.receipt_number,gr.received_at,gr.status,po.po_number,count(grl.id)::int AS line_count,coalesce(sum(grl.quantity*grl.unit_cost),0)::numeric(18,2) AS receipt_value,gr.finance_journal_id FROM goods_receipts gr JOIN organizations o ON o.id=gr.organization_id JOIN purchase_orders po ON po.id=gr.purchase_order_id AND po.organization_id=gr.organization_id LEFT JOIN goods_receipt_lines grl ON grl.goods_receipt_id=gr.id AND grl.organization_id=gr.organization_id WHERE o.slug=${ORG} GROUP BY gr.id,po.po_number ORDER BY gr.received_at DESC`;
      return NextResponse.json({ report, rows });
    }
    return NextResponse.json({ error: 'Unknown report.' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'Laporan belum tersedia. Pastikan migrasi modul sudah diterapkan pada environment ini.' }, { status: 503 });
  }
}
