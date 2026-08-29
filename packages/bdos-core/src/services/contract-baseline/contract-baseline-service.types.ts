import type { ContractBaseline } from "../../domain/contract-baseline";
import type { Consortium } from "../../domain/consortium";
import type { ProjectCostCenter } from "../../domain/cost-center";

export interface ProjectContractualFoundationDto {
  readonly projectId: string;
  readonly baseline: ContractBaseline | null;
  readonly consortium: Consortium | null;
  readonly costCenters: ReadonlyArray<ProjectCostCenter>;
  readonly formattedSummary: {
    readonly contractedValue: string | null;
    readonly derivedItemsTotal: string | null;
    readonly roundingAdjustment: string | null;
    readonly historicalOfficialBudget: string | null;
    readonly consortiumName: string | null;
    readonly members: ReadonlyArray<{
      readonly memberId: string;
      readonly partyName: string;
      readonly partyTradeName: string | null;
      readonly sharePercentage: string;
      readonly isLeader: boolean;
      readonly costCenter: {
        readonly id: string;
        readonly code: string;
        readonly name: string;
      } | null;
    }>;
  };
}
