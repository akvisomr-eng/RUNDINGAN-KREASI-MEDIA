# Report Center

## Entry points
- Main cross-module reports: `/workspace/reports`
- Detailed HRD, payroll, inventory and procurement reports: `/workspace/enterprise/reports`

## Main report coverage
- Finance journals and debit/credit totals.
- Accounts receivable: posted sales invoices and sales credit notes, with credit notes reducing the outstanding balance.
- Accounts payable: posted purchase bills and purchase debit notes, with debit notes reducing the outstanding balance.
- Cash receipts and supplier payments, including original currency and IDR equivalent using the document exchange rate.
- Bank reconciliation statements, balances and differences.
- HR employee register and payroll summaries.
- Inventory on-hand from posted opening/in/out movements, procurement requests, CRM parties, CMS publishing status, audit events, shared transactions, and organization module status.
- Module work-item register with a permitted-module filter.

## Controls
- The main page requires `reports.read`; each section is additionally gated by its domain permission.
- Finance transaction values require `finance.journals.read`; AR, AP and cash/bank sections require their respective `finance.ar.read`, `finance.ap.read`, and `finance.cash.read` permissions.
- CSV exports only tables already rendered for the current authenticated user and neutralizes spreadsheet formula-leading values.
- Print output supports browser Print / Save as PDF.
- Date range and module filters are applied to relevant operational datasets.

## Inventory caveat
- Stock on hand includes only posted opening, inbound and outbound movements through the selected end date.
- Adjustment movements are shown separately and excluded from the balance because the current movement schema does not record whether an adjustment increases or decreases stock.
- Movement value is not a final inventory valuation method; reconcile inventory to the general ledger and adopt a costing policy before treating it as statutory valuation.

## Financial statement caveat
- Journal, AR/AP, settlement and bank-reconciliation registers are operational reports.
- A formal trial balance, income statement and balance sheet must only be presented after the chart of accounts and posted journal balances are populated and validated. The current Production chart of accounts query returned no account rows, so this change does not fabricate formal statements.
- Currency totals are not combined across document currencies; AR/AP KPI equivalents use each document's stored exchange rate.
