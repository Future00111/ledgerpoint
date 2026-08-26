-- Ledgerly #44 / RS-01 disposable canonical-test security overlay.
-- This file is intentionally limited to the current development role model.
-- It must be executed as postgres against an empty disposable database after
-- the Drizzle schema has been applied. It does not create or alter roles.

DO $$
BEGIN
  EXECUTE format('REVOKE ALL PRIVILEGES ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO PUBLIC', current_database());
  EXECUTE format('GRANT ALL PRIVILEGES ON DATABASE %I TO postgres', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO ledgerly_api', current_database());
END
$$;

REVOKE ALL PRIVILEGES ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO pg_database_owner;
GRANT USAGE ON SCHEMA public TO ledgerly_api;

-- drizzle-kit 0.31 emits the relation FK before standalone indexes on a fresh
-- database. This is the exact unique index declared in the Drizzle schema and
-- may be applied between two non-force push passes to satisfy PostgreSQL's FK
-- prerequisite. The final push remains authoritative for the complete schema.
CREATE UNIQUE INDEX IF NOT EXISTS accounting_posting_effects_company_effect_idx
  ON public.accounting_posting_effects (company_id, economic_effect_id);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO ledgerly_api;

ALTER TABLE public.accounting_posting_effects OWNER TO ledgerly_canonical_owner;
ALTER TABLE public.canonical_journal_entries OWNER TO ledgerly_canonical_owner;
ALTER TABLE public.canonical_journal_lines OWNER TO ledgerly_canonical_owner;
ALTER TABLE public.canonical_journal_relations OWNER TO ledgerly_canonical_owner;
ALTER TABLE public.accounting_audit_events OWNER TO ledgerly_canonical_owner;

REVOKE ALL PRIVILEGES ON TABLE
  public.accounting_posting_effects,
  public.canonical_journal_entries,
  public.canonical_journal_lines,
  public.canonical_journal_relations,
  public.accounting_audit_events
FROM PUBLIC, ledgerly_api;

GRANT ALL PRIVILEGES ON TABLE
  public.accounting_posting_effects,
  public.canonical_journal_entries,
  public.canonical_journal_lines,
  public.canonical_journal_relations,
  public.accounting_audit_events
TO ledgerly_canonical_owner;

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.accounting_posting_effects
  TO ledgerly_api;

GRANT SELECT, INSERT
  ON TABLE
    public.canonical_journal_entries,
    public.canonical_journal_lines,
    public.canonical_journal_relations,
    public.accounting_audit_events
  TO ledgerly_api;

CREATE OR REPLACE FUNCTION public.ledgerly_canonical_append_only_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'P0001',
    MESSAGE = 'canonical accounting evidence is append-only';
END;
$function$;

CREATE OR REPLACE FUNCTION public.ledgerly_canonical_journal_header_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'P0001',
    MESSAGE = 'canonical journal headers are immutable';
END;
$function$;

CREATE OR REPLACE FUNCTION public.ledgerly_canonical_journal_line_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'P0001',
    MESSAGE = 'canonical journal lines are immutable';
END;
$function$;

CREATE OR REPLACE FUNCTION public.ledgerly_posting_effect_transition_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.status <> 'pending' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'posting effects permit only one pending finalization transition';
  END IF;
  IF OLD.id IS DISTINCT FROM NEW.id
     OR OLD.company_id IS DISTINCT FROM NEW.company_id
     OR OLD.source_type IS DISTINCT FROM NEW.source_type
     OR OLD.source_id IS DISTINCT FROM NEW.source_id
     OR OLD.posting_kind IS DISTINCT FROM NEW.posting_kind
     OR OLD.economic_effect_id IS DISTINCT FROM NEW.economic_effect_id
     OR OLD.idempotency_key IS DISTINCT FROM NEW.idempotency_key
     OR OLD.command_fingerprint IS DISTINCT FROM NEW.command_fingerprint
     OR OLD.source_revision IS DISTINCT FROM NEW.source_revision
     OR OLD.source_evidence_hash IS DISTINCT FROM NEW.source_evidence_hash
     OR OLD.created_by_type IS DISTINCT FROM NEW.created_by_type
     OR OLD.created_by_id IS DISTINCT FROM NEW.created_by_id
     OR OLD.created_at IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'posting-effect identity, source, company, or creator fields are immutable';
  END IF;
  IF OLD.journal_id IS NOT NULL OR OLD.result IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'posting-effect finalization can occur only from an unfinalized pending row';
  END IF;
  IF NEW.status = 'posted' THEN
    IF NEW.journal_id IS NULL
       OR NEW.result IS NULL
       OR jsonb_typeof(NEW.result) <> 'object'
       OR NEW.result->>'journalId' IS DISTINCT FROM NEW.journal_id::text
       OR btrim(COALESCE(NEW.result->>'totalDebitMinor', '')) = ''
       OR btrim(COALESCE(NEW.result->>'totalCreditMinor', '')) = ''
    THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'posted effect requires a complete matching canonical result';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.canonical_journal_entries j
      WHERE j.id = NEW.journal_id
        AND j.company_id = NEW.company_id
        AND j.source_type = NEW.source_type
        AND j.source_id = NEW.source_id
        AND j.posting_kind = NEW.posting_kind
        AND j.economic_effect_id = NEW.economic_effect_id
        AND j.status = 'posted'
        AND j.total_debit_minor::text = NEW.result->>'totalDebitMinor'
        AND j.total_credit_minor::text = NEW.result->>'totalCreditMinor'
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'posted effect result does not match its canonical journal identity';
    END IF;
  ELSIF NEW.status = 'uncertain' THEN
    IF NEW.journal_id IS NOT NULL
       OR NEW.result IS NULL
       OR jsonb_typeof(NEW.result) <> 'object'
       OR btrim(COALESCE(NEW.result->>'reason', '')) = ''
    THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'uncertain effect requires a durable recovery reason and no journal';
    END IF;
  ELSE
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'posting-effect status transition is not approved';
  END IF;
  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.ledgerly_canonical_append_only_guard()
  OWNER TO ledgerly_canonical_owner;
ALTER FUNCTION public.ledgerly_canonical_journal_header_guard()
  OWNER TO ledgerly_canonical_owner;
ALTER FUNCTION public.ledgerly_canonical_journal_line_guard()
  OWNER TO ledgerly_canonical_owner;
ALTER FUNCTION public.ledgerly_posting_effect_transition_guard()
  OWNER TO ledgerly_canonical_owner;

REVOKE ALL PRIVILEGES ON FUNCTION
  public.ledgerly_canonical_append_only_guard(),
  public.ledgerly_canonical_journal_header_guard(),
  public.ledgerly_canonical_journal_line_guard(),
  public.ledgerly_posting_effect_transition_guard()
FROM PUBLIC, ledgerly_api;

GRANT EXECUTE ON FUNCTION
  public.ledgerly_canonical_append_only_guard(),
  public.ledgerly_canonical_journal_header_guard(),
  public.ledgerly_canonical_journal_line_guard(),
  public.ledgerly_posting_effect_transition_guard()
TO ledgerly_canonical_owner, ledgerly_api;

CREATE OR REPLACE FUNCTION public.ledgerly_verify_disposable_run(
  p_run_uuid uuid,
  p_database_name text,
  p_environment text,
  p_creator_identity text,
  p_application_schema_digest text,
  p_drizzle_config_digest text,
  p_security_overlay_digest text,
  p_expected_test_command text,
  p_run_binding_nonce text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'ledgerly_test_control'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM ledgerly_test_control.run_identity r
    WHERE r.run_uuid = p_run_uuid
      AND r.expected_database_name = p_database_name
      AND r.environment = p_environment
      AND r.creator_identity = p_creator_identity
      AND r.application_schema_digest = p_application_schema_digest
      AND r.drizzle_config_digest = p_drizzle_config_digest
      AND r.security_overlay_digest = p_security_overlay_digest
      AND r.expected_test_command = p_expected_test_command
      AND r.run_binding_nonce = p_run_binding_nonce
  );
$function$;

ALTER FUNCTION public.ledgerly_verify_disposable_run(
  uuid, text, text, text, text, text, text, text, text
) OWNER TO postgres;

REVOKE ALL PRIVILEGES ON FUNCTION public.ledgerly_verify_disposable_run(
  uuid, text, text, text, text, text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ledgerly_verify_disposable_run(
  uuid, text, text, text, text, text, text, text, text
) TO ledgerly_api;

DROP TRIGGER IF EXISTS ledgerly_canonical_journal_entries_guard
  ON public.canonical_journal_entries;
CREATE TRIGGER ledgerly_canonical_journal_entries_guard
BEFORE DELETE OR UPDATE ON public.canonical_journal_entries
FOR EACH ROW
EXECUTE FUNCTION public.ledgerly_canonical_journal_header_guard();

DROP TRIGGER IF EXISTS ledgerly_canonical_journal_lines_guard
  ON public.canonical_journal_lines;
CREATE TRIGGER ledgerly_canonical_journal_lines_guard
BEFORE DELETE OR UPDATE ON public.canonical_journal_lines
FOR EACH ROW
EXECUTE FUNCTION public.ledgerly_canonical_journal_line_guard();

DROP TRIGGER IF EXISTS ledgerly_canonical_journal_relations_guard
  ON public.canonical_journal_relations;
CREATE TRIGGER ledgerly_canonical_journal_relations_guard
BEFORE DELETE OR UPDATE ON public.canonical_journal_relations
FOR EACH ROW
EXECUTE FUNCTION public.ledgerly_canonical_append_only_guard();

DROP TRIGGER IF EXISTS ledgerly_accounting_audit_events_guard
  ON public.accounting_audit_events;
CREATE TRIGGER ledgerly_accounting_audit_events_guard
BEFORE DELETE OR UPDATE ON public.accounting_audit_events
FOR EACH ROW
EXECUTE FUNCTION public.ledgerly_canonical_append_only_guard();

DROP TRIGGER IF EXISTS ledgerly_accounting_posting_effects_guard
  ON public.accounting_posting_effects;
CREATE TRIGGER ledgerly_accounting_posting_effects_guard
BEFORE DELETE OR UPDATE ON public.accounting_posting_effects
FOR EACH ROW
EXECUTE FUNCTION public.ledgerly_posting_effect_transition_guard();

ALTER TABLE public.canonical_journal_entries
  ENABLE ALWAYS TRIGGER ledgerly_canonical_journal_entries_guard;
ALTER TABLE public.canonical_journal_lines
  ENABLE ALWAYS TRIGGER ledgerly_canonical_journal_lines_guard;
ALTER TABLE public.canonical_journal_relations
  ENABLE ALWAYS TRIGGER ledgerly_canonical_journal_relations_guard;
ALTER TABLE public.accounting_audit_events
  ENABLE ALWAYS TRIGGER ledgerly_accounting_audit_events_guard;
ALTER TABLE public.accounting_posting_effects
  ENABLE ALWAYS TRIGGER ledgerly_accounting_posting_effects_guard;