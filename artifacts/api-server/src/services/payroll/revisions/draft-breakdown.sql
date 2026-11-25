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
