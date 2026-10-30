-- Coordinator-reviewed additive schema. Install only in a NEW, explicitly
-- disposable development database; never migrate an existing demo automatically.
CREATE UNIQUE INDEX IF NOT EXISTS canonical_journal_entries_company_identity
  ON canonical_journal_entries(company_id,id);

CREATE TABLE IF NOT EXISTS accounting_document_amendments (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  document_id uuid NOT NULL,
  sequence integer NOT NULL CHECK (sequence BETWEEN 1 AND 10000),
  previous_revision uuid NOT NULL,
  revision uuid NOT NULL CHECK (revision<>previous_revision),
  request_id uuid NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^sha256:[0-9a-f]{64}$'),
  review_token text NOT NULL CHECK (review_token ~ '^sha256:[0-9a-f]{64}$'),
  actor_id text NOT NULL CHECK (length(btrim(actor_id)) BETWEEN 1 AND 256),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 1000),
  effective_date date NOT NULL CHECK (effective_date BETWEEN DATE '1900-01-01' AND DATE '2199-12-31'),
  origin_journal_id uuid NOT NULL,
  journal_id uuid NOT NULL UNIQUE CHECK (journal_id<>origin_journal_id),
  financial_context_hash text NOT NULL CHECK (financial_context_hash ~ '^sha256:[0-9a-f]{64}$'),
  before_source jsonb NOT NULL CHECK (jsonb_typeof(before_source)='object'),
  after_source jsonb NOT NULL CHECK (jsonb_typeof(after_source)='object'),
  before_money jsonb NOT NULL CHECK (jsonb_typeof(before_money)='object'),
  after_money jsonb NOT NULL CHECK (jsonb_typeof(after_money)='object'),
  delta_money jsonb NOT NULL CHECK (jsonb_typeof(delta_money)='object'),
  after_tax_context jsonb NOT NULL CHECK (jsonb_typeof(after_tax_context)='object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(company_id,request_id),
  UNIQUE(company_id,document_id,sequence),
  UNIQUE(company_id,document_id,previous_revision),
  UNIQUE(company_id,document_id,revision),
  UNIQUE(company_id,document_id,revision,sequence),
  FOREIGN KEY(company_id,document_id) REFERENCES accounting_document_sources(company_id,id),
  FOREIGN KEY(company_id,origin_journal_id) REFERENCES canonical_journal_entries(company_id,id),
  FOREIGN KEY(company_id,journal_id) REFERENCES canonical_journal_entries(company_id,id)
);
CREATE INDEX IF NOT EXISTS accounting_document_amendments_date
  ON accounting_document_amendments(company_id,effective_date,document_id,sequence);

CREATE TABLE IF NOT EXISTS accounting_document_amendment_heads (
  company_id uuid NOT NULL,
  document_id uuid NOT NULL,
  current_revision uuid NOT NULL,
  sequence integer NOT NULL CHECK (sequence BETWEEN 1 AND 10000),
  PRIMARY KEY(company_id,document_id),
  FOREIGN KEY(company_id,document_id) REFERENCES accounting_document_sources(company_id,id),
  FOREIGN KEY(company_id,document_id,current_revision,sequence)
    REFERENCES accounting_document_amendments(company_id,document_id,revision,sequence)
);

CREATE OR REPLACE FUNCTION accounting_amendment_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Document amendments are immutable'; END $$;
DROP TRIGGER IF EXISTS accounting_amendment_immutable ON accounting_document_amendments;
CREATE TRIGGER accounting_amendment_immutable BEFORE UPDATE OR DELETE ON accounting_document_amendments
  FOR EACH ROW EXECUTE FUNCTION accounting_amendment_immutable();
DROP TRIGGER IF EXISTS accounting_amendment_no_truncate ON accounting_document_amendments;
CREATE TRIGGER accounting_amendment_no_truncate BEFORE TRUNCATE ON accounting_document_amendments
  FOR EACH STATEMENT EXECUTE FUNCTION accounting_amendment_immutable();
ALTER TABLE accounting_document_amendments ENABLE ALWAYS TRIGGER accounting_amendment_immutable;
ALTER TABLE accounting_document_amendments ENABLE ALWAYS TRIGGER accounting_amendment_no_truncate;

CREATE OR REPLACE FUNCTION accounting_amendment_head_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous uuid; initial uuid; origin uuid;
BEGIN
  IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'Document amendment heads cannot be removed'; END IF;
  SELECT a.previous_revision,d.revision,d.journal_id INTO previous,initial,origin
    FROM public.accounting_document_amendments a JOIN public.accounting_document_sources d
      ON d.company_id=a.company_id AND d.id=a.document_id
    WHERE a.company_id=NEW.company_id AND a.document_id=NEW.document_id
      AND a.revision=NEW.current_revision AND a.sequence=NEW.sequence
      AND d.status='posted' AND d.kind IN ('sales_invoice','purchase_bill')
      AND a.origin_journal_id=d.journal_id;
  IF previous IS NULL OR origin IS NULL THEN RAISE EXCEPTION 'Document amendment head has no matching posted source'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.sequence<>1 OR previous<>initial THEN RAISE EXCEPTION 'Document amendment head must begin at its original revision'; END IF;
  ELSIF NEW.company_id<>OLD.company_id OR NEW.document_id<>OLD.document_id OR
        NEW.sequence<>OLD.sequence+1 OR previous<>OLD.current_revision THEN
    RAISE EXCEPTION 'Document amendment head must advance one recorded revision';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS accounting_amendment_head_guard ON accounting_document_amendment_heads;
CREATE TRIGGER accounting_amendment_head_guard BEFORE INSERT OR UPDATE OR DELETE ON accounting_document_amendment_heads
  FOR EACH ROW EXECUTE FUNCTION accounting_amendment_head_guard();
DROP TRIGGER IF EXISTS accounting_amendment_head_no_truncate ON accounting_document_amendment_heads;
CREATE TRIGGER accounting_amendment_head_no_truncate BEFORE TRUNCATE ON accounting_document_amendment_heads
  FOR EACH STATEMENT EXECUTE FUNCTION accounting_amendment_head_guard();
ALTER TABLE accounting_document_amendment_heads ENABLE ALWAYS TRIGGER accounting_amendment_head_guard;
ALTER TABLE accounting_document_amendment_heads ENABLE ALWAYS TRIGGER accounting_amendment_head_no_truncate;

REVOKE ALL ON accounting_document_amendments,accounting_document_amendment_heads FROM PUBLIC;
GRANT SELECT,INSERT ON accounting_document_amendments,accounting_document_amendment_heads TO ledgerly_api;
GRANT UPDATE(current_revision,sequence) ON accounting_document_amendment_heads TO ledgerly_api;
REVOKE UPDATE,DELETE,TRUNCATE ON accounting_document_amendments FROM ledgerly_api;
REVOKE DELETE,TRUNCATE ON accounting_document_amendment_heads FROM ledgerly_api;
