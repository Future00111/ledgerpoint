-- Corrected-source observations use a separate frozen capacity context. The
-- original binding hash remains the permanent consumption identity.
GRANT SELECT ON public.accounting_document_amendments,public.accounting_document_amendment_heads TO ledgerly_canonical_owner;
CREATE FUNCTION public.assert_conditional_capacity(c uuid,d uuid,s jsonb,excluded uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE original public.accounting_document_sources%ROWTYPE;
 a public.accounting_document_amendments%ROWTYPE; revision uuid; financial jsonb; ids uuid[]; proof jsonb;
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
   OR s->'remaining_money' IS DISTINCT FROM financial->'money' OR s->'credits' IS DISTINCT FROM '[]'::jsonb
   OR EXISTS(SELECT 1 FROM public.accounting_document_sources WHERE company_id=c AND original_id=d AND status='posted' AND (excluded IS NULL OR id<>excluded))
 THEN RAISE EXCEPTION 'Replacement capacity changed or prior credits unsupported'; END IF;
 SELECT array_agg(id ORDER BY id) INTO ids FROM (
   SELECT original.journal_id id UNION SELECT journal_id FROM public.accounting_document_amendments WHERE company_id=c AND document_id=d
 ) j;
 proof=public.conditional_capacity_origins(c,ids);
 IF proof IS DISTINCT FROM s->'journal_origins' THEN RAISE EXCEPTION 'Capacity origins changed'; END IF;
END $$;
ALTER FUNCTION public.assert_conditional_capacity(uuid,uuid,jsonb,uuid) OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON FUNCTION public.assert_conditional_capacity(uuid,uuid,jsonb,uuid) FROM PUBLIC,ledgerly_api;

ALTER FUNCTION public.observe_conditional_discount_replacement(uuid,text,uuid,text,text) RENAME TO observe_conditional_discount_replacement_v1;
REVOKE ALL ON FUNCTION public.observe_conditional_discount_replacement_v1(uuid,text,uuid,text,text) FROM PUBLIC,ledgerly_api;
CREATE FUNCTION public.observe_conditional_discount_replacement(c uuid,a text,r uuid,payload text,h text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE replacement public.conditional_discount_replacements%ROWTYPE; original public.conditional_discount_original_bindings%ROWTYPE;
 evidence public.conditional_discount_evidence%ROWTYPE; old public.conditional_discount_replacement_observations%ROWTYPE;
 frozen jsonb; s jsonb; v jsonb; total numeric:=0;
BEGIN
 PERFORM 1 FROM public.companies WHERE id=c FOR UPDATE;
 IF (SELECT count(*) FROM public.company_users WHERE company_id=c AND user_id=a)<>1 THEN RAISE EXCEPTION 'Replacement observer membership unavailable'; END IF;
 PERFORM 1 FROM public.company_users WHERE company_id=c AND user_id=a AND is_active AND role IN ('owner','admin','accountant') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Replacement observer capability unavailable'; END IF;
 SELECT * INTO replacement FROM public.conditional_discount_replacements WHERE company_id=c AND id=r;
 IF NOT FOUND THEN RAISE EXCEPTION 'Replacement unavailable'; END IF;
 SELECT * INTO old FROM public.conditional_discount_replacement_observations WHERE company_id=c AND replacement_id=r;
 IF FOUND THEN
   IF old.canonical_payload IS DISTINCT FROM payload OR old.binding_hash IS DISTINCT FROM h THEN RAISE EXCEPTION 'Replacement observation conflict'; END IF;
   RETURN;
 END IF;
 frozen=payload::jsonb;
 IF NOT(frozen ? 'capacity') THEN
   IF EXISTS(SELECT 1 FROM public.accounting_document_amendments WHERE company_id=c AND document_id=replacement.document_id)
   THEN RAISE EXCEPTION 'Corrected replacement requires capacity'; END IF;
   PERFORM public.observe_conditional_discount_replacement_v1(c,a,r,payload,h); RETURN;
 END IF;
 IF replacement.source_xid=pg_current_xact_id() OR replacement.cluster_id IS DISTINCT FROM (pg_control_system()).system_identifier::text
   OR pg_xact_status(replacement.source_xid) IS DISTINCT FROM 'committed'
   OR EXISTS(SELECT 1 FROM public.conditional_discount_replacements WHERE company_id=c AND predecessor_id=r)
   OR EXISTS(SELECT 1 FROM public.accounting_paid_credit_operations WHERE company_id=c AND intent->>'original_id'=replacement.document_id::text AND intent ? 'conditional_admission')
 THEN RAISE EXCEPTION 'Replacement not committed or no longer active'; END IF;
 SELECT * INTO original FROM public.conditional_discount_original_bindings WHERE company_id=c AND document_id=replacement.document_id;
 SELECT * INTO evidence FROM public.conditional_discount_evidence WHERE company_id=c AND id=replacement.evidence_id;
 s=frozen->'capacity';
 PERFORM public.assert_conditional_capacity(c,replacement.document_id,s,NULL);
 IF (frozen->>'capacity_payload')::jsonb IS DISTINCT FROM s
   OR frozen->>'capacity_hash' IS DISTINCT FROM 'sha256:'||encode(sha256(convert_to(frozen->>'capacity_payload','UTF8')),'hex')
   OR h IS DISTINCT FROM 'sha256:'||encode(sha256(convert_to(payload,'UTF8')),'hex')
   OR replacement.original_binding_hash IS DISTINCT FROM original.binding_hash
   OR (frozen-ARRAY['evidence_id','terms_hash','discount_gross_pence','deadline','vector','revision','financial_hash','gross_pence','capacity','capacity_payload','capacity_hash'])
     IS DISTINCT FROM (original.binding-ARRAY['evidence_id','terms_hash','discount_gross_pence','deadline','vector','revision','financial_hash','gross_pence'])
   OR frozen->>'revision' IS DISTINCT FROM s->>'revision' OR frozen->>'financial_hash' IS DISTINCT FROM s->>'financial_hash'
   OR frozen->>'gross_pence' IS DISTINCT FROM s#>>'{remaining_money,gross_pence}'
   OR frozen->>'evidence_id' IS DISTINCT FROM evidence.id::text OR frozen->>'terms_hash' IS DISTINCT FROM evidence.terms_hash
   OR frozen->>'discount_gross_pence' IS DISTINCT FROM evidence.terms->>'discount_gross_pence'
   OR frozen->>'deadline' IS DISTINCT FROM evidence.terms->>'payment_deadline'
   OR (evidence.terms->>'agreement_date')::date<(SELECT max(effective_date) FROM public.accounting_document_amendments WHERE company_id=c AND document_id=replacement.document_id)
   OR (frozen->>'discount_gross_pence')::numeric<=0 OR (frozen->>'discount_gross_pence')::numeric>=(frozen->>'gross_pence')::numeric
   OR jsonb_typeof(frozen->'vector') IS DISTINCT FROM 'array'
   OR jsonb_array_length(frozen->'vector')<>jsonb_array_length(s#>'{remaining_money,lines}')
 THEN RAISE EXCEPTION 'Replacement capacity identity invalid'; END IF;
 FOR v IN SELECT value FROM jsonb_array_elements(frozen->'vector') LOOP
   IF v->'original' IS DISTINCT FROM s#>ARRAY['remaining_money','lines',v->>'line_ref']
     OR v->'tax' IS DISTINCT FROM s#>ARRAY['financial','tax_context','lines',v->>'line_ref']
     OR (v->>'net_pence')::numeric<0 OR (v->>'vat_pence')::numeric<0
     OR (v->>'net_pence')::numeric+(v->>'vat_pence')::numeric<>(v->>'gross_pence')::numeric
     OR (v->>'net_pence')::numeric>(v#>>'{original,net_pence}')::numeric
     OR (v->>'vat_pence')::numeric>(v#>>'{original,vat_pence}')::numeric
   THEN RAISE EXCEPTION 'Replacement capacity vector invalid'; END IF;
   total=total+(v->>'gross_pence')::numeric;
 END LOOP;
 IF total<>(frozen->>'discount_gross_pence')::numeric OR
   (SELECT count(*)<>count(DISTINCT value->>'line_ref') FROM jsonb_array_elements(frozen->'vector'))
 THEN RAISE EXCEPTION 'Replacement capacity total invalid'; END IF;
 INSERT INTO public.conditional_discount_replacement_observations VALUES(c,r,frozen,payload,h,clock_timestamp(),a);
END $$;
ALTER FUNCTION public.observe_conditional_discount_replacement(uuid,text,uuid,text,text) OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON FUNCTION public.observe_conditional_discount_replacement(uuid,text,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.observe_conditional_discount_replacement(uuid,text,uuid,text,text) TO ledgerly_api;

CREATE FUNCTION public.resolve_conditional_replacement(c uuid,d uuid,descriptor jsonb,original jsonb,credit uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE frozen jsonb;
BEGIN
 frozen=public.resolve_conditional_replacement(c,d,descriptor,original);
 IF frozen ? 'capacity' THEN PERFORM public.assert_conditional_capacity(c,d,frozen->'capacity',credit); END IF;
 RETURN frozen;
END $$;
ALTER FUNCTION public.resolve_conditional_replacement(uuid,uuid,jsonb,jsonb,uuid) OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON FUNCTION public.resolve_conditional_replacement(uuid,uuid,jsonb,jsonb,uuid) FROM PUBLIC,ledgerly_api;
DO $$
DECLARE definition text; needle text:='public.resolve_conditional_replacement(NEW.company_id,b.document_id,a->''binding'',b.binding)';
BEGIN
 definition=pg_get_functiondef('public.conditional_credit_consumption()'::regprocedure);
 IF (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'Consumption capacity migration source mismatch'; END IF;
 EXECUTE replace(definition,needle,'public.resolve_conditional_replacement(NEW.company_id,b.document_id,a->''binding'',b.binding,NEW.credit_id)');
END $$;
