-- Additive W06 schema. Install only in the documented isolated development DB.
CREATE TABLE IF NOT EXISTS accounting_payment_configuration (
  company_id uuid PRIMARY KEY REFERENCES companies(id),
  revision uuid NOT NULL,
  mappings jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS accounting_payment_events (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  party_id uuid NOT NULL,
  party_type text NOT NULL CHECK (party_type IN ('customer','supplier')),
  kind text NOT NULL CHECK (kind IN ('payment','allocation','unallocation','refund','reversal')),
  payment_id uuid REFERENCES accounting_payment_events(id),
  effective_date date NOT NULL,
  reference text NOT NULL,
  amount_minor numeric(20,0) NOT NULL CHECK (amount_minor>0),
  allocations jsonb NOT NULL,
  request_hash text NOT NULL,
  source jsonb NOT NULL,
  journal_id uuid NOT NULL UNIQUE REFERENCES canonical_journal_entries(id),
  actor_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(company_id,id),
  CHECK ((kind='payment' AND payment_id IS NULL) OR (kind<>'payment' AND payment_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS accounting_payment_events_party ON accounting_payment_events(company_id,party_id,effective_date);
CREATE INDEX IF NOT EXISTS accounting_payment_events_parent ON accounting_payment_events(company_id,payment_id);
CREATE TABLE IF NOT EXISTS accounting_payment_config_audit (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  actor_id text NOT NULL,
  before_config jsonb,
  after_config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION accounting_payment_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Payment history is immutable; use an allocation reversal or payment reversal'; END $$;
DROP TRIGGER IF EXISTS accounting_payment_immutable ON accounting_payment_events;
CREATE TRIGGER accounting_payment_immutable BEFORE UPDATE OR DELETE ON accounting_payment_events
 FOR EACH ROW EXECUTE FUNCTION accounting_payment_immutable();
GRANT SELECT,INSERT,UPDATE ON accounting_payment_configuration TO ledgerly_api;
GRANT SELECT,INSERT ON accounting_payment_events,accounting_payment_config_audit TO ledgerly_api;
REVOKE UPDATE,DELETE,TRUNCATE ON accounting_payment_events,accounting_payment_config_audit FROM ledgerly_api;
