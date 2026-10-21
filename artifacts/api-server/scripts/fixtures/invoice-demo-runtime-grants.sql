-- Isolated development fixture only. Never a shared/production migration.
-- The lock privileges are needed by the unchanged financial source checks on
-- reopen/edit; SELECT alone does not permit PostgreSQL SELECT ... FOR SHARE.
BEGIN;
DO $$
BEGIN
  IF current_database() <> 'ledgerly_w03_invoice_demo'
     OR current_user <> 'w03_bootstrap'
     OR inet_server_addr() IS NOT NULL THEN
    RAISE EXCEPTION 'isolated invoice demo bootstrap connection required';
  END IF;
END $$;
GRANT CONNECT ON DATABASE ledgerly_w03_invoice_demo TO ledgerly_api;
GRANT USAGE ON SCHEMA public TO ledgerly_api;
GRANT SELECT ON companies,company_users,customers,vat_tax_rules,sales_invoices,
  w03_invoice_drafts,w03_invoice_draft_audit,canonical_journal_entries,bank_transactions TO ledgerly_api;
GRANT INSERT,UPDATE ON companies,company_users,customers,vat_tax_rules,
  sales_invoices,w03_invoice_drafts TO ledgerly_api;
GRANT INSERT ON w03_invoice_draft_audit TO ledgerly_api;
GRANT UPDATE(id) ON canonical_journal_entries,bank_transactions TO ledgerly_api;
REVOKE UPDATE,DELETE,TRUNCATE ON w03_invoice_draft_audit FROM ledgerly_api;
COMMIT;
