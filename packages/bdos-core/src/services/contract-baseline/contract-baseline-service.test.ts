import { getProjectContractualFoundationService } from "./contract-baseline-service";
import { createContractBaseline, ContractBaselineStatus } from "../../domain/contract-baseline";
import { createConsortium, ConsortiumCompositionStatus } from "../../domain/consortium";
import { createProjectCostCenter } from "../../domain/cost-center";
import type {
  ContractBaselineRepository,
  ConsortiumRepository,
  CostCenterRepository,
} from "./contract-baseline.repository";

function runTest(name: string, fn: () => Promise<void> | void): Promise<void> {
  return Promise.resolve(fn()).then(() => {
    console.log(`ok - ${name}`);
  });
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function main() {
  await runTest("serviço de fundação contratual retorna visão unificada da Lagoa do Arroz com consórcio e centros de custo", async () => {
    const orgId = "a0904068-2a24-4120-aef0-c9db670ba7b7";
    const projId = "proj-lagoa-do-arroz";
    const consortiumId = "consortium-lagoa";

    const baseline = createContractBaseline({
      id: "baseline-lagoa",
      organizationId: orgId,
      engineeringProjectId: projId,
      procurementCaseId: "proc-lagoa",
      contractNumber: "Contrato nº 22/2025",
      contractorNameSnapshot: "CONSÓRCIO CONJASF-HIDROMEC LAGOA DO ARROZ/PB",
      consortiumId,
      sourceBudgetVersionId: null,
      status: ContractBaselineStatus.InExecution,
      contractedValueCents: 761185165,
      derivedItemsTotalDecimal: "7611852.11454550",
      contractualRoundingAdjustmentDecimal: "-0.46454550",
      historicalOfficialBudgetCents: 980908718,
    });

    const consortium = createConsortium({
      id: consortiumId,
      organizationId: orgId,
      legalName: "CONSÓRCIO CONJASF-HIDROMEC LAGOA DO ARROZ/PB",
      tradeName: "CONSÓRCIO CONJASF-HIDROMEC",
      compositionStatus: ConsortiumCompositionStatus.Consolidated,
      members: [
        { id: "mem-conjasf", partyNameSnapshot: "CONJASF", partyTradeNameSnapshot: "CONJASF", shareBasisPoints: 5000, isLeader: true },
        { id: "mem-hidromec", partyNameSnapshot: "HIDROMEC", partyTradeNameSnapshot: "HIDROMEC", shareBasisPoints: 5000, isLeader: false },
      ],
    });

    const costCenters = [
      createProjectCostCenter({
        id: "cc-conjasf",
        organizationId: orgId,
        engineeringProjectId: projId,
        consortiumMemberId: "mem-conjasf",
        code: "CC-LAGOA-CONJASF",
        name: "Centro de Custo CONJASF — Lagoa do Arroz",
      }),
      createProjectCostCenter({
        id: "cc-hidromec",
        organizationId: orgId,
        engineeringProjectId: projId,
        consortiumMemberId: "mem-hidromec",
        code: "CC-LAGOA-HIDROMEC",
        name: "Centro de Custo HIDROMEC — Lagoa do Arroz",
      }),
    ];

    const mockBaselineRepo: ContractBaselineRepository = {
      saveContractBaseline: async () => baseline,
      findContractBaselineById: async () => baseline,
      findContractBaselineByProject: async () => baseline,
    };

    const mockConsortiumRepo: ConsortiumRepository = {
      saveConsortium: async () => consortium,
      findConsortiumById: async () => consortium,
    };

    const mockCostCenterRepo: CostCenterRepository = {
      saveCostCenter: async (_, __, cc) => cc,
      listCostCentersByProject: async () => costCenters,
      findCostCenterById: async (_, id) => costCenters.find((c) => c.id === id) ?? null,
    };

    const foundation = await getProjectContractualFoundationService(orgId, projId, {
      baselineRepository: mockBaselineRepo,
      consortiumRepository: mockConsortiumRepo,
      costCenterRepository: mockCostCenterRepo,
    });

    assert(foundation.baseline !== null, "baseline deve estar presente");
    assert(foundation.consortium !== null, "consórcio deve estar presente");
    assert(foundation.costCenters.length === 2, "deve ter 2 centros de custo");

    assert(foundation.formattedSummary.contractedValue?.includes("7.611.851,65") === true, "valor contratado formatado");
    assert(foundation.formattedSummary.derivedItemsTotal?.includes("7.611.852,11") === true, "soma dos itens formatada");
    assert(foundation.formattedSummary.roundingAdjustment?.includes("0,46") === true, "ajuste de arredondamento formatado");
    assert(foundation.formattedSummary.historicalOfficialBudget?.includes("9.809.087,18") === true, "orçamento oficial histórico formatado");

    assert(foundation.formattedSummary.members.length === 2, "deve ter 2 membros no resumo");
    assert(foundation.formattedSummary.members[0].partyName === "CONJASF", "nome do membro 0");
    assert(foundation.formattedSummary.members[0].costCenter?.code === "CC-LAGOA-CONJASF", "centro de custo do membro 0");
    assert(foundation.formattedSummary.members[1].costCenter?.code === "CC-LAGOA-HIDROMEC", "centro de custo do membro 1");
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
