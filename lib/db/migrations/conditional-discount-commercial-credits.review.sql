-- Ordinary commercial adjustments reuse the native posting engine. Admission
-- requires actual same-transaction journal/effect provenance, not a JSON flag.
CREATE FUNCTION public.conditional_remaining_money(m jsonb, credits jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE result jsonb:=m; c jsonb; line jsonb; ref integer; i integer; f text; n numeric;
BEGIN
 IF jsonb_typeof(credits) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Credit capacity list invalid'; END IF;
 FOR c IN SELECT value FROM jsonb_array_elements(credits) LOOP
  IF jsonb_typeof(c#>'{tax_context,original_line_refs}') IS DISTINCT FROM 'array'
    OR jsonb_array_length(c#>'{tax_context,original_line_refs}')<>jsonb_array_length(c#>'{money,lines}')
    OR (SELECT count(*)<>count(DISTINCT value) FROM jsonb_array_elements(c#>'{tax_context,original_line_refs}'))
  THEN RAISE EXCEPTION 'Credit capacity references invalid'; END IF;
  FOR line,i IN SELECT value,(ordinality-1)::integer FROM jsonb_array_elements(c#>'{money,lines}') WITH ORDINALITY LOOP
   ref=(c#>>ARRAY['tax_context','original_line_refs',i::text])::integer;
   IF ref IS NULL OR ref<0 OR ref>=jsonb_array_length(m->'lines') THEN RAISE EXCEPTION 'Credit capacity reference unavailable'; END IF;
   IF (line->>'net_pence')::numeric+(line->>'vat_pence')::numeric IS DISTINCT FROM (line->>'gross_pence')::numeric
   THEN RAISE EXCEPTION 'Credit capacity money invalid'; END IF;
   FOREACH f IN ARRAY ARRAY['net_pence','vat_pence','gross_pence'] LOOP
    IF COALESCE(line->>f,'')!~'^[0-9]+$' THEN RAISE EXCEPTION 'Credit capacity amount invalid'; END IF;
    n=(result#>>ARRAY['lines',ref::text,f])::numeric-(line->>f)::numeric;
    IF n IS NULL OR n<0 THEN RAISE EXCEPTION 'Credit capacity exceeded'; END IF;
    result=jsonb_set(result,ARRAY['lines',ref::text,f],to_jsonb(n::text));
   END LOOP;
  END LOOP;
 END LOOP;
 FOREACH f IN ARRAY ARRAY['net_pence','vat_pence','gross_pence'] LOOP
  SELECT sum((value->>f)::numeric) INTO n FROM jsonb_array_elements(result->'lines');
  result=jsonb_set(result,ARRAY[f],to_jsonb(n::text));
 END LOOP;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.assert_conditional_capacity(c uuid,d uuid,s jsonb,excluded uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE original public.accounting_document_sources%ROWTYPE; credit public.accounting_document_sources%ROWTYPE;
 a public.accounting_document_amendments%ROWTYPE; revision uuid; financial jsonb; cf jsonb; item jsonb;
 ids uuid[]; proof jsonb; credits jsonb:='[]'; total integer:=0;
BEGIN
 SELECT * INTO original FROM public.accounting_document_sources WHERE company_id=c AND id=d AND status='posted';
 IF NOT FOUND THEN RAISE EXCEPTION 'Capacity original unavailable'; END IF;
 SELECT x.* INTO a FROM public.accounting_document_amendments x
 JOIN public.accounting_document_amendment_heads h ON h.company_id=x.company_id AND h.document_id=x.document_id AND h.current_revision=x.revision
 WHERE x.company_id=c AND x.document_id=d;
 revision=COALESCE(a.revision,original.revision);
 financial=jsonb_build_object('source',COALESCE(a.after_source,original.source),'money',COALESCE(a.after_money,original.money),
   'tax_context',COALESCE(a.after_tax_context,original.tax_context),'accounts',original.posting_accounts);
 IF s->>'revision' IS DISTINCT FROM revision::text OR s->'financial' IS DISTINCT FROM financial
   OR (s->>'financial_payload')::jsonb IS DISTINCT FROM financial
   OR s->>'financial_hash' IS DISTINCT FROM 'sha256:'||encode(sha256(convert_to(s->>'financial_payload','UTF8')),'hex')
   OR jsonb_typeof(s->'credits') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'Replacement capacity financial context changed'; END IF;
 SELECT array_agg(id ORDER BY id) INTO ids FROM (
   SELECT original.journal_id id UNION SELECT journal_id FROM public.accounting_document_amendments WHERE company_id=c AND document_id=d
 ) j;
 FOR credit IN SELECT * FROM public.accounting_document_sources WHERE company_id=c AND original_id=d AND status='posted'
   AND (excluded IS NULL OR id<>excluded) ORDER BY id LOOP
  -- Credit corrections/refunds/reversals require their own explicit lifecycle;
  -- do not reinterpret a frozen ordinary credit as a new financial amount.
  IF EXISTS(SELECT 1 FROM public.accounting_document_amendments WHERE company_id=c AND document_id=credit.id)
    OR EXISTS(SELECT 1 FROM public.canonical_journal_relations WHERE company_id=c AND original_journal_id=credit.journal_id)
    OR credit.party_id<>original.party_id
    OR credit.kind<>(CASE WHEN original.kind='sales_invoice' THEN 'sales_credit_note' ELSE 'supplier_credit_note' END)
    OR NOT EXISTS(SELECT 1 FROM public.accounting_paid_credit_operations WHERE company_id=c AND credit_id=credit.id AND intent ? 'commercial_admission')
  THEN RAISE EXCEPTION 'Capacity credit lifecycle unsupported'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(s->'credits') x WHERE x->>'id'=credit.id::text)<>1
  THEN RAISE EXCEPTION 'Capacity credited set changed'; END IF;
  SELECT value INTO item FROM jsonb_array_elements(s->'credits') WHERE value->>'id'=credit.id::text;
  cf=jsonb_build_object('source',credit.source,'money',credit.money,'tax_context',credit.tax_context,'accounts',credit.posting_accounts);
  IF item->>'revision' IS DISTINCT FROM credit.revision::text OR item->>'journal_id' IS DISTINCT FROM credit.journal_id::text
    OR item->'financial' IS DISTINCT FROM cf OR (item->>'financial_payload')::jsonb IS DISTINCT FROM cf
    OR item->>'evidence_hash' IS DISTINCT FROM 'sha256:'||encode(sha256(convert_to(item->>'financial_payload','UTF8')),'hex')
    OR NOT EXISTS(SELECT 1 FROM public.canonical_journal_entries j JOIN public.accounting_posting_effects p ON p.company_id=j.company_id AND p.journal_id=j.id
      WHERE j.company_id=c AND j.id=credit.journal_id AND j.source_id=credit.id::text AND j.source_revision=credit.revision::text
      AND j.source_evidence_hash=item->>'evidence_hash' AND j.status='posted' AND p.status='posted'
      AND p.source_evidence_hash=j.source_evidence_hash AND p.source_revision=j.source_revision AND p.source_id=j.source_id)
  THEN RAISE EXCEPTION 'Capacity credit identity invalid'; END IF;
  ids=array_append(ids,credit.journal_id);credits=credits||jsonb_build_array(cf);total=total+1;
 END LOOP;
 IF total<>jsonb_array_length(s->'credits') OR s->'remaining_money' IS DISTINCT FROM public.conditional_remaining_money(financial->'money',credits)
 THEN RAISE EXCEPTION 'Capacity remaining money invalid'; END IF;
 proof=public.conditional_capacity_origins(c,ids);
 IF proof IS DISTINCT FROM s->'journal_origins' THEN RAISE EXCEPTION 'Capacity origins changed'; END IF;
END $$;

CREATE FUNCTION public.assert_commercial_credit(op public.accounting_paid_credit_operations) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d public.accounting_document_sources%ROWTYPE; b public.conditional_discount_original_bindings%ROWTYPE;
 a jsonb:=op.intent->'commercial_admission'; s jsonb; f jsonb;
BEGIN
 PERFORM 1 FROM public.companies WHERE id=op.company_id FOR UPDATE;
 IF (SELECT count(*) FROM public.company_users WHERE company_id=op.company_id AND user_id=op.actor_id AND is_active AND role IN ('owner','admin','accountant'))<>1
 THEN RAISE EXCEPTION 'Commercial credit capability unavailable'; END IF;
 SELECT * INTO d FROM public.accounting_document_sources WHERE company_id=op.company_id AND id=op.credit_id;
 SELECT * INTO b FROM public.conditional_discount_original_bindings WHERE company_id=op.company_id AND document_id=d.original_id;
 IF NOT FOUND OR op.intent ? 'conditional_admission' OR a->>'version' IS DISTINCT FROM '1'
   OR a->>'original_binding_hash' IS DISTINCT FROM b.binding_hash OR d.status<>'posted'
   OR op.intent->>'original_id' IS DISTINCT FROM d.original_id::text
   OR op.intent->>'document_id' IS DISTINCT FROM d.id::text OR op.intent->>'revision' IS DISTINCT FROM d.revision::text
   OR op.result->>'document_id' IS DISTINCT FROM d.id::text OR op.result->>'journal_id' IS DISTINCT FROM d.journal_id::text
   OR op.result->>'request_id' IS DISTINCT FROM op.request_id::text OR op.result->>'status' IS DISTINCT FROM 'posted'
   OR EXISTS(SELECT 1 FROM public.accounting_paid_credit_operations WHERE company_id=op.company_id AND intent->>'original_id'=d.original_id::text AND intent ? 'conditional_admission')
 THEN RAISE EXCEPTION 'Commercial credit admission invalid'; END IF;
 s=a->'capacity';f=jsonb_build_object('source',d.source,'money',d.money,'tax_context',d.tax_context,'accounts',d.posting_accounts);
 PERFORM public.assert_conditional_capacity(op.company_id,d.original_id,s,d.id);
 IF (a->>'capacity_payload')::jsonb IS DISTINCT FROM s
   OR a->>'capacity_hash' IS DISTINCT FROM 'sha256:'||encode(sha256(convert_to(a->>'capacity_payload','UTF8')),'hex')
   OR (a->>'credit_payload')::jsonb IS DISTINCT FROM f
   OR d.tax_context->>'original_revision' IS DISTINCT FROM s->>'revision'
   OR d.tax_context->>'original_evidence_hash' IS DISTINCT FROM s->>'financial_hash'
   OR (d.money->>'gross_pence')::numeric<=0
   OR d.party_id::text IS DISTINCT FROM b.binding->>'party_id'
   OR d.kind<>(CASE WHEN (SELECT kind FROM public.accounting_document_sources WHERE company_id=op.company_id AND id=d.original_id)='sales_invoice' THEN 'sales_credit_note' ELSE 'supplier_credit_note' END)
   OR NOT EXISTS(SELECT 1 FROM public.canonical_journal_entries j
      JOIN public.accounting_posting_effects p ON p.company_id=j.company_id AND p.journal_id=j.id
      JOIN public.conditional_discount_journal_origins o ON o.company_id=j.company_id AND o.journal_id=j.id
      WHERE j.company_id=op.company_id AND j.id=d.journal_id AND j.source_type=d.kind AND j.source_id=d.id::text
      AND j.source_revision=d.revision::text AND j.source_evidence_hash='sha256:'||encode(sha256(convert_to(a->>'credit_payload','UTF8')),'hex')
      AND j.status='posted' AND j.posting_kind='ordinary_document' AND j.currency_code='GBP' AND p.status='posted' AND p.source_type=j.source_type AND p.source_id=j.source_id
      AND p.source_revision=j.source_revision AND p.source_evidence_hash=j.source_evidence_hash AND p.economic_effect_id=j.economic_effect_id
      AND j.economic_effect_id='document:'||d.id::text AND p.posting_kind=j.posting_kind
      AND o.source_xid=pg_current_xact_id() AND o.cluster_id=(pg_control_system()).system_identifier::text)
 THEN RAISE EXCEPTION 'Commercial credit source or transaction invalid'; END IF;
 PERFORM public.conditional_remaining_money(s->'remaining_money',jsonb_build_array(f));
END $$;

ALTER FUNCTION public.conditional_remaining_money(jsonb,jsonb) OWNER TO ledgerly_canonical_owner;
ALTER FUNCTION public.assert_commercial_credit(public.accounting_paid_credit_operations) OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON FUNCTION public.conditional_remaining_money(jsonb,jsonb),public.assert_commercial_credit(public.accounting_paid_credit_operations) FROM PUBLIC,ledgerly_api;
-- Keep the existing conditional path byte-for-byte except for the independently
-- validated ordinary-credit branch. No public posting function is changed.
DO $$
DECLARE definition text; needle text:='a=NEW.intent->''conditional_admission'';';
BEGIN
 definition=pg_get_functiondef('public.conditional_credit_consumption()'::regprocedure);
 IF (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'Commercial migration source mismatch'; END IF;
 EXECUTE replace(definition,needle,'IF NEW.intent ? ''commercial_admission'' THEN PERFORM public.assert_commercial_credit(NEW); RETURN NEW; END IF; '||needle);
 definition=pg_get_functiondef('public.observe_conditional_discount_replacement(uuid,text,uuid,text,text)'::regprocedure);
 needle:='IF EXISTS(SELECT 1 FROM public.accounting_document_amendments WHERE company_id=c AND document_id=replacement.document_id)';
 IF (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'Commercial observer source mismatch'; END IF;
 EXECUTE replace(definition,needle,needle||' OR EXISTS(SELECT 1 FROM public.accounting_document_sources WHERE company_id=c AND original_id=replacement.document_id AND status=''posted'')');
 definition=pg_get_functiondef('public.observe_conditional_discount_replacement(uuid,text,uuid,text,text)'::regprocedure);
 needle:='(SELECT max(effective_date) FROM public.accounting_document_amendments WHERE company_id=c AND document_id=replacement.document_id)';
 IF (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'Commercial observer date source mismatch'; END IF;
 EXECUTE replace(definition,needle,'(SELECT max(activity_date) FROM (
   SELECT effective_date activity_date FROM public.accounting_document_amendments WHERE company_id=c AND document_id=replacement.document_id
   UNION ALL SELECT (source->>''issue_date'')::date FROM public.accounting_document_sources WHERE company_id=c AND original_id=replacement.document_id AND status=''posted''
 ) activity)');
END $$;
