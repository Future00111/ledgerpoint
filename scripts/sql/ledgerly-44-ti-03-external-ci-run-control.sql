-- Ledgerly #44/TI-03 private run binding.
-- This artifact is executed only by the disposable PostgreSQL administrator.
-- It must not contain application or accounting product tables.

CREATE SCHEMA IF NOT EXISTS ledgerly_test_control;

CREATE TABLE IF NOT EXISTS ledgerly_test_control.run_identity (
  run_uuid uuid PRIMARY KEY,
  expected_database_name text NOT NULL UNIQUE,
  environment text NOT NULL,
  target_classification text NOT NULL,
  ci_provider text NOT NULL,
  ci_repository text NOT NULL,
  ci_workflow text NOT NULL,
  ci_workflow_ref text NOT NULL,
  ci_run_id text NOT NULL,
  ci_run_attempt text NOT NULL,
  ci_job text NOT NULL,
  source_commit text NOT NULL,
  source_tree_sha256 text NOT NULL,
  application_schema_sha256 text NOT NULL,
  drizzle_config_sha256 text NOT NULL,
  security_overlay_sha256 text NOT NULL,
  application_schema_digest text NOT NULL,
  drizzle_config_digest text NOT NULL,
  security_overlay_digest text NOT NULL,
  run_control_sql_sha256 text NOT NULL,
  coordinator_sha256 text NOT NULL,
  test_sources_sha256 text NOT NULL,
  lockfile_sha256 text NOT NULL,
  workflow_sha256 text NOT NULL,
  orchestrator_sha256 text NOT NULL,
  expected_test_command text NOT NULL,
  creator_identity text NOT NULL,
  expected_runtime_identity text NOT NULL,
  run_binding_nonce text NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  postgres_image_tag text NOT NULL,
  postgres_image_digest text NOT NULL,
  node_image_tag text NOT NULL,
  node_image_digest text NOT NULL,
  prohibits_heliumdb boolean NOT NULL DEFAULT true,
  prohibits_production boolean NOT NULL DEFAULT true,
  CONSTRAINT run_identity_database_name CHECK (
    expected_database_name ~ '^ledgerly_canonical_test_[0-9a-f]{32}$'
  ),
  CONSTRAINT run_identity_hashes CHECK (
    source_tree_sha256 ~ '^[0-9a-f]{64}$'
    AND application_schema_sha256 ~ '^[0-9a-f]{64}$'
    AND drizzle_config_sha256 ~ '^[0-9a-f]{64}$'
    AND security_overlay_sha256 ~ '^[0-9a-f]{64}$'
    AND application_schema_digest = application_schema_sha256
    AND drizzle_config_digest = drizzle_config_sha256
    AND security_overlay_digest = security_overlay_sha256
    AND run_control_sql_sha256 ~ '^[0-9a-f]{64}$'
    AND coordinator_sha256 ~ '^[0-9a-f]{64}$'
    AND test_sources_sha256 ~ '^[0-9a-f]{64}$'
    AND lockfile_sha256 ~ '^[0-9a-f]{64}$'
    AND workflow_sha256 ~ '^[0-9a-f]{64}$'
    AND orchestrator_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT run_identity_nonce CHECK (run_binding_nonce ~ '^[0-9a-f]{64}$'),
  CONSTRAINT run_identity_time_window CHECK (expires_at > created_at),
  CONSTRAINT run_identity_exact_policy CHECK (
    environment = 'external-ci-disposable-test'
    AND target_classification = 'external-ci-postgresql-service-container'
    AND ci_provider = 'github-actions'
    AND ci_workflow_ref ~ '/\.github/workflows/ledgerly-canonical-postgresql\.yml@refs/heads/main$'
    AND creator_identity = 'postgres'
    AND expected_runtime_identity = 'ledgerly_api'
    AND prohibits_heliumdb
    AND prohibits_production
  )
);

ALTER SCHEMA ledgerly_test_control OWNER TO postgres;
ALTER TABLE ledgerly_test_control.run_identity OWNER TO postgres;

REVOKE ALL ON SCHEMA ledgerly_test_control FROM PUBLIC;
REVOKE ALL ON TABLE ledgerly_test_control.run_identity FROM PUBLIC;
REVOKE ALL ON SCHEMA ledgerly_test_control FROM ledgerly_api;
REVOKE ALL ON TABLE ledgerly_test_control.run_identity FROM ledgerly_api;
REVOKE ALL ON SCHEMA ledgerly_test_control FROM ledgerly_canonical_owner;
REVOKE ALL ON TABLE ledgerly_test_control.run_identity FROM ledgerly_canonical_owner;