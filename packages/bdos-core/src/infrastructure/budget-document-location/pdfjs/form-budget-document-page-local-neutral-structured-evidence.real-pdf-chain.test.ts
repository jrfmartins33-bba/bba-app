import { pdfjsPhysicalDocumentReader } from "./pdfjs-physical-document-reader";
import { buildSyntheticPdfBytes } from "./testing/synthetic-pdf-bytes";
import { observeDocumentSignals, locateBudgetDocumentPages, reconstructBudgetDocumentStructure, detectBudgetDocumentTabularRegions, reconstructBudgetDocumentPhysicalColumnHypotheses, formBudgetDocumentPhysicalCellHypotheses, formBudgetDocumentPhysicalCellTextEvidence, formBudgetDocumentPageLocalNeutralStructuredEvidence } from "../../../domain/budget-document-location";

function equal(a: unknown, b: unknown, m = "values differ"): void { if (a !== b) throw new Error(`${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
const bytes = buildSyntheticPdfBytes([{ items: [0, 1, 2, 3].flatMap((row) => { const y = 700 - row * 34; return [{ text: `1.${row + 1} Servico ${row}`, x: 72, y, fontSize: 18 }, { text: `${row + 1}0,00`, x: 400, y, fontSize: 18 }, ...(row === 0 ? [{ text: "BDI", x: 500, y, fontSize: 18 }] : [])]; }) }]);

async function chain() {
  const physicalRead = await pdfjsPhysicalDocumentReader.read(bytes.slice());
  const observation = observeDocumentSignals(physicalRead);
  const pageLocation = locateBudgetDocumentPages(observation);
  const structureReconstruction = reconstructBudgetDocumentStructure({ physicalRead, pageLocation });
  const tabularRegionDetection = detectBudgetDocumentTabularRegions({ structureReconstruction });
  const physicalColumnHypothesisReconstruction = reconstructBudgetDocumentPhysicalColumnHypotheses({ structureReconstruction, tabularRegionDetection });
  const physicalCellHypothesisFormation = formBudgetDocumentPhysicalCellHypotheses({ structureReconstruction, tabularRegionDetection, physicalColumnHypothesisReconstruction });
  const physicalCellTextEvidenceFormation = formBudgetDocumentPhysicalCellTextEvidence({ physicalRead, structureReconstruction, physicalCellHypothesisFormation });
  const neutral = formBudgetDocumentPageLocalNeutralStructuredEvidence({ structureReconstruction, tabularRegionDetection, physicalCellHypothesisFormation, physicalCellTextEvidenceFormation });
  return { physicalColumnHypothesisReconstruction, physicalCellHypothesisFormation, neutral };
}

async function main() {
  const { physicalColumnHypothesisReconstruction: columns, physicalCellHypothesisFormation: f2c, neutral } = await chain();

  equal(neutral.status, "structured");
  equal(neutral.groups.length, 1);
  const region = neutral.groups[0].pages[0].regions[0];
  equal(region.status, "structured");
  const positions = region.documentLines.flatMap((line) => line.positions);
  const cells = positions.filter((p) => p.status === "cell_structured");
  equal(cells.length, 8, "every real cell hypothesis must become a neutral document cell");
  equal(cells.every((p) => p.status === "cell_structured" && p.cell.status === "structured"), true, "every real cell must structure a safe text evidence, no economic interpretation involved");

  equal(cells.every((p) => p.status === "cell_structured" && p.cell.sourceTextEvidence !== null), true, "every real cell over a clean synthetic document must preserve its g.1 text evidence (never a defensive failed shell)");
  const allFragmentTexts = cells.flatMap((p) => (p.status === "cell_structured" && p.cell.sourceTextEvidence ? p.cell.sourceTextEvidence.segmentOutcomes.flatMap((o) => (o.status === "resolved" ? o.fragments.map((f) => f.originalText) : [])) : []));
  equal(allFragmentTexts.some((text) => text.includes("Servico")), true, "a neutral cell must carry the verbatim source text materialized from g.1");
  equal(allFragmentTexts.includes("BDI"), false, "the BDI orphan segment (never a cell) must never appear as a neutral cell fragment");

  // Emenda 3 — cadeia de columnOrder: PhysicalColumnHypothesis.order → PhysicalGridIntersection.columnOrder → NeutralDocumentPosition.columnOrder.
  const columnByKey = new Map(columns.groups.flatMap((g) => g.pages).flatMap((p) => p.regions).flatMap((r) => r.hypotheses).map((h) => [h.hypothesisKey, h]));
  const positionByIntersectionKey = new Map(positions.map((p) => [p.gridIntersectionKey, p]));
  const intersections = f2c.groups.flatMap((g) => g.pages).flatMap((p) => p.regions).flatMap((r) => r.gridIntersections);
  let checkedChain = 0;
  for (const intersection of intersections) {
    const column = columnByKey.get(intersection.sourcePhysicalColumnHypothesisKey);
    if (!column) throw new Error("every intersection must reference a real column hypothesis");
    equal(intersection.columnOrder, column.order, "PhysicalGridIntersection.columnOrder must equal PhysicalColumnHypothesis.order (f.2c is the only place order is flattened)");
    const position = positionByIntersectionKey.get(intersection.gridIntersectionKey);
    if (!position) throw new Error("every intersection must become a neutral position");
    equal(position.columnOrder, intersection.columnOrder, "NeutralDocumentPosition.columnOrder must equal PhysicalGridIntersection.columnOrder — never recomputed");
    checkedChain += 1;
  }
  equal(checkedChain > 0, true, "the columnOrder chain must be exercised by at least one real intersection");

  // Determinismo total da cadeia real.
  const b = await chain();
  equal(JSON.stringify(neutral), JSON.stringify(b.neutral), "the real PDF chain through page-local neutral structured evidence must be deterministic");
  console.log(`ok - synthetic PDF bytes traverse the complete real chain through page-local neutral structured evidence; the PhysicalColumnHypothesis.order → columnOrder → position.columnOrder chain holds for all ${checkedChain} intersections`);
}
main().catch((e) => { console.error(e); process.exit(1); });
