import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PhysicalDocumentPage, PhysicalDocumentTextItem } from "../physical-document-read.types";
import type { ReconstructedBudgetDocumentPage, ReconstructedHorizontalSegment, ReconstructedPhysicalLine, SourceTextItemReconstructionOutcome } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { PhysicalCellHypothesis, PhysicalCellHypothesisFormationRegion, PhysicalGridIntersection } from "../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";
import { buildStructurePage, cellFormationRegion, cellHypothesis, gridIntersection, physicalItem, physicalPage, placedOutcome, structureLine, structureSegment } from "./testing/physical-cell-text-evidence-formation-fixture-builders";
import { formRegionCellTextEvidences } from "./physical-cell-text-segment-formation";
import { computeRegionMetrics } from "./physical-cell-text-evidence-formation-metrics";
import { computeContentFingerprint } from "./physical-cell-text-evidence-formation-context-fingerprint";

const CONTEXT = { groupKey: "golden-group", regionKey: "golden-region" };

function build(itemOrder: ReadonlyArray<number>, segmentOrder: ReadonlyArray<string>, lineOrder: ReadonlyArray<string>, outcomeOrder: ReadonlyArray<number>, intersectionOrder: ReadonlyArray<string>, cellOrder: ReadonlyArray<string>) {
  const allItems: Record<number, PhysicalDocumentTextItem> = {
    0: physicalItem(0, "R$ 1.234,56"),
    1: physicalItem(1, "50%"),
    2: physicalItem(2, "Preço|Total"),
    3: physicalItem(3, "Ração"),
    4: physicalItem(4, "A   B\t C"),
    5: physicalItem(5, "outside text"),
  };
  const page: PhysicalDocumentPage = physicalPage(1, itemOrder.map((index) => allItems[index]));

  const allLines: Record<string, ReconstructedPhysicalLine> = {
    "line-1": structureLine("line-1", 1, ["seg-money", "seg-outside"]),
    "line-2": structureLine("line-2", 1, ["seg-two-items"]),
    "line-3": structureLine("line-3", 1, ["seg-percent", "seg-pipe"]),
  };
  const allSegments: Record<string, ReconstructedHorizontalSegment> = {
    "seg-money": structureSegment("seg-money", "line-1", 1, 1, [0]),
    "seg-outside": structureSegment("seg-outside", "line-1", 1, 2, [5]),
    "seg-two-items": structureSegment("seg-two-items", "line-2", 1, 1, [3, 4]),
    "seg-percent": structureSegment("seg-percent", "line-3", 1, 1, [1]),
    "seg-pipe": structureSegment("seg-pipe", "line-3", 1, 2, [2]),
  };
  const allOutcomes: Record<number, SourceTextItemReconstructionOutcome> = {
    0: placedOutcome(0, "line-1", "seg-money"),
    1: placedOutcome(1, "line-3", "seg-percent"),
    2: placedOutcome(2, "line-3", "seg-pipe"),
    3: placedOutcome(3, "line-2", "seg-two-items"),
    4: placedOutcome(4, "line-2", "seg-two-items"),
    5: placedOutcome(5, "line-1", "seg-outside"),
  };

  const structurePage: ReconstructedBudgetDocumentPage = buildStructurePage(
    1,
    lineOrder.map((key) => allLines[key]),
    segmentOrder.map((key) => allSegments[key]),
    outcomeOrder.map((index) => allOutcomes[index]),
  );

  const allIntersections: Record<string, PhysicalGridIntersection> = {
    "gi-simple": gridIntersection("gi-simple", "line-1", 1, 1, "cell-simple", 1, "golden-region"),
    "gi-empty": { gridIntersectionKey: "gi-empty", sourceLineKey: "line-1", sourcePhysicalColumnHypothesisKey: "column-2", sourceRegionKey: "golden-region", pageNumber: 1, rowOrder: 1, columnOrder: 2, gridBounds: { leftPoints: 0, topPoints: 0, rightPoints: 10, bottomPoints: 10, widthPoints: 10, heightPoints: 10, centerXPoints: 5, centerYPoints: 5 }, gridFormationRuleId: "fixture", gridFormationRuleVersion: 1, profileId: "fixture", profileVersion: 1, status: "empty" },
    "gi-multi": gridIntersection("gi-multi", "line-2", 2, 1, "cell-multi", 1, "golden-region"),
    "gi-ambiguous": { gridIntersectionKey: "gi-ambiguous", sourceLineKey: "line-2", sourcePhysicalColumnHypothesisKey: "column-2", sourceRegionKey: "golden-region", pageNumber: 1, rowOrder: 2, columnOrder: 2, gridBounds: { leftPoints: 0, topPoints: 0, rightPoints: 10, bottomPoints: 10, widthPoints: 10, heightPoints: 10, centerXPoints: 5, centerYPoints: 5 }, gridFormationRuleId: "fixture", gridFormationRuleVersion: 1, profileId: "fixture", profileVersion: 1, status: "unresolved_segment_association_ambiguity", ambiguityReason: "partial_segment_intersection", partiallyIntersectingSegmentKeys: ["seg-outside"] },
    "gi-multiseg": gridIntersection("gi-multiseg", "line-3", 3, 1, "cell-multiseg", 1, "golden-region"),
  };
  const intersections: PhysicalGridIntersection[] = intersectionOrder.map((key) => allIntersections[key]);

  const allCells: Record<string, PhysicalCellHypothesis> = {
    "cell-simple": cellHypothesis("cell-simple", "gi-simple", ["seg-money"]),
    "cell-multi": cellHypothesis("cell-multi", "gi-multi", ["seg-two-items"]),
    "cell-multiseg": cellHypothesis("cell-multiseg", "gi-multiseg", ["seg-percent", "seg-pipe"]),
  };
  const cellHypotheses: PhysicalCellHypothesis[] = cellOrder.map((key) => allCells[key]);

  const baseRegion = cellFormationRegion("golden-region", 1, [], []);
  const region: PhysicalCellHypothesisFormationRegion = { ...baseRegion, gridIntersections: intersections, cellHypotheses };

  const { cellTextEvidences, technicalProblems } = formRegionCellTextEvidences(region, structurePage, page, CONTEXT);
  const metrics = computeRegionMetrics(region.cellHypotheses.length, cellTextEvidences, technicalProblems.length);
  const payload = { cellTextEvidences, technicalProblems, metrics };
  return { ...payload, fingerprint: computeContentFingerprint("golden-trace-v1", payload) };
}

const canonicalItemOrder = [0, 1, 2, 3, 4, 5];
const canonicalSegmentOrder = ["seg-money", "seg-outside", "seg-two-items", "seg-percent", "seg-pipe"];
const canonicalLineOrder = ["line-1", "line-2", "line-3"];
const canonicalIntersectionOrder = ["gi-simple", "gi-empty", "gi-multi", "gi-ambiguous", "gi-multiseg"];
const canonicalCellOrder = ["cell-simple", "cell-multi", "cell-multiseg"];

const actual = build(canonicalItemOrder, canonicalSegmentOrder, canonicalLineOrder, canonicalItemOrder, canonicalIntersectionOrder, canonicalCellOrder);
const expected = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "testing", "physical-cell-text-evidence-formation-golden-trace.json"), "utf8"));
if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`complete golden trace changed: ${JSON.stringify(actual, null, 2)}`);

const permuted = build([...canonicalItemOrder].reverse(), [...canonicalSegmentOrder].reverse(), [...canonicalLineOrder].reverse(), [...canonicalItemOrder].reverse(), [...canonicalIntersectionOrder].reverse(), [...canonicalCellOrder].reverse());
if (JSON.stringify(permuted) !== JSON.stringify(actual)) throw new Error("array permutation of incidental-order collections changed the canonical golden trace");

// --- asserções específicas do conteúdo ----------------------------------------
function resolvedFragments(outcome: (typeof actual.cellTextEvidences)[number]["segmentOutcomes"][number]) {
  if (outcome.status !== "resolved") throw new Error(`expected a resolved segment outcome, got ${outcome.status}`);
  return outcome.fragments;
}

if (actual.cellTextEvidences.length !== 3) throw new Error("only the three real cell hypotheses may produce evidence — empty and ambiguous intersections, and the segment outside any cell, must never be copied");
const allSegmentKeysMentioned = actual.cellTextEvidences.flatMap((entry) => entry.segmentOutcomes.map((outcome) => outcome.segmentKey));
if (allSegmentKeysMentioned.includes("seg-outside")) throw new Error("a segment outside every cell hypothesis must never appear in the g.1 result");

const simpleCell = actual.cellTextEvidences.find((entry) => entry.cellHypothesisKey === "cell-simple")!;
if (simpleCell.status !== "formed" || resolvedFragments(simpleCell.segmentOutcomes[0])[0].originalText !== "R$ 1.234,56") throw new Error("currency symbol was not preserved verbatim in the simple cell");

const multiSegCell = actual.cellTextEvidences.find((entry) => entry.cellHypothesisKey === "cell-multiseg")!;
if (multiSegCell.segmentOutcomes.length !== 2) throw new Error("multi-segment cell must produce one outcome per segment");
if (resolvedFragments(multiSegCell.segmentOutcomes[0])[0].originalText !== "50%" || resolvedFragments(multiSegCell.segmentOutcomes[1])[0].originalText !== "Preço|Total") throw new Error("percent sign and pipe character were not preserved verbatim as separate fragments, never concatenated");

const twoItemCell = actual.cellTextEvidences.find((entry) => entry.cellHypothesisKey === "cell-multi")!;
const fragments = resolvedFragments(twoItemCell.segmentOutcomes[0]);
if (fragments.length !== 2 || fragments[0].originalText !== "Ração" || fragments[0].normalizedText !== "Ração") throw new Error("Unicode text was not preserved verbatim and identically normalized");
if (fragments[1].originalText !== "A   B\t C" || fragments[1].normalizedText !== "A B C") throw new Error("original and normalized text of the second item in the same segment must differ exactly per the versioned rule");
if (fragments[0].sourceReferenceOrder !== 1 || fragments[1].sourceReferenceOrder !== 2) throw new Error("two items in the same segment must preserve their source order");

console.log("ok - complete golden trace covers simple cell, multi-segment cell, multi-item segment, currency/percent/pipe/Unicode/whitespace text, original vs normalized divergence, metrics, fingerprint, full JSON and permutation of every incidental-order collection");
console.log("ok - empty grid intersection, ambiguous grid intersection and segment outside every cell hypothesis remain exclusively in the f.2c result, never copied into g.1");
