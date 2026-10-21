-- Reviewed additive schema; operator application only. No existing account/journal changes.
CREATE TABLE IF NOT EXISTS accounting_account_presentation (
  account_id uuid PRIMARY KEY REFERENCES chart_of_accounts(id),
  company_id uuid NOT NULL REFERENCES companies(id),
  report_group text CHECK (report_group IS NULL OR length(btrim(report_group)) BETWEEN 1 AND 80),
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order BETWEEN 0 AND 9999)
);
CREATE TABLE IF NOT EXISTS accounting_chart_audit (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  account_id uuid NOT NULL REFERENCES chart_of_accounts(id),
  actor_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('create','edit','archive','restore')),
  before_data jsonb,
  after_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE ON accounting_account_presentation TO ledgerly_api;
GRANT SELECT,INSERT ON accounting_chart_audit TO ledgerly_api;
REVOKE UPDATE,DELETE,TRUNCATE ON accounting_chart_audit FROM ledgerly_api;
