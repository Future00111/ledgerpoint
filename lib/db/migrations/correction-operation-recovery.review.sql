-- Additive disposable-only correction recovery; admission is never a financial outcome.
CREATE UNIQUE INDEX IF NOT EXISTS accounting_document_sources_company_id_idx ON public.accounting_document_sources(company_id,id);
CREATE TABLE public.correction_attempt_admissions (
 company_id uuid NOT NULL, request_id uuid NOT NULL, document_id uuid NOT NULL,
 actor_id text NOT NULL CHECK(length(btrim(actor_id)) BETWEEN 1 AND 256), expected_revision uuid NOT NULL,
 request_hash text NOT NULL CHECK(request_hash ~ '^sha256:[a-f0-9]{64}$'),
 review_hash text NOT NULL CHECK(review_hash ~ '^sha256:[a-f0-9]{64}$'),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 1000),
 effective_date date NOT NULL CHECK(effective_date BETWEEN DATE '1900-01-01' AND DATE '2199-12-31'),
 admitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,request_id),
 UNIQUE(company_id,request_id,document_id,actor_id,expected_revision,request_hash,review_hash),
 FOREIGN KEY(company_id,document_id) REFERENCES public.accounting_document_sources(company_id,id)
);
CREATE INDEX correction_attempt_actor_document ON public.correction_attempt_admissions(company_id,actor_id,document_id,admitted_at);
CREATE TABLE public.correction_attempt_no_effect (
 company_id uuid NOT NULL, request_id uuid NOT NULL, document_id uuid NOT NULL, actor_id text NOT NULL,
 expected_revision uuid NOT NULL, request_hash text NOT NULL, review_hash text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(company_id,request_id),
 FOREIGN KEY(company_id,request_id,document_id,actor_id,expected_revision,request_hash,review_hash)
 REFERENCES public.correction_attempt_admissions(company_id,request_id,document_id,actor_id,expected_revision,request_hash,review_hash)
);
CREATE FUNCTION public.correction_attempt_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Correction attempt history is immutable'; END $$;
CREATE TRIGGER correction_attempt_admission_immutable BEFORE UPDATE OR DELETE ON public.correction_attempt_admissions
 FOR EACH ROW EXECUTE FUNCTION public.correction_attempt_immutable();
CREATE TRIGGER correction_attempt_admission_no_truncate BEFORE TRUNCATE ON public.correction_attempt_admissions
 FOR EACH STATEMENT EXECUTE FUNCTION public.correction_attempt_immutable();
CREATE TRIGGER correction_attempt_terminal_immutable BEFORE UPDATE OR DELETE ON public.correction_attempt_no_effect
 FOR EACH ROW EXECUTE FUNCTION public.correction_attempt_immutable();
CREATE TRIGGER correction_attempt_terminal_no_truncate BEFORE TRUNCATE ON public.correction_attempt_no_effect
 FOR EACH STATEMENT EXECUTE FUNCTION public.correction_attempt_immutable();
ALTER TABLE public.correction_attempt_admissions ENABLE ALWAYS TRIGGER correction_attempt_admission_immutable;
ALTER TABLE public.correction_attempt_admissions ENABLE ALWAYS TRIGGER correction_attempt_admission_no_truncate;
ALTER TABLE public.correction_attempt_no_effect ENABLE ALWAYS TRIGGER correction_attempt_terminal_immutable;
ALTER TABLE public.correction_attempt_no_effect ENABLE ALWAYS TRIGGER correction_attempt_terminal_no_truncate;
REVOKE ALL ON public.correction_attempt_admissions,public.correction_attempt_no_effect FROM PUBLIC,ledgerly_api;
GRANT SELECT,INSERT ON public.correction_attempt_admissions,public.correction_attempt_no_effect TO ledgerly_api;
