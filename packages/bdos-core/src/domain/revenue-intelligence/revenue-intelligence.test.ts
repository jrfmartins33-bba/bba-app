import { RecognitionStatus, type MeasuredRevenue } from "../revenue-recognition";
import {
  createRevenueInsight,
  RevenueAlertType,
  type RevenueInsight,
} from "./index";

runTest("empty portfolio", () => {
  const insight = createRevenueInsight([]);

  assertEqual(insight.totalRevenue, 0, "total revenue mismatch");
  assertEqual(insight.recognizedRevenue, 0, "recognized revenue mismatch");
  assertEqual(insight.contractCount, 0, "contract count mismatch");
  assertEqual(insight.projectCount, 0, "project count mismatch");
  assertEqual(insight.averageRevenue, 0, "average revenue mismatch");
  assertEqual(insight.largestContract, null, "largest contract mismatch");
  assertEqual(insight.concentrationIndex, 0, "concentration index mismatch");
  assertEqual(
    hasAlert(insight, RevenueAlertType.NoRevenue),
    true,
    "expected no revenue alert",
  );
});

runTest("one contract", () => {
  const insight = createRevenueInsight([
    createMeasuredRevenueFixture({
      id: "revenue-1",
      contractId: "contract-alpha",
      projectId: "project-dam",
      certifiedAmount: 1000,
    }),
  ]);

  assertEqual(insight.totalRevenue, 1000, "total revenue mismatch");
  assertEqual(insight.contractCount, 1, "contract count mismatch");
  assertEqual(insight.projectCount, 1, "project count mismatch");
  assertEqual(insight.averageRevenue, 1000, "average revenue mismatch");
  assertEqual(insight.largestContract?.id, "contract-alpha", "largest contract mismatch");
  assertEqual(
    insight.largestContractPercentage,
    1,
    "largest contract percentage mismatch",
  );
});

runTest("many contracts", () => {
  const insight = createRevenueInsight(createSmallContractPortfolio(), {
    smallContractCountThreshold: 5,
    smallContractMaxShare: 0.25,
  });

  assertEqual(insight.contractCount, 5, "contract count mismatch");
  assertEqual(insight.totalRevenue, 500, "total revenue mismatch");
  assertEqual(
    hasAlert(insight, RevenueAlertType.MultipleSmallContracts),
    true,
    "expected multiple small contracts alert",
  );
});

runTest("concentrated revenue", () => {
  const insight = createRevenueInsight([
    createMeasuredRevenueFixture({
      id: "revenue-1",
      contractId: "contract-dominant",
      projectId: "project-main",
      certifiedAmount: 900,
    }),
    createMeasuredRevenueFixture({
      id: "revenue-2",
      contractId: "contract-small",
      projectId: "project-side",
      certifiedAmount: 100,
    }),
  ]);

  assertEqual(insight.totalRevenue, 1000, "total revenue mismatch");
  assertEqual(
    insight.largestContract?.id,
    "contract-dominant",
    "largest contract mismatch",
  );
  assertEqual(
    insight.largestContractPercentage,
    0.9,
    "largest contract percentage mismatch",
  );
  assertEqual(
    hasAlert(insight, RevenueAlertType.HighSingleContractDependency),
    true,
    "expected high dependency alert",
  );
  assertEqual(
    hasAlert(insight, RevenueAlertType.RevenueConcentration),
    true,
    "expected concentration alert",
  );
});

runTest("diversified revenue", () => {
  const insight = createRevenueInsight([
    createMeasuredRevenueFixture({
      id: "revenue-1",
      contractId: "contract-a",
      projectId: "project-a",
      certifiedAmount: 250,
    }),
    createMeasuredRevenueFixture({
      id: "revenue-2",
      contractId: "contract-b",
      projectId: "project-b",
      certifiedAmount: 250,
    }),
    createMeasuredRevenueFixture({
      id: "revenue-3",
      contractId: "contract-c",
      projectId: "project-c",
      certifiedAmount: 250,
    }),
    createMeasuredRevenueFixture({
      id: "revenue-4",
      contractId: "contract-d",
      projectId: "project-d",
      certifiedAmount: 250,
    }),
  ]);

  assertEqual(insight.totalRevenue, 1000, "total revenue mismatch");
  assertEqual(insight.concentrationIndex, 0.25, "concentration index mismatch");
  assertEqual(
    hasAlert(insight, RevenueAlertType.RevenueConcentration),
    false,
    "unexpected concentration alert",
  );
  assertEqual(
    hasAlert(insight, RevenueAlertType.HighSingleContractDependency),
    false,
    "unexpected dependency alert",
  );
});

runTest("alert generation", () => {
  const insight = createRevenueInsight(createSmallContractPortfolio(), {
    lowRevenueThreshold: 150,
    smallContractCountThreshold: 5,
    smallContractMaxShare: 0.25,
  });

  assertEqual(hasAlert(insight, RevenueAlertType.LowRevenue), true, "expected low revenue");
  assertEqual(
    hasAlert(insight, RevenueAlertType.MultipleSmallContracts),
    true,
    "expected small contracts alert",
  );
});

runTest("deterministic output", () => {
  const revenues = [
    createMeasuredRevenueFixture({
      id: "revenue-1",
      contractId: "contract-a",
      projectId: "project-a",
      certifiedAmount: 700,
    }),
    createMeasuredRevenueFixture({
      id: "revenue-2",
      contractId: "contract-b",
      projectId: "project-b",
      certifiedAmount: 300,
    }),
  ];
  const options = {
    lowRevenueThreshold: 400,
    metadata: {
      source: "executive-revenue-review",
    },
  };

  const first = JSON.stringify(createRevenueInsight(revenues, options));
  const second = JSON.stringify(createRevenueInsight(revenues, options));

  assertEqual(first, second, "expected deterministic output");
});

runTest("immutability", () => {
  const insight = createRevenueInsight([
    createMeasuredRevenueFixture({
      id: "revenue-1",
      contractId: "contract-alpha",
      projectId: "project-alpha",
      certifiedAmount: 1000,
    }),
  ]);

  assertEqual(Object.isFrozen(insight), true, "insight should be frozen");
  assertEqual(Object.isFrozen(insight.alerts), true, "alerts should be frozen");
  assertEqual(
    Object.isFrozen(insight.revenuePerContract),
    true,
    "contract breakdown should be frozen",
  );
  assertEqual(
    Object.isFrozen(insight.revenuePerContract[0]),
    true,
    "contract item should be frozen",
  );
  assertEqual(Object.isFrozen(insight.metadata), true, "metadata should be frozen");
});

runTest("traceability", () => {
  const insight = createRevenueInsight(
    [
      createMeasuredRevenueFixture({
        id: "revenue-1",
        contractId: "contract-alpha",
        projectId: "project-dam",
        certifiedAmount: 600,
      }),
      createMeasuredRevenueFixture({
        id: "revenue-2",
        contractId: "contract-alpha",
        projectId: "project-dam",
        certifiedAmount: 400,
      }),
    ],
    {
      metadata: {
        correlationId: "revenue-intelligence-1",
      },
    },
  );

  assertEqual(
    JSON.stringify(insight.metadata["recognizedRevenueIds"]),
    JSON.stringify(["revenue-1", "revenue-2"]),
    "recognized revenue ids mismatch",
  );
  assertEqual(
    JSON.stringify(insight.metadata["contractIds"]),
    JSON.stringify(["contract-alpha"]),
    "contract ids mismatch",
  );
  assertEqual(
    JSON.stringify(insight.largestContract?.revenueIds),
    JSON.stringify(["revenue-1", "revenue-2"]),
    "largest contract revenue ids mismatch",
  );
  assertEqual(
    insight.metadata["correlationId"],
    "revenue-intelligence-1",
    "correlation id mismatch",
  );
});

runTest("ignores non-recognized revenue signals", () => {
  const insight = createRevenueInsight([
    createMeasuredRevenueFixture({
      id: "revenue-1",
      contractId: "contract-alpha",
      projectId: "project-alpha",
      certifiedAmount: 1000,
      recognitionStatus: RecognitionStatus.PendingCertification,
    }),
  ]);

  assertEqual(insight.totalRevenue, 0, "total revenue mismatch");
  assertEqual(
    hasAlert(insight, RevenueAlertType.NoRevenue),
    true,
    "expected no revenue alert",
  );
});

function createSmallContractPortfolio(): ReadonlyArray<MeasuredRevenue> {
  return [1, 2, 3, 4, 5].map((item) =>
    createMeasuredRevenueFixture({
      id: `revenue-${item}`,
      contractId: `contract-${item}`,
      projectId: `project-${item}`,
      certifiedAmount: 100,
    }),
  );
}

function createMeasuredRevenueFixture(
  overrides: Partial<MeasuredRevenue>,
): MeasuredRevenue {
  const id = overrides.id ?? "revenue-1";
  const contractId = overrides.contractId ?? "contract-alpha";
  const projectId = overrides.projectId ?? "project-alpha";
  const certifiedAmount = overrides.certifiedAmount ?? 1000;

  return {
    id,
    measurementCycleId: overrides.measurementCycleId ?? `cycle-${id}`,
    contractId,
    projectId,
    periodId: overrides.periodId ?? "period-8",
    bulletinId: overrides.bulletinId ?? `bulletin-${id}`,
    certificationId: overrides.certificationId ?? `certification-${id}`,
    revenueDate: overrides.revenueDate ?? "2026-07-03",
    grossAmount: overrides.grossAmount ?? certifiedAmount,
    certifiedAmount,
    recognitionStatus: overrides.recognitionStatus ?? RecognitionStatus.Recognized,
    source: overrides.source ?? "certified_measurement_cycle",
    metadata: overrides.metadata ?? {
      correlationId: `correlation-${id}`,
      contractId,
      projectId,
    },
  };
}

function hasAlert(insight: RevenueInsight, type: RevenueAlertType): boolean {
  return insight.alerts.some((alert) => alert.type === type);
}

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
