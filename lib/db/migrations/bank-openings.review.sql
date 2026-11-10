-- Isolated development installation only. Opening receipts accompany canonical
-- journals in the same transaction; no UPDATE, DELETE or TRUNCATE authority.
CREATE TABLE accounting_bank_openings (
  company_id uuid NOT NULL REFERENCES companies(id),
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id),
  bank_ledger_account_id uuid NOT NULL REFERENCES chart_of_accounts(id),
  request_id uuid NOT NULL,
  intent jsonb NOT NULL,
  source jsonb NOT NULL,
  journal_id uuid NOT NULL UNIQUE REFERENCES canonical_journal_entries(id),
  actor_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(company_id,bank_account_id),
  UNIQUE(company_id,bank_ledger_account_id),
  UNIQUE(company_id,request_id)
);
CREATE FUNCTION accounting_bank_opening_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Posted bank opening receipts are immutable'; END $$;
CREATE TRIGGER accounting_bank_opening_immutable BEFORE UPDATE OR DELETE ON accounting_bank_openings
 FOR EACH ROW EXECUTE FUNCTION accounting_bank_opening_immutable();
CREATE TRIGGER accounting_bank_opening_no_truncate BEFORE TRUNCATE ON accounting_bank_openings
 FOR EACH STATEMENT EXECUTE FUNCTION accounting_bank_opening_immutable();
REVOKE ALL ON accounting_bank_openings FROM PUBLIC,ledgerly_api;
GRANT SELECT,INSERT ON accounting_bank_openings TO ledgerly_api;
-- Row locking needs an UPDATE privilege; no financial column is writable.
GRANT SELECT,UPDATE(id) ON bank_accounts TO ledgerly_api;
