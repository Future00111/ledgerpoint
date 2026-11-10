-- Fresh isolated development migration. Close the old executable import path.
CREATE TABLE accounting_bank_import_reviews (
 company_id uuid NOT NULL REFERENCES companies(id),
 request_id uuid NOT NULL,
 actor_id text NOT NULL,
 bank_account_id uuid NOT NULL REFERENCES bank_accounts(id),
 intent jsonb NOT NULL,
 review_token text NOT NULL CHECK(review_token ~ '^sha256:[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,request_id)
);
CREATE TRIGGER accounting_bank_import_reviews_immutable BEFORE UPDATE OR DELETE ON accounting_bank_import_reviews
 FOR EACH ROW EXECUTE FUNCTION accounting_bank_opening_immutable();
CREATE TRIGGER accounting_bank_import_reviews_no_truncate BEFORE TRUNCATE ON accounting_bank_import_reviews
 FOR EACH STATEMENT EXECUTE FUNCTION accounting_bank_opening_immutable();
REVOKE ALL ON accounting_bank_import_reviews FROM PUBLIC,ledgerly_api;
GRANT SELECT,INSERT ON accounting_bank_import_reviews TO ledgerly_api;
GRANT SELECT ON accounting_bank_import_reviews TO ledgerly_bank_import_owner;
REVOKE EXECUTE ON FUNCTION ledgerly_record_bank_import(uuid,text,uuid,uuid,jsonb) FROM PUBLIC,ledgerly_api;

CREATE FUNCTION ledgerly_record_reviewed_bank_import(c uuid,a text,b uuid,r uuid,items jsonb,token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE reviewed public.accounting_bank_import_reviews; old public.accounting_bank_imports;
BEGIN
 -- The same company lock serializes review/import services and all command
 -- invocations. Recheck current identity in the original private command too.
 PERFORM 1 FROM public.companies WHERE id=c FOR UPDATE;
 SELECT * INTO reviewed FROM public.accounting_bank_import_reviews WHERE company_id=c AND request_id=r;
 IF NOT FOUND OR reviewed.actor_id<>a OR reviewed.bank_account_id<>b
    OR reviewed.intent IS DISTINCT FROM items OR reviewed.review_token IS DISTINCT FROM token
 THEN RAISE EXCEPTION 'BANK_IMPORT_REVIEW_REQUIRED'; END IF;
 SELECT * INTO old FROM public.accounting_bank_imports WHERE company_id=c AND request_id=r;
 IF NOT FOUND THEN
   IF EXISTS (
     SELECT 1 FROM jsonb_array_elements(items) item JOIN public.bank_transactions t
       ON t.company_id=c AND t.bank_account_id=b AND t.date=(item->>'date')::date
       AND btrim(coalesce(t.description,''))=btrim(item->>'description')
       AND coalesce(t.reference,'')=coalesce(item->>'reference','')
       AND coalesce(t.money_in,0)=(item->>'money_in')::numeric AND coalesce(t.money_out,0)=(item->>'money_out')::numeric
   ) OR EXISTS (
     SELECT 1 FROM jsonb_array_elements(items) item
     GROUP BY (item->>'date')::date,btrim(item->>'description'),coalesce(item->>'reference',''),
       (item->>'money_in')::numeric,(item->>'money_out')::numeric HAVING count(*)>1
   ) THEN RAISE EXCEPTION 'BANK_IMPORT_DUPLICATE'; END IF;
 END IF;
 -- Private implementation retains actor admission, strict row validation,
 -- immutable command receipt and all-or-nothing batch persistence.
 RETURN public.ledgerly_record_bank_import(c,a,b,r,items);
END $$;
ALTER FUNCTION ledgerly_record_reviewed_bank_import(uuid,text,uuid,uuid,jsonb,text) OWNER TO ledgerly_bank_import_owner;
REVOKE ALL ON FUNCTION ledgerly_record_reviewed_bank_import(uuid,text,uuid,uuid,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ledgerly_record_reviewed_bank_import(uuid,text,uuid,uuid,jsonb,text) TO ledgerly_api;
