-- Additive candidate contract; fresh disposable installer only.
-- Existing compensation guard still binds credit reversal + unallocation.
CREATE FUNCTION public.conditional_discount_cash_reversal_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE p public.accounting_payment_events%ROWTYPE;
 c public.accounting_payment_events%ROWTYPE;
 j public.canonical_journal_entries%ROWTYPE;
BEGIN
 IF NOT(NEW.evidence ? 'payment_action') THEN
  IF NEW.result ? 'cash_reversal_id' OR NEW.result ? 'cash_reversal_journal_id' THEN
   RAISE EXCEPTION 'Unexpected compensation cash reversal'; END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO p FROM public.accounting_payment_events WHERE company_id=NEW.company_id AND id=NEW.payment_id;
 SELECT * INTO c FROM public.accounting_payment_events WHERE company_id=NEW.company_id AND id=(NEW.result->>'cash_reversal_id')::uuid;
 SELECT * INTO j FROM public.canonical_journal_entries WHERE company_id=NEW.company_id AND id=c.journal_id;
 IF NEW.evidence->>'payment_action' IS DISTINCT FROM 'reverse_payment'
  OR p.id IS NULL OR p.kind<>'payment' OR c.id IS NULL OR c.kind<>'reversal'
  OR c.payment_id IS DISTINCT FROM p.id OR c.amount_minor IS DISTINCT FROM p.amount_minor
  OR c.party_id IS DISTINCT FROM p.party_id OR c.party_type IS DISTINCT FROM p.party_type
  OR c.actor_id IS DISTINCT FROM NEW.actor_id OR c.effective_date IS DISTINCT FROM NEW.effective_date
  OR c.allocations IS DISTINCT FROM '[]'::jsonb
  OR NEW.result->>'cash_reversal_journal_id' IS DISTINCT FROM c.journal_id::text
  OR NEW.evidence->'cash_reversal'->>'id' IS DISTINCT FROM c.id::text
  OR NEW.evidence->'cash_reversal'->>'amount_minor' IS DISTINCT FROM p.amount_minor::text
  OR NEW.evidence->>'after_unapplied_minor' IS DISTINCT FROM '0'
  OR EXISTS(SELECT 1 FROM public.accounting_payment_events e WHERE e.company_id=NEW.company_id
    AND e.payment_id=p.id AND (e.kind='refund' OR (e.kind='reversal' AND e.id<>c.id)))
  OR EXISTS(SELECT 1 FROM public.accounting_payment_events e,
    jsonb_array_elements(e.allocations) a WHERE e.company_id=NEW.company_id
    AND (e.id=p.id OR e.payment_id=p.id) AND a->>'document_id'<>NEW.original_id::text)
  OR (SELECT coalesce(sum((CASE WHEN e.kind='unallocation' THEN -1 ELSE 1 END)*
    (a->>'amount_minor')::numeric),0) FROM public.accounting_payment_events e,
    jsonb_array_elements(e.allocations) a WHERE e.company_id=NEW.company_id AND (e.id=p.id OR e.payment_id=p.id))<>0
  OR j.id IS NULL OR j.status<>'posted' OR j.source_type<>'accounting_payment_event'
  OR j.source_id IS DISTINCT FROM c.id::text OR j.posting_date IS DISTINCT FROM NEW.effective_date
  OR NOT EXISTS(SELECT 1 FROM public.accounting_posting_effects e WHERE e.company_id=NEW.company_id
    AND e.journal_id=j.id AND e.status='posted' AND e.source_evidence_hash=j.source_evidence_hash
    AND e.source_revision=j.source_revision)
  OR NOT EXISTS(SELECT 1 FROM public.conditional_discount_journal_origins a
    JOIN public.conditional_discount_journal_origins b ON b.company_id=a.company_id
    WHERE a.company_id=NEW.company_id AND a.journal_id=NEW.journal_id AND b.journal_id=j.id
      AND a.source_xid=pg_current_xact_id() AND b.source_xid=a.source_xid
      AND a.cluster_id=b.cluster_id AND a.cluster_id=(pg_control_system()).system_identifier::text)
 THEN RAISE EXCEPTION 'Compensation cash child identity invalid'; END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION public.conditional_discount_cash_reversal_guard() OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON FUNCTION public.conditional_discount_cash_reversal_guard() FROM PUBLIC,ledgerly_api;
CREATE TRIGGER conditional_discount_cash_reversal_guard BEFORE INSERT ON public.conditional_discount_compensations
 FOR EACH ROW EXECUTE FUNCTION public.conditional_discount_cash_reversal_guard();
ALTER TABLE public.conditional_discount_compensations ENABLE ALWAYS TRIGGER conditional_discount_cash_reversal_guard;
