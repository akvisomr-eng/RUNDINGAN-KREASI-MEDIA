-- 20261104_009_ar_ap_cash_bank
-- Additive subledger foundation: customer invoices, supplier bills, settlements and bank statement lines.
ALTER TABLE finance_tax_codes ADD CONSTRAINT finance_tax_codes_org_id_uq UNIQUE(organization_id,id);
ALTER TABLE finance_bank_reconciliations ADD CONSTRAINT finance_bank_reconciliations_org_id_uq UNIQUE(organization_id,id);

CREATE TABLE IF NOT EXISTS finance_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
 document_type text NOT NULL CHECK(document_type IN ('sales_invoice','purchase_bill','sales_credit_note','purchase_debit_note')),
 document_number text NOT NULL, external_reference text, document_date date NOT NULL, due_date date NOT NULL, party_id uuid NOT NULL,
 source_module_code text REFERENCES module_catalog(code), business_unit_id uuid, project_id uuid,
 currency char(3) NOT NULL DEFAULT 'IDR', exchange_rate numeric(18,8) NOT NULL DEFAULT 1 CHECK(exchange_rate>0),
 receivable_payable_account_id uuid NOT NULL, subtotal numeric(18,2) NOT NULL DEFAULT 0 CHECK(subtotal>=0),
 discount_total numeric(18,2) NOT NULL DEFAULT 0 CHECK(discount_total>=0), tax_total numeric(18,2) NOT NULL DEFAULT 0 CHECK(tax_total>=0),
 total_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK(total_amount>=0), settled_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK(settled_amount>=0 AND settled_amount<=total_amount),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','posted','part_paid','paid','void')),
 notes text, attachment_refs jsonb NOT NULL DEFAULT '[]'::jsonb, journal_id uuid, created_by text NOT NULL, approved_by text, approved_at timestamptz, posted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id), UNIQUE(organization_id,document_type,document_number),
 FOREIGN KEY(organization_id,party_id) REFERENCES parties(organization_id,id),
 FOREIGN KEY(organization_id,business_unit_id) REFERENCES business_units(organization_id,id),
 FOREIGN KEY(organization_id,project_id) REFERENCES finance_projects(organization_id,id),
 FOREIGN KEY(organization_id,receivable_payable_account_id) REFERENCES finance_accounts(organization_id,id),
 FOREIGN KEY(organization_id,journal_id) REFERENCES finance_journals(organization_id,id), CHECK(due_date>=document_date)
);
CREATE TABLE IF NOT EXISTS finance_document_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, document_id uuid NOT NULL, line_number integer NOT NULL,
 description text NOT NULL, quantity numeric(18,4) NOT NULL DEFAULT 1 CHECK(quantity>0), unit text NOT NULL DEFAULT 'unit',
 unit_price numeric(18,2) NOT NULL CHECK(unit_price>=0), discount_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK(discount_amount>=0),
 tax_code_id uuid, account_id uuid NOT NULL, cost_center_id uuid, project_id uuid,
 tax_base numeric(18,2) NOT NULL DEFAULT 0 CHECK(tax_base>=0), tax_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK(tax_amount>=0),
 line_total numeric(18,2) NOT NULL DEFAULT 0 CHECK(line_total>=0), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(document_id,line_number), FOREIGN KEY(organization_id,document_id) REFERENCES finance_documents(organization_id,id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,account_id) REFERENCES finance_accounts(organization_id,id),
 FOREIGN KEY(organization_id,cost_center_id) REFERENCES finance_cost_centers(organization_id,id),
 FOREIGN KEY(organization_id,project_id) REFERENCES finance_projects(organization_id,id),
 FOREIGN KEY(organization_id,tax_code_id) REFERENCES finance_tax_codes(organization_id,id)
);
CREATE TABLE IF NOT EXISTS finance_settlements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
 settlement_type text NOT NULL CHECK(settlement_type IN ('customer_receipt','supplier_payment')), settlement_number text NOT NULL,
 settlement_date date NOT NULL, party_id uuid NOT NULL, bank_account_id uuid NOT NULL, amount numeric(18,2) NOT NULL CHECK(amount>0),
 currency char(3) NOT NULL DEFAULT 'IDR', exchange_rate numeric(18,8) NOT NULL DEFAULT 1 CHECK(exchange_rate>0),
 payment_method text NOT NULL DEFAULT 'bank_transfer', bank_reference text, notes text,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','posted','void')), journal_id uuid, created_by text NOT NULL,
 posted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,id), UNIQUE(organization_id,settlement_number),
 FOREIGN KEY(organization_id,party_id) REFERENCES parties(organization_id,id),
 FOREIGN KEY(organization_id,bank_account_id) REFERENCES finance_bank_accounts(organization_id,id),
 FOREIGN KEY(organization_id,journal_id) REFERENCES finance_journals(organization_id,id)
);
CREATE TABLE IF NOT EXISTS finance_settlement_allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, settlement_id uuid NOT NULL, document_id uuid NOT NULL,
 amount numeric(18,2) NOT NULL CHECK(amount>0), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(settlement_id,document_id),
 FOREIGN KEY(organization_id,settlement_id) REFERENCES finance_settlements(organization_id,id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,document_id) REFERENCES finance_documents(organization_id,id)
);
CREATE TABLE IF NOT EXISTS finance_bank_statement_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, bank_account_id uuid NOT NULL, reconciliation_id uuid NOT NULL,
 transaction_date date NOT NULL, value_date date, reference_no text, description text, debit numeric(18,2) NOT NULL DEFAULT 0 CHECK(debit>=0),
 credit numeric(18,2) NOT NULL DEFAULT 0 CHECK(credit>=0), matched_journal_id uuid, matched_at timestamptz, matched_by text,
 created_at timestamptz NOT NULL DEFAULT now(), CHECK((debit>0 AND credit=0) OR (credit>0 AND debit=0)),
 FOREIGN KEY(organization_id,bank_account_id) REFERENCES finance_bank_accounts(organization_id,id),
 FOREIGN KEY(organization_id,reconciliation_id) REFERENCES finance_bank_reconciliations(organization_id,id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,matched_journal_id) REFERENCES finance_journals(organization_id,id)
);
ALTER TABLE finance_bank_reconciliations ADD COLUMN IF NOT EXISTS reviewed_by text, ADD COLUMN IF NOT EXISTS reviewed_at timestamptz, ADD COLUMN IF NOT EXISTS finalized_by text;
CREATE INDEX IF NOT EXISTS finance_documents_ar_ap_idx ON finance_documents(organization_id,document_type,status,due_date);
CREATE INDEX IF NOT EXISTS finance_document_lines_document_idx ON finance_document_lines(organization_id,document_id);
CREATE INDEX IF NOT EXISTS finance_settlements_date_idx ON finance_settlements(organization_id,settlement_date,status);
CREATE INDEX IF NOT EXISTS finance_bank_statement_recon_idx ON finance_bank_statement_lines(organization_id,reconciliation_id,transaction_date);
INSERT INTO permissions(code,module,description) VALUES
('finance.ar.read','finance','View accounts receivable'),('finance.ar.manage','finance','Create and manage customer invoices and credit notes'),
('finance.ap.read','finance','View accounts payable'),('finance.ap.manage','finance','Create and manage supplier bills and debit notes'),
('finance.cash.read','finance','View cash and bank transactions'),('finance.cash.manage','finance','Create receipts, payments and bank reconciliations')
ON CONFLICT(code) DO UPDATE SET module=EXCLUDED.module,description=EXCLUDED.description;
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN organizations o ON o.id=r.organization_id
JOIN permissions p ON p.code IN ('finance.ar.read','finance.ar.manage','finance.ap.read','finance.ap.manage','finance.cash.read','finance.cash.manage')
WHERE o.slug='rundingan-kreasi-media' AND r.code IN ('owner','administrator') ON CONFLICT(role_id,permission_id) DO NOTHING;
GRANT SELECT,INSERT,UPDATE ON TABLE finance_documents,finance_document_lines,finance_settlements,finance_settlement_allocations,finance_bank_statement_lines,finance_bank_reconciliations TO rundingan_app_limited;
INSERT INTO schema_migrations(version,description,applied_at) VALUES('20261104_009_ar_ap_cash_bank','Add AR/AP documents, allocations, receipts/payments and bank statement reconciliation lines',now()) ON CONFLICT(version) DO NOTHING;
