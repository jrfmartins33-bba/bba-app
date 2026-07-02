import type {
  ContractBaselineId,
  MeasurementMetadata,
} from "../measurement";
import type { MeasurementProjectId } from "../measurement-workflow";
import type { MeasuredRevenueId } from "../revenue-recognition";

export type RevenueIntelligenceMetadata = MeasurementMetadata;

export enum RevenueAlertType {
  LowRevenue = "LOW_REVENUE",
  RevenueConcentration = "REVENUE_CONCENTRATION",
  NoRevenue = "NO_REVENUE",
  HighSingleContractDependency = "HIGH_SINGLE_CONTRACT_DEPENDENCY",
  MultipleSmallContracts = "MULTIPLE_SMALL_CONTRACTS",
}

export type RevenueAlertSeverity = "info" | "warning" | "critical";

export interface RevenueAlert {
  readonly type: RevenueAlertType;
  readonly severity: RevenueAlertSeverity;
  readonly message: string;
  readonly metadata: RevenueIntelligenceMetadata;
}

export interface RevenueBreakdownItem {
  readonly id: ContractBaselineId | MeasurementProjectId;
  readonly revenue: number;
  readonly percentage: number;
  readonly revenueIds: ReadonlyArray<MeasuredRevenueId>;
  readonly metadata: RevenueIntelligenceMetadata;
}

export interface RevenueInsight {
  readonly totalRevenue: number;
  readonly recognizedRevenue: number;
  readonly contractCount: number;
  readonly projectCount: number;
  readonly averageRevenue: number;
  readonly largestContract: RevenueBreakdownItem | null;
  readonly largestProject: RevenueBreakdownItem | null;
  readonly largestContractPercentage: number;
  readonly largestProjectPercentage: number;
  readonly concentrationIndex: number;
  readonly revenuePerContract: ReadonlyArray<RevenueBreakdownItem>;
  readonly revenuePerProject: ReadonlyArray<RevenueBreakdownItem>;
  readonly topRevenueContracts: ReadonlyArray<RevenueBreakdownItem>;
  readonly alerts: ReadonlyArray<RevenueAlert>;
  readonly metadata: RevenueIntelligenceMetadata;
}

export interface RevenueIntelligenceOptions {
  readonly lowRevenueThreshold?: number;
  readonly smallContractCountThreshold?: number;
  readonly smallContractMaxShare?: number;
  readonly topRevenueContractsLimit?: number;
  readonly metadata?: RevenueIntelligenceMetadata;
}
