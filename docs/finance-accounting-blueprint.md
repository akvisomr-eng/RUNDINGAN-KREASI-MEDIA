# Rundingan Kreasi Media — Integrated Finance & Accounting Blueprint

## 1. Accounting policy and operating model

- Single organization ledger, one chart of accounts and one transaction spine shared by all business modules.
- Accrual accounting with double-entry postings; IDR is the functional currency. Foreign-currency documents retain document currency, rate, and IDR functional values.
- Draft → Submitted → Approved → Posted workflow. Only posted entries affect the general ledger and financial statements.
- Posted journals are immutable. Correct by reversal/adjustment journals; never hard-delete a posted transaction.
- Period locks, role separation, audit logs, evidence attachments, and source-document traceability are mandatory.
- Each document stores organization, business unit, source module, source record, counterparty, project, cost center, dates, currency, reference, creator, approver and status.

## 2. Navigation

1. Dashboard
2. Master Data
   - Chart of Accounts
   - Account Groups
   - Cost Centers
   - Projects / Jobs
   - Business Units
   - Tax Codes
   - Bank Accounts
   - Accounting Periods
   - Accounting Settings
3. General Ledger
   - Journal Entry
   - Journal Register
   - General Ledger
   - Account Activity
   - Opening Balances
   - Adjusting Journals
   - Reversing Journals
   - Recurring Journals
   - Inter-unit Journals
4. Cash & Banking
   - Cash Receipts
   - Cash Payments
   - Bank Transfers
   - Bank Reconciliation
   - Cash Forecast
5. Accounts Receivable
   - Customer Invoices
   - Credit Notes
   - Customer Receipts
   - Customer Advances
   - AR Aging
   - Customer Statements
6. Accounts Payable
   - Supplier Bills
   - Debit Notes
   - Supplier Payments
   - Supplier Advances
   - AP Aging
   - Supplier Statements
7. Tax
   - Input VAT / Output VAT
   - Withholding tax
   - Tax settlement
   - Tax reconciliation
   - Tax period reports
8. Fixed Assets
   - Asset Register
   - Acquisition / Disposal
   - Depreciation Run
   - Asset Movement
9. Budget & Cost Control
   - Annual Budget
   - Budget Revision
   - Actual vs Budget
   - Project Costing
   - Business Unit Profitability
10. Financial Reports
11. Period Close & Audit

## 3. Form specifications

### 3.1 Chart of Accounts

Header fields:
- Account Code (required, unique within organization)
- Account Name (required)
- Parent Account (self-referencing lookup)
- Account Type: Asset / Liability / Equity / Revenue / Expense
- Account Group / Subgroup
- Normal Balance: Debit / Credit
- Account Level (derived from parent)
- Posting Account (yes/no); parent/summary accounts should not accept journal lines
- Cash Flow Category: Operating / Investing / Financing / Not applicable
- Default Tax Code
- Description
- Display Order
- Active / Inactive
- Created By / Created At / Updated By / Updated At

Validation:
- No duplicate code within an organization.
- No account can be its own parent or create a circular hierarchy.
- Parent and child account types must be compatible.
- Only active posting accounts may be selected in journal lines.
- Accounts already used in posted journals cannot be deleted; deactivate instead.

### 3.2 Journal Entry

Header:
- Journal Number (system-generated)
- Journal Date
- Document Date
- Reference Number
- Journal Type: General / Adjustment / Reversal / Opening / Inter-unit / Recurring
- Source Module: ENTERPRISE / ACADEMY / CREATIVE / EVENT / MEDIA / PRODUCTION / RENTAL
- Business Unit
- Customer / Supplier / Employee / Counterparty
- Project / Contract
- Currency
- Exchange Rate
- Description
- Internal Memo
- Evidence / Attachment references
- Accounting Period
- Status
- Created By / Submitted By / Approved By / Posted By and timestamps

Line grid (2–100 lines):
- Account
- Line Description
- Debit
- Credit
- Business Unit
- Cost Center
- Project / Job
- Counterparty
- Tax Code
- Source Module

Rules:
- Exactly one of debit or credit is positive per line.
- At least two lines.
- Total debit equals total credit to the cent.
- A line may only use an account and dimensions belonging to the same organization.
- Journal date must fall in an open period.
- Drafts do not affect financial statements.
- Submission, approval, and posting are distinct actions with permission checks.
- Posting creates/updates the linked business transaction status and audit event.
- Posted entries are immutable; corrections use linked reversal journals.

### 3.3 Customer Invoice (AR)

Header:
- Invoice Number, Invoice Date, Due Date, Customer, Customer Tax ID
- Contract / Quotation / Sales Order / Project
- Source Module and Business Unit
- Currency, Exchange Rate, Payment Terms
- Revenue Account, Receivable Account
- Tax Invoice Reference and Tax Treatment
- Notes, Attachments, Prepared By, Approved By, Status

Lines:
- Product / Service / Deliverable
- Description, Quantity, Unit, Unit Price
- Discount, Tax Code, Tax Base, Tax Amount
- Revenue Account, Project, Cost Center
- Line Total

Posting:
- Debit Accounts Receivable (gross)
- Credit Revenue (net)
- Credit Output VAT / other tax payable (when applicable)

Receipt:
- Debit Cash / Bank
- Credit Accounts Receivable
- Separate withholding tax/fees/short-pay handling with supporting evidence.

### 3.4 Supplier Bill (AP)

Header:
- Supplier Bill Number, Supplier Invoice Number, Bill Date, Due Date
- Supplier and Tax ID, Purchase Order, Goods Receipt / Service Acceptance
- Source Module, Business Unit, Project, Currency, Exchange Rate
- Payable Account, Tax Treatment, Payment Terms, Attachment, Status

Lines:
- Expense / Inventory / Asset / Service Account
- Description, Quantity, Unit, Unit Cost
- Discount, Input Tax Code, Tax Base, Tax Amount
- Project, Cost Center, Inventory Item, Department

Posting:
- Debit Expense / Inventory / Asset
- Debit Input VAT (when recoverable)
- Credit Accounts Payable

Payment:
- Debit Accounts Payable
- Credit Cash / Bank
- Fees, withholding, advances, and partial settlement are separate allocations.

### 3.5 Cash Receipt / Cash Payment

- Voucher Number, Date, Cash/Bank Account, Counterparty, Reference
- Related invoice/bill, source module, business unit, project
- Payment method, bank reference, currency, exchange rate
- Amount, withholding, bank fee, memo, attachment
- Allocation grid to open invoices/bills or GL accounts
- Prepared / Reviewed / Approved / Posted fields

### 3.6 Bank Reconciliation

- Bank Account, Statement Period, Opening Balance, Closing Balance
- Imported statement file / statement reference
- Matched bank transactions, unmatched receipts, outstanding payments
- Bank charges, interest, corrections and book adjustments
- Calculated difference, preparer, reviewer, reconciliation status
- Reconciliation can only be finalized when the difference is zero or an approved outstanding item explains it.

### 3.7 Cost Center / Project

- Code, Name, Parent, Business Unit, Source Module
- Customer, Project Manager / Responsible Person
- Start Date, End Date, Budget, Status
- Revenue Account / Cost Account mapping (optional)
- Every eligible journal line may carry a cost center and project for profitability reports.

### 3.8 Tax Code

- Code, Name, Tax Type, Rate, Effective From / To
- Tax Account, Tax Base Rule, Inclusive / Exclusive
- Recoverability / withholding treatment
- Reference and notes
- Rates and legal rules must be maintained by authorized finance staff and reviewed against current Indonesian tax rules. Do not hard-code rates into UI logic.

### 3.9 Accounting Period

- Fiscal Year, Period Number, Period Name
- Start Date, End Date
- Open / Closed status
- Closing Checklist, Closed By / At
- Reopened By / At and reason
- A period cannot close while draft/submitted/approved journals remain unresolved.
- Reopening requires Owner/authorized finance controller permission and an audit reason.

## 4. Financial reports

All reports require period/date filters and should support business unit, source module, account, project, cost center, counterparty, currency, status and export filters where relevant.

1. Journal Register — all journals, document references, debit, credit, status and source.
2. General Ledger — opening balance, dated movement, debit, credit, running balance and source-document drill-through.
3. Trial Balance — opening debit/credit, movement debit/credit, closing debit/credit.
4. Profit & Loss — revenue, cost of sales, gross profit, operating expenses, operating profit, other income/expense and net profit.
5. Balance Sheet — current/non-current assets, current/non-current liabilities, equity and current-period earnings.
6. Cash Flow — operating, investing and financing cash flows; disclose indirect-method adjustments.
7. Statement of Changes in Equity.
8. Accounts Receivable Aging — current, 1–30, 31–60, 61–90, >90 days.
9. Accounts Payable Aging — same aging buckets.
10. Customer / Supplier Statement.
11. Bank Book and Bank Reconciliation.
12. Tax Summary — input VAT, output VAT, withholding and tax settlement by period.
13. Fixed Asset Register and Depreciation Schedule.
14. Inventory Valuation and Stock-to-GL Reconciliation.
15. Budget vs Actual.
16. Profitability by Business Unit, Module, Project and Cost Center.
17. Payroll Journal and Payroll Liability Summary.
18. Unposted Journal, Unbalanced Journal, Closed-Period Exception and Audit Trail reports.

Each report needs:
- Company identity, report title, period, currency and generated timestamp
- Filters and report parameters
- Opening, movement and closing totals as applicable
- Drill-through to ledger line and source transaction
- Print/PDF, CSV/XLSX export, pagination and page numbering
- Reconciliation totals and explanatory notes

## 5. Shared module integration

| Module | Financial events | Accounting impact |
|---|---|---|
| ENTERPRISE | Manual journals, invoices, bills, cash, payroll, assets, tax | General ledger and all control accounts |
| ACADEMY | Course enrollment, tuition, instructor fees, refunds, certificates | Tuition revenue, receivables, deferred revenue, instructor expense |
| CREATIVE | Creative brief, quotation, client approval, delivery, revisions | Service revenue, receivables, talent/vendor costs, project margin |
| EVENT | Sponsorship, ticketing, vendor, venue, production, refunds | Event revenue, advances, deposits, vendor payables, event costs |
| MEDIA | Advertising, advertorial, subscriptions, licensing, distribution | Advertising/media revenue, receivables, commissions, content costs |
| PRODUCTION | Work order, crew, equipment, post-production, delivery | Production revenue, WIP, direct labor, equipment and subcontractor costs |
| RENTAL | Reservation, deposit, rental, late fee, damage, return | Rental revenue, customer deposits, asset depreciation, repair costs |

RENTAL is an optional plugin. Its data is isolated behind module activation, but if enabled it posts into the same enterprise ledger and reporting dimensions.

## 6. Database relationship model

- organizations 1—N business_units
- organizations 1—N finance_accounts; finance_accounts 1—N child finance_accounts
- organizations 1—N finance_periods
- organizations 1—N finance_cost_centers
- organizations 1—N finance_projects
- organizations 1—N finance_tax_codes
- organizations 1—N finance_bank_accounts
- finance_bank_accounts 1—N finance_bank_reconciliations
- organizations 1—N finance_journals
- finance_journals 1—N finance_journal_lines
- finance_accounts 1—N finance_journal_lines
- finance_cost_centers / finance_projects / parties 1—N finance_journal_lines
- business_transactions 1—0..1 finance_journals (source identity / traceability)
- operational source documents from all modules link to business_transactions and, once approved for accounting, to finance_journals.
- audit_logs records create, update, submit, approve, post, reverse, close and reopen actions.

All foreign-key references and all API reads/writes must be organization-scoped. Never derive tenant identity from a browser-supplied organization ID.

## 7. Standard navigation and actions

Every list/detail screen should have:
- New, Insert / Save Draft, Update, Delete (draft only), Cancel
- First, Previous, Next, Last, Find / Search
- Submit, Approve, Post, Reverse / Void where applicable
- Print, Export PDF, Export CSV/XLSX
- Attach Evidence, View History, Audit Trail
- Pagination, sorting, filters and saved views

Buttons must reflect role permissions and record state. The application must show a confirmation for irreversible workflow transitions and always retain a server-side audit record.

## 8. Delivery phases

- Phase 1: COA, journal, approval/posting, period controls, GL, trial balance, P&L, balance sheet, core integrity checks.
- Phase 2: AR/AP, invoices, bills, receipts, payments, cash/bank and reconciliation.
- Phase 3: Tax, fixed assets, depreciation, budgets, cost accounting and module-specific posting adapters.
- Phase 4: Consolidation, recurring journals, forecasting, management reporting and accounting assistant agents.

A feature is not production-accounting-ready until its database constraints, permission checks, audit trail, report reconciliation and real transaction tests pass.
