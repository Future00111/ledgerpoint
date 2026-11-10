CREATE TABLE accounting_bank_match_corrections (
 company_id uuid NOT NULL REFERENCES companies(id),
 request_id uuid NOT NULL,
 match_request_id uuid NOT NULL,
 intent jsonb NOT NULL,
 evidence jsonb NOT NULL,
 evidence_hash text NOT NULL,
 actor_id text NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 1000),
 effective_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,request_id),
 UNIQUE(company_id,match_request_id),
 FOREIGN KEY(company_id,match_request_id) REFERENCES accounting_bank_matches(company_id,request_id)
);
CREATE TRIGGER accounting_bank_match_corrections_immutable BEFORE UPDATE OR DELETE ON accounting_bank_match_corrections
 FOR EACH ROW EXECUTE FUNCTION accounting_bank_opening_immutable();
CREATE TRIGGER accounting_bank_match_corrections_no_truncate BEFORE TRUNCATE ON accounting_bank_match_corrections
 FOR EACH STATEMENT EXECUTE FUNCTION accounting_bank_opening_immutable();
REVOKE ALL ON accounting_bank_match_corrections FROM PUBLIC,ledgerly_api;
GRANT SELECT,INSERT ON accounting_bank_match_corrections TO ledgerly_api;
CREATE VIEW accounting_bank_active_matches WITH (security_invoker=true) AS
 SELECT m.* FROM accounting_bank_matches m WHERE NOT EXISTS
 (SELECT 1 FROM accounting_bank_match_corrections c WHERE c.company_id=m.company_id AND c.match_request_id=m.request_id);
REVOKE ALL ON accounting_bank_active_matches FROM PUBLIC,ledgerly_api;
GRANT SELECT ON accounting_bank_active_matches TO ledgerly_api;
