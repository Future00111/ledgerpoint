-- Additive disposable-only pre-execution queue. No execution or delivery lease exists yet.
CREATE TABLE public.durable_jobs (
 company_id uuid NOT NULL REFERENCES public.companies(id), job_id text NOT NULL CHECK(job_id ~ '^sha256:[a-f0-9]{64}$'),
 request_id uuid NOT NULL, source_id uuid NOT NULL, source_revision uuid NOT NULL,
 source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[a-f0-9]{64}$'),
 actor_id text NOT NULL CHECK(length(btrim(actor_id)) BETWEEN 1 AND 200),
 contract text NOT NULL CHECK(contract='document-intake.extraction-job.v1'), storage_version integer NOT NULL CHECK(storage_version=1),
 recipe_provider text NOT NULL CHECK(recipe_provider ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$'),
 recipe_version text NOT NULL CHECK(recipe_version ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$'),
 recipe_fingerprint text NOT NULL CHECK(recipe_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
 max_attempts integer NOT NULL CHECK(max_attempts BETWEEN 1 AND 5), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,job_id), UNIQUE(company_id,request_id),
 FOREIGN KEY(company_id,source_id) REFERENCES public.document_intake_sources(company_id,id)
);
CREATE INDEX durable_jobs_source ON public.durable_jobs(company_id,source_id);
CREATE TABLE public.durable_job_events (
 company_id uuid NOT NULL, job_id text NOT NULL, revision integer NOT NULL,
 status text NOT NULL, actor_id text NOT NULL CHECK(length(btrim(actor_id)) BETWEEN 1 AND 200),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,job_id,revision), UNIQUE(company_id,job_id,revision,status),
 FOREIGN KEY(company_id,job_id) REFERENCES public.durable_jobs(company_id,job_id),
 CHECK((revision=0 AND status='queued') OR (revision=1 AND status='cancelled'))
);
CREATE TABLE public.durable_outbox (
 company_id uuid NOT NULL, job_id text NOT NULL, revision integer NOT NULL, status text NOT NULL,
 topic text NOT NULL CHECK(topic='document-intake.lifecycle.v1'), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,job_id,revision),
 FOREIGN KEY(company_id,job_id,revision,status) REFERENCES public.durable_job_events(company_id,job_id,revision,status)
);
CREATE FUNCTION public.durable_job_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Durable job history is immutable'; END $$;
CREATE TRIGGER durable_jobs_immutable BEFORE UPDATE OR DELETE ON public.durable_jobs
 FOR EACH ROW EXECUTE FUNCTION public.durable_job_history_immutable();
CREATE TRIGGER durable_jobs_no_truncate BEFORE TRUNCATE ON public.durable_jobs
 FOR EACH STATEMENT EXECUTE FUNCTION public.durable_job_history_immutable();
ALTER TABLE public.durable_jobs ENABLE ALWAYS TRIGGER durable_jobs_immutable;
ALTER TABLE public.durable_jobs ENABLE ALWAYS TRIGGER durable_jobs_no_truncate;
ALTER TABLE public.durable_jobs OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON public.durable_jobs FROM PUBLIC,ledgerly_api;
GRANT SELECT,INSERT ON public.durable_jobs TO ledgerly_api;
CREATE TRIGGER durable_job_events_immutable BEFORE UPDATE OR DELETE ON public.durable_job_events
 FOR EACH ROW EXECUTE FUNCTION public.durable_job_history_immutable();
CREATE TRIGGER durable_job_events_no_truncate BEFORE TRUNCATE ON public.durable_job_events
 FOR EACH STATEMENT EXECUTE FUNCTION public.durable_job_history_immutable();
ALTER TABLE public.durable_job_events ENABLE ALWAYS TRIGGER durable_job_events_immutable;
ALTER TABLE public.durable_job_events ENABLE ALWAYS TRIGGER durable_job_events_no_truncate;
ALTER TABLE public.durable_job_events OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON public.durable_job_events FROM PUBLIC,ledgerly_api;
GRANT SELECT,INSERT ON public.durable_job_events TO ledgerly_api;
CREATE TRIGGER durable_outbox_immutable BEFORE UPDATE OR DELETE ON public.durable_outbox
 FOR EACH ROW EXECUTE FUNCTION public.durable_job_history_immutable();
CREATE TRIGGER durable_outbox_no_truncate BEFORE TRUNCATE ON public.durable_outbox
 FOR EACH STATEMENT EXECUTE FUNCTION public.durable_job_history_immutable();
ALTER TABLE public.durable_outbox ENABLE ALWAYS TRIGGER durable_outbox_immutable;
ALTER TABLE public.durable_outbox ENABLE ALWAYS TRIGGER durable_outbox_no_truncate;
ALTER TABLE public.durable_outbox OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON public.durable_outbox FROM PUBLIC,ledgerly_api;
GRANT SELECT,INSERT ON public.durable_outbox TO ledgerly_api;
ALTER FUNCTION public.durable_job_history_immutable() OWNER TO ledgerly_canonical_owner;
