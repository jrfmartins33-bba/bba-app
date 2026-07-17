import {
  createStructureReconstructionTechnicalProblem,
  getKnownStructureReconstructionProblemCodes,
} from "./structure-reconstruction-technical-problem";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const ALL_CODES = [
  "source_contract_version_unsupported",
  "source_lineage_mismatch",
  "physical_read_contract_invalid",
  "geometry_context_fingerprint_invalid",
  "page_location_contract_invalid",
  "candidate_group_contract_invalid",
  "candidate_page_not_found",
  "candidate_page_text_unavailable",
  "candidate_page_has_no_eligible_items",
  "candidate_page_contains_unresolved_items",
  "candidate_page_contains_outside_items",
  "candidate_page_contains_partially_outside_items",
  "physical_line_reconstruction_failed",
  "horizontal_segment_reconstruction_failed",
  "physical_block_reconstruction_failed",
  "structure_reconstruction_failed",
] as const;

runTest("every known problem code has a non-empty message", () => {
  getKnownStructureReconstructionProblemCodes().forEach((code) => {
    const problem = createStructureReconstructionTechnicalProblem(code, "source_validation");
    assertEqual(problem.message.trim().length > 0, true, `code ${code} has an empty message`);
  });
});

runTest("the message map covers exactly the declared union of codes, no more, no less", () => {
  const known = [...getKnownStructureReconstructionProblemCodes()].sort();
  const expected = [...ALL_CODES].sort();
  assertEqual(JSON.stringify(known), JSON.stringify(expected));
});

runTest("messages are written in Portuguese, not English", () => {
  getKnownStructureReconstructionProblemCodes().forEach((code) => {
    const problem = createStructureReconstructionTechnicalProblem(code, "source_validation");
    // A cheap but effective signal: every message below uses at least one
    // of these common Portuguese function words/diacritics; no English
    // "the"/"is"/"was" leaked back in during a future edit.
    const looksPortuguese = /[ãõáéíóúâêôç]|(\bnão\b)|(\bde\b)|(\bda\b)|(\bdo\b)/i.test(problem.message);
    assertEqual(looksPortuguese, true, `code ${code} message does not look like Portuguese: "${problem.message}"`);
  });
});

runTest("carries the structured fields, not interpolated into the message text", () => {
  const problem = createStructureReconstructionTechnicalProblem("candidate_page_not_found", "candidate_group_processing", "group-key-a", 3, null);
  assertEqual(problem.groupKey, "group-key-a");
  assertEqual(problem.pageNumber, 3);
  assertEqual(problem.message.includes("3"), false, "the message must not embed the dynamic page number as text");
});
