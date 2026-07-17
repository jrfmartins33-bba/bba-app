import type { PhysicalDocumentTextItemLayoutGeometry } from "../physical-document-read.types";
import type { EligibleSourceTextItem } from "./source-item-reconstruction-outcomes";
import { reconstructPhysicalLines } from "./physical-line-reconstruction";
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

function item(index: number, left: number, top: number, right: number, bottom: number): EligibleSourceTextItem {
  const geometry: PhysicalDocumentTextItemLayoutGeometry = {
    leftPoints: left,
    topPoints: top,
    rightPoints: right,
    bottomPoints: bottom,
    widthPoints: right - left,
    heightPoints: bottom - top,
    centerXPoints: (left + right) / 2,
    centerYPoints: (top + bottom) / 2,
    pageBoundsRelation: "inside",
    coordinateSpaceVersion: "physical-document-text-item-coordinate-space-v1",
    geometryProfileVersion: "physical-document-text-item-geometry-profile-v1",
  };
  return { sourceTextItemIndex: index, geometry };
}

function linesOf(items: ReadonlyArray<EligibleSourceTextItem>): ReadonlyArray<ReadonlyArray<number>> {
  return reconstructPhysicalLines(items, PROFILE).map((line) => [...line.sourceTextItemIndices].sort((a, b) => a - b));
}

runTest("a single item forms a single line", () => {
  const lines = reconstructPhysicalLines([item(0, 0, 0, 50, 10)], PROFILE);
  assertEqual(lines.length, 1);
  assertEqual(JSON.stringify(lines[0].sourceTextItemIndices), JSON.stringify([0]));
  assertEqual(lines[0].verticalOrder, 1);
});

runTest("two vertically-overlapping items with matching height join one line", () => {
  const lines = linesOf([item(0, 0, 0, 50, 10), item(1, 60, 0, 100, 10)]);
  assertEqual(lines.length, 1);
  assertEqual(JSON.stringify(lines[0]), JSON.stringify([0, 1]));
});

runTest("three lines: vertically separated items each form their own line", () => {
  const lines = linesOf([item(0, 0, 0, 50, 10), item(1, 0, 50, 50, 60), item(2, 0, 100, 50, 110)]);
  assertEqual(lines.length, 3);
});

runTest("shuffled input array produces the same lines as ordered input", () => {
  const ordered = [item(0, 0, 0, 50, 10), item(1, 0, 50, 50, 60), item(2, 0, 100, 50, 110)];
  const shuffled = [ordered[2], ordered[0], ordered[1]];
  assertEqual(JSON.stringify(linesOf(ordered)), JSON.stringify(linesOf(shuffled)));
});

runTest("items with different heights but sufficient overlap and small normalized center distance join one line", () => {
  const lines = linesOf([item(0, 0, 0, 50, 20), item(1, 60, 5, 100, 15)]);
  assertEqual(lines.length, 1);
});

runTest("a zero-height item never joins another item's line (forms its own singleton line)", () => {
  const lines = linesOf([item(0, 0, 0, 50, 10), item(1, 60, 5, 100, 5)]);
  assertEqual(lines.length, 2);
});

// --- antiencadeamento adversarial (§26, §28) ---------------------------------

// A: top 0-10, centerY 5. B: top 4-14, centerY 9. C: top 8-18, centerY 13.
// A-B: overlap [4,10]=6, minHeight 10 -> ratio 0.6 (>=0.5, ok); centerDist 4/10=0.4 (<=0.5, ok) -> compatible.
// B-C: symmetric to A-B -> compatible.
// A-C: overlap [8,10]=2, minHeight 10 -> ratio 0.2 (<0.5) -> incompatible.
function buildAntiChainItems(): { a: EligibleSourceTextItem; b: EligibleSourceTextItem; c: EligibleSourceTextItem } {
  return {
    a: item(0, 0, 0, 50, 10),
    b: item(1, 0, 4, 50, 14),
    c: item(2, 0, 8, 50, 18),
  };
}

function assertNeverAllThreeSameLine(items: ReadonlyArray<EligibleSourceTextItem>): void {
  const lines = reconstructPhysicalLines(items, PROFILE);
  const allInOneLine = lines.some((line) => line.sourceTextItemIndices.length === 3);
  assertEqual(allInOneLine, false, "A, B and C must never end up in the same line (pairwise compatibility is not transitive)");
  assertEqual(lines.length, 2, "expected exactly two lines: one pair plus one singleton");
}

runTest("anti-chaining: A compatible with B, B compatible with C, A incompatible with C — order [A,B,C]", () => {
  const { a, b, c } = buildAntiChainItems();
  assertNeverAllThreeSameLine([a, b, c]);
});

runTest("anti-chaining: same scenario, order [C,B,A]", () => {
  const { a, b, c } = buildAntiChainItems();
  assertNeverAllThreeSameLine([c, b, a]);
});

runTest("anti-chaining: same scenario, order [B,A,C]", () => {
  const { a, b, c } = buildAntiChainItems();
  assertNeverAllThreeSameLine([b, a, c]);
});

runTest("anti-chaining: result is identical (not just non-chained) across all three input orders", () => {
  const { a, b, c } = buildAntiChainItems();
  const result1 = linesOf([a, b, c]);
  const result2 = linesOf([c, b, a]);
  const result3 = linesOf([b, a, c]);
  assertEqual(JSON.stringify(result1), JSON.stringify(result2));
  assertEqual(JSON.stringify(result1), JSON.stringify(result3));
});

// --- desempate determinístico (§27, passo 6) ---------------------------------

runTest("an item compatible with two existing lines joins the one with the smaller normalized center distance", () => {
  // Line seed near y=5 (0-10) and line seed near y=100 (95-105).
  // New item centered at y=7 (2-12) is close to the first line, far from the second.
  const items = [item(0, 0, 0, 50, 10), item(1, 0, 95, 50, 105), item(2, 60, 2, 110, 12)];
  const lines = reconstructPhysicalLines(items, PROFILE);
  const lineOfC = lines.find((line) => line.sourceTextItemIndices.includes(2))!;
  assertEqual(lineOfC.sourceTextItemIndices.includes(0), true, "expected item 2 to join the closer line (with item 0)");
  assertEqual(lineOfC.sourceTextItemIndices.includes(1), false);
});

// --- limites da linha (§29) --------------------------------------------------

runTest("line bounds are the canonical union of its member items", () => {
  const lines = reconstructPhysicalLines([item(0, 10, 0, 50, 8), item(1, 60, 2, 120, 12)], PROFILE);
  assertEqual(lines.length, 1);
  const line = lines[0];
  assertEqual(line.leftPoints, 10);
  assertEqual(line.topPoints, 0);
  assertEqual(line.rightPoints, 120);
  assertEqual(line.bottomPoints, 12);
  assertEqual(line.widthPoints, 110);
  assertEqual(line.heightPoints, 12);
});

runTest("verticalOrder is assigned densely from 1, ordered top to bottom", () => {
  const lines = reconstructPhysicalLines([item(0, 0, 100, 50, 110), item(1, 0, 0, 50, 10)], PROFILE);
  assertEqual(lines.length, 2);
  const sorted = [...lines].sort((a, b) => a.verticalOrder - b.verticalOrder);
  assertEqual(sorted[0].topPoints, 0);
  assertEqual(sorted[1].topPoints, 100);
  assertEqual(sorted[0].verticalOrder, 1);
  assertEqual(sorted[1].verticalOrder, 2);
});
