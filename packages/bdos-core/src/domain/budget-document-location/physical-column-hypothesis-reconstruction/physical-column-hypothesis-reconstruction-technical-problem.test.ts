import { createPhysicalColumnHypothesisReconstructionTechnicalProblem, getKnownPhysicalColumnHypothesisReconstructionProblemCodes } from "./physical-column-hypothesis-reconstruction-technical-problem";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

runTest("every known code has a non-empty Portuguese message, never a raw error or stack trace", () => {
  getKnownPhysicalColumnHypothesisReconstructionProblemCodes().forEach((code) => {
    const problem = createPhysicalColumnHypothesisReconstructionTechnicalProblem(code, "source_validation");
    assertEqual(problem.message.length > 0, true, `code ${code} must have a message`);
    assertEqual(problem.message.includes("at "), false);
    assertEqual(problem.message.includes("C:\\"), false);
  });
});

runTest("structured fields carry specificity, never interpolated into the message text", () => {
  const problem = createPhysicalColumnHypothesisReconstructionTechnicalProblem("source_reference_invalid", "candidate_region_processing", "group-1", 3, "region-9", "line-4", "segment-2");
  assertEqual(problem.groupKey, "group-1");
  assertEqual(problem.pageNumber, 3);
  assertEqual(problem.regionKey, "region-9");
  assertEqual(problem.lineKey, "line-4");
  assertEqual(problem.segmentKey, "segment-2");
  assertEqual(problem.message.includes("region-9"), false);
});

runTest("all eleven codes from the Sprint's restricted catalog are present, exactly once each", () => {
  const codes = getKnownPhysicalColumnHypothesisReconstructionProblemCodes();
  const expected = [
    "source_contract_version_unsupported",
    "source_lineage_mismatch",
    "source_fingerprint_invalid",
    "source_structure_reconstruction_contract_invalid",
    "source_tabular_region_detection_contract_invalid",
    "source_reference_invalid",
    "physical_vertical_band_construction_failed",
    "physical_column_hypothesis_formation_failed",
    "physical_column_hypothesis_overlap_detected",
    "physical_column_hypothesis_conservation_failed",
    "physical_column_hypothesis_reconstruction_failed",
  ];
  assertEqual(codes.length, expected.length);
  expected.forEach((code) => assertEqual(codes.includes(code as (typeof codes)[number]), true, `missing code ${code}`));
});
