import type { ReconstructedHorizontalSegment, ReconstructedPhysicalLine } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { NeutralDocumentRegion } from "./budget-document-page-local-neutral-structured-evidence-formation.types";
import { cellFormationRegion, cellHypothesis, emptyIntersection, fragment, gridIntersection, regionCandidate, resolvedSegment, structureLine, structureMaps, structureSegment, textEvidence, textEvidenceRegion } from "./testing/page-local-neutral-structured-evidence-formation-fixture-builders";
import { formNeutralDocumentRegion } from "./form-neutral-document-region";
import { validateRegionConservation, validateRegionMetricConservation } from "./page-local-neutral-structured-evidence-formation-conservation";

const lineWithOrder = (key: string, verticalOrder: number, segs: ReadonlyArray<string>): ReconstructedPhysicalLine => ({ ...structureLine(key, 1, segs), verticalOrder });

const lines = [lineWithOrder("A", 1, ["Aseg"]), lineWithOrder("B", 2, ["Bseg"])];
const segments: ReconstructedHorizontalSegment[] = [structureSegment("Aseg", "A", 1, 1, [0]), structureSegment("Bseg", "B", 1, 1, [1])];
const candidate = regionCandidate("R", 1, 1, ["A", "B"]);
const intersections = [gridIntersection("gi-A1", "A", 1, 1, "cA", 1, "R"), emptyIntersection("gi-A2", "A", 1, 2, 1, "R")];
const cells = [cellHypothesis("cA", "gi-A1", ["Aseg"])];
const evidences = [textEvidence("cA", "gi-A1", "formed", [resolvedSegment("Aseg", "A", [fragment(1, 0, "x", "x")])])];
const f2cRegion = cellFormationRegion("R", 1, "formed", intersections, cells);
const g1Region = textEvidenceRegion("R", 1, "formed", evidences);
const maps = structureMaps(lines, segments);

const region = formNeutralDocumentRegion(candidate, f2cRegion, g1Region, maps.lineByKey, maps.segmentByKey, { groupKey: "G1" });

if (validateRegionConservation(region, candidate, f2cRegion, g1Region) !== null) throw new Error("valid region must pass all structural conservation gates");
if (!validateRegionMetricConservation(region, candidate, f2cRegion, g1Region)) throw new Error("valid region must pass metric conservation");

// As tampering clones são deep copies mutáveis (JSON round-trip) — tipadas
// como `any` exclusivamente aqui para permitir a adulteração deliberada que
// prova que cada portão detecta seu próprio desvio.
/* eslint-disable @typescript-eslint/no-explicit-any */
function clone(): any { return JSON.parse(JSON.stringify(region)); }
function expectFailure(mutate: (r: any) => void, code: string): void {
  const tampered = clone();
  mutate(tampered);
  const actual = validateRegionConservation(tampered as NeutralDocumentRegion, candidate, f2cRegion, g1Region);
  if (actual !== code) throw new Error(`expected ${code}, got ${actual}`);
}

expectFailure((r) => { r.documentLines = r.documentLines.slice(0, 1); }, "line_conservation_failed");
expectFailure((r) => { r.documentLines[0].physicalSegments[0].segmentKey = "TAMPERED"; }, "segment_conservation_failed");
expectFailure((r) => { r.documentLines[0].positions.pop(); }, "position_conservation_failed");
expectFailure((r) => { const p = r.documentLines[0].positions.find((entry: any) => entry.status === "cell_structured"); p.cell.status = "failed"; }, "cell_conservation_failed");
expectFailure((r) => { const p = r.documentLines[0].positions.find((entry: any) => entry.status === "cell_structured"); p.cell.sourceTextEvidenceStatus = "partially_formed"; }, "text_evidence_conservation_failed");
expectFailure((r) => { const p = r.documentLines[0].positions.find((entry: any) => entry.status === "cell_structured"); p.cell.sourceTextEvidence.segmentOutcomes[0].fragments[0].originalText = "TAMPERED"; }, "fragment_conservation_failed");
expectFailure((r) => { r.documentLines[0].metrics.positionCount = 99; }, "line_conservation_failed");

// A tampered position status (não mais rederivável da interseção) é detectada.
expectFailure((r) => { const p = r.documentLines[0].positions.find((entry: any) => entry.status === "empty"); p.status = "technical_failure"; }, "position_conservation_failed");

// Métrica publicada divergente é detectada pelo portão de métricas.
{
  const tampered = clone();
  tampered.metrics.positionProducedCount = 42;
  if (validateRegionMetricConservation(tampered as NeutralDocumentRegion, candidate, f2cRegion, g1Region)) throw new Error("tampered region metrics must fail metric conservation");
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Uma região upstream_not_processable (f.2c ausente) conserva-se com linhas sem posições.
{
  const upstreamRegion = formNeutralDocumentRegion(candidate, null, null, maps.lineByKey, maps.segmentByKey, { groupKey: "G1" });
  if (upstreamRegion.status !== "upstream_not_processable") throw new Error("region without f.2c counterpart must be upstream_not_processable");
  if (upstreamRegion.documentLines.some((line) => line.positions.length !== 0 || line.status !== "upstream_not_processable")) throw new Error("every line of an upstream-not-processable region must be upstream_not_processable with no positions");
  if (validateRegionConservation(upstreamRegion, candidate, null, null) !== null) throw new Error("upstream-not-processable region must still conserve");
  if (!validateRegionMetricConservation(upstreamRegion, candidate, null, null)) throw new Error("upstream-not-processable region metrics must conserve");
}

console.log("ok - every structural conservation gate (line, segment, position, cell, text evidence, fragment, partition) and metric conservation catches its exact tampering, and terminal states conserve");
