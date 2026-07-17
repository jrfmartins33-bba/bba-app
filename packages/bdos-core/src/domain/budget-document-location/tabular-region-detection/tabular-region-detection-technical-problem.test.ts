import { createTabularRegionDetectionTechnicalProblem, getKnownTabularRegionDetectionProblemCodes } from "./tabular-region-detection-technical-problem";

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
  getKnownTabularRegionDetectionProblemCodes().forEach((code) => {
    const problem = createTabularRegionDetectionTechnicalProblem(code, "source_validation");
    assertEqual(problem.message.length > 0, true, `code ${code} must have a message`);
    assertEqual(problem.message.includes("at "), false, `code ${code} message must never look like a stack trace`);
    assertEqual(problem.message.includes("C:\\"), false, `code ${code} message must never contain an absolute path`);
  });
});

runTest("structured fields carry specificity, never interpolated into the message text", () => {
  const problem = createTabularRegionDetectionTechnicalProblem("source_group_contract_invalid", "candidate_group_processing", "group-key-123", 4, "line-key-9", "segment-key-2");
  assertEqual(problem.groupKey, "group-key-123");
  assertEqual(problem.pageNumber, 4);
  assertEqual(problem.lineKey, "line-key-9");
  assertEqual(problem.segmentKey, "segment-key-2");
  assertEqual(problem.message.includes("group-key-123"), false, "the message text must never interpolate the group key");
});

runTest("all fourteen codes from §16 of the Sprint specification are present, exactly once each", () => {
  const codes = getKnownTabularRegionDetectionProblemCodes();
  const expected = [
    "source_contract_version_unsupported",
    "source_lineage_mismatch",
    "source_reconstruction_contract_invalid",
    "source_reconstruction_fingerprint_invalid",
    "source_group_contract_invalid",
    "source_page_contract_invalid",
    "source_structure_reference_invalid",
    "candidate_page_not_reconstructable",
    "candidate_page_has_unresolved_structure",
    "vertical_alignment_detection_failed",
    "tabular_region_formation_failed",
    "tabular_region_overlap_detected",
    "tabular_region_conservation_failed",
    "tabular_region_detection_failed",
  ];
  assertEqual(codes.length, expected.length);
  expected.forEach((code) => assertEqual(codes.includes(code as (typeof codes)[number]), true, `missing code ${code}`));
});
