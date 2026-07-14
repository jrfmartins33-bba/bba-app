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
} from "../../../apps/web/lib/bdos/procurement-engineering-repository.ts";

// Sprint 21.3C — testes obrigatórios de isolamento entre organizações
// usuárias (seção 20 da instrução). Reaproveita os dois usuários/empresas
// de teste já existentes na suíte de RLS (cliente A/empresa A, cliente
// B/empresa B) — nenhum usuário administrativo é sujeito de teste aqui.
// Roda fora do glob `*.test.ts` pelo mesmo motivo de
// procurement-engineering-integration.test.mjs.

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const clientAEmail = process.env.RLS_TEST_CLIENT_A_EMAIL || "carlos@carlosmendes.com.br";
const clientAPassword = process.env.RLS_TEST_CLIENT_A_PASSWORD || "Teste123!";
const clientBEmail = process.env.RLS_TEST_CLIENT_B_EMAIL || "vitoria@vitoriamodas.com.br";
const clientBPassword = process.env.RLS_TEST_CLIENT_B_PASSWORD || "Teste123!";

const companyAId = process.env.RLS_TEST_COMPANY_A_ID || "eeeeeeee-0000-0000-0000-000000000001";
const companyBId = process.env.RLS_TEST_COMPANY_B_ID || "eeeeeeee-0000-0000-0000-000000000002";
const clientAId = process.env.RLS_TEST_CLIENT_A_ID || "d9e849b1-cd4a-4855-888c-857d8a7a6050";
const clientBId = process.env.RLS_TEST_CLIENT_B_ID || "9ff84319-08bf-4a67-975e-4a229effdf4d";

function createSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Set SUPABASE_URL and SUPABASE_ANON_KEY before running this test.");
  }
  return createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signIn(email, password) {
  const client = createSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Authentication failed for ${email}: ${error.message}`);
  if (!data.session) throw new Error(`No session returned for ${email}`);
  return client;
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

async function seedOrganizationData(client, organizationId, actorId, marker) {
  const procurementCaseRepository = createProcurementCaseRepository(client);
  const budgetVersionRepository = createBudgetVersionRepository(client);
  const repositories = { procurementCaseRepository, budgetVersionRepository };
  const context = { organizationId, actor: actorId, sourceSystem: "sprint-21-3c-isolation-test" };

  const createdCase = await createProcurementCaseService(context, { title: `[Sprint 21.3C][isolation] Processo ${marker}` }, procurementCaseRepository);
  if (createdCase.outcome !== "created") throw new Error(`seed: failed to create case (${JSON.stringify(createdCase)})`);

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
  const clientA = await signIn(clientAEmail, clientAPassword);
  const clientB = await signIn(clientBEmail, clientBPassword);

  let dataA;
  let dataB;

  await runTest("usuário A cria e lê dados da organização A; usuário B cria e lê dados da organização B", async () => {
    dataA = await seedOrganizationData(clientA, companyAId, clientAId, `A-${marker}`);
    dataB = await seedOrganizationData(clientB, companyBId, clientBId, `B-${marker}`);

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

    // Camada de aplicação/repositório (com filtro explícito por organização).
    const caseViaRepo = await repositoryA.findProcurementCaseById(companyAId, dataB.procurementCase.id);
    assertEqual(caseViaRepo, null, "repository-level org filter must hide the other organization's Processo");

    const lotViaRepo = await repositoryA.findProcurementLotById(companyAId, dataB.procurementCase.id, dataB.procurementLot.id);
    assertEqual(lotViaRepo, null, "repository-level org filter must hide the other organization's Lote");

    const versionViaRepo = await budgetVersionRepositoryA.loadBudgetVersion(companyAId, dataB.budgetVersionId);
    assertEqual(versionViaRepo, null, "repository-level org filter must hide the other organization's Versão");

    // RLS pura — consulta física sem qualquer filtro de organização, para
    // confirmar que a política continua eficaz mesmo se o filtro físico
    // for omitido por acidente (seção 20, último item da instrução).
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

  await runTest("usuário A não insere Processo com company_id da organização B", async () => {
    const { error } = await clientA
      .from("procurement_cases")
      .insert({ id: crypto.randomUUID(), company_id: companyBId, title: "Tentativa de inserção cruzando organizações", external_reference: null, metadata: {} });

    assertTrue(error !== null, "inserting a row with another organization's company_id must be rejected by RLS WITH CHECK");
  });

  await runTest("usuário A não atualiza Versão da organização B", async () => {
    const { data, error } = await clientA
      .from("budget_versions")
      .update({ status: "Consolidated" })
      .eq("id", dataB.budgetVersionId)
      .select("id");

    assertEqual(error, null, error?.message);
    assertEqual(data?.length ?? 0, 0, "client A must not be able to update client B's Versão — RLS must filter it out of the UPDATE, affecting zero rows");
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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
