import process from "node:process";
import { createClient } from "@supabase/supabase-js";
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
} from "../../../apps/web/lib/bdos/procurement-engineering-repository.ts";

// Sprint 21.3C — testes de integração com o banco real (projeto Supabase
// configurado em apps/web/.env.local, confirmado com o usuário antes de
// aplicar a migração). Roda via `npx tsx` (não `node --test`, para reusar o
// mesmo padrão runTest/assertEqual de todo o resto do repositório), fora do
// glob `*.test.ts` de propósito (mesma razão de
// supabase/tests/rls/tenant-isolation.test.mjs ser `.test.mjs`): exige
// SUPABASE_URL/SUPABASE_ANON_KEY reais e rede — `pnpm test`/CI não devem
// depender disso.
//
// Reaproveita o usuário/organização de teste já existentes (cliente A,
// carlos@carlosmendes.com.br) da suíte de RLS — nenhum usuário ou empresa
// novo é criado aqui. Toda linha criada por este arquivo é identificável
// pelo prefixo "[Sprint 21.3C]" no título; ver o relatório final da Sprint
// quanto à política de retenção desses dados (procurement_cases/
// procurement_lots/budget_versions/budget_version_lineage_relations não
// expõem DELETE via RLS nesta fatia — mesma convenção de todo outro
// domínio de auditoria já existente no schema BDOS, planning_imports/
// decision_snapshots inclusive).

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const clientAEmail = process.env.RLS_TEST_CLIENT_A_EMAIL || "carlos@carlosmendes.com.br";
const clientAPassword = process.env.RLS_TEST_CLIENT_A_PASSWORD || "Teste123!";
const companyAId = process.env.RLS_TEST_COMPANY_A_ID || "eeeeeeee-0000-0000-0000-000000000001";
const clientAId = process.env.RLS_TEST_CLIENT_A_ID || "d9e849b1-cd4a-4855-888c-857d8a7a6050";

function createSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Set SUPABASE_URL and SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) before running this test.");
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

async function main() {
  const client = await signIn(clientAEmail, clientAPassword);
  const procurementCaseRepository = createProcurementCaseRepository(client);
  const budgetVersionRepository = createBudgetVersionRepository(client);
  const repositories = { procurementCaseRepository, budgetVersionRepository };
  const context = { organizationId: companyAId, actor: clientAId, correlationId: `sprint-21-3c-${runId()}`, sourceSystem: "sprint-21-3c-integration-test" };
  const marker = runId();
  const shared = { versionId: null };

  await runTest("cria Processo, Lote, e duas Versões (processo inteiro e lote)", async () => {
    const createdCase = await createProcurementCaseService(context, { title: `[Sprint 21.3C] Processo de integração ${marker}` }, procurementCaseRepository);
    assertEqual(createdCase.outcome, "created");
    if (createdCase.outcome !== "created") return;

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

    // Bloqueio de remoção com descendentes — o Grupo não pode ser removido enquanto tiver filhos.
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

    // Alteração após consolidação deve ser rejeitada pelo domínio.
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

    const draft = await createBudgetVersionDraftService(
      context,
      { procurementCaseId: createdCase.procurementCase.id, scope: { kind: "WholeCase" }, origin: { kind: BudgetVersionOriginKind.Native } },
      repositories,
    );
    assertEqual(draft.outcome, "success");
    if (draft.outcome !== "success") return;

    // Duas "cópias" da mesma Versão, carregadas na mesma revisão inicial —
    // cada uma recebe uma Linha diferente, simulando duas edições
    // concorrentes reais (o que persist_budget_version_snapshot de fato
    // persiste é o conjunto de Linhas, nunca metadata solto).
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
      { ...firstCopy.entity, lines: [...firstCopy.entity.lines, firstCopyLine] },
      firstCopy.revision,
    );
    assertEqual(firstSave.outcome, "saved");

    const staleSave = await budgetVersionRepository.saveBudgetVersion(
      companyAId,
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

    const draft = await createBudgetVersionDraftService(
      context,
      { procurementCaseId: createdCase.procurementCase.id, scope: { kind: "WholeCase" }, origin: { kind: BudgetVersionOriginKind.Native } },
      repositories,
    );
    assertEqual(draft.outcome, "success");
    if (draft.outcome !== "success") return;

    const revisionBefore = draft.revision;

    // Chama o RPC diretamente com uma Linha propositalmente inválida (kind
    // desconhecido, viola o CHECK de budget_lines) para forçar uma falha no
    // meio da função — a UPDATE de budget_versions já teria acontecido
    // antes do INSERT malformado, e só a transação implícita da função (que
    // desfaz tudo ao levantar exceção) evita que a revisão avance sem as
    // Linhas correspondentes.
    const { error } = await client.rpc("persist_budget_version_snapshot", {
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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
