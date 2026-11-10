-- Independent candidate. Fresh disposable installation only; never rewrites consumption.
-- The final canonical overlay also attests scoped identity; this unique index
-- makes the new scoped FK valid before that overlay runs in the fresh installer.
CREATE UNIQUE INDEX conditional_compensation_scoped_journal ON public.canonical_journal_entries(company_id,id);
CREATE TABLE public.conditional_discount_compensations (
 company_id uuid NOT NULL REFERENCES companies(id), request_id uuid NOT NULL,
 original_id uuid NOT NULL, credit_id uuid NOT NULL, consumption_request_id uuid NOT NULL,
 payment_id uuid NOT NULL, unallocation_id uuid NOT NULL, journal_id uuid NOT NULL,
 effective_date date NOT NULL, actor_id text NOT NULL, reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 1000),
 request_hash text NOT NULL CHECK(request_hash ~ '^sha256:[a-f0-9]{64}$'),
 review_token text NOT NULL CHECK(review_token ~ '^sha256:[a-f0-9]{64}$'),
 evidence jsonb NOT NULL, result jsonb NOT NULL,
 source_xid xid8 NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,request_id), UNIQUE(company_id,credit_id),
 UNIQUE(company_id,unallocation_id), UNIQUE(company_id,journal_id),
 FOREIGN KEY(company_id,original_id) REFERENCES accounting_document_sources(company_id,id),
 FOREIGN KEY(company_id,credit_id) REFERENCES accounting_document_sources(company_id,id),
 FOREIGN KEY(company_id,consumption_request_id) REFERENCES accounting_paid_credit_operations(company_id,request_id),
 FOREIGN KEY(company_id,journal_id) REFERENCES canonical_journal_entries(company_id,id)
);
ALTER TABLE public.conditional_discount_compensations OWNER TO ledgerly_canonical_owner;
CREATE FUNCTION public.conditional_discount_compensation_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.accounting_document_sources%ROWTYPE; o public.accounting_paid_credit_operations%ROWTYPE;
 p public.accounting_payment_events%ROWTYPE; j public.canonical_journal_entries%ROWTYPE;
BEGIN
 PERFORM id FROM public.companies WHERE id=NEW.company_id FOR UPDATE;
 IF (SELECT count(*)<>1 OR count(*) FILTER(WHERE is_active AND role IN ('owner','admin','accountant'))<>1
   FROM public.company_users WHERE company_id=NEW.company_id AND user_id=NEW.actor_id) THEN
  RAISE EXCEPTION 'Compensation requires current accounting authority'; END IF;
 SELECT * INTO c FROM public.accounting_document_sources WHERE company_id=NEW.company_id AND id=NEW.credit_id;
 SELECT * INTO o FROM public.accounting_paid_credit_operations WHERE company_id=NEW.company_id AND request_id=NEW.consumption_request_id;
 SELECT * INTO p FROM public.accounting_payment_events WHERE company_id=NEW.company_id AND id=NEW.unallocation_id;
 SELECT * INTO j FROM public.canonical_journal_entries WHERE company_id=NEW.company_id AND id=NEW.journal_id;
 IF c.id IS NULL OR o.credit_id IS DISTINCT FROM c.id OR NOT(o.intent ? 'conditional_admission')
  OR c.original_id IS DISTINCT FROM NEW.original_id OR c.status<>'posted'
  OR c.kind NOT IN ('sales_credit_note','supplier_credit_note')
  OR p.id IS NULL OR p.kind<>'unallocation' OR p.payment_id IS DISTINCT FROM NEW.payment_id
  OR p.party_id IS DISTINCT FROM c.party_id OR p.actor_id IS DISTINCT FROM NEW.actor_id
  OR p.party_type IS DISTINCT FROM (CASE c.kind WHEN 'sales_credit_note' THEN 'customer' ELSE 'supplier' END)
  OR p.effective_date IS DISTINCT FROM NEW.effective_date
  OR p.allocations IS DISTINCT FROM jsonb_build_array(jsonb_build_object('document_id',NEW.original_id::text,'amount_minor',NEW.evidence->>'unallocated_minor'))
  OR p.amount_minor::text IS DISTINCT FROM NEW.evidence->>'unallocated_minor'
  OR NEW.evidence->'credit_money' IS DISTINCT FROM c.money
  OR NEW.evidence->>'credit_revision' IS DISTINCT FROM c.revision::text
  OR NEW.evidence->>'credit_journal_id' IS DISTINCT FROM c.journal_id::text
  OR NEW.evidence->>'original_id' IS DISTINCT FROM NEW.original_id::text
  OR NEW.result->>'status' IS DISTINCT FROM 'posted'
  OR NEW.result->>'request_id' IS DISTINCT FROM NEW.request_id::text
  OR NEW.result->>'original_id' IS DISTINCT FROM NEW.original_id::text
  OR NEW.result->>'credit_id' IS DISTINCT FROM NEW.credit_id::text
  OR NEW.result->>'reversal_journal_id' IS DISTINCT FROM NEW.journal_id::text
  OR NEW.result->>'unallocation_id' IS DISTINCT FROM NEW.unallocation_id::text
  OR NEW.result->>'unallocation_journal_id' IS DISTINCT FROM p.journal_id::text
  OR j.id IS NULL OR j.reversal_of_id IS DISTINCT FROM c.journal_id
  OR j.source_type<>'canonical_journal' OR j.source_id IS DISTINCT FROM c.journal_id::text
  OR j.source_revision IS DISTINCT FROM c.revision::text
  OR j.source_evidence_hash IS DISTINCT FROM 'sha256:'||encode(sha256(convert_to(NEW.evidence->>'canonical_credit_payload','UTF8')),'hex')
  OR (NEW.evidence->>'canonical_credit_payload')::jsonb IS DISTINCT FROM
    jsonb_build_object('source',c.source,'money',c.money,'tax_context',c.tax_context,'accounts',c.posting_accounts)
  OR j.posting_kind<>'conditional_discount_compensation' OR j.status<>'posted'
  OR j.posting_date IS DISTINCT FROM NEW.effective_date OR j.correction_reason IS DISTINCT FROM NEW.reason
  OR j.created_by_id IS DISTINCT FROM NEW.actor_id
  OR j.economic_effect_id IS DISTINCT FROM 'conditional-compensation:'||NEW.original_id::text||':'||NEW.request_id::text
  OR NOT EXISTS(SELECT 1 FROM public.canonical_journal_relations r
    WHERE r.company_id=NEW.company_id AND r.original_journal_id=c.journal_id AND r.related_journal_id=j.id
      AND r.relation_type='reversal' AND r.reason=NEW.reason AND r.actor_id=NEW.actor_id)
  OR NOT EXISTS(SELECT 1 FROM public.accounting_posting_effects e
    WHERE e.company_id=NEW.company_id AND e.journal_id=j.id AND e.source_revision=j.source_revision
      AND e.source_evidence_hash=j.source_evidence_hash AND e.status='posted')
  OR NOT EXISTS(SELECT 1 FROM public.conditional_discount_journal_origins a
    JOIN public.conditional_discount_journal_origins b ON b.company_id=a.company_id
    WHERE a.company_id=NEW.company_id AND a.journal_id=j.id AND b.journal_id=p.journal_id
      AND a.source_xid=pg_current_xact_id() AND b.source_xid=a.source_xid
      AND a.cluster_id=b.cluster_id AND a.cluster_id=(pg_control_system()).system_identifier::text)
 THEN RAISE EXCEPTION 'Compensation child identity invalid'; END IF;
 NEW.source_xid=pg_current_xact_id();
 RETURN NEW;
END $$;
ALTER FUNCTION public.conditional_discount_compensation_guard() OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON FUNCTION public.conditional_discount_compensation_guard() FROM PUBLIC,ledgerly_api;
CREATE TRIGGER conditional_discount_compensation_guard BEFORE INSERT ON public.conditional_discount_compensations
 FOR EACH ROW EXECUTE FUNCTION public.conditional_discount_compensation_guard();
CREATE TRIGGER conditional_discount_compensation_immutable BEFORE UPDATE OR DELETE ON public.conditional_discount_compensations
 FOR EACH ROW EXECUTE FUNCTION public.accounting_paid_credit_immutable();
CREATE TRIGGER conditional_discount_compensation_no_truncate BEFORE TRUNCATE ON public.conditional_discount_compensations
 FOR EACH STATEMENT EXECUTE FUNCTION public.accounting_paid_credit_immutable();
ALTER TABLE public.conditional_discount_compensations ENABLE ALWAYS TRIGGER conditional_discount_compensation_guard;
ALTER TABLE public.conditional_discount_compensations ENABLE ALWAYS TRIGGER conditional_discount_compensation_immutable;
ALTER TABLE public.conditional_discount_compensations ENABLE ALWAYS TRIGGER conditional_discount_compensation_no_truncate;
REVOKE ALL ON public.conditional_discount_compensations FROM PUBLIC,ledgerly_api;
GRANT SELECT,INSERT ON public.conditional_discount_compensations TO ledgerly_api;
GRANT SELECT ON public.accounting_paid_credit_operations,public.accounting_payment_events,
 public.canonical_journal_relations TO ledgerly_canonical_owner;
