-- Additive paid-credit evidence. Reviewed disposable installation only.
CREATE TABLE IF NOT EXISTS accounting_paid_credit_operations (
  company_id uuid NOT NULL REFERENCES companies(id),
  request_id uuid NOT NULL,
  credit_id uuid NOT NULL,
  actor_id text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^sha256:[a-f0-9]{64}$'),
  intent jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(company_id,request_id),
  UNIQUE(company_id,credit_id),
  FOREIGN KEY(company_id,credit_id) REFERENCES accounting_document_sources(company_id,id)
);
CREATE OR REPLACE FUNCTION accounting_paid_credit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Paid credit evidence is immutable'; END $$;
CREATE TRIGGER accounting_paid_credit_immutable BEFORE UPDATE OR DELETE ON accounting_paid_credit_operations
 FOR EACH ROW EXECUTE FUNCTION accounting_paid_credit_immutable();
CREATE TRIGGER accounting_paid_credit_no_truncate BEFORE TRUNCATE ON accounting_paid_credit_operations
 FOR EACH STATEMENT EXECUTE FUNCTION accounting_paid_credit_immutable();
ALTER TABLE accounting_paid_credit_operations ENABLE ALWAYS TRIGGER accounting_paid_credit_immutable;
ALTER TABLE accounting_paid_credit_operations ENABLE ALWAYS TRIGGER accounting_paid_credit_no_truncate;
REVOKE ALL ON accounting_paid_credit_operations FROM PUBLIC;
GRANT SELECT,INSERT ON accounting_paid_credit_operations TO ledgerly_api;
REVOKE UPDATE,DELETE,TRUNCATE ON accounting_paid_credit_operations FROM ledgerly_api;
