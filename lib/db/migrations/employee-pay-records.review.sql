-- Disposable employee pay record. Amounts are annual GBP salaries in whole pence.
CREATE TABLE public.employee_pay_records (
  company_id uuid NOT NULL REFERENCES public.companies(id),
  id uuid NOT NULL CHECK (id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab]'),
  employee_id uuid NOT NULL,
  effective_from date NOT NULL CHECK (effective_from BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),
  annual_salary_pence bigint NOT NULL CHECK (annual_salary_pence >= 0),
  PRIMARY KEY (company_id, id),
  UNIQUE (company_id, employee_id, effective_from)
);
ALTER TABLE public.employee_pay_records OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON public.employee_pay_records FROM PUBLIC, ledgerly_api;
GRANT SELECT ON public.employee_pay_records TO ledgerly_api;
