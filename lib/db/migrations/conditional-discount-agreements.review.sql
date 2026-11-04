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
GRANT SELECT (id,company_id,user_id,role,is_active) ON public.company_users TO ledgerly_canonical_owner;
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

-- Native agreement evidence preparation. Financial posting remains disabled.
CREATE TABLE public.conditional_discount_evidence (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES public.companies(id),
 request_id uuid NOT NULL,
 actor_id text NOT NULL,
 version integer NOT NULL CHECK(version=1),
 party_type text NOT NULL CHECK(party_type IN ('customer','supplier')),
 party_id uuid NOT NULL,
 currency text NOT NULL CHECK(currency='GBP'),
 terms jsonb NOT NULL,
 terms_hash text NOT NULL CHECK(terms_hash ~ '^sha256:[a-f0-9]{64}$'),
 evidence_text text NOT NULL CHECK(octet_length(evidence_text) BETWEEN 1 AND 65536),
 evidence_hash text NOT NULL CHECK(evidence_hash='sha256:'||encode(sha256(convert_to(evidence_text,'UTF8')),'hex')),
 attested boolean NOT NULL CHECK(attested),
 recorded_at timestamptz NOT NULL,
 UNIQUE(company_id,id), UNIQUE(company_id,request_id)
);
ALTER TABLE public.conditional_discount_evidence OWNER TO ledgerly_canonical_owner;
CREATE TRIGGER conditional_discount_evidence_immutable BEFORE UPDATE OR DELETE ON public.conditional_discount_evidence
 FOR EACH ROW EXECUTE FUNCTION public.conditional_discount_witness_immutable();
CREATE TRIGGER conditional_discount_evidence_no_truncate BEFORE TRUNCATE ON public.conditional_discount_evidence
 FOR EACH STATEMENT EXECUTE FUNCTION public.conditional_discount_witness_immutable();
ALTER TABLE public.conditional_discount_evidence ENABLE ALWAYS TRIGGER conditional_discount_evidence_immutable;
ALTER TABLE public.conditional_discount_evidence ENABLE ALWAYS TRIGGER conditional_discount_evidence_no_truncate;
REVOKE ALL ON public.conditional_discount_evidence FROM PUBLIC,ledgerly_api;
GRANT SELECT ON public.conditional_discount_evidence TO ledgerly_api;
CREATE FUNCTION public.capture_conditional_discount_evidence(c uuid,a text,r uuid,t jsonb,e text,b boolean) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result uuid; old public.conditional_discount_evidence%ROWTYPE; term_hash text;
BEGIN
 PERFORM 1 FROM public.companies WHERE id=c AND country='GB' AND base_currency='GBP' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Evidence scope unavailable'; END IF;
 IF (SELECT count(*) FROM public.company_users WHERE company_id=c AND user_id=a)<>1 THEN RAISE EXCEPTION 'Evidence membership unavailable'; END IF;
 PERFORM 1 FROM public.company_users WHERE company_id=c AND user_id=a AND is_active AND role IN ('owner','admin','accountant') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Evidence capability unavailable'; END IF;
 IF b IS DISTINCT FROM true OR r IS NULL OR e IS NULL OR btrim(e)='' OR octet_length(e)>65536 OR jsonb_typeof(t) IS DISTINCT FROM 'object' OR
   (SELECT count(*) FROM jsonb_object_keys(t))<>8 OR
   NOT (t ?& ARRAY['version','party_type','party_id','currency','agreement_id','agreement_date','payment_deadline','discount_gross_pence']) OR
   t->'version'<>'1'::jsonb OR t->>'currency'<>'GBP' OR t->>'party_type' NOT IN ('customer','supplier') OR
   EXISTS(SELECT 1 FROM jsonb_each(t) WHERE key<>'version' AND jsonb_typeof(value)<>'string') OR
   t->>'discount_gross_pence' !~ '^[1-9][0-9]{0,11}$' OR
   t->>'agreement_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR t->>'payment_deadline' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR
   (t->>'agreement_date')::date NOT BETWEEN DATE '1900-01-01' AND DATE '2199-12-31' OR
   (t->>'payment_deadline')::date NOT BETWEEN (t->>'agreement_date')::date AND DATE '2199-12-31'
 THEN RAISE EXCEPTION 'Invalid agreement evidence'; END IF;
 -- UUID identity is case insensitive; canonical terms and retries use lowercase.
 t=jsonb_set(jsonb_set(t,'{party_id}',to_jsonb((t->>'party_id')::uuid::text)),'{agreement_id}',to_jsonb((t->>'agreement_id')::uuid::text));
 IF t->>'party_type'='customer' THEN
   PERFORM 1 FROM public.customers WHERE company_id=c AND id=(t->>'party_id')::uuid AND status='active' FOR SHARE;
 ELSE
   PERFORM 1 FROM public.suppliers WHERE company_id=c AND id=(t->>'party_id')::uuid AND status='active' FOR SHARE;
 END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'Evidence party unavailable'; END IF;
 term_hash='sha256:'||encode(sha256(convert_to(array_to_json(ARRAY['1',t->>'party_type',t->>'party_id',t->>'currency',t->>'agreement_id',t->>'agreement_date',t->>'payment_deadline',t->>'discount_gross_pence'])::text,'UTF8')),'hex');
 SELECT * INTO old FROM public.conditional_discount_evidence WHERE company_id=c AND request_id=r;
 IF FOUND THEN
   IF old.actor_id<>a OR old.terms<>t OR old.evidence_text<>e THEN RAISE EXCEPTION 'Evidence request conflict'; END IF;
   RETURN old.id;
 END IF;
 result=gen_random_uuid();
 INSERT INTO public.conditional_discount_evidence(id,company_id,request_id,actor_id,version,party_type,party_id,currency,terms,terms_hash,evidence_text,evidence_hash,attested,recorded_at)
 VALUES(result,c,r,a,1,t->>'party_type',(t->>'party_id')::uuid,'GBP',t,term_hash,e,'sha256:'||encode(sha256(convert_to(e,'UTF8')),'hex'),true,clock_timestamp());
 RETURN result;
END $$;
ALTER FUNCTION public.capture_conditional_discount_evidence(uuid,text,uuid,jsonb,text,boolean) OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON FUNCTION public.capture_conditional_discount_evidence(uuid,text,uuid,jsonb,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_conditional_discount_evidence(uuid,text,uuid,jsonb,text,boolean) TO ledgerly_api;

-- Internal original-binding prerequisite. No public conditional posting admission.
-- No backfill: a later transaction cannot attach terms to an old journal.
CREATE TABLE public.conditional_discount_journal_origins (
  company_id uuid NOT NULL, journal_id uuid NOT NULL REFERENCES public.canonical_journal_entries(id),
  source_xid xid8 NOT NULL, cluster_id text NOT NULL,
  PRIMARY KEY(company_id,journal_id)
);
ALTER TABLE public.conditional_discount_journal_origins OWNER TO ledgerly_canonical_owner;
CREATE FUNCTION public.conditional_discount_journal_origin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  INSERT INTO public.conditional_discount_journal_origins VALUES
    (NEW.company_id,NEW.id,pg_current_xact_id(),(pg_control_system()).system_identifier::text);
  RETURN NEW;
END $$;
ALTER FUNCTION public.conditional_discount_journal_origin() OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON FUNCTION public.conditional_discount_journal_origin() FROM PUBLIC,ledgerly_api;
CREATE TRIGGER conditional_discount_journal_origin AFTER INSERT ON public.canonical_journal_entries
 FOR EACH ROW EXECUTE FUNCTION public.conditional_discount_journal_origin();
ALTER TABLE public.canonical_journal_entries ENABLE ALWAYS TRIGGER conditional_discount_journal_origin;

CREATE TABLE public.conditional_discount_original_bindings (
 company_id uuid NOT NULL,document_id uuid NOT NULL,journal_id uuid NOT NULL,
 binding jsonb NOT NULL,binding_hash text NOT NULL CHECK(binding_hash ~ '^sha256:[a-f0-9]{64}$'),
 canonical_payload text NOT NULL CHECK(octet_length(canonical_payload) BETWEEN 1 AND 1048576),
 actor_id text NOT NULL,source_xid xid8 NOT NULL,cluster_id text NOT NULL,
 PRIMARY KEY(company_id,document_id),UNIQUE(company_id,journal_id),
 FOREIGN KEY(company_id,journal_id) REFERENCES public.conditional_discount_journal_origins(company_id,journal_id),
 FOREIGN KEY(company_id,document_id) REFERENCES public.accounting_document_sources(company_id,id)
);
ALTER TABLE public.conditional_discount_original_bindings OWNER TO ledgerly_canonical_owner;
CREATE FUNCTION public.conditional_discount_original_bind() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE origin public.conditional_discount_journal_origins%ROWTYPE;
BEGIN
 PERFORM id FROM public.companies WHERE id=NEW.company_id FOR UPDATE;
 PERFORM id FROM public.company_users WHERE company_id=NEW.company_id AND user_id=NEW.actor_id ORDER BY id FOR UPDATE;
 SELECT * INTO origin FROM public.conditional_discount_journal_origins
  WHERE company_id=NEW.company_id AND journal_id=NEW.journal_id;
 IF NOT FOUND OR origin.source_xid<>pg_current_xact_id() OR
    origin.cluster_id<>(pg_control_system()).system_identifier::text THEN
   RAISE EXCEPTION 'Conditional original requires same original posting transaction';
 END IF;
 IF NEW.canonical_payload IS NULL OR octet_length(NEW.canonical_payload) NOT BETWEEN 1 AND 1048576 THEN
  RAISE EXCEPTION 'Conditional original payload commitment invalid';
 END IF;
 IF NEW.canonical_payload::jsonb IS DISTINCT FROM NEW.binding OR
    NEW.binding_hash IS DISTINCT FROM 'sha256:'||encode(sha256(convert_to(NEW.canonical_payload,'UTF8')),'hex') THEN
  RAISE EXCEPTION 'Conditional original payload commitment invalid';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.accounting_document_sources d
  JOIN public.canonical_journal_entries j ON j.id=d.journal_id AND j.company_id=d.company_id
  JOIN public.accounting_posting_effects p ON p.company_id=j.company_id AND p.journal_id=j.id
  JOIN public.conditional_discount_evidence e ON e.company_id=d.company_id
    AND e.id=(NEW.binding->>'evidence_id')::uuid
  WHERE d.company_id=NEW.company_id AND d.id=NEW.document_id AND d.journal_id=NEW.journal_id
    AND d.status='posted' AND d.kind IN ('sales_invoice','purchase_bill') AND d.original_id IS NULL
    AND j.status='posted' AND j.source_type=d.kind AND j.source_id=d.id::text
    AND j.posting_kind='ordinary_document' AND j.economic_effect_id='document:'||d.id::text
    AND j.source_revision=d.revision::text AND j.source_revision=NEW.binding->>'revision'
    AND j.source_evidence_hash=NEW.binding_hash
    AND NEW.binding->>'version'='1' AND NEW.binding->>'company_id'=d.company_id::text
    AND NEW.binding->>'document_id'=d.id::text AND NOT (NEW.binding ? 'journal_id')
    AND p.source_revision=j.source_revision AND p.source_evidence_hash=j.source_evidence_hash
    AND p.status='posted' AND p.source_type=j.source_type AND p.source_id=j.source_id
    AND p.posting_kind=j.posting_kind AND p.economic_effect_id=j.economic_effect_id
    AND e.terms_hash=NEW.binding->>'terms_hash' AND e.party_id=d.party_id
    AND d.source->'conditional_discount'->>'evidence_receipt_id'=e.id::text
    AND d.source->'conditional_discount'->>'discount_gross_pence'=NEW.binding->>'discount_gross_pence'
    AND d.source->'conditional_discount'->>'payment_deadline'=NEW.binding->>'deadline'
    AND d.money->>'gross_pence'=NEW.binding->>'gross_pence'
    AND NEW.binding->>'currency'='GBP' AND j.currency_code='GBP'
    AND e.currency='GBP' AND e.party_type=CASE WHEN d.kind='sales_invoice' THEN 'customer' ELSE 'supplier' END
    AND d.party_id::text=NEW.binding->>'party_id'
    AND (SELECT count(*)=1 AND count(*) FILTER (WHERE m.is_active AND m.role IN ('owner','admin','accountant'))=1
      FROM public.company_users m WHERE m.company_id=d.company_id AND m.user_id=NEW.actor_id)
 ) THEN RAISE EXCEPTION 'Conditional original source or posting identity invalid'; END IF;
 NEW.source_xid=origin.source_xid;NEW.cluster_id=origin.cluster_id;
 RETURN NEW;
END $$;
ALTER FUNCTION public.conditional_discount_original_bind() OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON FUNCTION public.conditional_discount_original_bind() FROM PUBLIC,ledgerly_api;
CREATE TRIGGER conditional_discount_original_bind BEFORE INSERT ON public.conditional_discount_original_bindings
 FOR EACH ROW EXECUTE FUNCTION public.conditional_discount_original_bind();
ALTER TABLE public.conditional_discount_original_bindings ENABLE ALWAYS TRIGGER conditional_discount_original_bind;

CREATE TABLE public.conditional_discount_original_observations (
 company_id uuid NOT NULL,document_id uuid NOT NULL,observed_at timestamptz NOT NULL,
 PRIMARY KEY(company_id,document_id),
 FOREIGN KEY(company_id,document_id) REFERENCES public.conditional_discount_original_bindings(company_id,document_id)
);
ALTER TABLE public.conditional_discount_original_observations OWNER TO ledgerly_canonical_owner;
CREATE FUNCTION public.conditional_discount_original_observe() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE origin public.conditional_discount_original_bindings%ROWTYPE;
BEGIN
 SELECT * INTO origin FROM public.conditional_discount_original_bindings
 WHERE company_id=NEW.company_id AND document_id=NEW.document_id;
 IF NOT FOUND OR origin.cluster_id<>(pg_control_system()).system_identifier::text
   OR pg_xact_status(origin.source_xid) IS DISTINCT FROM 'committed' THEN
  RAISE EXCEPTION 'Conditional original transaction not committed';
 END IF;
 -- Even direct restricted-role SQL must verify the immutable pre-journal
 -- commitment before establishing a first clock (or attempting a retry).
 IF origin.canonical_payload::jsonb IS DISTINCT FROM origin.binding OR
    origin.binding_hash IS DISTINCT FROM 'sha256:'||encode(sha256(convert_to(origin.canonical_payload,'UTF8')),'hex') OR
    NOT EXISTS (
      SELECT 1 FROM public.accounting_document_sources d
      JOIN public.canonical_journal_entries j ON j.company_id=d.company_id AND j.id=d.journal_id
      JOIN public.accounting_posting_effects p ON p.company_id=j.company_id AND p.journal_id=j.id
      WHERE d.company_id=origin.company_id AND d.id=origin.document_id AND d.journal_id=origin.journal_id
        AND d.status='posted' AND j.status='posted' AND d.kind IN ('sales_invoice','purchase_bill') AND d.original_id IS NULL
        AND j.source_type=d.kind AND j.source_id=d.id::text AND j.source_revision=d.revision::text
        AND j.posting_kind='ordinary_document' AND j.economic_effect_id='document:'||d.id::text AND j.currency_code='GBP'
        AND j.source_evidence_hash=origin.binding_hash AND p.source_evidence_hash=j.source_evidence_hash
        AND p.source_type=j.source_type AND p.source_id=j.source_id AND p.source_revision=j.source_revision
        AND p.posting_kind=j.posting_kind AND p.economic_effect_id=j.economic_effect_id AND p.status='posted'
    ) THEN RAISE EXCEPTION 'Conditional original payload commitment invalid'; END IF;
 NEW.observed_at=clock_timestamp();RETURN NEW;
END $$;
ALTER FUNCTION public.conditional_discount_original_observe() OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON FUNCTION public.conditional_discount_original_observe() FROM PUBLIC,ledgerly_api;
CREATE TRIGGER conditional_discount_original_observe BEFORE INSERT ON public.conditional_discount_original_observations
 FOR EACH ROW EXECUTE FUNCTION public.conditional_discount_original_observe();
ALTER TABLE public.conditional_discount_original_observations ENABLE ALWAYS TRIGGER conditional_discount_original_observe;
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['conditional_discount_journal_origins','conditional_discount_original_bindings','conditional_discount_original_observations'] LOOP
  EXECUTE format('CREATE TRIGGER conditional_original_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.conditional_discount_witness_immutable()',t);
  EXECUTE format('CREATE TRIGGER conditional_original_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.conditional_discount_witness_immutable()',t);
  EXECUTE format('ALTER TABLE public.%I ENABLE ALWAYS TRIGGER conditional_original_immutable',t);
  EXECUTE format('ALTER TABLE public.%I ENABLE ALWAYS TRIGGER conditional_original_no_truncate',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,ledgerly_api',t);
  EXECUTE format('GRANT SELECT ON public.%I TO ledgerly_api',t);
 END LOOP;
END $$;
CREATE FUNCTION public.bind_conditional_discount_original(c uuid,d uuid,j uuid,b jsonb,h text,a text,payload text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 INSERT INTO public.conditional_discount_original_bindings(company_id,document_id,journal_id,binding,binding_hash,actor_id,canonical_payload)
 VALUES(c,d,j,b,h,a,payload);
END $$;
ALTER FUNCTION public.bind_conditional_discount_original(uuid,uuid,uuid,jsonb,text,text,text) OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON FUNCTION public.bind_conditional_discount_original(uuid,uuid,uuid,jsonb,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bind_conditional_discount_original(uuid,uuid,uuid,jsonb,text,text,text) TO ledgerly_api;
CREATE FUNCTION public.observe_conditional_discount_original(c uuid,d uuid,a text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM id FROM public.companies WHERE id=c FOR UPDATE;
 PERFORM id FROM public.company_users WHERE company_id=c AND user_id=a ORDER BY id FOR UPDATE;
 IF NOT (SELECT count(*)=1 AND count(*) FILTER (WHERE m.is_active AND m.role IN ('owner','admin','accountant'))=1
   FROM public.company_users m WHERE m.company_id=c AND m.user_id=a) THEN
  RAISE EXCEPTION 'Active writable company membership required';
 END IF;
 INSERT INTO public.conditional_discount_original_observations(company_id,document_id)
 VALUES(c,d) ON CONFLICT(company_id,document_id) DO NOTHING;
END $$;
ALTER FUNCTION public.observe_conditional_discount_original(uuid,uuid,text) OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON FUNCTION public.observe_conditional_discount_original(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.observe_conditional_discount_original(uuid,uuid,text) TO ledgerly_api;
GRANT SELECT ON public.accounting_document_sources,public.canonical_journal_entries,public.accounting_posting_effects TO ledgerly_canonical_owner;
GRANT SELECT(id,company_id,status) ON public.customers,public.suppliers TO ledgerly_canonical_owner;
GRANT SELECT(id,country,base_currency), UPDATE(id) ON public.companies TO ledgerly_canonical_owner;
GRANT UPDATE(id) ON public.company_users,public.customers,public.suppliers TO ledgerly_canonical_owner;
