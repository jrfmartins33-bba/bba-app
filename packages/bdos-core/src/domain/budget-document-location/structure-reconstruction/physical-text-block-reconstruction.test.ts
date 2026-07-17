import type { BlockReconstructionSegmentInput } from "./physical-text-block-reconstruction";
import { reconstructPhysicalTextBlocks } from "./physical-text-block-reconstruction";
import { BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTION_PROFILE_V1 } from "./structure-reconstruction-profile";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const PROFILE = BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTION_PROFILE_V1;

function segment(
  key: string,
  lineVerticalOrder: number,
  left: number,
  right: number,
  lineTop: number,
  lineBottom: number,
): BlockReconstructionSegmentInput {
  return {
    segmentKey: key,
    lineKey: `line-${lineVerticalOrder}`,
    lineVerticalOrder,
    lineHeightPoints: lineBottom - lineTop,
    leftPoints: left,
    topPoints: lineTop,
    rightPoints: right,
    bottomPoints: lineBottom,
    widthPoints: right - left,
    heightPoints: lineBottom - lineTop,
    centerXPoints: (left + right) / 2,
    centerYPoints: (lineTop + lineBottom) / 2,
  };
}

function blockGroupsOf(segments: ReadonlyArray<BlockReconstructionSegmentInput>): ReadonlyArray<ReadonlyArray<string>> {
  return reconstructPhysicalTextBlocks(segments, PROFILE).map((block) => [...block.segmentKeys].sort());
}

runTest("an isolated segment forms a unitary block", () => {
  const blocks = reconstructPhysicalTextBlocks([segment("a", 1, 0, 100, 0, 10)], PROFILE);
  assertEqual(blocks.length, 1);
  assertEqual(JSON.stringify(blocks[0].segmentKeys), JSON.stringify(["a"]));
  assertEqual(blocks[0].order, 1);
});

runTest("a continuous paragraph of vertically-consecutive, horizontally-overlapping lines forms one block", () => {
  const segments = [segment("l1", 1, 0, 200, 0, 10), segment("l2", 2, 0, 200, 12, 22), segment("l3", 3, 0, 200, 24, 34)];
  const groups = blockGroupsOf(segments);
  assertEqual(groups.length, 1);
  assertEqual(JSON.stringify(groups[0]), JSON.stringify(["l1", "l2", "l3"]));
});

// --- duas colunas independentes (§40) -----------------------------------------

runTest("two independent columns never merge into one block", () => {
  const segments = [
    segment("a1", 1, 0, 100, 0, 10),
    segment("b1", 1, 300, 400, 0, 10),
    segment("a2", 2, 0, 100, 12, 22),
    segment("b2", 2, 300, 400, 12, 22),
    segment("a3", 3, 0, 100, 24, 34),
    segment("b3", 3, 300, 400, 24, 34),
  ];
  const groups = blockGroupsOf(segments);
  assertEqual(groups.length, 2, "expected exactly two blocks, one per column");
  const columnA = groups.find((g) => g.includes("a1"))!;
  const columnB = groups.find((g) => g.includes("b1"))!;
  assertEqual(JSON.stringify(columnA), JSON.stringify(["a1", "a2", "a3"]));
  assertEqual(JSON.stringify(columnB), JSON.stringify(["b1", "b2", "b3"]));
});

// --- cabeçalho largo (§40) -----------------------------------------------------

runTest("a wide header spanning two columns does not bridge them without mutual adjacency", () => {
  // Header spans the full width; column A is its best downward candidate
  // (larger overlap ratio with the narrower A than with B), so the header
  // is mutually adjacent only to A - not to both A and B, and A/B never merge.
  const segments = [
    segment("header", 1, 0, 500, 0, 10),
    segment("a1", 2, 0, 100, 12, 22),
    segment("b1", 2, 350, 500, 12, 22),
  ];
  const groups = blockGroupsOf(segments);
  const headerGroup = groups.find((g) => g.includes("header"))!;
  assertEqual(headerGroup.includes("a1") && headerGroup.includes("b1"), false, "the header must never bridge both columns into one block");
  assertEqual(groups.length, 2, "expected the header to fuse with at most one column, never both");
});

runTest("a header equally overlapping two columns connects to at most one of them deterministically, never both", () => {
  // Both columns are entirely inside the header's horizontal span (overlap
  // ratio 1.0 for each), and each column's only upward candidate is the
  // header. The header's own best-downward tie-break (segment key) picks
  // exactly one column; only that pair forms a mutual edge — the other
  // column has no reciprocal edge and stays isolated. Two blocks total,
  // never one fused block spanning both columns.
  const segments = [
    segment("header", 1, 0, 400, 0, 10),
    segment("a1", 2, 0, 100, 12, 22),
    segment("b1", 2, 300, 400, 12, 22),
  ];
  const groups = blockGroupsOf(segments);
  assertEqual(groups.length, 2);
  assertEqual(
    groups.some((g) => g.includes("a1") && g.includes("b1")),
    false,
    "the two columns must never end up in the same block",
  );
});

// --- fronteiras estruturais -----------------------------------------------------

runTest("never connects segments of the same line", () => {
  const segments = [segment("a", 1, 0, 100, 0, 10), segment("b", 1, 105, 200, 0, 10)];
  const groups = blockGroupsOf(segments);
  assertEqual(groups.length, 2, "two segments in the same line must never be connected by block reconstruction");
});

runTest("never connects segments more than one line apart", () => {
  // Line 1 and line 3 overlap perfectly horizontally but line 2 is missing (no adjacency).
  const segments = [segment("a", 1, 0, 100, 0, 10), segment("c", 3, 0, 100, 200, 210)];
  const groups = blockGroupsOf(segments);
  assertEqual(groups.length, 2);
});

runTest("a large vertical gap (beyond the profile threshold) prevents block formation between consecutive lines", () => {
  const segments = [segment("a", 1, 0, 100, 0, 10), segment("b", 2, 0, 100, 500, 510)];
  const groups = blockGroupsOf(segments);
  assertEqual(groups.length, 2);
});

runTest("zero-width segments never divide by zero and are handled explicitly", () => {
  const segments = [segment("a", 1, 50, 50, 0, 10), segment("b", 2, 50, 50, 12, 22)];
  const blocks = reconstructPhysicalTextBlocks(segments, PROFILE);
  assertEqual(blocks.every((block) => Number.isFinite(block.widthPoints) && Number.isFinite(block.heightPoints)), true);
});

runTest("blocks are ordered deterministically by top, then left, then bottom", () => {
  const segments = [segment("lower", 3, 0, 100, 200, 210), segment("upper", 1, 0, 100, 0, 10)];
  const blocks = reconstructPhysicalTextBlocks(segments, PROFILE);
  assertEqual(blocks.length, 2);
  assertEqual(blocks[0].topPoints, 0);
  assertEqual(blocks[0].order, 1);
  assertEqual(blocks[1].topPoints, 200);
  assertEqual(blocks[1].order, 2);
});
