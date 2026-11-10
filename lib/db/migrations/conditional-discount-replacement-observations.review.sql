-- Versioned internal qualification only. Public posting remains closed.
-- Old unobserved restored history is never assigned a new cluster origin.
ALTER TABLE public.conditional_discount_replacements ADD COLUMN cluster_id text;
CREATE FUNCTION public.conditional_replacement_origin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 NEW.source_xid=pg_current_xact_id();
 NEW.cluster_id=(pg_control_system()).system_identifier::text;
 NEW.recorded_at=clock_timestamp();RETURN NEW;
END $$;
ALTER FUNCTION public.conditional_replacement_origin() OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON FUNCTION public.conditional_replacement_origin() FROM PUBLIC,ledgerly_api;
CREATE TRIGGER conditional_replacement_origin BEFORE INSERT ON public.conditional_discount_replacements
 FOR EACH ROW EXECUTE FUNCTION public.conditional_replacement_origin();
ALTER TABLE public.conditional_discount_replacements ENABLE ALWAYS TRIGGER conditional_replacement_origin;

CREATE TABLE public.conditional_discount_replacement_observations (
 company_id uuid NOT NULL, replacement_id uuid NOT NULL,
 binding jsonb NOT NULL, canonical_payload text NOT NULL,
 binding_hash text NOT NULL CHECK(binding_hash ~ '^sha256:[a-f0-9]{64}$'),
 observed_at timestamptz NOT NULL, actor_id text NOT NULL,
 PRIMARY KEY(company_id,replacement_id),
 FOREIGN KEY(company_id,replacement_id) REFERENCES public.conditional_discount_replacements(company_id,id),
 CHECK(canonical_payload::jsonb=binding),
 CHECK(binding_hash='sha256:'||encode(sha256(convert_to(canonical_payload,'UTF8')),'hex'))
);
ALTER TABLE public.conditional_discount_replacement_observations OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON public.conditional_discount_replacement_observations FROM PUBLIC,ledgerly_api;
GRANT SELECT ON public.conditional_discount_replacement_observations TO ledgerly_api;
CREATE TRIGGER replacement_observation_immutable BEFORE UPDATE OR DELETE ON public.conditional_discount_replacement_observations
 FOR EACH ROW EXECUTE FUNCTION public.conditional_discount_witness_immutable();
CREATE TRIGGER replacement_observation_no_truncate BEFORE TRUNCATE ON public.conditional_discount_replacement_observations
 FOR EACH STATEMENT EXECUTE FUNCTION public.conditional_discount_witness_immutable();
ALTER TABLE public.conditional_discount_replacement_observations ENABLE ALWAYS TRIGGER replacement_observation_immutable;
ALTER TABLE public.conditional_discount_replacement_observations ENABLE ALWAYS TRIGGER replacement_observation_no_truncate;

CREATE FUNCTION public.observe_conditional_discount_replacement(c uuid,a text,r uuid,payload text,h text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE replacement public.conditional_discount_replacements%ROWTYPE;
 original public.conditional_discount_original_bindings%ROWTYPE;
 evidence public.conditional_discount_evidence%ROWTYPE;
 old public.conditional_discount_replacement_observations%ROWTYPE;
 frozen jsonb; v jsonb; total numeric:=0;
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
 IF replacement.source_xid=pg_current_xact_id() OR replacement.cluster_id IS DISTINCT FROM (pg_control_system()).system_identifier::text
   OR pg_xact_status(replacement.source_xid) IS DISTINCT FROM 'committed' THEN RAISE EXCEPTION 'Replacement transaction not committed'; END IF;
 IF EXISTS(SELECT 1 FROM public.conditional_discount_replacements WHERE company_id=c AND predecessor_id=r)
   OR EXISTS(SELECT 1 FROM public.accounting_paid_credit_operations WHERE company_id=c AND intent->>'original_id'=replacement.document_id::text AND intent ? 'conditional_admission')
 THEN RAISE EXCEPTION 'Replacement no longer active'; END IF;
 SELECT * INTO original FROM public.conditional_discount_original_bindings WHERE company_id=c AND document_id=replacement.document_id;
 SELECT * INTO evidence FROM public.conditional_discount_evidence WHERE company_id=c AND id=replacement.evidence_id;
 frozen=payload::jsonb;
 IF h IS DISTINCT FROM 'sha256:'||encode(sha256(convert_to(payload,'UTF8')),'hex')
   OR replacement.original_binding_hash IS DISTINCT FROM original.binding_hash
   OR (frozen-ARRAY['evidence_id','terms_hash','discount_gross_pence','deadline','vector']) IS DISTINCT FROM
      (original.binding-ARRAY['evidence_id','terms_hash','discount_gross_pence','deadline','vector'])
   OR frozen->>'evidence_id' IS DISTINCT FROM evidence.id::text
   OR frozen->>'terms_hash' IS DISTINCT FROM evidence.terms_hash
   OR frozen->>'discount_gross_pence' IS DISTINCT FROM evidence.terms->>'discount_gross_pence'
   OR frozen->>'deadline' IS DISTINCT FROM evidence.terms->>'payment_deadline'
   OR (frozen->>'discount_gross_pence')::numeric<=0 OR (frozen->>'discount_gross_pence')::numeric>=(frozen->>'gross_pence')::numeric
   OR jsonb_typeof(frozen->'vector') IS DISTINCT FROM 'array'
   OR jsonb_array_length(frozen->'vector')<>jsonb_array_length(original.binding->'vector')
 THEN RAISE EXCEPTION 'Replacement frozen identity invalid'; END IF;
 -- Native allocation/tax helpers calculate the vector. These are structural
 -- identity/capacity checks, not a second allocation or tax calculation engine.
 FOR v IN SELECT value FROM jsonb_array_elements(frozen->'vector') LOOP
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(original.binding->'vector') x
      WHERE x->>'line_ref'=v->>'line_ref' AND x->'original'=v->'original' AND x->'tax'=v->'tax')
     OR (v->>'net_pence')::numeric<0 OR (v->>'vat_pence')::numeric<0
     OR (v->>'net_pence')::numeric+(v->>'vat_pence')::numeric<>(v->>'gross_pence')::numeric
     OR (v->>'gross_pence')::numeric>(v#>>'{original,gross_pence}')::numeric
   THEN RAISE EXCEPTION 'Replacement frozen vector invalid'; END IF;
   total=total+(v->>'gross_pence')::numeric;
 END LOOP;
 IF total<>(frozen->>'discount_gross_pence')::numeric OR
   (SELECT count(*)<>count(DISTINCT value->>'line_ref') FROM jsonb_array_elements(frozen->'vector'))
 THEN RAISE EXCEPTION 'Replacement frozen total invalid'; END IF;
 INSERT INTO public.conditional_discount_replacement_observations VALUES(c,r,frozen,payload,h,clock_timestamp(),a);
END $$;
ALTER FUNCTION public.observe_conditional_discount_replacement(uuid,text,uuid,text,text) OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON FUNCTION public.observe_conditional_discount_replacement(uuid,text,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.observe_conditional_discount_replacement(uuid,text,uuid,text,text) TO ledgerly_api;

-- Preserve the existing consumption engine and all its witness/vector/release
-- checks. Resolve only the immutable agreement version supplied to that engine.
CREATE FUNCTION public.resolve_conditional_replacement(c uuid,d uuid,descriptor jsonb,original jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r public.conditional_discount_replacements%ROWTYPE;
 o public.conditional_discount_replacement_observations%ROWTYPE;
BEGIN
 SELECT * INTO r FROM public.conditional_discount_replacements x WHERE company_id=c AND document_id=d
   AND NOT EXISTS(SELECT 1 FROM public.conditional_discount_replacements n WHERE n.company_id=c AND n.predecessor_id=x.id);
 IF NOT FOUND THEN
   IF descriptor ? 'replacement_id' THEN RAISE EXCEPTION 'Replacement identity invalid'; END IF;
   RETURN original;
 END IF;
 SELECT * INTO o FROM public.conditional_discount_replacement_observations WHERE company_id=c AND replacement_id=r.id;
 IF NOT FOUND OR descriptor->>'replacement_id' IS DISTINCT FROM r.id::text
   OR descriptor->>'replacement_hash' IS DISTINCT FROM o.binding_hash
   OR descriptor->>'observed_at' IS DISTINCT FROM to_char(o.observed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
 THEN RAISE EXCEPTION 'Replacement observation stale or unavailable'; END IF;
 RETURN o.binding;
END $$;
ALTER FUNCTION public.resolve_conditional_replacement(uuid,uuid,jsonb,jsonb) OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON FUNCTION public.resolve_conditional_replacement(uuid,uuid,jsonb,jsonb) FROM PUBLIC,ledgerly_api;
DO $$
DECLARE definition text; needle text:=' a=NEW.intent->''conditional_admission'';';
BEGIN
 definition=pg_get_functiondef('public.conditional_credit_consumption()'::regprocedure);
 IF (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'Consumption migration source mismatch'; END IF;
 EXECUTE replace(definition,needle,needle||E'\n b.binding=public.resolve_conditional_replacement(NEW.company_id,b.document_id,a->''binding'',b.binding);');
END $$;
CREATE OR REPLACE FUNCTION public.conditional_replacement_redemption_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o public.conditional_discount_replacement_observations%ROWTYPE; e jsonb; agreement_date date;
BEGIN
 IF NOT(NEW.intent ? 'conditional_admission') THEN RETURN NEW; END IF;
 IF NOT(NEW.intent#>'{conditional_admission,binding}' ? 'replacement_id') THEN
   IF EXISTS(SELECT 1 FROM public.conditional_discount_replacements WHERE company_id=NEW.company_id AND document_id::text=NEW.intent->>'original_id')
   THEN RAISE EXCEPTION 'Superseded agreement cannot redeem'; END IF;
   RETURN NEW;
 END IF;
 SELECT obs.* INTO o FROM public.conditional_discount_replacement_observations obs JOIN public.conditional_discount_replacements r
   ON r.company_id=obs.company_id AND r.id=obs.replacement_id
   WHERE obs.company_id=NEW.company_id AND r.document_id::text=NEW.intent->>'original_id'
     AND r.id::text=NEW.intent#>>'{conditional_admission,binding,replacement_id}';
 IF NOT FOUND THEN RAISE EXCEPTION 'Replacement observation unavailable'; END IF;
 SELECT (terms->>'agreement_date')::date INTO agreement_date FROM public.conditional_discount_evidence WHERE company_id=NEW.company_id AND id=(o.binding->>'evidence_id')::uuid;
 FOR e IN SELECT value FROM jsonb_array_elements(NEW.intent#>'{conditional_admission,qualifying_events}') LOOP
   IF NOT EXISTS(SELECT 1 FROM public.accounting_payment_events pe JOIN public.accounting_payment_events parent
     ON parent.company_id=pe.company_id AND parent.id=COALESCE(pe.payment_id,pe.id)
     WHERE pe.company_id=NEW.company_id AND pe.id::text=e->>'event_id' AND parent.kind='payment'
       AND pe.created_at>o.observed_at AND parent.created_at>o.observed_at
       AND pe.effective_date>=agreement_date AND parent.effective_date>=agreement_date)
   THEN RAISE EXCEPTION 'Payment predates replacement agreement'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
