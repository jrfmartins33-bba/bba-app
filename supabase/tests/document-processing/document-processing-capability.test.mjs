import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import {
  completeDocumentProcessingAttemptService,
  registerDocumentService,
  registerOrReuseDocumentVersionService,
  requestDocumentProcessingAttemptService,
  startDocumentProcessingAttemptService,
} from "../../../packages/bdos-core/src/services/document-processing/index.ts";
import {
  createDocumentProcessingAttemptRepository,
  createDocumentRepository,
  createDocumentVersionRepository,
} from "../../../apps/web/lib/bdos/document-processing-server-repository.ts";

if (process.env.BDOS_ALLOW_DESTRUCTIVE_INTEGRATION_TESTS !== "true") {
  throw new Error(
    "Refusing to run: set BDOS_ALLOW_DESTRUCTIVE_INTEGRATION_TESTS=true to confirm explicit authorization to run document-processing integration tests against the configured Supabase environment.",
  );
}

function requireEnv(name) {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
}

const supabaseUrl = requireEnv("SUPABASE_TEST_URL");
const supabaseAnonKey = requireEnv("SUPABASE_TEST_ANON_KEY");
const supabaseServiceRoleKey = requireEnv("SUPABASE_TEST_SERVICE_ROLE_KEY");
const clientAEmail = requireEnv("RLS_TEST_CLIENT_A_EMAIL");
const clientAPassword = requireEnv("RLS_TEST_CLIENT_A_PASSWORD");
const clientAId = requireEnv("RLS_TEST_CLIENT_A_ID");
const companyAId = requireEnv("RLS_TEST_COMPANY_A_ID");
const companyBId = requireEnv("RLS_TEST_COMPANY_B_ID");

const SHA_A = "5031da751eff0bb9bd892c0bd9f71a786ac0d575ff52877aeced6c118ffb92c5";
const SHA_B = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

async function signIn(email, password) {
  const client = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Authentication failed for ${email}: ${error.message}`);
  return client;
}

function createServiceRoleClient() {
  return createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function cleanupCreatedData(serviceClient, tracked) {
  const errors = [];

  async function del(table, column, value) {
    const { error } = await serviceClient.from(table).delete().eq(column, value);
    if (error) errors.push(`${table} (${column}=${value}): ${error.message}`);
  }

  for (const versionId of tracked.documentVersionIds) {
    await del("document_processing_attempts", "document_version_id", versionId);
    await del("document_versions", "id", versionId);
  }

  for (const documentId of tracked.documentIds) {
    await del("document_artifacts", "id", documentId);
  }

  if (errors.length > 0) {
    throw new Error(`Cleanup failed:\n${errors.join("\n")}`);
  }
}

function runId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function runTest(name, testCase) {
  await testCase();
  console.log(`ok - ${name}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value, message) {
  if (!value) {
    throw new Error(message ?? "expected true");
  }
}

function assertPermissionDenied(error, label) {
  assertTrue(error !== null, `${label}: expected an error, got success`);
  assertEqual(error.code, "42501", `${label}: expected permission denied (42501), got ${JSON.stringify(error)}`);
}

function versionCommand(documentId, sha256) {
  return {
    documentId,
    sha256,
    originalFileName: "05_Anexo_Tecnico_Termo_Referencia.pdf",
    mimeType: "application/pdf",
    sizeBytes: 154_280_000,
    storageReference: `${companyAId}/epic-21/document-processing/${sha256}/05_Anexo_Tecnico_Termo_Referencia.pdf`,
    technicalMetadata: { declaredPages: 1033, declaredHybridPdf: true },
  };
}

async function main() {
  const marker = runId();
  const tracked = { documentIds: [], documentVersionIds: [] };
  const authenticatedClient = await signIn(clientAEmail, clientAPassword);
  const serviceRoleClient = createServiceRoleClient();
  const documentRepository = createDocumentRepository(serviceRoleClient);
  const documentVersionRepository = createDocumentVersionRepository(serviceRoleClient);
  const attemptRepository = createDocumentProcessingAttemptRepository(serviceRoleClient);
  const context = { organizationId: companyAId, actor: clientAId, sourceSystem: "sprint-21-4a1-document-processing-test" };

  try {
    let documentId;
    let versionId;
    let attemptId;

    await runTest("server-side trusted path creates Document, first Version and Processing Attempt", async () => {
      const document = await registerDocumentService(
        context,
        { context: "official-budget-source", title: `[Sprint 21.4A.1] Documento ${marker}` },
        documentRepository,
      );
      assertEqual(document.outcome, "created");
      if (document.outcome !== "created") return;
      documentId = document.document.id;
      tracked.documentIds.push(documentId);

      const version = await registerOrReuseDocumentVersionService(
        context,
        versionCommand(documentId, SHA_A),
        documentRepository,
        documentVersionRepository,
      );
      assertEqual(version.outcome, "created");
      if (version.outcome !== "created") return;
      versionId = version.documentVersion.id;
      tracked.documentVersionIds.push(versionId);

      const attempt = await requestDocumentProcessingAttemptService(
        context,
        { documentVersionId: versionId, mechanism: "minimal-v1", requestIdempotencyKey: `request-${marker}` },
        documentVersionRepository,
        attemptRepository,
      );
      assertEqual(attempt.outcome, "created");
      if (attempt.outcome !== "created") return;
      attemptId = attempt.attempt.id;
      assertEqual(attempt.revision, 0);
    });

    await runTest("version idempotency reuses same hash and creates a new version for a new hash", async () => {
      const repeated = await registerOrReuseDocumentVersionService(
        context,
        versionCommand(documentId, SHA_A),
        documentRepository,
        documentVersionRepository,
      );
      assertEqual(repeated.outcome, "reused");
      if (repeated.outcome !== "reused") return;
      assertEqual(repeated.documentVersion.id, versionId);

      const newHash = await registerOrReuseDocumentVersionService(
        context,
        versionCommand(documentId, SHA_B),
        documentRepository,
        documentVersionRepository,
      );
      assertEqual(newHash.outcome, "created");
      if (newHash.outcome === "created") tracked.documentVersionIds.push(newHash.documentVersion.id);
    });

    await runTest("processing transition uses optimistic concurrency and terminal result is preserved", async () => {
      const started = await startDocumentProcessingAttemptService(context, { attemptId }, attemptRepository);
      assertEqual(started.outcome, "success");
      if (started.outcome !== "success") return;

      const { data: staleData, error: staleError } = await serviceRoleClient.rpc("transition_document_processing_attempt", {
        p_actor_id: clientAId,
        p_company_id: companyAId,
        p_attempt_id: attemptId,
        p_expected_revision: 0,
        p_status: "Failed",
        p_started_at: started.attempt.startedAt,
        p_finished_at: new Date().toISOString(),
        p_error: { code: "stale", message: "Stale transition." },
        p_partial_processing: false,
        p_metadata: {},
      });
      assertEqual(staleError, null, staleError?.message);
      assertEqual(staleData.conflict, true, "stale revision must return conflict before overwrite");

      const completed = await completeDocumentProcessingAttemptService(context, { attemptId }, attemptRepository);
      assertEqual(completed.outcome, "success");
      if (completed.outcome !== "success") return;
      assertEqual(completed.attempt.status, "Completed");
    });

    await runTest("Document Version is immutable at persistence level", async () => {
      const { error } = await serviceRoleClient
        .from("document_versions")
        .update({ original_file_name: "changed.pdf" })
        .eq("id", versionId);

      assertTrue(error !== null, "updating a Document Version must be rejected by trigger");
    });

    await runTest("authenticated cannot write directly or call server-only mutation functions", async () => {
      const { error: directError } = await authenticatedClient.from("document_artifacts").insert({
        id: crypto.randomUUID(),
        company_id: companyAId,
        document_context: "direct-write",
        title: "blocked",
        registered_by: clientAId,
      });
      assertTrue(directError !== null, "authenticated direct INSERT into document_artifacts must be blocked");

      const { error: rpcError } = await authenticatedClient.rpc("create_document_artifact", {
        p_actor_id: clientAId,
        p_company_id: companyAId,
        p_id: crypto.randomUUID(),
        p_document_context: "direct-rpc",
        p_title: "blocked",
        p_metadata: {},
        p_correlation_id: null,
        p_source_system: null,
        p_registered_at: new Date().toISOString(),
      });
      assertPermissionDenied(rpcError, "create_document_artifact via authenticated");
    });

    await runTest("trusted path still rejects actor operating another organization", async () => {
      let foreignError = null;
      try {
        await documentRepository.createDocument(companyBId, clientAId, {
          id: crypto.randomUUID(),
          organizationId: companyBId,
          context: "foreign-org",
          title: "blocked",
          registeredBy: clientAId,
          registeredAt: new Date().toISOString(),
          metadata: {},
        });
      } catch (error) {
        foreignError = error;
      }

      assertTrue(foreignError !== null, "actor from organization A must not operate organization B via service_role path");
    });
  } finally {
    await cleanupCreatedData(serviceRoleClient, tracked);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
