-- Read-only prerequisite for residual-capacity observations. No posting gate changes.
CREATE FUNCTION public.conditional_capacity_origins(c uuid, ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 IF ids IS NULL OR cardinality(ids)=0 OR cardinality(ids)>1000
   OR EXISTS(SELECT 1 FROM unnest(ids) x WHERE x IS NULL)
   OR cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids) x)
 THEN RAISE EXCEPTION 'Capacity journal identity invalid'; END IF;
 IF (SELECT count(*) FROM public.conditional_discount_journal_origins o
     JOIN public.canonical_journal_entries j ON j.company_id=o.company_id AND j.id=o.journal_id
     WHERE o.company_id=c AND o.journal_id=ANY(ids) AND j.status='posted')<>cardinality(ids)
 THEN RAISE EXCEPTION 'Capacity journal origin unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM public.conditional_discount_journal_origins o
     WHERE o.company_id=c AND o.journal_id=ANY(ids)
       AND (o.cluster_id IS DISTINCT FROM (pg_control_system()).system_identifier::text
         OR o.source_xid=pg_current_xact_id()
         OR pg_xact_status(o.source_xid) IS DISTINCT FROM 'committed'))
 THEN RAISE EXCEPTION 'Capacity journal transaction not committed locally'; END IF;
 SELECT jsonb_agg(jsonb_build_object('journal_id',journal_id,'source_xid',source_xid::text,
   'cluster_id',cluster_id) ORDER BY journal_id) INTO result
 FROM public.conditional_discount_journal_origins WHERE company_id=c AND journal_id=ANY(ids);
 RETURN result;
END $$;
ALTER FUNCTION public.conditional_capacity_origins(uuid,uuid[]) OWNER TO ledgerly_canonical_owner;
REVOKE ALL ON FUNCTION public.conditional_capacity_origins(uuid,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.conditional_capacity_origins(uuid,uuid[]) TO ledgerly_api;
