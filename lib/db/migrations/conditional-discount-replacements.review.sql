-- Append-only agreement HISTORY. This does not admit posting or qualify payments.
-- Replacement terms cannot alter the original journal binding or consumption.
CREATE TABLE public.conditional_discount_replacements (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL,
 document_id uuid NOT NULL,
 request_id uuid NOT NULL,
 predecessor_id uuid,
 evidence_id uuid NOT NULL,
 original_binding_hash text NOT NULL CHECK(original_binding_hash ~ '^sha256:[a-f0-9]{64}$'),
 actor_id text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 source_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 UNIQUE(company_id,id),
 UNIQUE(company_id,document_id,id),
 UNIQUE(company_id,request_id),
 UNIQUE(company_id,evidence_id),
 FOREIGN KEY(company_id,document_id) REFERENCES public.conditional_discount_original_bindings(company_id,document_id),
 FOREIGN KEY(company_id,evidence_id) REFERENCES public.conditional_discount_evidence(company_id,id),
 FOREIGN KEY(company_id,document_id,predecessor_id) REFERENCES public.conditional_discount_replacements(company_id,document_id,id)
);
CREATE UNIQUE INDEX conditional_replacement_one_root ON public.conditional_discount_replacements(company_id,document_id) WHERE predecessor_id IS NULL;
CREATE UNIQUE INDEX conditional_replacement_one_successor ON public.conditional_discount_replacements(company_id,predecessor_id) WHERE predecessor_id IS NOT NULL;
ALTER TABLE public.conditional_discount_replacements OWNER TO ledgerly_canonical_owner;
CREATE TRIGGER conditional_replacement_immutable BEFORE UPDATE OR DELETE ON public.conditional_discount_replacements
 FOR EACH ROW EXECUTE FUNCTION public.conditional_discount_witness_immutable();
CREATE TRIGGER conditional_replacement_no_truncate BEFORE TRUNCATE ON public.conditional_discount_replacements
 FOR EACH STATEMENT EXECUTE FUNCTION public.conditional_discount_witness_immutable();
ALTER TABLE public.conditional_discount_replacements ENABLE ALWAYS TRIGGER conditional_replacement_immutable;
ALTER TABLE public.conditional_discount_replacements ENABLE ALWAYS TRIGGER conditional_replacement_no_truncate;
REVOKE ALL ON public.conditional_discount_replacements FROM PUBLIC,ledgerly_api;
GRANT SELECT ON public.conditional_discount_replacements TO ledgerly_api;

CREATE FUNCTION public.append_conditional_discount_replacement(c uuid,a text,d uuid,r uuid,p uuid,t jsonb,e text,b boolean) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE original public.conditional_discount_original_bindings%ROWTYPE;
 old public.conditional_discount_replacements%ROWTYPE; previous uuid; receipt uuid; result uuid;
BEGIN
 -- Same serialization boundary as native posting, credits and settlement.
 PERFORM 1 FROM public.companies WHERE id=c AND country='GB' AND base_currency='GBP' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Replacement scope unavailable'; END IF;
 IF (SELECT count(*) FROM public.company_users WHERE company_id=c AND user_id=a)<>1 THEN RAISE EXCEPTION 'Replacement membership unavailable'; END IF;
 PERFORM 1 FROM public.company_users WHERE company_id=c AND user_id=a AND is_active AND role IN ('owner','admin','accountant') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Replacement capability unavailable'; END IF;
 SELECT * INTO original FROM public.conditional_discount_original_bindings WHERE company_id=c AND document_id=d;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.conditional_discount_original_observations WHERE company_id=c AND document_id=d)
 THEN RAISE EXCEPTION 'Observed original required'; END IF;
 -- Evidence capture validates exact terms, party admission, attestation and request replay.
 -- Any later failure rolls this evidence back too.
 receipt=public.capture_conditional_discount_evidence(c,a,r,t,e,b);
 IF NOT EXISTS(SELECT 1 FROM public.conditional_discount_evidence v
   JOIN public.accounting_document_sources s ON s.company_id=v.company_id AND s.id=d
   WHERE v.company_id=c AND v.id=receipt AND v.party_id=s.party_id
     AND v.party_type=CASE s.kind WHEN 'sales_invoice' THEN 'customer' WHEN 'purchase_bill' THEN 'supplier' ELSE '' END
     AND s.status='posted')
 THEN RAISE EXCEPTION 'Replacement party mismatch'; END IF;
 SELECT * INTO old FROM public.conditional_discount_replacements WHERE company_id=c AND request_id=r;
 IF FOUND THEN
   IF old.document_id IS DISTINCT FROM d OR old.predecessor_id IS DISTINCT FROM p OR old.actor_id IS DISTINCT FROM a OR old.evidence_id IS DISTINCT FROM receipt
   THEN RAISE EXCEPTION 'Replacement request conflict'; END IF;
   RETURN old.id; -- Readback only, even if subsequently superseded or consumed.
 END IF;
 IF EXISTS(SELECT 1 FROM public.accounting_paid_credit_operations WHERE company_id=c AND intent->>'original_id'=d::text AND intent ? 'conditional_admission')
 THEN RAISE EXCEPTION 'Consumed agreement cannot be replaced'; END IF;
 SELECT x.id INTO previous FROM public.conditional_discount_replacements x
   WHERE x.company_id=c AND x.document_id=d AND NOT EXISTS(
     SELECT 1 FROM public.conditional_discount_replacements y WHERE y.company_id=c AND y.predecessor_id=x.id);
 IF previous IS DISTINCT FROM p THEN RAISE EXCEPTION 'Replacement predecessor changed'; END IF;
 IF EXISTS(SELECT 1 FROM public.conditional_discount_evidence v WHERE v.company_id=c
   AND (v.id=(original.binding->>'evidence_id')::uuid OR v.id IN
     (SELECT evidence_id FROM public.conditional_discount_replacements WHERE company_id=c AND document_id=d))
   AND v.terms->>'agreement_id'=(SELECT terms->>'agreement_id' FROM public.conditional_discount_evidence WHERE company_id=c AND id=receipt))
 THEN RAISE EXCEPTION 'Replacement requires a new agreement identity'; END IF;
 result=gen_random_uuid();
 INSERT INTO public.conditional_discount_replacements(id,company_id,document_id,request_id,predecessor_id,evidence_id,original_binding_hash,actor_id)
 VALUES(result,c,d,r,p,receipt,original.binding_hash,a);
 RETURN result;
END $$;
ALTER FUNCTION public.append_conditional_discount_replacement(uuid,text,uuid,uuid,uuid,jsonb,text,boolean) OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON FUNCTION public.append_conditional_discount_replacement(uuid,text,uuid,uuid,uuid,jsonb,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_conditional_discount_replacement(uuid,text,uuid,uuid,uuid,jsonb,text,boolean) TO ledgerly_api;

-- Until versioned redemption is implemented, neither native nor direct runtime
-- callers may redeem the superseded original agreement.
CREATE FUNCTION public.conditional_replacement_redemption_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.intent ? 'conditional_admission' AND EXISTS(
   SELECT 1 FROM public.conditional_discount_replacements
   WHERE company_id=NEW.company_id AND document_id::text=NEW.intent->>'original_id')
 THEN RAISE EXCEPTION 'Replacement redemption unavailable'; END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION public.conditional_replacement_redemption_guard() OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON FUNCTION public.conditional_replacement_redemption_guard() FROM PUBLIC,ledgerly_api;
CREATE TRIGGER conditional_replacement_redemption_guard BEFORE INSERT ON public.accounting_paid_credit_operations
 FOR EACH ROW EXECUTE FUNCTION public.conditional_replacement_redemption_guard();
ALTER TABLE public.accounting_paid_credit_operations ENABLE ALWAYS TRIGGER conditional_replacement_redemption_guard;
