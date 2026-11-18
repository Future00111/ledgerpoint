-- A single annual employment-income input, in GBP pence, for a company-scoped taxpayer.
-- Year range describes storage capacity only; calculation qualification is separate.
CREATE TABLE public.personal_tax_preparations (
  company_id uuid NOT NULL REFERENCES public.companies(id),
  id uuid NOT NULL CHECK (id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab]'),
  taxpayer_id uuid NOT NULL,
  tax_year_start integer NOT NULL CHECK (tax_year_start BETWEEN 1 AND 9998),
  employment_income_pence bigint NOT NULL CHECK (employment_income_pence >= 0),
  PRIMARY KEY (company_id, id),
  UNIQUE (company_id, taxpayer_id, tax_year_start)
);
ALTER TABLE public.personal_tax_preparations OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON public.personal_tax_preparations FROM PUBLIC, ledgerly_api;
GRANT SELECT ON public.personal_tax_preparations TO ledgerly_api;
