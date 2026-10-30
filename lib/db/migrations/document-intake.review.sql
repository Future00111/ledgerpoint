-- Additive reviewed development schema. Apply explicitly only to a verified
-- isolated database; normal application startup must never run this migration.
CREATE UNIQUE INDEX IF NOT EXISTS accounting_document_sources_company_id_idx
  ON accounting_document_sources(company_id,id);
CREATE TABLE IF NOT EXISTS document_intake_sources (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  revision uuid NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  media_type text NOT NULL CHECK (media_type IN ('application/pdf','image/jpeg','image/png')),
  filename text NOT NULL CHECK (length(filename) BETWEEN 1 AND 255),
  byte_length integer NOT NULL CHECK (byte_length BETWEEN 4 AND 5242880),
  content bytea NOT NULL CHECK (octet_length(content)=byte_length),
  channel text NOT NULL CHECK (channel='upload'),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  document_id uuid,
  review_fingerprint text CHECK (review_fingerprint ~ '^v1:[0-9a-f]{64}:[0-9a-f]{64}$'),
  UNIQUE(company_id,id),
  UNIQUE(company_id,sha256),
  UNIQUE(company_id,document_id),
  CHECK ((document_id IS NULL) = (review_fingerprint IS NULL)),
  FOREIGN KEY(company_id,document_id) REFERENCES accounting_document_sources(company_id,id)
);
CREATE TABLE IF NOT EXISTS document_intake_audit (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  source_id uuid NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('upload','draft_created')),
  document_id uuid,
  review_fingerprint text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(company_id,source_id) REFERENCES document_intake_sources(company_id,id),
  FOREIGN KEY(company_id,document_id) REFERENCES accounting_document_sources(company_id,id),
  CHECK ((action='upload' AND document_id IS NULL AND review_fingerprint IS NULL) OR
    (action='draft_created' AND document_id IS NOT NULL AND review_fingerprint IS NOT NULL
      AND review_fingerprint ~ '^v1:[0-9a-f]{64}:[0-9a-f]{64}$'))
);
CREATE OR REPLACE FUNCTION document_intake_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN RAISE EXCEPTION 'Captured source evidence is immutable'; END IF;
  IF OLD.document_id IS NOT NULL OR NEW.document_id IS NULL OR NEW.review_fingerprint IS NULL
    OR NEW.revision=OLD.revision
    OR (to_jsonb(NEW)-ARRAY['revision','document_id','review_fingerprint']) IS DISTINCT FROM
       (to_jsonb(OLD)-ARRAY['revision','document_id','review_fingerprint']) THEN
    RAISE EXCEPTION 'Only the first reviewed draft link may change captured source evidence';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION document_intake_audit_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Capture audit history is immutable'; END $$;
DROP TRIGGER IF EXISTS document_intake_source_guard ON document_intake_sources;
CREATE TRIGGER document_intake_source_guard BEFORE UPDATE OR DELETE ON document_intake_sources
  FOR EACH ROW EXECUTE FUNCTION document_intake_source_guard();
DROP TRIGGER IF EXISTS document_intake_source_truncate_guard ON document_intake_sources;
CREATE TRIGGER document_intake_source_truncate_guard BEFORE TRUNCATE ON document_intake_sources
  FOR EACH STATEMENT EXECUTE FUNCTION document_intake_audit_guard();
DROP TRIGGER IF EXISTS document_intake_audit_guard ON document_intake_audit;
CREATE TRIGGER document_intake_audit_guard BEFORE UPDATE OR DELETE ON document_intake_audit
  FOR EACH ROW EXECUTE FUNCTION document_intake_audit_guard();
DROP TRIGGER IF EXISTS document_intake_audit_truncate_guard ON document_intake_audit;
CREATE TRIGGER document_intake_audit_truncate_guard BEFORE TRUNCATE ON document_intake_audit
  FOR EACH STATEMENT EXECUTE FUNCTION document_intake_audit_guard();
GRANT SELECT,INSERT ON document_intake_sources,document_intake_audit TO ledgerly_api;
REVOKE UPDATE,DELETE,TRUNCATE ON document_intake_sources,document_intake_audit FROM ledgerly_api;
GRANT UPDATE(revision,document_id,review_fingerprint) ON document_intake_sources TO ledgerly_api;
