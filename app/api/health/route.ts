import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';

const requiredTables = [
  'organizations','business_units','parties','audit_logs','cms_posts','cms_seo_audits',
  'finance_accounts','finance_journals','finance_journal_lines','hr_employees',
  'hr_payroll_runs','hr_payroll_lines','inventory_items','inventory_movements',
  'procurement_requests','module_catalog','organization_modules','business_transactions','module_work_items',
  'agent_runs','agent_actions',
  'finance_cost_centers','finance_projects','finance_periods','finance_tax_codes','finance_bank_accounts','finance_bank_reconciliations',
  'finance_documents','finance_document_lines','finance_settlements','finance_settlement_allocations','finance_bank_statement_lines',
  'hr_employee_contracts','hr_attendance_records','hr_leave_requests','hr_payroll_components','hr_payroll_line_components','hr_payroll_settings',
  'inventory_categories','inventory_finance_settings','procurement_request_lines','purchase_orders','purchase_order_lines','goods_receipts','goods_receipt_lines',
];
const requiredMigrations = [
  '20261103_001_custom_cms',
  '20261103_002_cms_permissions',
  '20261104_003_enterprise_operational_modules',
  '20261104_004_unified_modules_agents_reports',
  '20261104_005_enterprise_transaction_module',
  '20261104_006_limited_role_health_read_permissions','20261104_007_module_operational_workspaces',
  '20261104_008_finance_accounting_foundation',
  '20261104_009_ar_ap_cash_bank',
  '20261104_010_hr_inventory_procurement_depth',
];

export async function GET() {
  const timestamp = new Date().toISOString();
  let sql:any;

  // Keep database connectivity separate from schema-metadata authorization.
  // A restricted runtime role can reach Postgres while still lacking access to
  // schema_migrations; that is a schema-readiness issue, not a database outage.
  try {
    sql = getSql();
    await sql`SELECT 1`;
  } catch {
    return NextResponse.json({
      status:'error',
      service:'rundingan-kreasi-media',
      checks:{database:'unavailable'},
      timestamp,
    },{status:503});
  }

  try {
    const [tableRows,migrationRows] = await Promise.all([
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`,
      sql`SELECT version FROM schema_migrations`,
    ]);
    const tables = new Set(tableRows.map((row:any)=>String(row.table_name)));
    const migrations = new Set(migrationRows.map((row:any)=>String(row.version)));
    const missingTables = requiredTables.filter((name)=>!tables.has(name));
    const missingMigrations = requiredMigrations.filter((name)=>!migrations.has(name));
    const ready = missingTables.length===0 && missingMigrations.length===0;
    return NextResponse.json({
      status: ready?'ok':'degraded',
      service:'rundingan-kreasi-media',
      checks:{
        database:'ok',
        schema:ready?'complete':'incomplete',
        missing_tables:missingTables,
        missing_migrations:missingMigrations,
      },
      timestamp,
    },{status:ready?200:503});
  } catch {
    return NextResponse.json({
      status:'degraded',
      service:'rundingan-kreasi-media',
      checks:{database:'ok',schema:'unavailable',diagnostic:'schema_metadata_access_denied'},
      timestamp,
    },{status:503});
  }
}
