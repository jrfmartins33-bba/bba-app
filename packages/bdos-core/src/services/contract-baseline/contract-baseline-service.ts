import type {
  ContractBaselineRepository,
  ConsortiumRepository,
  CostCenterRepository,
} from "./contract-baseline.repository";
import type { ProjectContractualFoundationDto } from "./contract-baseline-service.types";
import {
  formatContractedValuePtBr,
  formatDerivedItemsTotalPtBr,
  formatHistoricalOfficialBudgetPtBr,
  formatRoundingAdjustmentPtBr,
} from "../../domain/contract-baseline";
import { formatSharePercentagePtBr } from "../../domain/consortium";

export async function getProjectContractualFoundationService(
  organizationId: string,
  projectId: string,
  repositories: {
    readonly baselineRepository: ContractBaselineRepository;
    readonly consortiumRepository: ConsortiumRepository;
    readonly costCenterRepository: CostCenterRepository;
  },
): Promise<ProjectContractualFoundationDto> {
  const [baseline, costCenters] = await Promise.all([
    repositories.baselineRepository.findContractBaselineByProject(organizationId, projectId),
    repositories.costCenterRepository.listCostCentersByProject(organizationId, projectId),
  ]);

  const consortium = baseline?.consortiumId
    ? await repositories.consortiumRepository.findConsortiumById(organizationId, baseline.consortiumId)
    : null;

  const costCentersByMemberId = new Map<string, (typeof costCenters)[0]>();
  for (const cc of costCenters) {
    if (cc.consortiumMemberId) {
      costCentersByMemberId.set(cc.consortiumMemberId, cc);
    }
  }

  const members = (consortium?.members ?? []).map((m) => {
    const cc = costCentersByMemberId.get(m.id);
    return {
      memberId: m.id,
      partyName: m.partyNameSnapshot,
      partyTradeName: m.partyTradeNameSnapshot,
      sharePercentage: formatSharePercentagePtBr(m.shareBasisPoints),
      isLeader: m.isLeader,
      costCenter: cc
        ? {
            id: cc.id,
            code: cc.code,
            name: cc.name,
          }
        : null,
    };
  });

  return {
    projectId,
    baseline,
    consortium,
    costCenters,
    formattedSummary: {
      contractedValue: baseline ? formatContractedValuePtBr(baseline) : null,
      derivedItemsTotal: baseline ? formatDerivedItemsTotalPtBr(baseline) : null,
      roundingAdjustment: baseline ? formatRoundingAdjustmentPtBr(baseline) : null,
      historicalOfficialBudget: baseline ? formatHistoricalOfficialBudgetPtBr(baseline) : null,
      consortiumName: consortium?.legalName ?? baseline?.contractorNameSnapshot ?? null,
      members,
    },
  };
}
