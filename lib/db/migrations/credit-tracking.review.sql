-- Additive, reviewed development schema only. Never run against an existing
-- shared/production database automatically. Claims are operational records:
-- neither a journal entry nor a settlement instruction.
CREATE UNIQUE INDEX IF NOT EXISTS accounting_document_sources_company_id_idx
  ON accounting_document_sources(company_id,id);
CREATE TABLE IF NOT EXISTS supplier_credit_claims (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  bill_id uuid NOT NULL,
  bill_revision uuid NOT NULL,
  party_id uuid NOT NULL,
  original_line_ref integer NOT NULL CHECK (original_line_ref>=0),
  revision uuid NOT NULL,
  quantity text NOT NULL,
  description text NOT NULL,
  expected jsonb NOT NULL,
  reason text NOT NULL,
  return_reference text NOT NULL DEFAULT '',
  part_reference text NOT NULL DEFAULT '',
  job_reference text NOT NULL DEFAULT '',
  returned_on date,
  expected_by date,
  baseline_credit_ids jsonb NOT NULL,
  cancelled boolean NOT NULL DEFAULT false,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(company_id,id),
  FOREIGN KEY(company_id,bill_id) REFERENCES accounting_document_sources(company_id,id)
);
-- Initial slice: a line has one active tracker, with any number of partial receipts.
CREATE UNIQUE INDEX IF NOT EXISTS supplier_credit_claims_active_line_idx
  ON supplier_credit_claims(company_id,bill_id,original_line_ref) WHERE NOT cancelled;
CREATE TABLE IF NOT EXISTS supplier_credit_receipts (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  claim_id uuid NOT NULL,
  credit_id uuid NOT NULL,
  credit_revision uuid NOT NULL,
  credit_line_ref integer NOT NULL CHECK (credit_line_ref>=0),
  quantity text NOT NULL,
  money jsonb NOT NULL,
  confirmed_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(company_id,claim_id) REFERENCES supplier_credit_claims(company_id,id),
  FOREIGN KEY(company_id,credit_id) REFERENCES accounting_document_sources(company_id,id),
  UNIQUE(company_id,credit_id,credit_line_ref)
);
-- Commands are also the append-only audit: actor, request, input hash, outcome.
CREATE TABLE IF NOT EXISTS supplier_credit_claim_commands (
  company_id uuid NOT NULL REFERENCES companies(id),
  request_id uuid NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL CHECK(action IN ('create','receive','cancel')),
  request_hash text NOT NULL,
  claim_ids jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(company_id,request_id)
);
CREATE OR REPLACE FUNCTION supplier_credit_tracking_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Credit receipt and audit history are immutable';
END $$;
DROP TRIGGER IF EXISTS supplier_credit_receipts_immutable ON supplier_credit_receipts;
CREATE TRIGGER supplier_credit_receipts_immutable BEFORE UPDATE OR DELETE ON supplier_credit_receipts
  FOR EACH ROW EXECUTE FUNCTION supplier_credit_tracking_immutable();
DROP TRIGGER IF EXISTS supplier_credit_claim_commands_immutable ON supplier_credit_claim_commands;
CREATE TRIGGER supplier_credit_claim_commands_immutable BEFORE UPDATE OR DELETE ON supplier_credit_claim_commands
  FOR EACH ROW EXECUTE FUNCTION supplier_credit_tracking_immutable();
GRANT SELECT,INSERT ON supplier_credit_claims,supplier_credit_receipts,supplier_credit_claim_commands TO ledgerly_api;
GRANT UPDATE(revision,cancelled) ON supplier_credit_claims TO ledgerly_api;
REVOKE DELETE,TRUNCATE ON supplier_credit_claims FROM ledgerly_api;
REVOKE UPDATE,DELETE,TRUNCATE ON supplier_credit_receipts,supplier_credit_claim_commands FROM ledgerly_api;
