-- Company-scoped, synthetic employee bank data for the disposable payroll workflow.
CREATE TABLE public.employee_bank_details (
  company_id uuid NOT NULL REFERENCES public.companies(id),
  employee_id uuid NOT NULL,
  account_number text NOT NULL CHECK (account_number ~ '^[0-9]{8}$'),
  PRIMARY KEY (company_id, employee_id)
);
ALTER TABLE public.employee_bank_details OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON public.employee_bank_details FROM PUBLIC, ledgerly_api;
GRANT SELECT ON public.employee_bank_details TO ledgerly_api;
