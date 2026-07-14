import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import {
  addBudgetLineService,
  BudgetLineKind,
  BudgetVersionOriginKind,
  createBudgetVersionDraftService,
  createProcurementCaseService,
  registerLineageRelationService,
  registerProcurementLotService,
} from "../../../packages/bdos-core/src/services/procurement-engineering/index.ts";
import {
  createBudgetVersionRepository,
  createProcurementCaseRepository,
} from "../../../apps/web/lib/bdos/procurement-engineering-server-repository.ts";

// Sprint 21.3C — testes obrigatórios de isolamento entre organizações
// usuárias (seção 20 da instrução original / seção 13 da correção de
// fechamento da fronteira de confiança). Exige um ambiente explicitamente
// autorizado — ver README.md nesta pasta ("Ambiente: compartilhado
// controlado, não dedicado"; o estado atual é compartilhado controlado, um
// projeto separado continua sendo a opção preferencial). Nunca cai de
// volta em apps/web/.env.local, em credenciais-padrão, ou em qualquer
// valor literal versionado.
//
// Desde a correção de fechamento da fronteira de confiança, as 4 funções
// de mutação só são executáveis por `service_role`
// (20260714000004_..._server_only_functions.sql) — logo toda a preparação
// (seed) de dados de organização usuária usa `serviceRoleClient` (nunca o
// cliente autenticado por senha), exatamente como
// procurement-engineering-write-boundary.test.mjs e
// procurement-engineering-integration.test.mjs. Os clientes autenticados
// `clientA`/`clientB` continuam sendo os únicos usados para provar leitura
// isolada por RLS e para as tentativas negativas de escrita — nunca
// service_role, que jamais pode ser sujeito de um teste de isolamento.

if (process.env.BDOS_ALLOW_DESTRUCTIVE_INTEGRATION_TESTS !== "true") {
  throw new Error(
    "Refusing to run: set BDOS_ALLOW_DESTRUCTIVE_INTEGRATION_TESTS=true to confirm explicit authorization to run these destructive tests, aware that they write and clean up real data against the shared controlled environment described in supabase/tests/procurement-engineering/README.md. This variable proves authorization and awareness, never physical isolation from the app's normal environment — it does not, by itself, guarantee a dedicated project.",
  );
}

function requireEnv(name) {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable ${name}. These tests require an explicitly authorized environment (see supabase/tests/procurement-engineering/README.md) — the current approved state is a shared controlled environment, not a dedicated one; a separate project remains the preferred option. This never falls back to a default or to apps/web/.env.local.`,
    );
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

const clientBEmail = requireEnv("RLS_TEST_CLIENT_B_EMAIL");
const clientBPassword = requireEnv("RLS_TEST_CLIENT_B_PASSWORD");
const clientBId = requireEnv("RLS_TEST_CLIENT_B_ID");
const companyBId = requireEnv("RLS_TEST_COMPANY_B_ID");

async function signIn(email, password) {
  const client = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Authentication failed for ${email}: ${error.message}`);
  return client;
}

function createServiceRoleClient() {
  // Somente para preparação (seed) e limpeza de dados de teste — nunca
  // sujeito dos testes de isolamento abaixo (seção 9 da correção anterior,
  // reafirmada na correção de fechamento: "nunca utilize a credencial
  // privilegiada como sujeito de um teste de isolamento").
  return createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function cleanupCreatedData(serviceClient, tracked) {
  const errors = [];

  async function del(table, column, value) {
    const { error } = await serviceClient.from(table).delete().eq(column, value);
    if (error) errors.push(`${table} (${column}=${value}): ${error.message}`);
  }

  for (const versionId of tracked.budgetVersionIds) {
    await del("budget_version_lineage_relations", "budget_version_id", versionId);
    await del("budget_lines", "budget_version_id", versionId);
    await del("budget_versions", "id", versionId);
  }
  for (const caseId of tracked.procurementCaseIds) {
    await del("procurement_lots", "procurement_case_id", caseId);
    await del("procurement_cases", "id", caseId);
  }

  if (errors.length > 0) {
    throw new Error(`Cleanup failed for ${errors.length} deletion(s):\n${errors.join("\n")}`);
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
    throw new Error(`${message ?? "valores diferentes"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value, message) {
  if (!value) throw new Error(message ?? "esperava true, recebeu false");
}

function assertPermissionDenied(error, label) {
  assertTrue(error !== null, `${label}: expected an error, got success`);
  assertEqual(error.code, "42501", `${label}: expected a permission-denied error (42501), got ${JSON.stringify(error)}`);
}

async function seedOrganizationData(serviceRoleClient, organizationId, actorId, marker, tracked) {
  const procurementCaseRepository = createProcurementCaseRepository(serviceRoleClient);
  const budgetVersionRepository = createBudgetVersionRepository(serviceRoleClient);
  const repositories = { procurementCaseRepository, budgetVersionRepository };
  const context = { organizationId, actor: actorId, sourceSystem: "sprint-21-3c-isolation-test" };

  const createdCase = await createProcurementCaseService(context, { title: `[Sprint 21.3C][isolation] Processo ${marker}` }, procurementCaseRepository);
  if (createdCase.outcome !== "created") throw new Error(`seed: failed to create case (${JSON.stringify(createdCase)})`);
  tracked.procurementCaseIds.push(createdCase.procurementCase.id);

  const createdLot = await registerProcurementLotService(
    context,
    { procurementCaseId: createdCase.procurementCase.id, title: `[Sprint 21.3C][isolation] Lote ${marker}` },
    procurementCaseRepository,
  );
  if (createdLot.outcome !== "created") throw new Error(`seed: failed to create lot (${JSON.stringify(createdLot)})`);

  const draft = await createBudgetVersionDraftService(
    context,
    { procurementCaseId: createdCase.procurementCase.id, scope: { kind: "WholeCase" }, origin: { kind: BudgetVersionOriginKind.Native } },
    repositories,
  );
  if (draft.outcome !== "success") throw new Error(`seed: failed to create draft (${JSON.stringify(draft)})`);
  tracked.budgetVersionIds.push(draft.budgetVersion.id);

  const withLine = await addBudgetLineService(
    context,
    { budgetVersionId: draft.budgetVersion.id, kind: BudgetLineKind.Group, description: { status: "Confirmed", text: `Grupo ${marker}` }, position: 0, scope: { kind: "WholeCase" } },
    repositories,
  );
  if (withLine.outcome !== "success") throw new Error(`seed: failed to add line (${JSON.stringify(withLine)})`);

  const lineage = await registerLineageRelationService(context, { budgetVersionId: draft.budgetVersion.id }, repositories);
  if (lineage.outcome !== "success") throw new Error(`seed: failed to register lineage (${JSON.stringify(lineage)})`);

  return {
    procurementCase: createdCase.procurementCase,
    procurementLot: createdLot.procurementLot,
    budgetVersionId: draft.budgetVersion.id,
    lineId: withLine.budgetVersion.lines[0].id,
    lineageId: lineage.budgetVersion.originLineage.id,
  };
}

async function main() {
  const marker = runId();
  const tracked = { procurementCaseIds: [], budgetVersionIds: [] };
  const clientA = await signIn(clientAEmail, clientAPassword);
  const clientB = await signIn(clientBEmail, clientBPassword);
  const serviceRoleClient = createServiceRoleClient();

  let dataA;
  let dataB;

  try {
    await runTest("usuário A cria (via caminho confiável) e lê dados da organização A; usuário B cria e lê dados da organização B", async () => {
      dataA = await seedOrganizationData(serviceRoleClient, companyAId, clientAId, `A-${marker}`, tracked);
      dataB = await seedOrganizationData(serviceRoleClient, companyBId, clientBId, `B-${marker}`, tracked);

      const repositoryA = createProcurementCaseRepository(clientA);
      const foundOwnCase = await repositoryA.findProcurementCaseById(companyAId, dataA.procurementCase.id);
      assertTrue(foundOwnCase !== null, "client A must read its own Processo");

      const repositoryB = createProcurementCaseRepository(clientB);
      const foundOwnCaseB = await repositoryB.findProcurementCaseById(companyBId, dataB.procurementCase.id);
      assertTrue(foundOwnCaseB !== null, "client B must read its own Processo");
    });

    await runTest("usuário A não lê Processo/Lote/Versão/Linha/Relação da organização B (mesmo que a consulta omita o filtro de organização)", async () => {
      const repositoryA = createProcurementCaseRepository(clientA);
      const budgetVersionRepositoryA = createBudgetVersionRepository(clientA);

      const caseViaRepo = await repositoryA.findProcurementCaseById(companyAId, dataB.procurementCase.id);
      assertEqual(caseViaRepo, null, "repository-level org filter must hide the other organization's Processo");

      const lotViaRepo = await repositoryA.findProcurementLotById(companyAId, dataB.procurementCase.id, dataB.procurementLot.id);
      assertEqual(lotViaRepo, null, "repository-level org filter must hide the other organization's Lote");

      const versionViaRepo = await budgetVersionRepositoryA.loadBudgetVersion(companyAId, dataB.budgetVersionId);
      assertEqual(versionViaRepo, null, "repository-level org filter must hide the other organization's Versão");

      const { data: rawCases, error: rawCasesError } = await clientA.from("procurement_cases").select("id").eq("id", dataB.procurementCase.id);
      assertEqual(rawCasesError, null, rawCasesError?.message);
      assertEqual(rawCases.length, 0, "RLS alone (no company_id filter in the query) must hide the other organization's Processo row");

      const { data: rawLots, error: rawLotsError } = await clientA.from("procurement_lots").select("id").eq("id", dataB.procurementLot.id);
      assertEqual(rawLotsError, null, rawLotsError?.message);
      assertEqual(rawLots.length, 0, "RLS alone must hide the other organization's Lote row");

      const { data: rawVersions, error: rawVersionsError } = await clientA.from("budget_versions").select("id").eq("id", dataB.budgetVersionId);
      assertEqual(rawVersionsError, null, rawVersionsError?.message);
      assertEqual(rawVersions.length, 0, "RLS alone must hide the other organization's Versão row");

      const { data: rawLines, error: rawLinesError } = await clientA.from("budget_lines").select("id").eq("id", dataB.lineId);
      assertEqual(rawLinesError, null, rawLinesError?.message);
      assertEqual(rawLines.length, 0, "RLS alone must hide the other organization's Linha row");

      const { data: rawLineage, error: rawLineageError } = await clientA
        .from("budget_version_lineage_relations")
        .select("id")
        .eq("id", dataB.lineageId);
      assertEqual(rawLineageError, null, rawLineageError?.message);
      assertEqual(rawLineage.length, 0, "RLS alone must hide the other organization's Relação de Rastreabilidade row");
    });

    await runTest("usuário A não insere Processo com company_id da organização B (nem diretamente na tabela, nem via função de mutação — que agora nega EXECUTE a authenticated)", async () => {
      const { error: directError } = await clientA
        .from("procurement_cases")
        .insert({ id: crypto.randomUUID(), company_id: companyBId, title: "Tentativa de inserção direta cruzando organizações", external_reference: null, metadata: {} });
      assertTrue(directError !== null, "direct insert with another organization's company_id must be rejected (no INSERT grant left for authenticated)");

      const { error: rpcError } = await clientA.rpc("create_procurement_case", {
        p_actor_id: clientAId,
        p_company_id: companyBId,
        p_id: crypto.randomUUID(),
        p_title: "Tentativa via função de mutação cruzando organizações",
        p_external_reference: null,
        p_metadata: {},
        p_correlation_id: null,
        p_source_system: null,
      });
      assertPermissionDenied(rpcError, "create_procurement_case via authenticated (payload de organização alheia)");
    });

    await runTest("usuário A não atualiza Versão da organização B (nem diretamente na tabela, nem via função de mutação — que agora nega EXECUTE a authenticated)", async () => {
      const { data, error } = await clientA
        .from("budget_versions")
        .update({ status: "Consolidated" })
        .eq("id", dataB.budgetVersionId)
        .select("id");
      assertTrue(error !== null, "client A must not be able to update client B's Versão directly — no UPDATE grant left for authenticated");
      assertEqual(data ?? null, null);

      // Desde a correção de fechamento da fronteira de confiança, `authenticated`
      // não tem mais nenhum EXECUTE sobre `persist_budget_version_snapshot` — a
      // chamada falha por permissão antes mesmo de a função avaliar de quem é a
      // Versão, então nunca mais retorna `{ conflict: true }` para este cliente.
      const { data: rpcData, error: rpcError } = await clientA.rpc("persist_budget_version_snapshot", {
        p_actor_id: clientAId,
        p_company_id: companyAId,
        p_budget_version_id: dataB.budgetVersionId,
        p_expected_revision: 0,
        p_status: "Consolidated",
        p_lines: [],
        p_lineage_id: null,
        p_lineage_origin_kind: null,
        p_lineage_origin_reference: null,
      });
      assertPermissionDenied(rpcError, "persist_budget_version_snapshot via authenticated (Versão de organização alheia)");
      assertEqual(rpcData ?? null, null, "no data should ever be returned when EXECUTE itself is denied");
    });

    await runTest("usuário A não relaciona Processo A com Lote da organização B", async () => {
      const budgetVersionRepositoryA = createBudgetVersionRepository(clientA);
      const procurementCaseRepositoryA = createProcurementCaseRepository(clientA);
      const context = { organizationId: companyAId, actor: clientAId };

      const result = await createBudgetVersionDraftService(
        context,
        { procurementCaseId: dataA.procurementCase.id, scope: { kind: "Lot", procurementLotId: dataB.procurementLot.id }, origin: { kind: BudgetVersionOriginKind.Native } },
        { procurementCaseRepository: procurementCaseRepositoryA, budgetVersionRepository: budgetVersionRepositoryA },
      );

      assertEqual(result.outcome, "procurement_lot_not_found", "a Lot belonging to another organização usuária must never prove a scope, even when the Processo itself belongs to the caller");
    });
  } finally {
    await cleanupCreatedData(serviceRoleClient, tracked);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
