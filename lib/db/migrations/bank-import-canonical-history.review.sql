-- Exact ECMAScript String.trim whitespace; do not use PostgreSQL's space-only btrim.
CREATE FUNCTION ledgerly_import_trim(text) RETURNS text LANGUAGE sql IMMUTABLE STRICT
SET search_path=pg_catalog AS $$
 SELECT btrim($1,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
$$;
REVOKE ALL ON FUNCTION ledgerly_import_trim(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ledgerly_import_trim(text) TO ledgerly_bank_import_owner,ledgerly_api;
ALTER FUNCTION ledgerly_record_reviewed_bank_import(uuid,text,uuid,uuid,jsonb,text)
 RENAME TO ledgerly_record_reviewed_bank_import_private;
REVOKE ALL ON FUNCTION ledgerly_record_reviewed_bank_import_private(uuid,text,uuid,uuid,jsonb,text) FROM PUBLIC,ledgerly_api;
CREATE FUNCTION ledgerly_record_reviewed_bank_import(c uuid,a text,b uuid,r uuid,items jsonb,token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM 1 FROM public.companies WHERE id=c FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.accounting_bank_import_reviews v WHERE
   v.company_id=c AND v.request_id=r AND v.actor_id=a AND v.bank_account_id=b
   AND v.intent=items AND v.review_token=token)
 THEN RAISE EXCEPTION 'BANK_IMPORT_REVIEW_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.accounting_bank_imports WHERE company_id=c AND request_id=r) THEN
   IF EXISTS(SELECT 1 FROM public.bank_transactions t WHERE t.company_id=c AND t.bank_account_id=b AND
     (t.date IS NULL OR t.description IS NULL OR public.ledgerly_import_trim(t.description)=''
      OR coalesce(t.money_in,0)<0 OR coalesce(t.money_out,0)<0
      OR coalesce(t.money_in,0)::text !~ '^[0-9]+(\.[0-9]{1,2})?$'
      OR coalesce(t.money_out,0)::text !~ '^[0-9]+(\.[0-9]{1,2})?$'
      OR (coalesce(t.money_in,0)=0 AND coalesce(t.money_out,0)=0)
      OR (coalesce(t.money_in,0)>0 AND coalesce(t.money_out,0)>0)))
   THEN RAISE EXCEPTION 'BANK_IMPORT_LEGACY_HISTORY_UNKEYABLE'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(items) i JOIN public.bank_transactions t ON
     t.company_id=c AND t.bank_account_id=b AND t.date=(i->>'date')::date
     AND public.ledgerly_import_trim(t.description)=public.ledgerly_import_trim(i->>'description')
     AND coalesce(t.reference,'')=coalesce(i->>'reference','')
     AND coalesce(t.money_in,0)=(i->>'money_in')::numeric AND coalesce(t.money_out,0)=(i->>'money_out')::numeric)
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(items) i GROUP BY
     (i->>'date')::date,public.ledgerly_import_trim(i->>'description'),coalesce(i->>'reference',''),
     (i->>'money_in')::numeric,(i->>'money_out')::numeric HAVING count(*)>1)
   THEN RAISE EXCEPTION 'BANK_IMPORT_DUPLICATE'; END IF;
 END IF;
 RETURN public.ledgerly_record_reviewed_bank_import_private(c,a,b,r,items,token);
END $$;
ALTER FUNCTION ledgerly_record_reviewed_bank_import(uuid,text,uuid,uuid,jsonb,text) OWNER TO ledgerly_bank_import_owner;
REVOKE ALL ON FUNCTION ledgerly_record_reviewed_bank_import(uuid,text,uuid,uuid,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ledgerly_record_reviewed_bank_import(uuid,text,uuid,uuid,jsonb,text) TO ledgerly_api;
