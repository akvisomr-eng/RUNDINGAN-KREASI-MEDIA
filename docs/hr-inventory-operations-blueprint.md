# HRD, Payroll, Inventory & Procurement Operations Blueprint

## HRD forms
Employee master (code, name, contact, business unit, department, job title, employment type, dates, salary, status); employment contracts; attendance; leave requests; payroll components; payroll runs and slips; payroll account/bank mapping; approvals and audit history.

## Inventory and procurement forms
Item master with category, unit, minimum/reorder quantities and GL mappings; category master; stock movements; procurement requests with detail lines; purchase orders and lines; goods receipts and lines; warehouse/location; stock opname and adjustment controls.

## Finance integration
All modules use the same organization-scoped `business_transactions` spine and the shared General Ledger. Payroll accrual debits salary expense and credits payroll payable plus mapped deductions/statutory liabilities; payroll payment debits payroll payable and credits the selected bank GL account. Stock receipt debits inventory and credits a configured goods-received clearing account; stock issue debits mapped expense/COGS and credits inventory. No movement posts without valid account mappings and an open accounting period. Procurement requests and POs are commitments only; supplier liabilities are recognized through approved Finance AP bills, avoiding duplicate journals. Posted journals are immutable; corrections use reversal/adjustment.

## Reports
HR: employee directory, contract expiry, attendance, lateness, absence, overtime, leave, payroll register, gross-to-net, statutory deductions, payroll payment, payroll journal and liability reconciliation.
Inventory/procurement: stock on hand by SKU/category/location, stock card, minimum/reorder alerts, valuation, opname variance, movement audit, PR/PO register, approval aging, goods receipt, outstanding PO quantities, AP aging links and inventory-to-GL reconciliation.

## Navigation
New/Insert, Save, Update, deactivate/soft-delete, First/Previous/Next/Last, Find/Search, filters, Submit, Approve, Reject, Post, Pay/Receive, Print, PDF/CSV/XLSX, Attachments and Audit History. Delete is restricted to unused drafts; posted or referenced records are never physically deleted.

## Release gates
Test migration 010 on an isolated Neon branch, test workflows with synthetic data, verify role boundaries, organization isolation, report totals and balanced GL journals, then verify a Vercel preview for the exact commit before scheduling additive Production migration.
