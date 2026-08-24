import { MeasurementCycleStatus } from "../measurement-workflow";
import {
  MeasurementDecimalQuantizationMode,
  buildCertifiedMeasurementItemAggregate,
  calculateMeasurementLineValue,
  canonicalizeMeasurementDecimal,
  createMeasurementMonetaryPolicy,
  preserveMeasurementSourceDecimal,
  resolveMeasurementProjectAuthority,
  validateMeasurementWorkspaceLineCardinality,
  validateMeasurementWorkspaceLineScope,
} from "./index";

runTest("preserves the existing direct workspace-line to operational-item scope", () => {
  const result = validateMeasurementWorkspaceLineScope({
    workspace: { organizationId: "organization-a", projectId: "project-a" },
    operationalItem: { organizationId: "organization-a", projectId: "project-a" },
  });

  assertEqual(result.valid, true, "same-scope relationship should remain valid");
  assertEqual(result.errors.length, 0, "same-scope relationship should have no errors");
});

runTest("rejects cross-project workspace-line relationships", () => {
  const result = validateMeasurementWorkspaceLineScope({
    workspace: { organizationId: "organization-a", projectId: "project-a" },
    operationalItem: { organizationId: "organization-a", projectId: "project-b" },
  });

  assertEqual(result.valid, false, "cross-project relationship must fail");
  assertEqual(result.errors.join(","), "project_mismatch", "project mismatch missing");
});

runTest("rejects cross-organization workspace-line relationships", () => {
  const result = validateMeasurementWorkspaceLineScope({
    workspace: { organizationId: "organization-a", projectId: "project-a" },
    operationalItem: { organizationId: "organization-b", projectId: "project-a" },
  });

  assertEqual(result.valid, false, "cross-organization relationship must fail");
  assertEqual(
    result.errors.join(","),
    "organization_mismatch",
    "organization mismatch missing",
  );
});

runTest("allows one operational item in multiple measurement periods", () => {
  const result = validateMeasurementWorkspaceLineCardinality([
    { workspaceId: "period-1", operationalItemId: "item-1" },
    { workspaceId: "period-2", operationalItemId: "item-1" },
  ]);

  assertEqual(result.valid, true, "same item in distinct workspaces should be valid");
});

runTest("rejects duplicate operational item inside one workspace", () => {
  const result = validateMeasurementWorkspaceLineCardinality([
    { workspaceId: "period-1", operationalItemId: "item-1" },
    { workspaceId: "period-1", operationalItemId: "item-1" },
  ]);

  assertEqual(result.valid, false, "duplicate workspace/item pair must fail");
  assertEqual(result.duplicatePairs.length, 1, "duplicate pair should be reported once");
});

runTest("official accumulated values ignore provisional workflow states", () => {
  const aggregate = buildCertifiedMeasurementItemAggregate({
    targetPeriodId: "period-2",
    contractQuantity: "100.0000",
    contractedValue: "10000.00",
    quantityScale: 4,
    moneyScale: 2,
    contributions: [
      {
        periodId: "period-2",
        cycleStatus: MeasurementCycleStatus.BulletinGenerated,
        quantity: "12.5000",
        value: "1250.00",
      },
    ],
  });

  assertEqual(aggregate.measuredPeriodQuantity, "12.5000", "period quantity mismatch");
  assertEqual(
    aggregate.certifiedAccumulatedQuantity,
    "0.0000",
    "provisional quantity entered official accumulated",
  );
  assertEqual(
    aggregate.certifiedAccumulatedValue,
    "0.00",
    "provisional value entered official accumulated",
  );
});

runTest("official accumulated values include only Certified and Closed states", () => {
  const aggregate = buildCertifiedMeasurementItemAggregate({
    targetPeriodId: "period-3",
    contractQuantity: "100.0000",
    contractedValue: "10000.00",
    quantityScale: 4,
    moneyScale: 2,
    contributions: [
      { periodId: "period-1", cycleStatus: MeasurementCycleStatus.Measured, quantity: "5", value: "500" },
      { periodId: "period-2", cycleStatus: MeasurementCycleStatus.Certified, quantity: "10", value: "1000" },
      { periodId: "period-3", cycleStatus: MeasurementCycleStatus.Closed, quantity: "20", value: "2000" },
      { periodId: "period-3", cycleStatus: null, quantity: "3", value: "300" },
    ],
  });

  assertEqual(aggregate.measuredPeriodQuantity, "23.0000", "period total mismatch");
  assertEqual(aggregate.certifiedPeriodQuantity, "20.0000", "certified period mismatch");
  assertEqual(
    aggregate.certifiedAccumulatedQuantity,
    "30.0000",
    "certified accumulated mismatch",
  );
  assertEqual(aggregate.quantityBalance, "70.0000", "quantity balance mismatch");
  assertEqual(aggregate.certifiedPeriodValue, "2000.00", "certified period value mismatch");
  assertEqual(
    aggregate.certifiedAccumulatedValue,
    "3000.00",
    "certified accumulated value mismatch",
  );
  assertEqual(aggregate.financialBalance, "7000.00", "financial balance mismatch");
});

runTest("monetary policy is generic and configured by source context", () => {
  const truncate = createMeasurementMonetaryPolicy({
    key: "documentary-truncation",
    scale: 2,
    quantizationMode: MeasurementDecimalQuantizationMode.TruncateTowardZero,
  });
  const round = createMeasurementMonetaryPolicy({
    key: "standard-monetary-rounding",
    scale: 2,
    quantizationMode: MeasurementDecimalQuantizationMode.RoundHalfAwayFromZero,
  });

  assertEqual(
    calculateMeasurementLineValue({ quantity: "3.32", unitValue: "8170.05", policy: truncate }),
    "27124.56",
    "documentary truncation mismatch",
  );
  assertEqual(
    calculateMeasurementLineValue({ quantity: "3.32", unitValue: "8170.05", policy: round }),
    "27124.57",
    "standard rounding mismatch",
  );
});

runTest("floating-point artifacts never reach the canonical quantity", () => {
  const source = preserveMeasurementSourceDecimal(3419.9999999999995, 8);

  assertEqual(source.raw, "3419.9999999999995", "raw evidence should be preserved");
  assertEqual(source.canonical, "3420.00000000", "canonical quantity contains an artifact");
  assertEqual(
    canonicalizeMeasurementDecimal("1e-7", 8),
    "0.00000010",
    "scientific notation should be deterministic",
  );
});

runTest("legacy project metadata remains evidence and never replaces relational identity", () => {
  const authority = resolveMeasurementProjectAuthority({
    relationalProjectId: "current-relational-project",
    legacyEvidenceProjectId: "legacy-analysis-project",
  });

  assertEqual(authority.projectId, "current-relational-project", "legacy id became authoritative");
  assertEqual(authority.legacyEvidenceProjectId, "legacy-analysis-project", "legacy evidence lost");
  assertEqual(authority.provenanceMismatch, true, "provenance mismatch should be signaled");
});

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
