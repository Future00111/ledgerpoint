-- Disposable only. Imported or administrator-seeded rows cannot become command replays.
ALTER TABLE public.personal_tax_preparations
  ADD COLUMN created_by_tax_command boolean NOT NULL DEFAULT false;

-- The non-login function owner takes the same locks as company membership changes.
GRANT SELECT (id), UPDATE (id) ON public.companies TO ledgerly_canonical_owner;
GRANT SELECT (id, company_id, user_id, role, is_active), UPDATE (id)
  ON public.company_users TO ledgerly_canonical_owner;

CREATE FUNCTION public.ledgerly_create_personal_tax_preparation(c uuid, a text, r uuid, t uuid, y integer, p bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  member record;
  membership_count integer := 0;
  actor_role text;
  existing public.personal_tax_preparations%ROWTYPE;
  written uuid;
  receipt_id uuid := gen_random_uuid();
BEGIN
  IF c IS NULL OR a IS NULL OR a !~ '^[A-Za-z0-9_-]{1,200}$' OR r IS NULL OR t IS NULL
     OR r::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab]'
     OR y IS NULL OR y NOT BETWEEN 1 AND 9998 OR p IS NULL OR p < 0 THEN
    RETURN 'denied';
  END IF;
  PERFORM id FROM public.companies WHERE id = c FOR UPDATE;
  IF NOT FOUND THEN RETURN 'denied'; END IF;
  FOR member IN SELECT role, is_active FROM public.company_users
      WHERE company_id = c AND user_id = a ORDER BY id FOR UPDATE LOOP
    membership_count := membership_count + 1;
    IF member.is_active IS TRUE THEN actor_role := member.role; END IF;
  END LOOP;
  IF membership_count <> 1 OR actor_role IS NULL OR actor_role NOT IN ('owner', 'personal_tax_preparer') THEN
    RETURN 'denied';
  END IF;

  -- EXECUTE can be invoked without the HTTP wrapper. Verify append-only evidence
  -- for the runtime role explicitly because current_user here is the definer.
  IF NOT EXISTS (
    SELECT 1 FROM pg_class ac JOIN pg_trigger t ON t.tgrelid = ac.oid JOIN pg_proc fn ON fn.oid = t.tgfoid
    WHERE ac.oid = 'public.accounting_audit_events'::regclass AND ac.relkind = 'r'
      AND ac.relowner = 'ledgerly_canonical_owner'::regrole
      AND has_table_privilege('ledgerly_api', ac.oid, 'SELECT')
      AND has_table_privilege('ledgerly_api', ac.oid, 'INSERT')
      AND NOT has_table_privilege('ledgerly_api', ac.oid, 'UPDATE,DELETE,TRUNCATE')
      AND NOT has_any_column_privilege('ledgerly_api', ac.oid, 'UPDATE')
      AND t.tgname = 'ledgerly_accounting_audit_events_guard' AND t.tgenabled = 'A'
      AND t.tgtype = 27 AND t.tgqual IS NULL AND octet_length(t.tgargs) = 0
      AND fn.proname = 'ledgerly_canonical_append_only_guard' AND fn.proowner = ac.relowner
      AND regexp_replace(fn.prosrc, '[[:space:]]', '', 'g')
        = 'BEGINRAISEEXCEPTIONUSINGERRCODE=''P0001'',MESSAGE=''canonicalaccountingevidenceisappend-only'';END;'
  ) THEN RAISE EXCEPTION 'Tax creation audit unavailable'; END IF;

  INSERT INTO public.personal_tax_preparations(company_id, id, taxpayer_id, tax_year_start, employment_income_pence, created_by_tax_command)
    VALUES (c, r, t, y, p, true) ON CONFLICT DO NOTHING RETURNING id INTO written;
  IF written IS NULL THEN
    SELECT * INTO existing FROM public.personal_tax_preparations WHERE company_id = c AND id = r;
    IF FOUND THEN
      IF existing.created_by_tax_command AND existing.taxpayer_id = t AND existing.tax_year_start = y
         AND existing.employment_income_pence = p AND EXISTS (
           SELECT 1 FROM public.accounting_audit_events WHERE company_id = c AND target_id = r::text
             AND action = 'personal_tax_preparation_create' AND target_type = 'personal_tax_preparation' AND outcome = 'allowed'
             AND capability = 'personal_tax.prepare' AND actor_type = 'user' AND context->>'contract' = 'personal-tax-create.v1'
         ) THEN RETURN 'replayed'; END IF;
      RETURN 'conflict';
    END IF;
    IF EXISTS (SELECT 1 FROM public.personal_tax_preparations WHERE company_id = c AND taxpayer_id = t AND tax_year_start = y)
      THEN RETURN 'conflict'; END IF;
    RAISE EXCEPTION 'Tax preparation insertion was not confirmed';
  END IF;
  IF written <> r THEN RAISE EXCEPTION 'Unexpected tax preparation identity'; END IF;
  INSERT INTO public.accounting_audit_events
    (id,company_id,action,outcome,target_type,target_id,actor_type,actor_id,capability,context)
    VALUES(receipt_id,c,'personal_tax_preparation_create','allowed','personal_tax_preparation',r::text,'user',a,
      'personal_tax.prepare',jsonb_build_object('contract','personal-tax-create.v1','role',actor_role))
    RETURNING id INTO written;
  IF written IS DISTINCT FROM receipt_id THEN RAISE EXCEPTION 'Tax creation audit unavailable'; END IF;
  RETURN 'created';
END $$;
ALTER FUNCTION public.ledgerly_create_personal_tax_preparation(uuid,text,uuid,uuid,integer,bigint) OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON FUNCTION public.ledgerly_create_personal_tax_preparation(uuid,text,uuid,uuid,integer,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ledgerly_create_personal_tax_preparation(uuid,text,uuid,uuid,integer,bigint) TO ledgerly_api;
