import type { SyntheticGeometryTextItem } from "./testing/tabular-region-detection-test-bridge";
import { buildTabularRegionDetectionFixture } from "./testing/tabular-region-detection-test-bridge";
import { validateTabularRegionDetectionInput } from "./tabular-region-detection-input-validation";

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
  return buildTabularRegionDetectionFixture("validation", [{ widthPoints: 612, heightPoints: 792, items: twoColumnRows(4) }]);
}

runTest("a genuine structure reconstruction result produced by the real reconstructor is always accepted as valid", () => {
  const structureReconstruction = buildValid();
  assertEqual(validateTabularRegionDetectionInput({ structureReconstruction }).kind, "valid");
});

runTest("an unsupported schema version is rejected, never accepted by lexical or best-effort comparison", () => {
  const structureReconstruction = buildValid();
  const tampered = { ...structureReconstruction, schemaVersion: 99 as unknown as typeof structureReconstruction.schemaVersion };
  const result = validateTabularRegionDetectionInput({ structureReconstruction: tampered });
  assertEqual(result.kind, "invalid");
  if (result.kind === "invalid") {
    assertEqual(result.problems[0].code, "source_contract_version_unsupported");
  }
});

runTest("status failed on the source reconstruction is rejected as invalid input, never silently treated as zero groups", () => {
  const structureReconstruction = buildValid();
  const tampered = { ...structureReconstruction, status: "failed" as const };
  const result = validateTabularRegionDetectionInput({ structureReconstruction: tampered });
  assertEqual(result.kind, "invalid");
  if (result.kind === "invalid") {
    assertEqual(result.problems[0].code, "source_reconstruction_contract_invalid");
  }
});

runTest("a tampered reconstruction context fingerprint is rejected", () => {
  const structureReconstruction = buildValid();
  const tampered = { ...structureReconstruction, reconstructionContextFingerprint: "0".repeat(64) };
  const result = validateTabularRegionDetectionInput({ structureReconstruction: tampered });
  assertEqual(result.kind, "invalid");
  if (result.kind === "invalid") {
    assertEqual(result.problems.some((p) => p.code === "source_reconstruction_fingerprint_invalid"), true);
  }
});

runTest("a tampered sourceByteHash (which the fingerprint is built from) is rejected via the fingerprint mismatch, never silently accepted", () => {
  const structureReconstruction = buildValid();
  const tampered = { ...structureReconstruction, sourceByteHash: "1".repeat(64) };
  const result = validateTabularRegionDetectionInput({ structureReconstruction: tampered });
  assertEqual(result.kind, "invalid");
});

runTest("a group whose declared pageKeys do not match its pages is rejected", () => {
  const structureReconstruction = buildValid();
  const tamperedGroups = structureReconstruction.groups.map((group) => ({ ...group, pageKeys: ["not-a-real-key"] }));
  const result = validateTabularRegionDetectionInput({ structureReconstruction: { ...structureReconstruction, groups: tamperedGroups } });
  assertEqual(result.kind, "invalid");
  if (result.kind === "invalid") {
    assertEqual(result.problems.some((p) => p.code === "source_group_contract_invalid"), true);
  }
});

runTest("a page whose line references a segment that does not exist is rejected", () => {
  const structureReconstruction = buildValid();
  const tamperedGroups = structureReconstruction.groups.map((group) => ({
    ...group,
    pages: group.pages.map((page, index) => (index === 0 ? { ...page, lines: page.lines.map((line, i) => (i === 0 ? { ...line, segmentKeys: [...line.segmentKeys, "nonexistent-segment"] } : line)) } : page)),
  }));
  const result = validateTabularRegionDetectionInput({ structureReconstruction: { ...structureReconstruction, groups: tamperedGroups } });
  assertEqual(result.kind, "invalid");
  if (result.kind === "invalid") {
    assertEqual(result.problems.some((p) => p.code === "source_structure_reference_invalid"), true);
  }
});

runTest("a page with a non-dense verticalOrder set (a gap) is rejected", () => {
  const structureReconstruction = buildValid();
  const tamperedGroups = structureReconstruction.groups.map((group) => ({
    ...group,
    pages: group.pages.map((page, index) => (index === 0 ? { ...page, lines: page.lines.map((line, i) => (i === 0 ? { ...line, verticalOrder: 99 } : line)) } : page)),
  }));
  const result = validateTabularRegionDetectionInput({ structureReconstruction: { ...structureReconstruction, groups: tamperedGroups } });
  assertEqual(result.kind, "invalid");
  if (result.kind === "invalid") {
    assertEqual(result.problems.some((p) => p.code === "source_page_contract_invalid"), true);
  }
});

runTest("a page reconstructed_with_problems (a legitimate per-page state, not a contract defect) is accepted as valid input", () => {
  const structureReconstruction = buildValid();
  const tamperedGroups = structureReconstruction.groups.map((group) => ({
    ...group,
    pages: group.pages.map((page) => ({ ...page, status: "reconstructed_with_problems" as const })),
  }));
  const result = validateTabularRegionDetectionInput({ structureReconstruction: { ...structureReconstruction, groups: tamperedGroups } });
  assertEqual(result.kind, "valid", "a per-page problem state is a normal input the orchestrator handles, never a validation-level rejection");
});

runTest("a not_reconstructable page (a legitimate per-page state) is accepted as valid input", () => {
  const structureReconstruction = buildValid();
  const tamperedGroups = structureReconstruction.groups.map((group) => ({
    ...group,
    pages: group.pages.map((page) => ({ ...page, status: "not_reconstructable" as const, lines: [], segments: [], blocks: [] })),
  }));
  const result = validateTabularRegionDetectionInput({ structureReconstruction: { ...structureReconstruction, groups: tamperedGroups } });
  assertEqual(result.kind, "valid");
});
