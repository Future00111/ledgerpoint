-- Additive disposable-only ordinary payment admission; never financial outcome authority.
CREATE TABLE public.payment_attempt_admissions (
 company_id uuid NOT NULL REFERENCES companies(id), request_id uuid NOT NULL,
 actor_id text NOT NULL, request_hash text NOT NULL CHECK(request_hash ~ '^sha256:[a-f0-9]{64}$'),
 review_hash text NOT NULL CHECK(review_hash ~ '^sha256:[a-f0-9]{64}$'),
 kind text NOT NULL CHECK(kind IN ('payment','allocation','unallocation','refund','reversal')),
 party_type text NOT NULL CHECK(party_type IN ('customer','supplier')),
 reference text NOT NULL CHECK(length(reference) BETWEEN 1 AND 200), effective_date date NOT NULL,
 amount_minor numeric(20,0) NOT NULL CHECK(amount_minor>0), admitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,request_id)
);
CREATE INDEX payment_attempt_actor ON public.payment_attempt_admissions(company_id,actor_id,admitted_at);
CREATE TABLE public.payment_attempt_no_effect (
 company_id uuid NOT NULL, request_id uuid NOT NULL, actor_id text NOT NULL,
 request_hash text NOT NULL, review_hash text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,request_id),
 FOREIGN KEY(company_id,request_id) REFERENCES public.payment_attempt_admissions(company_id,request_id)
);
CREATE FUNCTION public.payment_attempt_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Payment attempt history is immutable'; END $$;
CREATE TRIGGER payment_attempt_admission_immutable BEFORE UPDATE OR DELETE ON public.payment_attempt_admissions
 FOR EACH ROW EXECUTE FUNCTION public.payment_attempt_immutable();
CREATE TRIGGER payment_attempt_admission_no_truncate BEFORE TRUNCATE ON public.payment_attempt_admissions
 FOR EACH STATEMENT EXECUTE FUNCTION public.payment_attempt_immutable();
CREATE TRIGGER payment_attempt_terminal_immutable BEFORE UPDATE OR DELETE ON public.payment_attempt_no_effect
 FOR EACH ROW EXECUTE FUNCTION public.payment_attempt_immutable();
CREATE TRIGGER payment_attempt_terminal_no_truncate BEFORE TRUNCATE ON public.payment_attempt_no_effect
 FOR EACH STATEMENT EXECUTE FUNCTION public.payment_attempt_immutable();
ALTER TABLE public.payment_attempt_admissions ENABLE ALWAYS TRIGGER payment_attempt_admission_immutable;
ALTER TABLE public.payment_attempt_admissions ENABLE ALWAYS TRIGGER payment_attempt_admission_no_truncate;
ALTER TABLE public.payment_attempt_no_effect ENABLE ALWAYS TRIGGER payment_attempt_terminal_immutable;
ALTER TABLE public.payment_attempt_no_effect ENABLE ALWAYS TRIGGER payment_attempt_terminal_no_truncate;
REVOKE ALL ON public.payment_attempt_admissions,public.payment_attempt_no_effect FROM PUBLIC,ledgerly_api;
GRANT SELECT,INSERT ON public.payment_attempt_admissions,public.payment_attempt_no_effect TO ledgerly_api;
