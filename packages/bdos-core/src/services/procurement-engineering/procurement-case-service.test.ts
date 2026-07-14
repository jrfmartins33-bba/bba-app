import { createProcurementCaseService, registerProcurementLotService } from "./procurement-case-service";
import type { ApplicationContext } from "./application-context";
import type { ProcurementCaseRepository } from "./procurement-case.repository";
import type { ProcurementCase, ProcurementLot } from "../../domain/procurement-case";

// Sprint 21.3C — testes de coordenação dos Serviços de Aplicação de
// Processo/Lote contra um repositório falso em memória. Não reimplementa os
// testes de domínio já cobertos em procurement-case.test.ts (Sprint 21.3B)
// — cobre apenas o que esta camada acrescenta: contexto/organização, busca
// de Processo, e tradução de falha de persistência.

const ORG_A = "organization-alpha";
const ORG_B = "organization-beta";

function contextFor(organizationId: string): ApplicationContext {
  return { organizationId, actor: "engenheiro-de-custos", correlationId: "corr-1", sourceSystem: "bdos-core-test" };
}

interface FakeProcurementCaseRepository extends ProcurementCaseRepository {
  setThrowOnCreateCase(shouldThrow: boolean): void;
  setThrowOnCreateLot(shouldThrow: boolean): void;
}

function createFakeRepository(): FakeProcurementCaseRepository {
  const cases = new Map<string, ProcurementCase>();
  const lots = new Map<string, ProcurementLot>();
  let throwOnCreateCase = false;
  let throwOnCreateLot = false;

  return {
    setThrowOnCreateCase(shouldThrow: boolean): void {
      throwOnCreateCase = shouldThrow;
    },
    setThrowOnCreateLot(shouldThrow: boolean): void {
      throwOnCreateLot = shouldThrow;
    },
    async createProcurementCase(organizationId, procurementCase) {
      if (throwOnCreateCase) {
        throw new Error("simulated persistence failure");
      }
      cases.set(`${organizationId}:${procurementCase.id}`, procurementCase);
      return procurementCase;
    },
    async findProcurementCaseById(organizationId, id) {
      return cases.get(`${organizationId}:${id}`) ?? null;
    },
    async createProcurementLot(organizationId, procurementLot) {
      if (throwOnCreateLot) {
        throw new Error("simulated persistence failure");
      }
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

async function main(): Promise<void> {
  await runTest("cria Processo e persiste na organização do contexto", async () => {
    const repository = createFakeRepository();
    const result = await createProcurementCaseService(
      contextFor(ORG_A),
      { title: "Barragem Lagoa do Arroz — Pregão Eletrônico 90006/2025", externalReference: "pregao-90006-2025" },
      repository,
    );

    assertEqual(result.outcome, "created");
    if (result.outcome !== "created") return;
    assertEqual(result.procurementCase.organizationId, ORG_A, "must use the context's organizationId, never a caller-supplied one");
    assertEqual(result.procurementCase.title, "Barragem Lagoa do Arroz — Pregão Eletrônico 90006/2025");

    const reloaded = await repository.findProcurementCaseById(ORG_A, result.procurementCase.id);
    assertEqual(reloaded?.id, result.procurementCase.id, "the created case must be retrievable from the same organization");
  });

  await runTest("comando não possui campo organizationId — organização vem sempre do contexto", async () => {
    const repository = createFakeRepository();
    const commandWithoutOrganizationId: { title: string } = { title: "Processo sem organizationId no comando" };
    const result = await createProcurementCaseService(contextFor(ORG_A), commandWithoutOrganizationId, repository);

    assertEqual(result.outcome, "created");
    if (result.outcome !== "created") return;
    assertEqual(result.procurementCase.organizationId, ORG_A);
  });

  await runTest("propaga erro de domínio (título ausente) sem reescrever a semântica", async () => {
    const repository = createFakeRepository();
    const result = await createProcurementCaseService(contextFor(ORG_A), { title: "" }, repository);

    assertEqual(result.outcome, "domain_error");
    if (result.outcome !== "domain_error") return;
    assertEqual(result.errors[0]?.code, "missing_title");
  });

  await runTest("traduz falha de persistência ao criar Processo", async () => {
    const repository = createFakeRepository();
    repository.setThrowOnCreateCase(true);
    const result = await createProcurementCaseService(contextFor(ORG_A), { title: "Processo qualquer" }, repository);

    assertEqual(result.outcome, "persistence_failure");
  });

  await runTest("registra Lote após carregar o Processo na organização correta", async () => {
    const repository = createFakeRepository();
    const created = await createProcurementCaseService(contextFor(ORG_A), { title: "Processo com lote" }, repository);
    assertEqual(created.outcome, "created");
    if (created.outcome !== "created") return;

    const result = await registerProcurementLotService(
      contextFor(ORG_A),
      { procurementCaseId: created.procurementCase.id, title: "Lote único" },
      repository,
    );

    assertEqual(result.outcome, "created");
    if (result.outcome !== "created") return;
    assertEqual(result.procurementLot.organizationId, ORG_A);
    assertEqual(result.procurementLot.procurementCaseId, created.procurementCase.id);
  });

  await runTest("rejeita registrar Lote para Processo inexistente", async () => {
    const repository = createFakeRepository();
    const result = await registerProcurementLotService(
      contextFor(ORG_A),
      { procurementCaseId: "case-inexistente", title: "Lote órfão" },
      repository,
    );

    assertEqual(result.outcome, "procurement_case_not_found");
  });

  await runTest("rejeita registrar Lote para Processo de outra organização usuária — comporta-se como inexistente", async () => {
    const repository = createFakeRepository();
    const created = await createProcurementCaseService(contextFor(ORG_A), { title: "Processo da organização A" }, repository);
    assertEqual(created.outcome, "created");
    if (created.outcome !== "created") return;

    const result = await registerProcurementLotService(
      contextFor(ORG_B),
      { procurementCaseId: created.procurementCase.id, title: "Tentativa de lote cruzando organizações" },
      repository,
    );

    assertEqual(result.outcome, "procurement_case_not_found", "a case from another organização usuária must be indistinguishable from a missing one");
  });

  await runTest("propaga erro de domínio ao registrar Lote (título ausente)", async () => {
    const repository = createFakeRepository();
    const created = await createProcurementCaseService(contextFor(ORG_A), { title: "Processo" }, repository);
    assertEqual(created.outcome, "created");
    if (created.outcome !== "created") return;

    const result = await registerProcurementLotService(
      contextFor(ORG_A),
      { procurementCaseId: created.procurementCase.id, title: "" },
      repository,
    );

    assertEqual(result.outcome, "domain_error");
    if (result.outcome !== "domain_error") return;
    assertEqual(result.errors[0]?.code, "missing_title");
  });

  await runTest("traduz falha de persistência ao registrar Lote", async () => {
    const repository = createFakeRepository();
    const created = await createProcurementCaseService(contextFor(ORG_A), { title: "Processo" }, repository);
    assertEqual(created.outcome, "created");
    if (created.outcome !== "created") return;

    repository.setThrowOnCreateLot(true);
    const result = await registerProcurementLotService(
      contextFor(ORG_A),
      { procurementCaseId: created.procurementCase.id, title: "Lote qualquer" },
      repository,
    );

    assertEqual(result.outcome, "persistence_failure");
  });
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
