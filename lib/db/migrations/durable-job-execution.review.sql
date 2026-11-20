-- Additive isolated-development execution journal; original queue/history remains unchanged.
CREATE TABLE public.durable_job_execution_events (
 company_id uuid NOT NULL, job_id text NOT NULL, sequence integer NOT NULL CHECK(sequence BETWEEN 1 AND 32),
 kind text NOT NULL CHECK(kind IN ('start','release','cancel','failure','result')),
 actor_id text NOT NULL CHECK(length(btrim(actor_id)) BETWEEN 1 AND 200),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=3145728),
 job_snapshot jsonb NOT NULL CHECK(jsonb_typeof(job_snapshot)='object' AND octet_length(job_snapshot::text)<=3145728),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,job_id,sequence),
 FOREIGN KEY(company_id,job_id) REFERENCES public.durable_jobs(company_id,job_id)
);
CREATE TABLE public.durable_job_execution_outbox (
 company_id uuid NOT NULL, job_id text NOT NULL, sequence integer NOT NULL,
 topic text NOT NULL CHECK(topic='document-intake.durable-execution.v1'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,job_id,sequence),
 FOREIGN KEY(company_id,job_id,sequence) REFERENCES public.durable_job_execution_events(company_id,job_id,sequence)
);
CREATE TRIGGER durable_job_execution_events_immutable BEFORE UPDATE OR DELETE ON public.durable_job_execution_events
 FOR EACH ROW EXECUTE FUNCTION public.durable_job_history_immutable();
CREATE TRIGGER durable_job_execution_events_no_truncate BEFORE TRUNCATE ON public.durable_job_execution_events
 FOR EACH STATEMENT EXECUTE FUNCTION public.durable_job_history_immutable();
ALTER TABLE public.durable_job_execution_events ENABLE ALWAYS TRIGGER durable_job_execution_events_immutable;
ALTER TABLE public.durable_job_execution_events ENABLE ALWAYS TRIGGER durable_job_execution_events_no_truncate;
ALTER TABLE public.durable_job_execution_events OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON public.durable_job_execution_events FROM PUBLIC,ledgerly_api;
GRANT SELECT,INSERT ON public.durable_job_execution_events TO ledgerly_api;
CREATE TRIGGER durable_job_execution_outbox_immutable BEFORE UPDATE OR DELETE ON public.durable_job_execution_outbox
 FOR EACH ROW EXECUTE FUNCTION public.durable_job_history_immutable();
CREATE TRIGGER durable_job_execution_outbox_no_truncate BEFORE TRUNCATE ON public.durable_job_execution_outbox
 FOR EACH STATEMENT EXECUTE FUNCTION public.durable_job_history_immutable();
ALTER TABLE public.durable_job_execution_outbox ENABLE ALWAYS TRIGGER durable_job_execution_outbox_immutable;
ALTER TABLE public.durable_job_execution_outbox ENABLE ALWAYS TRIGGER durable_job_execution_outbox_no_truncate;
ALTER TABLE public.durable_job_execution_outbox OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON public.durable_job_execution_outbox FROM PUBLIC,ledgerly_api;
GRANT SELECT,INSERT ON public.durable_job_execution_outbox TO ledgerly_api;
