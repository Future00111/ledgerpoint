-- Each draft line currently names one dated annual-pay input for the entire period.
CREATE FUNCTION public.check_pay_run_draft_sources() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  -- A pinned transaction snapshot cannot re-read a source committed during a lock wait.
  IF current_setting('transaction_isolation') NOT IN ('read committed','read uncommitted') THEN
    RAISE EXCEPTION 'Draft admission requires a fresh committed snapshot' USING ERRCODE='25000';
  END IF;
  -- Native pay-input creation takes this same company lock before inserting.
  PERFORM id FROM public.companies WHERE id = NEW.company_id FOR UPDATE;
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
