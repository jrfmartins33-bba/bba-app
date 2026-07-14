import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { addBudgetLine } from "../../../packages/bdos-core/src/domain/budget-version/budget-version.ts";
import {
  addBudgetLineService,
  BudgetLineKind,
  BudgetVersionOriginKind,
  consolidateBudgetVersionService,
  createBudgetVersionDraftService,
  createProcurementCaseService,
  getBudgetVersionService,
  registerLineageRelationService,
  registerProcurementLotService,
  removeBudgetLineService,
  reorderBudgetLineService,
  updateBudgetLineService,
} from "../../../packages/bdos-core/src/services/procurement-engineering/index.ts";
import {
  createBudgetVersionRepository,
  createProcurementCaseRepository,
} from "../../../apps/web/lib/bdos/procurement-engineering-server-repository.ts";

// Sprint 21.3C — testes de integração com o banco real. Exige um ambiente
// de teste explicitamente dedicado — ver README.md nesta pasta. Roda via
// `npx tsx` (não `node --test`, para reusar o mesmo padrão runTest/
// assertEqual de todo o resto do repositório), fora do glob `*.test.ts` de
// propósito (mesma razão de supabase/tests/rls ser `.test.mjs`).

if (process.env.BDOS_ALLOW_DESTRUCTIVE_INTEGRATION_TESTS !== "true") {
  throw new Error(
    "Refusing to run: set BDOS_ALLOW_DESTRUCTIVE_INTEGRATION_TESTS=true to confirm this run targets a dedicated test environment, never the app's normal environment. See supabase/tests/procurement-engineering/README.md.",
  );
}

function requireEnv(name) {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable ${name}. This test requires an explicit, dedicated test environment (see supabase/tests/procurement-engineering/README.md) — it never falls back to a default or to apps/web/.env.local.`,
    );
  }
  return value;
}

const supabaseUrl = requireEnv("SUPABASE_TEST_URL");
const supabaseAnonKey = requireEnv("SUPABASE_TEST_ANON_KEY");
const supabaseServiceRoleKey = requireEnv("SUPABASE_TEST_SERVICE_ROLE_KEY");
const clientAEmail = requireEnv("RLS_TEST_CLIENT_A_EMAIL");
const clientAPassword = requireEnv("RLS_TEST_CLIENT_A_PASSWORD");
const companyAId = requireEnv("RLS_TEST_COMPANY_A_ID");
const clientAId = requireEnv("RLS_TEST_CLIENT_A_ID");

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

async function main() {
  // `client` (autenticado como clientA) só é usado para provar, em outro
  // arquivo (write-boundary), que o caminho direto está fechado — aqui,
  // toda escrita passa pelo caminho confiável (service_role + ator já
  // resolvido), exatamente como a camada de servidor faria depois de
  // validar a sessão via apps/web/lib/supabase/server.ts.
  await signIn(clientAEmail, clientAPassword);
  const serviceRoleClient = createServiceRoleClient();
  const procurementCaseRepository = createProcurementCaseRepository(serviceRoleClient);
  const budgetVersionRepository = createBudgetVersionRepository(serviceRoleClient);
  const repositories = { procurementCaseRepository, budgetVersionRepository };
  const context = { organizationId: companyAId, actor: clientAId, correlationId: `sprint-21-3c-${runId()}`, sourceSystem: "sprint-21-3c-integration-test" };
  const marker = runId();
  const shared = { versionId: null };
  const tracked = { procurementCaseIds: [], budgetVersionIds: [] };

  try {
    await runTest("cria Processo, Lote, e duas Versões (processo inteiro e lote)", async () => {
      const createdCase = await createProcurementCaseService(context, { title: `[Sprint 21.3C] Processo de integração ${marker}` }, procurementCaseRepository);
      assertEqual(createdCase.outcome, "created");
      if (createdCase.outcome !== "created") return;
      tracked.procurementCaseIds.push(createdCase.procurementCase.id);

      const createdLot = await registerProcurementLotService(
        context,
        { procurementCaseId: createdCase.procurementCase.id, title: `[Sprint 21.3C] Lote ${marker}` },
        procurementCaseRepository,
      );
      assertEqual(createdLot.outcome, "created");
      if (createdLot.outcome !== "created") return;

      const wholeCaseDraft = await createBudgetVersionDraftService(
        context,
        { procurementCaseId: createdCase.procurementCase.id, scope: { kind: "WholeCase" }, origin: { kind: BudgetVersionOriginKind.Native } },
        repositories,
      );
      assertEqual(wholeCaseDraft.outcome, "success");
      if (wholeCaseDraft.outcome === "success") tracked.budgetVersionIds.push(wholeCaseDraft.budgetVersion.id);

      const lotDraft = await createBudgetVersionDraftService(
        context,
        {
          procurementCaseId: createdCase.procurementCase.id,
          scope: { kind: "Lot", procurementLotId: createdLot.procurementLot.id },
          origin: { kind: BudgetVersionOriginKind.Native },
        },
        repositories,
      );
      assertEqual(lotDraft.outcome, "success");
      if (lotDraft.outcome === "success") tracked.budgetVersionIds.push(lotDraft.budgetVersion.id);

      shared.versionId = wholeCaseDraft.outcome === "success" ? wholeCaseDraft.budgetVersion.id : null;
    });

    await runTest("adiciona hierarquia, atualiza, remove, reordena e confirma bloqueio de remoção com filhos", async () => {
      const versionId = shared.versionId;
      assertTrue(typeof versionId === "string", "seed test must have run first");

      const group = await addBudgetLineService(
        context,
        { budgetVersionId: versionId, kind: BudgetLineKind.Group, description: { status: "Confirmed", text: "1. Serviços Preliminares" }, position: 0, scope: { kind: "WholeCase" } },
        repositories,
      );
      assertEqual(group.outcome, "success");
      if (group.outcome !== "success") return;
      const groupLineId = group.budgetVersion.lines[0].id;

      const itemA = await addBudgetLineService(
        context,
        {
          budgetVersionId: versionId,
          kind: BudgetLineKind.ServiceItem,
          description: { status: "AbsentFromSource" },
          parentLineId: groupLineId,
          position: 0,
          scope: { kind: "WholeCase" },
          totalCents: 150_000,
        },
        repositories,
      );
      assertEqual(itemA.outcome, "success");
      if (itemA.outcome !== "success") return;

      const itemB = await addBudgetLineService(
        context,
        {
          budgetVersionId: versionId,
          kind: BudgetLineKind.ServiceItem,
          description: { status: "Confirmed", text: "1.2 Instalação de canteiro" },
          parentLineId: groupLineId,
          position: 1,
          scope: { kind: "WholeCase" },
          totalCents: 250_000,
        },
        repositories,
      );
      assertEqual(itemB.outcome, "success");
      if (itemB.outcome !== "success") return;
      const itemBLineId = itemB.budgetVersion.lines.find((line) => line.position === 1 && line.parentLineId === groupLineId).id;

      const blockedRemoval = await removeBudgetLineService(context, { budgetVersionId: versionId, lineId: groupLineId }, repositories);
      assertEqual(blockedRemoval.outcome, "domain_error");
      if (blockedRemoval.outcome === "domain_error") {
        assertEqual(blockedRemoval.errors[0]?.code, "line_has_children");
      }

      const updated = await updateBudgetLineService(
        context,
        { budgetVersionId: versionId, lineId: itemBLineId, description: { status: "Confirmed", text: "1.2 Instalação de canteiro (revisado)" }, totalCents: 260_000 },
        repositories,
      );
      assertEqual(updated.outcome, "success");

      const reordered = await reorderBudgetLineService(context, { budgetVersionId: versionId, lineId: itemBLineId, position: 5 }, repositories);
      assertEqual(reordered.outcome, "success");

      const itemAId = itemA.budgetVersion.lines.find((line) => line.parentLineId === groupLineId && line.description.status === "AbsentFromSource").id;
      const removed = await removeBudgetLineService(context, { budgetVersionId: versionId, lineId: itemAId }, repositories);
      assertEqual(removed.outcome, "success");
      if (removed.outcome === "success") {
        assertEqual(removed.budgetVersion.lines.length, 2, "Grupo + item B remaining after removing item A (leaf, no children)");
      }
    });

    await runTest("registra Relação de Rastreabilidade, consolida, recarrega e confirma igualdade semântica", async () => {
      const versionId = shared.versionId;

      const lineage = await registerLineageRelationService(context, { budgetVersionId: versionId }, repositories);
      assertEqual(lineage.outcome, "success");

      const secondLineage = await registerLineageRelationService(context, { budgetVersionId: versionId }, repositories);
      assertEqual(secondLineage.outcome, "domain_error", "a second lineage relation for the same version must be rejected");

      const consolidated = await consolidateBudgetVersionService(context, { budgetVersionId: versionId }, repositories);
      assertEqual(consolidated.outcome, "success");
      if (consolidated.outcome !== "success") return;
      assertEqual(consolidated.budgetVersion.status, "Consolidated");

      const reloaded = await getBudgetVersionService(context, { budgetVersionId: versionId }, budgetVersionRepository);
      assertEqual(reloaded.outcome, "found");
      if (reloaded.outcome !== "found") return;

      assertEqual(reloaded.budgetVersion.status, "Consolidated");
      assertEqual(reloaded.revision, consolidated.revision);
      assertEqual(reloaded.budgetVersion.lines.length, 2);
      assertEqual(reloaded.budgetVersion.originLineage !== null, true);
      assertTrue(
        reloaded.budgetVersion.lines.some((line) => line.description.status === "AbsentFromSource") === false,
        "the AbsentFromSource item was removed earlier and must not reappear after reload",
      );

      const revisedItem = reloaded.budgetVersion.lines.find((line) => line.position === 5);
      assertEqual(revisedItem?.totalCents, 260_000, "monetary value must survive an RPC round trip exactly (bigint, no floating point)");
      assertEqual(revisedItem?.description.status === "Confirmed" ? revisedItem.description.text : null, "1.2 Instalação de canteiro (revisado)");

      const blockedAfterConsolidation = await addBudgetLineService(
        context,
        { budgetVersionId: versionId, kind: BudgetLineKind.Group, description: { status: "Confirmed", text: "Grupo tardio" }, position: 9, scope: { kind: "WholeCase" } },
        repositories,
      );
      assertEqual(blockedAfterConsolidation.outcome, "domain_error");
      if (blockedAfterConsolidation.outcome === "domain_error") {
        assertEqual(blockedAfterConsolidation.errors[0]?.code, "consolidated_version_immutable");
      }
    });

    await runTest("concorrência real via RPC: revisão antiga produz conflito e a gravação mais recente permanece íntegra", async () => {
      const createdCase = await createProcurementCaseService(context, { title: `[Sprint 21.3C] Processo de concorrência ${marker}` }, procurementCaseRepository);
      assertEqual(createdCase.outcome, "created");
      if (createdCase.outcome !== "created") return;
      tracked.procurementCaseIds.push(createdCase.procurementCase.id);

      const draft = await createBudgetVersionDraftService(
        context,
        { procurementCaseId: createdCase.procurementCase.id, scope: { kind: "WholeCase" }, origin: { kind: BudgetVersionOriginKind.Native } },
        repositories,
      );
      assertEqual(draft.outcome, "success");
      if (draft.outcome !== "success") return;
      tracked.budgetVersionIds.push(draft.budgetVersion.id);

      const firstCopy = await budgetVersionRepository.loadBudgetVersion(companyAId, draft.budgetVersion.id);
      const secondCopy = await budgetVersionRepository.loadBudgetVersion(companyAId, draft.budgetVersion.id);
      assertEqual(firstCopy.revision, secondCopy.revision);

      const firstCopyLine = {
        id: crypto.randomUUID(),
        budgetVersionId: draft.budgetVersion.id,
        kind: BudgetLineKind.Group,
        description: { status: "Confirmed", text: "Grupo da primeira cópia" },
        externalCode: null,
        parentLineId: null,
        position: 0,
        scope: { kind: "WholeCase", procurementCaseId: createdCase.procurementCase.id },
        totalCents: null,
        metadata: {},
      };
      const secondCopyLine = { ...firstCopyLine, id: crypto.randomUUID(), description: { status: "Confirmed", text: "Grupo da segunda cópia (obsoleta)" } };

      const firstSave = await budgetVersionRepository.saveBudgetVersion(
        companyAId,
        clientAId,
        { ...firstCopy.entity, lines: [...firstCopy.entity.lines, firstCopyLine] },
        firstCopy.revision,
      );
      assertEqual(firstSave.outcome, "saved");

      const staleSave = await budgetVersionRepository.saveBudgetVersion(
        companyAId,
        clientAId,
        { ...secondCopy.entity, lines: [...secondCopy.entity.lines, secondCopyLine] },
        secondCopy.revision,
      );
      assertEqual(staleSave.outcome, "concurrency_conflict", "the RPC must reject a save against a stale revision — no lost update");

      const reloaded = await budgetVersionRepository.loadBudgetVersion(companyAId, draft.budgetVersion.id);
      assertEqual(reloaded.revision, firstSave.revision);
      assertEqual(reloaded.entity.lines.length, 1, "only the winning write's line must be present");
      assertEqual(
        reloaded.entity.lines[0].description.text,
        "Grupo da primeira cópia",
        "the winning write must be the one that actually persisted, never the stale attempt",
      );
    });

    await runTest("rollback: uma falha dentro do RPC não deixa persistência parcial", async () => {
      const createdCase = await createProcurementCaseService(context, { title: `[Sprint 21.3C] Processo de rollback ${marker}` }, procurementCaseRepository);
      assertEqual(createdCase.outcome, "created");
      if (createdCase.outcome !== "created") return;
      tracked.procurementCaseIds.push(createdCase.procurementCase.id);

      const draft = await createBudgetVersionDraftService(
        context,
        { procurementCaseId: createdCase.procurementCase.id, scope: { kind: "WholeCase" }, origin: { kind: BudgetVersionOriginKind.Native } },
        repositories,
      );
      assertEqual(draft.outcome, "success");
      if (draft.outcome !== "success") return;
      tracked.budgetVersionIds.push(draft.budgetVersion.id);

      const revisionBefore = draft.revision;

      // Forçar a falha via service_role (não authenticated — authenticated
      // nem alcança a função, ver procurement-engineering-write-boundary.
      // test.mjs seção 8/9): o objetivo aqui é a atomicidade da função em
      // si, não a fronteira de autorização.
      const { error } = await serviceRoleClient.rpc("persist_budget_version_snapshot", {
        p_actor_id: clientAId,
        p_company_id: companyAId,
        p_budget_version_id: draft.budgetVersion.id,
        p_expected_revision: revisionBefore,
        p_status: "Draft",
        p_lines: [{ id: crypto.randomUUID(), kind: "NotAValidKind", descriptionStatus: "AbsentFromSource", descriptionText: null, externalCode: null, parentLineId: null, position: 0, scopeKind: "WholeCase", scopeProcurementLotId: null, totalCents: null, metadata: {} }],
        p_lineage_id: null,
        p_lineage_origin_kind: null,
        p_lineage_origin_reference: null,
      });

      assertTrue(error !== null, "an invalid line kind must violate the CHECK constraint and fail the whole call");

      const reloaded = await budgetVersionRepository.loadBudgetVersion(companyAId, draft.budgetVersion.id);
      assertEqual(reloaded.revision, revisionBefore, "revision must not have advanced — the failed attempt left no trace");
      assertEqual(reloaded.entity.lines.length, 0, "no line from the failed attempt was persisted");
    });

    await runTest("recarregar → alterar → salvar preserva a hierarquia mesmo quando o UUID do filho é lexicograficamente anterior ao do pai", async () => {
      const createdCase = await createProcurementCaseService(context, { title: `[Sprint 21.3C] Processo de ordenação topológica ${marker}` }, procurementCaseRepository);
      assertEqual(createdCase.outcome, "created");
      if (createdCase.outcome !== "created") return;
      tracked.procurementCaseIds.push(createdCase.procurementCase.id);

      const draft = await createBudgetVersionDraftService(
        context,
        { procurementCaseId: createdCase.procurementCase.id, scope: { kind: "WholeCase" }, origin: { kind: BudgetVersionOriginKind.Native } },
        repositories,
      );
      assertEqual(draft.outcome, "success");
      if (draft.outcome !== "success") return;
      tracked.budgetVersionIds.push(draft.budgetVersion.id);

      // UUIDs escolhidos deliberadamente: o filho ("00...") é
      // lexicograficamente anterior ao pai ("ff...") — exatamente o
      // cenário que exige a ordenação topológica no mapeador (o
      // gatilho de integridade de parent_line_id rejeitaria a inserção
      // do filho se ele fosse processado antes do pai).
      const parentId = "ffffffff-0000-4000-8000-000000000001";
      const childId = "00000000-0000-4000-8000-000000000002";
      const scope = { kind: "WholeCase", procurementCaseId: createdCase.procurementCase.id };

      const withParent = addBudgetLine({
        budgetVersion: draft.budgetVersion,
        id: parentId,
        kind: BudgetLineKind.Group,
        description: { status: "Confirmed", text: "Grupo (UUID lexicograficamente maior)" },
        position: 0,
        scope,
      });
      assertEqual(withParent.success, true, JSON.stringify(withParent.errors));

      const withChild = addBudgetLine({
        budgetVersion: withParent.budgetVersion,
        id: childId,
        kind: BudgetLineKind.ServiceItem,
        description: { status: "Confirmed", text: "Item (UUID lexicograficamente menor que o pai)" },
        parentLineId: parentId,
        position: 0,
        scope,
        totalCents: 1_000,
      });
      assertEqual(withChild.success, true, JSON.stringify(withChild.errors));

      assertTrue(childId < parentId, "precondition: child id must sort before parent id lexicographically");

      const firstSave = await budgetVersionRepository.saveBudgetVersion(companyAId, clientAId, withChild.budgetVersion, draft.revision);
      assertEqual(firstSave.outcome, "saved", "persisting with a lexicographically-earlier child id must succeed — the mapper must order parent before child regardless of id ordering");
      if (firstSave.outcome !== "saved") return;

      const reloaded = await budgetVersionRepository.loadBudgetVersion(companyAId, draft.budgetVersion.id);
      assertEqual(reloaded.entity.lines.length, 2);
      const reloadedChild = reloaded.entity.lines.find((line) => line.id === childId);
      assertEqual(reloadedChild?.parentLineId, parentId, "hierarchy must survive the round trip");

      // Uma alteração permitida em rascunho — atualizar a descrição do
      // filho — e salvar novamente, confirmando que a hierarquia
      // continua íntegra numa segunda gravação.
      const updated = await updateBudgetLineService(
        context,
        { budgetVersionId: draft.budgetVersion.id, lineId: childId, description: { status: "Confirmed", text: "Item (descrição revisada)" } },
        repositories,
      );
      assertEqual(updated.outcome, "success");
      if (updated.outcome !== "success") return;

      const reloadedAgain = await budgetVersionRepository.loadBudgetVersion(companyAId, draft.budgetVersion.id);
      const reloadedAgainChild = reloadedAgain.entity.lines.find((line) => line.id === childId);
      assertEqual(reloadedAgainChild?.parentLineId, parentId, "hierarchy must survive a second save");
      assertEqual(
        reloadedAgainChild?.description.status === "Confirmed" ? reloadedAgainChild.description.text : null,
        "Item (descrição revisada)",
      );
    });
  } finally {
    const serviceClient = createServiceRoleClient();
    await cleanupCreatedData(serviceClient, tracked);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
