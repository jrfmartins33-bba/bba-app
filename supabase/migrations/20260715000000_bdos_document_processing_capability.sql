-- Epic 21, Sprint 21.4A.1 - Minimal document processing capability.
--
-- This migration persists three separate concepts:
-- 1. Document artifact: logical identity over time.
-- 2. Document version: immutable concrete file version.
-- 3. Document processing attempt: one operational execution over a version.
--
-- It deliberately does not parse PDFs, create neutral evidence, interpret
-- economics, create Budget Versions, create Import Proposals, or expose a
-- public API. Mutations are server-only functions (EXECUTE only to
-- service_role), matching the trust boundary closed in Sprint 21.3C.

CREATE TABLE IF NOT EXISTS document_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_context TEXT NOT NULL CHECK (length(trim(document_context)) > 0),
  title TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  correlation_id TEXT,
  registered_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  source_system TEXT,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS document_artifacts_company_id_idx ON document_artifacts (company_id);

CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES document_artifacts(id),
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  original_file_name TEXT NOT NULL CHECK (length(trim(original_file_name)) > 0),
  mime_type TEXT NOT NULL CHECK (length(trim(mime_type)) > 0),
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  storage_reference TEXT NOT NULL CHECK (
    length(trim(storage_reference)) > 0
    AND storage_reference LIKE company_id::TEXT || '/%'
    AND storage_reference !~ '^[A-Za-z]:[\\/]'
    AND left(storage_reference, 1) <> '/'
    AND left(storage_reference, 1) <> chr(92)
    AND lower(storage_reference) NOT LIKE 'file:%'
    AND position(chr(92) in storage_reference) = 0
    AND storage_reference NOT LIKE '%/../%'
  ),
  technical_metadata JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  correlation_id TEXT,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  source_system TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, document_id, sha256)
);

CREATE INDEX IF NOT EXISTS document_versions_company_id_idx ON document_versions (company_id);
CREATE INDEX IF NOT EXISTS document_versions_document_id_idx ON document_versions (document_id);
CREATE INDEX IF NOT EXISTS document_versions_document_uploaded_at_idx ON document_versions (company_id, document_id, uploaded_at);

CREATE OR REPLACE FUNCTION enforce_document_version_document_consistency() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM document_artifacts
    WHERE id = NEW.document_id AND company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'document_versions.company_id must match the company_id of its document_id';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_document_versions_document_consistency ON document_versions;
CREATE TRIGGER enforce_document_versions_document_consistency
BEFORE INSERT OR UPDATE ON document_versions
FOR EACH ROW
EXECUTE FUNCTION enforce_document_version_document_consistency();

CREATE OR REPLACE FUNCTION prevent_document_version_update() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'document_versions are immutable after creation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_document_versions_update ON document_versions;
CREATE TRIGGER prevent_document_versions_update
BEFORE UPDATE ON document_versions
FOR EACH ROW
EXECUTE FUNCTION prevent_document_version_update();

CREATE TABLE IF NOT EXISTS document_processing_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_version_id UUID NOT NULL REFERENCES document_versions(id),
  status TEXT NOT NULL CHECK (status IN ('Requested', 'Processing', 'Completed', 'PartiallyCompleted', 'Failed', 'Abandoned')),
  mechanism TEXT NOT NULL CHECK (length(trim(mechanism)) > 0),
  mechanism_version TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error JSONB,
  partial_processing BOOLEAN NOT NULL DEFAULT FALSE,
  request_idempotency_key TEXT NOT NULL CHECK (length(trim(request_idempotency_key)) > 0),
  metadata JSONB NOT NULL DEFAULT '{}',
  correlation_id TEXT,
  requested_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  source_system TEXT,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, document_version_id, request_idempotency_key),
  CHECK (
    (status = 'Requested' AND started_at IS NULL AND finished_at IS NULL AND error IS NULL AND partial_processing = FALSE)
    OR (status = 'Processing' AND started_at IS NOT NULL AND finished_at IS NULL)
    OR (status = 'Completed' AND started_at IS NOT NULL AND finished_at IS NOT NULL AND error IS NULL AND partial_processing = FALSE)
    OR (status = 'PartiallyCompleted' AND started_at IS NOT NULL AND finished_at IS NOT NULL AND partial_processing = TRUE)
    OR (status = 'Failed' AND started_at IS NOT NULL AND finished_at IS NOT NULL AND error IS NOT NULL)
    OR (status = 'Abandoned' AND finished_at IS NOT NULL AND partial_processing = FALSE)
  ),
  CHECK (
    error IS NULL
    OR (
      jsonb_typeof(error) = 'object'
      AND error ? 'code'
      AND error ? 'message'
      AND length(trim(error->>'code')) > 0
      AND length(trim(error->>'message')) > 0
    )
  )
);

CREATE INDEX IF NOT EXISTS document_processing_attempts_company_id_idx ON document_processing_attempts (company_id);
CREATE INDEX IF NOT EXISTS document_processing_attempts_version_requested_at_idx
  ON document_processing_attempts (company_id, document_version_id, requested_at);

DROP TRIGGER IF EXISTS set_document_processing_attempts_updated_at ON document_processing_attempts;
CREATE TRIGGER set_document_processing_attempts_updated_at
BEFORE UPDATE ON document_processing_attempts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION enforce_document_processing_attempt_version_consistency() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM document_versions
    WHERE id = NEW.document_version_id AND company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'document_processing_attempts.company_id must match the company_id of its document_version_id';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_document_processing_attempts_version_consistency ON document_processing_attempts;
CREATE TRIGGER enforce_document_processing_attempts_version_consistency
BEFORE INSERT OR UPDATE ON document_processing_attempts
FOR EACH ROW
EXECUTE FUNCTION enforce_document_processing_attempt_version_consistency();

ALTER TABLE document_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_processing_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_artifacts_select_company_or_admin ON document_artifacts;
CREATE POLICY document_artifacts_select_company_or_admin
ON document_artifacts FOR SELECT TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS document_artifacts_insert_blocked ON document_artifacts;
CREATE POLICY document_artifacts_insert_blocked ON document_artifacts FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS document_artifacts_update_blocked ON document_artifacts;
CREATE POLICY document_artifacts_update_blocked ON document_artifacts FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS document_artifacts_delete_blocked ON document_artifacts;
CREATE POLICY document_artifacts_delete_blocked ON document_artifacts FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS document_versions_select_company_or_admin ON document_versions;
CREATE POLICY document_versions_select_company_or_admin
ON document_versions FOR SELECT TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS document_versions_insert_blocked ON document_versions;
CREATE POLICY document_versions_insert_blocked ON document_versions FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS document_versions_update_blocked ON document_versions;
CREATE POLICY document_versions_update_blocked ON document_versions FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS document_versions_delete_blocked ON document_versions;
CREATE POLICY document_versions_delete_blocked ON document_versions FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS document_processing_attempts_select_company_or_admin ON document_processing_attempts;
CREATE POLICY document_processing_attempts_select_company_or_admin
ON document_processing_attempts FOR SELECT TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS document_processing_attempts_insert_blocked ON document_processing_attempts;
CREATE POLICY document_processing_attempts_insert_blocked ON document_processing_attempts FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS document_processing_attempts_update_blocked ON document_processing_attempts;
CREATE POLICY document_processing_attempts_update_blocked ON document_processing_attempts FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS document_processing_attempts_delete_blocked ON document_processing_attempts;
CREATE POLICY document_processing_attempts_delete_blocked ON document_processing_attempts FOR DELETE TO authenticated USING (false);

GRANT SELECT ON public.document_artifacts TO authenticated;
GRANT SELECT ON public.document_versions TO authenticated;
GRANT SELECT ON public.document_processing_attempts TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.document_artifacts FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.document_versions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.document_processing_attempts FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_artifacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_versions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_processing_attempts TO service_role;

CREATE OR REPLACE FUNCTION create_document_artifact(
  p_actor_id UUID,
  p_company_id UUID,
  p_id UUID,
  p_document_context TEXT,
  p_title TEXT,
  p_metadata JSONB,
  p_correlation_id TEXT,
  p_source_system TEXT,
  p_registered_at TIMESTAMPTZ
) RETURNS JSONB
SECURITY INVOKER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Actor is required.' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_actor_id) THEN
    RAISE EXCEPTION 'Actor % does not exist.', p_actor_id USING ERRCODE = '28000';
  END IF;

  IF p_company_id IS DISTINCT FROM get_company_id_for_actor(p_actor_id) AND NOT is_bba_admin_actor(p_actor_id) THEN
    RAISE EXCEPTION 'Actor % is not authorized to create a Document for this organization.', p_actor_id USING ERRCODE = '42501';
  END IF;

  INSERT INTO document_artifacts (
    id, company_id, document_context, title, metadata, correlation_id, registered_by, source_system, registered_at
  ) VALUES (
    p_id, p_company_id, p_document_context, p_title, COALESCE(p_metadata, '{}'::JSONB), p_correlation_id,
    p_actor_id, p_source_system, COALESCE(p_registered_at, NOW())
  );

  RETURN jsonb_build_object('id', p_id);
END;
$$;

REVOKE ALL ON FUNCTION create_document_artifact(UUID, UUID, UUID, TEXT, TEXT, JSONB, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_document_artifact(UUID, UUID, UUID, TEXT, TEXT, JSONB, TEXT, TEXT, TIMESTAMPTZ) FROM anon;
REVOKE ALL ON FUNCTION create_document_artifact(UUID, UUID, UUID, TEXT, TEXT, JSONB, TEXT, TEXT, TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION create_document_artifact(UUID, UUID, UUID, TEXT, TEXT, JSONB, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

CREATE OR REPLACE FUNCTION create_document_version(
  p_actor_id UUID,
  p_company_id UUID,
  p_id UUID,
  p_document_id UUID,
  p_sha256 TEXT,
  p_original_file_name TEXT,
  p_mime_type TEXT,
  p_size_bytes BIGINT,
  p_storage_reference TEXT,
  p_technical_metadata JSONB,
  p_metadata JSONB,
  p_correlation_id TEXT,
  p_source_system TEXT,
  p_uploaded_at TIMESTAMPTZ
) RETURNS JSONB
SECURITY INVOKER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_document_version document_versions%ROWTYPE;
  v_outcome TEXT;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Actor is required.' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_actor_id) THEN
    RAISE EXCEPTION 'Actor % does not exist.', p_actor_id USING ERRCODE = '28000';
  END IF;

  IF p_company_id IS DISTINCT FROM get_company_id_for_actor(p_actor_id) AND NOT is_bba_admin_actor(p_actor_id) THEN
    RAISE EXCEPTION 'Actor % is not authorized to create a Document Version for this organization.', p_actor_id USING ERRCODE = '42501';
  END IF;

  INSERT INTO document_versions (
    id, company_id, document_id, sha256, original_file_name, mime_type, size_bytes,
    storage_reference, technical_metadata, metadata, correlation_id, uploaded_by, source_system, uploaded_at
  ) VALUES (
    p_id, p_company_id, p_document_id, p_sha256, p_original_file_name, p_mime_type, p_size_bytes,
    p_storage_reference, COALESCE(p_technical_metadata, '{}'::JSONB), COALESCE(p_metadata, '{}'::JSONB),
    p_correlation_id, p_actor_id, p_source_system, COALESCE(p_uploaded_at, NOW())
  )
  ON CONFLICT (company_id, document_id, sha256) DO NOTHING
  RETURNING * INTO v_document_version;

  IF FOUND THEN
    v_outcome := 'created';
  ELSE
    SELECT * INTO v_document_version
    FROM document_versions
    WHERE company_id = p_company_id
      AND document_id = p_document_id
      AND sha256 = p_sha256;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Document Version idempotency conflict was not recoverable.' USING ERRCODE = '40001';
    END IF;

    v_outcome := 'reused';
  END IF;

  RETURN jsonb_build_object(
    'outcome', v_outcome,
    'document_version', to_jsonb(v_document_version)
  );
END;
$$;

REVOKE ALL ON FUNCTION create_document_version(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, BIGINT, TEXT, JSONB, JSONB, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_document_version(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, BIGINT, TEXT, JSONB, JSONB, TEXT, TEXT, TIMESTAMPTZ) FROM anon;
REVOKE ALL ON FUNCTION create_document_version(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, BIGINT, TEXT, JSONB, JSONB, TEXT, TEXT, TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION create_document_version(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, BIGINT, TEXT, JSONB, JSONB, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

CREATE OR REPLACE FUNCTION create_document_processing_attempt(
  p_actor_id UUID,
  p_company_id UUID,
  p_id UUID,
  p_document_version_id UUID,
  p_status TEXT,
  p_mechanism TEXT,
  p_mechanism_version TEXT,
  p_requested_at TIMESTAMPTZ,
  p_request_idempotency_key TEXT,
  p_metadata JSONB,
  p_correlation_id TEXT,
  p_source_system TEXT
) RETURNS JSONB
SECURITY INVOKER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_attempt document_processing_attempts%ROWTYPE;
  v_outcome TEXT;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Actor is required.' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_actor_id) THEN
    RAISE EXCEPTION 'Actor % does not exist.', p_actor_id USING ERRCODE = '28000';
  END IF;

  IF p_status <> 'Requested' THEN
    RAISE EXCEPTION 'Document Processing Attempt must be created as Requested.' USING ERRCODE = '23514';
  END IF;

  IF p_company_id IS DISTINCT FROM get_company_id_for_actor(p_actor_id) AND NOT is_bba_admin_actor(p_actor_id) THEN
    RAISE EXCEPTION 'Actor % is not authorized to request processing for this organization.', p_actor_id USING ERRCODE = '42501';
  END IF;

  INSERT INTO document_processing_attempts (
    id, company_id, document_version_id, status, mechanism, mechanism_version, requested_at,
    request_idempotency_key, metadata, correlation_id, requested_by, source_system
  ) VALUES (
    p_id, p_company_id, p_document_version_id, 'Requested', p_mechanism, p_mechanism_version,
    COALESCE(p_requested_at, NOW()), p_request_idempotency_key, COALESCE(p_metadata, '{}'::JSONB),
    p_correlation_id, p_actor_id, p_source_system
  )
  ON CONFLICT (company_id, document_version_id, request_idempotency_key) DO NOTHING
  RETURNING * INTO v_attempt;

  IF FOUND THEN
    v_outcome := 'created';
  ELSE
    SELECT * INTO v_attempt
    FROM document_processing_attempts
    WHERE company_id = p_company_id
      AND document_version_id = p_document_version_id
      AND request_idempotency_key = p_request_idempotency_key;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Document Processing Attempt idempotency conflict was not recoverable.' USING ERRCODE = '40001';
    END IF;

    v_outcome := 'reused';
  END IF;

  RETURN jsonb_build_object(
    'outcome', v_outcome,
    'document_processing_attempt', to_jsonb(v_attempt)
  );
END;
$$;

REVOKE ALL ON FUNCTION create_document_processing_attempt(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_document_processing_attempt(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION create_document_processing_attempt(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION create_document_processing_attempt(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION transition_document_processing_attempt(
  p_actor_id UUID,
  p_company_id UUID,
  p_attempt_id UUID,
  p_expected_revision INTEGER,
  p_status TEXT,
  p_started_at TIMESTAMPTZ,
  p_finished_at TIMESTAMPTZ,
  p_error JSONB,
  p_partial_processing BOOLEAN,
  p_metadata JSONB
) RETURNS JSONB
SECURITY INVOKER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_attempt document_processing_attempts%ROWTYPE;
  v_new_revision INTEGER;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Actor is required.' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_actor_id) THEN
    RAISE EXCEPTION 'Actor % does not exist.', p_actor_id USING ERRCODE = '28000';
  END IF;

  IF p_company_id IS DISTINCT FROM get_company_id_for_actor(p_actor_id) AND NOT is_bba_admin_actor(p_actor_id) THEN
    RAISE EXCEPTION 'Actor % is not authorized to transition a processing attempt for this organization.', p_actor_id USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_current_attempt
  FROM document_processing_attempts
  WHERE id = p_attempt_id
    AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('conflict', true);
  END IF;

  IF v_current_attempt.revision <> p_expected_revision THEN
    RETURN jsonb_build_object('conflict', true);
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('Requested', 'Processing', 'Completed', 'PartiallyCompleted', 'Failed', 'Abandoned') THEN
    RAISE EXCEPTION 'Unknown Document Processing Attempt status: %.', p_status USING ERRCODE = '23514';
  END IF;

  IF NOT (
    (v_current_attempt.status = 'Requested' AND p_status IN ('Processing', 'Abandoned'))
    OR (v_current_attempt.status = 'Processing' AND p_status IN ('Completed', 'PartiallyCompleted', 'Failed', 'Abandoned'))
  ) THEN
    RAISE EXCEPTION 'Invalid Document Processing Attempt transition: % -> %.', v_current_attempt.status, p_status
      USING ERRCODE = '23514';
  END IF;

  UPDATE document_processing_attempts
  SET
    status = p_status,
    started_at = p_started_at,
    finished_at = p_finished_at,
    error = p_error,
    partial_processing = COALESCE(p_partial_processing, FALSE),
    metadata = COALESCE(p_metadata, '{}'::JSONB),
    revision = revision + 1
  WHERE id = p_attempt_id
    AND company_id = p_company_id
    AND revision = p_expected_revision
  RETURNING revision INTO v_new_revision;

  IF v_new_revision IS NULL THEN
    RETURN jsonb_build_object('conflict', true);
  END IF;

  RETURN jsonb_build_object('conflict', false, 'revision', v_new_revision);
END;
$$;

REVOKE ALL ON FUNCTION transition_document_processing_attempt(UUID, UUID, UUID, INTEGER, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB, BOOLEAN, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION transition_document_processing_attempt(UUID, UUID, UUID, INTEGER, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB, BOOLEAN, JSONB) FROM anon;
REVOKE ALL ON FUNCTION transition_document_processing_attempt(UUID, UUID, UUID, INTEGER, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB, BOOLEAN, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION transition_document_processing_attempt(UUID, UUID, UUID, INTEGER, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB, BOOLEAN, JSONB) TO service_role;

COMMENT ON TABLE document_artifacts IS
  'Epic 21.4A.1 - logical Document identity. Does not store file hash, storage path, processing status, extracted evidence, or economic interpretation.';
COMMENT ON TABLE document_versions IS
  'Epic 21.4A.1 - immutable concrete Document Version. Idempotency key is (company_id, document_id, sha256), not a global document identity.';
COMMENT ON TABLE document_processing_attempts IS
  'Epic 21.4A.1 - one processing execution over a Document Version. Reprocessing creates a new attempt with a new request idempotency key; previous attempts are preserved.';
COMMENT ON COLUMN document_versions.storage_reference IS
  'Server-produced opaque storage reference. Must begin with company_id/ and must not be a local filesystem path.';
COMMENT ON COLUMN document_processing_attempts.revision IS
  'Optimistic concurrency control for processing attempt state transitions.';
