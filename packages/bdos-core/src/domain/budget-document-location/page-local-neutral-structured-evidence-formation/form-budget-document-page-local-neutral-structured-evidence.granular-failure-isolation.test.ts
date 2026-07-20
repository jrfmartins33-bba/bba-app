import type { ReconstructedHorizontalSegment, ReconstructedPhysicalLine } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import { cellFormationRegion, cellHypothesis, fragment, gridIntersection, regionCandidate, resolvedSegment, structureLine, structureMaps, structureSegment, textEvidence, textEvidenceRegion } from "./testing/page-local-neutral-structured-evidence-formation-fixture-builders";
import { formNeutralDocumentRegion } from "./form-neutral-document-region";
import { formNeutralDocumentLine } from "./form-neutral-document-line";
import { formNeutralDocumentPosition } from "./form-neutral-document-position";
import { validateRegionConservation, validateRegionMetricConservation } from "./page-local-neutral-structured-evidence-formation-conservation";
import { formBudgetDocumentPageLocalNeutralStructuredEvidenceWithDependencies, getDefaultPageLocalNeutralStructuredEvidenceFormationDependencies } from "./form-budget-document-page-local-neutral-structured-evidence";
import { buildPageLocalNeutralStructuredEvidenceFormationInput } from "./testing/page-local-neutral-structured-evidence-formation-test-bridge";
import type { SyntheticGeometryPage } from "./testing/page-local-neutral-structured-evidence-formation-test-bridge";

/**
 * Correção B1 (§18/§22 da especificação aprovada): prova, isoladamente por
 * nível, que uma falha de célula nunca derruba a posição; uma falha de
 * posição nunca derruba a linha; uma falha de linha nunca derruba a região; e
 * que `neutral_region_formation_failed` fica restrito a uma falha genuína do
 * próprio contêiner da região (nunca usado para substituir os três códigos
 * acima). A falha genuína de região (item 4 da matriz) já é integralmente
 * coberta por `form-budget-document-page-local-neutral-structured-evidence.region-isolation.test.ts`
 * (região da página 2 falha, páginas 1/3 e o grupo permanecem intactos) — não
 * duplicada aqui.
 */

const lineWithOrder = (key: string, verticalOrder: number, segs: ReadonlyArray<string>): ReconstructedPhysicalLine => ({ ...structureLine(key, 1, segs), verticalOrder });

// --- (1) Falha de célula isolada ---------------------------------------------
{
  const lines = [lineWithOrder("A", 1, ["Aseg1", "Aseg2"])];
  const segments: ReconstructedHorizontalSegment[] = [structureSegment("Aseg1", "A", 1, 1, [0]), structureSegment("Aseg2", "A", 1, 2, [1])];
  const candidate = regionCandidate("R", 1, 1, ["A"]);
  const intersections = [gridIntersection("gi-ok", "A", 1, 1, "cell-ok", 1, "R"), gridIntersection("gi-missing-evidence", "A", 1, 2, "cell-missing-evidence", 2, "R")];
  const cells = [cellHypothesis("cell-ok", "gi-ok", ["Aseg1"]), cellHypothesis("cell-missing-evidence", "gi-missing-evidence", ["Aseg2"])];
  // Deliberadamente ausente: evidência textual só para "cell-ok" — "cell-missing-evidence"
  // não tem entrada correspondente em cellTextEvidences (cenário que a validação global de
  // entrada normalmente barra antes da formação; testado aqui diretamente no construtor de
  // região, em defesa de profundidade, exatamente como os demais testes desta capacidade já
  // testam `formNeutralDocumentRegion` diretamente, sem atravessar `validatePageLocal...Input`).
  const evidences = [textEvidence("cell-ok", "gi-ok", "formed", [resolvedSegment("Aseg1", "A", [fragment(1, 0, "x", "x")])])];
  const f2cRegion = cellFormationRegion("R", 1, "formed", intersections, cells);
  const g1Region = textEvidenceRegion("R", 1, "formed", evidences);
  const maps = structureMaps(lines, segments);

  const region = formNeutralDocumentRegion(candidate, f2cRegion, g1Region, maps.lineByKey, maps.segmentByKey, { groupKey: "G1" });
  const line = region.documentLines[0];
  const okPosition = line.positions.find((p) => p.gridIntersectionKey === "gi-ok")!;
  const failedPosition = line.positions.find((p) => p.gridIntersectionKey === "gi-missing-evidence")!;

  if (line.status !== "structured_with_problems") throw new Error("a line with one failed cell (among others) must be structured_with_problems, never failed");
  if (region.status !== "structured_with_problems") throw new Error("a region with one failed cell must be structured_with_problems, never failed or grid_without_cells");
  if (okPosition.status !== "cell_structured" || okPosition.cell === null || okPosition.cell.status !== "structured") throw new Error("the unaffected cell/position on the SAME line must remain fully structured");
  if (failedPosition.status !== "cell_structured") throw new Error("a position whose cell failed must remain cell_structured, never empty (empty means no cell hypothesis was ever formed — a different fact)");
  if (failedPosition.status === "cell_structured" && failedPosition.cell === null) throw new Error("a cell_structured position must always carry a cell object, even a failed one");
  if (failedPosition.status === "cell_structured" && failedPosition.cell !== null) {
    if (failedPosition.cell.status !== "failed") throw new Error("the cell with missing text evidence must be status failed");
    if (failedPosition.cell.sourceCellHypothesis === null || failedPosition.cell.sourceCellHypothesis.cellHypothesisKey !== "cell-missing-evidence") throw new Error("the failed cell must preserve sourceCellHypothesis (it WAS available)");
    if (failedPosition.cell.sourceTextEvidence !== null) throw new Error("the failed cell must have sourceTextEvidence null (it was genuinely unavailable)");
    if (failedPosition.cell.sourceTextEvidenceStatus !== null) throw new Error("sourceTextEvidenceStatus must be null when sourceTextEvidence itself is null");
  }
  const cellProblem = line.technicalProblems.find((p) => p.code === "neutral_cell_formation_failed");
  if (!cellProblem) throw new Error("a neutral_cell_formation_failed problem must be recorded");
  if (cellProblem.groupKey !== "G1" || cellProblem.pageNumber !== 1 || cellProblem.regionKey !== "R" || cellProblem.lineKey !== "A" || cellProblem.gridIntersectionKey !== "gi-missing-evidence" || cellProblem.cellHypothesisKey !== "cell-missing-evidence") {
    throw new Error("the cell-formation problem must carry full granularity: group, page, region, line, intersection, cell");
  }
  if (cellProblem.message.includes("undefined") || cellProblem.message.length > 200) throw new Error("the technical problem message must be a short controlled Portuguese message, never a raw error dump");

  // Nenhuma categoria desaparece; a célula falha entra em cellFailedCount, não em emptyPositionCount.
  if (region.metrics.emptyPositionCount !== 0) throw new Error("a failed cell must never be counted as an empty position");
  if (region.metrics.cellFailedCount !== 1) throw new Error("the region metrics must count exactly one failed cell");
  if (region.metrics.documentCellCount !== 2) throw new Error("both cells (one structured, one failed) must be counted in documentCellCount — a failed cell is not erased from the population");

  if (validateRegionConservation(region, candidate, f2cRegion, g1Region) !== null) throw new Error("a region with a correctly-recorded isolated cell failure must still pass structural conservation");
  if (!validateRegionMetricConservation(region, candidate, f2cRegion, g1Region)) throw new Error("a region with a correctly-recorded isolated cell failure must still pass metric conservation");

  console.log("ok - isolated cell formation failure: the affected cell is a failed shell (sourceCellHypothesis preserved, sourceTextEvidence null), its position stays cell_structured (never empty), the sibling position/cell on the same line is untouched, the line/region degrade only to structured_with_problems, neutral_cell_formation_failed is recorded with full granularity, and conservation still holds");
}

// --- (2) Falha de posição isolada (injeção via seam de dependências) --------
{
  const lines = [lineWithOrder("A", 1, ["Aseg1", "Aseg2"])];
  const segments: ReconstructedHorizontalSegment[] = [structureSegment("Aseg1", "A", 1, 1, [0]), structureSegment("Aseg2", "A", 1, 2, [1])];
  const candidate = regionCandidate("R", 1, 1, ["A"]);
  const intersections = [gridIntersection("gi-ok", "A", 1, 1, "cell-ok", 1, "R"), gridIntersection("gi-fails", "A", 1, 2, "cell-fails", 2, "R")];
  const cells = [cellHypothesis("cell-ok", "gi-ok", ["Aseg1"]), cellHypothesis("cell-fails", "gi-fails", ["Aseg2"])];
  const evidences = [
    textEvidence("cell-ok", "gi-ok", "formed", [resolvedSegment("Aseg1", "A", [fragment(1, 0, "x", "x")])]),
    textEvidence("cell-fails", "gi-fails", "formed", [resolvedSegment("Aseg2", "A", [fragment(1, 1, "y", "y")])]),
  ];
  const f2cRegion = cellFormationRegion("R", 1, "formed", intersections, cells);
  const g1Region = textEvidenceRegion("R", 1, "formed", evidences);
  const maps = structureMaps(lines, segments);

  const injectedPositionDependencies = {
    formNeutralDocumentPosition: (intersection: Parameters<typeof formNeutralDocumentPosition>[0], ...rest: Parameters<typeof formNeutralDocumentPosition> extends [unknown, ...infer R] ? R : never) => {
      if (intersection.gridIntersectionKey === "gi-fails") throw new Error("injected position formation failure");
      return formNeutralDocumentPosition(intersection, ...rest);
    },
  };

  const region = formNeutralDocumentRegion(candidate, f2cRegion, g1Region, maps.lineByKey, maps.segmentByKey, { groupKey: "G1" }, { formNeutralDocumentLine, lineDependencies: injectedPositionDependencies });
  const line = region.documentLines[0];
  const okPosition = line.positions.find((p) => p.gridIntersectionKey === "gi-ok")!;
  const failedPosition = line.positions.find((p) => p.gridIntersectionKey === "gi-fails")!;

  if (failedPosition.status !== "technical_failure") throw new Error("an injected position formation failure must produce a technical_failure position shell");
  if (failedPosition.cell !== null) throw new Error("a technical_failure position must never carry a synthetic cell");
  if (failedPosition.sourceGridIntersection.gridIntersectionKey !== "gi-fails") throw new Error("the position shell must preserve its sourceGridIntersection");
  if (okPosition.status !== "cell_structured" || okPosition.cell === null || okPosition.cell.status !== "structured") throw new Error("the unaffected position on the SAME line must remain fully structured");
  if (line.status !== "structured_with_problems") throw new Error("a line with one failed position must be structured_with_problems, never failed");
  if (region.status !== "structured_with_problems") throw new Error("a region with one failed position must be structured_with_problems, never failed");

  const positionProblem = line.technicalProblems.find((p) => p.code === "neutral_position_formation_failed");
  if (!positionProblem) throw new Error("a neutral_position_formation_failed problem must be recorded");
  if (positionProblem.gridIntersectionKey !== "gi-fails" || positionProblem.lineKey !== "A" || positionProblem.regionKey !== "R" || positionProblem.groupKey !== "G1") throw new Error("the position-formation problem must carry full granularity");
  if (positionProblem.message.includes("injected position formation failure")) throw new Error("the raw Error.message must never be propagated into the controlled technical problem message");

  if (region.metrics.technicalFailurePositionCount !== 1) throw new Error("the region metrics must count exactly one technical-failure position");
  if (region.metrics.emptyPositionCount !== 0) throw new Error("a failed position must never be counted as empty");

  if (validateRegionConservation(region, candidate, f2cRegion, g1Region) !== null) throw new Error("a region with a correctly-recorded isolated position failure must still pass structural conservation");
  if (!validateRegionMetricConservation(region, candidate, f2cRegion, g1Region)) throw new Error("a region with a correctly-recorded isolated position failure must still pass metric conservation");

  console.log("ok - isolated position formation failure (injected): the affected position becomes a technical_failure shell preserving sourceGridIntersection with no synthetic cell, the sibling position on the same line is untouched, the line/region degrade only to structured_with_problems, neutral_position_formation_failed is recorded with full granularity and never leaks the raw exception message, and conservation still holds");
}

// --- (3) Falha de linha isolada (injeção via seam de dependências) ----------
{
  const lines = [lineWithOrder("A", 1, ["Aseg"]), lineWithOrder("B", 2, ["Bseg"])];
  const segments: ReconstructedHorizontalSegment[] = [structureSegment("Aseg", "A", 1, 1, [0]), structureSegment("Bseg", "B", 1, 1, [1])];
  const candidate = regionCandidate("R", 1, 1, ["A", "B"]);
  const intersections = [gridIntersection("gi-a", "A", 1, 1, "cell-a", 1, "R"), gridIntersection("gi-b", "B", 2, 1, "cell-b", 1, "R")];
  const cells = [cellHypothesis("cell-a", "gi-a", ["Aseg"]), cellHypothesis("cell-b", "gi-b", ["Bseg"])];
  const evidences = [
    textEvidence("cell-a", "gi-a", "formed", [resolvedSegment("Aseg", "A", [fragment(1, 0, "x", "x")])]),
    textEvidence("cell-b", "gi-b", "formed", [resolvedSegment("Bseg", "B", [fragment(1, 1, "y", "y")])]),
  ];
  const f2cRegion = cellFormationRegion("R", 1, "formed", intersections, cells);
  const g1Region = textEvidenceRegion("R", 1, "formed", evidences);
  const maps = structureMaps(lines, segments);

  const injectedLineDependencies = {
    formNeutralDocumentLine: (structureLineArg: Parameters<typeof formNeutralDocumentLine>[0], ...rest: Parameters<typeof formNeutralDocumentLine> extends [unknown, ...infer R] ? R : never) => {
      if (structureLineArg.lineKey === "B") throw new Error("injected line formation failure");
      return formNeutralDocumentLine(structureLineArg, ...rest);
    },
    lineDependencies: { formNeutralDocumentPosition },
  };

  const region = formNeutralDocumentRegion(candidate, f2cRegion, g1Region, maps.lineByKey, maps.segmentByKey, { groupKey: "G1" }, injectedLineDependencies);
  const lineA = region.documentLines.find((l) => l.sourceLineKey === "A")!;
  const lineB = region.documentLines.find((l) => l.sourceLineKey === "B")!;

  if (lineB.status !== "failed") throw new Error("the injected-failure line must be a failed shell");
  if (lineB.sourceLine.lineKey !== "B") throw new Error("the failed line shell must preserve sourceLine");
  if (lineB.physicalSegments.length !== 1 || lineB.physicalSegments[0].segmentKey !== "Bseg") throw new Error("the failed line shell must preserve the physical segments that could be safely related");
  if (lineB.positions.length !== 0) throw new Error("a genuinely failed line shell must carry no positions — its own assembly failed");
  if (lineA.status !== "structured") throw new Error("the unaffected sibling line in the same region must remain fully structured");
  if (lineA.positions.length !== 1 || lineA.positions[0].status !== "cell_structured") throw new Error("the unaffected sibling line must keep its real position/cell");
  if (region.status !== "structured_with_problems") throw new Error("a region with one failed line must be structured_with_problems, never failed — the region container itself formed fine");

  const lineProblem = lineB.technicalProblems.find((p) => p.code === "neutral_line_formation_failed");
  if (!lineProblem) throw new Error("neutral_line_formation_failed must no longer be dead code — it must be recorded for a genuine line-level failure");
  if (lineProblem.lineKey !== "B" || lineProblem.regionKey !== "R" || lineProblem.groupKey !== "G1") throw new Error("the line-formation problem must carry full granularity");
  if (lineProblem.message.includes("injected line formation failure")) throw new Error("the raw Error.message must never be propagated into the controlled technical problem message");

  // A linha falha ainda participa da população da região (nunca desaparece).
  if (region.documentLines.map((l) => l.sourceLineKey).sort().join(",") !== "A,B") throw new Error("both lines (one structured, one failed) must remain in the region's documentLines population");

  if (validateRegionConservation(region, candidate, f2cRegion, g1Region) !== null) throw new Error("a region with a correctly-recorded isolated line failure must still pass structural conservation");
  if (!validateRegionMetricConservation(region, candidate, f2cRegion, g1Region)) throw new Error("a region with a correctly-recorded isolated line failure must still pass metric conservation");

  console.log("ok - isolated line formation failure (injected): neutral_line_formation_failed is no longer dead code, the failed line is a shell preserving sourceLine and its safely-relatable physical segments with zero positions, the sibling line in the same region is untouched, the region degrades only to structured_with_problems (never neutral_region_formation_failed substituting for the line-level code), the failed line still counts in the region's line population, and conservation still holds");
}

// --- (5)/(6) neutral_region_formation_failed continua restrito a falha genuína do contêiner
// (nunca usado para substituir falha de linha/posição/célula) — reaproveita o seam de nível
// mais alto já coberto por region-isolation.test.ts, aqui apenas confirmando o código exato.
{
  function cell(text: string, left: number, top: number) { return { text, leftPoints: left, topPoints: top, rightPoints: left + 40, bottomPoints: top + 10 }; }
  function pageOf(prefix: string): SyntheticGeometryPage {
    const rows = [0, 1, 2, 3].map((r) => { const y = 100 + r * 20; return [cell(`${prefix}.${r + 1}`, 50, y), cell(`Servico ${r}`, 120, y), cell(`${r + 1}0,00`, 300, y)]; });
    return { widthPoints: 600, heightPoints: 800, items: rows.flat() };
  }
  const input = buildPageLocalNeutralStructuredEvidenceFormationInput("genuine-region-failure", [pageOf("1")]);
  const base = getDefaultPageLocalNeutralStructuredEvidenceFormationDependencies();
  const dependencies = { ...base, formNeutralDocumentRegion: () => { throw new Error("genuine region container failure"); } };
  const result = formBudgetDocumentPageLocalNeutralStructuredEvidenceWithDependencies(input, dependencies);
  const region = result.groups[0].pages[0].regions[0];
  if (region.status !== "failed") throw new Error("a genuine region-container failure must produce a failed region");
  if (region.technicalProblems.every((p) => p.code !== "neutral_region_formation_failed")) throw new Error("a genuine region failure must carry neutral_region_formation_failed, never a line/position/cell code");
  if (region.technicalProblems.some((p) => p.code === "neutral_line_formation_failed" || p.code === "neutral_position_formation_failed" || p.code === "neutral_cell_formation_failed")) throw new Error("neutral_region_formation_failed must never be paired with a line/position/cell code for the same event");

  console.log("ok - neutral_region_formation_failed remains restricted to a genuine region-container failure, distinct in code from the line/position/cell failure codes");
}
