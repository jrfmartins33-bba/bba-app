import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PhysicalCellHypothesis, PhysicalGridIntersection } from "../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";
import type { PhysicalCellTextEvidence } from "../physical-cell-text-evidence-formation/budget-document-physical-cell-text-evidence-formation.types";
import type { ReconstructedHorizontalSegment, ReconstructedPhysicalLine } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import { ambiguousIntersection, cellHypothesis, emptyIntersection, failedIntersection, fragment, gridIntersection, regionCandidate, resolvedSegment, structureLine, structureMaps, structureSegment, textEvidence, textEvidenceRegion, cellFormationRegion } from "./testing/page-local-neutral-structured-evidence-formation-fixture-builders";
import { formNeutralDocumentRegion } from "./form-neutral-document-region";
import { validateRegionConservation, validateRegionMetricConservation } from "./page-local-neutral-structured-evidence-formation-conservation";
import { computeResultFingerprint } from "./page-local-neutral-structured-evidence-formation-result-fingerprint";

const lineWithOrder = (key: string, verticalOrder: number, segs: ReadonlyArray<string>): ReconstructedPhysicalLine => ({ ...structureLine(key, 1, segs), verticalOrder });

function build(lineKeyOrder: ReadonlyArray<string>, intersectionOrder: ReadonlyArray<string>, cellOrder: ReadonlyArray<string>, lineListOrder: ReadonlyArray<string>, segmentListOrder: ReadonlyArray<string>) {
  const allLines: Record<string, ReconstructedPhysicalLine> = {
    L1: lineWithOrder("L1", 10, ["L1c1seg"]),
    L2: lineWithOrder("L2", 20, ["L2c1s1", "L2c1s2"]),
    L3: lineWithOrder("L3", 30, ["L3seg"]),
    L4: lineWithOrder("L4", 40, ["L4seg"]),
    L5: lineWithOrder("L5", 5, ["L5seg1", "L5seg2"]),
  };
  const allSegments: Record<string, ReconstructedHorizontalSegment> = {
    L1c1seg: structureSegment("L1c1seg", "L1", 1, 1, [0]),
    L2c1s1: structureSegment("L2c1s1", "L2", 1, 1, [1]),
    L2c1s2: structureSegment("L2c1s2", "L2", 1, 2, [2, 3]),
    L3seg: structureSegment("L3seg", "L3", 1, 1, [4]),
    L4seg: structureSegment("L4seg", "L4", 1, 1, [5]),
    L5seg1: structureSegment("L5seg1", "L5", 1, 1, [6]),
    L5seg2: structureSegment("L5seg2", "L5", 1, 2, [7]),
  };
  const candidate = regionCandidate("R1", 1, 1, lineKeyOrder);

  const allIntersections: Record<string, PhysicalGridIntersection> = {
    "gi-L1c1": gridIntersection("gi-L1c1", "L1", 1, 1, "cell-simple", 1, "R1"),
    "gi-L1c2": emptyIntersection("gi-L1c2", "L1", 1, 2, 1, "R1"),
    "gi-L2c1": gridIntersection("gi-L2c1", "L2", 2, 1, "cell-multiseg", 1, "R1"),
    "gi-L2c2": ambiguousIntersection("gi-L2c2", "L2", 2, 2, 1, "R1", "partial_segment_intersection"),
    "gi-L2c3": ambiguousIntersection("gi-L2c3", "L2", 2, 3, 1, "R1", "segment_claimed_by_multiple_intersections"),
    "gi-L3c1": ambiguousIntersection("gi-L3c1", "L3", 3, 1, 1, "R1", "observed_content_outside_grid_bounds"),
    "gi-L3c2": failedIntersection("gi-L3c2", "L3", 3, 2, 1, "R1"),
    "gi-L4c1": emptyIntersection("gi-L4c1", "L4", 4, 1, 1, "R1"),
    "gi-L4c2": emptyIntersection("gi-L4c2", "L4", 4, 2, 1, "R1"),
  };
  const intersections = intersectionOrder.map((key) => allIntersections[key]);

  const allCells: Record<string, PhysicalCellHypothesis> = {
    "cell-simple": cellHypothesis("cell-simple", "gi-L1c1", ["L1c1seg"]),
    "cell-multiseg": cellHypothesis("cell-multiseg", "gi-L2c1", ["L2c1s1", "L2c1s2"]),
  };
  const cells = cellOrder.map((key) => allCells[key]);

  const allEvidences: Record<string, PhysicalCellTextEvidence> = {
    "cell-simple": textEvidence("cell-simple", "gi-L1c1", "formed", [resolvedSegment("L1c1seg", "L1", [fragment(1, 0, "R$ 1.234,56", "R$ 1.234,56")])]),
    "cell-multiseg": textEvidence("cell-multiseg", "gi-L2c1", "formed", [
      resolvedSegment("L2c1s1", "L2", [fragment(1, 1, "A   B\t C", "A B C")]),
      resolvedSegment("L2c1s2", "L2", [fragment(1, 2, "50%", "50%"), fragment(2, 3, "Preço|Total", "Preço|Total")]),
    ]),
  };
  const evidences = cellOrder.map((key) => allEvidences[key]);

  const f2cRegion = cellFormationRegion("R1", 1, "formed_with_ambiguities", intersections, cells);
  const g1Region = textEvidenceRegion("R1", 1, "formed", evidences);
  const maps = structureMaps(lineListOrder.map((key) => allLines[key]), segmentListOrder.map((key) => allSegments[key]));

  const region = formNeutralDocumentRegion(candidate, f2cRegion, g1Region, maps.lineByKey, maps.segmentByKey, { groupKey: "G1" });
  const conservation = validateRegionConservation(region, candidate, f2cRegion, g1Region);
  const metricOk = validateRegionMetricConservation(region, candidate, f2cRegion, g1Region);
  return { region, conservation, metricOk, fingerprint: computeResultFingerprint("golden-region-v1", region) };
}

const canonicalLineKeys = ["L1", "L2", "L3", "L4", "L5"];
const canonicalIntersections = ["gi-L1c1", "gi-L1c2", "gi-L2c1", "gi-L2c2", "gi-L2c3", "gi-L3c1", "gi-L3c2", "gi-L4c1", "gi-L4c2"];
const canonicalCells = ["cell-simple", "cell-multiseg"];
const canonicalLineList = ["L1", "L2", "L3", "L4", "L5"];
const canonicalSegmentList = ["L1c1seg", "L2c1s1", "L2c1s2", "L3seg", "L4seg", "L5seg1", "L5seg2"];

const actual = build(canonicalLineKeys, canonicalIntersections, canonicalCells, canonicalLineList, canonicalSegmentList);

if (actual.conservation !== null) throw new Error(`golden region violated conservation: ${actual.conservation}`);
if (!actual.metricOk) throw new Error("golden region metric conservation failed");

const goldenPath = join(dirname(fileURLToPath(import.meta.url)), "testing", "page-local-neutral-structured-evidence-formation-golden-trace.json");
const snapshot = { region: actual.region, conservation: actual.conservation, metricOk: actual.metricOk, fingerprint: actual.fingerprint };
if (process.env.WRITE_GOLDEN === "1") {
  writeFileSync(goldenPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
} else {
  const expected = JSON.parse(readFileSync(goldenPath, "utf8"));
  if (JSON.stringify(snapshot) !== JSON.stringify(expected)) throw new Error(`complete golden trace changed:\n${JSON.stringify(snapshot, null, 2)}`);
}

// Invariância de permutação de toda coleção de ordem INCIDENTAL (arrays de
// interseções, células, evidências e as listas de linha/segmento das fontes).
// `lineKeys` NÃO é permutada: é a sequência normativa de ordem vertical da
// f.2a, materializada por referência — permutá-la mudaria legitimamente o
// documento, não a ordem incidental.
const permuted = build(canonicalLineKeys, [...canonicalIntersections].reverse(), [...canonicalCells].reverse(), [...canonicalLineList].reverse(), [...canonicalSegmentList].reverse());
if (JSON.stringify(permuted) !== JSON.stringify(actual)) throw new Error("array permutation of incidental-order collections changed the canonical golden trace");

// --- asserções específicas de conteúdo ---------------------------------------
const region = actual.region;
if (region.status !== "structured_with_ambiguities") throw new Error("region with cells and ambiguous positions must be structured_with_ambiguities");
if (region.documentLines.length !== 5) throw new Error("all five normative region lines must produce a document line, including the one without positions and the one with only empty positions");
if (region.documentLines.map((l) => l.sourceLineKey).join(",") !== "L5,L1,L2,L3,L4") throw new Error("document lines must be ordered by physical verticalOrder, not by lineKey (L5 has verticalOrder 5)");

const l5 = region.documentLines.find((l) => l.sourceLineKey === "L5")!;
if (l5.status !== "without_positions" || l5.positions.length !== 0) throw new Error("a region line with no grid intersections must be without_positions with zero positions");
if (l5.physicalSegments.length !== 2) throw new Error("a line without positions must still preserve all its physical segments");

const l4 = region.documentLines.find((l) => l.sourceLineKey === "L4")!;
if (l4.status !== "structured" || l4.positions.some((p) => p.status !== "empty")) throw new Error("a line with only empty positions must be structured with every position empty");

const simple = region.documentLines.find((l) => l.sourceLineKey === "L1")!.positions.find((p) => p.status === "cell_structured");
if (!simple || simple.status !== "cell_structured") throw new Error("simple cell position missing");
if (simple.cell.status !== "structured" || simple.cell.columnOrder !== 1) throw new Error("simple cell must be structured at columnOrder 1 (columnOrder preserved from the intersection, never recalculated)");
if (!simple.cell.sourceTextEvidence) throw new Error("a structured (non-failed) simple cell must always preserve sourceTextEvidence");
const simpleFrag = simple.cell.sourceTextEvidence.segmentOutcomes[0];
if (simpleFrag.status !== "resolved" || simpleFrag.fragments[0].originalText !== "R$ 1.234,56") throw new Error("currency verbatim not preserved");

const multi = region.documentLines.find((l) => l.sourceLineKey === "L2")!.positions.find((p) => p.status === "cell_structured");
if (!multi || multi.status !== "cell_structured") throw new Error("multi-segment cell position missing");
if (!multi.cell.sourceTextEvidence) throw new Error("a structured (non-failed) multi-segment cell must always preserve sourceTextEvidence");
if (multi.cell.sourceTextEvidence.segmentOutcomes.length !== 2) throw new Error("multi-segment cell must carry one outcome per segment");
const seg1 = multi.cell.sourceTextEvidence.segmentOutcomes[0];
if (seg1.status !== "resolved" || seg1.fragments[0].originalText !== "A   B\t C" || seg1.fragments[0].normalizedText !== "A B C") throw new Error("original and normalized text must differ exactly, preserved by reference from g.1");
const seg2 = multi.cell.sourceTextEvidence.segmentOutcomes[1];
if (seg2.status !== "resolved" || seg2.fragments.length !== 2) throw new Error("the second segment of the multi-segment cell must carry exactly two fragments (multi-fragment segment)");
if (seg2.fragments[0].originalText !== "50%" || seg2.fragments[0].normalizedText !== "50%") throw new Error("percent symbol verbatim not preserved");
if (seg2.fragments[1].originalText !== "Preço|Total" || seg2.fragments[1].normalizedText !== "Preço|Total") throw new Error("pipe and Unicode (ç) verbatim not preserved");

const l2AmbiguousReasons = region.documentLines.find((l) => l.sourceLineKey === "L2")!.positions.map((p) => p.status);
if (!l2AmbiguousReasons.includes("ambiguous_partial_intersection") || !l2AmbiguousReasons.includes("ambiguous_multiple_intersections")) throw new Error("partial and multiple ambiguity variants must be preserved as positions, never cells");
const l3 = region.documentLines.find((l) => l.sourceLineKey === "L3")!.positions.map((p) => p.status);
if (!l3.includes("ambiguous_content_outside_grid_bounds") || !l3.includes("technical_failure")) throw new Error("content-outside and technical-failure variants must be preserved as positions");

if (region.metrics.documentCellCount !== 2 || region.metrics.cellStructuredPositionCount !== 2) throw new Error("exactly two grid intersections formed cells");
if (region.metrics.emptyPositionCount !== 3) throw new Error("three empty positions expected");
if (region.metrics.positionProducedCount !== 9) throw new Error("nine positions expected across the region");
if (region.metrics.physicalSegmentPreservedCount !== 7) throw new Error("every physical segment of every region line must be preserved");
if (region.metrics.fragmentPreservedCount !== region.metrics.fragmentReceivedCount) throw new Error("fragments received must equal fragments preserved");

console.log("ok - golden trace: simple cell, multi-segment cell, multi-fragment segment (each fragment individually asserted), currency/percent/pipe/whitespace/Unicode (each individually asserted), original vs normalized divergence, empty position, every ambiguity variant, technical-failure position, line without positions, line with only empty positions, verticalOrder ordering, columnOrder preserved from the intersection (the full order chain from PhysicalColumnHypothesis is proven separately by the real-pdf-chain test), conservation, metrics, fingerprint via full-snapshot equality, and full JSON/permutation invariance");
