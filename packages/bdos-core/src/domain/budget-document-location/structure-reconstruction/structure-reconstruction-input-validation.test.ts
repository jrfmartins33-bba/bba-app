import { observeDocumentSignals } from "../signal-observation";
import { locateBudgetDocumentPages } from "../page-location";
import type { BudgetDocumentPageLocationResult } from "../page-location/budget-page-location.types";
import type { PhysicalDocumentReadResult } from "../physical-document-read.types";
import { buildPhysicalDocumentReadResultWithGeometry } from "./testing/structure-reconstruction-test-bridge";
import { validateStructureReconstructionInput } from "./structure-reconstruction-input-validation";
import type { BudgetDocumentStructureReconstructionInput } from "./budget-document-structure-reconstruction.types";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function buildValidInput(): BudgetDocumentStructureReconstructionInput {
  const physicalRead = buildPhysicalDocumentReadResultWithGeometry("input-validation-fixture", [
    {
      widthPoints: 600,
      heightPoints: 800,
      items: [
        { text: "1.1 Escavação manual", leftPoints: 50, topPoints: 50, rightPoints: 300, bottomPoints: 70 },
        { text: "BDI", leftPoints: 50, topPoints: 90, rightPoints: 90, bottomPoints: 110 },
      ],
    },
    {
      widthPoints: 600,
      heightPoints: 800,
      items: [{ text: "Nothing budget-related here.", leftPoints: 50, topPoints: 50, rightPoints: 300, bottomPoints: 70 }],
    },
  ]);
  const observation = observeDocumentSignals(physicalRead);
  const pageLocation = locateBudgetDocumentPages(observation);
  return { physicalRead, pageLocation };
}

function firstProblemCode(result: ReturnType<typeof validateStructureReconstructionInput>): string | null {
  return result.kind === "invalid" ? result.problems[0].code : null;
}

runTest("a valid, freshly derived input is accepted", () => {
  const input = buildValidInput();
  assertEqual(input.pageLocation.candidateGroups.length > 0, true, "fixture must produce at least one candidate group for later tests to be meaningful");
  assertEqual(validateStructureReconstructionInput(input).kind, "valid");
});

runTest("rejects an unsupported physical read schema version", () => {
  const input = buildValidInput();
  const tampered: PhysicalDocumentReadResult = { ...input.physicalRead, schemaVersion: 3 as 2 };
  const result = validateStructureReconstructionInput({ ...input, physicalRead: tampered });
  assertEqual(result.kind, "invalid");
  assertEqual(firstProblemCode(result), "source_contract_version_unsupported");
});

runTest("rejects an unsupported page location decision rule set version", () => {
  const input = buildValidInput();
  const tampered: BudgetDocumentPageLocationResult = {
    ...input.pageLocation,
    decisionRuleSetVersion: "budget-document-page-location-rules-v2" as typeof input.pageLocation.decisionRuleSetVersion,
  };
  const result = validateStructureReconstructionInput({ ...input, pageLocation: tampered });
  assertEqual(result.kind, "invalid");
  assertEqual(firstProblemCode(result), "source_contract_version_unsupported");
});

runTest("rejects a page location result whose own status is failed", () => {
  const input = buildValidInput();
  const tampered: BudgetDocumentPageLocationResult = { ...input.pageLocation, status: "failed" };
  const result = validateStructureReconstructionInput({ ...input, pageLocation: tampered });
  assertEqual(result.kind, "invalid");
  assertEqual(firstProblemCode(result), "page_location_contract_invalid");
});

runTest("rejects a failed physical read paired with a page location that does not reflect the failure", () => {
  const input = buildValidInput();
  const tampered: PhysicalDocumentReadResult = { ...input.physicalRead, status: "failed", pages: [] };
  const result = validateStructureReconstructionInput({ ...input, physicalRead: tampered });
  assertEqual(result.kind, "invalid");
  assertEqual(firstProblemCode(result), "source_lineage_mismatch");
});

runTest("rejects a tampered geometry context fingerprint", () => {
  const input = buildValidInput();
  const tampered: PhysicalDocumentReadResult = { ...input.physicalRead, geometryContextFingerprint: "0".repeat(64) };
  const result = validateStructureReconstructionInput({ ...input, physicalRead: tampered });
  assertEqual(result.kind, "invalid");
  assertEqual(firstProblemCode(result), "geometry_context_fingerprint_invalid");
});

runTest("rejects mismatched source byte hashes between physical read and page location", () => {
  const input = buildValidInput();
  const tampered: BudgetDocumentPageLocationResult = { ...input.pageLocation, sourceByteHash: "f".repeat(64) };
  const result = validateStructureReconstructionInput({ ...input, pageLocation: tampered });
  assertEqual(result.kind, "invalid");
  assertEqual(result.kind === "invalid" && result.problems.some((p) => p.code === "source_lineage_mismatch"), true);
});

runTest("rejects mismatched total page counts", () => {
  const input = buildValidInput();
  const tampered: BudgetDocumentPageLocationResult = { ...input.pageLocation, totalPageCount: 999 };
  const result = validateStructureReconstructionInput({ ...input, pageLocation: tampered });
  assertEqual(result.kind, "invalid");
  assertEqual(result.kind === "invalid" && result.problems.some((p) => p.code === "source_lineage_mismatch"), true);
});

runTest("rejects a null source read metadata on the page location result", () => {
  const input = buildValidInput();
  const tampered: BudgetDocumentPageLocationResult = { ...input.pageLocation, sourceReadMetadata: null };
  const result = validateStructureReconstructionInput({ ...input, pageLocation: tampered });
  assertEqual(result.kind, "invalid");
  assertEqual(result.kind === "invalid" && result.problems.some((p) => p.code === "page_location_contract_invalid"), true);
});

runTest("rejects a source read metadata that does not match the physical read it was supposedly derived from", () => {
  const input = buildValidInput();
  const tampered: BudgetDocumentPageLocationResult = {
    ...input.pageLocation,
    sourceReadMetadata: input.pageLocation.sourceReadMetadata === null ? null : { ...input.pageLocation.sourceReadMetadata, adapterVersion: "a-different-adapter" },
  };
  const result = validateStructureReconstructionInput({ ...input, pageLocation: tampered });
  assertEqual(result.kind, "invalid");
  assertEqual(result.kind === "invalid" && result.problems.some((p) => p.code === "source_lineage_mismatch"), true);
});

runTest("rejects a physical read whose pages are not densely numbered from 1", () => {
  const input = buildValidInput();
  const tamperedPages = input.physicalRead.pages.map((page, index) => (index === 1 ? { ...page, pageNumber: 5 } : page));
  const tampered: PhysicalDocumentReadResult = { ...input.physicalRead, pages: tamperedPages };
  const result = validateStructureReconstructionInput({ ...input, physicalRead: tampered });
  assertEqual(result.kind, "invalid");
  assertEqual(result.kind === "invalid" && result.problems.some((p) => p.code === "physical_read_contract_invalid"), true);
});

runTest("rejects a candidate group referencing a page number outside the document", () => {
  const input = buildValidInput();
  const group = input.pageLocation.candidateGroups[0];
  const tamperedGroup = { ...group, pageNumbers: [999], members: [{ ...group.members[0], pageNumber: 999 }] };
  const tampered: BudgetDocumentPageLocationResult = { ...input.pageLocation, candidateGroups: [tamperedGroup] };
  const result = validateStructureReconstructionInput({ ...input, pageLocation: tampered });
  assertEqual(result.kind, "invalid");
  assertEqual(result.kind === "invalid" && result.problems.some((p) => p.code === "candidate_page_not_found"), true);
});

runTest("rejects two candidate groups that both claim the same page", () => {
  const input = buildValidInput();
  const group = input.pageLocation.candidateGroups[0];
  const duplicateGroup = { ...group, groupKey: `${group.groupKey}-duplicate` };
  const tampered: BudgetDocumentPageLocationResult = { ...input.pageLocation, candidateGroups: [group, duplicateGroup] };
  const result = validateStructureReconstructionInput({ ...input, pageLocation: tampered });
  assertEqual(result.kind, "invalid");
  assertEqual(result.kind === "invalid" && result.problems.some((p) => p.code === "candidate_group_contract_invalid"), true);
});

runTest("rejects a closing candidate that is not the last member of its group", () => {
  const input = buildValidInput();
  const group = input.pageLocation.candidateGroups[0];
  // A synthetic 2-member group where the *first* member is "closing" — invalid regardless of the document's real candidacy.
  const twoMemberGroup = {
    ...group,
    endPageNumber: group.startPageNumber + 1,
    pageNumbers: [group.startPageNumber, group.startPageNumber + 1],
    members: [
      { ...group.members[0], candidateType: "closing" as const },
      { pageNumber: group.startPageNumber + 1, candidateType: "direct" as const, primaryRuleId: group.members[0].primaryRuleId, primaryRuleVersion: group.members[0].primaryRuleVersion },
    ],
  };
  const result = validateStructureReconstructionInput({ ...input, pageLocation: { ...input.pageLocation, candidateGroups: [twoMemberGroup] } });
  assertEqual(result.kind, "invalid");
  assertEqual(result.kind === "invalid" && result.problems.some((p) => p.code === "candidate_group_contract_invalid"), true);
});
