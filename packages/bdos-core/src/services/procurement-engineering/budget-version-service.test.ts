import {
  addBudgetLineService,
  consolidateBudgetVersionService,
  createBudgetVersionDraftService,
  getBudgetVersionService,
  registerLineageRelationService,
  removeBudgetLineService,
  reorderBudgetLineService,
  updateBudgetLineService,
} from "./budget-version-service";
import { createProcurementCaseService, registerProcurementLotService } from "./procurement-case-service";
import type { ApplicationContext } from "./application-context";
import type { ProcurementCaseRepository } from "./procurement-case.repository";
import type { BudgetVersionRepository, PersistedEntity, SaveBudgetVersionResult } from "./budget-version.repository";
import { INITIAL_BUDGET_VERSION_REVISION } from "./budget-version.repository";
import type { BudgetVersionServiceRepositories } from "./budget-version-service.types";
import { BudgetLineKind, BudgetVersionOriginKind, BudgetVersionStatus } from "../../domain/budget-version";
import type { BudgetVersion } from "../../domain/budget-version";
import type { ProcurementCase, ProcurementLot } from "../../domain/procurement-case";

// Sprint 21.3C — testes de coordenação do Serviço de Aplicação da Versão do
// Orçamento contra repositórios falsos em memória. Não reimplementa os
// testes de domínio já cobertos em budget-version.test.ts (Sprint 21.3B) —
// cobre apenas carregamento de Processo/Lote, tradução de falhas, e
// concorrência otimista.

const ORG_A = "organization-alpha";
const ORG_B = "organization-beta";

function contextFor(organizationId: string): ApplicationContext {
  return { organizationId, actor: "engenheiro-de-custos", correlationId: "corr-1", sourceSystem: "bdos-core-test" };
}

interface FakeProcurementCaseRepository extends ProcurementCaseRepository {}

function createFakeProcurementCaseRepository(): FakeProcurementCaseRepository {
  const cases = new Map<string, ProcurementCase>();
  const lots = new Map<string, ProcurementLot>();

  return {
    async createProcurementCase(organizationId, _actor, procurementCase) {
      cases.set(`${organizationId}:${procurementCase.id}`, procurementCase);
      return procurementCase;
    },
    async findProcurementCaseById(organizationId, id) {
      return cases.get(`${organizationId}:${id}`) ?? null;
    },
    async createProcurementLot(organizationId, _actor, procurementLot) {
      lots.set(`${organizationId}:${procurementLot.id}`, procurementLot);
      return procurementLot;
    },
    async findProcurementLotById(organizationId, procurementCaseId, id) {
      const lot = lots.get(`${organizationId}:${id}`);
      if (lot === undefined || lot.procurementCaseId !== procurementCaseId) {
        return null;
      }
      return lot;
    },
  };
}

interface FakeBudgetVersionRepository extends BudgetVersionRepository {
  setThrowOnSave(shouldThrow: boolean): void;
  saveCallCount(): number;
  lastActor(): string | undefined;
}

function createFakeBudgetVersionRepository(): FakeBudgetVersionRepository {
  const versions = new Map<string, PersistedEntity<BudgetVersion>>();
  let throwOnSave = false;
  let saveCalls = 0;
  let lastActor: string | undefined;

  return {
    setThrowOnSave(shouldThrow: boolean): void {
      throwOnSave = shouldThrow;
    },
    saveCallCount(): number {
      return saveCalls;
    },
    lastActor(): string | undefined {
      return lastActor;
    },
    async createDraftBudgetVersion(organizationId, actor, budgetVersion) {
      lastActor = actor;
      const persisted: PersistedEntity<BudgetVersion> = { entity: budgetVersion, revision: INITIAL_BUDGET_VERSION_REVISION };
      versions.set(`${organizationId}:${budgetVersion.id}`, persisted);
      return persisted;
    },
    async loadBudgetVersion(organizationId, id) {
      return versions.get(`${organizationId}:${id}`) ?? null;
    },
    async saveBudgetVersion(organizationId, actor, budgetVersion, expectedRevision): Promise<SaveBudgetVersionResult> {
      saveCalls += 1;
      lastActor = actor;

      if (throwOnSave) {
        throw new Error("simulated persistence failure");
      }

      const key = `${organizationId}:${budgetVersion.id}`;
      const current = versions.get(key);

      if (current === undefined || current.revision !== expectedRevision) {
        return { outcome: "concurrency_conflict" };
      }

      const nextRevision = current.revision + 1;
      versions.set(key, { entity: budgetVersion, revision: nextRevision });
      return { outcome: "saved", revision: nextRevision };
    },
  };
}

async function seedWholeCaseDraft(
  context: ApplicationContext,
  repositories: BudgetVersionServiceRepositories,
): Promise<{ procurementCaseId: string; budgetVersionId: string }> {
  const createdCase = await createProcurementCaseService(context, { title: "Processo de teste" }, repositories.procurementCaseRepository);
  if (createdCase.outcome !== "created") {
    throw new Error("seed: unexpected failure creating procurement case");
  }

  const draft = await createBudgetVersionDraftService(
    context,
    {
      procurementCaseId: createdCase.procurementCase.id,
      scope: { kind: "WholeCase" },
      origin: { kind: BudgetVersionOriginKind.Native },
    },
    repositories,
  );

  if (draft.outcome !== "success") {
    throw new Error("seed: unexpected failure creating draft budget version");
  }

  return { procurementCaseId: createdCase.procurementCase.id, budgetVersionId: draft.budgetVersion.id };
}

async function main(): Promise<void> {
  await runTest("cria Versão do Orçamento em rascunho de Escopo do processo inteiro", async () => {
    const repositories: BudgetVersionServiceRepositories = {
      procurementCaseRepository: createFakeProcurementCaseRepository(),
      budgetVersionRepository: createFakeBudgetVersionRepository(),
    };

    const { budgetVersionId } = await seedWholeCaseDraft(contextFor(ORG_A), repositories);
    const query = await getBudgetVersionService(contextFor(ORG_A), { budgetVersionId }, repositories.budgetVersionRepository);

    assertEqual(query.outcome, "found");
    if (query.outcome !== "found") return;
    assertEqual(query.budgetVersion.status, BudgetVersionStatus.Draft);
    assertEqual(query.revision, INITIAL_BUDGET_VERSION_REVISION);
  });

  await runTest("autoria: cada gravação recebe o ator do contexto que está executando aquela chamada, nunca um valor desatualizado", async () => {
    const repositories: BudgetVersionServiceRepositories = {
      procurementCaseRepository: createFakeProcurementCaseRepository(),
      budgetVersionRepository: createFakeBudgetVersionRepository(),
    };
    const fakeBudgetVersionRepository = repositories.budgetVersionRepository as FakeBudgetVersionRepository;

    const creatorContext = { ...contextFor(ORG_A), actor: "engenheiro-criador" };
    const { budgetVersionId } = await seedWholeCaseDraft(creatorContext, repositories);
    assertEqual(fakeBudgetVersionRepository.lastActor(), "engenheiro-criador", "createDraftBudgetVersion must receive the creating context's actor");

    const editorContext = { ...contextFor(ORG_A), actor: "engenheiro-editor" };
    const added = await addBudgetLineService(
      editorContext,
      { budgetVersionId, kind: BudgetLineKind.Group, description: { status: "Confirmed", text: "Grupo" }, position: 0, scope: { kind: "WholeCase" } },
      repositories,
    );
    assertEqual(added.outcome, "success");
    assertEqual(
      fakeBudgetVersionRepository.lastActor(),
      "engenheiro-editor",
      "saveBudgetVersion must receive the actor performing THIS mutation, never the original creator recorded in stale metadata",
    );
  });

  await runTest("rejeita criar Versão para Processo inexistente", async () => {
    const repositories: BudgetVersionServiceRepositories = {
      procurementCaseRepository: createFakeProcurementCaseRepository(),
      budgetVersionRepository: createFakeBudgetVersionRepository(),
    };

    const result = await createBudgetVersionDraftService(
      contextFor(ORG_A),
      { procurementCaseId: "case-inexistente", scope: { kind: "WholeCase" }, origin: { kind: BudgetVersionOriginKind.Native } },
      repositories,
    );

    assertEqual(result.outcome, "procurement_case_not_found");
  });

  await runTest("rejeita criar Versão de Escopo de lote inexistente", async () => {
    const repositories: BudgetVersionServiceRepositories = {
      procurementCaseRepository: createFakeProcurementCaseRepository(),
      budgetVersionRepository: createFakeBudgetVersionRepository(),
    };

    const createdCase = await createProcurementCaseService(contextFor(ORG_A), { title: "Processo" }, repositories.procurementCaseRepository);
    assertEqual(createdCase.outcome, "created");
    if (createdCase.outcome !== "created") return;

    const result = await createBudgetVersionDraftService(
      contextFor(ORG_A),
      {
        procurementCaseId: createdCase.procurementCase.id,
        scope: { kind: "Lot", procurementLotId: "lot-inexistente" },
        origin: { kind: BudgetVersionOriginKind.Native },
      },
      repositories,
    );

    assertEqual(result.outcome, "procurement_lot_not_found");
  });

  await runTest("rejeita criar Versão de Escopo de lote de outro Processo", async () => {
    const repositories: BudgetVersionServiceRepositories = {
      procurementCaseRepository: createFakeProcurementCaseRepository(),
      budgetVersionRepository: createFakeBudgetVersionRepository(),
    };

    const caseA = await createProcurementCaseService(contextFor(ORG_A), { title: "Processo A" }, repositories.procurementCaseRepository);
    const caseB = await createProcurementCaseService(contextFor(ORG_A), { title: "Processo B" }, repositories.procurementCaseRepository);
    assertEqual(caseA.outcome, "created");
    assertEqual(caseB.outcome, "created");
    if (caseA.outcome !== "created" || caseB.outcome !== "created") return;

    const lotOfB = await registerProcurementLotService(
      contextFor(ORG_A),
      { procurementCaseId: caseB.procurementCase.id, title: "Lote de B" },
      repositories.procurementCaseRepository,
    );
    assertEqual(lotOfB.outcome, "created");
    if (lotOfB.outcome !== "created") return;

    const result = await createBudgetVersionDraftService(
      contextFor(ORG_A),
      {
        procurementCaseId: caseA.procurementCase.id,
        scope: { kind: "Lot", procurementLotId: lotOfB.procurementLot.id },
        origin: { kind: BudgetVersionOriginKind.Native },
      },
      repositories,
    );

    // findProcurementLotById is scoped by (organizationId, procurementCaseId, id) — a lot
    // registered under Case B is invisible when looked up under Case A's id.
    assertEqual(result.outcome, "procurement_lot_not_found", "a lot from a different Processo must not be usable to prove a scope");
  });

  await runTest("adiciona hierarquia de Linhas (Grupo → Subgrupo → Item de Serviço) e consulta o retrato completo", async () => {
    const repositories: BudgetVersionServiceRepositories = {
      procurementCaseRepository: createFakeProcurementCaseRepository(),
      budgetVersionRepository: createFakeBudgetVersionRepository(),
    };

    const { budgetVersionId } = await seedWholeCaseDraft(contextFor(ORG_A), repositories);

    const group = await addBudgetLineService(
      contextFor(ORG_A),
      {
        budgetVersionId,
        kind: BudgetLineKind.Group,
        description: { status: "Confirmed", text: "1. Serviços Preliminares" },
        position: 0,
        scope: { kind: "WholeCase" },
      },
      repositories,
    );
    assertEqual(group.outcome, "success");
    if (group.outcome !== "success") return;
    const groupLine = group.budgetVersion.lines[0];

    const item = await addBudgetLineService(
      contextFor(ORG_A),
      {
        budgetVersionId,
        kind: BudgetLineKind.ServiceItem,
        description: { status: "Confirmed", text: "1.1 Mobilização" },
        parentLineId: groupLine.id,
        position: 0,
        scope: { kind: "WholeCase" },
        totalCents: 150_000,
      },
      repositories,
    );

    assertEqual(item.outcome, "success");
    if (item.outcome !== "success") return;
    assertEqual(item.revision, 2, "two successful saves must have advanced the revision twice");

    const query = await getBudgetVersionService(contextFor(ORG_A), { budgetVersionId }, repositories.budgetVersionRepository);
    assertEqual(query.outcome, "found");
    if (query.outcome !== "found") return;
    assertEqual(query.budgetVersion.lines.length, 2);
  });

  await runTest("carrega o Lote quando o Escopo da Linha exigir", async () => {
    const repositories: BudgetVersionServiceRepositories = {
      procurementCaseRepository: createFakeProcurementCaseRepository(),
      budgetVersionRepository: createFakeBudgetVersionRepository(),
    };

    const context = contextFor(ORG_A);
    const createdCase = await createProcurementCaseService(context, { title: "Processo com lote" }, repositories.procurementCaseRepository);
    assertEqual(createdCase.outcome, "created");
    if (createdCase.outcome !== "created") return;

    const lot = await registerProcurementLotService(
      context,
      { procurementCaseId: createdCase.procurementCase.id, title: "Lote 1" },
      repositories.procurementCaseRepository,
    );
    assertEqual(lot.outcome, "created");
    if (lot.outcome !== "created") return;

    const draft = await createBudgetVersionDraftService(
      context,
      {
        procurementCaseId: createdCase.procurementCase.id,
        scope: { kind: "Lot", procurementLotId: lot.procurementLot.id },
        origin: { kind: BudgetVersionOriginKind.Native },
      },
      repositories,
    );
    assertEqual(draft.outcome, "success");
    if (draft.outcome !== "success") return;

    const group = await addBudgetLineService(
      context,
      {
        budgetVersionId: draft.budgetVersion.id,
        kind: BudgetLineKind.Group,
        description: { status: "Confirmed", text: "Grupo do lote" },
        position: 0,
        scope: { kind: "Lot", procurementLotId: lot.procurementLot.id },
      },
      repositories,
    );
    assertEqual(group.outcome, "success");
    if (group.outcome !== "success") return;

    const line = await addBudgetLineService(
      context,
      {
        budgetVersionId: draft.budgetVersion.id,
        kind: BudgetLineKind.ServiceItem,
        description: { status: "Confirmed", text: "Item do lote" },
        parentLineId: group.budgetVersion.lines[0].id,
        position: 0,
        scope: { kind: "Lot", procurementLotId: lot.procurementLot.id },
        totalCents: 1_000,
      },
      repositories,
    );

    assertEqual(line.outcome, "success");
  });

  await runTest("propaga erro hierárquico do domínio (Subgrupo sem Grupo pai)", async () => {
    const repositories: BudgetVersionServiceRepositories = {
      procurementCaseRepository: createFakeProcurementCaseRepository(),
      budgetVersionRepository: createFakeBudgetVersionRepository(),
    };

    const { budgetVersionId } = await seedWholeCaseDraft(contextFor(ORG_A), repositories);

    const result = await addBudgetLineService(
      contextFor(ORG_A),
      {
        budgetVersionId,
        kind: BudgetLineKind.Subgroup,
        description: { status: "Confirmed", text: "Subgrupo órfão" },
        position: 0,
        scope: { kind: "WholeCase" },
      },
      repositories,
    );

    assertEqual(result.outcome, "domain_error");
    if (result.outcome !== "domain_error") return;
    assertEqual(result.errors[0]?.code, "missing_parent_line");
  });

  await runTest("atualiza Linha existente (descrição e valor)", async () => {
    const repositories: BudgetVersionServiceRepositories = {
      procurementCaseRepository: createFakeProcurementCaseRepository(),
      budgetVersionRepository: createFakeBudgetVersionRepository(),
    };

    const { budgetVersionId } = await seedWholeCaseDraft(contextFor(ORG_A), repositories);
    const group = await addBudgetLineService(
      contextFor(ORG_A),
      { budgetVersionId, kind: BudgetLineKind.Group, description: { status: "Confirmed", text: "Grupo" }, position: 0, scope: { kind: "WholeCase" } },
      repositories,
    );
    assertEqual(group.outcome, "success");
    if (group.outcome !== "success") return;

    const item = await addBudgetLineService(
      contextFor(ORG_A),
      {
        budgetVersionId,
        kind: BudgetLineKind.ServiceItem,
        description: { status: "AbsentFromSource" },
        parentLineId: group.budgetVersion.lines[0].id,
        position: 0,
        scope: { kind: "WholeCase" },
        totalCents: 100,
      },
      repositories,
    );
    assertEqual(item.outcome, "success");
    if (item.outcome !== "success") return;
    const itemLineId = item.budgetVersion.lines[1].id;

    const updated = await updateBudgetLineService(
      contextFor(ORG_A),
      { budgetVersionId, lineId: itemLineId, description: { status: "Confirmed", text: "Descrição confirmada depois" }, totalCents: 500 },
      repositories,
    );

    assertEqual(updated.outcome, "success");
    if (updated.outcome !== "success") return;
    const updatedLine = updated.budgetVersion.lines.find((line) => line.id === itemLineId);
    assertEqual(updatedLine?.description.status, "Confirmed");
    assertEqual(updatedLine?.totalCents, 500);
  });

  await runTest("remove Linha sem filhos", async () => {
    const repositories: BudgetVersionServiceRepositories = {
      procurementCaseRepository: createFakeProcurementCaseRepository(),
      budgetVersionRepository: createFakeBudgetVersionRepository(),
    };

    const { budgetVersionId } = await seedWholeCaseDraft(contextFor(ORG_A), repositories);
    const group = await addBudgetLineService(
      contextFor(ORG_A),
      { budgetVersionId, kind: BudgetLineKind.Group, description: { status: "Confirmed", text: "Grupo" }, position: 0, scope: { kind: "WholeCase" } },
      repositories,
    );
    assertEqual(group.outcome, "success");
    if (group.outcome !== "success") return;
    const groupLineId = group.budgetVersion.lines[0].id;

    const removed = await removeBudgetLineService(contextFor(ORG_A), { budgetVersionId, lineId: groupLineId }, repositories);
    assertEqual(removed.outcome, "success");
    if (removed.outcome !== "success") return;
    assertEqual(removed.budgetVersion.lines.length, 0);
  });

  await runTest("propaga bloqueio de remoção de Linha com filhos", async () => {
    const repositories: BudgetVersionServiceRepositories = {
      procurementCaseRepository: createFakeProcurementCaseRepository(),
      budgetVersionRepository: createFakeBudgetVersionRepository(),
    };

    const { budgetVersionId } = await seedWholeCaseDraft(contextFor(ORG_A), repositories);
    const group = await addBudgetLineService(
      contextFor(ORG_A),
      { budgetVersionId, kind: BudgetLineKind.Group, description: { status: "Confirmed", text: "Grupo" }, position: 0, scope: { kind: "WholeCase" } },
      repositories,
    );
    assertEqual(group.outcome, "success");
    if (group.outcome !== "success") return;
    const groupLineId = group.budgetVersion.lines[0].id;

    const item = await addBudgetLineService(
      contextFor(ORG_A),
      {
        budgetVersionId,
        kind: BudgetLineKind.ServiceItem,
        description: { status: "Confirmed", text: "Item" },
        parentLineId: groupLineId,
        position: 0,
        scope: { kind: "WholeCase" },
        totalCents: 10,
      },
      repositories,
    );
    assertEqual(item.outcome, "success");

    const removed = await removeBudgetLineService(contextFor(ORG_A), { budgetVersionId, lineId: groupLineId }, repositories);
    assertEqual(removed.outcome, "domain_error");
    if (removed.outcome !== "domain_error") return;
    assertEqual(removed.errors[0]?.code, "line_has_children");
  });

  await runTest("reordena Linha", async () => {
    const repositories: BudgetVersionServiceRepositories = {
      procurementCaseRepository: createFakeProcurementCaseRepository(),
      budgetVersionRepository: createFakeBudgetVersionRepository(),
    };

    const { budgetVersionId } = await seedWholeCaseDraft(contextFor(ORG_A), repositories);
    const group = await addBudgetLineService(
      contextFor(ORG_A),
      { budgetVersionId, kind: BudgetLineKind.Group, description: { status: "Confirmed", text: "Grupo" }, position: 0, scope: { kind: "WholeCase" } },
      repositories,
    );
    assertEqual(group.outcome, "success");
    if (group.outcome !== "success") return;
    const groupLineId = group.budgetVersion.lines[0].id;

    const reordered = await reorderBudgetLineService(contextFor(ORG_A), { budgetVersionId, lineId: groupLineId, position: 7 }, repositories);
    assertEqual(reordered.outcome, "success");
    if (reordered.outcome !== "success") return;
    assertEqual(reordered.budgetVersion.lines[0].position, 7);
  });

  await runTest("registra a Relação de Rastreabilidade de origem e rejeita uma segunda", async () => {
    const repositories: BudgetVersionServiceRepositories = {
      procurementCaseRepository: createFakeProcurementCaseRepository(),
      budgetVersionRepository: createFakeBudgetVersionRepository(),
    };

    const { budgetVersionId } = await seedWholeCaseDraft(contextFor(ORG_A), repositories);

    const first = await registerLineageRelationService(contextFor(ORG_A), { budgetVersionId }, repositories);
    assertEqual(first.outcome, "success");
    if (first.outcome !== "success") return;
    assertEqual(first.budgetVersion.originLineage !== null, true);

    const second = await registerLineageRelationService(contextFor(ORG_A), { budgetVersionId }, repositories);
    assertEqual(second.outcome, "domain_error");
    if (second.outcome !== "domain_error") return;
    assertEqual(second.errors[0]?.code, "origin_lineage_already_registered");
  });

  await runTest("consolida a Versão e preserva Linhas e Relação de Rastreabilidade", async () => {
    const repositories: BudgetVersionServiceRepositories = {
      procurementCaseRepository: createFakeProcurementCaseRepository(),
      budgetVersionRepository: createFakeBudgetVersionRepository(),
    };

    const { budgetVersionId } = await seedWholeCaseDraft(contextFor(ORG_A), repositories);
    const group = await addBudgetLineService(
      contextFor(ORG_A),
      { budgetVersionId, kind: BudgetLineKind.Group, description: { status: "Confirmed", text: "Grupo" }, position: 0, scope: { kind: "WholeCase" } },
      repositories,
    );
    assertEqual(group.outcome, "success");

    const lineage = await registerLineageRelationService(contextFor(ORG_A), { budgetVersionId }, repositories);
    assertEqual(lineage.outcome, "success");

    const consolidated = await consolidateBudgetVersionService(contextFor(ORG_A), { budgetVersionId }, repositories);
    assertEqual(consolidated.outcome, "success");
    if (consolidated.outcome !== "success") return;
    assertEqual(consolidated.budgetVersion.status, BudgetVersionStatus.Consolidated);
    assertEqual(consolidated.budgetVersion.lines.length, 1);
    assertEqual(consolidated.budgetVersion.originLineage !== null, true);

    const fakeRepo = repositories.budgetVersionRepository as FakeBudgetVersionRepository;
    const saveCallsBeforeRepeat = fakeRepo.saveCallCount();
    const repeated = await consolidateBudgetVersionService(contextFor(ORG_A), { budgetVersionId }, repositories);
    assertEqual(repeated.outcome, "success", "consolidating an already-consolidated version is a domain no-op, never an error");
    if (repeated.outcome === "success") {
      assertEqual(repeated.revision, consolidated.revision, "revision must not advance on a no-op consolidation");
    }
    assertEqual(fakeRepo.saveCallCount(), saveCallsBeforeRepeat, "consolidating an already-consolidated version must never call saveBudgetVersion");
  });

  await runTest("rejeita alteração de Linha após consolidação (propaga erro de domínio)", async () => {
    const repositories: BudgetVersionServiceRepositories = {
      procurementCaseRepository: createFakeProcurementCaseRepository(),
      budgetVersionRepository: createFakeBudgetVersionRepository(),
    };

    const { budgetVersionId } = await seedWholeCaseDraft(contextFor(ORG_A), repositories);
    await consolidateBudgetVersionService(contextFor(ORG_A), { budgetVersionId }, repositories);

    const result = await addBudgetLineService(
      contextFor(ORG_A),
      { budgetVersionId, kind: BudgetLineKind.Group, description: { status: "Confirmed", text: "Grupo tardio" }, position: 0, scope: { kind: "WholeCase" } },
      repositories,
    );

    assertEqual(result.outcome, "domain_error");
    if (result.outcome !== "domain_error") return;
    assertEqual(result.errors[0]?.code, "consolidated_version_immutable");
  });

  await runTest("retorna not_found ao operar sobre Versão inexistente", async () => {
    const repositories: BudgetVersionServiceRepositories = {
      procurementCaseRepository: createFakeProcurementCaseRepository(),
      budgetVersionRepository: createFakeBudgetVersionRepository(),
    };

    const result = await consolidateBudgetVersionService(contextFor(ORG_A), { budgetVersionId: "versao-inexistente" }, repositories);
    assertEqual(result.outcome, "not_found");

    const query = await getBudgetVersionService(contextFor(ORG_A), { budgetVersionId: "versao-inexistente" }, repositories.budgetVersionRepository);
    assertEqual(query.outcome, "not_found");
  });

  await runTest("Versão de uma organização usuária é invisível para outra — isolamento na camada de aplicação", async () => {
    const repositories: BudgetVersionServiceRepositories = {
      procurementCaseRepository: createFakeProcurementCaseRepository(),
      budgetVersionRepository: createFakeBudgetVersionRepository(),
    };

    const { budgetVersionId } = await seedWholeCaseDraft(contextFor(ORG_A), repositories);
    const query = await getBudgetVersionService(contextFor(ORG_B), { budgetVersionId }, repositories.budgetVersionRepository);
    assertEqual(query.outcome, "not_found", "a version from another organização usuária must never be visible");
  });

  await runTest("traduz falha de persistência ao salvar Versão", async () => {
    const repositories: BudgetVersionServiceRepositories = {
      procurementCaseRepository: createFakeProcurementCaseRepository(),
      budgetVersionRepository: createFakeBudgetVersionRepository(),
    };

    const { budgetVersionId } = await seedWholeCaseDraft(contextFor(ORG_A), repositories);
    (repositories.budgetVersionRepository as FakeBudgetVersionRepository).setThrowOnSave(true);

    const result = await addBudgetLineService(
      contextFor(ORG_A),
      { budgetVersionId, kind: BudgetLineKind.Group, description: { status: "Confirmed", text: "Grupo" }, position: 0, scope: { kind: "WholeCase" } },
      repositories,
    );

    assertEqual(result.outcome, "persistence_failure");
  });

  await runTest(
    "concorrência: revisão antiga produz conflito explícito e a alteração mais recente permanece íntegra",
    async () => {
      // Cada operação do Serviço de Aplicação carrega a Versão, aplica o
      // domínio e salva numa única chamada — por construção, uma única
      // chamada nunca pode salvar sobre uma revisão que ela mesma não
      // acabou de carregar. A janela de corrida real (duas requisições
      // concorrentes que carregam a mesma revisão e disputam a gravação)
      // só existe na fronteira do repositório — exatamente o que este
      // teste exercita diretamente, com o mesmo contrato
      // (`loadBudgetVersion`/`saveBudgetVersion`) que o adaptador real
      // (Sprint 21.3C) implementará contra o banco.
      const budgetVersionRepository = createFakeBudgetVersionRepository();
      const procurementCaseRepository = createFakeProcurementCaseRepository();
      const repositories: BudgetVersionServiceRepositories = { procurementCaseRepository, budgetVersionRepository };

      const { budgetVersionId } = await seedWholeCaseDraft(contextFor(ORG_A), repositories);

      // Duas "cópias" da mesma Versão são carregadas na mesma revisão inicial.
      const firstCopy = await budgetVersionRepository.loadBudgetVersion(ORG_A, budgetVersionId);
      const secondCopy = await budgetVersionRepository.loadBudgetVersion(ORG_A, budgetVersionId);
      assertEqual(firstCopy !== null, true);
      assertEqual(secondCopy !== null, true);
      if (firstCopy === null || secondCopy === null) return;
      assertEqual(firstCopy.revision, secondCopy.revision);

      // A primeira cópia é alterada e salva com sucesso sobre a revisão carregada.
      const firstCopyModified: BudgetVersion = {
        ...firstCopy.entity,
        metadata: { ...firstCopy.entity.metadata, changedBy: "first-copy" },
      };
      const firstSave = await budgetVersionRepository.saveBudgetVersion(ORG_A, "engenheiro-de-custos", firstCopyModified, firstCopy.revision);
      assertEqual(firstSave.outcome, "saved");
      if (firstSave.outcome !== "saved") return;
      assertEqual(firstSave.revision, firstCopy.revision + 1);

      // A segunda cópia — carregada antes da alteração da primeira — tenta
      // salvar sobre a mesma revisão antiga e recebe um conflito explícito,
      // nunca uma sobrescrita silenciosa.
      const secondCopyModified: BudgetVersion = {
        ...secondCopy.entity,
        metadata: { ...secondCopy.entity.metadata, changedBy: "second-copy-stale" },
      };
      const staleSave = await budgetVersionRepository.saveBudgetVersion(ORG_A, "engenheiro-de-custos", secondCopyModified, secondCopy.revision);
      assertEqual(staleSave.outcome, "concurrency_conflict");

      // A alteração mais recente (da primeira cópia) permanece íntegra — a
      // tentativa em conflito nunca chegou a ser persistida, nem parcialmente.
      const reloaded = await budgetVersionRepository.loadBudgetVersion(ORG_A, budgetVersionId);
      assertEqual(reloaded !== null, true);
      if (reloaded === null) return;
      assertEqual(reloaded.revision, firstSave.revision);
      assertEqual(reloaded.entity.metadata.changedBy, "first-copy");

      // A camada de aplicação, por sua vez, traduz um conflito de
      // concorrência reportado pelo repositório em `concurrency_conflict`
      // explícito — nunca um erro genérico e nunca persistência parcial.
      const throwingRepository = createFakeBudgetVersionRepository();
      const conflictingRepositories: BudgetVersionServiceRepositories = {
        procurementCaseRepository: createFakeProcurementCaseRepository(),
        budgetVersionRepository: {
          ...throwingRepository,
          async saveBudgetVersion() {
            return { outcome: "concurrency_conflict" } as const;
          },
        },
      };
      const { budgetVersionId: secondVersionId } = await seedWholeCaseDraft(contextFor(ORG_A), conflictingRepositories);
      const serviceResult = await addBudgetLineService(
        contextFor(ORG_A),
        {
          budgetVersionId: secondVersionId,
          kind: BudgetLineKind.Group,
          description: { status: "Confirmed", text: "Grupo" },
          position: 0,
          scope: { kind: "WholeCase" },
        },
        conflictingRepositories,
      );
      assertEqual(serviceResult.outcome, "concurrency_conflict");
    },
  );
}

async function runTest(name: string, testCase: () => Promise<void>): Promise<void> {
  await testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "valores diferentes"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
