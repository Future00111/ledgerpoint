-- Disposable employee pay record. Amounts are annual GBP salaries in whole pence.
CREATE TABLE public.employee_pay_records (
  company_id uuid NOT NULL REFERENCES public.companies(id),
  id uuid NOT NULL CHECK (substr(id::text, 15, 1) BETWEEN '1' AND '8' AND substr(id::text, 20, 1) IN ('8','9','a','b')),
  employee_id uuid NOT NULL,
  effective_from date NOT NULL CHECK (effective_from BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),
  annual_salary_pence bigint NOT NULL CHECK (annual_salary_pence >= 0),
  PRIMARY KEY (company_id, id),
  UNIQUE (company_id, employee_id, effective_from)
);
ALTER TABLE public.employee_pay_records OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON public.employee_pay_records FROM PUBLIC, ledgerly_api;
GRANT SELECT ON public.employee_pay_records TO ledgerly_api;
