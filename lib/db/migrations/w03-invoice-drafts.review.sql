-- REVIEW SOURCE ONLY. Do not run against existing/shared/production databases.
-- Requires a separate schema/grant approval and an administrative migration channel.
BEGIN;
-- Fails closed if legacy data needs explicit duplicate-membership review.
CREATE UNIQUE INDEX w03_active_membership_identity ON company_users(company_id,user_id) WHERE is_active=true;
CREATE UNIQUE INDEX w03_invoice_company_identity ON sales_invoices(id,company_id);
CREATE TABLE w03_invoice_drafts (
  invoice_id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  revision uuid NOT NULL,
  source jsonb NOT NULL,
  tax_context jsonb NOT NULL,
  FOREIGN KEY(invoice_id,company_id) REFERENCES sales_invoices(id,company_id)
);
CREATE TABLE w03_invoice_draft_audit (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  actor_id text NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('owner','admin','accountant')),
  operation text NOT NULL CHECK (operation IN ('create','update')),
  before_revision uuid,
  after_revision uuid NOT NULL,
  before_source jsonb,
  after_source jsonb NOT NULL,
  tax_context_revision text NOT NULL,
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX w03_invoice_draft_audit_target ON w03_invoice_draft_audit(company_id,invoice_id);
CREATE FUNCTION w03_reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'W03 draft audit is append-only'; END $$;
CREATE TRIGGER w03_draft_audit_no_mutation BEFORE UPDATE OR DELETE OR TRUNCATE
  ON w03_invoice_draft_audit FOR EACH STATEMENT EXECUTE FUNCTION w03_reject_audit_mutation();
-- No runtime-role DDL, membership/grant broadening or automatic grants.
-- Review exact runtime INSERT/SELECT grants with this schema before activation.
COMMIT;
