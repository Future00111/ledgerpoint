-- Fresh disposable development installation only. Statement matching never
-- writes payments, allocations or canonical journals.
CREATE TABLE accounting_bank_matches (
 company_id uuid NOT NULL REFERENCES companies(id),
 request_id uuid NOT NULL,
 bank_transaction_id uuid NOT NULL REFERENCES bank_transactions(id),
 payment_id uuid NOT NULL REFERENCES accounting_payment_events(id),
 amount_minor numeric(20,0) NOT NULL CHECK(amount_minor>0),
 journal_id uuid NOT NULL REFERENCES canonical_journal_entries(id),
 intent jsonb NOT NULL,
 evidence jsonb NOT NULL,
 evidence_hash text NOT NULL,
 actor_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,request_id)
);
CREATE INDEX accounting_bank_matches_statement ON accounting_bank_matches(company_id,bank_transaction_id);
CREATE INDEX accounting_bank_matches_payment ON accounting_bank_matches(company_id,payment_id);
CREATE TRIGGER accounting_bank_matches_immutable BEFORE UPDATE OR DELETE ON accounting_bank_matches
 FOR EACH ROW EXECUTE FUNCTION accounting_bank_opening_immutable();
CREATE TRIGGER accounting_bank_matches_no_truncate BEFORE TRUNCATE ON accounting_bank_matches
 FOR EACH STATEMENT EXECUTE FUNCTION accounting_bank_opening_immutable();
REVOKE ALL ON accounting_bank_matches FROM PUBLIC,ledgerly_api;
GRANT SELECT,INSERT ON accounting_bank_matches TO ledgerly_api;

CREATE FUNCTION ledgerly_bank_statement_is_native(c uuid,t uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.accounting_bank_imports i,
 jsonb_array_elements(i.receipt->'rows') r WHERE i.company_id=c AND r->>'id'=t::text)
$$;
ALTER FUNCTION ledgerly_bank_statement_is_native(uuid,uuid) OWNER TO ledgerly_bank_import_owner;
REVOKE ALL ON FUNCTION ledgerly_bank_statement_is_native(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ledgerly_bank_statement_is_native(uuid,uuid) TO ledgerly_api;
CREATE FUNCTION ledgerly_imported_statement_immutable() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF public.ledgerly_bank_statement_is_native(OLD.company_id,OLD.id)
 THEN RAISE EXCEPTION 'Native imported statement evidence is immutable'; END IF;
 IF TG_OP='UPDATE' THEN RETURN NEW; END IF;
 RETURN OLD;
END $$;
ALTER FUNCTION ledgerly_imported_statement_immutable() OWNER TO ledgerly_bank_import_owner;
REVOKE ALL ON FUNCTION ledgerly_imported_statement_immutable() FROM PUBLIC;
CREATE TRIGGER ledgerly_imported_statement_immutable BEFORE UPDATE OR DELETE ON bank_transactions
 FOR EACH ROW EXECUTE FUNCTION ledgerly_imported_statement_immutable();
