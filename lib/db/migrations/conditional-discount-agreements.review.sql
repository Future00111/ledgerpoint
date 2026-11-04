-- Commitment-observation prerequisite only; no conditional agreement admission.
-- Fresh disposable installation only. No historical receipt backfill.
CREATE TABLE public.conditional_discount_payment_transactions (
  company_id uuid NOT NULL,
  event_id uuid NOT NULL,
  source_xid xid8 NOT NULL,
  cluster_id text NOT NULL,
  CONSTRAINT conditional_discount_transaction_pk PRIMARY KEY(company_id,event_id),
  CONSTRAINT conditional_discount_transaction_event_fk FOREIGN KEY(company_id,event_id)
    REFERENCES public.accounting_payment_events(company_id,id)
);
ALTER TABLE public.conditional_discount_payment_transactions OWNER TO ledgerly_canonical_owner;
CREATE FUNCTION public.conditional_discount_witness_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Conditional discount commitment evidence is immutable'; END $$;
CREATE FUNCTION public.conditional_discount_payment_transaction() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  -- pg_current_xact_id returns the full TOP transaction id, including inside
  -- unreleased/released savepoints. The receipt rolls back with its source.
  INSERT INTO public.conditional_discount_payment_transactions(company_id,event_id,source_xid,cluster_id)
    VALUES(NEW.company_id,NEW.id,pg_catalog.pg_current_xact_id(),
      (SELECT system_identifier::text FROM pg_catalog.pg_control_system()));
  RETURN NEW;
END $$;
ALTER FUNCTION public.conditional_discount_payment_transaction() OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON FUNCTION public.conditional_discount_payment_transaction() FROM PUBLIC,ledgerly_api;
GRANT SELECT ON public.accounting_payment_events TO ledgerly_canonical_owner;
GRANT SELECT (company_id,user_id,role,is_active) ON public.company_users TO ledgerly_canonical_owner;
GRANT EXECUTE ON FUNCTION pg_catalog.pg_control_system() TO ledgerly_canonical_owner;
CREATE TRIGGER conditional_discount_payment_transaction AFTER INSERT ON public.accounting_payment_events
 FOR EACH ROW EXECUTE FUNCTION public.conditional_discount_payment_transaction();
ALTER TABLE public.accounting_payment_events ENABLE ALWAYS TRIGGER conditional_discount_payment_transaction;
CREATE TRIGGER conditional_discount_transaction_immutable BEFORE UPDATE OR DELETE ON public.conditional_discount_payment_transactions
 FOR EACH ROW EXECUTE FUNCTION public.conditional_discount_witness_immutable();
CREATE TRIGGER conditional_discount_transaction_no_truncate BEFORE TRUNCATE ON public.conditional_discount_payment_transactions
 FOR EACH STATEMENT EXECUTE FUNCTION public.conditional_discount_witness_immutable();
ALTER TABLE public.conditional_discount_payment_transactions ENABLE ALWAYS TRIGGER conditional_discount_transaction_immutable;
ALTER TABLE public.conditional_discount_payment_transactions ENABLE ALWAYS TRIGGER conditional_discount_transaction_no_truncate;
REVOKE ALL ON public.conditional_discount_payment_transactions FROM PUBLIC,ledgerly_api;
GRANT SELECT ON public.conditional_discount_payment_transactions TO ledgerly_api;

CREATE TABLE public.conditional_discount_commit_witnesses (
  company_id uuid NOT NULL,
  event_id uuid NOT NULL,
  journal_id uuid NOT NULL CONSTRAINT conditional_discount_witness_journal_fk REFERENCES public.canonical_journal_entries(id),
  event_source_hash text NOT NULL CONSTRAINT conditional_discount_witness_hash CHECK(event_source_hash ~ '^sha256:[a-f0-9]{64}$'),
  actor_id text NOT NULL,
  event_created_at timestamptz NOT NULL,
  observed_at timestamptz NOT NULL,
  CONSTRAINT conditional_discount_witness_pk PRIMARY KEY(company_id,event_id),
  CONSTRAINT conditional_discount_witness_event_fk FOREIGN KEY(company_id,event_id) REFERENCES public.accounting_payment_events(company_id,id),
  CONSTRAINT conditional_discount_witness_clock CHECK(observed_at > event_created_at)
);
ALTER TABLE public.conditional_discount_commit_witnesses OWNER TO ledgerly_canonical_owner;
CREATE FUNCTION public.conditional_discount_witness_observe() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE source_row public.accounting_payment_events%ROWTYPE; source_xid xid8; source_cluster text;
  trusted_hash text; observer_count bigint; observer_allowed boolean;
BEGIN
  SELECT e.* INTO source_row FROM public.accounting_payment_events e
    WHERE e.company_id=NEW.company_id AND e.id=NEW.event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Native payment event required'; END IF;
  SELECT t.source_xid,t.cluster_id INTO source_xid,source_cluster FROM public.conditional_discount_payment_transactions t
    WHERE t.company_id=NEW.company_id AND t.event_id=NEW.event_id;
  -- Unknown/expired status and absent pre-migration receipts fail closed.
  IF source_cluster IS DISTINCT FROM (SELECT system_identifier::text FROM pg_catalog.pg_control_system()) OR
     source_xid IS NULL OR pg_catalog.pg_xact_status(source_xid) IS DISTINCT FROM 'committed' OR
     source_row.journal_id IS DISTINCT FROM NEW.journal_id OR source_row.kind NOT IN ('payment','allocation') THEN
    RAISE EXCEPTION 'A separately committed native payment or allocation is required';
  END IF;
  -- Runtime INSERT privilege must not permit a false immutable first receipt.
  -- Resolve the same canonical journal/effect identity as the protected reader.
  SELECT j.source_revision INTO trusted_hash
    FROM public.canonical_journal_entries j
    JOIN public.accounting_posting_effects p ON p.company_id=j.company_id AND p.journal_id=j.id
      AND p.source_type=j.source_type AND p.source_id=j.source_id AND p.posting_kind=j.posting_kind
      AND p.economic_effect_id=j.economic_effect_id AND p.idempotency_key='payment-event:'||source_row.id::text
      AND p.status='posted' AND p.source_revision=j.source_revision
    WHERE j.id=source_row.journal_id AND j.company_id=source_row.company_id
      AND j.source_id=source_row.id::text AND j.source_type='accounting_payment_event' AND j.status='posted'
      AND j.currency_code='GBP' AND j.posting_kind='party_'||source_row.kind
      AND j.posting_date=source_row.effective_date AND j.reference=source_row.reference
      AND j.economic_effect_id='payment-event:'||source_row.id::text;
  IF NOT FOUND OR trusted_hash IS NULL OR NEW.event_source_hash IS DISTINCT FROM trusted_hash THEN
    RAISE EXCEPTION 'Matching canonical payment identity and source hash required';
  END IF;
  -- This validates the named observer's membership, not Clerk authentication or
  -- nonrepudiation under the shared database role. The protected API owns those.
  -- Count every matching membership so a duplicate inactive row also fails closed.
  SELECT count(*),bool_and(m.is_active AND m.role IN ('owner','admin','accountant'))
    INTO observer_count,observer_allowed FROM public.company_users m
    WHERE m.company_id=source_row.company_id AND m.user_id=NEW.actor_id;
  IF observer_count<>1 OR observer_allowed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Active writable company observer membership required';
  END IF;
  NEW.event_created_at := source_row.created_at;
  NEW.observed_at := pg_catalog.clock_timestamp();
  RETURN NEW;
END $$;
ALTER FUNCTION public.conditional_discount_witness_observe() OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON FUNCTION public.conditional_discount_witness_observe() FROM PUBLIC,ledgerly_api;
CREATE TRIGGER conditional_discount_witness_observe BEFORE INSERT ON public.conditional_discount_commit_witnesses
 FOR EACH ROW EXECUTE FUNCTION public.conditional_discount_witness_observe();
CREATE TRIGGER conditional_discount_witness_immutable BEFORE UPDATE OR DELETE ON public.conditional_discount_commit_witnesses
 FOR EACH ROW EXECUTE FUNCTION public.conditional_discount_witness_immutable();
CREATE TRIGGER conditional_discount_witness_no_truncate BEFORE TRUNCATE ON public.conditional_discount_commit_witnesses
 FOR EACH STATEMENT EXECUTE FUNCTION public.conditional_discount_witness_immutable();
ALTER TABLE public.conditional_discount_commit_witnesses ENABLE ALWAYS TRIGGER conditional_discount_witness_observe;
ALTER TABLE public.conditional_discount_commit_witnesses ENABLE ALWAYS TRIGGER conditional_discount_witness_immutable;
ALTER TABLE public.conditional_discount_commit_witnesses ENABLE ALWAYS TRIGGER conditional_discount_witness_no_truncate;
REVOKE ALL ON public.conditional_discount_commit_witnesses FROM PUBLIC,ledgerly_api;
GRANT SELECT,INSERT ON public.conditional_discount_commit_witnesses TO ledgerly_api;
