import type { ContractBaselineId } from "../measurement";
import type { MeasurementProjectId } from "../measurement-workflow";
import type {
  MeasuredRevenue,
  MeasuredRevenueId,
} from "../revenue-recognition";
import { RecognitionStatus } from "../revenue-recognition";
import type {
  RevenueAlert,
  RevenueBreakdownItem,
  RevenueInsight,
  RevenueIntelligenceMetadata,
  RevenueIntelligenceOptions,
} from "./revenue-intelligence.types";
import { RevenueAlertType } from "./revenue-intelligence.types";

const DEFAULT_LOW_REVENUE_THRESHOLD = 0;
const DEFAULT_SMALL_CONTRACT_COUNT_THRESHOLD = 5;
const DEFAULT_SMALL_CONTRACT_MAX_SHARE = 0.25;
const DEFAULT_TOP_REVENUE_CONTRACTS_LIMIT = 5;
const HIGH_SINGLE_CONTRACT_DEPENDENCY_THRESHOLD = 0.6;
const REVENUE_CONCENTRATION_THRESHOLD = 0.7;

export function createRevenueInsight(
  measuredRevenues: ReadonlyArray<MeasuredRevenue>,
  options: RevenueIntelligenceOptions = {},
): RevenueInsight {
  const recognizedRevenues = measuredRevenues.filter(
    (revenue) => revenue.recognitionStatus === RecognitionStatus.Recognized,
  );
  const totalRevenue = sumRevenue(recognizedRevenues);
  const revenuePerContract = createRevenueBreakdown(
    recognizedRevenues,
    totalRevenue,
    "contract",
  );
  const revenuePerProject = createRevenueBreakdown(
    recognizedRevenues,
    totalRevenue,
    "project",
  );
  const largestContract = revenuePerContract[0] ?? null;
  const largestProject = revenuePerProject[0] ?? null;
  const contractCount = revenuePerContract.length;
  const projectCount = revenuePerProject.length;
  const averageRevenue = contractCount === 0 ? 0 : totalRevenue / contractCount;
  const concentrationIndex = calculateConcentrationIndex(revenuePerContract);
  const metadata = createInsightMetadata(
    measuredRevenues,
    recognizedRevenues,
    options,
  );

  const insight: RevenueInsight = {
    totalRevenue,
    recognizedRevenue: totalRevenue,
    contractCount,
    projectCount,
    averageRevenue,
    largestContract,
    largestProject,
    largestContractPercentage: largestContract?.percentage ?? 0,
    largestProjectPercentage: largestProject?.percentage ?? 0,
    concentrationIndex,
    revenuePerContract,
    revenuePerProject,
    topRevenueContracts: revenuePerContract.slice(
      0,
      options.topRevenueContractsLimit ?? DEFAULT_TOP_REVENUE_CONTRACTS_LIMIT,
    ),
    alerts: createRevenueAlerts({
      totalRevenue,
      averageRevenue,
      largestContract,
      concentrationIndex,
      contractCount,
      options,
    }),
    metadata,
  };

  return freezeDomainObject(insight);
}

type RevenueBreakdownKind = "contract" | "project";

interface RevenueAlertContext {
  readonly totalRevenue: number;
  readonly averageRevenue: number;
  readonly largestContract: RevenueBreakdownItem | null;
  readonly concentrationIndex: number;
  readonly contractCount: number;
  readonly options: RevenueIntelligenceOptions;
}

interface RevenueGroup {
  readonly id: ContractBaselineId | MeasurementProjectId;
  readonly revenue: number;
  readonly revenueIds: ReadonlyArray<MeasuredRevenueId>;
}

function createRevenueBreakdown(
  revenues: ReadonlyArray<MeasuredRevenue>,
  totalRevenue: number,
  kind: RevenueBreakdownKind,
): ReadonlyArray<RevenueBreakdownItem> {
  const groups = new Map<string, RevenueGroup>();

  revenues.forEach((revenue) => {
    const id = kind === "contract" ? revenue.contractId : revenue.projectId;
    const current = groups.get(id);
    const revenueIds = current?.revenueIds ?? [];

    groups.set(id, {
      id,
      revenue: (current?.revenue ?? 0) + revenue.certifiedAmount,
      revenueIds: [...revenueIds, revenue.id],
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      id: group.id,
      revenue: group.revenue,
      percentage: totalRevenue === 0 ? 0 : group.revenue / totalRevenue,
      revenueIds: [...group.revenueIds].sort(),
      metadata: {
        kind,
        revenueIds: [...group.revenueIds].sort(),
      },
    }))
    .sort((first, second) => {
      if (second.revenue !== first.revenue) {
        return second.revenue - first.revenue;
      }

      return String(first.id).localeCompare(String(second.id));
    });
}

function createRevenueAlerts(context: RevenueAlertContext): ReadonlyArray<RevenueAlert> {
  const alerts: RevenueAlert[] = [];
  const lowRevenueThreshold =
    context.options.lowRevenueThreshold ?? DEFAULT_LOW_REVENUE_THRESHOLD;
  const smallContractCountThreshold =
    context.options.smallContractCountThreshold ??
    DEFAULT_SMALL_CONTRACT_COUNT_THRESHOLD;
  const smallContractMaxShare =
    context.options.smallContractMaxShare ?? DEFAULT_SMALL_CONTRACT_MAX_SHARE;

  if (context.totalRevenue === 0) {
    alerts.push(
      createRevenueAlert(
        RevenueAlertType.NoRevenue,
        "critical",
        "No recognized contractual revenue was found.",
        {
          totalRevenue: context.totalRevenue,
        },
      ),
    );
  }

  if (context.largestContract !== null) {
    if (
      context.largestContract.percentage >
      HIGH_SINGLE_CONTRACT_DEPENDENCY_THRESHOLD
    ) {
      alerts.push(
        createRevenueAlert(
          RevenueAlertType.HighSingleContractDependency,
          "critical",
          "A single contract represents more than 60% of recognized revenue.",
          {
            contractId: context.largestContract.id,
            percentage: context.largestContract.percentage,
            revenueIds: context.largestContract.revenueIds,
          },
        ),
      );
    }

    if (context.concentrationIndex > REVENUE_CONCENTRATION_THRESHOLD) {
      alerts.push(
        createRevenueAlert(
          RevenueAlertType.RevenueConcentration,
          "warning",
          "Recognized revenue is concentrated in a small portion of the contract portfolio.",
          {
            concentrationIndex: context.concentrationIndex,
          },
        ),
      );
    }

    if (
      context.contractCount >= smallContractCountThreshold &&
      context.largestContract.percentage <= smallContractMaxShare
    ) {
      alerts.push(
        createRevenueAlert(
          RevenueAlertType.MultipleSmallContracts,
          "info",
          "Recognized revenue is spread across many small contracts.",
          {
            contractCount: context.contractCount,
            largestContractPercentage: context.largestContract.percentage,
          },
        ),
      );
    }
  }

  if (
    lowRevenueThreshold > 0 &&
    context.averageRevenue > 0 &&
    context.averageRevenue < lowRevenueThreshold
  ) {
    alerts.push(
      createRevenueAlert(
        RevenueAlertType.LowRevenue,
        "warning",
        "Average recognized revenue is below the configured threshold.",
        {
          averageRevenue: context.averageRevenue,
          lowRevenueThreshold,
        },
      ),
    );
  }

  return alerts;
}

function createRevenueAlert(
  type: RevenueAlertType,
  severity: RevenueAlert["severity"],
  message: string,
  metadata: RevenueIntelligenceMetadata,
): RevenueAlert {
  return {
    type,
    severity,
    message,
    metadata,
  };
}

function sumRevenue(revenues: ReadonlyArray<MeasuredRevenue>): number {
  return revenues.reduce(
    (total, revenue) => total + revenue.certifiedAmount,
    0,
  );
}

function calculateConcentrationIndex(
  revenuePerContract: ReadonlyArray<RevenueBreakdownItem>,
): number {
  return revenuePerContract.reduce(
    (total, contract) => total + contract.percentage * contract.percentage,
    0,
  );
}

function createInsightMetadata(
  measuredRevenues: ReadonlyArray<MeasuredRevenue>,
  recognizedRevenues: ReadonlyArray<MeasuredRevenue>,
  options: RevenueIntelligenceOptions,
): RevenueIntelligenceMetadata {
  return {
    ...(options.metadata ?? {}),
    measuredRevenueIds: measuredRevenues.map((revenue) => revenue.id).sort(),
    recognizedRevenueIds: recognizedRevenues.map((revenue) => revenue.id).sort(),
    contractIds: uniqueSorted(
      recognizedRevenues.map((revenue) => revenue.contractId),
    ),
    projectIds: uniqueSorted(recognizedRevenues.map((revenue) => revenue.projectId)),
    lowRevenueThreshold:
      options.lowRevenueThreshold ?? DEFAULT_LOW_REVENUE_THRESHOLD,
    smallContractCountThreshold:
      options.smallContractCountThreshold ??
      DEFAULT_SMALL_CONTRACT_COUNT_THRESHOLD,
    smallContractMaxShare:
      options.smallContractMaxShare ?? DEFAULT_SMALL_CONTRACT_MAX_SHARE,
  };
}

function uniqueSorted(values: ReadonlyArray<string>): ReadonlyArray<string> {
  return Array.from(new Set(values)).sort();
}

type FreezableRecord = Record<PropertyKey, unknown>;

function freezeDomainObject<T>(value: T): T {
  return freezeClonedDomainObject(cloneDomainValue(value));
}

function cloneDomainValue<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneDomainValue(item)) as T;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, property]) => [
      key,
      cloneDomainValue(property),
    ]),
  ) as T;
}

function freezeClonedDomainObject<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  Object.values(value as FreezableRecord).forEach((property) => {
    freezeClonedDomainObject(property);
  });

  return Object.freeze(value);
}
