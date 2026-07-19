import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReconstructedHorizontalSegment, ReconstructedPhysicalLine } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { PhysicalColumnHypothesis, PhysicalColumnHypothesisSegmentDisposition } from "../physical-column-hypothesis-reconstruction/budget-document-physical-column-hypothesis-reconstruction.types";
import { formPhysicalGrid } from "./physical-grid-formation";
import { associateSegmentsToPhysicalGrid } from "./physical-segment-grid-association";
import { formPhysicalCellHypotheses } from "./physical-cell-hypothesis-formation";
import { computeRegionMetrics } from "./physical-cell-hypothesis-formation-metrics";
import { computeContentFingerprint } from "./physical-cell-hypothesis-formation-context-fingerprint";

const line = (lineKey: string, verticalOrder: number, topPoints: number): ReconstructedPhysicalLine => ({ lineKey, verticalOrder, topPoints, bottomPoints: topPoints + 10, leftPoints: 0, rightPoints: 120, widthPoints: 120, heightPoints: 10, centerXPoints: 60, centerYPoints: topPoints + 5, segmentKeys: [] } as unknown as ReconstructedPhysicalLine);
const segment = (segmentKey: string, lineKey: string, horizontalOrder: number, leftPoints: number, rightPoints: number, topPoints: number): ReconstructedHorizontalSegment => ({ segmentKey, lineKey, horizontalOrder, leftPoints, rightPoints, topPoints, bottomPoints: topPoints + 10, widthPoints: rightPoints - leftPoints, heightPoints: 10, centerXPoints: (leftPoints + rightPoints) / 2, centerYPoints: topPoints + 5 } as unknown as ReconstructedHorizontalSegment);
const column = (hypothesisKey: string, order: number, leftPoints: number, rightPoints: number): PhysicalColumnHypothesis => ({ hypothesisKey, pageNumber: 1, order, contributingAlignmentKeys: [], lineKeys: [], segmentKeys: [], leftPoints, rightPoints, topPoints: 0, bottomPoints: 70, widthPoints: rightPoints - leftPoints, heightPoints: 70, centerXPoints: (leftPoints + rightPoints) / 2, centerYPoints: 35, formationRuleId: "golden", formationRuleVersion: 1, profileId: "golden", profileVersion: 1 });
const lines = [line("line-1", 1, 0), line("line-2", 2, 20), line("line-3", 3, 40), line("line-4", 4, 60)];
const columns = [column("column-1", 1, 0, 40), column("column-2", 2, 60, 100)];
const segments = [segment("simple", "line-1", 1, 5, 15, 0), segment("multi-a", "line-2", 1, 5, 15, 20), segment("multi-b", "line-2", 2, 20, 30, 20), segment("partial", "line-2", 3, 50, 70, 20), segment("inherited", "line-3", 1, 65, 75, 40), segment("ordinary", "line-3", 2, 5, 15, 40), segment("orphan", "line-4", 1, 45, 50, 60), segment("last", "line-4", 2, 65, 75, 60)];
const upstream: PhysicalColumnHypothesisSegmentDisposition[] = segments.map((entry) => entry.segmentKey === "inherited" ? { status: "unresolved_physical_column_hypothesis_ambiguity", segmentKey: entry.segmentKey, lineKey: entry.lineKey, conflictingCandidateHypothesisKeys: ["candidate-a", "candidate-b"] } : { status: "not_in_physical_column_hypothesis", segmentKey: entry.segmentKey, lineKey: entry.lineKey });

function run(sourceLines: typeof lines, sourceColumns: typeof columns, sourceSegments: typeof segments, sourceUpstream: typeof upstream) {
  const orderedLines = [...sourceLines].sort((a, b) => a.verticalOrder - b.verticalOrder || a.lineKey.localeCompare(b.lineKey));
  const orderedColumns = [...sourceColumns].sort((a, b) => a.order - b.order || a.hypothesisKey.localeCompare(b.hypothesisKey));
  const orderedSegments = [...sourceSegments].sort((a, b) => a.lineKey.localeCompare(b.lineKey) || a.horizontalOrder - b.horizontalOrder || a.segmentKey.localeCompare(b.segmentKey));
  const orderedUpstream = [...sourceUpstream].sort((a, b) => a.segmentKey.localeCompare(b.segmentKey));
  const drafts = formPhysicalGrid("golden-region-processed", "golden-region", 1, orderedLines, orderedColumns);
  const formed = formPhysicalCellHypotheses(drafts, orderedSegments, associateSegmentsToPhysicalGrid(orderedSegments, drafts, orderedUpstream));
  const metrics = computeRegionMetrics(formed.intersections, formed.cells, formed.dispositions, orderedLines.length, orderedColumns.length, 0);
  const payload = { status: "formed_with_ambiguities", intersections: formed.intersections, cells: formed.cells, dispositions: formed.dispositions, metrics };
  return { ...payload, fingerprint: computeContentFingerprint("golden-trace-v1", payload) };
}

const actual = run(lines, columns, segments, upstream);
const expected = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "testing", "physical-cell-hypothesis-formation-golden-trace.json"), "utf8"));
if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`complete golden trace changed: ${JSON.stringify(actual, null, 2)}`);
const permuted = run([...lines].reverse(), [...columns].reverse(), [...segments].reverse(), [...upstream].reverse());
if (JSON.stringify(permuted) !== JSON.stringify(actual)) throw new Error("array permutation changed canonical golden trace");
console.log("ok - complete golden trace covers simple, empty, multi-segment, partial, inherited ambiguity, orphan, metrics, keys, dispositions, full JSON and permutation");
