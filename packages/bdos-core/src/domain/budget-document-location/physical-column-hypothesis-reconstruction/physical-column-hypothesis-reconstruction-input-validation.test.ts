import type { SyntheticGeometryTextItem } from "./testing/physical-column-hypothesis-reconstruction-test-bridge";
import { buildPhysicalColumnHypothesisReconstructionFixture } from "./testing/physical-column-hypothesis-reconstruction-test-bridge";
import { validatePhysicalColumnHypothesisReconstructionInput } from "./physical-column-hypothesis-reconstruction-input-validation";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const ROW_HEIGHT = 12;
const ROW_STEP = 25;

function twoColumnRows(count: number): ReadonlyArray<SyntheticGeometryTextItem> {
  const items: SyntheticGeometryTextItem[] = [];
  for (let row = 0; row < count; row += 1) {
    const top = 700 - row * ROW_STEP;
    items.push({ text: `col1-${row}`, leftPoints: 100, topPoints: top, rightPoints: 160, bottomPoints: top + ROW_HEIGHT, index: row * 2 });
    items.push({ text: `col2-${row}`, leftPoints: 300, topPoints: top, rightPoints: 360, bottomPoints: top + ROW_HEIGHT, index: row * 2 + 1 });
  }
  return items;
}

function buildValid() {
  return buildPhysicalColumnHypothesisReconstructionFixture("validation", [{ widthPoints: 612, heightPoints: 792, items: twoColumnRows(4) }]);
}

runTest("a genuine pair produced by the real reconstructor and detector is always accepted as valid", () => {
  const input = buildValid();
  assertEqual(validatePhysicalColumnHypothesisReconstructionInput(input).kind, "valid");
});

runTest("an unsupported structureReconstruction schema version is rejected", () => {
  const input = buildValid();
  const tampered = { ...input, structureReconstruction: { ...input.structureReconstruction, schemaVersion: 99 as unknown as typeof input.structureReconstruction.schemaVersion } };
  const result = validatePhysicalColumnHypothesisReconstructionInput(tampered);
  assertEqual(result.kind, "invalid");
  if (result.kind === "invalid") assertEqual(result.problems[0].code, "source_contract_version_unsupported");
});

runTest("an unsupported tabularRegionDetection schema version is rejected", () => {
  const input = buildValid();
  const tampered = { ...input, tabularRegionDetection: { ...input.tabularRegionDetection, schemaVersion: 99 as unknown as typeof input.tabularRegionDetection.schemaVersion } };
  const result = validatePhysicalColumnHypothesisReconstructionInput(tampered);
  assertEqual(result.kind, "invalid");
  if (result.kind === "invalid") assertEqual(result.problems[0].code, "source_contract_version_unsupported");
});

runTest("status failed on structureReconstruction is rejected", () => {
  const input = buildValid();
  const tampered = { ...input, structureReconstruction: { ...input.structureReconstruction, status: "failed" as const } };
  const result = validatePhysicalColumnHypothesisReconstructionInput(tampered);
  assertEqual(result.kind, "invalid");
  if (result.kind === "invalid") assertEqual(result.problems[0].code, "source_structure_reconstruction_contract_invalid");
});

runTest("status failed on tabularRegionDetection is rejected", () => {
  const input = buildValid();
  const tampered = { ...input, tabularRegionDetection: { ...input.tabularRegionDetection, status: "failed" as const } };
  const result = validatePhysicalColumnHypothesisReconstructionInput(tampered);
  assertEqual(result.kind, "invalid");
  if (result.kind === "invalid") assertEqual(result.problems[0].code, "source_tabular_region_detection_contract_invalid");
});

runTest("a mismatched sourceByteHash between the two inputs is rejected as lineage mismatch, never silently accepted", () => {
  const input = buildValid();
  const tampered = { ...input, tabularRegionDetection: { ...input.tabularRegionDetection, sourceByteHash: "0".repeat(64) } };
  const result = validatePhysicalColumnHypothesisReconstructionInput(tampered);
  assertEqual(result.kind, "invalid");
  if (result.kind === "invalid") assertEqual(result.problems.some((p) => p.code === "source_lineage_mismatch"), true);
});

runTest("a mismatched reconstruction fingerprint between the two inputs is rejected", () => {
  const input = buildValid();
  const tampered = { ...input, tabularRegionDetection: { ...input.tabularRegionDetection, sourceReconstructionContextFingerprint: "1".repeat(64) } };
  const result = validatePhysicalColumnHypothesisReconstructionInput(tampered);
  assertEqual(result.kind, "invalid");
  if (result.kind === "invalid") assertEqual(result.problems.some((p) => p.code === "source_fingerprint_invalid"), true);
});

runTest("combining structureReconstruction and tabularRegionDetection from two independently-built (different byte) fixtures is rejected", () => {
  const inputA = buildPhysicalColumnHypothesisReconstructionFixture("doc-a", [{ widthPoints: 612, heightPoints: 792, items: twoColumnRows(4) }]);
  const inputB = buildPhysicalColumnHypothesisReconstructionFixture("doc-b", [{ widthPoints: 612, heightPoints: 792, items: twoColumnRows(4) }]);
  const mixed = { structureReconstruction: inputA.structureReconstruction, tabularRegionDetection: inputB.tabularRegionDetection };
  const result = validatePhysicalColumnHypothesisReconstructionInput(mixed);
  assertEqual(result.kind, "invalid");
});

runTest("a tabularRegionDetection group referencing a sourceCandidateGroupKey absent from structureReconstruction is rejected", () => {
  const input = buildValid();
  const tamperedGroups = input.tabularRegionDetection.groups.map((group) => ({ ...group, sourceCandidateGroupKey: "nonexistent-group-key" }));
  const tampered = { ...input, tabularRegionDetection: { ...input.tabularRegionDetection, groups: tamperedGroups } };
  const result = validatePhysicalColumnHypothesisReconstructionInput(tampered);
  assertEqual(result.kind, "invalid");
  if (result.kind === "invalid") assertEqual(result.problems.some((p) => p.code === "source_reference_invalid"), true);
});

runTest("a region referencing a lineKey absent from the structureReconstruction page is rejected", () => {
  const input = buildValid();
  const tamperedGroups = input.tabularRegionDetection.groups.map((group) => ({
    ...group,
    pages: group.pages.map((page) => ({
      ...page,
      regions: page.regions.map((region, index) => (index === 0 ? { ...region, lineKeys: [...region.lineKeys, "nonexistent-line-key"] } : region)),
    })),
  }));
  const tampered = { ...input, tabularRegionDetection: { ...input.tabularRegionDetection, groups: tamperedGroups } };
  const result = validatePhysicalColumnHypothesisReconstructionInput(tampered);
  assertEqual(result.kind, "invalid");
  if (result.kind === "invalid") assertEqual(result.problems.some((p) => p.code === "source_reference_invalid"), true);
});

// --- auditoria pós-revisão, §5: validação completa das referências de região -------------------------

runTest("a region referencing a nonexistent supportingAlignmentKey is rejected", () => {
  const input = buildValid();
  const tamperedGroups = input.tabularRegionDetection.groups.map((group) => ({
    ...group,
    pages: group.pages.map((page) => ({
      ...page,
      regions: page.regions.map((region, index) => (index === 0 ? { ...region, supportingAlignmentKeys: [...region.supportingAlignmentKeys, "nonexistent-alignment-key"] } : region)),
    })),
  }));
  const tampered = { ...input, tabularRegionDetection: { ...input.tabularRegionDetection, groups: tamperedGroups } };
  const result = validatePhysicalColumnHypothesisReconstructionInput(tampered);
  assertEqual(result.kind, "invalid");
  if (result.kind === "invalid") assertEqual(result.problems.some((p) => p.code === "source_reference_invalid"), true);
});

runTest("a region with a duplicated supportingAlignmentKey is rejected", () => {
  const input = buildValid();
  const tamperedGroups = input.tabularRegionDetection.groups.map((group) => ({
    ...group,
    pages: group.pages.map((page) => ({
      ...page,
      regions: page.regions.map((region, index) =>
        index === 0 && region.supportingAlignmentKeys.length > 0 ? { ...region, supportingAlignmentKeys: [region.supportingAlignmentKeys[0], region.supportingAlignmentKeys[0]] } : region,
      ),
    })),
  }));
  const tampered = { ...input, tabularRegionDetection: { ...input.tabularRegionDetection, groups: tamperedGroups } };
  const result = validatePhysicalColumnHypothesisReconstructionInput(tampered);
  assertEqual(result.kind, "invalid");
  if (result.kind === "invalid") assertEqual(result.problems.some((p) => p.code === "source_tabular_region_detection_contract_invalid"), true);
});

runTest("a supporting alignment that does not contain all of the region's lines is rejected", () => {
  const input = buildValid();
  const tamperedGroups = input.tabularRegionDetection.groups.map((group) => ({
    ...group,
    pages: group.pages.map((page) => ({
      ...page,
      alignments: page.alignments.map((alignment, index) =>
        index === 0 ? { ...alignment, lineKeys: alignment.lineKeys.slice(1), segmentKeys: alignment.segmentKeys.slice(1) } : alignment,
      ),
    })),
  }));
  const tampered = { ...input, tabularRegionDetection: { ...input.tabularRegionDetection, groups: tamperedGroups } };
  const result = validatePhysicalColumnHypothesisReconstructionInput(tampered);
  assertEqual(result.kind, "invalid");
  if (result.kind === "invalid") assertEqual(result.problems.some((p) => p.code === "source_reference_invalid"), true);
});

runTest("a supporting alignment with legitimate additional lines beyond the region is accepted — region.lineKeys is a subset, never required to equal the alignment's lineKeys exactly", () => {
  // Real geometry (mirrors the Sprint's own integrated-projection scenario): column A recurs across
  // all six physical lines, but the region f.2a forms only covers three of them (where column B also
  // recurs) — column A's real alignment genuinely has more lines than the region it supports.
  const items: SyntheticGeometryTextItem[] = [];
  for (let row = 0; row < 6; row += 1) {
    const top = 700 - row * ROW_STEP;
    items.push({ text: `colA-${row}`, leftPoints: 100, topPoints: top, rightPoints: 160 + row * 20, bottomPoints: top + ROW_HEIGHT, index: row });
  }
  [2, 3, 4].forEach((row, position) => {
    const top = 700 - row * ROW_STEP;
    items.push({ text: `colB-${row}`, leftPoints: 300, topPoints: top, rightPoints: 360, bottomPoints: top + ROW_HEIGHT, index: 6 + position });
  });
  const input = buildPhysicalColumnHypothesisReconstructionFixture("subset-alignment", [{ widthPoints: 612, heightPoints: 792, items }]);

  const region = input.tabularRegionDetection.groups[0].pages[0].regions[0];
  const page = input.tabularRegionDetection.groups[0].pages[0];
  const spanningAlignment = page.alignments.find((a) => a.lineKeys.length > region.lineKeys.length);
  assertEqual(spanningAlignment !== undefined, true, "test setup: expected column A's alignment to span more lines than the region");
  assertEqual(region.supportingAlignmentKeys.includes(spanningAlignment!.alignmentKey), true, "test setup: expected the spanning alignment to be region evidence");

  const result = validatePhysicalColumnHypothesisReconstructionInput(input);
  assertEqual(result.kind, "valid", "an alignment with extra lines outside the region must never be rejected — only missing region lines are invalid");
});

runTest("a region line whose disposition does not point back to that region's own key is rejected", () => {
  const input = buildValid();
  const tamperedGroups = input.tabularRegionDetection.groups.map((group) => ({
    ...group,
    pages: group.pages.map((page) => ({
      ...page,
      lineDispositions: page.lineDispositions.map((disposition) =>
        disposition.status === "included_in_candidate_region" ? { ...disposition, regionKey: "a-different-region-key" } : disposition,
      ),
    })),
  }));
  const tampered = { ...input, tabularRegionDetection: { ...input.tabularRegionDetection, groups: tamperedGroups } };
  const result = validatePhysicalColumnHypothesisReconstructionInput(tampered);
  assertEqual(result.kind, "invalid");
  if (result.kind === "invalid") assertEqual(result.problems.some((p) => p.code === "source_reference_invalid"), true);
});
