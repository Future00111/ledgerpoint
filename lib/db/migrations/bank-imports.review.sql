-- Development-only additive command boundary. No runtime table INSERT grant.
CREATE TABLE accounting_bank_imports (
  company_id uuid NOT NULL REFERENCES companies(id),
  request_id uuid NOT NULL,
  actor_id text NOT NULL,
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id),
  intent jsonb NOT NULL,
  receipt jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(company_id,request_id)
);
CREATE FUNCTION ledgerly_record_bank_import(c uuid,a text,b uuid,r uuid,items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE roles text[]; old public.accounting_bank_imports; item jsonb; inserted public.bank_transactions;
  result jsonb='[]'::jsonb; incoming numeric; outgoing numeric; rowdate date;
BEGIN
  PERFORM 1 FROM public.companies WHERE id=c FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BANK_COMPANY_UNAVAILABLE'; END IF;
  SELECT array_agg(role) INTO roles FROM
    (SELECT CASE WHEN is_active THEN role ELSE 'inactive' END role FROM public.company_users WHERE company_id=c AND user_id=a FOR UPDATE) members;
  IF cardinality(roles) IS DISTINCT FROM 1 OR roles[1] NOT IN ('owner','admin','accountant','staff','member')
    THEN RAISE EXCEPTION 'BANK_IMPORT_DENIED'; END IF;
  PERFORM 1 FROM public.bank_accounts WHERE id=b AND company_id=c AND status='active' AND currency='GBP' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BANK_ACCOUNT_UNAVAILABLE'; END IF;
  SELECT * INTO old FROM public.accounting_bank_imports WHERE company_id=c AND request_id=r;
  IF FOUND THEN
    IF old.actor_id<>a OR old.bank_account_id<>b OR old.intent IS DISTINCT FROM items
      THEN RAISE EXCEPTION 'BANK_IMPORT_REQUEST_CONFLICT'; END IF;
    RETURN old.receipt;
  END IF;
  IF r IS NULL OR jsonb_typeof(items) IS DISTINCT FROM 'array' OR jsonb_array_length(items) NOT BETWEEN 1 AND 500
    THEN RAISE EXCEPTION 'BANK_IMPORT_ROWS_INVALID'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR
       item - ARRAY['date','description','reference','money_in','money_out']::text[] <> '{}'::jsonb
      THEN RAISE EXCEPTION 'BANK_IMPORT_FIELDS_INVALID'; END IF;
    IF jsonb_typeof(item->'money_in') IS DISTINCT FROM 'string' OR jsonb_typeof(item->'money_out') IS DISTINCT FROM 'string'
      OR (item->>'money_in') !~ '^[0-9]{1,10}\.[0-9]{2}$'
      OR (item->>'money_out') !~ '^[0-9]{1,10}\.[0-9]{2}$'
      THEN RAISE EXCEPTION 'BANK_IMPORT_MONEY_INVALID'; END IF;
    incoming=(item->>'money_in')::numeric; outgoing=(item->>'money_out')::numeric;
    IF (incoming=0)=(outgoing=0) THEN RAISE EXCEPTION 'BANK_IMPORT_SIDES_INVALID'; END IF;
    IF jsonb_typeof(item->'date') IS DISTINCT FROM 'string' OR (item->>'date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      THEN RAISE EXCEPTION 'BANK_IMPORT_DATE_INVALID'; END IF;
    rowdate=(item->>'date')::date;
    IF rowdate < DATE '1900-01-01' OR rowdate > DATE '2199-12-31'
      THEN RAISE EXCEPTION 'BANK_IMPORT_DATE_INVALID'; END IF;
    IF jsonb_typeof(item->'description') IS DISTINCT FROM 'string' OR length(btrim(item->>'description')) NOT BETWEEN 1 AND 1000
      OR jsonb_typeof(item->'reference') IS DISTINCT FROM 'string' OR length(item->>'reference')>500
      THEN RAISE EXCEPTION 'BANK_IMPORT_TEXT_INVALID'; END IF;
    INSERT INTO public.bank_transactions(id,company_id,bank_account_id,date,description,reference,amount,money_in,money_out,status)
    VALUES(gen_random_uuid(),c,b,rowdate,item->>'description',item->>'reference',incoming+outgoing,incoming,outgoing,'review')
    RETURNING * INTO inserted;
    result=result || jsonb_build_array(to_jsonb(inserted) || jsonb_build_object(
      'amount',inserted.amount::text,'money_in',inserted.money_in::text,'money_out',inserted.money_out::text));
  END LOOP;
  INSERT INTO public.accounting_bank_imports(company_id,request_id,actor_id,bank_account_id,intent,receipt)
    VALUES(c,r,a,b,items,jsonb_build_object('request_id',r,'company_id',c,'bank_account_id',b,'rows',result));
  RETURN jsonb_build_object('request_id',r,'company_id',c,'bank_account_id',b,'rows',result);
END $$;
CREATE FUNCTION ledgerly_bank_import_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'BANK_IMPORT_RECEIPT_IMMUTABLE'; END $$;
CREATE TRIGGER bank_import_receipt_immutable BEFORE UPDATE OR DELETE ON accounting_bank_imports
FOR EACH ROW EXECUTE FUNCTION ledgerly_bank_import_immutable();
CREATE TRIGGER bank_import_receipt_no_truncate BEFORE TRUNCATE ON accounting_bank_imports
FOR EACH STATEMENT EXECUTE FUNCTION ledgerly_bank_import_immutable();
REVOKE ALL ON accounting_bank_imports FROM PUBLIC,ledgerly_api;
REVOKE ALL ON FUNCTION ledgerly_record_bank_import(uuid,text,uuid,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ledgerly_record_bank_import(uuid,text,uuid,uuid,jsonb) TO ledgerly_api;
-- Function ownership is a dedicated NOLOGIN role, never the application login.
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='ledgerly_bank_import_owner') THEN
 CREATE ROLE ledgerly_bank_import_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
END $$;
GRANT USAGE ON SCHEMA public TO ledgerly_bank_import_owner;
GRANT SELECT ON companies,company_users,bank_accounts TO ledgerly_bank_import_owner;
GRANT UPDATE(id) ON companies,company_users,bank_accounts TO ledgerly_bank_import_owner;
GRANT SELECT,INSERT ON bank_transactions,accounting_bank_imports TO ledgerly_bank_import_owner;
ALTER FUNCTION ledgerly_record_bank_import(uuid,text,uuid,uuid,jsonb) OWNER TO ledgerly_bank_import_owner;
CREATE FUNCTION ledgerly_find_bank_import(c uuid,a text,r uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE members integer; permitted integer; result jsonb;
BEGIN
 SELECT count(*),count(*) FILTER(WHERE is_active AND role IN ('owner','admin','accountant','staff','member','read_only'))
 INTO members,permitted FROM public.company_users WHERE company_id=c AND user_id=a;
 IF members<>1 OR permitted<>1 THEN RAISE EXCEPTION 'BANK_IMPORT_DENIED'; END IF;
 SELECT receipt INTO result FROM public.accounting_bank_imports WHERE company_id=c AND request_id=r;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION ledgerly_find_bank_import(uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ledgerly_find_bank_import(uuid,text,uuid) TO ledgerly_api;
ALTER FUNCTION ledgerly_find_bank_import(uuid,text,uuid) OWNER TO ledgerly_bank_import_owner;
