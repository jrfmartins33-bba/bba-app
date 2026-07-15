import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import {
  completeDocumentProcessingAttemptService,
  failDocumentProcessingAttemptService,
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
const clientBId = requireEnv("RLS_TEST_CLIENT_B_ID");
const companyAId = requireEnv("RLS_TEST_COMPANY_A_ID");
const companyBId = requireEnv("RLS_TEST_COMPANY_B_ID");

const SHA_A = "5031da751eff0bb9bd892c0bd9f71a786ac0d575ff52877aeced6c118ffb92c5";
const SHA_B = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_C = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

async function signIn(email, password) {
  const client = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Authentication failed for ${email}: ${error.message}`);
  return client;
}

function createServiceRoleClient() {
  return createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function confirmTestEnvironment(serviceClient) {
  const host = new URL(supabaseUrl).host;
  const productionUrls = [
    process.env.SUPABASE_PRODUCTION_URL,
    process.env.PRODUCTION_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PRODUCTION_URL,
  ].filter(Boolean);

  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing to run destructive document-processing tests while the process is marked as production.");
  }

  if (productionUrls.some((url) => new URL(url).host === host)) {
    throw new Error("Refusing to run: SUPABASE_TEST_URL matches a configured production Supabase URL.");
  }

  const { data: profiles, error: profilesError } = await serviceClient
    .from("profiles")
    .select("id, company_id, role")
    .in("id", [clientAId, clientBId]);

  if (profilesError) throw profilesError;

  const profileA = profiles?.find((profile) => profile.id === clientAId);
  const profileB = profiles?.find((profile) => profile.id === clientBId);

  assertTrue(profileA !== undefined, "RLS_TEST_CLIENT_A_ID must identify an existing test profile.");
  assertTrue(profileB !== undefined, "RLS_TEST_CLIENT_B_ID must identify an existing test profile.");
  assertEqual(profileA.company_id, companyAId, "RLS_TEST_CLIENT_A_ID must belong to RLS_TEST_COMPANY_A_ID.");
  assertEqual(profileB.company_id, companyBId, "RLS_TEST_CLIENT_B_ID must belong to RLS_TEST_COMPANY_B_ID.");

  const { count: companyCount, error: companyError } = await serviceClient
    .from("companies")
    .select("id", { count: "exact", head: true })
    .in("id", [companyAId, companyBId]);

  if (companyError) throw companyError;
  assertEqual(companyCount, 2, "RLS_TEST_COMPANY_A_ID and RLS_TEST_COMPANY_B_ID must identify existing test organizations.");

  console.log(`environment - using SUPABASE_TEST_URL host=${host}`);
  console.log(`environment - test profiles confirmed: A=${clientAId} / B=${clientBId}`);
  console.log(`environment - test organizations confirmed: A=${companyAId} / B=${companyBId}`);
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

function assertRuleViolation(error, label) {
  assertTrue(error !== null, `${label}: expected a rule violation error, got success`);
  assertEqual(error.code, "23514", `${label}: expected rule violation (23514), got ${JSON.stringify(error)}`);
}

async function countRows(serviceClient, table, filters) {
  let query = serviceClient.from(table).select("id", { count: "exact", head: true });

  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

function transitionParams(overrides) {
  return {
    p_actor_id: clientAId,
    p_company_id: companyAId,
    p_attempt_id: overrides.attemptId,
    p_expected_revision: overrides.expectedRevision,
    p_status: overrides.status,
    p_started_at: overrides.startedAt ?? null,
    p_finished_at: overrides.finishedAt ?? null,
    p_error: overrides.error ?? null,
    p_partial_processing: overrides.partialProcessing ?? false,
    p_metadata: overrides.metadata ?? {},
  };
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
  const serviceRoleClient = createServiceRoleClient();
  await confirmTestEnvironment(serviceRoleClient);

  const authenticatedClient = await signIn(clientAEmail, clientAPassword);
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

    await runTest("concurrent Document Version idempotency persists one row and returns the persisted identity", async () => {
      const [first, second] = await Promise.all([
        registerOrReuseDocumentVersionService(
          context,
          versionCommand(documentId, SHA_C),
          documentRepository,
          documentVersionRepository,
        ),
        registerOrReuseDocumentVersionService(
          context,
          versionCommand(documentId, SHA_C),
          documentRepository,
          documentVersionRepository,
        ),
      ]);

      assertTrue(first.outcome === "created" || first.outcome === "reused", `first outcome must be created/reused, got ${first.outcome}`);
      assertTrue(second.outcome === "created" || second.outcome === "reused", `second outcome must be created/reused, got ${second.outcome}`);
      if ((first.outcome !== "created" && first.outcome !== "reused") || (second.outcome !== "created" && second.outcome !== "reused")) return;

      assertEqual(first.documentVersion.id, second.documentVersion.id);
      assertEqual([first.outcome, second.outcome].filter((outcome) => outcome === "created").length, 1);
      assertEqual([first.outcome, second.outcome].filter((outcome) => outcome === "reused").length, 1);
      assertEqual(
        await countRows(serviceRoleClient, "document_versions", { company_id: companyAId, document_id: documentId, sha256: SHA_C }),
        1,
      );
      tracked.documentVersionIds.push(first.documentVersion.id);
    });

    await runTest("concurrent Processing Attempt idempotency persists one row and returns the persisted revision", async () => {
      const requestIdempotencyKey = `request-concurrent-${marker}`;
      const [first, second] = await Promise.all([
        requestDocumentProcessingAttemptService(
          context,
          { documentVersionId: versionId, mechanism: "minimal-v1", requestIdempotencyKey },
          documentVersionRepository,
          attemptRepository,
        ),
        requestDocumentProcessingAttemptService(
          context,
          { documentVersionId: versionId, mechanism: "minimal-v1", requestIdempotencyKey },
          documentVersionRepository,
          attemptRepository,
        ),
      ]);

      assertTrue(first.outcome === "created" || first.outcome === "reused", `first outcome must be created/reused, got ${first.outcome}`);
      assertTrue(second.outcome === "created" || second.outcome === "reused", `second outcome must be created/reused, got ${second.outcome}`);
      if ((first.outcome !== "created" && first.outcome !== "reused") || (second.outcome !== "created" && second.outcome !== "reused")) return;

      assertEqual(first.attempt.id, second.attempt.id);
      assertEqual(first.revision, second.revision);
      assertEqual(first.revision, 0);
      assertEqual([first.outcome, second.outcome].filter((outcome) => outcome === "created").length, 1);
      assertEqual([first.outcome, second.outcome].filter((outcome) => outcome === "reused").length, 1);
      assertEqual(
        await countRows(serviceRoleClient, "document_processing_attempts", {
          company_id: companyAId,
          document_version_id: versionId,
          request_idempotency_key: requestIdempotencyKey,
        }),
        1,
      );
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

    await runTest("persistent transition frontier accepts valid transitions and rejects invalid transitions", async () => {
      const validAttempt = await requestDocumentProcessingAttemptService(
        context,
        { documentVersionId: versionId, mechanism: "minimal-v1", requestIdempotencyKey: `valid-direct-${marker}` },
        documentVersionRepository,
        attemptRepository,
      );
      assertEqual(validAttempt.outcome, "created");
      if (validAttempt.outcome !== "created") return;

      const startedAt = new Date().toISOString();
      const { data: validStartData, error: validStartError } = await serviceRoleClient.rpc(
        "transition_document_processing_attempt",
        transitionParams({
          attemptId: validAttempt.attempt.id,
          expectedRevision: validAttempt.revision,
          status: "Processing",
          startedAt,
        }),
      );
      assertEqual(validStartError, null, validStartError?.message);
      assertEqual(validStartData.conflict, false);
      assertEqual(validStartData.revision, 1);

      const { data: validFailData, error: validFailError } = await serviceRoleClient.rpc(
        "transition_document_processing_attempt",
        transitionParams({
          attemptId: validAttempt.attempt.id,
          expectedRevision: 1,
          status: "Failed",
          startedAt,
          finishedAt: new Date().toISOString(),
          error: { code: "direct_failed", message: "Direct transition failed as expected." },
        }),
      );
      assertEqual(validFailError, null, validFailError?.message);
      assertEqual(validFailData.conflict, false);
      assertEqual(validFailData.revision, 2);

      const requestedToCompleted = await requestDocumentProcessingAttemptService(
        context,
        { documentVersionId: versionId, mechanism: "minimal-v1", requestIdempotencyKey: `invalid-requested-completed-${marker}` },
        documentVersionRepository,
        attemptRepository,
      );
      assertEqual(requestedToCompleted.outcome, "created");
      if (requestedToCompleted.outcome !== "created") return;
      const { error: requestedToCompletedError } = await serviceRoleClient.rpc(
        "transition_document_processing_attempt",
        transitionParams({
          attemptId: requestedToCompleted.attempt.id,
          expectedRevision: requestedToCompleted.revision,
          status: "Completed",
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        }),
      );
      assertRuleViolation(requestedToCompletedError, "Requested -> Completed");

      const completedToProcessing = await requestDocumentProcessingAttemptService(
        context,
        { documentVersionId: versionId, mechanism: "minimal-v1", requestIdempotencyKey: `invalid-completed-processing-${marker}` },
        documentVersionRepository,
        attemptRepository,
      );
      assertEqual(completedToProcessing.outcome, "created");
      if (completedToProcessing.outcome !== "created") return;
      const completedStarted = await startDocumentProcessingAttemptService(context, { attemptId: completedToProcessing.attempt.id }, attemptRepository);
      assertEqual(completedStarted.outcome, "success");
      if (completedStarted.outcome !== "success") return;
      const completed = await completeDocumentProcessingAttemptService(context, { attemptId: completedToProcessing.attempt.id }, attemptRepository);
      assertEqual(completed.outcome, "success");
      if (completed.outcome !== "success") return;
      const { error: completedToProcessingError } = await serviceRoleClient.rpc(
        "transition_document_processing_attempt",
        transitionParams({
          attemptId: completed.attempt.id,
          expectedRevision: completed.revision,
          status: "Processing",
          startedAt: completed.attempt.startedAt,
        }),
      );
      assertRuleViolation(completedToProcessingError, "Completed -> Processing");

      const failedToCompleted = await requestDocumentProcessingAttemptService(
        context,
        { documentVersionId: versionId, mechanism: "minimal-v1", requestIdempotencyKey: `invalid-failed-completed-${marker}` },
        documentVersionRepository,
        attemptRepository,
      );
      assertEqual(failedToCompleted.outcome, "created");
      if (failedToCompleted.outcome !== "created") return;
      const failedStarted = await startDocumentProcessingAttemptService(context, { attemptId: failedToCompleted.attempt.id }, attemptRepository);
      assertEqual(failedStarted.outcome, "success");
      if (failedStarted.outcome !== "success") return;
      const failed = await failDocumentProcessingAttemptService(
        context,
        { attemptId: failedToCompleted.attempt.id, error: { code: "read_failed", message: "Read failed." } },
        attemptRepository,
      );
      assertEqual(failed.outcome, "success");
      if (failed.outcome !== "success") return;
      const { error: failedToCompletedError } = await serviceRoleClient.rpc(
        "transition_document_processing_attempt",
        transitionParams({
          attemptId: failed.attempt.id,
          expectedRevision: failed.revision,
          status: "Completed",
          startedAt: failed.attempt.startedAt,
          finishedAt: new Date().toISOString(),
        }),
      );
      assertRuleViolation(failedToCompletedError, "Failed -> Completed");

      const unknownStatus = await requestDocumentProcessingAttemptService(
        context,
        { documentVersionId: versionId, mechanism: "minimal-v1", requestIdempotencyKey: `invalid-unknown-${marker}` },
        documentVersionRepository,
        attemptRepository,
      );
      assertEqual(unknownStatus.outcome, "created");
      if (unknownStatus.outcome !== "created") return;
      const { error: unknownStatusError } = await serviceRoleClient.rpc(
        "transition_document_processing_attempt",
        transitionParams({
          attemptId: unknownStatus.attempt.id,
          expectedRevision: unknownStatus.revision,
          status: "UnknownStatus",
        }),
      );
      assertRuleViolation(unknownStatusError, "unknown status");

      const foreignAttempt = await requestDocumentProcessingAttemptService(
        context,
        { documentVersionId: versionId, mechanism: "minimal-v1", requestIdempotencyKey: `foreign-${marker}` },
        documentVersionRepository,
        attemptRepository,
      );
      assertEqual(foreignAttempt.outcome, "created");
      if (foreignAttempt.outcome !== "created") return;
      const { data: foreignData, error: foreignError } = await serviceRoleClient.rpc("transition_document_processing_attempt", {
        ...transitionParams({
          attemptId: foreignAttempt.attempt.id,
          expectedRevision: foreignAttempt.revision,
          status: "Processing",
          startedAt: new Date().toISOString(),
        }),
        p_actor_id: clientBId,
        p_company_id: companyBId,
      });
      assertEqual(foreignError, null, foreignError?.message);
      assertEqual(foreignData.conflict, true, "foreign organization attempt must not be exposed or updated");
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
    console.log(`cleanup - ok documents=${tracked.documentIds.length} documentVersions=${tracked.documentVersionIds.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
