-- Reviewable application schema. Applied ONLY to the explicitly isolated local
-- development database by tools/accounting-flow/setup.mjs; not a production migration.
CREATE TABLE IF NOT EXISTS accounting_company_configuration (
  company_id uuid PRIMARY KEY REFERENCES companies(id),
  revision uuid NOT NULL,
  business_accounting_basis text NOT NULL CHECK (business_accounting_basis='accrual'),
  mappings jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS accounting_document_periods (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  financial_year_id text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL CHECK (end_date>=start_date),
  status text NOT NULL CHECK (status IN ('OPEN','CLOSED'))
);
CREATE TABLE IF NOT EXISTS accounting_document_sources (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  kind text NOT NULL CHECK (kind IN ('sales_invoice','sales_credit_note','purchase_bill','supplier_credit_note')),
  number text NOT NULL,
  revision uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','posted')),
  source jsonb NOT NULL,
  party_id uuid NOT NULL,
  original_id uuid REFERENCES accounting_document_sources(id),
  reason text NOT NULL DEFAULT '',
  adjustment_method text,
  effective_adjustment_date date,
  purchase_vat_eligible boolean NOT NULL,
  posting_account_id uuid,
  money jsonb NOT NULL,
  tax_context jsonb NOT NULL,
  posting_accounts jsonb NOT NULL,
  mapping_revision uuid NOT NULL,
  journal_id uuid REFERENCES canonical_journal_entries(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(company_id,kind,number),
  CHECK ((status='draft' AND journal_id IS NULL) OR (status='posted' AND journal_id IS NOT NULL)),
  CHECK ((kind IN ('sales_credit_note','supplier_credit_note') AND original_id IS NOT NULL
     AND adjustment_method='offset_outstanding' AND effective_adjustment_date IS NOT NULL AND length(trim(reason))>0)
    OR (kind IN ('sales_invoice','purchase_bill') AND original_id IS NULL AND adjustment_method IS NULL AND effective_adjustment_date IS NULL))
);
CREATE INDEX IF NOT EXISTS accounting_document_sources_original_idx ON accounting_document_sources(company_id,original_id,status);
CREATE TABLE IF NOT EXISTS accounting_document_audit (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  document_id uuid NOT NULL REFERENCES accounting_document_sources(id),
  actor_id text NOT NULL,
  action text NOT NULL,
  before_source jsonb,
  after_source jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION accounting_document_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR OLD.status='posted' THEN
    RAISE EXCEPTION 'Posted accounting sources are immutable; use a linked credit';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS accounting_document_immutable ON accounting_document_sources;
CREATE TRIGGER accounting_document_immutable BEFORE UPDATE OR DELETE ON accounting_document_sources
 FOR EACH ROW EXECUTE FUNCTION accounting_document_immutable();
