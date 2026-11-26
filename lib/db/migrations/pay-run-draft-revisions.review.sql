-- Each draft line currently names one dated annual-pay input for the entire period.
CREATE FUNCTION public.check_pay_run_draft_sources() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE
  next_revision bigint;
BEGIN
  -- A pinned transaction snapshot cannot re-read a source committed during a lock wait.
  IF current_setting('transaction_isolation') NOT IN ('read committed','read uncommitted') THEN
    RAISE EXCEPTION 'Draft admission requires a fresh committed snapshot' USING ERRCODE='25000';
  END IF;
  -- Native pay-input creation takes this same company lock before inserting.
  PERFORM id FROM public.companies WHERE id = NEW.company_id FOR UPDATE;
  -- The requested successor identifies the head the preparer saw. Immutable history
  -- makes the revision number unambiguous within this company and run.
  SELECT coalesce(max(revision_number)::bigint, 0) + 1 INTO next_revision
    FROM public.pay_run_draft_revisions
    WHERE company_id = NEW.company_id AND run_id = NEW.run_id;
  IF NEW.revision_number < next_revision THEN
    RAISE EXCEPTION 'Draft revision already exists; reload the run' USING ERRCODE='23505';
  ELSIF NEW.revision_number > next_revision THEN
    RAISE EXCEPTION 'Draft revision must follow the current head' USING ERRCODE='23514';
  END IF;
  -- The generated breakdown column rejects malformed structures after BEFORE triggers.
  IF jsonb_typeof(NEW.employee_lines) IS DISTINCT FROM 'array' THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.employee_lines) AS line
    LEFT JOIN LATERAL (
      SELECT p.id, p.effective_from FROM public.employee_pay_records p
      WHERE p.company_id = NEW.company_id AND p.employee_id = CASE WHEN line->>'employee_id' ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
          THEN (line->>'employee_id')::uuid END
        AND p.effective_from <= NEW.period_end
      ORDER BY p.effective_from DESC LIMIT 1
    ) AS effective ON true
    WHERE effective.id IS NULL OR effective.id::text IS DISTINCT FROM line->>'input_revision_id'
       OR effective.effective_from > NEW.period_start
  ) THEN
    RAISE EXCEPTION 'Draft line requires one matching pay input for the full period' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.check_pay_run_draft_sources() OWNER TO ledgerly_canonical_owner;

-- Validate the private employee snapshot once, then materialise its review projection.
-- Integer minor units travel as decimal strings to preserve precision in JSON clients.
CREATE FUNCTION public.pay_run_draft_breakdown(lines jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = pg_catalog AS $$
DECLARE
  item jsonb;
  component record;
  total_gross numeric := 0;
  total_net numeric := 0;
  gross numeric;
  net numeric;
  deduction numeric;
  adjustment numeric;
  totals jsonb := '{"deductions": {}, "adjustments": {}}';
  kind text;
  visible jsonb;
BEGIN
  IF jsonb_typeof(lines) <> 'array' THEN RAISE EXCEPTION 'Invalid draft lines' USING ERRCODE='23514'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(lines) LOOP
    IF jsonb_typeof(item) <> 'object' OR NOT item ?& ARRAY['line_id','employee_id','input_revision_id','gross','net','deductions','adjustments']
      OR item - ARRAY['line_id','employee_id','input_revision_id','gross','net','deductions','adjustments'] <> '{}'::jsonb
      OR jsonb_typeof(item->'gross') <> 'string' OR jsonb_typeof(item->'net') <> 'string'
      OR item->>'gross' !~ '^(0|-?[1-9][0-9]{0,17})$' OR item->>'net' !~ '^(0|-?[1-9][0-9]{0,17})$'
      OR jsonb_typeof(item->'deductions') <> 'object' OR jsonb_typeof(item->'adjustments') <> 'object'
    THEN RAISE EXCEPTION 'Invalid draft line' USING ERRCODE='23514'; END IF;
    FOREACH kind IN ARRAY ARRAY['line_id','employee_id','input_revision_id'] LOOP
      IF jsonb_typeof(item->kind) <> 'string' OR item->>kind !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      THEN RAISE EXCEPTION 'Invalid draft reference' USING ERRCODE='23514'; END IF;
    END LOOP;
    gross := (item->>'gross')::numeric;
    net := (item->>'net')::numeric;
    deduction := 0;
    adjustment := 0;
    FOREACH kind IN ARRAY ARRAY['deductions','adjustments'] LOOP
      FOR component IN SELECT key,value FROM jsonb_each(item->kind) LOOP
        IF (kind='deductions' AND component.key NOT IN ('paye','employee_ni','student_loan','postgraduate_loan','priority_order'))
          OR (component.key='priority_order' AND left(component.value #>> '{}',1)='-')
          OR (kind='adjustments' AND component.key NOT IN ('rounding','correction')) OR jsonb_typeof(component.value) <> 'string'
          OR (component.value #>> '{}') !~ '^(0|-?[1-9][0-9]{0,17})$'
        THEN RAISE EXCEPTION 'Invalid draft component' USING ERRCODE='23514'; END IF;
        IF kind='deductions' THEN deduction := deduction + (component.value #>> '{}')::numeric;
        ELSE adjustment := adjustment + (component.value #>> '{}')::numeric; END IF;
        totals := jsonb_set(totals, ARRAY[kind,component.key], to_jsonb(
          (coalesce((totals #>> ARRAY[kind,component.key])::numeric,0) + (component.value #>> '{}')::numeric)::text));
      END LOOP;
    END LOOP;
    IF net <> gross - deduction + adjustment THEN RAISE EXCEPTION 'Draft amounts do not reconcile' USING ERRCODE='23514'; END IF;
    total_gross := total_gross + gross;
    total_net := total_net + net;
  END LOOP;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(lines) l GROUP BY l->>'line_id' HAVING count(*)>1)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(lines) l GROUP BY l->>'employee_id' HAVING count(*)>1)
  THEN RAISE EXCEPTION 'Duplicate draft employee line' USING ERRCODE='23514'; END IF;
  IF EXISTS (SELECT l->>'line_id' FROM jsonb_array_elements(lines) l
    INTERSECT SELECT ref FROM jsonb_array_elements(lines) e
      CROSS JOIN LATERAL (VALUES (e->>'employee_id'),(e->>'input_revision_id')) refs(ref))
  THEN RAISE EXCEPTION 'Draft review reference overlaps private reference' USING ERRCODE='23514'; END IF;
  SELECT coalesce(jsonb_agg(l - ARRAY['employee_id','input_revision_id'] ORDER BY ord),'[]'::jsonb)
    INTO visible FROM jsonb_array_elements(lines) WITH ORDINALITY x(l,ord);
  RETURN jsonb_build_object('lines',visible,'totals',totals || jsonb_build_object('line_count',jsonb_array_length(lines),
    'gross',total_gross::text,'net',total_net::text));
END;
$$;
ALTER FUNCTION public.pay_run_draft_breakdown(jsonb) OWNER TO ledgerly_canonical_owner;

-- Disposable candidate for pay-run revision metadata. All rows are draft snapshots.
CREATE TABLE public.pay_run_draft_revisions (
  company_id uuid NOT NULL REFERENCES public.companies(id),
  run_id uuid NOT NULL,
  revision_number integer NOT NULL CHECK (revision_number > 0),
  revision_id uuid NOT NULL CHECK (revision_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab]'),
  period_start date NOT NULL,
  period_end date NOT NULL CHECK (period_end >= period_start),
  payday date NOT NULL,
  currency text NOT NULL CHECK (currency = 'GBP'),
  rules_version text NOT NULL CHECK (length(trim(rules_version)) > 0),
  prepared_by text NOT NULL CHECK (length(trim(prepared_by)) > 0),
  prepared_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  employee_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_breakdown jsonb GENERATED ALWAYS AS (public.pay_run_draft_breakdown(employee_lines)) STORED,
  PRIMARY KEY (company_id, run_id, revision_number),
  UNIQUE (company_id, revision_id)
);
ALTER TABLE public.pay_run_draft_revisions OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON public.pay_run_draft_revisions FROM PUBLIC, ledgerly_api;
GRANT SELECT ON public.pay_run_draft_revisions TO ledgerly_api;
CREATE TRIGGER pay_run_draft_revision_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
  ON public.pay_run_draft_revisions FOR EACH STATEMENT
  EXECUTE FUNCTION public.ledgerly_canonical_append_only_guard();
ALTER TABLE public.pay_run_draft_revisions ENABLE ALWAYS TRIGGER pay_run_draft_revision_immutable;
CREATE TRIGGER pay_run_draft_source_check BEFORE INSERT ON public.pay_run_draft_revisions
  FOR EACH ROW EXECUTE FUNCTION public.check_pay_run_draft_sources();
