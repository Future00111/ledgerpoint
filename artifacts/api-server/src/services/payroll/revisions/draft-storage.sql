-- Disposable candidate for pay-run revision metadata. All rows are draft snapshots.
CREATE TABLE public.pay_run_draft_revisions (
  company_id uuid NOT NULL REFERENCES public.companies(id),
  run_id uuid NOT NULL,
  revision_number integer NOT NULL CHECK (revision_number > 0),
  revision_id uuid NOT NULL CHECK (revision_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab]'),
  period_start date NOT NULL,
  period_end date NOT NULL CHECK (period_end >= period_start),
  payday date NOT NULL,
  currency text NOT NULL CHECK (currency = 'GBP'),
  rules_version text NOT NULL CHECK (length(trim(rules_version)) > 0),
  prepared_by text NOT NULL CHECK (length(trim(prepared_by)) > 0),
  prepared_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  employee_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_breakdown jsonb GENERATED ALWAYS AS (public.pay_run_draft_breakdown(employee_lines)) STORED,
  PRIMARY KEY (company_id, run_id, revision_number),
  UNIQUE (company_id, revision_id)
);
ALTER TABLE public.pay_run_draft_revisions OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON public.pay_run_draft_revisions FROM PUBLIC, ledgerly_api;
GRANT SELECT ON public.pay_run_draft_revisions TO ledgerly_api;
CREATE TRIGGER pay_run_draft_revision_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
  ON public.pay_run_draft_revisions FOR EACH STATEMENT
  EXECUTE FUNCTION public.ledgerly_canonical_append_only_guard();
ALTER TABLE public.pay_run_draft_revisions ENABLE ALWAYS TRIGGER pay_run_draft_revision_immutable;
