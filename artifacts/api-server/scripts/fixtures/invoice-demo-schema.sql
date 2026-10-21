-- Empty, disposable invoice-slice database only. No data or account identities.
-- Not the full accounting schema and never a shared/production migration.
BEGIN;
DO $$
BEGIN
  IF current_database() <> 'ledgerly_w03_invoice_demo'
     OR current_user <> 'w03_bootstrap' OR inet_server_addr() IS NOT NULL
     OR to_regclass('public.companies') IS NOT NULL THEN
    RAISE EXCEPTION 'empty isolated invoice demo bootstrap database required';
  END IF;
END $$;
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  registration_number text, vat_number text, address_line_1 text, address_line_2 text,
  city text, county text, postcode text, country text DEFAULT 'GB', phone text,
  email text, logo_url text, financial_year_end text, base_currency text DEFAULT 'GBP',
  default_vat_rate numeric(5,2), vat_registered boolean DEFAULT false,
  vat_scheme text DEFAULT 'standard', vat_return_frequency text DEFAULT 'quarterly',
  vat_accounting_basis text DEFAULT 'invoice', vat_period_start date, vat_period_end date,
  vat_return_due_days integer DEFAULT 37, vat_registration_threshold numeric(12,2) DEFAULT 90000,
  vat_threshold_monitoring boolean DEFAULT true, invoice_prefix text,
  invoice_next_number integer DEFAULT 1, business_type text, status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.company_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id),
  user_id text NOT NULL, role text DEFAULT 'owner', is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id),
  name text NOT NULL, contact_name text, email text, phone text, address_line_1 text,
  address_line_2 text, city text, county text, postcode text, country text, vat_number text,
  customer_reference text, payment_terms integer DEFAULT 30, credit_limit numeric(12,2),
  status text DEFAULT 'active', notes text, tags jsonb,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.sales_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id),
  customer_id uuid, customer_name text, invoice_number text, issue_date date, due_date date,
  payment_terms integer, reference text, line_items jsonb, subtotal numeric(12,2),
  vat_total numeric(12,2), total numeric(12,2), amount_paid numeric(12,2) DEFAULT 0,
  balance_due numeric(12,2), status text DEFAULT 'draft', notes text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.vat_tax_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id),
  code text NOT NULL, label text NOT NULL, rate numeric(5,2) NOT NULL,
  treatment text NOT NULL DEFAULT 'standard', effective_from date NOT NULL, effective_to date,
  is_recoverable boolean DEFAULT true, is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
-- Empty guard projections used by the unchanged invoice source/link checks.
-- They do not provide or qualify any accounting posting or bank-feed workflow.
CREATE TABLE public.canonical_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, source_id text, status text
);
CREATE TABLE public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL,
  linked_invoice_id uuid, matched_record_id text, matched_type text
);
CREATE UNIQUE INDEX w03_active_membership_identity ON public.company_users(company_id,user_id) WHERE is_active=true;
CREATE UNIQUE INDEX w03_invoice_company_identity ON public.sales_invoices(id,company_id);
CREATE INDEX vat_tax_rules_company_active_idx ON public.vat_tax_rules(company_id,is_active);
CREATE UNIQUE INDEX vat_tax_rules_company_code_start_idx ON public.vat_tax_rules(company_id,code,effective_from);
CREATE TABLE public.w03_invoice_drafts (
  invoice_id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES public.companies(id),
  revision uuid NOT NULL, source jsonb NOT NULL, tax_context jsonb NOT NULL,
  FOREIGN KEY(invoice_id,company_id) REFERENCES public.sales_invoices(id,company_id)
);
CREATE TABLE public.w03_invoice_draft_audit (
  id uuid PRIMARY KEY, company_id uuid NOT NULL, invoice_id uuid NOT NULL, actor_id text NOT NULL,
  actor_role text NOT NULL CHECK(actor_role IN ('owner','admin','accountant')),
  operation text NOT NULL CHECK(operation IN ('create','update')), before_revision uuid,
  after_revision uuid NOT NULL, before_source jsonb, after_source jsonb NOT NULL,
  tax_context jsonb NOT NULL, tax_context_revision text NOT NULL, request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX w03_invoice_draft_audit_target ON public.w03_invoice_draft_audit(company_id,invoice_id);
CREATE FUNCTION public.w03_reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'W03 draft audit is append-only'; END $$;
CREATE TRIGGER w03_draft_audit_no_mutation BEFORE UPDATE OR DELETE OR TRUNCATE
  ON public.w03_invoice_draft_audit FOR EACH STATEMENT EXECUTE FUNCTION public.w03_reject_audit_mutation();
COMMIT;
